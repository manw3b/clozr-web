import {
  Home,
  Users,
  GitBranch,
  ShoppingCart,
  CalendarDays,
  Wallet,
  Package,
  Wrench,
  CheckSquare,
  Settings,
  UsersRound,
  Receipt,
  BarChart3,
  ShieldCheck,
  ChevronLeft,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { color, duration, ease, layout, radius, space, text, weight } from '../tokens';
import { Avatar } from '../components/Avatar';
import { displayName } from '../lib/format';
import { usePermissions } from '../store/usePermissions';
import type { Permission } from '../lib/permissions';
const logoIsotipo = '/logo-isotipo.svg';
const logoHorizontal = '/logo-horizontal.svg';

export interface SidebarItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Si está, el item solo se muestra cuando el rol tiene este permiso. */
  perm?: Permission;
  /** Acento por módulo (ADN visual): color del ícono e item activo. */
  accent?: string;
  accentBg?: string;
}

// F.navigation:
//  - Reportes movido a Operaciones (la sección "Análisis" tenía 1 solo item)
//  - Equipo se queda como item directo del sidebar (más visible). La tab
//    "Equipo en la nube" de Ajustes se elimina para evitar redundancia.
const SECTIONS: { title?: string; items: SidebarItem[] }[] = [
  {
    items: [
      { id: 'home', label: 'Mi Día', icon: Home },
      { id: 'pipeline', label: 'Pipeline', icon: GitBranch, accent: 'var(--mod-pipeline)', accentBg: 'var(--mod-pipeline-bg)' },
      { id: 'customers', label: 'Clientes', icon: Users, accent: 'var(--mod-clientes)', accentBg: 'var(--mod-clientes-bg)' },
      { id: 'sales', label: 'Ventas', icon: ShoppingCart },
      { id: 'agenda', label: 'Agenda', icon: CalendarDays },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { id: 'cash', label: 'Caja', icon: Wallet, accent: 'var(--mod-caja)', accentBg: 'var(--mod-caja-bg)' },
      { id: 'deudas', label: 'Deudas', icon: Receipt },
      { id: 'inventory', label: 'Inventario', icon: Package, accent: 'var(--mod-inventario)', accentBg: 'var(--mod-inventario-bg)' },
      { id: 'repairs', label: 'Reparaciones', icon: Wrench, perm: 'repairs.write' },
      { id: 'tasks', label: 'Tareas', icon: CheckSquare },
      { id: 'reportes', label: 'Reportes', icon: BarChart3, perm: 'reports.view' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { id: 'team', label: 'Equipo', icon: UsersRound, perm: 'team.manage' },
      { id: 'settings', label: 'Ajustes', icon: Settings },
    ],
  },
  // Consola Clozr (super-admin de la plataforma). El item NO se gatea por
  // `perm` (que son permisos de workspace) sino que el caller lo agrega a
  // `hiddenNav` cuando el usuario no es super-admin. El acceso real lo
  // enforcea el Worker en /console/* — esto es solo visibilidad.
  {
    title: 'Plataforma',
    items: [
      { id: 'console', label: 'Consola', icon: ShieldCheck },
    ],
  },
];

interface SidebarProps {
  active: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  user: { name: string; email: string };
  onLogout?: () => void;
  /** En móvil el sidebar es un drawer off-canvas. */
  isMobile?: boolean;
  mobileOpen?: boolean;
  /** Ids de nav a ocultar por rol (ej. ['cash'] para no-managers). */
  hiddenNav?: string[];
}

export function Sidebar({ active, onNavigate, collapsed, onToggleCollapse, user, onLogout, isMobile = false, mobileOpen = false, hiddenNav = [] }: SidebarProps) {
  const { can } = usePermissions();
  const sections = SECTIONS
    .map((section) => ({
      ...section,
      // Filtra por permiso (Reportes/Equipo) y por hiddenNav (Caja para no-managers).
      items: section.items.filter((item) => (!item.perm || can(item.perm)) && !hiddenNav.includes(item.id)),
    }))
    .filter((section) => section.items.length > 0);
  // En móvil: drawer fijo que entra/sale; en desktop: columna normal.
  const mobileStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: 50,
    width: layout.sidebarW,
    maxWidth: '85vw',
    transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: `transform ${duration.slow} ${ease}`,
    boxShadow: mobileOpen ? '0 0 40px rgba(0,0,0,0.5)' : 'none',
  };
  return (
    <aside
      style={{
        width: collapsed ? layout.sidebarWCollapsed : layout.sidebarW,
        flexShrink: 0,
        background: color.surface,
        borderRight: `1px solid ${color.border}`,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        transition: `width ${duration.slow} ${ease}`,
        position: 'relative',
        ...(isMobile ? mobileStyle : null),
      }}
    >
      {/* Logo + collapse button — alineado con la altura del topbar */}
      <div
        style={{
          height: layout.topbarH,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? 0 : `0 ${space[5]}`,
          borderBottom: `1px solid ${color.border}`,
        }}
      >
        {collapsed ? (
          <button
            onClick={onToggleCollapse}
            aria-label="Expandir sidebar"
            title="Expandir (Cmd+B)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <ClozrLogo collapsed={collapsed} />
          </button>
        ) : (
          <ClozrLogo collapsed={collapsed} />
        )}
        {!collapsed && !isMobile && (
          <button
            onClick={onToggleCollapse}
            aria-label="Colapsar sidebar"
            title="Colapsar (Cmd+B)"
            className="sidebar-item"
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.sm,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: `${space[4]} ${collapsed ? space[2] : space[3]}`,
        }}
      >
        {sections.map((section, idx) => (
          <div key={idx} style={{ marginBottom: space[5] }}>
            {!collapsed && section.title && (
              <div
                style={{
                  fontSize: text.xs,
                  fontWeight: weight.semibold,
                  color: color.textDim,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  padding: `0 ${space[3]}`,
                  marginBottom: space[2],
                }}
              >
                {section.title}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  active={active === item.id}
                  collapsed={collapsed}
                  onClick={() => onNavigate(item.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div
        style={{
          padding: collapsed ? `${space[2]} 0` : space[3],
          borderTop: `1px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: space[2],
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        <div
          title={user.email}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[3],
            flex: 1,
            minWidth: 0,
            padding: collapsed ? 4 : `${space[2]} ${space[3]}`,
            borderRadius: radius.md,
          }}
        >
          <Avatar name={displayName(user)} size={collapsed ? 32 : 28} />
          {!collapsed && (
            <div style={{ minWidth: 0, textAlign: 'left' }}>
              <div
                style={{
                  fontSize: text.sm,
                  fontWeight: weight.semibold,
                  color: color.text,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName(user)}
              </div>
            </div>
          )}
        </div>
        {!collapsed && onLogout && (
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="sidebar-item danger"
            style={{
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              flexShrink: 0,
            }}
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </aside>
  );
}

function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: SidebarItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const accent = item.accent;
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`sidebar-nav${active ? ' active' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space[3],
        padding: collapsed ? `${space[2]} 0` : `${space[2]} ${space[3]}`,
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: radius.md,
        fontSize: text.sm,
        fontWeight: active ? weight.semibold : weight.medium,
        position: 'relative',
        textAlign: 'left',
        // Acento por módulo: activo toma el color del módulo (bg + texto).
        ...(active && accent ? { background: item.accentBg, color: accent } : {}),
      }}
    >
      {/* Indicator vertical para item activo */}
      {active && !collapsed && (
        <span
          style={{
            position: 'absolute',
            left: -3,
            top: 6,
            bottom: 6,
            width: 3,
            background: accent ?? color.primary,
            borderRadius: radius.full,
          }}
        />
      )}
      <Icon size={18} strokeWidth={2.2} style={{ flexShrink: 0, color: accent ?? undefined, opacity: accent && !active ? 0.8 : 1 }} />
      {!collapsed && (
        <>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.badge && item.badge > 0 && (
            <span
              style={{
                fontSize: text.xs,
                fontWeight: weight.bold,
                background: active ? (accent ?? color.primary) : color.surface2,
                color: active ? '#FFFFFF' : color.textMuted,
                padding: '1px 6px',
                borderRadius: radius.full,
                minWidth: 18,
                textAlign: 'center',
              }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

/* ===== Logo Clozr (inline SVG, sin dependencia de archivo) ===== */
function ClozrLogo({ collapsed }: { collapsed: boolean }) {
  // Cuando está expandido, sólo wordmark — el isotipo + texto al lado era
  // doble branding redundante para una pantalla interna. Cuando está
  // colapsado, sólo isotipo (no hay espacio para texto).
  if (collapsed) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color.primary,
        }}
      >
        <IsotipoSVG size={28} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoHorizontal} alt="Clozr" style={{ height: 26, width: "auto", display: "block" }} />
  );
}

// height fija + width auto: respeta el aspecto del isotipo (no es cuadrado).
function IsotipoSVG({ size = 26 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logoIsotipo} alt="Clozr" style={{ display: "block", height: size, width: "auto" }} />;
}
