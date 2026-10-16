import React, { useEffect, useState } from 'react';
import { Lock, UserCheck, Users, ShieldAlert } from 'lucide-react';
import type { User } from '@/domain';
import { type AppDatabase, db as defaultDb } from '@/data/db';
import { useAuthStore } from './auth-store';
import { PinPad } from './pin-pad';
import { useI18n } from '@/app/i18n';

interface LoginViewProps {
  onLoginSuccess?: () => void;
  db?: AppDatabase;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, db = defaultDb }) => {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [lockRemaining, setLockRemaining] = useState<number>(0);

  const { login, lockedUntil, failedAttempts } = useAuthStore();

  useEffect(() => {
    let isMounted = true;
    db.users
      .filter((u) => u.active)
      .toArray()
      .then((activeUsers) => {
        if (isMounted) {
          setUsers(activeUsers);
          if (activeUsers.length === 1 && activeUsers[0]) {
            setSelectedUser(activeUsers[0]);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [db]);

  // Lockout countdown timer
  useEffect(() => {
    if (!lockedUntil) {
      setLockRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const now = Date.now();
      if (now >= lockedUntil) {
        setLockRemaining(0);
      } else {
        setLockRemaining(Math.ceil((lockedUntil - now) / 1000));
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const handleLogin = async () => {
    if (!selectedUser || pin.length < 4 || isLoggingIn || lockRemaining > 0) return;

    try {
      setIsLoggingIn(true);
      setErrorMsg(null);

      const result = await login(selectedUser.id, pin, db);

      if (result.success) {
        setPin('');
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      } else {
        setPin('');
        if (result.error === 'locked') {
          setErrorMsg(
            `${t('auth.lockedTitle')}: ${t('auth.lockedDesc')} ${result.remainingLockSeconds ?? 30} ${t('auth.seconds')}`,
          );
        } else {
          setErrorMsg(`${t('auth.invalidPin')} ${failedAttempts + 1} ${t('auth.of')} 5`);
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al autenticar');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isLocked = lockRemaining > 0;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8">
        {/* Top Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('auth.title')}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('auth.subtitle')}</p>
        </div>

        {/* User Selection Carousel / List */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            {t('auth.selectUser')}
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {users.map((u) => {
              const isSelected = selectedUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setSelectedUser(u);
                    setPin('');
                    setErrorMsg(null);
                  }}
                  className={`flex-1 min-w-[120px] min-h-[52px] p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold shadow-sm ring-2 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-sm truncate w-full text-center">{u.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{u.role}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lockout Notice */}
        {isLocked && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-rose-800 dark:text-rose-200 text-sm">
            <ShieldAlert className="w-6 h-6 shrink-0 text-rose-600" />
            <div>
              <p className="font-bold">{t('auth.lockedTitle')}</p>
              <p className="text-xs mt-0.5">
                {t('auth.lockedDesc')}{' '}
                <span className="font-mono font-bold text-base">{lockRemaining}</span>{' '}
                {t('auth.seconds')}.
              </p>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && !isLocked && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* PIN Pad */}
        <div className="mb-6">
          <PinPad
            value={pin}
            onChange={(val) => {
              setPin(val);
              if (errorMsg) setErrorMsg(null);
            }}
            onSubmit={handleLogin}
            disabled={!selectedUser || isLocked || isLoggingIn}
            maxLength={6}
          />
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleLogin}
          disabled={!selectedUser || pin.length < 4 || isLocked || isLoggingIn}
          className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-98"
        >
          {isLoggingIn ? (
            'Ingresando...'
          ) : (
            <>
              <UserCheck className="w-5 h-5" />
              <span>{t('auth.login')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
