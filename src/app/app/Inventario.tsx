import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Package, Pencil, Trash2, Sparkles } from "lucide-react";
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
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useUndoableActions } from "@/store/useUndoableActions";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import { fetchDolares } from "@/lib/dolar";
import * as api from "@/lib/api";
import type { ClientType, Product } from "@/lib/types";
import { CLIENT_TYPE_LABELS, CLIENT_TYPES, CATALOG_PACKS, formatUsd, formatArs } from "@/lib/types";
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
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const appleUnlocked = (activeWorkspace?.unlockedCatalogs ?? []).includes("apple");
  // El banner del pack Apple es un upsell → descartable por workspace.
  const [appleBannerDismissed, setAppleBannerDismissed] = useState(false);
  useEffect(() => {
    const id = activeWorkspace?.id;
    if (!id) return;
    try { setAppleBannerDismissed(localStorage.getItem(`clozr:apple-banner:${id}`) === "1"); } catch { /* ignore */ }
  }, [activeWorkspace?.id]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("todos");
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);

  // Re-hidrata el store tras desbloquear el catálogo (para reflejar el estado).
  async function refreshWs() {
    const me = await api.fetchMe();
    const active = me.workspaces.find((w) => w.id === activeWorkspace?.id) ?? me.workspaces[0] ?? null;
    useWorkspaceStore.setState({ workspaces: me.workspaces, activeWorkspace: active });
  }
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
              onClick={() => (appleUnlocked ? setPickerOpen(true) : setAdding(true))}
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

      {/* F4 — Catálogo Apple premium (desbloqueo único) — upsell descartable */}
      {!appleUnlocked && canWrite && !appleBannerDismissed && (
        <Card padding={4}>
          <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                flexShrink: 0,
                background: color.primaryBg,
                color: color.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>
                Catálogo Apple — cargá productos en segundos
              </div>
              <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2 }}>
                {CATALOG_PACKS.apple.description} Desbloqueo único de {formatUsd(CATALOG_PACKS.apple.priceUsd)}.
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={() => setUnlockOpen(true)}>
              Desbloquear
            </Button>
            <button
              onClick={() => {
                setAppleBannerDismissed(true);
                const id = activeWorkspace?.id;
                if (id) { try { localStorage.setItem(`clozr:apple-banner:${id}`, "1"); } catch { /* ignore */ } }
              }}
              aria-label="Ocultar"
              title="Ocultar"
              className="btn-icon muted"
              style={{ width: 28, height: 28, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>×</span>
            </button>
          </div>
        </Card>
      )}

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

      <UnlockCatalogModal
        open={unlockOpen}
        onClose={() => setUnlockOpen(false)}
        onUnlocked={async () => {
          await refreshWs();
          setUnlockOpen(false);
          setPickerOpen(true); // ya desbloqueado → abrimos el picker visual
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

/* ───────── Desbloqueo de catálogo premium (F4) ───────── */

function UnlockCatalogModal({
  open,
  onClose,
  onUnlocked,
}: {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => Promise<void>;
}) {
  const showToast = useUIStore((s) => s.showToast);
  const pack = CATALOG_PACKS.apple;
  const [blueRate, setBlueRate] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [busyPay, setBusyPay] = useState(false);
  const [busyCode, setBusyCode] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchDolares()
      .then((r) => {
        const b = r.find((x) => x.casa === "blue") ?? r[0];
        if (b?.venta) setBlueRate(b.venta);
      })
      .catch(() => {});
  }, [open]);

  async function pay() {
    setBusyPay(true);
    try {
      const { initPoint } = await api.catalogCheckout(pack.key);
      window.location.assign(initPoint); // → Mercado Pago
    } catch (e) {
      const c = e instanceof api.ApiError ? e.code : "";
      showToast(
        c === "billing_unavailable"
          ? "El cobro no está disponible en este momento."
          : c === "exchange_unavailable"
            ? "No pudimos obtener la cotización del dólar. Probá de nuevo."
            : c === "forbidden"
              ? "Solo el dueño puede desbloquear el catálogo."
              : "No pudimos iniciar el pago. Probá de nuevo.",
        "error",
      );
      setBusyPay(false);
    }
  }

  async function redeem() {
    const c = code.trim();
    if (!c) return;
    setBusyCode(true);
    try {
      const r = await api.redeemCode(c);
      if (r.kind === "unlock") {
        await onUnlocked();
        showToast("¡Catálogo desbloqueado!", "success");
        setCode("");
      } else {
        showToast("Ese código no desbloquea un catálogo.", "error");
      }
    } catch (e) {
      const cc = e instanceof api.ApiError ? e.code : "";
      const M: Record<string, string> = {
        code_not_found: "Ese código no existe.",
        code_disabled: "Ese código está deshabilitado.",
        code_expired: "Ese código venció.",
        code_exhausted: "Ese código alcanzó su límite de usos.",
        forbidden: "Solo el dueño puede canjear códigos.",
      };
      showToast(M[cc] ?? "No pudimos canjear el código.", "error");
    } finally {
      setBusyCode(false);
    }
  }

  const ars = blueRate ? `≈ ${formatArs(pack.priceUsd * blueRate)}` : null;

  return (
    <Modal open={open} onClose={onClose} title="Desbloquear catálogo Apple" maxWidth={460}>
      <div style={{ display: "flex", flexDirection: "column", gap: space[4], padding: space[1] }}>
        <p style={{ fontSize: text.sm, color: color.textMuted, margin: 0, lineHeight: 1.5 }}>{pack.description}</p>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: space[2],
            padding: `${space[3]} ${space[4]}`,
            borderRadius: radius.lg,
            background: color.surface2,
            border: `1px solid ${color.border}`,
          }}
        >
          <span style={{ fontSize: text.xl, fontWeight: weight.bold, color: color.text }}>
            {formatUsd(pack.priceUsd)}
          </span>
          <span style={{ fontSize: text.xs, color: color.textDim }}>
            pago único{ars ? ` · ${ars}` : ""}
          </span>
        </div>

        <Button variant="primary" fullWidth loading={busyPay} onClick={pay}>
          Pagar y desbloquear
        </Button>

        <div style={{ display: "flex", alignItems: "center", gap: space[2], color: color.textDim, fontSize: text.xs }}>
          <span style={{ flex: 1, height: 1, background: color.border }} /> o con un código{" "}
          <span style={{ flex: 1, height: 1, background: color.border }} />
        </div>

        <div style={{ display: "flex", gap: space[2] }}>
          <div style={{ flex: 1 }}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  redeem();
                }
              }}
              placeholder="CLOZR-XXXX-XXXX"
              disabled={busyCode}
            />
          </div>
          <Button variant="secondary" loading={busyCode} disabled={busyCode || !code.trim()} onClick={redeem}>
            Canjear
          </Button>
        </div>
      </div>
    </Modal>
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
    // Precios por tipo: limpiar y, si es edición, cargar los existentes.
    setTypePrices({ final: "", revendedor: "", mayorista: "", empresa: "" });
    setOrigPrices({ final: null, revendedor: null, mayorista: null, empresa: null });
    if (product) {
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
      const id = product ? (await api.updateProduct(product.id, input), product.id) : await api.createProduct(input);
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
