// Read-only dashboard data server functions.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOverviewStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [orders, customers, conversations, products] = await Promise.all([
      sb.from("orders").select("total_price, status, payment_status"),
      sb.from("customers").select("id, segment"),
      sb.from("conversations").select("id, status"),
      sb.from("products").select("id, stock, status"),
    ]);

    const orderRows = orders.data ?? [];
    const paidRevenue = orderRows
      .filter((o) => o.payment_status === "paid")
      .reduce((s, o) => s + Number(o.total_price), 0);
    const totalOrders = orderRows.length;
    const paidOrders = orderRows.filter((o) => o.payment_status === "paid").length;

    const custRows = customers.data ?? [];
    const convRows = conversations.data ?? [];
    const prodRows = products.data ?? [];

    return {
      totalRevenue: paidRevenue,
      totalOrders,
      paidOrders,
      activeCustomers: custRows.filter((c) => c.segment !== "dormant").length,
      totalCustomers: custRows.length,
      escalatedChats: convRows.filter((c) => c.status === "escalated").length,
      activeConversations: convRows.filter((c) => c.status === "active").length,
      conversionRate:
        custRows.length > 0
          ? Math.round((paidOrders / custRows.length) * 1000) / 10
          : 0,
      totalProducts: prodRows.length,
      lowStock: prodRows.filter((p) => p.stock > 0 && p.stock <= 5).length,
      outOfStock: prodRows.filter((p) => p.stock === 0).length,
    };
  });

export const getRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [orders, products] = await Promise.all([
      sb
        .from("orders")
        .select("id, order_number, total_price, status, payment_status, created_at, customer:customers(name, phone)")
        .order("created_at", { ascending: false })
        .limit(8),
      sb
        .from("products")
        .select("id, name, price, stock, image_url")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    return {
      recentOrders: orders.data ?? [],
      topProducts: products.data ?? [],
    };
  });
