import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Calendar, Receipt, Eye, Printer, ChevronRight, Filter } from 'lucide-react';
import type { Sale, Settings, User, UUID, CurrencyConfig } from '@/domain';
import { formatMoney, DEFAULT_CURRENCY, v7 } from '@/domain';
import { repositories as defaultRepositories, type Repositories } from '@/data/repositories';
import { useAuthStore } from '@/features/auth/auth-store';
import { useI18n } from '@/app/i18n';
import { SaleDetailDialog } from './sale-detail-dialog';
import { ReceiptModal } from '@/features/pos/receipt-modal';

export interface SalesHistoryViewProps {
  repos?: Repositories;
  currentUser?: User | null;
}

type DateFilter = 'today' | 'yesterday' | 'last7Days' | 'all';

function getDateFilterRange(filter: DateFilter): { startDate?: string; endDate?: string } {
  const now = new Date();
  if (filter === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    return { startDate: start.toISOString() };
  }
  if (filter === 'yesterday') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  if (filter === 'last7Days') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
    return { startDate: start.toISOString() };
  }
  return {};
}

function formatDateString(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return isoString;
  }
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  repos = defaultRepositories,
  currentUser: propUser,
}) => {
  const { t } = useI18n();
  const storeUser = useAuthStore((s) => s.currentUser);
  const activeUser = propUser !== undefined ? propUser : storeUser;

  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<Settings | null>(null);

  // Cache for customer and cashier names
  const [cashiersMap, setCashiersMap] = useState<Record<UUID, string>>({});
  const [customersMap, setCustomersMap] = useState<Record<UUID, string>>({});

  // Active dialogs
  const [selectedSaleForDetail, setSelectedSaleForDetail] = useState<Sale | null>(null);
  const [reprintingSale, setReprintingSale] = useState<Sale | null>(null);

  // Load Settings
  useEffect(() => {
    let isMounted = true;
    repos.settings.get().then((s) => {
      if (isMounted && s) setSettings(s);
    });
    return () => {
      isMounted = false;
    };
  }, [repos.settings]);

  const currency: CurrencyConfig = useMemo(() => {
    return (settings?.currency as CurrencyConfig) ?? DEFAULT_CURRENCY;
  }, [settings?.currency]);

  const paymentMethodLabels = useMemo(() => {
    const map: Record<string, string> = {};
    settings?.paymentMethods?.forEach((pm) => {
      map[pm.id] = pm.label;
    });
    return map;
  }, [settings?.paymentMethods]);

  // Load Sales with filters
  const loadSales = useCallback(async () => {
    try {
      setIsLoading(true);
      const range = getDateFilterRange(dateFilter);
      const list = await repos.sales.list({
        startDate: range.startDate,
        endDate: range.endDate,
        search: searchQuery.trim() || undefined,
        limit: 100,
      });

      setSales(list);

      // Resolve cashiers and customers for the loaded sales
      const uniqueCashierIds = Array.from(new Set(list.map((s) => s.cashierId)));
      const uniqueCustomerIds = Array.from(
        new Set(list.map((s) => s.customerId).filter(Boolean)),
      ) as UUID[];

      const [users, custs] = await Promise.all([
        Promise.all(uniqueCashierIds.map((id) => repos.users.getById(id))),
        Promise.all(uniqueCustomerIds.map((id) => repos.customers.getById(id))),
      ]);

      const cMap: Record<UUID, string> = {};
      users.forEach((u) => {
        if (u) cMap[u.id] = u.name;
      });
      setCashiersMap((prev) => ({ ...prev, ...cMap }));

      const custMap: Record<UUID, string> = {};
      custs.forEach((c) => {
        if (c) custMap[c.id] = c.name;
      });
      setCustomersMap((prev) => ({ ...prev, ...custMap }));
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dateFilter, searchQuery, repos.sales, repos.users, repos.customers]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // Handle Reprint action
  const handleReprint = useCallback(
    async (sale: Sale) => {
      try {
        await repos.audit.log({
          id: v7(),
          ts: new Date().toISOString(),
          userId: activeUser?.id ?? sale.cashierId,
          action: 'sale:reprint',
          entity: 'sale',
          entityId: sale.id,
          details: {
            saleNumber: sale.number,
            reprintedAt: new Date().toISOString(),
          },
        });
        setReprintingSale(sale);
      } catch (err) {
        console.error('Error recording reprint audit log:', err);
        setReprintingSale(sale);
      }
    },
    [repos.audit, activeUser?.id],
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            <span>{t('sales.title')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{t('sales.subtitle')}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3 bg-card border border-border rounded-xl shadow-xs">
        {/* Date Filter Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mr-1 shrink-0">
            <Calendar className="h-3.5 w-3.5" />
            {t('sales.filterDate')}:
          </span>
          <button
            type="button"
            onClick={() => setDateFilter('today')}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              dateFilter === 'today'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {t('sales.today')}
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('yesterday')}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              dateFilter === 'yesterday'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {t('sales.yesterday')}
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('last7Days')}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              dateFilter === 'last7Days'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {t('sales.last7Days')}
          </button>
          <button
            type="button"
            onClick={() => setDateFilter('all')}
            className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              dateFilter === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {t('sales.all')}
          </button>
        </div>

        {/* Search Query Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sales.searchPlaceholder')}
            className="w-full min-h-[44px] pl-9 pr-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Sales List / Table */}
      <div className="flex-1 bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center p-8 text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : sales.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Filter className="h-10 w-10 stroke-1 mb-2 text-muted-foreground/50" />
            <p className="text-sm font-semibold">{t('sales.noSalesFound')}</p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              Prueba cambiando el filtro de fecha o la búsqueda.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Desktop Table */}
            <table className="hidden md:table w-full text-left border-collapse text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold sticky top-0 z-10 backdrop-blur-xs">
                <tr>
                  <th className="px-4 py-3">{t('sales.saleNumber')}</th>
                  <th className="px-4 py-3">{t('sales.date')}</th>
                  <th className="px-4 py-3">{t('sales.cashier')}</th>
                  <th className="px-4 py-3">{t('checkout.customer')}</th>
                  <th className="px-4 py-3">{t('sales.paymentMethods')}</th>
                  <th className="px-4 py-3 text-right">{t('sales.total')}</th>
                  <th className="px-4 py-3 text-center">{t('sales.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sales.map((sale) => {
                  const cashierName = cashiersMap[sale.cashierId] || 'Cajero';
                  const customerName =
                    (sale.customerId && customersMap[sale.customerId]) ||
                    t('checkout.generalPublic');
                  const paymentLabels = sale.payments
                    .map((p) => paymentMethodLabels[p.method] || p.method)
                    .join(', ');

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedSaleForDetail(sale)}
                    >
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {sale.number}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateString(sale.completedAt)}
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{cashierName}</td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[150px]">
                        {customerName}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-muted-foreground">
                          {paymentLabels}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground text-sm">
                        {formatMoney(sale.totals.total, currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center justify-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedSaleForDetail(sale)}
                            title={t('sales.viewDetail')}
                            aria-label={t('sales.viewDetail')}
                            className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReprint(sale)}
                            title={t('sales.reprint')}
                            aria-label={t('sales.reprint')}
                            className="p-2 min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {sales.map((sale) => {
                const cashierName = cashiersMap[sale.cashierId] || 'Cajero';
                const customerName =
                  (sale.customerId && customersMap[sale.customerId]) || t('checkout.generalPublic');
                const paymentLabels = sale.payments
                  .map((p) => paymentMethodLabels[p.method] || p.method)
                  .join(', ');

                return (
                  <div
                    key={sale.id}
                    onClick={() => setSelectedSaleForDetail(sale)}
                    className="p-4 active:bg-muted/40 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {sale.number}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateString(sale.completedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {cashierName} &bull; {customerName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{paymentLabels}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold font-mono text-foreground">
                        {formatMoney(sale.totals.total, currency)}
                      </span>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sale Detail Dialog */}
      {selectedSaleForDetail && (
        <SaleDetailDialog
          isOpen={Boolean(selectedSaleForDetail)}
          onClose={() => setSelectedSaleForDetail(null)}
          sale={selectedSaleForDetail}
          currency={currency}
          cashierName={cashiersMap[selectedSaleForDetail.cashierId]}
          customerName={
            selectedSaleForDetail.customerId
              ? customersMap[selectedSaleForDetail.customerId]
              : undefined
          }
          paymentMethodLabels={paymentMethodLabels}
          onReprint={handleReprint}
        />
      )}

      {/* Receipt Modal for Thermal Preview / Reprinting */}
      {reprintingSale && (
        <ReceiptModal
          isOpen={Boolean(reprintingSale)}
          onClose={() => setReprintingSale(null)}
          sale={reprintingSale}
          business={
            settings?.business ?? {
              name: 'Mi Negocio',
            }
          }
          currency={currency}
          cashierName={cashiersMap[reprintingSale.cashierId]}
          customerName={
            reprintingSale.customerId ? customersMap[reprintingSale.customerId] : undefined
          }
          paymentMethodLabels={paymentMethodLabels}
          initialPaperWidthMm={settings?.receipt?.paperWidthMm ?? 80}
          onNewSale={() => setReprintingSale(null)}
        />
      )}
    </div>
  );
};
