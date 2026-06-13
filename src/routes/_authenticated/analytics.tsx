import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOverviewStats } from "@/lib/dashboard.functions";
import { listOrders } from "@/lib/data.functions";
import { PageHeader, formatCurrency } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — BizBot" }] }),
  component: Analytics,
});

function Analytics() {
  const statsFn = useServerFn(getOverviewStats);
  const ordersFn = useServerFn(listOrders);
  const { data: stats } = useQuery({ queryKey: ["overview"], queryFn: () => statsFn() });
  const { data: orders } = useQuery({ queryKey: ["orders"], queryFn: () => ordersFn() });

  const byDay = new Map<string, number>();
  for (const o of orders ?? []) {
    if (o.payment_status !== "paid") continue;
    const day = new Date(o.created_at).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
    byDay.set(day, (byDay.get(day) ?? 0) + Number(o.total_price));
  }
  const chartData = Array.from(byDay.entries()).map(([day, revenue]) => ({ day, revenue }));

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Analytics" description="Revenue and performance insights." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Total revenue</p>
          <p className="mt-2 text-2xl font-bold">{formatCurrency(stats?.totalRevenue ?? 0)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Conversion rate</p>
          <p className="mt-2 text-2xl font-bold">{stats?.conversionRate ?? 0}%</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Paid orders</p>
          <p className="mt-2 text-2xl font-bold">{stats?.paidOrders ?? 0}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold">Revenue over time</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paid orders yet to chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="day" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
