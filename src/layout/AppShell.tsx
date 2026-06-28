import { ReactNode, useState, type CSSProperties } from 'react';
import { Home, ShoppingCart, Plus, CalendarDays, Sparkles, User, Users, GitBranch, CheckSquare, Wallet, ChevronRight, Package, Wrench, X, type LucideIcon } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar, ACTION_TINT, type NewAction, type NotifNavigate } from './Topbar';
import { color, radius, shadow, space, text, weight } from '../tokens';
import { useIsMobile } from '../lib/useIsMobile';
import { usePermissions } from '../store/usePermissions';
import { useAiStore } from '../store/aiStore';
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
          onAssistant={() => useAiStore.getState().openAi()}
        />
      )}
      {isMobile && newSheet && (
        <NewActionSheet onAction={onNewAction} onClose={() => setNewSheet(false)} />
      )}
    </div>
  );
}

/* ───────── Bottom nav (solo mobile) ───────── */

function BottomNav({ active, onNavigate, onNew, onMenu, onAssistant }: {
  active: string;
  onNavigate: (id: string) => void;
  onNew: () => void;
  onMenu: () => void;
  onAssistant: () => void;
}) {
  // "Perfil" (drawer) queda activo cuando no estás en Inicio ni Agenda — el resto
  // de los módulos se llega desde ahí. "Asistente" abre un drawer, no es una vista.
  const menuActive = !['home', 'agenda'].includes(active);
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
      <button style={cell(active === 'home')} onClick={() => onNavigate('home')} aria-label="Inicio">
        <Home size={20} /><span>Inicio</span>
      </button>
      <button style={cell(false)} onClick={onAssistant} aria-label="Asistente">
        <Sparkles size={20} /><span>Asistente</span>
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
      <button style={cell(menuActive)} onClick={onMenu} aria-label="Perfil">
        <User size={20} /><span>Perfil</span>
      </button>
    </nav>
  );
}

/* ───────── Action sheet del ➕ (solo mobile) ───────── */

const SHEET_ACTIONS: Array<{ id: NewAction; label: string; short: string; desc: string; Icon: LucideIcon; perm: Permission }> = [
  { id: 'venta', label: 'Nueva venta', short: 'Venta', desc: 'Registrá una venta y cobrá', Icon: ShoppingCart, perm: 'sales.write' },
  { id: 'cliente', label: 'Nuevo cliente', short: 'Cliente', desc: 'Sumá un cliente al CRM', Icon: Users, perm: 'customers.write' },
  { id: 'lead', label: 'Nuevo lead', short: 'Lead', desc: 'Una oportunidad al pipeline', Icon: GitBranch, perm: 'pipeline.write' },
  { id: 'turno', label: 'Nuevo turno', short: 'Turno', desc: 'Agendá una cita', Icon: CalendarDays, perm: 'sales.write' },
  { id: 'tarea', label: 'Nueva tarea', short: 'Tarea', desc: 'Un pendiente para seguir', Icon: CheckSquare, perm: 'tasks.write' },
  { id: 'producto', label: 'Nuevo producto', short: 'Producto', desc: 'Cargá stock al catálogo', Icon: Package, perm: 'inventory.write' },
  { id: 'reparacion', label: 'Nueva reparación', short: 'Reparación', desc: 'Orden de taller', Icon: Wrench, perm: 'repairs.write' },
  { id: 'movimiento', label: 'Movimiento de caja', short: 'Caja', desc: 'Ingreso o egreso', Icon: Wallet, perm: 'cash.write' },
];

function NewActionSheet({ onAction, onClose }: { onAction: (a: NewAction) => void; onClose: () => void }) {
  const { can } = usePermissions();
  const items = SHEET_ACTIONS.filter((a) => can(a.perm));
  // "Nueva venta" es la acción estrella (lo más usado): va de hero arriba y el
  // resto en grid 2×2. Si el rol no puede vender, el hero es la primera que sí.
  const hero = items.find((a) => a.id === 'venta') ?? items[0];
  const rest = items.filter((a) => a !== hero);
  const pick = (id: NewAction) => {
    onAction(id);
    onClose();
  };

  return (
    <>
      <div onClick={onClose} aria-hidden className="fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', zIndex: 45 }} />
      <div
        role="dialog"
        aria-label="Crear"
        className="cz-sheet-up"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 46,
          background: color.surface,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          borderTop: `1px solid ${color.border}`,
          boxShadow: shadow.lg,
          padding: space[4],
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: radius.full, background: color.border, margin: '0 auto 14px' }} />

        {items.length === 0 ? (
          <div style={{ padding: space[4], textAlign: 'center', fontSize: text.sm, color: color.textMuted }}>
            No tenés acciones disponibles.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3], margin: `0 2px ${space[3]}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: text.lg, fontWeight: weight.bold, color: color.text }}>Acciones rápidas</div>
                <div style={{ fontSize: text.sm, color: color.textMuted, marginTop: 1 }}>¿Qué querés hacer hoy?</div>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.full,
                  background: color.surface2,
                  color: color.textMuted,
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {hero && (
              <button
                onClick={() => pick(hero.id)}
                className="cz-sheet-cta"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[3],
                  padding: space[3],
                  marginBottom: space[2],
                  background: color.primaryBg,
                  border: `1px solid ${color.primary}`,
                  borderRadius: radius.lg,
                  color: color.text,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.md,
                    background: color.primary,
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <hero.Icon size={22} strokeWidth={2.2} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: text.base, fontWeight: weight.semibold, color: color.text }}>
                    {hero.label}
                  </span>
                  <span style={{ display: 'block', fontSize: text.xs, color: color.textMuted, marginTop: 1 }}>
                    {hero.desc}
                  </span>
                </span>
                <ChevronRight size={18} color={color.primary} strokeWidth={2.4} style={{ flexShrink: 0 }} />
              </button>
            )}

            {rest.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space[2] }}>
                {rest.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => pick(a.id)}
                    className="cz-sheet-tile"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: space[2],
                      padding: space[3],
                      minHeight: 92,
                      background: color.surface2,
                      border: `1px solid ${color.border}`,
                      borderRadius: radius.lg,
                      color: color.text,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: radius.md,
                          background: `${ACTION_TINT[a.id]}22`,
                          color: ACTION_TINT[a.id],
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <a.Icon size={19} strokeWidth={2.2} />
                      </span>
                      <span
                        aria-hidden
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: radius.full,
                          background: color.surface,
                          color: color.textDim,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Plus size={13} strokeWidth={2.4} />
                      </span>
                    </div>
                    <span style={{ display: 'block', minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: text.sm, fontWeight: weight.semibold, color: color.text }}>{a.short}</span>
                      <span style={{ display: 'block', fontSize: text.xs, color: color.textMuted, marginTop: 1, lineHeight: 1.3 }}>{a.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
