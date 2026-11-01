import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  Calendar,
  User as UserIcon,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Clock,
  Layers,
} from 'lucide-react';
import { type AuditEntry, type AuditFilter, type User, type UUID, can } from '@/domain';
import { useI18n } from '@/app/i18n';
import { type AppDatabase, db as defaultDb } from '@/data/db';
import { useAuthStore } from '@/features/auth/auth-store';

export interface AuditViewProps {
  db?: AppDatabase;
  currentUser?: User | null;
}

type DatePreset = 'today' | 'yesterday' | 'last7days' | 'all';

function getDateBounds(preset: DatePreset): { startDate?: string; endDate?: string } {
  const now = new Date();
  if (preset === 'all') {
    return {};
  }

  if (preset === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  if (preset === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
    const end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  if (preset === 'last7days') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  }

  return {};
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return isoString;
  }
}

function getActionBadgeStyle(action: string): string {
  const act = action.toLowerCase();
  if (act.startsWith('shift:')) {
    return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20';
  }
  if (act.startsWith('sale:')) {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
  }
  if (act.startsWith('cash_movement:') || act.startsWith('cash:')) {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
  }
  if (act.startsWith('discount:')) {
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
  }
  if (act.startsWith('inventory:') || act.startsWith('stock:')) {
    return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
  }
  if (act.startsWith('auth:') || act.startsWith('user:')) {
    return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20';
  }
  return 'bg-muted text-muted-foreground border-border';
}

export const AuditView: React.FC<AuditViewProps> = ({ db = defaultDb, currentUser: propUser }) => {
  const { t } = useI18n();
  const storeUser = useAuthStore((s) => s.currentUser);
  const activeUser = propUser !== undefined ? propUser : storeUser;

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [actionQuery, setActionQuery] = useState<string>('');
  const [expandedRowId, setExpandedRowId] = useState<UUID | null>(null);

  // Check authorization
  const isAuthorized = can(activeUser, 'audit:view');

  const usersMap = useMemo(() => {
    const map: Record<UUID, string> = {};
    for (const u of users) {
      map[u.id] = u.name;
    }
    return map;
  }, [users]);

  const loadData = useCallback(async () => {
    if (!isAuthorized) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const allUsers = await db.users.toArray();
      setUsers(allUsers);

      const bounds = getDateBounds(datePreset);
      const filter: AuditFilter = {
        startDate: bounds.startDate,
        endDate: bounds.endDate,
        userId: selectedUserId === 'all' ? undefined : (selectedUserId as UUID),
        action: actionQuery.trim() ? actionQuery.trim() : undefined,
        limit: 100,
      };

      // In repository or directly:
      let results = await db.auditLog.orderBy('ts').reverse().toArray();
      if (filter.startDate) {
        results = results.filter((e) => e.ts >= filter.startDate!);
      }
      if (filter.endDate) {
        results = results.filter((e) => e.ts <= filter.endDate!);
      }
      if (filter.userId) {
        results = results.filter((e) => e.userId === filter.userId);
      }
      if (filter.action) {
        const q = filter.action.toLowerCase();
        results = results.filter((e) => e.action.toLowerCase().includes(q));
      }
      if (filter.limit && filter.limit > 0) {
        results = results.slice(0, filter.limit);
      }

      setEntries(results);
    } catch (err) {
      console.error('Error loading audit log:', err);
    } finally {
      setIsLoading(false);
    }
  }, [db, isAuthorized, datePreset, selectedUserId, actionQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCsv = () => {
    if (entries.length === 0) return;

    const headers = [
      'ID',
      'Fecha y Hora',
      'Usuario ID',
      'Nombre Usuario',
      'Acción',
      'Entidad',
      'Entidad ID',
      'Detalles',
    ];
    const rows = entries.map((e) => [
      e.id,
      formatDate(e.ts),
      e.userId,
      `"${(usersMap[e.userId] ?? e.userId).replace(/"/g, '""')}"`,
      `"${e.action}"`,
      `"${e.entity ?? ''}"`,
      e.entityId ?? '',
      `"${JSON.stringify(e.details ?? {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Acceso Restringido</h2>
        <p className="text-sm text-muted-foreground">
          Solo usuarios con rol de gerente o administrador pueden consultar el registro de
          auditoría.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t('audit.title')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={entries.length === 0}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-input bg-card hover:bg-muted font-semibold text-sm shadow-sm transition-colors flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {t('audit.exportCsv')}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-card border border-border shadow-sm">
        {/* Date Filter */}
        <div className="space-y-1.5">
          <label
            htmlFor="audit-date-filter"
            className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            {t('audit.filterDate')}
          </label>
          <select
            id="audit-date-filter"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="today">{t('audit.today')}</option>
            <option value="yesterday">{t('audit.yesterday')}</option>
            <option value="last7days">{t('audit.last7Days')}</option>
            <option value="all">{t('audit.all')}</option>
          </select>
        </div>

        {/* User Filter */}
        <div className="space-y-1.5">
          <label
            htmlFor="audit-user-filter"
            className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"
          >
            <UserIcon className="w-3.5 h-3.5" />
            {t('audit.filterUser')}
          </label>
          <select
            id="audit-user-filter"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">{t('audit.allUsers')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>

        {/* Action Search Filter */}
        <div className="space-y-1.5">
          <label
            htmlFor="audit-action-filter"
            className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            {t('audit.filterAction')}
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              id="audit-action-filter"
              type="text"
              value={actionQuery}
              onChange={(e) => setActionQuery(e.target.value)}
              placeholder="Ej. shift, sale, cash..."
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Mostrando {entries.length} registros</span>
        {entries.length === 100 && <span>(limitado a los 100 más recientes)</span>}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl border border-border bg-card/40 space-y-2">
          <Clock className="w-8 h-8 mx-auto text-muted-foreground/60 animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Cargando registros...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-2">
          <Clock className="w-8 h-8 mx-auto text-muted-foreground/60" />
          <p className="text-sm font-medium text-muted-foreground">{t('audit.noEntries')}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="w-10 px-3 py-3.5"></th>
                  <th className="px-4 py-3.5">{t('audit.timestamp')}</th>
                  <th className="px-4 py-3.5">{t('audit.user')}</th>
                  <th className="px-4 py-3.5">{t('audit.action')}</th>
                  <th className="px-4 py-3.5">{t('audit.entity')}</th>
                  <th className="px-4 py-3.5 text-right">{t('audit.details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => {
                  const isExpanded = expandedRowId === entry.id;
                  const userName = usersMap[entry.userId] ?? entry.userId;
                  return (
                    <React.Fragment key={entry.id}>
                      <tr
                        onClick={() => setExpandedRowId(isExpanded ? null : entry.id)}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-3 text-muted-foreground">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-primary" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
                          {formatDate(entry.ts)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-xs whitespace-nowrap">
                          {userName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getActionBadgeStyle(
                              entry.action,
                            )}`}
                          >
                            {entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {entry.entity ? (
                            <span className="flex items-center gap-1 font-mono">
                              <Layers className="w-3 h-3" />
                              {entry.entity}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRowId(isExpanded ? null : entry.id);
                            }}
                            className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground font-medium text-xs transition-colors"
                          >
                            {isExpanded ? 'Ocultar' : 'Ver'}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable JSON details */}
                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                                <span>Metadatos del Evento (ID: {entry.id})</span>
                                {entry.entityId && <span>Entity ID: {entry.entityId}</span>}
                              </div>
                              <pre className="p-3.5 rounded-xl bg-card border border-border text-xs font-mono overflow-x-auto text-foreground max-h-64">
                                {JSON.stringify(entry.details ?? {}, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
