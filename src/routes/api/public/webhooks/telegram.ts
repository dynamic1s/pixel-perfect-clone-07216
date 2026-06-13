import { createFileRoute } from "@tanstack/react-router";

// Telegram Bot API webhook. Inbound updates -> shared AI pipeline.
export const Route = createFileRoute("/api/public/webhooks/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        try {
          const { processInboundMessage } = await import(
            "@/lib/assistant.server"
          );
          const message = body?.message ?? body?.edited_message;
          if (message?.text) {
            const from = message.from;
            const name =
              [from?.first_name, from?.last_name].filter(Boolean).join(" ") ||
              from?.username ||
              null;
            await processInboundMessage({
              channel: "telegram",
              phone: String(message.chat?.id ?? from?.id),
              name,
              text: message.text,
            });
          }
        } catch (e) {
          console.error("Telegram webhook error:", e);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
