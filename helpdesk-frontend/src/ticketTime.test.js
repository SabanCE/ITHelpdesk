import { describe, expect, test } from 'vitest';
import { formatElapsedTime } from './ticketTime.js';

describe('formatElapsedTime', () => {
  const createdAt = '2026-10-15T10:00:00.000Z';

  test('shows elapsed whole minutes for an unresolved ticket', () => {
    const ticket = { createdAt, status: 'Open' };

    expect(formatElapsedTime(ticket, Date.parse('2026-10-15T10:12:59.000Z')))
      .toBe('12 dk');
  });

  test('freezes elapsed minutes at the recorded resolution time', () => {
    const ticket = {
      createdAt,
      resolvedAt: '2026-10-15T10:07:59.000Z',
      status: 'Resolved',
    };

    expect(formatElapsedTime(ticket, Date.parse('2026-10-15T11:00:00.000Z')))
      .toBe('7 dk');
  });

  test('keeps the first resolution duration after a ticket is reopened', () => {
    const ticket = {
      createdAt,
      resolvedAt: '2026-10-15T10:07:59.000Z',
      status: 'In Progress',
    };

    expect(formatElapsedTime(ticket, Date.parse('2026-10-15T11:00:00.000Z')))
      .toBe('7 dk');
  });

  test('reports when a resolved ticket has no recorded resolution time', () => {
    expect(formatElapsedTime({ createdAt, status: 'Resolved' }))
      .toBe('Süre kaydı yok');
  });
});
