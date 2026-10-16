import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { createAppDatabase } from '@/data/db';
import { initializeDeviceMeta } from '@/data/meta';
import { DiagnosticsView } from './diagnostics-view';
import type { OutboxItem } from '@/domain';

describe('Diagnostics Dashboard (S2-T7)', () => {
  it('renders device metadata, storage, and outbox event counts accurately', async () => {
    const db = createAppDatabase(`test_diag_${Date.now()}`);

    // Seed meta
    await initializeDeviceMeta(db, {
      deviceId: '018f0000-0000-7000-8000-000000000999',
      series: 'L01',
      mode: 'local',
    });

    // Seed some outbox items
    const pendingItem: OutboxItem = {
      eventId: '018f0000-0000-7000-8000-000000000101',
      entity: 'sale',
      entityId: '018f0000-0000-7000-8000-000000000001',
      op: 'create',
      payload: {},
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
      nextAttemptAt: 0,
    };

    const deadItem: OutboxItem = {
      eventId: '018f0000-0000-7000-8000-000000000102',
      entity: 'sale',
      entityId: '018f0000-0000-7000-8000-000000000002',
      op: 'create',
      payload: {},
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      status: 'dead',
      attempts: 5,
      nextAttemptAt: 0,
      lastError: 'Malformed payload rejected by server',
    };

    await db.outbox.add(pendingItem);
    await db.outbox.add(deadItem);

    render(<DiagnosticsView db={db} />);

    // Check title and headers
    expect(screen.getByText('Diagnóstico del Sistema')).toBeInTheDocument();
    expect(screen.getByText('Información del Dispositivo')).toBeInTheDocument();

    // Check meta items
    await waitFor(() => {
      expect(screen.getByTestId('device-id')).toHaveTextContent(
        '018f0000-0000-7000-8000-000000000999',
      );
      expect(screen.getByTestId('device-series')).toHaveTextContent('L01');
      expect(screen.getByTestId('device-mode')).toHaveTextContent('local');
    });

    // Check outbox counts
    await waitFor(() => {
      expect(screen.getByText('Cola de Sincronización (Outbox)')).toBeInTheDocument();
      expect(screen.getByText('Total: 2')).toBeInTheDocument();
    });

    // Check security disclaimer
    expect(
      screen.getByText(/Los datos locales están aislados por el origen del navegador/i),
    ).toBeInTheDocument();
  });
});
