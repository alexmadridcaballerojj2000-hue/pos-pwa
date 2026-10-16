import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { can, generateId, type Permission, type UUID, verifyPin } from '@/domain';
import { type AppDatabase, db as defaultDb } from '@/data/db';
import { PinPad } from './pin-pad';
import { useI18n } from '@/app/i18n';

interface ManagerApprovalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (managerId: UUID) => void;
  requiredPermission?: Permission;
  reason?: string;
  db?: AppDatabase;
}

export const ManagerApprovalDialog: React.FC<ManagerApprovalDialogProps> = ({
  isOpen,
  onClose,
  onApprove,
  requiredPermission = 'sales:void',
  reason,
  db = defaultDb,
}) => {
  const { t } = useI18n();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleVerify = async () => {
    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos');
      return;
    }

    try {
      setIsVerifying(true);
      setError(null);

      // Fetch active managers/owners who have the required permission
      const allActiveUsers = await db.users.filter((u) => u.active).toArray();
      const eligibleManagers = allActiveUsers.filter((u) => can(u, requiredPermission));

      let matchedManagerId: UUID | null = null;
      for (const manager of eligibleManagers) {
        const matches = await verifyPin(pin, manager.pin);
        if (matches) {
          matchedManagerId = manager.id;
          break;
        }
      }

      if (matchedManagerId) {
        await db.auditLog.add({
          id: generateId(),
          ts: new Date().toISOString(),
          userId: matchedManagerId,
          action: 'manager:approval',
          entity: 'authorization',
          details: { requiredPermission, reason },
        });

        setPin('');
        onApprove(matchedManagerId);
        onClose();
      } else {
        setError(t('auth.unauthorized'));
        setPin('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          aria-label="Cerrar diálogo"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mb-3">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('auth.managerApproval')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('auth.managerApprovalDesc')}
          </p>
          {reason && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-1 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded">
              Motivo: {reason}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {/* PIN Pad */}
        <PinPad
          value={pin}
          onChange={(val) => {
            setPin(val);
            if (error) setError(null);
          }}
          onSubmit={handleVerify}
          disabled={isVerifying}
          maxLength={6}
        />

        {/* Action Button */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[48px] rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={pin.length < 4 || isVerifying}
            className="flex-1 min-h-[48px] rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-sm shadow-md"
          >
            {isVerifying ? 'Verificando...' : t('auth.authorize')}
          </button>
        </div>
      </div>
    </div>
  );
};
