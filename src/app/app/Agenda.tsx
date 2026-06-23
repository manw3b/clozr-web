import { useMemo, useState } from "react";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { Tabs } from "@/components/Tabs";
import { color, space, text, weight } from "@/tokens";
import { formatMoney, formatTime, formatDateLong, toLocalISODate } from "@/lib/format";
import type { Sale } from "@/lib/types";

/**
 * Agenda de turnos (Fase ④). Lista los turnos agendados en ventas
 * (sales.appointmentAt — el "turno" de la Fase ①), agrupados por día.
 *
 * Read-only v1: reusa el array `sales` que Crm ya tiene cargado, así que no
 * pega a la API. El alcance de datos (vendedor ve solo lo suyo) ya viene
 * resuelto desde el server en ese array.
 */

type Filter = "upcoming" | "past";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Agenda({ sales }: { sales: Sale[] }) {
  const [filter, setFilter] = useState<Filter>("upcoming");
  const todayKey = toLocalISODate(new Date());
  const tomorrowKey = toLocalISODate(new Date(Date.now() + 86_400_000));

  // Turnos = ventas con appointmentAt. La clave de día es el slice YYYY-MM-DD
  // del wall-clock local (no pasamos fecha-sola a new Date → evita el corrimiento a UTC).
  const turnos = useMemo(
    () => sales.filter((s): s is Sale & { appointmentAt: string } => typeof s.appointmentAt === "string" && s.appointmentAt.trim() !== ""),
    [sales],
  );

  const upcomingCount = useMemo(() => turnos.filter((s) => s.appointmentAt.slice(0, 10) >= todayKey).length, [turnos, todayKey]);
  const pastCount = turnos.length - upcomingCount;

  const groups = useMemo(() => {
    const list = turnos.filter((s) => (filter === "upcoming" ? s.appointmentAt.slice(0, 10) >= todayKey : s.appointmentAt.slice(0, 10) < todayKey));
    list.sort((a, b) => (filter === "upcoming" ? a.appointmentAt.localeCompare(b.appointmentAt) : b.appointmentAt.localeCompare(a.appointmentAt)));
    const byDay = new Map<string, Array<Sale & { appointmentAt: string }>>();
    for (const s of list) {
      const k = s.appointmentAt.slice(0, 10);
      const bucket = byDay.get(k);
      if (bucket) bucket.push(s);
      else byDay.set(k, [s]);
    }
    return [...byDay.entries()];
  }, [turnos, filter, todayKey]);

  const dayLabel = (key: string, sample: string) => {
    if (key === todayKey) return "Hoy";
    if (key === tomorrowKey) return "Mañana";
    return cap(formatDateLong(sample));
  };

  return (
    <div>
      <PageHeader title="Agenda" subtitle="Tus turnos agendados" icon={<CalendarDays size={20} />} />

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
              ? "Cuando agendes un turno desde una venta, va a aparecer acá."
              : "Los turnos que ya pasaron van a aparecer acá."
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space[5] }}>
          {groups.map(([key, items]) => (
            <div key={key}>
              <div
                style={{
                  fontSize: text.xs,
                  fontWeight: weight.semibold,
                  color: color.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: space[2],
                }}
              >
                {dayLabel(key, items[0].appointmentAt)} · {items.length} {items.length === 1 ? "turno" : "turnos"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
                {items.map((s) => (
                  <Card key={s.id} padding={3}>
                    <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 48, flexShrink: 0 }}>
                        <Clock size={13} color={color.textDim} />
                        <span style={{ fontSize: text.sm, fontWeight: weight.bold, color: color.text, marginTop: 2 }}>
                          {formatTime(s.appointmentAt)}
                        </span>
                      </div>
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
                          {s.customerName || "Sin cliente"}
                        </div>
                        <div style={{ display: "flex", gap: space[2], alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                          {s.origin && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: text.xs, color: color.textDim }}>
                              <MapPin size={11} /> {s.origin}
                            </span>
                          )}
                          {s.sellerName && <span style={{ fontSize: text.xs, color: color.textDim }}>· {s.sellerName}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{formatMoney(s.total)}</div>
                        <Badge tone={s.isPaid ? "success" : "warning"} variant="soft" size="sm">
                          {s.isPaid ? "Pagado" : "Pendiente"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
