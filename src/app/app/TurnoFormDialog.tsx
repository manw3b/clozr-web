import { useEffect, useMemo, useState } from "react";
import { Copy, Plus } from "lucide-react";
import { Modal, ModalField } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, Select, Textarea } from "@/components/Input";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { color, radius, space, text, weight } from "@/tokens";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useBlueRate } from "@/store/dollarStore";
import * as api from "@/lib/api";
import { shareOnWhatsApp } from "@/lib/openExternal";
import { applyTurnoTemplate, resolveTurnoTemplate, buildTurnoData, buildTurnoDataFromAppointment } from "@/lib/turnoTemplates";
import type { Appointment, AppointmentType, Customer, Origin, SaleDetail } from "@/lib/types";

/**
 * Alta/edición de un turno (Fase ④). El turno es del CLIENTE y puede ser para
 * distintas cosas (tipo editable). Al guardar/enviar ofrece el WhatsApp de
 * confirmación reusando la plantilla "cliente".
 */
export function TurnoFormDialog({
  customers,
  initial,
  presetCustomer,
  sale,
  salePhone,
  onClose,
  onSaved,
}: {
  customers: Customer[];
  initial?: Appointment | null;
  presetCustomer?: { id: string; name: string; phone?: string } | null;
  /** Si se abre desde una venta: prefill + mensaje rico + persiste en la venta. */
  sale?: SaleDetail | null;
  salePhone?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useUIStore();
  const ws = useWorkspaceStore((s) => s.activeWorkspace);
  const blue = useBlueRate();

  const [savedId, setSavedId] = useState<string | null>(initial?.id ?? null);
  const [customerId, setCustomerId] = useState(sale?.customerId ?? initial?.customerId ?? presetCustomer?.id ?? "");
  const [customerName, setCustomerName] = useState(sale?.customerName ?? initial?.customerName ?? presetCustomer?.name ?? "");
  const [customerPhone, setCustomerPhone] = useState(salePhone ?? initial?.customerPhone ?? presetCustomer?.phone ?? "");
  const [appointmentAt, setAppointmentAt] = useState(sale?.appointmentAt ?? initial?.appointmentAt ?? "");
  const [type, setType] = useState(initial?.type ?? (sale ? "Venta" : ""));
  const [origin, setOrigin] = useState(sale?.origin ?? initial?.origin ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [addingType, setAddingType] = useState(false);
  const [newType, setNewType] = useState("");
  const [addingOrigin, setAddingOrigin] = useState(false);
  const [newOrigin, setNewOrigin] = useState("");

  useEffect(() => {
    api.listAppointmentTypes().then(setTypes).catch(() => {});
    api.listOrigins().then(setOrigins).catch(() => {});
    api.getSettings().then(setSettings).catch(() => setSettings({}));
  }, []);

  // Si elegís un cliente registrado, tomamos su nombre/teléfono.
  function selectCustomer(id: string) {
    setCustomerId(id);
    if (id) {
      const c = customers.find((x) => x.id === id);
      if (c) {
        setCustomerName(c.name);
        setCustomerPhone(c.phone ?? "");
      }
    }
  }

  async function addType() {
    const name = newType.trim();
    if (!name) return;
    try {
      const t = await api.createAppointmentType(name);
      setTypes((prev) => (prev.some((x) => x.id === t.id) ? prev : [...prev, t].sort((a, b) => a.name.localeCompare(b.name))));
      setType(t.name);
      setAddingType(false);
      setNewType("");
    } catch {
      showToast("No se pudo agregar el tipo", "error");
    }
  }

  async function addOrigin() {
    const name = newOrigin.trim();
    if (!name) return;
    try {
      const o = await api.createOrigin(name);
      setOrigins((prev) => (prev.some((x) => x.id === o.id) ? prev : [...prev, o].sort((a, b) => a.name.localeCompare(b.name))));
      setOrigin(o.name);
      setAddingOrigin(false);
      setNewOrigin("");
    } catch {
      showToast("No se pudo agregar el origen", "error");
    }
  }

  const clienteMsg = useMemo(
    () =>
      applyTurnoTemplate(
        resolveTurnoTemplate("cliente", settings),
        sale
          ? buildTurnoData(sale, ws, blue, { appointmentAt, origin })
          : buildTurnoDataFromAppointment({ customerName, appointmentAt, origin, type, notes }, ws),
      ),
    [sale, blue, customerName, appointmentAt, origin, type, notes, ws, settings],
  );

  const valid = appointmentAt.trim() !== "" && customerName.trim() !== "";

  async function persist(silent = false): Promise<boolean> {
    if (!valid) {
      if (!silent) showToast("Falta el cliente o la fecha del turno", "error");
      return false;
    }
    setSaving(true);
    try {
      const input = {
        saleId: sale?.id ?? initial?.saleId ?? null,
        customerId: customerId || null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        appointmentAt,
        type: type || null,
        origin: origin || null,
        notes: notes.trim() || null,
      };
      if (savedId) {
        await api.updateAppointment(savedId, input);
      } else {
        const r = await api.createAppointment(input);
        setSavedId(r.id);
      }
      // Desde una venta: persistimos también en la venta (chip + back-compat).
      if (sale) await api.updateSale(sale.id, { appointmentAt: appointmentAt || null, origin: origin || null });
      onSaved();
      if (!silent) showToast("Turno guardado", "success");
      return true;
    } catch {
      showToast("No se pudo guardar el turno", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const originMissing = origin && !origins.some((o) => o.name === origin);
  const typeMissing = type && !types.some((t) => t.name === type);

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth={640}
      title={sale ? "Generar turno" : initial ? "Editar turno" : "Nuevo turno"}
      subtitle={customerName || undefined}
      footer={
        <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end" }}>
          <Button variant="ghost" size="md" onClick={onClose}>Cerrar</Button>
          <Button variant="primary" size="md" disabled={saving || !valid} onClick={async () => { if (await persist()) onClose(); }}>
            Guardar turno
          </Button>
        </div>
      }
    >
      {sale ? (
        <ModalField label="Cliente">
          <div style={{ fontSize: text.sm, color: color.text, padding: `${space[2]} 0` }}>{customerName || "Consumidor final"}</div>
        </ModalField>
      ) : (
        <>
          <ModalField label="Cliente">
            <Select value={customerId} onChange={(e) => selectCustomer(e.target.value)}>
              <option value="">— Sin registrar (escribir) —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </ModalField>

          {!customerId && (
            <div style={{ display: "flex", gap: space[2] }}>
              <ModalField label="Nombre del cliente">
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ej: Juan Pérez" />
              </ModalField>
              <ModalField label="Teléfono (para WhatsApp)">
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="11 5555 5555" />
              </ModalField>
            </div>
          )}
        </>
      )}

      <ModalField label="Día y horario del turno">
        <Input type="datetime-local" value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} />
      </ModalField>

      <ModalField label="Tipo de turno">
        {addingType ? (
          <div style={{ display: "flex", gap: space[2] }}>
            <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="Ej: Reparación" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addType(); } }} style={{ flex: 1 }} />
            <Button variant="secondary" size="md" iconLeft={<Plus size={15} />} onClick={() => void addType()}>Agregar</Button>
            <Button variant="ghost" size="md" onClick={() => { setAddingType(false); setNewType(""); }}>Cancelar</Button>
          </div>
        ) : (
          <Select value={type} onChange={(e) => { if (e.target.value === "__new__") setAddingType(true); else setType(e.target.value); }}>
            <option value="">— Sin tipo —</option>
            {typeMissing && <option value={type}>{type}</option>}
            {types.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            <option value="__new__">➕ Nuevo tipo…</option>
          </Select>
        )}
      </ModalField>

      <ModalField label="Viene de (origen)">
        {addingOrigin ? (
          <div style={{ display: "flex", gap: space[2] }}>
            <Input value={newOrigin} onChange={(e) => setNewOrigin(e.target.value)} placeholder="Ej: MobileZone" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addOrigin(); } }} style={{ flex: 1 }} />
            <Button variant="secondary" size="md" iconLeft={<Plus size={15} />} onClick={() => void addOrigin()}>Agregar</Button>
            <Button variant="ghost" size="md" onClick={() => { setAddingOrigin(false); setNewOrigin(""); }}>Cancelar</Button>
          </div>
        ) : (
          <Select value={origin} onChange={(e) => { if (e.target.value === "__new__") setAddingOrigin(true); else setOrigin(e.target.value); }}>
            <option value="">— Sin origen —</option>
            {originMissing && <option value={origin}>{origin}</option>}
            {origins.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
            <option value="__new__">➕ Nuevo origen…</option>
          </Select>
        )}
      </ModalField>

      <ModalField label="Notas">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Detalle del turno (ej: cambio de pantalla)" />
      </ModalField>

      <div style={{ marginTop: space[2] }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space[2] }}>
          <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>Confirmación para el cliente</span>
          <div style={{ display: "flex", gap: space[2] }}>
            <Button variant="ghost" size="sm" iconLeft={<Copy size={14} />}
              onClick={() => { navigator.clipboard.writeText(clienteMsg).then(() => showToast("Copiado", "success")).catch(() => {}); void persist(true); }}>
              Copiar
            </Button>
            <Button variant="secondary" size="sm" iconLeft={<WhatsAppIcon size={14} color="var(--success)" />} disabled={!valid}
              onClick={() => { shareOnWhatsApp(clienteMsg, customerPhone || undefined); void persist(true); }}>
              WhatsApp
            </Button>
          </div>
        </div>
        <pre style={{ margin: 0, padding: space[3], background: color.surface2, border: `1px solid ${color.border}`, borderRadius: radius.md, fontSize: text.sm, color: color.text, fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {clienteMsg}
        </pre>
      </div>
    </Modal>
  );
}
