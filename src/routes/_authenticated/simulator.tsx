import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { simulateMessage } from "@/lib/assistant.functions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, User } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/simulator")({
  head: () => ({ meta: [{ title: "Simulator — BizBot" }] }),
  component: Simulator,
});

type ChatMsg = { role: "customer" | "ai"; text: string; meta?: string };

function Simulator() {
  const sim = useServerFn(simulateMessage);
  const [phone] = useState("+234" + Math.floor(700000000 + Math.random() * 99999999));
  const [name, setName] = useState("Test Customer");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "customer", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await sim({ data: { channel: "whatsapp", phone, name, text } });
      if (res.reply) {
        const meta = [
          res.decision ? `intent: ${res.decision.intent}` : null,
          res.decision ? `confidence: ${Math.round(res.decision.confidence * 100)}%` : null,
          res.escalated ? "escalated" : null,
          res.orderNumber ? `order ${res.orderNumber}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        setMessages((m) => [...m, { role: "ai", text: res.reply, meta }]);
      } else if (res.escalated) {
        setMessages((m) => [
          ...m,
          { role: "ai", text: "(Handed off to a human agent — AI paused)", meta: "escalated" },
        ]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Chat Simulator"
        description="Talk to your AI assistant as a customer would on WhatsApp. Orders & escalations are real."
      />

      <div className="grid max-w-2xl gap-3">
        <Card className="flex h-[560px] flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">BizBot Assistant</p>
              <p className="text-xs text-muted-foreground">WhatsApp · {phone}</p>
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 w-40"
              placeholder="Customer name"
            />
          </div>

          <div className="flex-1 space-y-3 overflow-auto bg-accent/20 p-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Say hi or try "Do you have any laptops in stock?"
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
                {m.role === "ai" && (
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Bot className="h-3 w-3" />
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.role === "customer" ? "bg-primary text-primary-foreground" : "bg-card shadow-sm"}`}>
                  <p>{m.text}</p>
                  {m.meta && (
                    <Badge variant="secondary" className="mt-1.5 text-[10px]">
                      {m.meta}
                    </Badge>
                  )}
                </div>
                {m.role === "customer" && (
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <User className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))}
            {loading && <p className="text-xs text-muted-foreground">BizBot is typing…</p>}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message…"
              disabled={loading}
            />
            <Button size="icon" onClick={send} disabled={loading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
