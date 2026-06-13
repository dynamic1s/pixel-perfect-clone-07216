import { createFileRoute } from "@tanstack/react-router";

// Daily reminder runner (called by pg_cron). Finds dormant customers
// (no order in 7-14+ days) and queues personalized re-engagement reminders.
// Simulation mode: reminders are stored; with live channel keys they'd be sent.
export const Route = createFileRoute("/api/public/hooks/run-reminders")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          const cutoff = new Date(
            Date.now() - 7 * 24 * 60 * 60 * 1000,
          ).toISOString();

          const { data: customers } = await supabaseAdmin
            .from("customers")
            .select("id, name, channel, last_order_date, total_orders")
            .gt("total_orders", 0)
            .lt("last_order_date", cutoff)
            .limit(100);

          let queued = 0;
          for (const c of customers ?? []) {
            // Avoid duplicate reminders within the last 7 days.
            const { data: recent } = await supabaseAdmin
              .from("reminders")
              .select("id")
              .eq("customer_id", c.id)
              .gt("sent_at", cutoff)
              .limit(1)
              .maybeSingle();
            if (recent) continue;

            await supabaseAdmin.from("reminders").insert({
              customer_id: c.id,
              type: "inactive",
              channel: c.channel,
              message: `Hi ${c.name ?? "there"} 👋 It's been a while! We've got new arrivals you might love. Want to take a look?`,
              status: "sent",
            });
            // Mark customer dormant for segmentation.
            await supabaseAdmin
              .from("customers")
              .update({ segment: "dormant" })
              .eq("id", c.id);
            queued++;
          }
          return Response.json({ success: true, queued });
        } catch (e) {
          console.error("Reminder hook error:", e);
          return Response.json(
            { success: false, error: String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
