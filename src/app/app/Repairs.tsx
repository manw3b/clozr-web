import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Wrench, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Modal, ModalField } from "@/components/Modal";
import { Input, Select, Textarea } from "@/components/Input";
import { confirmAsync } from "@/lib/confirmAsync";
import { color, radius, space, text, weight } from "@/tokens";
import { formatMoney } from "@/lib/format";
import { usePermissions } from "@/store/usePermissions";
import { useUIStore } from "@/store/uiStore";
import * as api from "@/lib/api";
import type { Customer, Repair, RepairStatus } from "@/lib/types";

const STATUS_FLOW: RepairStatus[] = ["received", "diagnosing", "quoted", "approved", "repairing", "ready", "delivered", "cancelled"];
const STATUS_LABEL: Record<RepairStatus, string> = {
  received: "Recibido",
  diagnosing: "Diagnóstico",
  quoted: "Presupuestado",
  approved: "Aprobado",
  repairing: "En reparación",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};
const STATUS_COLOR: Record<RepairStatus, string> = {
  received: "#64748B",
  diagnosing: "#3B82F6",
  quoted: "#F59E0B",
  approved: "#8B5CF6",
  repairing: "#E11D48",
  ready: "#0EA5E9",
  delivered: "#10B981",
  cancelled: "#EF4444",
};

const quoteTotal = (r: Repair | { partsCost?: number | null; laborCost?: number | null }) =>
  (r.partsCost ?? 0) + (r.laborCost ?? 0);

export function Repairs({ customers, onOpenSale }: { customers: Customer[]; onOpenSale?: (id: string) => void }) {
  const { can } = usePermissions();
  const { showToast } = useUIStore();
  const canWrite = can("repairs.write");
  const [repairs, setRepairs] = useState<Repair[] | null>(null);
  const [dialog, setDialog] = useState<null | { initial?: Repair }>(null);

  const load = useCallback(() => {
    api.listRepairs().then(setRepairs).catch(() => setRepairs([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const move = useCallback(
    async (r: Repair, status: RepairStatus) => {
      if (r.status === status) return;
      setRepairs((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status } : x)));
      try {
        await api.updateRepair(r.id, { status });
      } catch {
        showToast("No se pudo mover", "error");
        load();
      }
    },
    [showToast, load],
  );

  async function remove(r: Repair) {
    const ok = await confirmAsync({ title: "¿Eliminar reparación?", message: `${r.deviceModel || "Equipo"} · ${r.customerName || ""}`, confirmText: "Eliminar", tone: "danger" });
    if (!ok) return;
    setRepairs((prev) => (prev ?? []).filter((x) => x.id !== r.id));
    try { await api.deleteRepair(r.id); } catch { showToast("No se pudo eliminar", "error"); load(); }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRepair = activeId ? (repairs ?? []).find((r) => r.id === activeId) ?? null : null;
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const r = (repairs ?? []).find((x) => x.id === String(active.id));
    const status = String(over.id) as RepairStatus;
    if (r && STATUS_FLOW.includes(status)) void move(r, status);
  }

  const byStatus = useMemo(() => {
    const m = new Map<RepairStatus, Repair[]>();
    for (const s of STATUS_FLOW) m.set(s, []);
    for (const r of repairs ?? []) (m.get(r.status) ?? m.set(r.status, []).get(r.status)!).push(r);
    return m;
  }, [repairs]);

  return (
    <div>
      <PageHeader
        title="Reparaciones"
        subtitle="Tablero del taller"
        icon={<Wrench size={20} />}
        actions={canWrite ? <Button variant="primary" size="md" iconLeft={<Plus size={16} />} onClick={() => setDialog({})}>Nueva reparación</Button> : undefined}
      />

      {repairs === null ? (
        <div style={{ fontSize: text.sm, color: color.textDim, padding: space[6] }}>Cargando…</div>
      ) : repairs.length === 0 ? (
        <EmptyState
          icon={<Wrench size={28} />}
          title="Sin reparaciones"
          description="Ingresá un equipo para empezar a seguir su reparación."
          action={canWrite ? { label: "Nueva reparación", onClick: () => setDialog({}), iconLeft: <Plus size={14} /> } : undefined}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div style={{ display: "flex", gap: space[3], overflowX: "auto", paddingBottom: space[3] }}>
            {STATUS_FLOW.map((status) => (
              <RepairColumn key={status} status={status} count={(byStatus.get(status) ?? []).length}>
                {(byStatus.get(status) ?? []).map((r) => (
                  <RepairCard key={r.id} repair={r} canWrite={canWrite} onEdit={() => setDialog({ initial: r })} onRemove={() => remove(r)} onMove={(s) => move(r, s)} />
                ))}
              </RepairColumn>
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeRepair ? <RepairCardView repair={activeRepair} canWrite={false} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {dialog && (
        <RepairDialog customers={customers} initial={dialog.initial} onOpenSale={onOpenSale} onClose={() => setDialog(null)} onSaved={load} />
      )}
    </div>
  );
}

/* ───────── RepairDialog ───────── */

export function RepairDialog({
  customers,
  initial,
  presetCustomer,
  presetProblem,
  presetAppointmentId,
  onOpenSale,
  onClose,
  onSaved,
}: {
  customers: Customer[];
  initial?: Repair | null;
  presetCustomer?: { id: string; name: string; phone?: string } | null;
  presetProblem?: string;
  presetAppointmentId?: string;
  onOpenSale?: (id: string) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useUIStore();
  const [customerId, setCustomerId] = useState(initial?.customerId ?? presetCustomer?.id ?? "");
  const [customerName, setCustomerName] = useState(initial?.customerName ?? presetCustomer?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone ?? presetCustomer?.phone ?? "");
  const [deviceModel, setDeviceModel] = useState(initial?.deviceModel ?? "");
  const [deviceImei, setDeviceImei] = useState(initial?.deviceImei ?? "");
  const [devicePasscode, setDevicePasscode] = useState(initial?.devicePasscode ?? "");
  const [accessories, setAccessories] = useState(initial?.accessories ?? "");
  const [problem, setProblem] = useState(initial?.problem ?? presetProblem ?? "");
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? "");
  const [status, setStatus] = useState<RepairStatus>(initial?.status ?? "received");
  const [partsCost, setPartsCost] = useState(initial?.partsCost != null ? String(initial.partsCost) : "");
  const [laborCost, setLaborCost] = useState(initial?.laborCost != null ? String(initial.laborCost) : "");
  const [technician, setTechnician] = useState(initial?.technician ?? "");
  const [warrantyMonths, setWarrantyMonths] = useState(initial?.warrantyMonths != null ? String(initial.warrantyMonths) : "");
  const [estimatedAt, setEstimatedAt] = useState(initial?.estimatedAt ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  function selectCustomer(id: string) {
    setCustomerId(id);
    if (id) {
      const c = customers.find((x) => x.id === id);
      if (c) { setCustomerName(c.name); setCustomerPhone(c.phone ?? ""); }
    }
  }

  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const total = (num(partsCost) ?? 0) + (num(laborCost) ?? 0);
  const valid = customerName.trim() !== "";

  function buildInput() {
    return {
      customerId: customerId || null,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || null,
      deviceModel: deviceModel.trim() || null,
      deviceImei: deviceImei.trim() || null,
      devicePasscode: devicePasscode.trim() || null,
      accessories: accessories.trim() || null,
      problem: problem.trim() || null,
      diagnosis: diagnosis.trim() || null,
      status,
      partsCost: num(partsCost),
      laborCost: num(laborCost),
      technician: technician.trim() || null,
      warrantyMonths: num(warrantyMonths),
      estimatedAt: estimatedAt || null,
      notes: notes.trim() || null,
      appointmentId: initial?.appointmentId ?? presetAppointmentId ?? null,
    };
  }

  async function save() {
    if (!valid) { showToast("Falta el cliente", "error"); return; }
    setSaving(true);
    try {
      if (initial) await api.updateRepair(initial.id, buildInput());
      else await api.createRepair(buildInput());
      onSaved();
      showToast("Reparación guardada", "success");
      onClose();
    } catch {
      showToast("No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  }

  // Cobrar: crea una venta (impaga) por el presupuesto, la vincula y marca
  // entregada. El pago se registra en la venta (reusa todo el flujo de ventas).
  async function cobrar() {
    if (!initial) return;
    if (total <= 0) { showToast("Cargá el presupuesto antes de cobrar", "error"); return; }
    setSaving(true);
    try {
      await api.updateRepair(initial.id, buildInput());
      const label = `Reparación${deviceModel.trim() ? " " + deviceModel.trim() : ""}`;
      const saleId = await api.createSale({
        customerId: customerId || undefined,
        customerName: customerName.trim() || "Consumidor final",
        notes: [label, diagnosis.trim()].filter(Boolean).join(" — "),
        items: [{ description: label, quantity: 1, unitPrice: total, unitCost: num(partsCost) }],
        payments: [],
      });
      await api.updateRepair(initial.id, { saleId, status: "delivered", deliveredAt: new Date().toISOString().slice(0, 16) });
      onSaved();
      showToast("Venta creada — cobrá el pago en la venta", "success");
      onClose();
      onOpenSale?.(saleId);
    } catch {
      showToast("No se pudo cobrar", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth={680}
      title={initial ? "Reparación" : "Nueva reparación"}
      subtitle={deviceModel || customerName || undefined}
      footer={
        <div style={{ display: "flex", gap: space[2], justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <span style={{ fontSize: text.sm, color: color.textMuted }}>
            Presupuesto: <strong style={{ color: color.text }}>{formatMoney(total)}</strong>
          </span>
          <div style={{ display: "flex", gap: space[2] }}>
            <Button variant="ghost" size="md" onClick={onClose}>Cerrar</Button>
            {initial?.saleId ? (
              <Button variant="secondary" size="md" onClick={() => { onClose(); onOpenSale?.(initial.saleId!); }}>Ver venta</Button>
            ) : initial ? (
              <Button variant="secondary" size="md" onClick={cobrar} loading={saving} disabled={total <= 0}>Cobrar y entregar</Button>
            ) : null}
            <Button variant="primary" size="md" onClick={save} loading={saving} disabled={!valid}>Guardar</Button>
          </div>
        </div>
      }
    >
      <ModalField label="Cliente">
        <Select value={customerId} onChange={(e) => selectCustomer(e.target.value)}>
          <option value="">— Sin registrar (escribir) —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </ModalField>
      {!customerId && (
        <div style={{ display: "flex", gap: space[2] }}>
          <ModalField label="Nombre"><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Cliente" /></ModalField>
          <ModalField label="Teléfono"><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="11 5555 5555" /></ModalField>
        </div>
      )}

      <div style={{ display: "flex", gap: space[2] }}>
        <ModalField label="Equipo / modelo"><Input value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} placeholder="Ej: iPhone 13" /></ModalField>
        <ModalField label="IMEI / serie"><Input value={deviceImei} onChange={(e) => setDeviceImei(e.target.value)} placeholder="IMEI" /></ModalField>
      </div>
      <div style={{ display: "flex", gap: space[2] }}>
        <ModalField label="Clave / patrón"><Input value={devicePasscode} onChange={(e) => setDevicePasscode(e.target.value)} placeholder="Para poder probarlo" /></ModalField>
        <ModalField label="Accesorios que deja"><Input value={accessories} onChange={(e) => setAccessories(e.target.value)} placeholder="Cargador, funda…" /></ModalField>
      </div>

      <ModalField label="Falla declarada"><Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} placeholder="Qué dice el cliente que pasa" /></ModalField>
      <ModalField label="Diagnóstico"><Textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} placeholder="Qué encontró el técnico" /></ModalField>

      <div style={{ display: "flex", gap: space[2] }}>
        <ModalField label="Estado">
          <Select value={status} onChange={(e) => setStatus(e.target.value as RepairStatus)}>
            {STATUS_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </Select>
        </ModalField>
        <ModalField label="Técnico"><Input value={technician} onChange={(e) => setTechnician(e.target.value)} placeholder="Responsable" /></ModalField>
      </div>

      <div style={{ display: "flex", gap: space[2] }}>
        <ModalField label="Repuestos ($)"><Input type="number" value={partsCost} onChange={(e) => setPartsCost(e.target.value)} placeholder="0" /></ModalField>
        <ModalField label="Mano de obra ($)"><Input type="number" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="0" /></ModalField>
      </div>
      <div style={{ display: "flex", gap: space[2] }}>
        <ModalField label="Garantía (meses)"><Input type="number" value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value)} placeholder="0" /></ModalField>
        <ModalField label="Entrega estimada"><Input type="datetime-local" value={estimatedAt} onChange={(e) => setEstimatedAt(e.target.value)} /></ModalField>
      </div>

      <ModalField label="Notas"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observaciones internas" /></ModalField>
    </Modal>
  );
}

/* ───────── Tablero: columna (droppable) + card (draggable) ───────── */

const stopPD = (e: { stopPropagation: () => void }) => e.stopPropagation();

function RepairColumn({ status, count, children }: { status: RepairStatus; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div style={{ minWidth: 280, width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: space[2] }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2], padding: `${space[1]} ${space[2]}` }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLOR[status], flexShrink: 0 }} />
        <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{STATUS_LABEL[status]}</span>
        <span style={{ fontSize: text.xs, color: color.textMuted }}>{count}</span>
      </div>
      <div
        ref={setNodeRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: space[2],
          minHeight: 80,
          borderRadius: radius.md,
          padding: space[1],
          background: isOver ? color.surface2 : "transparent",
          outline: isOver ? `1px dashed ${STATUS_COLOR[status]}` : "none",
          transition: "background 120ms",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function RepairCard({ repair, canWrite, onEdit, onRemove, onMove }: {
  repair: Repair;
  canWrite: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onMove: (s: RepairStatus) => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: repair.id, disabled: !canWrite });
  return (
    <div
      ref={setNodeRef}
      {...(canWrite ? listeners : {})}
      {...(canWrite ? attributes : {})}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: canWrite ? "grab" : "default" }}
    >
      <RepairCardView repair={repair} canWrite={canWrite} onEdit={onEdit} onRemove={onRemove} onMove={onMove} />
    </div>
  );
}

function RepairCardView({ repair: r, canWrite, onEdit, onRemove, onMove }: {
  repair: Repair;
  canWrite: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  onMove?: (s: RepairStatus) => void;
}) {
  return (
    <Card padding={3} interactive={!!onEdit} onClick={onEdit}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: space[2], justifyContent: "space-between" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.deviceModel || "Equipo sin modelo"}
          </div>
          <div style={{ fontSize: text.xs, color: color.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
            {r.customerName || "Sin cliente"}{r.deviceImei ? ` · ${r.deviceImei}` : ""}
          </div>
        </div>
        {canWrite && onRemove && (
          <button onPointerDown={stopPD} onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Eliminar" className="btn-icon muted" style={{ width: 24, height: 24, borderRadius: radius.sm, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {r.problem && (
        <div style={{ fontSize: text.xs, color: color.textMuted, marginTop: space[1], overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.problem}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[2], marginTop: space[2] }}>
        {quoteTotal(r) > 0 ? (
          <span style={{ fontSize: text.sm, fontWeight: weight.bold, color: color.text }}>{formatMoney(quoteTotal(r))}</span>
        ) : <span />}
        {canWrite && onMove && (
          <select
            value={r.status}
            onPointerDown={stopPD}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.stopPropagation(); onMove(e.target.value as RepairStatus); }}
            className="select-trigger"
            style={{ padding: "3px 6px", fontSize: text.xs, borderRadius: radius.sm, color: color.text, maxWidth: 130 }}
          >
            {STATUS_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        )}
      </div>
    </Card>
  );
}
