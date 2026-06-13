import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ConversationsView } from "@/components/conversations-view";

export const Route = createFileRoute("/_authenticated/escalations")({
  head: () => ({ meta: [{ title: "Escalations — BizBot" }] }),
  component: Escalations,
});

function Escalations() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Escalations"
        description="Chats the AI handed off to a human. Reply, then resolve or re-enable AI."
      />
      <ConversationsView onlyEscalated />
    </div>
  );
}
