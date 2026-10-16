import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';

export function SettingsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajustes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configuración de negocio, moneda, impresoras y diagnósticos.
        </p>
      </div>

      <div className="pt-2">
        <Link
          to="/diagnostics"
          className="inline-flex items-center gap-2 px-5 min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm shadow-sm transition-colors"
        >
          <Activity className="w-5 h-5 text-emerald-600" />
          <span>Ver Diagnóstico del Sistema</span>
        </Link>
      </div>
    </div>
  );
}
