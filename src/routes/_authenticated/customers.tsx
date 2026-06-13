import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers } from "@/lib/data.functions";
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

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers — BizBot" }] }),
  component: Customers,
});

function Customers() {
  const listFn = useServerFn(listCustomers);
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => listFn() });

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Customers" description="People who've chatted with your assistant." />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Orders</TableHead>
              <TableHead>Spent</TableHead>
              <TableHead>Last order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(customers ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No customers yet.
                </TableCell>
              </TableRow>
            )}
            {(customers ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name ?? "Unknown"}</TableCell>
                <TableCell>{c.phone ?? c.email ?? "—"}</TableCell>
                <TableCell className="capitalize">{c.channel}</TableCell>
                <TableCell>
                  <Badge variant={c.segment === "dormant" ? "secondary" : "default"} className="capitalize">
                    {c.segment}
                  </Badge>
                </TableCell>
                <TableCell>{c.total_orders}</TableCell>
                <TableCell>{formatCurrency(Number(c.total_spent))}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(c.last_order_date)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
