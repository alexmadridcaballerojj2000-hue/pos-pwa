import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { can, type Permission } from './permissions';
import type { User, UserRole } from './types';

const ALL_PERMISSIONS: Permission[] = [
  'sales:create',
  'sales:void',
  'sales:return',
  'discount:override',
  'cash:movement',
  'shift:manage',
  'inventory:adjust',
  'catalog:manage',
  'settings:manage',
  'users:manage',
  'reports:view',
];

const createTestUser = (role: UserRole, active = true): User => ({
  id: '018f0000-0000-7000-8000-000000000001',
  name: 'Test User',
  role,
  active,
  pin: { hash: 'h', salt: 's', iterations: 210000 },
  version: 1,
  updatedAt: new Date().toISOString(),
});

describe('Permissions & Authorization: can(user, permission)', () => {
  it('grants owner all defined permissions when active', () => {
    const owner = createTestUser('owner', true);
    for (const perm of ALL_PERMISSIONS) {
      expect(can(owner, perm)).toBe(true);
    }
  });

  it('restricts manager from users:manage but allows operational permissions', () => {
    const manager = createTestUser('manager', true);
    expect(can(manager, 'users:manage')).toBe(false);
    expect(can(manager, 'sales:void')).toBe(true);
    expect(can(manager, 'discount:override')).toBe(true);
    expect(can(manager, 'catalog:manage')).toBe(true);
    expect(can(manager, 'reports:view')).toBe(true);
  });

  it('restricts cashier to sales, returns, and shifts; disallows voids and overrides', () => {
    const cashier = createTestUser('cashier', true);
    expect(can(cashier, 'sales:create')).toBe(true);
    expect(can(cashier, 'sales:return')).toBe(true);
    expect(can(cashier, 'shift:manage')).toBe(true);
    expect(can(cashier, 'cash:movement')).toBe(true);

    // Forbidden for cashier without manager approval
    expect(can(cashier, 'sales:void')).toBe(false);
    expect(can(cashier, 'discount:override')).toBe(false);
    expect(can(cashier, 'inventory:adjust')).toBe(false);
    expect(can(cashier, 'catalog:manage')).toBe(false);
    expect(can(cashier, 'settings:manage')).toBe(false);
    expect(can(cashier, 'users:manage')).toBe(false);
    expect(can(cashier, 'reports:view')).toBe(false);
  });

  it('returns false for null or undefined user', () => {
    expect(can(null, 'sales:create')).toBe(false);
    expect(can(undefined, 'sales:create')).toBe(false);
  });

  describe('Property-Based Invariants (fast-check)', () => {
    it('INVARIANT: Inactive user has strictly FALSE for all roles and all permissions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<UserRole>('cashier', 'manager', 'owner'),
          fc.constantFrom<Permission>(...ALL_PERMISSIONS),
          (role, permission) => {
            const inactiveUser = createTestUser(role, false);
            return can(inactiveUser, permission) === false;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('INVARIANT: Active owner always has strictly TRUE for any defined permission', () => {
      fc.assert(
        fc.property(fc.constantFrom<Permission>(...ALL_PERMISSIONS), (permission) => {
          const owner = createTestUser('owner', true);
          return can(owner, permission) === true;
        }),
        { numRuns: 50 },
      );
    });
  });
});
