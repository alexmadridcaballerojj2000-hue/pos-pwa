import React, { useEffect, useState } from 'react';
import {
  Activity,
  HardDrive,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Info,
} from 'lucide-react';
import { type AppDatabase, db as defaultDb } from '@/data/db';
import { getMeta, META_KEYS } from '@/data/meta';
import { useI18n } from '@/app/i18n';

interface DiagnosticsViewProps {
  db?: AppDatabase;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({ db = defaultDb }) => {
  const { t } = useI18n();

  const [metaInfo, setMetaInfo] = useState({
    deviceId: 'Cargando...',
    series: 'Cargando...',
    mode: 'Cargando...',
    schemaVersion: 1,
  });

  const [storageInfo, setStorageInfo] = useState<{
    persisted: boolean | null;
    usageMb: number;
    quotaMb: number;
  }>({
    persisted: null,
    usageMb: 0,
    quotaMb: 0,
  });

  const [outboxCounts, setOutboxCounts] = useState({
    pending: 0,
    sending: 0,
    synced: 0,
    dead: 0,
  });

  const [isRequestingPersist, setIsRequestingPersist] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Meta
      const deviceId = (await getMeta<string>(db, META_KEYS.DEVICE_ID)) ?? 'No configurado';
      const series = (await getMeta<string>(db, META_KEYS.SERIES)) ?? 'L01';
      const mode = (await getMeta<string>(db, META_KEYS.MODE)) ?? 'local';
      const schemaVersion = (await getMeta<number>(db, META_KEYS.SCHEMA_VERSION)) ?? 1;

      setMetaInfo({
        deviceId,
        series,
        mode,
        schemaVersion,
      });

      // 2. Storage
      if (typeof navigator !== 'undefined' && navigator.storage) {
        let isPersisted: boolean | null = null;
        if (navigator.storage.persisted) {
          isPersisted = await navigator.storage.persisted();
        }

        let usageMb = 0;
        let quotaMb = 0;
        if (navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          usageMb = Math.round(((estimate.usage ?? 0) / (1024 * 1024)) * 10) / 10;
          quotaMb = Math.round(((estimate.quota ?? 0) / (1024 * 1024)) * 10) / 10;
        }

        setStorageInfo({
          persisted: isPersisted,
          usageMb,
          quotaMb,
        });
      }

      // 3. Outbox counts
      const pending = await db.outbox.where('status').equals('pending').count();
      const sending = await db.outbox.where('status').equals('sending').count();
      const synced = await db.outbox.where('status').equals('synced').count();
      const dead = await db.outbox.where('status').equals('dead').count();

      setOutboxCounts({
        pending,
        sending,
        synced,
        dead,
      });
    } catch {
      // Ignore in background
    } finally {
      setIsRefreshing(false);
    }
  }, [db]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRequestPersist = async () => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        setIsRequestingPersist(true);
        const granted = await navigator.storage.persist();
        setStorageInfo((prev) => ({ ...prev, persisted: granted }));
      } finally {
        setIsRequestingPersist(false);
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" />
            {t('diagnostics.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('diagnostics.subtitle')}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isRefreshing}
          className="min-h-[48px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium text-sm flex items-center gap-2 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('common.update')}
        </button>
      </div>

      {/* Grid of Diagnostic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Device & Version Meta */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
            <Smartphone className="w-5 h-5 text-emerald-600" />
            <span>Información del Dispositivo</span>
          </div>
          <div className="space-y-2 text-sm divide-y divide-slate-100 dark:divide-slate-800">
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400">
                {t('diagnostics.appVersion')}
              </span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                0.1.0
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400">
                {t('diagnostics.schemaVersion')}
              </span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {metaInfo.schemaVersion}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400">{t('diagnostics.mode')}</span>
              <span data-testid="device-mode" className="font-semibold uppercase text-emerald-600">
                {metaInfo.mode}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400">{t('diagnostics.series')}</span>
              <span
                data-testid="device-series"
                className="font-mono font-bold text-slate-800 dark:text-slate-200"
              >
                {metaInfo.series}
              </span>
            </div>
            <div className="pt-2">
              <span className="text-xs text-slate-400 block mb-0.5">
                {t('diagnostics.deviceId')}
              </span>
              <span
                data-testid="device-id"
                className="font-mono text-xs break-all text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2 rounded block"
              >
                {metaInfo.deviceId}
              </span>
            </div>
          </div>
        </div>

        {/* Storage State */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
            <HardDrive className="w-5 h-5 text-blue-600" />
            <span>{t('diagnostics.storage')}</span>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">
                {t('diagnostics.persisted')}
              </span>
              <span
                className={`inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 rounded-full ${
                  storageInfo.persisted === true
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                {storageInfo.persisted === true ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {t('diagnostics.persistedGranted')}
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {t('diagnostics.persistedDenied')}
                  </>
                )}
              </span>
            </div>

            <div className="flex justify-between py-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">
                {t('diagnostics.storageUsage')}
              </span>
              <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                {storageInfo.usageMb} MB /{' '}
                {storageInfo.quotaMb > 0 ? `${storageInfo.quotaMb} MB` : 'Desconocido'}
              </span>
            </div>

            {storageInfo.persisted !== true && (
              <button
                type="button"
                onClick={handleRequestPersist}
                disabled={isRequestingPersist}
                className="w-full min-h-[48px] rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                {t('diagnostics.requestPersist')}
              </button>
            )}
          </div>
        </div>

        {/* Outbox Status */}
        <div className="md:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-600" />
              <span>{t('diagnostics.outboxStatus')}</span>
            </div>
            <span className="text-xs font-normal text-slate-400">
              Total:{' '}
              {outboxCounts.pending +
                outboxCounts.sending +
                outboxCounts.synced +
                outboxCounts.dead}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center">
              <span className="text-xs text-amber-700 dark:text-amber-300 block">
                {t('diagnostics.pendingEvents')}
              </span>
              <span className="font-mono text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1 block">
                {outboxCounts.pending}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center">
              <span className="text-xs text-blue-700 dark:text-blue-300 block">
                {t('diagnostics.sendingEvents')}
              </span>
              <span className="font-mono text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1 block">
                {outboxCounts.sending}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
              <span className="text-xs text-emerald-700 dark:text-emerald-300 block">
                {t('diagnostics.syncedEvents')}
              </span>
              <span className="font-mono text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1 block">
                {outboxCounts.synced}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-center">
              <span className="text-xs text-rose-700 dark:text-rose-300 block">
                {t('diagnostics.deadEvents')}
              </span>
              <span className="font-mono text-2xl font-bold text-rose-900 dark:text-rose-100 mt-1 block">
                {outboxCounts.dead}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Security Disclaimer (SPEC §11) */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start gap-3 text-slate-600 dark:text-slate-300 text-xs">
        <Info className="w-5 h-5 shrink-0 text-slate-500 mt-0.5" />
        <p className="leading-relaxed">{t('diagnostics.securityNotice')}</p>
      </div>
    </div>
  );
};
