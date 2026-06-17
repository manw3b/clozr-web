import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Package, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Card, MetricCard } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Tabs } from "@/components/Tabs";
import { Modal, ModalField } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuDivider,
  ContextMenuLabel,
  useContextMenu,
} from "@/components/ContextMenu";
import { useUIStore } from "@/store/uiStore";
import { useUndoableActions } from "@/store/useUndoableActions";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import * as api from "@/lib/api";
import type { Product } from "@/lib/types";
import { VisualProductPicker } from "./VisualProductPicker";

type FilterTab = "todos" | "disponibles" | "agotados";

function isOut(p: Product): boolean {
  return p.trackStock && p.stock <= 0;
}

/**
 * Vista Inventario v1 — port web del catálogo de clozr/src/pages/inventario/.
 * CRUD simple sobre la tabla `catalog` del Worker: lista + métricas + filtros
 * + alta/edición/borrado. DIFERIDO (atado al seed Apple / IMEIs de la desktop):
 * el VisualProductPicker, el tracking unidad-por-unidad (IMEIs), precios por
 * tipo de cliente y la venta rápida. Acá el stock es un número simple.
 */
export function Inventario() {
  const { showToast } = useUIStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("todos");
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const ctxMenu = useContextMenu();
  const [ctxProduct, setCtxProduct] = useState<Product | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listCatalog()
      .then(setProducts)
      .catch(() => showToast("No se pudo cargar el inventario", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const total = products.length;
    const agotados = products.filter(isOut).length;
    return { total, conStock: total - agotados, agotados };
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (tab === "disponibles" && isOut(p)) return false;
      if (tab === "agotados" && !isOut(p)) return false;
      if (q) {
        const hay = [p.name, p.category ?? "", p.sku ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, tab, search]);

  function remove(p: Product) {
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
    useUndoableActions.getState().register({
      label: "Producto eliminado",
      sublabel: p.name,
      onUndo: () => setProducts((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p])),
      commit: () => api.deleteProduct(p.id),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader
        title="Inventario"
        subtitle={loading ? "Cargando…" : `${summary.total} producto${summary.total === 1 ? "" : "s"} en el catálogo`}
        actions={
          <Button variant="primary" iconLeft={<Plus size={16} />} onClick={() => setPickerOpen(true)}>
            Agregar producto
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: space[3] }}>
        <MetricCard label="En catálogo" value={summary.total} icon={<Package size={16} />} />
        <MetricCard label="Con stock" value={summary.conStock} tone="success" />
        <MetricCard label="Agotados" value={summary.agotados} tone={summary.agotados > 0 ? "danger" : "neutral"} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: space[3], flexWrap: "wrap" }}>
        <Tabs
          variant="pills"
          size="sm"
          value={tab}
          onChange={(v) => setTab(v as FilterTab)}
          items={[
            { value: "todos", label: "Todos" },
            { value: "disponibles", label: "Disponibles" },
            { value: "agotados", label: "Agotados" },
          ]}
        />
        <div style={{ flex: 1, minWidth: 200, maxWidth: 360 }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nombre, categoría o SKU…"
            iconLeft={<Search size={14} />}
          />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Package size={28} />}
            title={products.length === 0 ? "Sin productos" : "Nada con esos filtros"}
            description={
              products.length === 0
                ? "Agregá tu primer producto al catálogo."
                : "Probá cambiar la búsqueda o el filtro."
            }
            action={
              products.length === 0
                ? { label: "Agregar producto", iconLeft: <Plus size={14} />, onClick: () => setPickerOpen(true) }
                : undefined
            }
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: space[3],
            }}
          >
            {filtered.map((p) => (
              <Card
                key={p.id}
                interactive
                padding={4}
                onClick={() => setEditing(p)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxProduct(p);
                  ctxMenu.openAt(e);
                }}
              >
                <div style={{ display: "flex", gap: space[3], alignItems: "flex-start" }}>
                  <CardThumb src={p.imagePath} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: text.sm,
                        fontWeight: weight.semibold,
                        color: color.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {p.name}
                    </div>
                    {p.category && (
                      <div style={{ fontSize: text.xs, color: color.textMuted, marginTop: 2 }}>{p.category}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: space[3] }}>
                  <span style={{ fontSize: text.md, fontWeight: weight.bold, color: color.text }}>
                    {formatMoney(p.price, p.currency)}
                  </span>
                  {!p.trackStock ? (
                    <Badge tone="neutral" size="sm">
                      Sin control
                    </Badge>
                  ) : p.stock > 0 ? (
                    <Badge tone="success" size="sm">
                      {p.stock} en stock
                    </Badge>
                  ) : (
                    <Badge tone="danger" size="sm">
                      Agotado
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <VisualProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onCreated={load}
        onSwitchToManual={() => {
          setPickerOpen(false);
          setAdding(true);
        }}
      />

      <ProductModal
        open={adding || editing !== null}
        product={editing}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSaved={() => {
          setAdding(false);
          setEditing(null);
          load();
        }}
      />

      {ctxMenu.open && ctxProduct && (
        <ContextMenu position={ctxMenu.position} onClose={ctxMenu.close}>
          <ContextMenuLabel>{ctxProduct.name}</ContextMenuLabel>
          <ContextMenuItem
            icon={<Pencil size={14} />}
            onClick={() => {
              setEditing(ctxProduct);
              ctxMenu.close();
            }}
          >
            Editar
          </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem
            tone="danger"
            icon={<Trash2 size={14} />}
            onClick={() => {
              const p = ctxProduct;
              ctxMenu.close();
              remove(p);
            }}
          >
            Eliminar
          </ContextMenuItem>
        </ContextMenu>
      )}
    </div>
  );
}

/* ───────── Thumbnail de producto (foto con fallback al ícono) ───────── */

function CardThumb({ src }: { src?: string | null }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [src]);
  const show = !!src && !err;
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.md,
        background: color.surface2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: color.textDim,
        overflow: "hidden",
      }}
    >
      {show ? (
        <img src={src!} alt="" onError={() => setErr(true)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <Package size={20} />
      )}
    </div>
  );
}

/* ───────── Modal alta / edición ───────── */

function ProductModal({
  open,
  product,
  onClose,
  onSaved,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useUIStore();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [sku, setSku] = useState("");
  const [trackStock, setTrackStock] = useState(true);
  const [stock, setStock] = useState("");
  const [saving, setSaving] = useState(false);

  // Sincronizar campos al abrir (edición precarga, alta limpia).
  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setCategory(product?.category ?? "");
    setPrice(product ? String(product.price) : "");
    setCost(product?.cost != null ? String(product.cost) : "");
    setSku(product?.sku ?? "");
    setTrackStock(product ? product.trackStock : true);
    setStock(product ? String(product.stock) : "");
  }, [open, product]);

  const canSubmit = name.trim().length >= 1;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const input: api.ProductInput = {
      name: name.trim(),
      category: category.trim() || null,
      price: price ? Number(price) : 0,
      cost: cost ? Number(cost) : null,
      sku: sku.trim() || null,
      trackStock,
      stock: trackStock ? (stock ? Number(stock) : 0) : 0,
    };
    try {
      if (product) {
        await api.updateProduct(product.id, input);
        showToast("Producto actualizado", "success");
      } else {
        await api.createProduct(input);
        showToast("Producto creado", "success");
      }
      onSaved();
    } catch {
      showToast("No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      isDirty={() => name.trim().length > 0}
      confirmCloseText="¿Cerrar y descartar el producto?"
      title={product ? "Editar producto" : "Nuevo producto"}
      maxWidth={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit} loading={saving}>
            {product ? "Guardar" : "Crear"}
          </Button>
        </>
      }
    >
      <ModalField label="Nombre" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Funda iPhone 15" autoFocus />
      </ModalField>
      <ModalField label="Categoría">
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej: Accesorios" />
      </ModalField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
        <ModalField label="Precio (ARS)">
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </ModalField>
        <ModalField label="Costo (ARS)" hint="Opcional">
          <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
        </ModalField>
      </div>
      <ModalField label="SKU / código" hint="Opcional">
        <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ej: FND-15-NEG" />
      </ModalField>
      <label style={{ display: "flex", alignItems: "center", gap: space[2], cursor: "pointer", marginTop: space[1] }}>
        <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
        <span style={{ fontSize: text.sm, color: color.text }}>Llevar control de stock</span>
      </label>
      {trackStock && (
        <ModalField label="Stock actual">
          <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
        </ModalField>
      )}
    </Modal>
  );
}
