import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  PlusCircle,
  MinusCircle,
  Lock,
  Printer,
  History,
  CheckCircle2,
  FileText,
  Clock,
  User as UserIcon,
} from 'lucide-react';
import {
  type CashMovement,
  type CurrencyConfig,
  type Shift,
  type ShiftSummary,
  type UUID,
  formatMoney,
  buildZReportDoc,
} from '@/domain';
import { useI18n } from '@/app/i18n';
import { db } from '@/data/db';
import { printerService } from '@/hardware';
import { OpenShiftDialog } from './open-shift-dialog';
import { CashMovementDialog } from './cash-movement-dialog';
import { CloseShiftDialog } from './close-shift-dialog';
import { getCurrentShiftSummary, getShiftSummary } from './shift-operations';

export const ShiftsView: React.FC = () => {
  const { t } = useI18n();

  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftSummary, setShiftSummary] = useState<ShiftSummary | null>(null);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [pastShifts, setPastShifts] = useState<Shift[]>([]);
  const [usersMap, setUsersMap] = useState<Record<UUID, string>>({});
  const [currency, setCurrency] = useState<CurrencyConfig>({
    code: 'MXN',
    decimals: 2,
    symbol: '$',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Dialog states
  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);
  const [isCashMovementOpen, setIsCashMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<'in' | 'out'>('in');
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // 1. Settings & Currency
      const settings = await db.settings.toCollection().first();
      if (settings?.currency) {
        setCurrency(settings.currency);
      }

      // 2. Users map
      const allUsers = await db.users.toArray();
      const uMap: Record<UUID, string> = {};
      for (const u of allUsers) {
        uMap[u.id] = u.name;
      }
      setUsersMap(uMap);

      // 3. Active Shift
      const currentOpen = await db.shifts.where('status').equals('open').first();
      setActiveShift(currentOpen ?? null);

      if (currentOpen) {
        const summary = await getCurrentShiftSummary(db);
        setShiftSummary(summary);

        const movements = await db.cashMovements
          .where('shiftId')
          .equals(currentOpen.id)
          .reverse()
          .toArray();
        setCashMovements(movements);
      } else {
        setShiftSummary(null);
        setCashMovements([]);
      }

      // 4. Past Closed Shifts
      const closed = await db.shifts.where('status').equals('closed').reverse().limit(20).toArray();
      setPastShifts(closed);
    } catch (err) {
      console.error('Error loading shifts view data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrintReport = async (shift: Shift, isPartial: boolean) => {
    try {
      const summary = await getShiftSummary(db, shift.id);
      const settings = await db.settings.toCollection().first();
      const business = {
        name: settings?.business?.name || 'Mi Negocio',
        taxId: settings?.business?.taxId,
        address: settings?.business?.address,
        phone: settings?.business?.phone,
      };

      const doc = buildZReportDoc({
        summary,
        business,
        currency,
        openedByName: usersMap[shift.openedBy] ?? shift.openedBy,
        closedByName: shift.closedBy ? (usersMap[shift.closedBy] ?? shift.closedBy) : undefined,
        paperWidthMm: settings?.printer?.paperWidthMm ?? settings?.receipt?.paperWidthMm ?? 80,
        isPartialXReport: isPartial,
      });

      await printerService.print(doc);
      setActionFeedback(
        isPartial ? 'Reporte X enviado a la impresora.' : 'Reporte Z enviado a la impresora.',
      );
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al imprimir reporte.';
      setActionFeedback(`Error: ${msg}`);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t('shifts.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('shifts.subtitle')}</p>
        </div>

        {!activeShift && !isLoading && (
          <button
            type="button"
            onClick={() => setIsOpenShiftOpen(true)}
            className="min-h-[48px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-colors flex items-center gap-2 self-start sm:self-auto"
          >
            <PlusCircle className="w-5 h-5" />
            {t('shifts.openShift')}
          </button>
        )}
      </div>

      {actionFeedback && (
        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center gap-3 text-sm animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* ACTIVE SHIFT STATUS */}
      {activeShift && shiftSummary ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h2 className="text-xl font-bold tracking-tight">{t('shifts.activeShift')}</h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  ID: {activeShift.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5" />
                  {t('shifts.openedBy')}:{' '}
                  <strong className="text-foreground">
                    {usersMap[activeShift.openedBy] ?? activeShift.openedBy}
                  </strong>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {t('shifts.openedAt')}:{' '}
                  <strong className="text-foreground">{formatDate(activeShift.openedAt)}</strong>
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setMovementType('in');
                  setIsCashMovementOpen(true);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-input bg-background hover:bg-muted font-medium text-sm transition-colors flex items-center gap-2 text-emerald-600 dark:text-emerald-400"
              >
                <PlusCircle className="w-4 h-4" />
                {t('shifts.cashIn')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMovementType('out');
                  setIsCashMovementOpen(true);
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-input bg-background hover:bg-muted font-medium text-sm transition-colors flex items-center gap-2 text-rose-600 dark:text-rose-400"
              >
                <MinusCircle className="w-4 h-4" />
                {t('shifts.cashOut')}
              </button>
              <button
                type="button"
                onClick={() => handlePrintReport(activeShift, true)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-input bg-background hover:bg-muted font-medium text-sm transition-colors flex items-center gap-2"
                title="Imprimir corte provisional sin cerrar turno"
              >
                <FileText className="w-4 h-4" />
                {t('shifts.partialXReport')}
              </button>
              <button
                type="button"
                onClick={() => setIsCloseShiftOpen(true)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold text-sm shadow transition-colors flex items-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {t('shifts.closeShift')}
              </button>
            </div>
          </div>

          {/* Shift Financial Overview Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
              <span className="text-xs text-muted-foreground font-medium block">
                {t('shifts.openingFloat')}
              </span>
              <span className="text-xl font-bold tracking-tight">
                {formatMoney(activeShift.openingFloat, currency)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
              <span className="text-xs text-muted-foreground font-medium block">
                {t('shifts.cashSales')} ({shiftSummary.sales.payments['cash']?.count ?? 0})
              </span>
              <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                +{formatMoney(shiftSummary.sales.cashSalesTotal, currency)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-1">
              <span className="text-xs text-muted-foreground font-medium block">
                Movimientos Netos (+ / -)
              </span>
              <span
                className={`text-xl font-bold tracking-tight ${
                  shiftSummary.movements.netMovement >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {shiftSummary.movements.netMovement >= 0 ? '+' : ''}
                {formatMoney(shiftSummary.movements.netMovement, currency)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
              <span className="text-xs text-primary font-bold block uppercase tracking-wider">
                {t('shifts.expectedCash')}
              </span>
              <span className="text-2xl font-black text-primary tracking-tight">
                {formatMoney(shiftSummary.expectedCash, currency)}
              </span>
            </div>
          </div>

          {/* Cash Movements of Current Shift */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Movimientos de Efectivo del Turno ({cashMovements.length})
            </h3>
            {cashMovements.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3">
                No se han registrado entradas ni salidas extraordinarias en este turno.
              </p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="max-h-56 overflow-y-auto divide-y divide-border">
                  {cashMovements.map((mov) => (
                    <div
                      key={mov.id}
                      className="flex items-center justify-between p-3 text-sm hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`p-1.5 rounded-lg ${
                            mov.type === 'in'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {mov.type === 'in' ? (
                            <PlusCircle className="w-4 h-4" />
                          ) : (
                            <MinusCircle className="w-4 h-4" />
                          )}
                        </span>
                        <div>
                          <p className="font-semibold">{mov.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(mov.createdAt)} • {usersMap[mov.createdBy] ?? mov.createdBy}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`font-bold ${
                          mov.type === 'in'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {mov.type === 'in' ? '+' : '-'}
                        {formatMoney(mov.amount, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : !isLoading ? (
        /* NO ACTIVE SHIFT BANNER */
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-4 bg-card/50">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <DollarSign className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-xl font-bold tracking-tight">{t('shifts.noActiveShift')}</h2>
            <p className="text-sm text-muted-foreground">
              Para registrar cobros y movimientos en caja, inicie un nuevo turno especificando el
              fondo inicial.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpenShiftOpen(true)}
            className="min-h-[48px] px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md transition-colors inline-flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            {t('shifts.openNewShift')}
          </button>
        </div>
      ) : null}

      {/* SHIFT HISTORY */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-xl font-bold tracking-tight">{t('shifts.history')}</h2>
        </div>

        {pastShifts.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No hay turnos cerrados en el historial de este dispositivo.
          </p>
        ) : (
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3.5">ID</th>
                    <th className="px-4 py-3.5">{t('shifts.openedAt')}</th>
                    <th className="px-4 py-3.5">{t('shifts.closedAt')}</th>
                    <th className="px-4 py-3.5">{t('shifts.openingFloat')}</th>
                    <th className="px-4 py-3.5">{t('shifts.expectedCash')}</th>
                    <th className="px-4 py-3.5">{t('shifts.countedCash')}</th>
                    <th className="px-4 py-3.5">{t('shifts.difference')}</th>
                    <th className="px-4 py-3.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pastShifts.map((s) => {
                    const diff = s.difference ?? 0;
                    return (
                      <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {s.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.openedAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{formatDate(s.closedAt)}</td>
                        <td className="px-4 py-3 font-medium">
                          {formatMoney(s.openingFloat, currency)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {formatMoney(s.expectedCash ?? 0, currency)}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {formatMoney(s.countedCash ?? 0, currency)}
                        </td>
                        <td className="px-4 py-3">
                          {diff === 0 ? (
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                              Cuadrado
                            </span>
                          ) : diff > 0 ? (
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              +{formatMoney(diff, currency)}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                              {formatMoney(diff, currency)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handlePrintReport(s, false)}
                            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-input hover:bg-muted text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                            title="Reimprimir Corte Z"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Corte Z
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* DIALOGS */}
      <OpenShiftDialog
        isOpen={isOpenShiftOpen}
        onClose={() => setIsOpenShiftOpen(false)}
        currency={currency}
        onShiftOpened={() => {
          loadData();
          setActionFeedback('Turno abierto exitosamente.');
          setTimeout(() => setActionFeedback(null), 4000);
        }}
      />

      <CashMovementDialog
        isOpen={isCashMovementOpen}
        onClose={() => setIsCashMovementOpen(false)}
        defaultType={movementType}
        currency={currency}
        onMovementAdded={() => {
          loadData();
          setActionFeedback('Movimiento de efectivo registrado exitosamente.');
          setTimeout(() => setActionFeedback(null), 4000);
        }}
      />

      <CloseShiftDialog
        isOpen={isCloseShiftOpen}
        onClose={() => {
          setIsCloseShiftOpen(false);
          loadData();
        }}
        expectedCash={shiftSummary?.expectedCash ?? 0}
        currency={currency}
        onPrintZReport={(closedShift) => handlePrintReport(closedShift, false)}
      />
    </div>
  );
};
