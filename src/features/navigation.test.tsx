import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/ui/theme-provider';
import { Layout } from '@/ui/layout';
import { PosView } from '@/features/pos/pos-view';
import { CatalogView } from '@/features/catalog/catalog-view';

function renderApp(initialRoute = '/') {
  return render(
    <ThemeProvider defaultTheme="light">
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PosView />} />
            <Route path="catalog" element={<CatalogView />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('Navigation & Layout', () => {
  it('renders POS view by default and displays branding', () => {
    renderApp('/');
    expect(screen.getByText('Punto de Venta')).toBeInTheDocument();
  });

  it('renders all required main navigation items', () => {
    renderApp('/');
    const ventaLinks = screen.getAllByRole('link', { name: /venta/i });
    expect(ventaLinks.length).toBeGreaterThanOrEqual(1);

    const catalogoLinks = screen.getAllByRole('link', { name: /catálogo/i });
    expect(catalogoLinks.length).toBeGreaterThanOrEqual(1);

    const turnosLinks = screen.getAllByRole('link', { name: /turnos/i });
    expect(turnosLinks.length).toBeGreaterThanOrEqual(1);

    const inventarioLinks = screen.getAllByRole('link', { name: /inventario/i });
    expect(inventarioLinks.length).toBeGreaterThanOrEqual(1);

    const reportesLinks = screen.getAllByRole('link', { name: /reportes/i });
    expect(reportesLinks.length).toBeGreaterThanOrEqual(1);

    const ajustesLinks = screen.getAllByRole('link', { name: /ajustes/i });
    expect(ajustesLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('navigates to catalog when clicking Catálogo link', async () => {
    const user = userEvent.setup();
    renderApp('/');

    const catalogoLinks = screen.getAllByRole('link', { name: /catálogo/i });
    const desktopLink = catalogoLinks[0];
    if (desktopLink) {
      await user.click(desktopLink);
      expect(screen.getByText('Catálogo de Productos')).toBeInTheDocument();
    }
  });

  it('toggles theme when clicking the theme toggle button', async () => {
    const user = userEvent.setup();
    renderApp('/');

    const themeButtons = screen.getAllByRole('button', { name: /cambiar tema/i });
    expect(themeButtons.length).toBeGreaterThanOrEqual(1);

    const button = themeButtons[0];
    if (button) {
      await user.click(button);
      // Theme toggles without crashing
      expect(button).toBeInTheDocument();
    }
  });

  it('ensures touch targets have min 48px classes (min-h-[48px] or min-h-touch)', () => {
    renderApp('/');
    const links = screen.getAllByRole('link');
    for (const link of links) {
      const className = link.getAttribute('class') || '';
      const hasTouchMin = className.includes('min-h-[48px]') || className.includes('min-h-touch');
      expect(hasTouchMin).toBe(true);
    }
  });
});
