// AI Orchestrator — Gemini-powered sales assistant brain.
// Server-only. Decides intent + action from a customer message using ONLY real product data.
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export const ESCALATION_CONFIDENCE_THRESHOLD = 0.65;

export const AiDecisionSchema = z.object({
  intent: z.enum(["order", "faq", "complaint", "greeting", "other"]),
  action: z.enum([
    "create_order",
    "reply",
    "escalate",
    "check_stock",
    "send_payment",
  ]),
  items: z
    .array(
      z.object({
        product: z.string(),
        quantity: z.number().int().positive(),
      }),
    )
    .default([]),
  reply: z.string(),
  confidence: z.number().min(0).max(1),
});

export type AiDecision = z.infer<typeof AiDecisionSchema>;

export interface OrchestratorProduct {
  name: string;
  price: number;
  stock: number;
  description?: string | null;
  category?: string | null;
}

export interface OrchestratorContext {
  customerName?: string | null;
  customerMessage: string;
  history: { sender: string; content: string }[];
  products: OrchestratorProduct[];
  currency?: string;
}

function buildSystemPrompt(ctx: OrchestratorContext): string {
  const currency = ctx.currency ?? "₦";
  const catalog =
    ctx.products.length === 0
      ? "NO PRODUCTS AVAILABLE."
      : ctx.products
          .map(
            (p) =>
              `- ${p.name} | ${currency}${p.price} | stock: ${p.stock}${
                p.category ? ` | ${p.category}` : ""
              }${p.description ? ` | ${p.description}` : ""}`,
          )
          .join("\n");

  return `You are a friendly, sharp sales assistant working inside WhatsApp/Telegram for a small business.
You behave like a real store clerk and support agent — NOT a robotic chatbot. Be warm, concise and WhatsApp-friendly (short sentences, the occasional emoji).

GOALS (in order):
1. Help the customer and answer questions accurately.
2. Recommend products and move toward closing a sale. Upsell tastefully when relevant.
3. Create orders and request payment when the customer is ready.

STRICT RULES:
- NEVER invent products, prices or stock. Use ONLY the catalog below.
- If asked about something not in the catalog, say it's unavailable and suggest the closest real option.
- If the customer wants to buy, set action="create_order" and fill "items" with exact catalog product names and quantities.
- If they've agreed to an order and just need to pay, use action="send_payment".
- Use action="escalate" if: the customer asks for a human, makes a complaint, requests a refund, or the request is unclear/you're unsure.
- Set "confidence" honestly between 0 and 1. Use < 0.65 when unsure — the system will escalate to a human.
- Keep "reply" short, natural and helpful.

CATALOG:
${catalog}

${ctx.customerName ? `Customer name: ${ctx.customerName}` : ""}`;
}

export async function runOrchestrator(
  ctx: OrchestratorContext,
): Promise<AiDecision> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const gateway = createLovableAiGatewayProvider(apiKey);

  const historyText = ctx.history
    .slice(-10)
    .map((m) => `${m.sender === "customer" ? "Customer" : "Assistant"}: ${m.content}`)
    .join("\n");

  const { experimental_output } = await generateText({
    model: gateway("google/gemini-2.5-flash"),
    system: buildSystemPrompt(ctx),
    prompt: `${historyText ? `Conversation so far:\n${historyText}\n\n` : ""}New customer message: "${ctx.customerMessage}"\n\nRespond with your decision as JSON.`,
    experimental_output: Output.object({ schema: AiDecisionSchema }),
  });

  return experimental_output;
}
