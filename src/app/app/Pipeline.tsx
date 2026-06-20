"use client";

import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Plus,
  Search,
  Flame,
  Phone,
  DollarSign,
  Eye,
  ArrowRight,
  Trophy,
  XCircle,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Tabs } from "@/components/Tabs";
import { MetricCard } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuDivider,
  ContextMenuLabel,
  useContextMenu,
} from "@/components/ContextMenu";
import { confirmAsync } from "@/lib/confirmAsync";
import { useUndoableActions } from "@/store/useUndoableActions";
import { openWhatsApp, openTel } from "@/lib/openExternal";
import { useUIStore } from "@/store/uiStore";
import { usePermissions } from "@/store/usePermissions";
import { useIsMobile } from "@/lib/useIsMobile";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import * as api from "@/lib/api";
import type { PipelineItem, PipelineStage, LeadPriority, Customer } from "@/lib/types";

/* ───────── prioridad → estilo del pill (tokens, nada hardcodeado) ───────── */
const PRIORITY_STYLE: Record<LeadPriority, { bg: string; fg: string }> = {
  hot: { bg: color.dangerBg, fg: color.danger },
  high: { bg: color.warningBg, fg: color.warning },
  medium: { bg: color.infoBg, fg: color.info },
  low: { bg: color.surface, fg: color.textDim },
};

/** Label del pill SIN emoji — el "caliente" ya se indica con el ícono Flame
 *  y la barra/borde primary, así no duplicamos el 🔥. */
const PILL_LABEL: Record<LeadPriority, string> = {
  hot: "Caliente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const PRIORITY_FILTERS: { value: string; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "hot", label: "Caliente" },
  { value: "high", label: "Alta" },
];

/** Convierte un hex de etapa (#RGB o #RRGGBB) en rgba con alpha para tintes
 *  suaves. Si el hex es inválido, cae a un wash translúcido neutro (nunca a un
 *  color sólido que taparía las cards). */
function tint(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const COL_WIDTH = 290;

/**
 * Vista Pipeline — re-portada desde la desktop (kanban dnd-kit). Columnas por
 * etapa con acento de color + cards tipo LeadCard. Drag de una card a otra
 * columna → moveItem. Click → modal de oportunidad (de Crm, vía callbacks).
 * Acciones por card (footer + menú contextual): convertir en venta, WhatsApp,
 * llamar, mover de etapa, marcar ganada/perdida, eliminar. Filtro por
 * prioridad. Self-fetch de stages + items + customers (para teléfonos);
 * recarga al escuchar `clozr:item-changed`.
 * DIFERIDO de la desktop: reorder/resize de columnas, sort dentro de columna,
 * filtros avanzados, acciones masivas, agendar visita, snooze, notas inline,
 * plantillas de WhatsApp.
 */
export function Pipeline({
  onOpenItem,
  onAddItem,
  onConvertItem,
}: {
  onOpenItem: (id: string) => void;
  onAddItem: (stageId: string) => void;
  onConvertItem: (item: PipelineItem) => void;
}) {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const isMobile = useIsMobile();
  const canWrite = can("pipeline.write");
  // En móvil: columnas ~85vw con scroll-snap (se desliza una etapa a la vez).
  const colWidth = isMobile ? "min(85vw, 320px)" : `${COL_WIDTH}px`;
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("todas");
  const [activeId, setActiveId] = useState<string | null>(null);
  const ctxMenu = useContextMenu();
  const [ctxItem, setCtxItem] = useState<PipelineItem | null>(null);

  // Refetch SIN tocar `loading` — así cada acción (drag/menú) que dispara
  // clozr:item-changed reconcilia con el server sin parpadear todo el board.
  const refresh = useCallback(async () => {
    try {
      let st = await api.listStages();
      if (st.length === 0) {
        await api.seedDefaultStages();
        st = await api.listStages();
      }
      const [it, cs] = await Promise.all([api.listItems(), api.listCustomers()]);
      setStages([...st].sort((a, b) => a.order - b.order));
      setItems(it);
      setCustomers(cs);
    } catch {
      showToast("No se pudo cargar el pipeline", "error");
    }
  }, [showToast]);

  useEffect(() => {
    // `loading` solo para la carga inicial; los refetch por evento son silenciosos.
    setLoading(true);
    refresh().finally(() => setLoading(false));
    const onChanged = () => refresh();
    window.addEventListener("clozr:item-changed", onChanged);
    return () => window.removeEventListener("clozr:item-changed", onChanged);
  }, [refresh]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const customersById = useMemo(
    () => new Map(customers.map((c) => [c.id, c])),
    [customers],
  );
  const phoneOf = useCallback(
    (item: PipelineItem) => customersById.get(item.customerId)?.phone || undefined,
    [customersById],
  );

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (priorityFilter !== "todas" && i.priority !== priorityFilter) return false;
        if (!query) return true;
        return (
          i.customerName.toLowerCase().includes(query) ||
          (i.product ?? "").toLowerCase().includes(query)
        );
      }),
    [items, query, priorityFilter],
  );

  /* ── métricas (sobre TODOS los items, no el filtro) ── */
  const metrics = useMemo(() => {
    const wonIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));
    const lostIds = new Set(stages.filter((s) => s.isLost).map((s) => s.id));
    const open = items.filter((i) => !wonIds.has(i.stageId) && !lostIds.has(i.stageId));
    const won = items.filter((i) => wonIds.has(i.stageId)).length;
    const lost = items.filter((i) => lostIds.has(i.stageId)).length;
    const pipelineArs = open
      .filter((i) => i.currency === "ARS")
      .reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const closed = won + lost;
    const conv = closed ? Math.round((won / closed) * 100) : 0;
    return { open: open.length, won, pipelineArs, conv };
  }, [items, stages]);

  const wonStage = useMemo(() => stages.find((s) => s.isWon), [stages]);
  const lostStage = useMemo(() => stages.find((s) => s.isLost), [stages]);
  const isTerminal = useCallback(
    (item: PipelineItem) => {
      const s = stages.find((x) => x.id === item.stageId);
      return !!s && (s.isWon || s.isLost);
    },
    [stages],
  );

  const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null;

  /* ── helper compartido: mover (drag + menú contextual) ── */
  const moveItemTo = useCallback(
    async (item: PipelineItem, stage: PipelineStage) => {
      if (item.stageId === stage.id) return;
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, stageId: stage.id, stageName: stage.name, stageOrder: stage.order }
            : i,
        ),
      );
      try {
        await api.moveItem(item.id, stage);
        showToast(`Movido a ${stage.name}`, "success");
        window.dispatchEvent(new Event("clozr:item-changed"));
      } catch {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...item } : i)));
        showToast("No se pudo mover", "error");
      }
    },
    [showToast],
  );

  function deleteItemLocal(item: PipelineItem) {
    setItems((p) => p.filter((i) => i.id !== item.id)); // optimista
    useUndoableActions.getState().register({
      label: "Oportunidad eliminada",
      sublabel: item.customerName,
      onUndo: () => setItems((p) => (p.some((i) => i.id === item.id) ? p : [...p, item])),
      commit: async () => {
        // finally: dispatch siempre → si el delete falla, el refetch reconcilia.
        try {
          await api.deleteItem(item.id);
        } finally {
          window.dispatchEvent(new Event("clozr:item-changed"));
        }
      },
    });
  }

  async function markLost(item: PipelineItem) {
    if (!lostStage) return;
    const ok = await confirmAsync({
      title: "Marcar como perdida",
      message: `¿Marcar la oportunidad de ${item.customerName} como perdida?`,
      confirmText: "Marcar perdida",
      tone: "danger",
    });
    if (!ok) return;
    moveItemTo(item, lostStage);
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const item = items.find((i) => i.id === String(active.id));
    const stage = stages.find((s) => s.id === String(over.id));
    if (!item || !stage || item.stageId === stage.id) return;
    // Soltar en "Perdido" confirma, igual que el menú contextual (es destructivo).
    if (stage.isLost) {
      await markLost(item);
      return;
    }
    await moveItemTo(item, stage);
  }

  const totalCount = items.length;

  const moveOptions = ctxItem
    ? stages.filter((s) => !s.isWon && !s.isLost && s.id !== ctxItem.stageId)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader
        title="Pipeline"
        subtitle={
          loading
            ? "Cargando…"
            : `${totalCount} ${totalCount === 1 ? "oportunidad" : "oportunidades"} · ${isMobile ? "deslizá entre etapas" : "arrastrá las tarjetas entre etapas"}`
        }
        actions={
          canWrite ? (
            <Button
              variant="primary"
              size="md"
              iconLeft={<Plus size={16} />}
              onClick={() => onAddItem(stages[0]?.id ?? "")}
            >
              Nueva oportunidad
            </Button>
          ) : undefined
        }
      />

      <div className="cz-metric-grid">
        <MetricCard label="Oportunidades abiertas" value={String(metrics.open)} />
        <MetricCard label="Pipeline (ARS)" value={formatMoney(metrics.pipelineArs)} />
        <MetricCard label="Ganados" value={String(metrics.won)} tone="success" />
        <MetricCard label="Conversión" value={`${metrics.conv}%`} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: space[3], flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240, maxWidth: 380 }}>
          <Input
            placeholder="Buscar por cliente o producto…"
            iconLeft={<Search size={15} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs
          variant="pills"
          size="sm"
          value={priorityFilter}
          onChange={setPriorityFilter}
          items={PRIORITY_FILTERS}
        />
      </div>

      {loading ? (
        <div style={{ color: color.textDim }}>Cargando pipeline…</div>
      ) : stages.length === 0 ? (
        <EmptyState title="Sin etapas" description="No se pudieron cargar las etapas del pipeline." />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div
            className={isMobile ? "cz-noscrollbar" : undefined}
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              alignItems: "stretch",
              gap: space[3],
              overflowX: "auto",
              paddingBottom: space[3],
              scrollSnapType: isMobile ? "x mandatory" : undefined,
            }}
          >
            {stages.map((stage) => {
              const colItems = filtered.filter((i) => i.stageId === stage.id);
              const ars = colItems
                .filter((i) => i.currency === "ARS")
                .reduce((a, i) => a + (Number(i.amount) || 0), 0);
              return (
                <Column
                  key={stage.id}
                  stage={stage}
                  count={colItems.length}
                  totalAmount={ars}
                  onAdd={canWrite ? () => onAddItem(stage.id) : undefined}
                  width={colWidth}
                  snap={isMobile}
                >
                  {colItems.length === 0 ? (
                    <ColumnEmpty
                      isTerminal={stage.isWon || stage.isLost}
                      onAdd={canWrite ? () => onAddItem(stage.id) : undefined}
                    />
                  ) : (
                    colItems.map((item) => (
                      <DraggableCard
                        key={item.id}
                        item={item}
                        dimmed={activeId === item.id}
                        phone={phoneOf(item)}
                        canConvert={canWrite && !(stage.isWon || stage.isLost)}
                        canDrag={canWrite}
                        onClick={() => onOpenItem(item.id)}
                        onConvert={() => onConvertItem(item)}
                        onContextMenu={(e) => {
                          setCtxItem(item);
                          ctxMenu.openAt(e);
                        }}
                      />
                    ))
                  )}
                </Column>
              );
            })}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeItem ? <LeadCardView item={activeItem} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {ctxMenu.open && ctxItem && (
        <ContextMenu position={ctxMenu.position} onClose={ctxMenu.close}>
          <ContextMenuLabel>
            {ctxItem.customerName}
            {ctxItem.amount != null ? ` · ${formatMoney(ctxItem.amount, ctxItem.currency)}` : ""}
          </ContextMenuLabel>
          <ContextMenuItem
            icon={<Eye size={14} />}
            onClick={() => {
              const it = ctxItem;
              ctxMenu.close();
              onOpenItem(it.id);
            }}
          >
            Abrir
          </ContextMenuItem>
          {canWrite && !isTerminal(ctxItem) && (
            <ContextMenuItem
              icon={<DollarSign size={14} />}
              onClick={() => {
                const it = ctxItem;
                ctxMenu.close();
                onConvertItem(it);
              }}
            >
              Convertir en venta
            </ContextMenuItem>
          )}
          {phoneOf(ctxItem) && (
            <>
              <ContextMenuItem
                icon={<WhatsAppIcon size={14} />}
                onClick={() => {
                  const p = phoneOf(ctxItem);
                  ctxMenu.close();
                  if (p) openWhatsApp(p);
                }}
              >
                WhatsApp
              </ContextMenuItem>
              <ContextMenuItem
                icon={<Phone size={14} />}
                onClick={() => {
                  const p = phoneOf(ctxItem);
                  ctxMenu.close();
                  if (p) openTel(p);
                }}
              >
                Llamar
              </ContextMenuItem>
            </>
          )}
          {canWrite && <>
          <ContextMenuDivider />
          {moveOptions.length > 0 && (
            <ContextMenuSub label="Mover a etapa" icon={<ArrowRight size={14} />}>
              {moveOptions.map((s) => (
                <ContextMenuItem
                  key={s.id}
                  onClick={() => {
                    const it = ctxItem;
                    ctxMenu.close();
                    moveItemTo(it, s);
                  }}
                >
                  {s.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSub>
          )}
          {wonStage && ctxItem.stageId !== wonStage.id && (
            <ContextMenuItem
              icon={<Trophy size={14} />}
              onClick={() => {
                const it = ctxItem;
                ctxMenu.close();
                moveItemTo(it, wonStage);
              }}
            >
              Marcar como ganada
            </ContextMenuItem>
          )}
          {lostStage && ctxItem.stageId !== lostStage.id && (
            <ContextMenuItem
              icon={<XCircle size={14} />}
              onClick={() => {
                const it = ctxItem;
                ctxMenu.close();
                markLost(it);
              }}
            >
              Marcar como perdida
            </ContextMenuItem>
          )}
          <ContextMenuDivider />
          <ContextMenuItem
            tone="danger"
            icon={<Trash2 size={14} />}
            onClick={() => {
              const it = ctxItem;
              ctxMenu.close();
              deleteItemLocal(it);
            }}
          >
            Eliminar
          </ContextMenuItem>
          </>}
        </ContextMenu>
      )}
    </div>
  );
}

/* ============================================================
 *  Columna (droppable) — header con acento de etapa + body
 * ============================================================ */
function Column({
  stage,
  count,
  totalAmount,
  onAdd,
  children,
  width = `${COL_WIDTH}px`,
  snap = false,
}: {
  stage: PipelineStage;
  count: number;
  totalAmount: number;
  onAdd?: () => void;
  children: React.ReactNode;
  width?: string;
  snap?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const isTerminal = stage.isWon || stage.isLost;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: isOver ? tint(stage.color, 0.08) : color.surface2,
        borderTop: `3px solid ${stage.color}`,
        borderRight: `1px solid ${isOver ? stage.color : color.border}`,
        borderBottom: `1px solid ${isOver ? stage.color : color.border}`,
        borderLeft: `1px solid ${isOver ? stage.color : color.border}`,
        borderRadius: radius.lg,
        width,
        minWidth: width,
        flex: `0 0 ${width}`,
        scrollSnapAlign: snap ? "start" : undefined,
        height: "100%",
        overflow: "hidden",
        transition: "border-color 160ms, background 160ms",
      }}
    >
      <header
        style={{
          padding: `10px ${space[3]}`,
          borderBottom: `1px solid ${color.border}`,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: space[2],
        }}
      >
        <span
          style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color, flexShrink: 0 }}
        />
        <h3
          style={{
            margin: 0,
            fontSize: text.sm,
            fontWeight: weight.semibold,
            color: color.text,
            letterSpacing: "-0.1px",
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {stage.name}
        </h3>
        {totalAmount > 0 && (
          <span
            style={{
              fontSize: text.xs,
              color: color.textDim,
              fontVariantNumeric: "tabular-nums",
              fontWeight: weight.medium,
              whiteSpace: "nowrap",
            }}
          >
            · {formatMoney(totalAmount)}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: text.xs,
            fontWeight: weight.bold,
            padding: "2px 7px",
            borderRadius: radius.full,
            background: color.surface,
            color: color.textMuted,
            minWidth: 22,
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          {count}
        </span>
        {!isTerminal && onAdd && (
          <button
            onClick={onAdd}
            aria-label={`Agregar oportunidad a ${stage.name}`}
            className="btn-icon muted"
            style={{
              width: 22,
              height: 22,
              borderRadius: radius.sm,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Plus size={14} strokeWidth={2.4} />
          </button>
        )}
      </header>

      <div
        ref={setNodeRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: space[3],
          display: "flex",
          flexDirection: "column",
          gap: space[2],
          minHeight: 100,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ColumnEmpty({ isTerminal, onAdd }: { isTerminal: boolean; onAdd?: () => void }) {
  if (isTerminal || !onAdd) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: space[3],
          textAlign: "center",
          color: color.textDim,
          fontSize: text.xs,
          opacity: 0.5,
          minHeight: 60,
        }}
      >
        —
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      style={{
        marginTop: 4,
        padding: `${space[3]} ${space[2]}`,
        border: `1px dashed ${color.border}`,
        borderRadius: radius.md,
        background: "transparent",
        color: color.textDim,
        fontSize: text.xs,
        fontWeight: weight.medium,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: space[1],
        minHeight: 80,
        transition: "all 120ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color.borderStrong;
        e.currentTarget.style.color = color.textMuted;
        e.currentTarget.style.background = color.surfaceHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = color.border;
        e.currentTarget.style.color = color.textDim;
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Plus size={14} strokeWidth={2.2} />
      Agregar oportunidad
    </button>
  );
}

/* ============================================================
 *  Card draggable + vista presentacional (reusada en overlay)
 * ============================================================ */
function DraggableCard({
  item,
  dimmed,
  phone,
  canConvert,
  canDrag,
  onClick,
  onConvert,
  onContextMenu,
}: {
  item: PipelineItem;
  dimmed: boolean;
  phone?: string;
  canConvert: boolean;
  canDrag: boolean;
  onClick: () => void;
  onConvert: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: item.id, disabled: !canDrag });
  return (
    <LeadCardView
      ref={setNodeRef}
      item={item}
      dimmed={dimmed || isDragging}
      phone={phone}
      canConvert={canConvert}
      onClick={onClick}
      onConvert={onConvert}
      onContextMenu={onContextMenu}
      dragHandleProps={canDrag ? { ...listeners, ...attributes } : undefined}
    />
  );
}

const stopPD = (e: React.PointerEvent) => e.stopPropagation();
const cardActionBtnStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: radius.sm,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

interface LeadCardViewProps {
  item: PipelineItem;
  dimmed?: boolean;
  overlay?: boolean;
  phone?: string;
  canConvert?: boolean;
  onClick?: () => void;
  onConvert?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  dragHandleProps?: Record<string, unknown>;
}

const LeadCardView = forwardRef<HTMLDivElement, LeadCardViewProps>(function LeadCardView(
  { item, dimmed, overlay, phone, canConvert, onClick, onConvert, onContextMenu, dragHandleProps },
  ref,
) {
  const isHot = item.priority === "hot";
  const pill = PRIORITY_STYLE[item.priority];
  return (
    <div
      ref={ref}
      onClick={() => {
        if (!overlay) onClick?.();
      }}
      onContextMenu={overlay ? undefined : onContextMenu}
      style={{
        background: color.surface,
        border: `1px solid ${isHot ? color.primary : color.border}`,
        borderRadius: radius.md,
        padding: space[3],
        display: "flex",
        flexDirection: "column",
        gap: space[2],
        cursor: overlay ? "grabbing" : "grab",
        position: "relative",
        width: overlay ? COL_WIDTH - 24 : undefined,
        transition: "border-color 100ms, box-shadow 100ms, background 100ms",
        boxShadow: overlay ? "0 12px 32px rgba(0, 0, 0, 0.5)" : "none",
        opacity: dimmed ? 0.4 : 1,
        userSelect: "none",
      }}
      {...dragHandleProps}
    >
      {isHot && (
        <div
          style={{
            position: "absolute",
            left: -1,
            top: 8,
            bottom: 8,
            width: 3,
            background: color.primary,
            borderRadius: radius.full,
          }}
        />
      )}

      {/* Línea 1: Cliente + producto */}
      <div style={{ display: "flex", alignItems: "center", gap: space[2], minWidth: 0 }}>
        <Avatar name={item.customerName} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: text.sm,
              fontWeight: weight.semibold,
              color: color.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.3,
            }}
          >
            {item.customerName}
          </div>
          <div
            style={{
              fontSize: text.xs,
              color: item.product ? color.textMuted : color.textDim,
              fontStyle: item.product ? "normal" : "italic",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: 1,
            }}
          >
            {item.product || "Sin producto definido"}
          </div>
        </div>
        {isHot && <Flame size={14} color={color.primary} strokeWidth={2.4} />}
      </div>

      {/* Línea 2: Monto */}
      {item.amount != null && (
        <div
          style={{
            fontSize: text.lg,
            fontWeight: weight.bold,
            color: color.text,
            letterSpacing: "-0.3px",
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatMoney(item.amount, item.currency)}
        </div>
      )}

      {/* Footer: acciones rápidas + prioridad */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[2] }}>
        <div style={{ display: "flex", gap: 2 }}>
          {!overlay && canConvert && (
            <button
              type="button"
              aria-label="Convertir en venta"
              title="Convertir en venta"
              className="btn-icon primary"
              style={cardActionBtnStyle}
              onPointerDown={stopPD}
              onClick={(e) => {
                e.stopPropagation();
                onConvert?.();
              }}
            >
              <DollarSign size={13} strokeWidth={2.4} />
            </button>
          )}
          {!overlay && phone && (
            <button
              type="button"
              aria-label="WhatsApp"
              title="WhatsApp"
              className="btn-icon wa"
              style={cardActionBtnStyle}
              onPointerDown={stopPD}
              onClick={(e) => {
                e.stopPropagation();
                openWhatsApp(phone);
              }}
            >
              <WhatsAppIcon size={13} />
            </button>
          )}
          {!overlay && phone && (
            <button
              type="button"
              aria-label="Llamar"
              title="Llamar"
              className="btn-icon muted"
              style={cardActionBtnStyle}
              onPointerDown={stopPD}
              onClick={(e) => {
                e.stopPropagation();
                openTel(phone);
              }}
            >
              <Phone size={13} strokeWidth={2.2} />
            </button>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: weight.bold,
            textTransform: "uppercase",
            letterSpacing: "0.3px",
            padding: "2px 7px",
            borderRadius: radius.full,
            background: pill.bg,
            color: pill.fg,
            flexShrink: 0,
          }}
        >
          {PILL_LABEL[item.priority]}
        </span>
      </div>
    </div>
  );
});
