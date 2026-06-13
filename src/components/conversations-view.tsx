import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listConversations, getMessages } from "@/lib/data.functions";
import { sendAgentReply, updateConversationStatus } from "@/lib/assistant.functions";
import { formatDate } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, User, UserCog, Send } from "lucide-react";
import { toast } from "sonner";

export function ConversationsView({ onlyEscalated }: { onlyEscalated?: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listConversations);
  const msgFn = useServerFn(getMessages);
  const replyFn = useServerFn(sendAgentReply);
  const statusFn = useServerFn(updateConversationStatus);

  const key = onlyEscalated ? "conversations-escalated" : "conversations";
  const { data: conversations } = useQuery({
    queryKey: [key],
    queryFn: () => listFn({ data: { onlyEscalated: !!onlyEscalated } }),
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const { data: messages } = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => msgFn({ data: { conversationId: activeId! } }),
    enabled: !!activeId,
  });

  async function send() {
    if (!activeId || !reply.trim()) return;
    try {
      await replyFn({ data: { conversationId: activeId, text: reply.trim() } });
      setReply("");
      qc.invalidateQueries({ queryKey: ["messages", activeId] });
      qc.invalidateQueries({ queryKey: [key] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    }
  }

  async function setStatus(status: "active" | "escalated" | "resolved", reEnableAi?: boolean) {
    if (!activeId) return;
    try {
      await statusFn({ data: { conversationId: activeId, status, reEnableAi } });
      toast.success("Conversation updated");
      qc.invalidateQueries({ queryKey: [key] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  const active = (conversations ?? []).find((c) => c.id === activeId);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="h-[600px] overflow-auto p-2">
        {(conversations ?? []).length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No conversations.</p>
        )}
        {(conversations ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={`mb-1 w-full rounded-lg p-3 text-left transition-colors hover:bg-accent ${activeId === c.id ? "bg-accent" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {(c.customer as { name?: string } | null)?.name ?? "Unknown"}
              </span>
              <Badge
                variant={c.status === "escalated" ? "destructive" : c.status === "resolved" ? "secondary" : "default"}
                className="text-[10px]"
              >
                {c.status}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{c.last_message ?? "—"}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(c.last_message_at)}</p>
          </button>
        ))}
      </Card>

      <Card className="flex h-[600px] flex-col">
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-semibold">
                  {(active.customer as { name?: string } | null)?.name ?? "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {active.channel} · AI {active.ai_enabled ? "on" : "off"}
                </p>
              </div>
              <div className="flex gap-2">
                {active.status !== "resolved" && (
                  <Button size="sm" variant="outline" onClick={() => setStatus("resolved")}>
                    Resolve
                  </Button>
                )}
                {!active.ai_enabled && (
                  <Button size="sm" variant="outline" onClick={() => setStatus("active", true)}>
                    Re-enable AI
                  </Button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-auto bg-accent/20 p-4">
              {(messages ?? []).map((m) => {
                const isCustomer = m.sender === "customer";
                return (
                  <div key={m.id} className={`flex gap-2 ${isCustomer ? "justify-start" : "justify-end"}`}>
                    {isCustomer && (
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <User className="h-3 w-3" />
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isCustomer ? "bg-card shadow-sm" : m.sender === "agent" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}`}>
                      <p>{m.content}</p>
                      {m.confidence != null && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {m.intent} · {Math.round(Number(m.confidence) * 100)}%
                        </Badge>
                      )}
                    </div>
                    {!isCustomer && (
                      <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        {m.sender === "agent" ? <UserCog className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 border-t p-3">
              <Input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Reply as a human agent…"
              />
              <Button size="icon" onClick={send}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
