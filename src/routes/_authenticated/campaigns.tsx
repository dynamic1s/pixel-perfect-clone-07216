import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCampaigns } from "@/lib/data.functions";
import { PageHeader, formatDate } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — BizBot" }] }),
  component: Campaigns,
});

function Campaigns() {
  const listFn = useServerFn(listCampaigns);
  const { data: campaigns } = useQuery({ queryKey: ["campaigns"], queryFn: () => listFn() });

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Campaigns"
        description="Re-engagement & broadcast campaigns across WhatsApp and Telegram."
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(campaigns ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No campaigns yet.</p>
        )}
        {(campaigns ?? []).map((c) => (
          <Card key={c.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{c.type}</p>
                </div>
              </div>
              <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
            </div>
            {c.description && <p className="mt-3 text-sm text-muted-foreground">{c.description}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold">{c.audience_count}</p>
                <p className="text-xs text-muted-foreground">Audience</p>
              </div>
              <div>
                <p className="text-lg font-bold">{c.sent_count}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div>
                <p className="text-lg font-bold">{c.response_rate ?? 0}%</p>
                <p className="text-xs text-muted-foreground">Response</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {c.sent_at ? `Sent ${formatDate(c.sent_at)}` : c.scheduled_at ? `Scheduled ${formatDate(c.scheduled_at)}` : "Draft"}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
