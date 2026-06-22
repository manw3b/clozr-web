import { useEffect, useState } from "react";
import { Modal, ModalField } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, Select } from "@/components/Input";
import { DateTimePicker } from "@/components/DateTimePicker";
import { useUIStore } from "@/store/uiStore";
import * as api from "@/lib/api";
import type { TaskType, Member } from "@/lib/types";

/**
 * Modal "Nueva tarea". Port web del de la desktop: misma UI, pero crea via
 * el Worker (api.createTask) en vez de SQLite. Reusable (lo va a usar Mi Día).
 */
export function NewTaskModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { showToast } = useUIStore();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("puntual");
  const [dueAt, setDueAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);

  // Miembros a los que se puede asignar: solo los que ya entraron (tienen user_id).
  useEffect(() => {
    if (!open) return;
    api.listMembers().then(setMembers).catch(() => {});
  }, [open]);
  const assignable = members.filter((m) => m.userId && m.status === "active");

  const canSubmit = title.trim().length >= 2;
  const isDirty = () =>
    title.trim().length > 0 || dueAt.trim().length > 0 || type !== "puntual" || assignedTo !== "";

  function reset() {
    setTitle("");
    setDueAt("");
    setType("puntual");
    setAssignedTo("");
  }

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await api.createTask({ title: title.trim(), type, dueAt: dueAt || null, assignedTo: assignedTo || null });
      showToast("Tarea creada", "success");
      reset();
      onCreated();
      onClose();
    } catch {
      showToast("No se pudo crear la tarea", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      isDirty={isDirty}
      confirmCloseText="¿Cerrar y descartar la tarea?"
      title="Nueva tarea"
      maxWidth={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit} loading={saving}>
            Crear
          </Button>
        </>
      }
    >
      <ModalField label="Qué hay que hacer" required>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Llamar a Carlos"
          autoFocus
        />
      </ModalField>
      <ModalField label="Tipo" required>
        <Select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
          <option value="puntual">Puntual (se completa una sola vez)</option>
          <option value="rutina">Rutina (se reinicia diariamente)</option>
        </Select>
      </ModalField>
      {assignable.length >= 2 && (
        <ModalField label="Asignar a" hint="Opcional">
          <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Sin asignar</option>
            {assignable.map((m) => (
              <option key={m.id} value={m.userId ?? ""}>
                {m.userName ?? m.email}
              </option>
            ))}
          </Select>
        </ModalField>
      )}
      {type === "puntual" && (
        <ModalField label="Vencimiento" hint="Opcional">
          <DateTimePicker value={dueAt} onChange={setDueAt} placeholder="Elegir fecha y hora" />
        </ModalField>
      )}
    </Modal>
  );
}
