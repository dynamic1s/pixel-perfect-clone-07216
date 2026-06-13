import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { ConversationsView } from "@/components/conversations-view";

export const Route = createFileRoute("/_authenticated/conversations")({
  head: () => ({ meta: [{ title: "Conversations — BizBot" }] }),
  component: Conversations,
});

function Conversations() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Conversations" description="All customer chats across your channels." />
      <ConversationsView />
    </div>
  );
}
