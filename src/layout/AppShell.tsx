import { ReactNode, useState, type CSSProperties } from 'react';
import { Home, ShoppingCart, Plus, CalendarDays, Menu as MenuIcon, Users, GitBranch, CheckSquare, Wallet, type LucideIcon } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar, type NewAction, type NotifNavigate } from './Topbar';
import { color, radius, space, text, weight } from '../tokens';
import { useIsMobile } from '../lib/useIsMobile';
import { usePermissions } from '../store/usePermissions';
import type { Permission } from '../lib/permissions';

interface AppShellProps {
  active: string;
  onNavigate: (id: string) => void;
  workspace: { name: string; emoji?: string };
  user: { name: string; email: string };
  onSearchClick?: () => void;
  onNewAction?: (action: NewAction) => void;
  onNotificationClick?: (screen: NotifNavigate) => void;
  onLogout?: () => void;
  children: ReactNode;
  /** Right drawer opcional. Cuando se pasa, se renderiza al costado derecho. */
  drawer?: ReactNode;
  /** Ids de nav a ocultar según rol (ej. ['cash'] para no-managers). */
  hiddenNav?: string[];
}

/**
 * Composición del shell de la app.
 *
 * Desktop: [Sidebar] [Topbar / Main / Drawer].
 * Mobile:  [Topbar / Main] + bottom-nav (Mi Día · Ventas · ➕ · Agenda · Menú).
 *          "Menú" abre el drawer del Sidebar (resto de módulos); el ➕ abre un
 *          action-sheet con las acciones de creación.
 */
export function AppShell({
  active,
  onNavigate,
  workspace,
  user,
  onSearchClick = () => {},
  onNewAction = () => {},
  onNotificationClick = () => {},
  onLogout,
  children,
  drawer,
  hiddenNav,
}: AppShellProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [newSheet, setNewSheet] = useState(false);

  // En móvil, navegar cierra el drawer del sidebar.
  const handleNavigate = (id: string) => {
    onNavigate(id);
    if (isMobile) setNavOpen(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100dvh',
        background: color.bg,
        color: color.text,
        overflow: 'hidden',
      }}
    >
      <Sidebar
        active={active}
        onNavigate={handleNavigate}
        collapsed={!isMobile && collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        user={user}
        onLogout={onLogout}
        hiddenNav={hiddenNav}
        isMobile={isMobile}
        mobileOpen={navOpen}
      />

      {/* Backdrop del drawer móvil */}
      {isMobile && navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          aria-hidden
          style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', zIndex: 40 }}
        />
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        <Topbar
          workspace={workspace}
          onSearchClick={onSearchClick}
          onNewAction={onNewAction}
          onNotificationClick={onNotificationClick}
          onMenuClick={undefined}
        />

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: isMobile ? 'var(--space-4)' : 'var(--space-6) var(--space-8)',
              // El bottom-nav (mobile) es position:fixed y mide
              // 64px + safe-area-inset-bottom; el padding lo iguala (+24px de
              // aire) para que el último item no quede tapado tras la barra.
              paddingBottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom) + 24px)' : undefined,
              minWidth: 0,
            }}
          >
            {children}
          </main>

          {drawer && (
            <aside
              style={{
                width: isMobile ? '100%' : 'var(--drawer-w)',
                flexShrink: 0,
                background: color.surface,
                borderLeft: `1px solid ${color.border}`,
                overflowY: 'auto',
              }}
            >
              {drawer}
            </aside>
          )}
        </div>
      </div>

      {isMobile && (
        <BottomNav
          active={active}
          onNavigate={handleNavigate}
          onNew={() => setNewSheet(true)}
          onMenu={() => setNavOpen(true)}
        />
      )}
      {isMobile && newSheet && (
        <NewActionSheet onAction={onNewAction} onClose={() => setNewSheet(false)} />
      )}
    </div>
  );
}

/* ───────── Bottom nav (solo mobile) ───────── */

function BottomNav({ active, onNavigate, onNew, onMenu }: {
  active: string;
  onNavigate: (id: string) => void;
  onNew: () => void;
  onMenu: () => void;
}) {
  const menuActive = !['home', 'sales', 'agenda'].includes(active);
  const cell = (selected: boolean): CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    padding: `${space[1]} 0`,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: selected ? color.primary : color.textMuted,
    fontSize: 10,
    fontWeight: weight.medium,
  });
  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        background: color.surface,
        borderTop: `1px solid ${color.border}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <button style={cell(active === 'home')} onClick={() => onNavigate('home')} aria-label="Mi Día">
        <Home size={20} /><span>Mi Día</span>
      </button>
      <button style={cell(active === 'sales')} onClick={() => onNavigate('sales')} aria-label="Ventas">
        <ShoppingCart size={20} /><span>Ventas</span>
      </button>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={onNew}
          aria-label="Nuevo"
          style={{
            width: 52,
            height: 52,
            marginTop: -22,
            borderRadius: '50%',
            background: color.primary,
            color: '#fff',
            border: `3px solid ${color.bg}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
            cursor: 'pointer',
          }}
        >
          <Plus size={24} />
        </button>
      </div>
      <button style={cell(active === 'agenda')} onClick={() => onNavigate('agenda')} aria-label="Agenda">
        <CalendarDays size={20} /><span>Agenda</span>
      </button>
      <button style={cell(menuActive)} onClick={onMenu} aria-label="Menú">
        <MenuIcon size={20} /><span>Menú</span>
      </button>
    </nav>
  );
}

/* ───────── Action sheet del ➕ (solo mobile) ───────── */

const SHEET_ACTIONS: Array<{ id: NewAction; label: string; Icon: LucideIcon; perm: Permission }> = [
  { id: 'venta', label: 'Nueva venta', Icon: ShoppingCart, perm: 'sales.write' },
  { id: 'cliente', label: 'Nuevo cliente', Icon: Users, perm: 'customers.write' },
  { id: 'lead', label: 'Nuevo lead', Icon: GitBranch, perm: 'pipeline.write' },
  { id: 'tarea', label: 'Nueva tarea', Icon: CheckSquare, perm: 'tasks.write' },
  { id: 'movimiento', label: 'Movimiento de caja', Icon: Wallet, perm: 'cash.write' },
];

function NewActionSheet({ onAction, onClose }: { onAction: (a: NewAction) => void; onClose: () => void }) {
  const { can } = usePermissions();
  const items = SHEET_ACTIONS.filter((a) => can(a.perm));
  return (
    <>
      <div onClick={onClose} aria-hidden style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', zIndex: 45 }} />
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 46,
          background: color.surface,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderTop: `1px solid ${color.border}`,
          padding: space[3],
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: color.border, margin: '4px auto 12px' }} />
        {items.length === 0 ? (
          <div style={{ padding: space[4], textAlign: 'center', fontSize: text.sm, color: color.textMuted }}>
            No tenés acciones disponibles.
          </div>
        ) : (
          items.map((a) => (
            <button
              key={a.id}
              onClick={() => { onAction(a.id); onClose(); }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: space[3],
                padding: space[3],
                background: 'none',
                border: 'none',
                borderRadius: radius.md,
                color: color.text,
                fontSize: text.sm,
                fontWeight: weight.medium,
                cursor: 'pointer',
              }}
            >
              <a.Icon size={20} color={color.primary} /> {a.label}
            </button>
          ))
        )}
      </div>
    </>
  );
}
