import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listIntegrations } from "@/lib/data.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, CreditCard, Plug } from "lucide-react";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrations — BizBot" }] }),
  component: Integrations,
});

const KNOWN: Record<string, { label: string; desc: string; icon: React.ComponentType<{ className?: string }> }> = {
  whatsapp: { label: "WhatsApp", desc: "Receive & reply to customer messages on WhatsApp.", icon: MessageCircle },
  telegram: { label: "Telegram", desc: "Connect your Telegram bot for customer chats.", icon: Send },
  paystack: { label: "Paystack", desc: "Accept payments and confirm orders automatically.", icon: CreditCard },
};

function Integrations() {
  const listFn = useServerFn(listIntegrations);
  const { data: integrations } = useQuery({ queryKey: ["integrations"], queryFn: () => listFn() });

  const providers = ["whatsapp", "telegram", "paystack"];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Integrations"
        description="Connect channels and payments. Currently running in simulation mode."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {providers.map((prov) => {
          const meta = KNOWN[prov] ?? { label: prov, desc: "", icon: Plug };
          const Icon = meta.icon;
          const row = (integrations ?? []).find((i) => i.provider === prov);
          const status = row?.status ?? "simulation";
          return (
            <Card key={prov} className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant={status === "connected" ? "default" : "secondary"}>
                  {status === "connected" ? "Connected" : "Simulation"}
                </Badge>
              </div>
              <p className="mt-3 font-semibold">{meta.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{meta.desc}</p>
            </Card>
          );
        })}
      </div>
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">
          You're in <strong>simulation mode</strong>. Inbound messages, AI replies, orders and
          payment links all work end-to-end with test data. Add live API keys later to go live.
        </p>
      </Card>
    </div>
  );
}
