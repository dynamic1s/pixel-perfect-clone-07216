import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// Paystack webhook: marks orders paid and updates customer stats.
// In simulation mode (no PAYSTACK_SECRET_KEY) signature checking is skipped.
export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const secret = process.env.PAYSTACK_SECRET_KEY;

        if (secret) {
          const signature = request.headers.get("x-paystack-signature") ?? "";
          const expected = createHmac("sha512", secret)
            .update(raw)
            .digest("hex");
          const a = Buffer.from(signature);
          const b = Buffer.from(expected);
          if (a.length !== b.length || !timingSafeEqual(a, b)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        let body: any;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        if (body?.event === "charge.success") {
          try {
            const { supabaseAdmin } = await import(
              "@/integrations/supabase/client.server"
            );
            const reference = body?.data?.reference;
            if (reference) {
              const { data: order } = await supabaseAdmin
                .from("orders")
                .update({ payment_status: "paid", status: "processing" })
                .eq("payment_reference", reference)
                .select("id, customer_id, total_price")
                .maybeSingle();

              if (order?.customer_id) {
                const { data: cust } = await supabaseAdmin
                  .from("customers")
                  .select("total_orders, total_spent")
                  .eq("id", order.customer_id)
                  .maybeSingle();
                await supabaseAdmin
                  .from("customers")
                  .update({
                    total_orders: (cust?.total_orders ?? 0) + 1,
                    total_spent:
                      Number(cust?.total_spent ?? 0) + Number(order.total_price),
                    last_order_date: new Date().toISOString(),
                    segment: "active",
                  })
                  .eq("id", order.customer_id);
              }
            }
          } catch (e) {
            console.error("Paystack webhook error:", e);
          }
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
