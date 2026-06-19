import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  ChevronDown,
  Bell,
  AlertCircle,
  Clock,
  Command,
  Users,
  ShoppingCart,
  GitBranch,
  CheckSquare,
  Wallet,
  Check,
} from 'lucide-react';
import { color, radius, space, text, weight } from '../tokens';
import { Button } from '../components/Button';
import { Modal, ModalField } from '../components/Modal';
import { Input } from '../components/Input';
import { useWorkspaceStore } from '../store/workspaceStore';
import { useUIStore } from '../store/uiStore';
import { DollarChip } from './DollarChip';
import * as api from '../lib/api';
import { formatMoney } from '../lib/format';
import type { Sale, Task } from '../lib/types';

export type NewAction = 'cliente' | 'venta' | 'lead' | 'tarea' | 'movimiento';
export type NotifNavigate = 'tasks' | 'cash' | 'pipeline' | 'deudas';

/**
 * Versión web del Topbar del desktop. Misma estructura visual (switcher a la
 * izquierda, búsqueda al centro, notificaciones + "Nuevo" a la derecha). En la
 * web la unidad es el WORKSPACE (no "business"), así que el switcher lista
 * workspaces vía workspaceStore. El chip de cotización (dólar), las
 * notificaciones reales y el ícono de rubro/logo se conectan en Fase 3
 * cuando aterrice su capa de datos.
 */
interface TopbarProps {
  workspace: { name: string; emoji?: string };
  onSearchClick: () => void;
  onNewAction: (action: NewAction) => void;
  onNotificationClick: (screen: NotifNavigate) => void;
}

export function Topbar({ onSearchClick, onNewAction, onNotificationClick }: TopbarProps) {
  return (
    <header
      style={{
        height: 'var(--topbar-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[4],
        padding: `0 ${space[5]}`,
        background: color.surface,
        borderBottom: `1px solid ${color.border}`,
        flexShrink: 0,
      }}
    >
      {/* IZQUIERDA — Workspace switcher + cotización */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
        <WorkspaceSwitcher />
        <span
          style={{ width: 1, height: 22, background: color.border, display: 'inline-block' }}
          aria-hidden
        />
        <DollarChip />
      </div>

      {/* CENTRO — Búsqueda global */}
      <SearchTrigger onClick={onSearchClick} />

      {/* DERECHA — Acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
        <NotificationsMenu onNavigate={onNotificationClick} />
        <NewMenu onAction={onNewAction} />
      </div>
    </header>
  );
}

/* ===== Notifications dropdown (datos reales: tareas vencidas + cobros) ===== */

interface NotifItem {
  id: string;
  kind: 'task' | 'collection';
  title: string;
  subtitle: string;
  screen: NotifNavigate;
}

function NotificationsMenu({ onNavigate }: { onNavigate: (s: NotifNavigate) => void }) {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    api.listTasks().then(setTasks).catch(() => {});
    api.listSales().then(setSales).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const items = useMemo<NotifItem[]>(() => {
    const now = Date.now();
    const out: NotifItem[] = [];
    const pending = sales.filter((s) => !s.isPaid && s.balance > 0);
    if (pending.length > 0) {
      const total = pending.reduce((s, v) => s + v.balance, 0);
      out.push({
        id: 'collections',
        kind: 'collection',
        title: `${pending.length} cobro${pending.length === 1 ? '' : 's'} pendiente${pending.length === 1 ? '' : 's'}`,
        subtitle: `${formatMoney(total)} por cobrar`,
        screen: 'deudas',
      });
    }
    for (const t of tasks) {
      if (!t.completed && t.dueAt && new Date(t.dueAt).getTime() < now) {
        out.push({ id: `task-${t.id}`, kind: 'task', title: t.title, subtitle: 'Tarea vencida', screen: 'tasks' });
      }
    }
    return out;
  }, [tasks, sales]);
  const total = items.length;

  useEffect(() => {
    if (!open) return;
    refresh();
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, refresh]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <IconButton aria-label="Notificaciones" badge={total} onClick={() => setOpen((v) => !v)}>
        <Bell size={16} />
      </IconButton>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: 360,
            maxHeight: 480,
            background: color.surface,
            border: `1px solid ${color.borderStrong}`,
            borderRadius: radius.md,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 50,
          }}
        >
          <header
            style={{
              padding: `${space[3]} ${space[4]}`,
              borderBottom: `1px solid ${color.border}`,
              fontSize: text.sm,
              fontWeight: weight.semibold,
              color: color.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span>Notificaciones</span>
            <span style={{ fontSize: text.xs, color: color.textMuted, fontWeight: weight.medium }}>
              {total === 0 ? 'Todo al día' : `${total} pendiente${total === 1 ? '' : 's'}`}
            </span>
          </header>
          {total === 0 ? (
            <div style={{ padding: `${space[8]} ${space[4]}`, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: space[2] }}>✨</div>
              <p style={{ margin: 0, fontSize: text.sm, color: color.textMuted }}>
                No tenés tareas vencidas ni cobros atrasados.
              </p>
            </div>
          ) : (
            <div style={{ overflowY: 'auto' }}>
              {items.map((item) => {
                const Icon = item.kind === 'collection' ? AlertCircle : CheckSquare;
                const accent = item.kind === 'collection' ? color.danger : color.warning;
                return (
                  <button
                    key={item.id}
                    className="row-hover"
                    onClick={() => {
                      setOpen(false);
                      onNavigate(item.screen);
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: `${space[3]} ${space[4]}`,
                      borderBottom: `1px solid ${color.border}`,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: space[3],
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: radius.sm,
                        background: color.surface2,
                        color: accent,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={14} strokeWidth={2.2} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: text.sm,
                          fontWeight: weight.medium,
                          color: color.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.title}
                      </div>
                      <div style={{ fontSize: text.xs, color: color.textMuted, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> {item.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ===== "Nuevo" dropdown menu ===== */

const NEW_ITEMS: Array<{ id: NewAction; label: string; shortcut: string; Icon: typeof Users }> = [
  { id: 'cliente', label: 'Cliente', shortcut: 'C', Icon: Users },
  { id: 'venta', label: 'Venta', shortcut: 'V', Icon: ShoppingCart },
  { id: 'lead', label: 'Lead', shortcut: 'L', Icon: GitBranch },
  { id: 'tarea', label: 'Tarea', shortcut: 'T', Icon: CheckSquare },
  { id: 'movimiento', label: 'Movimiento de caja', shortcut: 'M', Icon: Wallet },
];

function NewMenu({ onAction }: { onAction: (a: NewAction) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onClickOutside);
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('mousedown', onClickOutside);
        document.removeEventListener('keydown', onKey);
      };
    }
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <Button variant="primary" size="md" iconLeft={<Plus size={16} />} onClick={() => setOpen((v) => !v)}>
        Nuevo
      </Button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 220,
            background: color.surface,
            border: `1px solid ${color.borderStrong}`,
            borderRadius: radius.md,
            boxShadow: 'var(--shadow-lg)',
            padding: 4,
            zIndex: 50,
          }}
        >
          {NEW_ITEMS.map((item) => (
            <NewMenuItem
              key={item.id}
              label={item.label}
              shortcut={item.shortcut}
              Icon={item.Icon}
              onClick={() => {
                setOpen(false);
                onAction(item.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NewMenuItem({
  label,
  shortcut,
  Icon,
  onClick,
}: {
  label: string;
  shortcut: string;
  Icon: typeof Users;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="row-hover"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[2],
        width: '100%',
        padding: `${space[2]} ${space[3]}`,
        borderRadius: radius.sm,
        color: color.text,
        fontSize: text.sm,
        textAlign: 'left',
      }}
    >
      <Icon size={14} color={color.textMuted} strokeWidth={2.2} />
      <span style={{ flex: 1 }}>{label}</span>
      <kbd
        style={{
          fontSize: 11,
          fontWeight: weight.medium,
          color: color.textMuted,
          padding: '1px 5px',
          background: color.bg,
          border: `1px solid ${color.border}`,
          borderRadius: radius.sm,
          fontFamily: 'inherit',
        }}
      >
        {shortcut}
      </kbd>
    </button>
  );
}

/* ===== Workspace switcher (dropdown + crear nuevo) ===== */

function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspaceStore();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('mousedown', onClickOutside);
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('mousedown', onClickOutside);
        document.removeEventListener('keydown', onKey);
      };
    }
  }, [open]);

  const displayName = activeWorkspace?.name ?? 'Sin negocio';

  return (
    <>
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`btn-bordered${open ? ' active' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[2],
            padding: `6px ${space[3]} 6px 6px`,
            borderRadius: radius.md,
            background: 'transparent',
            border: `1px solid ${color.border}`,
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: radius.sm,
              background: color.surface2,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {activeWorkspace?.logoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={api.assetUrl(activeWorkspace.logoKey)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              '🏪'
            )}
          </span>
          <span
            style={{
              fontSize: text.sm,
              fontWeight: weight.semibold,
              color: color.text,
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </span>
          <ChevronDown size={14} color={color.textDim} strokeWidth={2.2} />
        </button>

        {open && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: 260,
              background: color.surface,
              border: `1px solid ${color.borderStrong}`,
              borderRadius: radius.md,
              boxShadow: 'var(--shadow-lg)',
              padding: 4,
              zIndex: 50,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: weight.semibold,
                color: color.textDim,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                padding: `${space[2]} ${space[3]} 4px`,
              }}
            >
              Espacios de trabajo
            </div>

            {workspaces.length === 0 ? (
              <div style={{ padding: `${space[2]} ${space[3]}`, fontSize: text.sm, color: color.textMuted }}>
                Sin espacios todavía.
              </div>
            ) : (
              workspaces.map((w) => (
                <WorkspaceRow
                  key={w.id}
                  name={w.name}
                  logoKey={w.logoKey}
                  active={activeWorkspace?.id === w.id}
                  onClick={() => {
                    setActiveWorkspace(w);
                    setOpen(false);
                  }}
                />
              ))
            )}

            <div style={{ height: 1, background: color.border, margin: `${space[1]} 0` }} />

            <button
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="row-hover"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[2],
                width: '100%',
                padding: `${space[2]} ${space[3]}`,
                borderRadius: radius.sm,
                color: color.text,
                fontSize: text.sm,
                textAlign: 'left',
              }}
            >
              <Plus size={14} color={color.textMuted} strokeWidth={2.2} />
              <span>Nuevo espacio</span>
            </button>
          </div>
        )}
      </div>

      <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function WorkspaceRow({
  name,
  logoKey,
  active,
  onClick,
}: {
  name: string;
  logoKey?: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="row-hover"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        width: '100%',
        padding: `${space[2]} ${space[3]}`,
        borderRadius: radius.sm,
        color: color.text,
        fontSize: text.sm,
        textAlign: 'left',
        position: 'relative',
        background: active ? `${color.primary}10` : undefined,
      }}
    >
      {active && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 2,
            top: 6,
            bottom: 6,
            width: 3,
            background: color.primary,
            borderRadius: radius.full,
          }}
        />
      )}
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.sm,
          background: color.surface2,
          border: `1px solid ${color.border}`,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          overflow: 'hidden',
        }}
      >
        {logoKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={api.assetUrl(logoKey)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          '🏪'
        )}
      </span>
      <span
        style={{
          flex: 1,
          fontWeight: active ? weight.semibold : weight.medium,
          color: active ? color.text : color.textMuted,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      {active && <Check size={14} color={color.primary} strokeWidth={2.4} />}
    </button>
  );
}

function CreateWorkspaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const { showToast } = useUIStore();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => setName('');

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const w = await createWorkspace(name.trim());
      showToast(`Espacio "${w.name}" creado`, 'success');
      reset();
      onClose();
    } catch {
      showToast('No se pudo crear el espacio', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      isDirty={() => name.trim().length > 0}
      confirmCloseText="¿Cerrar y descartar el espacio?"
      title="Nuevo espacio de trabajo"
      subtitle="Cada espacio tiene sus propios clientes, ventas y reportes."
      maxWidth={460}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!name.trim()}>
            Crear
          </Button>
        </>
      }
    >
      <ModalField label="Nombre">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Mi negocio"
          autoFocus
        />
      </ModalField>
    </Modal>
  );
}

/* ===== Search global trigger (Cmd+K) ===== */

function SearchTrigger({ onClick }: { onClick: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClick();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClick]);

  return (
    <button
      onClick={onClick}
      className="btn-bordered"
      style={{
        flex: 1,
        maxWidth: 480,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        gap: space[2],
        padding: `0 ${space[3]}`,
        background: color.surface2,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        color: color.textDim,
        fontSize: text.sm,
        textAlign: 'left',
      }}
    >
      <Search size={15} strokeWidth={2.2} />
      <span style={{ flex: 1 }}>Buscar clientes, ventas, productos…</span>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          padding: '2px 5px',
          background: color.bg,
          border: `1px solid ${color.border}`,
          borderRadius: radius.sm,
          fontSize: text.xs,
          color: color.textMuted,
          fontWeight: weight.medium,
        }}
      >
        <Command size={10} strokeWidth={2.5} />K
      </span>
    </button>
  );
}

/* ===== Icon button con badge opcional ===== */

function IconButton({
  children,
  badge,
  onClick,
  ...rest
}: {
  children: React.ReactNode;
  badge?: number;
  onClick?: () => void;
  'aria-label': string;
}) {
  return (
    <button
      onClick={onClick}
      className="btn-icon muted"
      style={{
        position: 'relative',
        width: 36,
        height: 36,
        borderRadius: radius.md,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      {...rest}
    >
      {children}
      {typeof badge === 'number' && badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            minWidth: 14,
            height: 14,
            padding: '0 4px',
            background: color.primary,
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: weight.bold,
            borderRadius: radius.full,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${color.surface}`,
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
