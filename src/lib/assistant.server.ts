// Core inbound-message pipeline. Server-only (uses service-role admin client).
// Used by channel webhooks and the in-app simulator.
import {
  runOrchestrator,
  ESCALATION_CONFIDENCE_THRESHOLD,
  type AiDecision,
} from "@/lib/ai/orchestrator.server";

export interface InboundMessage {
  channel: "whatsapp" | "telegram";
  phone: string;
  name?: string | null;
  text: string;
}

export interface ProcessResult {
  conversationId: string;
  customerId: string;
  reply: string;
  escalated: boolean;
  decision: AiDecision | null;
  orderId?: string;
  orderNumber?: string;
  paymentLink?: string;
}

function genOrderNumber() {
  return `ORD-${Math.floor(10000 + Math.random() * 89999)}`;
}

// Simulated Paystack payment link (no live keys in simulation mode).
function buildPaymentLink(reference: string) {
  return `https://checkout.paystack.com/sim/${reference}`;
}

export async function processInboundMessage(
  msg: InboundMessage,
): Promise<ProcessResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1. Find or create customer
  let customer:
    | { id: string; name: string | null }
    | null = null;
  {
    const { data } = await supabaseAdmin
      .from("customers")
      .select("id, name")
      .eq("phone", msg.phone)
      .eq("channel", msg.channel)
      .maybeSingle();
    customer = data;
  }
  if (!customer) {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert({
        phone: msg.phone,
        name: msg.name ?? null,
        channel: msg.channel,
        segment: "new",
      })
      .select("id, name")
      .single();
    if (error) throw error;
    customer = data;
  }

  // 2. Find or create an active/escalated conversation
  let conversation:
    | { id: string; status: string; ai_enabled: boolean }
    | null = null;
  {
    const { data } = await supabaseAdmin
      .from("conversations")
      .select("id, status, ai_enabled")
      .eq("customer_id", customer.id)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    conversation = data;
  }
  if (!conversation) {
    const { data, error } = await supabaseAdmin
      .from("conversations")
      .insert({
        customer_id: customer.id,
        channel: msg.channel,
        status: "active",
        ai_enabled: true,
      })
      .select("id, status, ai_enabled")
      .single();
    if (error) throw error;
    conversation = data;
  }

  // 3. Store the customer message
  await supabaseAdmin.from("messages").insert({
    conversation_id: conversation.id,
    sender: "customer",
    content: msg.text,
  });
  await supabaseAdmin
    .from("conversations")
    .update({ last_message: msg.text, last_message_at: new Date().toISOString() })
    .eq("id", conversation.id);

  // If a human has taken over, do NOT auto-reply.
  if (conversation.status === "escalated" || !conversation.ai_enabled) {
    return {
      conversationId: conversation.id,
      customerId: customer.id,
      reply: "",
      escalated: true,
      decision: null,
    };
  }

  // 4. Gather context
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("name, price, stock, description, category")
    .eq("status", "active");
  const { data: history } = await supabaseAdmin
    .from("messages")
    .select("sender, content")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true })
    .limit(20);

  // 5. Run the AI orchestrator
  let decision: AiDecision;
  try {
    decision = await runOrchestrator({
      customerName: customer.name,
      customerMessage: msg.text,
      history: history ?? [],
      products: (products ?? []).map((p) => ({
        ...p,
        price: Number(p.price),
      })),
    });
  } catch (e) {
    console.error("Orchestrator failed:", e);
    // Fail safe: escalate to a human.
    await supabaseAdmin
      .from("conversations")
      .update({
        status: "escalated",
        ai_enabled: false,
        priority: "high",
        escalated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
    return {
      conversationId: conversation.id,
      customerId: customer.id,
      reply: "",
      escalated: true,
      decision: null,
    };
  }

  let orderId: string | undefined;
  let orderNumber: string | undefined;
  let paymentLink: string | undefined;
  let shouldEscalate =
    decision.action === "escalate" ||
    decision.confidence < ESCALATION_CONFIDENCE_THRESHOLD;

  // 6. Apply order / payment actions
  if (
    (decision.action === "create_order" || decision.action === "send_payment") &&
    decision.items.length > 0 &&
    !shouldEscalate
  ) {
    const lineItems: {
      product: string;
      quantity: number;
      price: number;
      subtotal: number;
    }[] = [];
    let total = 0;
    for (const item of decision.items) {
      const match = (products ?? []).find(
        (p) => p.name.toLowerCase() === item.product.toLowerCase(),
      );
      if (!match) continue;
      const price = Number(match.price);
      const subtotal = price * item.quantity;
      total += subtotal;
      lineItems.push({
        product: match.name,
        quantity: item.quantity,
        price,
        subtotal,
      });
    }

    if (lineItems.length > 0) {
      orderNumber = genOrderNumber();
      const reference = `${orderNumber}-${Date.now()}`;
      paymentLink = buildPaymentLink(reference);
      const { data: order, error } = await supabaseAdmin
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_id: customer.id,
          items: lineItems,
          total_price: total,
          status: "pending",
          payment_status: "pending",
          payment_reference: reference,
          channel: msg.channel,
        })
        .select("id")
        .single();
      if (!error && order) orderId = order.id;
    }
  }

  // 7. Persist the AI reply
  const replyText = shouldEscalate && !decision.reply
    ? "Let me connect you with a human agent who can help. Please hold on. 🙏"
    : decision.reply;

  await supabaseAdmin.from("messages").insert({
    conversation_id: conversation.id,
    sender: "ai",
    content: replyText,
    intent: decision.intent,
    confidence: decision.confidence,
  });

  // 8. Escalate if needed
  if (shouldEscalate) {
    await supabaseAdmin
      .from("conversations")
      .update({
        status: "escalated",
        ai_enabled: false,
        priority: decision.intent === "complaint" ? "high" : "normal",
        escalated_at: new Date().toISOString(),
        last_message: replyText,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  } else {
    await supabaseAdmin
      .from("conversations")
      .update({
        last_message: replyText,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }

  return {
    conversationId: conversation.id,
    customerId: customer.id,
    reply: replyText,
    escalated: shouldEscalate,
    decision,
    orderId,
    orderNumber,
    paymentLink,
  };
}
