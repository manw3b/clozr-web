import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Search, ArrowRight, Users, ShoppingCart, GitBranch, Package, CornerDownLeft } from "lucide-react";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import * as api from "@/lib/api";
import { ClozrAiIcon } from "@/components/ClozrAiIcon";
import { useAiStore } from "@/store/aiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { hasAiPlan } from "@/lib/types";
import type { Customer, PipelineItem, Product, Sale } from "@/lib/types";

interface Entry {
  id: string;
  label: string;
  sub: string;
  icon: ReactNode;
  run: () => void;
}

const NAV: { label: string; view: string }[] = [
  { label: "Mi Día", view: "home" },
  { label: "Pipeline", view: "pipeline" },
  { label: "Clientes", view: "customers" },
  { label: "Ventas", view: "sales" },
  { label: "Agenda", view: "agenda" },
  { label: "Caja", view: "cash" },
  { label: "Deudas", view: "deudas" },
  { label: "Inventario", view: "inventory" },
  { label: "Tareas", view: "tasks" },
  { label: "Reportes", view: "reportes" },
  { label: "Equipo", view: "team" },
  { label: "Ajustes", view: "settings" },
];

function match(q: string, ...fields: (string | null | undefined)[]): boolean {
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

/**
 * Command palette (⌘K / Ctrl+K) — port web del CommandPalette de la desktop.
 * Busca clientes, ventas, productos y oportunidades + comandos de navegación.
 * Datos vía api.ts (se traen al abrir). Teclado: ↑↓ navega, Enter activa,
 * Esc cierra.
 */
export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onOpenCustomer,
  onOpenSale,
  onOpenItem,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onOpenCustomer: (id: string) => void;
  onOpenSale: (id: string) => void;
  onOpenItem: (id: string) => void;
}) {
  const openAi = useAiStore((s) => s.openAi);
  const ws = useWorkspaceStore((s) => s.activeWorkspace);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [data, setData] = useState<{
    customers: Customer[];
    sales: Sale[];
    items: PipelineItem[];
    products: Product[];
  }>({ customers: [], sales: [], items: [], products: [] });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSel(0);
    requestAnimationFrame(() => inputRef.current?.focus());
    Promise.all([api.listCustomers(), api.listSales(), api.listItems(), api.listCatalog()])
      .then(([customers, sales, items, products]) => setData({ customers, sales, items, products }))
      .catch(() => {});
  }, [open]);

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Entry[] = [];
    for (const n of NAV) {
      if (!q || n.label.toLowerCase().includes(q)) {
        out.push({
          id: `nav-${n.view}`,
          label: `Ir a ${n.label}`,
          sub: "Navegar",
          icon: <ArrowRight size={15} />,
          run: () => onNavigate(n.view),
        });
      }
    }
    if (q) {
      const cap = 6;
      data.customers
        .filter((c) => match(q, c.name, c.phone, c.email))
        .slice(0, cap)
        .forEach((c) =>
          out.push({ id: `cust-${c.id}`, label: c.name, sub: "Cliente", icon: <Users size={15} />, run: () => onOpenCustomer(c.id) }),
        );
      data.sales
        .filter((s) => match(q, s.customerName, String(s.total)))
        .slice(0, cap)
        .forEach((s) =>
          out.push({
            id: `sale-${s.id}`,
            label: `${s.customerName || "Sin cliente"} · ${formatMoney(s.total)}`,
            sub: "Venta",
            icon: <ShoppingCart size={15} />,
            run: () => onOpenSale(s.id),
          }),
        );
      data.items
        .filter((it) => match(q, it.customerName, it.product))
        .slice(0, cap)
        .forEach((it) =>
          out.push({
            id: `lead-${it.id}`,
            label: `${it.customerName} · ${it.product || it.stageName}`,
            sub: "Oportunidad",
            icon: <GitBranch size={15} />,
            run: () => onOpenItem(it.id),
          }),
        );
      data.products
        .filter((p) => match(q, p.name, p.category, p.sku))
        .slice(0, cap)
        .forEach((p) =>
          out.push({ id: `prod-${p.id}`, label: p.name, sub: "Producto", icon: <Package size={15} />, run: () => onNavigate("inventory") }),
        );
      // Lenguaje natural → IA de Clozr (solo con plan pago activo).
      if (hasAiPlan(ws)) {
        out.push({
          id: "ai-ask",
          label: `Preguntá a la IA: "${query.trim()}"`,
          sub: "IA de Clozr",
          icon: <ClozrAiIcon size={15} style={{ color: color.primary }} />,
          run: () => {
            onClose();
            openAi(query.trim());
          },
        });
      }
    }
    return out;
  }, [query, data, ws, onNavigate, onOpenCustomer, onOpenSale, onOpenItem, onClose, openAi]);

  useEffect(() => {
    setSel(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => Math.min(entries.length - 1, s + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => Math.max(0, s - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const en = entries[sel];
        if (en) {
          en.run();
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, entries, sel, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          background: color.surface,
          border: `1px solid ${color.borderStrong}`,
          borderRadius: radius.lg,
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: space[3], padding: `${space[3]} ${space[4]}`, borderBottom: `1px solid ${color.border}` }}>
          <Search size={18} color={color.textDim} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá algo o preguntale a la IA…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: color.text, fontSize: text.md }}
          />
          <kbd style={{ fontSize: text.xs, color: color.textMuted, padding: "2px 6px", background: color.bg, border: `1px solid ${color.border}`, borderRadius: radius.sm, fontFamily: "inherit" }}>
            Esc
          </kbd>
        </div>
        <div style={{ overflowY: "auto", padding: space[2] }}>
          {entries.length === 0 ? (
            <div style={{ padding: space[6], textAlign: "center", fontSize: text.sm, color: color.textMuted }}>
              {query ? "Sin resultados" : "Escribí para buscar…"}
            </div>
          ) : (
            entries.map((en, i) => (
              <button
                key={en.id}
                onClick={() => {
                  en.run();
                  onClose();
                }}
                onMouseEnter={() => setSel(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: space[3],
                  width: "100%",
                  padding: `${space[2]} ${space[3]}`,
                  borderRadius: radius.md,
                  background: i === sel ? color.surfaceHover : "transparent",
                  color: color.text,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span style={{ color: color.textMuted, display: "inline-flex", flexShrink: 0 }}>{en.icon}</span>
                <span style={{ flex: 1, fontSize: text.sm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {en.label}
                </span>
                <span style={{ fontSize: text.xs, color: color.textDim, fontWeight: weight.medium, flexShrink: 0 }}>{en.sub}</span>
                {i === sel && <CornerDownLeft size={13} color={color.textDim} style={{ flexShrink: 0 }} />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
