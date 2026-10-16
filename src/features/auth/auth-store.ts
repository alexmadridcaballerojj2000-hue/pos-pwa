import { create } from 'zustand';
import { generateId, type User, type UUID, verifyPin } from '@/domain';
import { type AppDatabase, db as defaultDb } from '@/data/db';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 30000; // 30 seconds
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface AuthState {
  currentUser: User | null;
  failedAttempts: number;
  lockedUntil: number | null;
  lastActivityAt: number;
  inactivityTimeoutMs: number;

  login: (
    userId: UUID,
    pin: string,
    db?: AppDatabase,
  ) => Promise<{ success: boolean; error?: string; remainingLockSeconds?: number }>;
  logout: (db?: AppDatabase) => Promise<void>;
  recordActivity: () => void;
  checkInactivity: (db?: AppDatabase) => Promise<boolean>;
  resetLockout: () => void;
  setCurrentUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  failedAttempts: 0,
  lockedUntil: null,
  lastActivityAt: Date.now(),
  inactivityTimeoutMs: DEFAULT_INACTIVITY_TIMEOUT_MS,

  setCurrentUser: (user) => set({ currentUser: user, lastActivityAt: Date.now() }),

  resetLockout: () => set({ failedAttempts: 0, lockedUntil: null }),

  recordActivity: () => set({ lastActivityAt: Date.now() }),

  login: async (userId, pin, db = defaultDb) => {
    const state = get();
    const now = Date.now();

    // Check if locked
    if (state.lockedUntil && now < state.lockedUntil) {
      const remaining = Math.ceil((state.lockedUntil - now) / 1000);
      return {
        success: false,
        error: 'locked',
        remainingLockSeconds: remaining,
      };
    }

    const user = await db.users.get(userId);
    if (!user || !user.active) {
      return { success: false, error: 'user_not_found' };
    }

    const isValid = await verifyPin(pin, user.pin);
    const nowIso = new Date(now).toISOString();

    if (isValid) {
      set({
        currentUser: user,
        failedAttempts: 0,
        lockedUntil: null,
        lastActivityAt: now,
      });

      await db.auditLog.add({
        id: generateId(),
        ts: nowIso,
        userId: user.id,
        action: 'auth:login',
        entity: 'user',
        entityId: user.id,
      });

      return { success: true };
    }

    // Invalid PIN
    const newFailedAttempts = state.failedAttempts + 1;
    let newLockedUntil: number | null = null;

    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      newLockedUntil = now + LOCKOUT_DURATION_MS;
      await db.auditLog.add({
        id: generateId(),
        ts: nowIso,
        userId,
        action: 'auth:lockout',
        entity: 'user',
        entityId: userId,
        details: { failedAttempts: newFailedAttempts, lockoutDurationMs: LOCKOUT_DURATION_MS },
      });
    } else {
      await db.auditLog.add({
        id: generateId(),
        ts: nowIso,
        userId,
        action: 'auth:failed_pin',
        entity: 'user',
        entityId: userId,
        details: { attempt: newFailedAttempts, max: MAX_FAILED_ATTEMPTS },
      });
    }

    set({
      failedAttempts: newFailedAttempts,
      lockedUntil: newLockedUntil,
    });

    return {
      success: false,
      error: newLockedUntil ? 'locked' : 'invalid_pin',
      remainingLockSeconds: newLockedUntil ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : undefined,
    };
  },

  logout: async (db = defaultDb) => {
    const { currentUser } = get();
    if (currentUser) {
      await db.auditLog.add({
        id: generateId(),
        ts: new Date().toISOString(),
        userId: currentUser.id,
        action: 'auth:logout',
        entity: 'user',
        entityId: currentUser.id,
      });
    }
    set({ currentUser: null });
  },

  checkInactivity: async (db = defaultDb) => {
    const { currentUser, lastActivityAt, inactivityTimeoutMs } = get();
    if (!currentUser) return false;

    const now = Date.now();
    if (now - lastActivityAt > inactivityTimeoutMs) {
      await db.auditLog.add({
        id: generateId(),
        ts: new Date(now).toISOString(),
        userId: currentUser.id,
        action: 'auth:auto_lock',
        entity: 'user',
        entityId: currentUser.id,
        details: { inactiveMs: now - lastActivityAt },
      });
      set({ currentUser: null });
      return true; // auto-locked
    }
    return false;
  },
}));
