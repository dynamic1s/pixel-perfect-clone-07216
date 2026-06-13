import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOverviewStats, getRecentActivity } from "@/lib/dashboard.functions";
import { PageHeader, formatCurrency, formatDate } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  Package,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — BizBot" }] }),
  component: Dashboard,
});

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function Dashboard() {
  const statsFn = useServerFn(getOverviewStats);
  const activityFn = useServerFn(getRecentActivity);
  const { data: stats } = useQuery({ queryKey: ["overview"], queryFn: () => statsFn() });
  const { data: activity } = useQuery({ queryKey: ["activity"], queryFn: () => activityFn() });

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Dashboard" description="Your AI assistant at a glance." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue (paid)" value={formatCurrency(stats?.totalRevenue ?? 0)} icon={DollarSign} sub={`${stats?.paidOrders ?? 0} paid orders`} />
        <StatCard label="Total Orders" value={String(stats?.totalOrders ?? 0)} icon={ShoppingCart} sub={`${stats?.conversionRate ?? 0}% conversion`} />
        <StatCard label="Customers" value={String(stats?.totalCustomers ?? 0)} icon={Users} sub={`${stats?.activeCustomers ?? 0} active`} />
        <StatCard label="Escalations" value={String(stats?.escalatedChats ?? 0)} icon={AlertTriangle} sub={`${stats?.activeConversations ?? 0} active chats`} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Products" value={String(stats?.totalProducts ?? 0)} icon={Package} />
        <StatCard label="Low stock" value={String(stats?.lowStock ?? 0)} icon={TrendingUp} sub="≤ 5 units" />
        <StatCard label="Out of stock" value={String(stats?.outOfStock ?? 0)} icon={Package} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Recent orders</h2>
          <div className="space-y-3">
            {(activity?.recentOrders ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No orders yet. Try the Simulator!</p>
            )}
            {(activity?.recentOrders ?? []).map((o) => (
              <div key={o.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <div>
                  <p className="text-sm font-medium">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {(o.customer as { name?: string } | null)?.name ?? "Unknown"} · {formatDate(o.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(Number(o.total_price))}</p>
                  <Badge variant={o.payment_status === "paid" ? "default" : "secondary"}>
                    {o.payment_status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Latest products</h2>
          <div className="space-y-3">
            {(activity?.topProducts ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No products yet.</p>
            )}
            {(activity?.topProducts ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <p className="text-sm font-medium">{p.name}</p>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(Number(p.price))}</p>
                  <p className="text-xs text-muted-foreground">{p.stock} in stock</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
