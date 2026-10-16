import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/ui/layout';
import { PosView } from '@/features/pos/pos-view';
import { CatalogView } from '@/features/catalog/catalog-view';
import { ShiftsView } from '@/features/shifts/shifts-view';
import { InventoryView } from '@/features/inventory/inventory-view';
import { ReportsView } from '@/features/reports/reports-view';
import { SettingsView } from '@/features/settings/settings-view';
import { DiagnosticsView } from '@/features/diagnostics/diagnostics-view';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <PosView />,
      },
      {
        path: 'catalog',
        element: <CatalogView />,
      },
      {
        path: 'shifts',
        element: <ShiftsView />,
      },
      {
        path: 'inventory',
        element: <InventoryView />,
      },
      {
        path: 'reports',
        element: <ReportsView />,
      },
      {
        path: 'settings',
        element: <SettingsView />,
      },
      {
        path: 'diagnostics',
        element: <DiagnosticsView />,
      },
    ],
  },
]);
