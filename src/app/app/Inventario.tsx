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
import { usePermissions } from "@/store/usePermissions";
import { useUndoableActions } from "@/store/useUndoableActions";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import * as api from "@/lib/api";
import type { ClientType, Product } from "@/lib/types";
import { CLIENT_TYPE_LABELS, CLIENT_TYPES } from "@/lib/types";
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
  const { can } = usePermissions();
  const canWrite = can("inventory.write");
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
          canWrite ? (
            <Button
              variant="primary"
              iconLeft={<Plus size={16} />}
              onClick={() => setPickerOpen(true)}
            >
              Agregar producto
            </Button>
          ) : undefined
        }
      />

      <div className="cz-metric-grid" style={{ ["--cz-cols"]: 3 } as React.CSSProperties}>
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
              products.length === 0 && canWrite
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
                interactive={canWrite}
                padding={4}
                onClick={canWrite ? () => setEditing(p) : undefined}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!canWrite) return;
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
  // Quick-add: el alta muestra solo lo esencial (nombre, precio, stock). Lo
  // demás (categoría, SKU, precios por tipo, refurbish) va en "Más opciones".
  // Al editar arranca expandido (estás gestionando el detalle del producto).
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Serializado: cada unidad es única (IMEI / N° de serie). El stock pasa a ser
  // la cantidad de IMEIs sin vender. `imeis` = persistidos (edición);
  // `pendingImeis` = cargados en el alta antes de existir el producto.
  const [serialized, setSerialized] = useState(false);
  const [imeis, setImeis] = useState<api.CatalogImei[]>([]);
  const [pendingImeis, setPendingImeis] = useState<string[]>([]);
  const [imeiInput, setImeiInput] = useState("");
  // Refurbish interno: reparaciones cargadas a la unidad (cada una suma al costo).
  const [repairs, setRepairs] = useState<api.CatalogRepair[]>([]);
  const [repDesc, setRepDesc] = useState("");
  const [repCost, setRepCost] = useState("");
  const [addingRepair, setAddingRepair] = useState(false);
  // Precios por tipo de cliente (vacío = usa el precio base).
  const [typePrices, setTypePrices] = useState<Record<ClientType, string>>({
    final: "", revendedor: "", mayorista: "", empresa: "",
  });
  const [origPrices, setOrigPrices] = useState<Record<ClientType, number | null>>({
    final: null, revendedor: null, mayorista: null, empresa: null,
  });

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
    setShowAdvanced(!!product); // alta: colapsado; edición: expandido
    // Serializado / IMEIs: reset; en edición se cargan del server.
    setSerialized(false);
    setImeis([]);
    setPendingImeis([]);
    setImeiInput("");
    // Refurbish: reset; en edición se cargan las reparaciones del server.
    setRepairs([]);
    setRepDesc("");
    setRepCost("");
    // Precios por tipo: limpiar y, si es edición, cargar los existentes.
    setTypePrices({ final: "", revendedor: "", mayorista: "", empresa: "" });
    setOrigPrices({ final: null, revendedor: null, mayorista: null, empresa: null });
    if (product) {
      api.listCatalogImeis(product.id)
        .then((list) => {
          setImeis(list);
          setSerialized(list.length > 0);
        })
        .catch(() => {});
      api.listCatalogRepairs(product.id).then(setRepairs).catch(() => {});
      api.listCatalogPrices()
        .then((all) => {
          const tp: Record<ClientType, string> = { final: "", revendedor: "", mayorista: "", empresa: "" };
          const op: Record<ClientType, number | null> = { final: null, revendedor: null, mayorista: null, empresa: null };
          for (const p of all) {
            if (p.catalogItemId === product.id) {
              tp[p.customerType] = String(p.price);
              op[p.customerType] = p.price;
            }
          }
          setTypePrices(tp);
          setOrigPrices(op);
        })
        .catch(() => {});
    }
  }, [open, product]);

  const canSubmit = name.trim().length >= 1;

  // Stock derivado en modo serializado = unidades sin vender + las pendientes.
  const availableCount = imeis.filter((x) => !x.soldAt).length + pendingImeis.length;

  // Agrega IMEIs desde el textarea: separa por línea/coma/; — sirve para pegar
  // una lista completa o escribir uno y dar Enter (uno por uno).
  async function addImeisFromInput() {
    const list = Array.from(
      new Set(imeiInput.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)),
    );
    if (list.length === 0) return;
    if (product) {
      try {
        const res = await api.addCatalogImeis(product.id, list);
        setImeis(res.imeis);
        setStock(String(res.stock));
        if (res.skipped > 0) showToast(`${res.added} agregados · ${res.skipped} ya existían`, "info");
      } catch {
        showToast("No se pudieron agregar los IMEIs", "error");
        return;
      }
    } else {
      // Alta: el producto aún no existe — acumular local (dedup) y guardar al crear.
      setPendingImeis((prev) => Array.from(new Set([...prev, ...list])));
    }
    setImeiInput("");
  }

  async function removeServerImei(id: string) {
    if (!product) return;
    try {
      const res = await api.deleteCatalogImei(product.id, id);
      setImeis((prev) => prev.filter((x) => x.id !== id));
      setStock(String(res.stock));
    } catch {
      showToast("No se puede borrar: la unidad ya fue vendida", "error");
    }
  }
  function removePendingImei(imei: string) {
    setPendingImeis((prev) => prev.filter((x) => x !== imei));
  }

  // Refurbish: total de reparaciones (desglose; ya está incluido en el costo).
  const repairsTotal = repairs.reduce((a, r) => a + r.cost, 0);

  async function addRepair() {
    const description = repDesc.trim();
    const c = Number(repCost);
    if (!product || !description || !Number.isFinite(c) || c < 0) return;
    setAddingRepair(true);
    try {
      const res = await api.addCatalogRepair(product.id, { description, cost: c });
      setRepairs((prev) => [res.repair, ...prev]);
      setCost(String(res.cost)); // el costo del equipo ya incluye la reparación
      setRepDesc("");
      setRepCost("");
    } catch {
      showToast("No se pudo agregar la reparación", "error");
    } finally {
      setAddingRepair(false);
    }
  }

  async function removeRepair(id: string) {
    if (!product) return;
    try {
      const res = await api.deleteCatalogRepair(product.id, id);
      setRepairs((prev) => prev.filter((r) => r.id !== id));
      setCost(String(res.cost));
    } catch {
      showToast("No se pudo borrar la reparación", "error");
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const input: api.ProductInput = {
      name: name.trim(),
      category: category.trim() || null,
      price: price ? Number(price) : 0,
      cost: cost ? Number(cost) : null,
      sku: sku.trim() || null,
      // Serializado ⇒ siempre con tracking y stock = unidades disponibles.
      trackStock: serialized ? true : trackStock,
      stock: serialized ? availableCount : trackStock ? (stock ? Number(stock) : 0) : 0,
    };
    try {
      const id = product ? (await api.updateProduct(product.id, input), product.id) : await api.createProduct(input);
      // Alta serializada: persistir los IMEIs acumulados (el Worker fija el stock).
      if (!product && serialized && pendingImeis.length > 0) {
        await api.addCatalogImeis(id, pendingImeis);
      }
      // Upsert de precios por tipo (sólo los que cambiaron). Vacío/0 = borrar.
      await Promise.all(
        CLIENT_TYPES.map((t) => {
          const raw = typePrices[t].trim();
          const n = raw ? Number(raw) : NaN;
          const norm = isFinite(n) && n > 0 ? n : null;
          if (norm === origPrices[t]) return Promise.resolve();
          return api.setCatalogPrice(id, t, norm);
        }),
      );
      showToast(product ? "Producto actualizado" : "Producto creado", "success");
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
        <ModalField label="Precio (ARS)">
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </ModalField>
        <ModalField label="Costo (ARS)" hint="Opcional">
          <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
        </ModalField>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        style={{
          textAlign: "left",
          background: "transparent",
          border: "none",
          color: color.textMuted,
          fontSize: text.sm,
          fontWeight: weight.medium,
          cursor: "pointer",
          padding: "2px 0",
          marginTop: space[1],
        }}
      >
        {showAdvanced ? "− Menos opciones" : "+ Más opciones"}{" "}
        <span style={{ color: color.textDim, fontWeight: 400 }}>· categoría, SKU, precios por tipo, reparaciones</span>
      </button>

      {showAdvanced && (
        <>
          <ModalField label="Categoría">
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ej: Accesorios" />
          </ModalField>
          {/* Refurbish interno: reparaciones / repuestos cargados a la unidad */}
          <div style={{ marginBottom: space[5] }}>
        <div style={{ fontSize: text.sm, fontWeight: weight.medium, color: color.textMuted, marginBottom: 4 }}>
          Reparaciones / refurbish <span style={{ color: color.textDim, fontWeight: 400 }}>· se suman al costo</span>
        </div>
        {product ? (
          <>
            {repairs.length > 0 && (
              <div style={{ border: `1px solid ${color.border}`, borderRadius: radius.md, marginBottom: space[2] }}>
                {repairs.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: space[2],
                      padding: "6px 10px",
                      borderBottom: `1px solid ${color.border}`,
                      fontSize: text.sm,
                    }}
                  >
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.description}
                    </span>
                    <span style={{ color: color.textMuted, flexShrink: 0 }}>{formatMoney(r.cost, "ARS")}</span>
                    <button
                      type="button"
                      onClick={() => removeRepair(r.id)}
                      aria-label="Quitar reparación"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: radius.sm,
                        color: color.textDim,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", fontSize: text.sm }}>
                  <span style={{ color: color.textMuted }}>Total reparaciones</span>
                  <span style={{ fontWeight: weight.semibold }}>{formatMoney(repairsTotal, "ARS")}</span>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: space[2], alignItems: "center" }}>
              <input
                value={repDesc}
                onChange={(e) => setRepDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addRepair();
                  }
                }}
                placeholder="Reparación / repuesto (ej: Pantalla OEM)"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: color.surface2,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  padding: "8px 10px",
                  color: color.text,
                  fontSize: text.sm,
                  fontFamily: "inherit",
                }}
              />
              <input
                type="number"
                value={repCost}
                onChange={(e) => setRepCost(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addRepair();
                  }
                }}
                placeholder="Costo"
                style={{
                  width: 96,
                  flexShrink: 0,
                  background: color.surface2,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.md,
                  padding: "8px 10px",
                  color: color.text,
                  fontSize: text.sm,
                  fontFamily: "inherit",
                }}
              />
              <Button variant="secondary" onClick={addRepair} disabled={!repDesc.trim() || addingRepair} loading={addingRepair}>
                Sumar
              </Button>
            </div>
            <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 6 }}>
              El costo de arriba ya incluye las reparaciones · Costo real del equipo: {formatMoney(Number(cost) || 0, "ARS")}
            </div>
          </>
        ) : (
          <div style={{ fontSize: text.xs, color: color.textDim }}>
            Disponible al editar: creá el producto y reabrílo para cargar reparaciones.
          </div>
        )}
      </div>

      <ModalField label="SKU / código" hint="Opcional">
        <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ej: FND-15-NEG" />
      </ModalField>
      <div style={{ marginBottom: space[5] }}>
        <div style={{ fontSize: text.sm, fontWeight: weight.medium, color: color.textMuted, marginBottom: 4 }}>
          Precios por tipo de cliente <span style={{ color: color.textDim, fontWeight: 400 }}>· opcional</span>
        </div>
        <div style={{ fontSize: text.xs, color: color.textDim, marginBottom: 8 }}>
          Dejá vacío para usar el precio base. Al cargar una venta se sugiere según el tipo del cliente.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
          {CLIENT_TYPES.map((t) => (
            <div key={t}>
              <label style={{ display: "block", fontSize: text.xs, color: color.textMuted, marginBottom: 4 }}>
                {CLIENT_TYPE_LABELS[t]}
              </label>
              <Input
                type="number"
                value={typePrices[t]}
                onChange={(e) => setTypePrices((p) => ({ ...p, [t]: e.target.value }))}
                placeholder={price || "0"}
              />
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      {/* Serializado: gestionar por IMEI / N° de serie (iPhones, equipos únicos). */}
      <label style={{ display: "flex", alignItems: "center", gap: space[2], cursor: "pointer", marginTop: space[1] }}>
        <input
          type="checkbox"
          checked={serialized}
          onChange={(e) => {
            setSerialized(e.target.checked);
            if (e.target.checked) setTrackStock(true);
          }}
        />
        <span style={{ fontSize: text.sm, color: color.text }}>
          Gestionar por IMEI / N° de serie{" "}
          <span style={{ color: color.textDim }}>· cada unidad es única</span>
        </span>
      </label>

      {serialized ? (
        <div style={{ marginTop: space[3] }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space[2] }}>
            <span style={{ fontSize: text.sm, fontWeight: weight.medium, color: color.textMuted }}>
              IMEIs / N° de serie
            </span>
            <span style={{ fontSize: text.xs, color: color.textDim }}>
              {availableCount} en stock
            </span>
          </div>
          <textarea
            value={imeiInput}
            onChange={(e) => setImeiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void addImeisFromInput();
              }
            }}
            placeholder={"Pegá una lista (uno por línea) o escribí uno y Enter\n352099001761481\n352099001761482"}
            rows={3}
            style={{
              width: "100%",
              resize: "vertical",
              minHeight: 64,
              background: color.surface2,
              border: `1px solid ${color.border}`,
              borderRadius: radius.md,
              padding: "8px 10px",
              color: color.text,
              fontSize: text.sm,
              fontFamily: "inherit",
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: space[2] }}>
            <Button variant="secondary" size="sm" onClick={() => void addImeisFromInput()} disabled={!imeiInput.trim()}>
              Agregar
            </Button>
          </div>
          {(imeis.length > 0 || pendingImeis.length > 0) && (
            <div
              style={{
                marginTop: space[2],
                maxHeight: 180,
                overflowY: "auto",
                border: `1px solid ${color.border}`,
                borderRadius: radius.md,
              }}
            >
              {pendingImeis.map((imei) => (
                <ImeiRow key={`pending-${imei}`} imei={imei} onRemove={() => removePendingImei(imei)} />
              ))}
              {imeis.map((row) => (
                <ImeiRow
                  key={row.id}
                  imei={row.imei}
                  sold={!!row.soldAt}
                  onRemove={row.soldAt ? undefined : () => void removeServerImei(row.id)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: space[2], cursor: "pointer", marginTop: space[1] }}>
            <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
            <span style={{ fontSize: text.sm, color: color.text }}>Llevar control de stock</span>
          </label>
          {trackStock && (
            <ModalField label="Stock actual">
              <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
            </ModalField>
          )}
        </>
      )}
    </Modal>
  );
}

/** Fila de un IMEI en el modal: número monoespaciado + estado/acción.
 *  Sin `onRemove` y con `sold` → unidad vendida (no se puede quitar). */
function ImeiRow({ imei, sold, onRemove }: { imei: string; sold?: boolean; onRemove?: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: space[2],
        padding: "6px 10px",
        borderBottom: `1px solid ${color.border}`,
        fontSize: text.sm,
      }}
    >
      <span
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: sold ? color.textDim : color.text,
          textDecoration: sold ? "line-through" : "none",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {imei}
      </span>
      {sold ? (
        <span style={{ fontSize: text.xs, color: color.textDim, flexShrink: 0 }}>vendido</span>
      ) : onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar IMEI"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: radius.sm,
            color: color.textDim,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </div>
  );
}
