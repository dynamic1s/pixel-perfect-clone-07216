// Client-callable server functions for the AI assistant.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SimulateInput = z.object({
  channel: z.enum(["whatsapp", "telegram"]).default("whatsapp"),
  phone: z.string().min(3),
  name: z.string().optional(),
  text: z.string().min(1),
});

export const simulateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SimulateInput.parse(input))
  .handler(async ({ data }) => {
    const { processInboundMessage } = await import("@/lib/assistant.server");
    return processInboundMessage({
      channel: data.channel,
      phone: data.phone,
      name: data.name ?? null,
      text: data.text,
    });
  });

// Staff reply inside an escalated conversation (sends as human agent).
const ReplyInput = z.object({
  conversationId: z.string().uuid(),
  text: z.string().min(1),
});

export const sendAgentReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReplyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("messages").insert({
      conversation_id: data.conversationId,
      sender: "agent",
      content: data.text,
    });
    if (error) throw error;
    await context.supabase
      .from("conversations")
      .update({
        last_message: data.text,
        last_message_at: new Date().toISOString(),
      })
      .eq("id", data.conversationId);
    return { ok: true };
  });

const ResolveInput = z.object({
  conversationId: z.string().uuid(),
  status: z.enum(["active", "escalated", "resolved"]),
  reEnableAi: z.boolean().optional(),
});

export const updateConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResolveInput.parse(input))
  .handler(async ({ data, context }) => {
    const patch: {
      status: "active" | "escalated" | "resolved";
      ai_enabled?: boolean;
    } = { status: data.status };
    if (data.reEnableAi !== undefined) patch.ai_enabled = data.reEnableAi;
    if (data.status === "resolved") patch.ai_enabled = false;
    const { error } = await context.supabase
      .from("conversations")
      .update(patch)
      .eq("id", data.conversationId);
    if (error) throw error;
    return { ok: true };
  });
