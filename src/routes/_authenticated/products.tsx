import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, upsertProduct, deleteProduct } from "@/lib/data.functions";
import { PageHeader, formatCurrency } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products — BizBot" }] }),
  component: Products,
});

type Product = Awaited<ReturnType<typeof listProducts>>[number];

function Products() {
  const qc = useQueryClient();
  const listFn = useServerFn(listProducts);
  const upsertFn = useServerFn(upsertProduct);
  const deleteFn = useServerFn(deleteProduct);
  const { data: products } = useQuery({ queryKey: ["products"], queryFn: () => listFn() });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category: "", price: "0", stock: "0" });

  function startNew() {
    setEditing(null);
    setForm({ name: "", description: "", category: "", price: "0", stock: "0" });
    setOpen(true);
  }
  function startEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      category: p.category ?? "",
      price: String(p.price),
      stock: String(p.stock),
    });
    setOpen(true);
  }

  async function save() {
    try {
      await upsertFn({
        data: {
          ...(editing ? { id: editing.id } : {}),
          name: form.name,
          description: form.description || null,
          category: form.category || null,
          price: Number(form.price),
          stock: parseInt(form.stock, 10),
          status: "active",
        },
      });
      toast.success("Product saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function remove(id: string) {
    try {
      await deleteFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Products"
        description="Your catalog — the AI sells only from here."
        action={
          <Button onClick={startNew}>
            <Plus className="mr-1 h-4 w-4" /> Add product
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(products ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No products yet. Add your first one.</p>
        )}
        {(products ?? []).map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{p.name}</p>
                {p.category && <Badge variant="secondary" className="mt-1">{p.category}</Badge>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {p.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{p.description}</p>}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-lg font-bold">{formatCurrency(Number(p.price))}</span>
              <Badge variant={p.stock === 0 ? "destructive" : p.stock <= 5 ? "secondary" : "default"}>
                {p.stock} in stock
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price (₦)</Label>
                <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Stock</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={!form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
