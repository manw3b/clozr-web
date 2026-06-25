import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Package, Pencil, Trash2, ChevronDown, LayoutGrid, ClipboardPaste, Lock, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Card, MetricCard } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Input } from "@/components/Input";
import { Tabs } from "@/components/Tabs";
import { Modal, ModalField } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { Popover } from "@/components/Popover";
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
import { useWorkspaceStore } from "@/store/workspaceStore";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import { fetchDolares } from "@/lib/dolar";
import * as api from "@/lib/api";
import { partitionDeviceIds } from "@/lib/deviceId";
import type { ClientType, Product } from "@/lib/types";
import { CLIENT_TYPE_LABELS, CLIENT_TYPES, CATALOG_PACKS, formatUsd, formatArs } from "@/lib/types";
import type { Currency } from "@/lib/types";
import { useBlueRate } from "@/store/dollarStore";
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
export function Inventario({ onQuickSale }: { onQuickSale?: (p: Product) => void }) {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const canWrite = can("inventory.write");
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  // El catálogo Apple es un add-on pago: solo los workspaces que lo
  // desbloquearon ven el picker visual; el resto carga manual o lo abona.
  const appleUnlocked = (activeWorkspace?.unlockedCatalogs ?? []).includes("apple");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("todos");
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // Re-hidrata el workspace tras desbloquear el catálogo (refleja el estado).
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

  // Migración a USD: si hay productos en pesos y el catálogo es en dólares,
  // los marca como US$ de una (los valores no cambian, solo la moneda).
  const arsCount = products.filter((p) => p.currency === "ARS").length;
  async function markCatalogUsd() {
    setMigrating(true);
    try {
      const ars = products.filter((p) => p.currency === "ARS");
      for (const p of ars) await api.updateProduct(p.id, { currency: "USD" });
      showToast(`${ars.length} ${ars.length === 1 ? "producto pasado" : "productos pasados"} a US$`, "success");
      load();
    } catch {
      showToast("No se pudo convertir el catálogo", "error");
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader
        title="Inventario"
        subtitle={loading ? "Cargando…" : `${summary.total} producto${summary.total === 1 ? "" : "s"} en el catálogo`}
        actions={
          canWrite ? (
            <AddProductMenu
              appleUnlocked={appleUnlocked}
              onApple={() => setPickerOpen(true)}
              onUnlock={() => setUnlockOpen(true)}
              onManual={() => setAdding(true)}
              onBulk={() => setBulkOpen(true)}
            />
          ) : undefined
        }
      />

      {canWrite && arsCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: space[3],
            padding: space[3],
            background: color.primaryBg,
            border: `1px solid ${color.primary}`,
            borderRadius: radius.md,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: text.sm, color: color.text }}>
            Tenés <strong>{arsCount}</strong> {arsCount === 1 ? "producto en pesos" : "productos en pesos"}. Si tu catálogo está en dólares, marcalo como US$ para que las ventas sugieran al blue.
          </span>
          <Button variant="primary" size="sm" loading={migrating} onClick={markCatalogUsd}>
            Marcar catálogo en US$
          </Button>
        </div>
      )}

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
                ? "Elegí del catálogo, cargá uno a mano o importá todo en bloque."
                : "Probá cambiar la búsqueda o el filtro."
            }
            actionNode={
              products.length === 0 && canWrite ? (
                <AddProductMenu
                  appleUnlocked={appleUnlocked}
                  onApple={() => setPickerOpen(true)}
                  onUnlock={() => setUnlockOpen(true)}
                  onManual={() => setAdding(true)}
                  onBulk={() => setBulkOpen(true)}
                />
              ) : undefined
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
                {onQuickSale && (
                  <div style={{ marginTop: space[3] }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      iconLeft={<ShoppingCart size={14} />}
                      disabled={isOut(p)}
                      title={isOut(p) ? "Sin stock para vender" : "Vender este producto"}
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickSale(p);
                      }}
                    >
                      Vender
                    </Button>
                  </div>
                )}
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

      <BulkImportModal open={bulkOpen} onClose={() => setBulkOpen(false)} onImported={load} />

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
          {onQuickSale && (
            <>
              <ContextMenuItem
                icon={<ShoppingCart size={14} />}
                onClick={() => {
                  const p = ctxProduct;
                  ctxMenu.close();
                  onQuickSale(p);
                }}
              >
                Venta rápida
              </ContextMenuItem>
              <ContextMenuDivider />
            </>
          )}
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

/* ───────── Menú "Agregar producto": catálogo visual o carga manual ───────── */

function AddProductMenu({
  appleUnlocked,
  onApple,
  onUnlock,
  onManual,
  onBulk,
}: {
  appleUnlocked: boolean;
  onApple: () => void;
  onUnlock: () => void;
  onManual: () => void;
  onBulk: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const appleRow = (
    <MenuRow
      key="apple"
      icon={<LayoutGrid size={16} />}
      title="Catálogo Apple"
      subtitle={appleUnlocked ? "Elegí modelo, color y capacidad" : "Premium · desbloquear catálogo"}
      locked={!appleUnlocked}
      onClick={() => {
        setOpen(false);
        appleUnlocked ? onApple() : onUnlock();
      }}
    />
  );
  const manualRow = (
    <MenuRow
      key="manual"
      icon={<Pencil size={16} />}
      title="Carga manual"
      subtitle="Cargá cualquier producto a mano"
      onClick={() => {
        setOpen(false);
        onManual();
      }}
    />
  );
  const bulkRow = (
    <MenuRow
      key="bulk"
      icon={<ClipboardPaste size={16} />}
      title="Importar en bloque"
      subtitle="Pegá tu catálogo desde Excel"
      onClick={() => {
        setOpen(false);
        onBulk();
      }}
    />
  );

  return (
    <>
      <Button
        ref={triggerRef}
        variant="primary"
        iconLeft={<Plus size={16} />}
        iconRight={<ChevronDown size={14} />}
        onClick={() => setOpen((v) => !v)}
      >
        Agregar producto
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} triggerRef={triggerRef} width={272} align="end">
        {/* Multi-rubro: manual e importar son universales. El catálogo Apple
            es un add-on; si no está desbloqueado va último, como upsell. */}
        {appleUnlocked ? [appleRow, manualRow, bulkRow] : [manualRow, bulkRow, appleRow]}
      </Popover>
    </>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onClick,
  locked = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  locked?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = color.surface2)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: space[3],
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        background: "transparent",
        border: "none",
        borderRadius: radius.sm,
        cursor: "pointer",
      }}
    >
      <span style={{ display: "inline-flex", color: color.textMuted, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: text.sm, fontWeight: weight.medium, color: color.text }}>{title}</span>
        <span style={{ display: "block", fontSize: text.xs, color: color.textDim }}>{subtitle}</span>
      </span>
      {locked && <Lock size={13} style={{ color: color.textDim, flexShrink: 0 }} />}
    </button>
  );
}

/* ───────── Importar en bloque (pegar desde Excel / Sheets) ───────── */

type BulkRow = {
  name: string;
  price: number | null;
  cost: number | null;
  stock: number | null;
  sku: string;
  category: string;
  valid: boolean;
};

type BulkField = "name" | "price" | "cost" | "stock" | "sku" | "category";

// Encabezados reconocidos (es/en) → campo. Permite pegar con la primera fila
// como títulos y en cualquier orden de columnas.
const BULK_HEADERS: Record<string, BulkField> = {
  nombre: "name", name: "name", producto: "name", descripcion: "name", detalle: "name", articulo: "name",
  precio: "price", price: "price", pvp: "price", venta: "price",
  costo: "cost", cost: "cost", compra: "cost",
  stock: "stock", cantidad: "stock", unidades: "stock", qty: "stock", cant: "stock",
  sku: "sku", codigo: "sku", code: "sku",
  categoria: "category", category: "category", rubro: "category", tipo: "category",
};

// Sin encabezado, asumimos este orden de columnas.
const BULK_ORDER: BulkField[] = ["name", "price", "cost", "stock", "sku", "category"];

function bulkNorm(s: string): string {
  // sin acentos para matchear encabezados (categoría, código, descripción…)
  return s
    .trim()
    .toLowerCase()
    .replace(/[áàä]/g, "a")
    .replace(/[éèë]/g, "e")
    .replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o")
    .replace(/[úùü]/g, "u");
}

// Parsea números tolerando símbolos y formato es-AR ("$ 1.500,50" → 1500.5).
function bulkNum(s: string): number | null {
  const t = s.replace(/[^0-9.,-]/g, "");
  if (!t) return null;
  let norm = t;
  if (t.includes(",") && t.includes(".")) norm = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) norm = t.replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

function parseBulk(raw: string): BulkRow[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Excel/Sheets pegan con TAB; si no hay tabs, probamos punto y coma o coma.
  const delim = lines.some((l) => l.includes("\t")) ? "\t" : lines.some((l) => l.includes(";")) ? ";" : ",";
  const grid = lines.map((l) => l.split(delim).map((c) => c.trim()));

  // ¿La primera fila es encabezado? Si alguna celda matchea "nombre" o "precio".
  const first = grid[0];
  const mapped = first.map((c) => BULK_HEADERS[bulkNorm(c)] ?? null);
  const hasHeader = mapped.includes("name") || mapped.includes("price");
  const colMap: Array<BulkField | null> = hasHeader ? mapped : BULK_ORDER.slice(0, Math.max(first.length, 1));
  const dataRows = hasHeader ? grid.slice(1) : grid;

  const idx = (f: BulkField) => colMap.indexOf(f);
  return dataRows.map((cells) => {
    const cell = (f: BulkField) => {
      const i = idx(f);
      return i >= 0 && i < cells.length ? cells[i] : "";
    };
    const name = cell("name").trim();
    return {
      name,
      price: bulkNum(cell("price")),
      cost: bulkNum(cell("cost")),
      stock: bulkNum(cell("stock")),
      sku: cell("sku").trim(),
      category: cell("category").trim(),
      valid: name.length > 0,
    };
  });
}

function BulkImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { showToast } = useUIStore();
  const [raw, setRaw] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) {
      setRaw("");
      setImporting(false);
    }
  }, [open]);

  const parsed = useMemo(() => parseBulk(raw), [raw]);
  const valid = useMemo(() => parsed.filter((r) => r.valid), [parsed]);
  const ignored = parsed.length - valid.length;

  async function run() {
    if (valid.length === 0) return;
    setImporting(true);
    try {
      const res = await api.bulkImportProducts(
        valid.map((r) => ({
          name: r.name,
          price: r.price ?? 0,
          cost: r.cost,
          // Con stock en la fila → llevamos control; sin stock → producto sin tracking.
          trackStock: r.stock != null,
          stock: r.stock ?? 0,
          sku: r.sku || null,
          category: r.category || null,
        })),
      );
      showToast(
        res.skipped > 0
          ? `${res.imported} importados · ${res.skipped} ya existían`
          : `${res.imported} ${res.imported === 1 ? "producto importado" : "productos importados"}`,
        "success",
      );
      onImported();
      onClose();
    } catch {
      showToast("No se pudo importar. Revisá el formato.", "error");
    } finally {
      setImporting(false);
    }
  }

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "6px 8px",
    fontWeight: weight.semibold,
    color: color.textMuted,
    position: "sticky",
    top: 0,
    background: color.surface2,
    borderBottom: `1px solid ${color.border}`,
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "5px 8px",
    borderBottom: `1px solid ${color.border}`,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: 160,
    color: color.textMuted,
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      isDirty={() => raw.trim().length > 0}
      confirmCloseText="¿Cerrar y descartar lo pegado?"
      title="Importar en bloque"
      subtitle="Pegá tu catálogo desde Excel o Google Sheets — una fila por producto."
      maxWidth={760}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={run} disabled={valid.length === 0} loading={importing}>
            {valid.length > 0 ? `Importar ${valid.length} ${valid.length === 1 ? "producto" : "productos"}` : "Importar"}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: text.xs, color: color.textDim, marginBottom: space[2], lineHeight: 1.5 }}>
        Columnas:{" "}
        <strong style={{ color: color.textMuted }}>Nombre, Precio, Costo, Stock, SKU, Categoría</strong>. Si la primera
        fila tiene encabezados los detectamos solos. Solo el nombre es obligatorio.
      </div>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={"iPhone 13 128GB\t650000\t520000\t3\niPhone 14 Pro\t1100000\t900000\t1\nFunda silicona\t12000\t6000\t20"}
        rows={6}
        autoFocus
        style={{
          width: "100%",
          resize: "vertical",
          minHeight: 120,
          background: color.surface2,
          border: `1px solid ${color.border}`,
          borderRadius: radius.md,
          padding: "8px 10px",
          color: color.text,
          fontSize: text.sm,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          lineHeight: 1.5,
        }}
      />

      {parsed.length > 0 && (
        <div style={{ marginTop: space[3] }}>
          <div style={{ fontSize: text.xs, color: color.textMuted, marginBottom: 6 }}>
            {valid.length} {valid.length === 1 ? "producto listo" : "productos listos"}
            {ignored > 0
              ? ` · ${ignored} fila${ignored === 1 ? "" : "s"} sin nombre se ignora${ignored === 1 ? "" : "n"}`
              : ""}
          </div>
          <div style={{ maxHeight: 240, overflow: "auto", border: `1px solid ${color.border}`, borderRadius: radius.md }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: text.xs }}>
              <thead>
                <tr>
                  <th style={th}>Nombre</th>
                  <th style={th}>Precio</th>
                  <th style={th}>Costo</th>
                  <th style={th}>Stock</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Categoría</th>
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 100).map((r, i) => (
                  <tr key={i} style={{ opacity: r.valid ? 1 : 0.45 }}>
                    <td style={{ ...td, color: color.text }}>
                      {r.name || <span style={{ color: color.danger }}>— sin nombre —</span>}
                    </td>
                    <td style={td}>{r.price != null ? formatMoney(r.price, "USD") : "—"}</td>
                    <td style={td}>{r.cost != null ? formatMoney(r.cost, "USD") : "—"}</td>
                    <td style={td}>{r.stock != null ? r.stock : "—"}</td>
                    <td style={td}>{r.sku || "—"}</td>
                    <td style={td}>{r.category || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.length > 100 && (
            <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 4 }}>
              …y {parsed.length - 100} fila{parsed.length - 100 === 1 ? "" : "s"} más (se importan todas)
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ───────── Desbloqueo de catálogo Apple (add-on pago) ───────── */

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
          <span style={{ fontSize: text.xs, color: color.textDim }}>pago único{ars ? ` · ${ars}` : ""}</span>
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
  const [currency, setCurrency] = useState<Currency>("USD");
  const blue = useBlueRate();
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
    setCurrency(product?.currency ?? "USD");
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
    const { invalid } = partitionDeviceIds(list);
    if (invalid.length > 0) {
      showToast(`IMEI/Serie inválido: ${invalid.slice(0, 3).join(", ")}${invalid.length > 3 ? "…" : ""}. El IMEI debe tener 15 dígitos; si no tiene, usá un N° de serie.`, "error");
      return;
    }
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
      currency,
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
      {/* Moneda del producto: USD (base, default para reventa) o ARS. */}
      <ModalField label="Moneda">
        <div style={{ display: "flex", gap: space[2] }}>
          {(["USD", "ARS"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: radius.md,
                fontSize: text.sm,
                fontWeight: weight.medium,
                cursor: "pointer",
                border: `1px solid ${currency === c ? color.primary : color.border}`,
                background: currency === c ? color.primaryBg : color.surface2,
                color: currency === c ? color.primary : color.text,
              }}
            >
              {c === "USD" ? "US$ Dólares" : "$ Pesos"}
            </button>
          ))}
        </div>
      </ModalField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space[3] }}>
        <ModalField
          label={`Precio (${currency === "USD" ? "US$" : "$"})`}
          hint={currency === "USD" && blue && Number(price) > 0 ? `≈ ${formatArs(Number(price) * blue)} al blue` : undefined}
        >
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        </ModalField>
        <ModalField label={`Costo (${currency === "USD" ? "US$" : "$"})`} hint="Opcional">
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
          Precios por tipo de cliente <span style={{ color: color.textDim, fontWeight: 400 }}>· en {currency === "USD" ? "US$" : "$"} · opcional</span>
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
