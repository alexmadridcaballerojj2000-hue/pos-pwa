import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Clock,
  Boxes,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { useTheme } from './theme-context';
import { cn } from './lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Venta', icon: ShoppingCart },
  { to: '/catalog', label: 'Catálogo', icon: Package },
  { to: '/shifts', label: 'Turnos', icon: Clock },
  { to: '/inventory', label: 'Inventario', icon: Boxes },
  { to: '/reports', label: 'Reportes', icon: BarChart3 },
  { to: '/settings', label: 'Ajustes', icon: Settings },
];

export function Layout() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Laptop;

  return (
    <div className="flex h-screen w-full flex-col md:flex-row overflow-hidden bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-card shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
              POS
            </div>
            <span className="font-semibold text-lg tracking-tight">PWA POS</span>
          </div>
          <button
            type="button"
            onClick={cycleTheme}
            aria-label="Cambiar tema"
            className="flex h-12 w-12 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ThemeIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium min-h-[48px] transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t text-xs text-muted-foreground flex justify-between items-center">
          <span>Modo: Local</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">v0.1.0</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Top Header */}
        <header className="flex md:hidden h-14 items-center justify-between px-4 border-b bg-card">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold text-sm">
              P
            </div>
            <span className="font-semibold text-base">POS PWA</span>
          </div>
          <button
            type="button"
            onClick={cycleTheme}
            aria-label="Cambiar tema"
            className="flex h-12 w-12 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ThemeIcon className="h-5 w-5" />
          </button>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6" role="main">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          className="flex md:hidden fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur z-30"
          aria-label="Navegación móvil"
        >
          <div className="flex w-full justify-around items-center h-16">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex flex-col items-center justify-center flex-1 h-full min-h-[48px] min-w-[48px] text-[11px] font-medium transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  <Icon className="h-5 w-5 mb-0.5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
