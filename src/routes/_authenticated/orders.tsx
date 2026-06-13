import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listOrders, updateOrderStatus } from "@/lib/data.functions";
import { PageHeader, formatCurrency, formatDate } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "Orders — BizBot" }] }),
  component: Orders,
});

const STATUSES = ["pending", "processing", "shipped", "completed", "cancelled"] as const;

function Orders() {
  const qc = useQueryClient();
  const listFn = useServerFn(listOrders);
  const updateFn = useServerFn(updateOrderStatus);
  const { data: orders } = useQuery({ queryKey: ["orders"], queryFn: () => listFn() });

  async function setStatus(id: string, status: (typeof STATUSES)[number]) {
    try {
      await updateFn({ data: { id, status } });
      qc.invalidateQueries({ queryKey: ["orders"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Orders" description="Orders created by the AI and your team." />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No orders yet.
                </TableCell>
              </TableRow>
            )}
            {(orders ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.order_number}</TableCell>
                <TableCell>{(o.customer as { name?: string } | null)?.name ?? "Unknown"}</TableCell>
                <TableCell>{formatCurrency(Number(o.total_price))}</TableCell>
                <TableCell>
                  <Badge variant={o.payment_status === "paid" ? "default" : "secondary"}>
                    {o.payment_status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select value={o.status} onValueChange={(v) => setStatus(o.id, v as (typeof STATUSES)[number])}>
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(o.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
