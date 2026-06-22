import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Tabs } from "@/components/Tabs";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { DataTable, type ColumnDef } from "@/components/data-table";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuDivider,
  ContextMenuLabel,
  useContextMenu,
} from "@/components/ContextMenu";
import { confirmAsync } from "@/lib/confirmAsync";
import { useUIStore } from "@/store/uiStore";
import { usePermissions } from "@/store/usePermissions";
import { color, space, text, weight } from "@/tokens";
import * as api from "@/lib/api";
import type { Task, TaskType, Member } from "@/lib/types";
import { NewTaskModal } from "./NewTaskModal";

type FilterStatus = "todas" | "pendientes" | "completadas";
type FilterType = "todos" | TaskType;

/**
 * Vista Tareas — port web de clozr/src/pages/tareas/Tareas.tsx.
 * Misma UI (PageHeader + filtros + DataTable + context menu). Datos via
 * Worker (api.ts) en vez de SQLite + TanStack. Las tasks del AI Triage
 * (template_id='ai-triage') llevan badge "Sugerido por Clozr".
 */
export function Tareas() {
  const { showToast } = useUIStore();
  const { can } = usePermissions();
  const canWrite = can("tasks.write");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("pendientes");
  const [typeFilter, setTypeFilter] = useState<FilterType>("todos");
  const [openForm, setOpenForm] = useState(false);
  const ctxMenu = useContextMenu();
  const [ctxTask, setCtxTask] = useState<Task | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    api.listMembers().then(setMembers).catch(() => {});
  }, []);
  // Mapa user_id → nombre para mostrar el responsable de cada tarea.
  const memberName = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of members) if (x.userId) m.set(x.userId, x.userName ?? x.email);
    return m;
  }, [members]);
  // Solo mostramos la columna "Asignada a" si hay equipo (más de un miembro real).
  const hasTeam = members.filter((m) => m.userId).length >= 2;

  const load = useCallback(() => {
    setLoading(true);
    api
      .listTasks()
      .then(setTasks)
      .catch(() => showToast("No se pudieron cargar las tareas", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Atajo: abrir "Nueva tarea" desde el menú "Nuevo" del topbar.
  useEffect(() => {
    const handler = () => setOpenForm(true);
    window.addEventListener("clozr:open-new-task", handler);
    return () => window.removeEventListener("clozr:open-new-task", handler);
  }, []);

  async function toggle(t: Task) {
    const next = !t.completed;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: next } : x)));
    try {
      await api.setTaskCompleted(t.id, next);
    } catch {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, completed: !next } : x)));
      showToast("No se pudo actualizar", "error");
    }
  }

  async function remove(t: Task) {
    const ok = await confirmAsync({
      message: `¿Eliminar la tarea "${t.title}"?`,
      tone: "danger",
      confirmText: "Eliminar",
    });
    if (!ok) return;
    const snapshot = tasks;
    setTasks((prev) => prev.filter((x) => x.id !== t.id));
    try {
      await api.deleteTask(t.id);
      showToast("Tarea eliminada", "success");
    } catch {
      setTasks(snapshot);
      showToast("No se pudo eliminar", "error");
    }
  }

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === "pendientes" && t.completed) return false;
      if (statusFilter === "completadas" && !t.completed) return false;
      if (typeFilter !== "todos" && t.type !== typeFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, typeFilter]);

  const columns: ColumnDef<Task>[] = [
    {
      id: "completed",
      header: "",
      width: "44px",
      cell: (t) => (
        <button
          disabled={!canWrite}
          onClick={(e) => {
            e.stopPropagation();
            if (canWrite) toggle(t);
          }}
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            border: `1.5px solid ${t.completed ? color.success : color.borderStrong}`,
            background: t.completed ? color.success : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: canWrite ? "pointer" : "default",
          }}
        >
          {t.completed && <Check size={12} color="#fff" strokeWidth={3} />}
        </button>
      ),
    },
    {
      id: "title",
      header: "Tarea",
      sortable: true,
      width: "minmax(280px, 1.5fr)",
      cell: (t) => (
        <span style={{ display: "inline-flex", alignItems: "center", gap: space[2] }}>
          <span
            style={{
              fontSize: text.sm,
              fontWeight: weight.medium,
              color: t.completed ? color.textDim : color.text,
              textDecoration: t.completed ? "line-through" : "none",
            }}
          >
            {t.title}
          </span>
          {t.templateId === "ai-triage" && (
            <Badge tone="primary" variant="soft" size="sm">
              Sugerido por Clozr
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "type",
      header: "Tipo",
      sortable: true,
      width: "120px",
      cell: (t) => (
        <Badge tone={t.type === "rutina" ? "info" : "neutral"}>
          {t.type === "rutina" ? "Rutina" : "Puntual"}
        </Badge>
      ),
    },
    ...(hasTeam
      ? ([
          {
            id: "assigned",
            header: "Asignada a",
            width: "160px",
            cell: (t: Task) =>
              t.assignedTo ? (
                <span style={{ fontSize: text.sm, color: color.textMuted }}>
                  {memberName.get(t.assignedTo) ?? "Otro miembro"}
                </span>
              ) : (
                <span style={{ color: color.textDim }}>—</span>
              ),
          },
        ] as ColumnDef<Task>[])
      : []),
    {
      id: "due_at",
      header: "Vence",
      sortable: true,
      width: "140px",
      cell: (t) =>
        t.dueAt ? (
          <span style={{ fontSize: text.sm, color: color.textMuted }}>
            {new Date(t.dueAt).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
          </span>
        ) : (
          <span style={{ color: color.textDim }}>—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      width: "60px",
      cell: (t) =>
        canWrite ? (
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<Trash2 size={13} />}
            onClick={(e) => {
              e.stopPropagation();
              remove(t);
            }}
          />
        ) : null,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[5], height: "100%" }}>
      <PageHeader
        title="Tareas"
        subtitle={loading ? "Cargando…" : `${filtered.length} de ${tasks.length}`}
        actions={
          canWrite ? (
            <Button variant="primary" iconLeft={<Plus size={16} />} onClick={() => setOpenForm(true)}>
              Nueva tarea
            </Button>
          ) : undefined
        }
      />

      <div style={{ display: "flex", gap: space[3], flexWrap: "wrap" }}>
        <Tabs
          variant="pills"
          size="sm"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as FilterStatus)}
          items={[
            { value: "pendientes", label: "Pendientes" },
            { value: "completadas", label: "Completadas" },
            { value: "todas", label: "Todas" },
          ]}
        />
        <div style={{ flex: 1 }} />
        <Tabs
          variant="pills"
          size="sm"
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as FilterType)}
          items={[
            { value: "todos", label: "Todos los tipos" },
            { value: "puntual", label: "Puntuales" },
            { value: "rutina", label: "Rutinas" },
          ]}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <DataTable<Task>
          rows={filtered}
          columns={columns}
          getRowId={(t) => t.id}
          onRowContextMenu={(t, e) => {
            setCtxTask(t);
            ctxMenu.openAt(e);
          }}
          density="normal"
          empty={
            <EmptyState
              title={tasks.length === 0 ? "Sin tareas" : "Nada para mostrar con esos filtros"}
              description={
                tasks.length === 0
                  ? "Creá una tarea para no olvidarte nada."
                  : "Probá cambiar los filtros."
              }
              action={
                tasks.length === 0 && canWrite
                  ? { label: "Nueva tarea", onClick: () => setOpenForm(true), iconLeft: <Plus size={14} /> }
                  : undefined
              }
            />
          }
        />
      </div>

      <NewTaskModal open={openForm} onClose={() => setOpenForm(false)} onCreated={load} />

      {canWrite && ctxMenu.open && ctxTask && (
        <ContextMenu position={ctxMenu.position} onClose={ctxMenu.close}>
          <ContextMenuLabel>{ctxTask.title}</ContextMenuLabel>
          <ContextMenuItem
            icon={<Check size={14} />}
            onClick={() => {
              toggle(ctxTask);
              ctxMenu.close();
            }}
          >
            {ctxTask.completed ? "Marcar pendiente" : "Marcar completada"}
          </ContextMenuItem>
          <ContextMenuDivider />
          <ContextMenuItem
            tone="danger"
            icon={<Trash2 size={14} />}
            onClick={() => {
              const t = ctxTask;
              ctxMenu.close();
              remove(t);
            }}
          >
            Eliminar
          </ContextMenuItem>
        </ContextMenu>
      )}
    </div>
  );
}
