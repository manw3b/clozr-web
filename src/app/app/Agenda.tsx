import { useEffect, useMemo, useState, useCallback } from "react";
import { CalendarDays, MapPin, Clock, GitBranch, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/Tabs";
import { color, space, text, weight } from "@/tokens";
import { formatMoney, formatTime, formatDateLong, toLocalISODate } from "@/lib/format";
import { usePermissions } from "@/store/usePermissions";
import * as api from "@/lib/api";
import { TurnoFormDialog } from "./TurnoFormDialog";
import type { Sale, PipelineItem, Customer, Appointment } from "@/lib/types";

/**
 * Agenda de turnos (Fase ④). Unifica tres fuentes:
 *   - Turnos (entidad propia, appointments) → click abre el editor.
 *   - Turnos cargados en ventas (legacy, sales.appointmentAt) → click abre la venta.
 *   - Visitas del pipeline (pipeline_items.visitAt) → click va al pipeline.
 * "Nuevo turno" crea un appointment (del cliente, con tipo editable).
 */

type Filter = "upcoming" | "past";
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
  onClick?: () => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hasTime = (at: string) => /\d{2}:\d{2}/.test(at);

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
  const canWrite = can("sales.write");
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [form, setForm] = useState<null | { initial?: Appointment }>(null);

  const todayKey = toLocalISODate(new Date());
  const tomorrowKey = toLocalISODate(new Date(Date.now() + 86_400_000));

  const loadAppointments = useCallback(() => {
    api.listAppointments().then(setAppointments).catch(() => {});
  }, []);
  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  const all = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const a of appointments) {
      out.push({
        key: `a_${a.id}`,
        at: a.appointmentAt,
        kind: "turno",
        customerName: a.customerName || "Sin cliente",
        meta: [a.type, a.origin].filter(Boolean).join(" · ") || null,
        status: a.status,
        onClick: canWrite ? () => setForm({ initial: a }) : undefined,
      });
    }
    for (const s of sales) {
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

      <div style={{ marginBottom: space[4] }}>
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
      </div>

      {groups.length === 0 ? (
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
                      {e.kind === "turno" && typeof e.amount === "number" && (
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{formatMoney(e.amount)}</div>
                          <Badge tone={e.isPaid ? "success" : "warning"} variant="soft" size="sm">{e.isPaid ? "Pagado" : "Pendiente"}</Badge>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <TurnoFormDialog
          customers={customers}
          initial={form.initial}
          onClose={() => setForm(null)}
          onSaved={loadAppointments}
        />
      )}
    </div>
  );
}
