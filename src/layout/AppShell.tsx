import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar, type NewAction, type NotifNavigate } from './Topbar';
import { color } from '../tokens';
import { useIsMobile } from '../lib/useIsMobile';

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
}

/**
 * Composición del shell de la app.
 *
 * Layout: [Sidebar] [Topbar / Main / Drawer]
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
}: AppShellProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // En móvil, navegar cierra el drawer del sidebar.
  const handleNavigate = (id: string) => {
    onNavigate(id);
    if (isMobile) setNavOpen(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
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
          onMenuClick={isMobile ? () => setNavOpen(true) : undefined}
        />

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: isMobile ? 'var(--space-4)' : 'var(--space-6) var(--space-8)',
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
    </div>
  );
}
