import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '@/ui/theme-provider';
import { router } from './router';

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="pos-pwa-theme">
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
