import { useEffect, useMemo, useState } from "react";
import { Copy, Plus } from "lucide-react";
import { Modal, ModalField } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, Select } from "@/components/Input";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { color, radius, space, text, weight } from "@/tokens";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useBlueRate } from "@/store/dollarStore";
import * as api from "@/lib/api";
import { shareOnWhatsApp } from "@/lib/openExternal";
import { applyTurnoTemplate, buildTurnoData, resolveTurnoTemplate } from "@/lib/turnoTemplates";
import type { Origin, SaleDetail } from "@/lib/types";

/**
 * Genera los dos mensajes de turno (cliente + interno) desde una venta y, al
 * guardar/enviar, persiste el turno (appointment_at + origin) en la venta.
 * Las plantillas son los defaults de Fase ①; editarlas por negocio es Fase ②.
 */
export function TurnoDialog({
  sale,
  customerPhone,
  onClose,
  onSaved,
}: {
  sale: SaleDetail;
  customerPhone?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { showToast } = useUIStore();
  const ws = useWorkspaceStore((s) => s.activeWorkspace);
  const blue = useBlueRate();

  const [appointmentAt, setAppointmentAt] = useState(sale.appointmentAt ?? "");
  const [origin, setOrigin] = useState(sale.origin ?? "");
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [addingOrigin, setAddingOrigin] = useState(false);
  const [newOrigin, setNewOrigin] = useState("");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    api.listOrigins().then(setOrigins).catch(() => {});
    api.getSettings().then(setSettings).catch(() => setSettings({}));
  }, []);

  const data = useMemo(
    () => buildTurnoData(sale, ws, blue, { appointmentAt, origin }),
    [sale, ws, blue, appointmentAt, origin],
  );
  const clienteMsg = useMemo(() => applyTurnoTemplate(resolveTurnoTemplate("cliente", settings), data), [data, settings]);
  const internoMsg = useMemo(() => applyTurnoTemplate(resolveTurnoTemplate("interno", settings), data), [data, settings]);

  async function addOrigin() {
    const name = newOrigin.trim();
    if (!name) return;
    try {
      const o = await api.createOrigin(name);
      setOrigins((prev) =>
        prev.some((x) => x.id === o.id) ? prev : [...prev, o].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setOrigin(o.name);
      setAddingOrigin(false);
      setNewOrigin("");
    } catch {
      showToast("No se pudo agregar el origen", "error");
    }
  }

  async function persist(silent = false): Promise<boolean> {
    setSaving(true);
    try {
      await api.updateSale(sale.id, { appointmentAt: appointmentAt || null, origin: origin || null });
      onSaved?.();
      if (!silent) showToast("Turno guardado", "success");
      return true;
    } catch {
      showToast("No se pudo guardar el turno", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function copyMsg(value: string) {
    navigator.clipboard.writeText(value).then(() => showToast("Copiado", "success")).catch(() => {});
    void persist(true);
  }
  function waMsg(value: string, phone?: string) {
    shareOnWhatsApp(value, phone);
    void persist(true);
  }

  // Si el origen guardado en la venta ya no está en la lista (borrado), lo
  // mostramos igual como opción para no perder el valor.
  const origemMissing = origin && !origins.some((o) => o.name === origin);

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth={640}
      title="Generar turno"
      subtitle={sale.customerName}
      footer={
        <div style={{ display: "flex", gap: space[2], justifyContent: "flex-end" }}>
          <Button variant="ghost" size="md" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={saving}
            onClick={async () => {
              if (await persist()) onClose();
            }}
          >
            Guardar turno
          </Button>
        </div>
      }
    >
      <ModalField label="Día y horario del turno">
        <Input type="datetime-local" value={appointmentAt} onChange={(e) => setAppointmentAt(e.target.value)} />
      </ModalField>

      <ModalField label="Viene de (origen)" hint="Lo gestionás en Ajustes → Negocio.">
        {addingOrigin ? (
          <div style={{ display: "flex", gap: space[2] }}>
            <Input
              value={newOrigin}
              onChange={(e) => setNewOrigin(e.target.value)}
              placeholder="Ej: MobileZone"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addOrigin();
                }
              }}
              style={{ flex: 1 }}
            />
            <Button variant="secondary" size="md" iconLeft={<Plus size={15} />} onClick={() => void addOrigin()}>
              Agregar
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setAddingOrigin(false);
                setNewOrigin("");
              }}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Select
            value={origin}
            onChange={(e) => {
              if (e.target.value === "__new__") setAddingOrigin(true);
              else setOrigin(e.target.value);
            }}
          >
            <option value="">— Sin origen —</option>
            {origemMissing && <option value={origin}>{origin}</option>}
            {origins.map((o) => (
              <option key={o.id} value={o.name}>
                {o.name}
              </option>
            ))}
            <option value="__new__">➕ Nuevo origen…</option>
          </Select>
        )}
      </ModalField>

      <MessagePreview title="Para el cliente" body={clienteMsg} onCopy={() => copyMsg(clienteMsg)} onWa={() => waMsg(clienteMsg, customerPhone)} />
      <MessagePreview title="Interno (anúnciate)" body={internoMsg} onCopy={() => copyMsg(internoMsg)} onWa={() => waMsg(internoMsg)} />
    </Modal>
  );
}

function MessagePreview({ title, body, onCopy, onWa }: { title: string; body: string; onCopy: () => void; onWa: () => void }) {
  return (
    <div style={{ marginBottom: space[4] }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space[2] }}>
        <span style={{ fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{title}</span>
        <div style={{ display: "flex", gap: space[2] }}>
          <Button variant="ghost" size="sm" iconLeft={<Copy size={14} />} onClick={onCopy}>
            Copiar
          </Button>
          <Button variant="secondary" size="sm" iconLeft={<WhatsAppIcon size={14} color="var(--success)" />} onClick={onWa}>
            WhatsApp
          </Button>
        </div>
      </div>
      <pre
        style={{
          margin: 0,
          padding: space[3],
          background: color.surface2,
          border: `1px solid ${color.border}`,
          borderRadius: radius.md,
          fontSize: text.sm,
          color: color.text,
          fontFamily: "inherit",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {body}
      </pre>
    </div>
  );
}
