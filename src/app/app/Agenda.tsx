import { useEffect, useMemo, useState, useCallback, type CSSProperties } from "react";
import { CalendarDays, MapPin, Clock, GitBranch, Plus, CheckCircle2, XCircle, RotateCcw, Wrench, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/Tabs";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney, formatTime, formatDateLong, toLocalISODate } from "@/lib/format";
import { usePermissions } from "@/store/usePermissions";
import { useUIStore } from "@/store/uiStore";
import * as api from "@/lib/api";
import { TurnoFormDialog } from "./TurnoFormDialog";
import { RepairDialog } from "./Repairs";
import type { Sale, PipelineItem, Customer, Appointment } from "@/lib/types";

/**
 * Agenda de turnos (Fase ④). Unifica tres fuentes:
 *   - Turnos (entidad propia, appointments) → click abre el editor.
 *   - Turnos cargados en ventas (legacy, sales.appointmentAt) → click abre la venta.
 *   - Visitas del pipeline (pipeline_items.visitAt) → click va al pipeline.
 * "Nuevo turno" crea un appointment (del cliente, con tipo editable).
 */

type Filter = "upcoming" | "past";
type ViewMode = "list" | "day";
type Kind = "turno" | "visita";

interface Entry {
  key: string;
  at: string;
  kind: Kind;
  customerName: string;
  meta?: string | null;
  amount?: number;
  isPaid?: boolean;
  status?: Appointment["status"];
  apptId?: string;
  repair?: { customerId?: string | null; customerName?: string | null; customerPhone?: string | null; appointmentId: string; problem?: string | null; deviceModel?: string | null };
  onClick?: () => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hasTime = (at: string) => /\d{2}:\d{2}/.test(at);
const qBtn: CSSProperties = { width: 28, height: 28, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center" };

export function Agenda({
  sales,
  items,
  customers,
  onOpenSale,
  onOpenPipeline,
}: {
  sales: Sale[];
  items: PipelineItem[];
  customers: Customer[];
  onOpenSale: (id: string) => void;
  onOpenPipeline: () => void;
}) {
  const { can } = usePermissions();
  const { showToast } = useUIStore();
  const canWrite = can("sales.write");
  const canRepair = can("repairs.write");
  const [repairForm, setRepairForm] = useState<Entry["repair"] | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [form, setForm] = useState<null | { initial?: Appointment }>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [dayKey, setDayKey] = useState<string>(() => toLocalISODate(new Date()));

  const todayKey = toLocalISODate(new Date());
  const tomorrowKey = toLocalISODate(new Date(Date.now() + 86_400_000));

  const loadAppointments = useCallback(() => {
    api.listAppointments().then(setAppointments).catch(() => {});
  }, []);
  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  const setStatus = useCallback(
    async (id: string, status: Appointment["status"]) => {
      try {
        await api.updateAppointment(id, { status });
        loadAppointments();
      } catch {
        showToast("No se pudo actualizar el turno", "error");
      }
    },
    [loadAppointments, showToast],
  );

  const all = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const a of appointments) {
      out.push({
        key: `a_${a.id}`,
        at: a.appointmentAt,
        kind: "turno",
        customerName: a.customerName || "Sin cliente",
        meta: [a.product, a.type, a.origin].filter(Boolean).join(" · ") || null,
        status: a.status,
        apptId: a.id,
        repair: (a.type ?? "").toLowerCase().includes("reparaci")
          ? { customerId: a.customerId, customerName: a.customerName, customerPhone: a.customerPhone, appointmentId: a.id, problem: a.notes, deviceModel: a.product }
          : undefined,
        onClick: canWrite ? () => setForm({ initial: a }) : undefined,
      });
    }
    // Ventas que ya tienen un turno-entidad vinculado: se muestran como ese
    // turno (no duplicamos la fila de la venta).
    const linkedSaleIds = new Set(appointments.map((a) => a.saleId).filter(Boolean) as string[]);
    for (const s of sales) {
      if (linkedSaleIds.has(s.id)) continue;
      if (typeof s.appointmentAt === "string" && s.appointmentAt.trim()) {
        out.push({
          key: `s_${s.id}`,
          at: s.appointmentAt,
          kind: "turno",
          customerName: s.customerName || "Sin cliente",
          meta: s.origin,
          amount: s.total,
          isPaid: s.isPaid,
          onClick: () => onOpenSale(s.id),
        });
      }
    }
    for (const it of items) {
      if (typeof it.visitAt === "string" && it.visitAt.trim()) {
        out.push({
          key: `i_${it.id}`,
          at: it.visitAt,
          kind: "visita",
          customerName: it.customerName || "Sin cliente",
          meta: it.stageName,
          onClick: onOpenPipeline,
        });
      }
    }
    return out;
  }, [appointments, sales, items, canWrite, onOpenSale, onOpenPipeline]);

  const upcomingCount = useMemo(() => all.filter((e) => e.at.slice(0, 10) >= todayKey).length, [all, todayKey]);
  const pastCount = all.length - upcomingCount;

  const groups = useMemo(() => {
    const list = all.filter((e) => (filter === "upcoming" ? e.at.slice(0, 10) >= todayKey : e.at.slice(0, 10) < todayKey));
    list.sort((a, b) => (filter === "upcoming" ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)));
    const byDay = new Map<string, Entry[]>();
    for (const e of list) {
      const k = e.at.slice(0, 10);
      const bucket = byDay.get(k);
      if (bucket) bucket.push(e);
      else byDay.set(k, [e]);
    }
    return [...byDay.entries()];
  }, [all, filter, todayKey]);

  const dayLabel = (key: string, sample: string) => {
    if (key === todayKey) return "Hoy";
    if (key === tomorrowKey) return "Mañana";
    return cap(formatDateLong(sample));
  };

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Tus turnos y visitas agendadas"
        icon={<CalendarDays size={20} />}
        actions={canWrite ? <Button variant="primary" size="md" iconLeft={<Plus size={16} />} onClick={() => setForm({})}>Nuevo turno</Button> : undefined}
      />

      <div style={{ marginBottom: space[4], display: "flex", gap: space[2], flexWrap: "wrap", alignItems: "center" }}>
        <Tabs
          variant="pills"
          size="sm"
          value={viewMode}
          onChange={(v) => setViewMode(v as ViewMode)}
          items={[
            { value: "list", label: "Lista" },
            { value: "day", label: "Día" },
          ]}
        />
        {viewMode === "list" && (
          <Tabs
            variant="pills"
            size="sm"
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            items={[
              { value: "upcoming", label: "Próximos", count: upcomingCount },
              { value: "past", label: "Pasados", count: pastCount },
            ]}
          />
        )}
      </div>

      {viewMode === "day" && (
        <AgendaDay all={all} dayKey={dayKey} setDayKey={setDayKey} todayKey={todayKey} tomorrowKey={tomorrowKey} />
      )}

      {viewMode === "list" && (groups.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title={filter === "upcoming" ? "No tenés turnos próximos" : "No hay turnos pasados"}
          description={
            filter === "upcoming"
              ? "Agendá un turno con “Nuevo turno”, o desde una venta o el pipeline."
              : "Los turnos y visitas que ya pasaron van a aparecer acá."
          }
          action={filter === "upcoming" && canWrite ? { label: "Nuevo turno", onClick: () => setForm({}), iconLeft: <Plus size={14} /> } : undefined}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space[5] }}>
          {groups.map(([key, entries]) => (
            <div key={key}>
              <div style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: space[2] }}>
                {dayLabel(key, entries[0].at)} · {entries.length} {entries.length === 1 ? "agendado" : "agendados"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
                {entries.map((e) => (
                  <Card key={e.key} padding={3} interactive={!!e.onClick} onClick={e.onClick}>
                    <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 48, flexShrink: 0 }}>
                        <Clock size={13} color={color.textDim} />
                        <span style={{ fontSize: text.sm, fontWeight: weight.bold, color: color.text, marginTop: 2 }}>
                          {hasTime(e.at) ? formatTime(e.at) : "—"}
                        </span>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: space[2], minWidth: 0, flexWrap: "wrap" }}>
                          <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {e.customerName}
                          </span>
                          {e.kind === "turno" ? <Badge tone="primary" variant="soft" size="sm">Turno</Badge> : <Badge tone="info" variant="soft" size="sm">Visita</Badge>}
                          {e.status === "done" && <Badge tone="success" variant="soft" size="sm">Hecho</Badge>}
                          {e.status === "cancelled" && <Badge tone="neutral" variant="soft" size="sm">Cancelado</Badge>}
                        </div>
                        {e.meta && (
                          <div style={{ display: "flex", gap: space[2], alignItems: "center", marginTop: 2 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: text.xs, color: color.textDim }}>
                              {e.kind === "turno" ? <MapPin size={11} /> : <GitBranch size={11} />} {e.meta}
                            </span>
                          </div>
                        )}
                      </div>
                      {e.apptId && (canWrite || (e.repair && canRepair)) ? (
                        <div onClick={(ev) => ev.stopPropagation()} style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          {e.repair && canRepair && (
                            <button title="Crear reparación" aria-label="Crear reparación" className="btn-icon muted" onClick={() => setRepairForm(e.repair!)} style={qBtn}>
                              <Wrench size={15} />
                            </button>
                          )}
                          {canWrite && e.status !== "done" && (
                            <button title="Marcar hecho" aria-label="Marcar hecho" className="btn-icon muted" onClick={() => setStatus(e.apptId!, "done")} style={qBtn}>
                              <CheckCircle2 size={15} />
                            </button>
                          )}
                          {canWrite && e.status !== "cancelled" && (
                            <button title="Cancelar turno" aria-label="Cancelar turno" className="btn-icon muted" onClick={() => setStatus(e.apptId!, "cancelled")} style={qBtn}>
                              <XCircle size={15} />
                            </button>
                          )}
                          {canWrite && e.status !== "pending" && (
                            <button title="Reabrir" aria-label="Reabrir" className="btn-icon muted" onClick={() => setStatus(e.apptId!, "pending")} style={qBtn}>
                              <RotateCcw size={15} />
                            </button>
                          )}
                        </div>
                      ) : e.kind === "turno" && typeof e.amount === "number" ? (
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{formatMoney(e.amount)}</div>
                          <Badge tone={e.isPaid ? "success" : "warning"} variant="soft" size="sm">{e.isPaid ? "Pagado" : "Pendiente"}</Badge>
                        </div>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {form && (
        <TurnoFormDialog
          customers={customers}
          initial={form.initial}
          onClose={() => setForm(null)}
          onSaved={loadAppointments}
        />
      )}

      {repairForm && (
        <RepairDialog
          customers={customers}
          presetCustomer={{ id: repairForm.customerId ?? "", name: repairForm.customerName ?? "", phone: repairForm.customerPhone ?? undefined }}
          presetProblem={repairForm.problem ?? undefined}
          presetDeviceModel={repairForm.deviceModel ?? undefined}
          presetAppointmentId={repairForm.appointmentId}
          onOpenSale={onOpenSale}
          onClose={() => setRepairForm(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}

/* ───────── Vista Día: timeline por hora ───────── */

const kindColor = (k: Kind) => (k === "turno" ? color.primary : color.info);

function timelineBlock(e: Entry) {
  return (
    <div
      key={e.key}
      onClick={e.onClick}
      style={{
        cursor: e.onClick ? "pointer" : "default",
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderLeft: `3px solid ${kindColor(e.kind)}`,
        borderRadius: radius.md,
        padding: `${space[2]} ${space[3]}`,
        opacity: e.status === "cancelled" ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: space[2], minWidth: 0 }}>
        {hasTime(e.at) && (
          <span style={{ fontSize: text.xs, fontWeight: weight.bold, color: color.text, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{formatTime(e.at)}</span>
        )}
        <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
          {e.customerName}
        </span>
        {e.kind === "turno" ? <Badge tone="primary" variant="soft" size="sm">Turno</Badge> : <Badge tone="info" variant="soft" size="sm">Visita</Badge>}
        {e.status === "done" && <Badge tone="success" variant="soft" size="sm">Hecho</Badge>}
      </div>
      {e.meta && (
        <div style={{ fontSize: text.xs, color: color.textDim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.meta}</div>
      )}
    </div>
  );
}

function AgendaDay({ all, dayKey, setDayKey, todayKey, tomorrowKey }: {
  all: Entry[];
  dayKey: string;
  setDayKey: (k: string) => void;
  todayKey: string;
  tomorrowKey: string;
}) {
  const dayEntries = useMemo(
    () => all.filter((e) => e.at.slice(0, 10) === dayKey).sort((a, b) => a.at.localeCompare(b.at)),
    [all, dayKey],
  );
  const { timed, untimed, hours } = useMemo(() => {
    const timed = dayEntries.filter((e) => hasTime(e.at));
    const untimed = dayEntries.filter((e) => !hasTime(e.at));
    const hs = timed.map((e) => Number(e.at.slice(11, 13)));
    const start = hs.length ? Math.min(8, ...hs) : 8;
    const end = hs.length ? Math.max(20, ...hs) : 20;
    const hours = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return { timed, untimed, hours };
  }, [dayEntries]);

  const shiftDay = (delta: number) => {
    const d = new Date(dayKey + "T12:00");
    d.setDate(d.getDate() + delta);
    setDayKey(toLocalISODate(d));
  };
  const label =
    (dayKey === todayKey ? "Hoy · " : dayKey === tomorrowKey ? "Mañana · " : "") + cap(formatDateLong(dayKey + "T12:00"));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[4] }}>
        <button onClick={() => shiftDay(-1)} aria-label="Día anterior" className="btn-icon muted" style={qBtn}><ChevronLeft size={16} /></button>
        <div style={{ flex: 1, textAlign: "center", fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{label}</div>
        <button onClick={() => shiftDay(1)} aria-label="Día siguiente" className="btn-icon muted" style={qBtn}><ChevronRight size={16} /></button>
        {dayKey !== todayKey && <Button variant="ghost" size="sm" onClick={() => setDayKey(todayKey)}>Hoy</Button>}
      </div>

      {untimed.length > 0 && (
        <div style={{ marginBottom: space[3] }}>
          <div style={{ fontSize: text.xs, fontWeight: weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: space[2] }}>Sin horario</div>
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>{untimed.map(timelineBlock)}</div>
        </div>
      )}

      <div>
        {hours.map((h) => {
          const hes = timed.filter((e) => Number(e.at.slice(11, 13)) === h);
          return (
            <div key={h} style={{ display: "flex", gap: space[3], borderTop: `1px solid ${color.border}`, padding: `${space[2]} 0`, minHeight: 52 }}>
              <div style={{ width: 44, flexShrink: 0, fontSize: text.xs, color: color.textMuted, fontVariantNumeric: "tabular-nums", paddingTop: 2 }}>
                {String(h).padStart(2, "0")}:00
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: space[2] }}>{hes.map(timelineBlock)}</div>
            </div>
          );
        })}
      </div>

      {dayEntries.length === 0 && (
        <div style={{ textAlign: "center", fontSize: text.sm, color: color.textDim, padding: space[5] }}>Sin turnos ni visitas este día.</div>
      )}
    </div>
  );
}
