import { createFileRoute } from "@tanstack/react-router";

// WhatsApp Cloud API webhook.
// GET: verification handshake. POST: inbound messages -> AI pipeline.
// Simulation mode: outgoing replies are stored in the conversation; when live
// WhatsApp credentials are added, send via the Cloud API here.
export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? "bizbot_verify";
        if (mode === "subscribe" && token === verifyToken) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
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
          const change = body?.entry?.[0]?.changes?.[0]?.value;
          const message = change?.messages?.[0];
          if (message?.type === "text") {
            const contact = change?.contacts?.[0];
            await processInboundMessage({
              channel: "whatsapp",
              phone: message.from,
              name: contact?.profile?.name ?? null,
              text: message.text.body,
            });
          }
        } catch (e) {
          console.error("WhatsApp webhook error:", e);
        }
        // Always 200 so the platform doesn't retry-storm.
        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
