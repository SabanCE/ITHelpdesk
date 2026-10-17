import { describe, expect, test } from 'vitest';
import { formatElapsedTime } from './ticketTime.js';

describe('formatElapsedTime', () => {
  const createdAt = '2026-10-15T10:00:00.000Z';

  test('shows elapsed whole minutes for an unresolved ticket', () => {
    const ticket = { createdAt, status: 'Open' };

    expect(formatElapsedTime(ticket, Date.parse('2026-10-15T10:12:59.000Z')))
      .toBe('12 dk');
  });

  test('shows hours from 60 minutes up to 24 hours', () => {
    const ticket = { createdAt, status: 'Open' };

    expect(formatElapsedTime(ticket, Date.parse('2026-10-15T11:00:00.000Z')))
      .toBe('1 saat');
    expect(formatElapsedTime(ticket, Date.parse('2026-10-16T09:59:00.000Z')))
      .toBe('23 saat');
  });

  test('shows days from 24 hours onward', () => {
    const ticket = { createdAt, status: 'Open' };

    expect(formatElapsedTime(ticket, Date.parse('2026-10-16T10:00:00.000Z')))
      .toBe('1 gün');
    expect(formatElapsedTime(ticket, Date.parse('2026-10-17T12:00:00.000Z')))
      .toBe('2 gün');
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
