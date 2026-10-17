import { afterEach, describe, expect, test } from 'vitest';
import {
  createDemoTicket,
  deleteDemoTicket,
  getDemoTicketHistory,
  getDemoTickets,
  getDemoUsers,
  updateDemoTicket,
} from './demo.js';

const sessionKey = 'helpdesk-session';
const demoDataKey = 'helpdesk-demo-data';

afterEach(() => {
  sessionStorage.clear();
  localStorage.removeItem(demoDataKey);
});

describe('demo data mode', () => {
  test('provides role-specific users and sample tickets', () => {
    sessionStorage.setItem(sessionKey, JSON.stringify({
      demo: true,
      user: { id: 103, name: 'Demo BT Yöneticisi', role: 'it_admin' },
    }));

    expect(getDemoUsers('employee').length).toBeGreaterThan(0);
    expect(getDemoUsers('it_staff').length).toBeGreaterThan(0);
    expect(getDemoTickets().length).toBeGreaterThan(0);
  });

  test('allows demo staff to create and update tickets in browser storage', () => {
    const user = { id: 103, name: 'Demo BT Yöneticisi', role: 'it_admin' };
    sessionStorage.setItem(sessionKey, JSON.stringify({ demo: true, user }));

    const created = createDemoTicket({
      title: 'Demo test talebi',
      description: 'Bu kayıt yalnızca demo içindir.',
      priority: 'high',
      createdBy: '104',
    }, getDemoUsers(), user);
    updateDemoTicket(created, { assignedTo: 102 }, getDemoUsers());
    const updated = updateDemoTicket(created, { status: 'In Progress' }, getDemoUsers());

    expect(created.requester).toBe('Ayşe Yılmaz');
    expect(updated.status).toBe('In Progress');
    expect(getDemoTickets().some((ticket) => ticket.id === created.id)).toBe(true);
    expect(getDemoTicketHistory(created.id)).toHaveLength(1);
  });

  test('keeps an unassigned demo ticket open when its staff member releases it', () => {
    const user = { id: 102, name: 'Demo BT Personeli', role: 'it_staff' };
    sessionStorage.setItem(sessionKey, JSON.stringify({ demo: true, user }));
    const ticket = {
      id: '9004',
      title: 'Kuyruk testi',
      description: 'Atamasız iş',
      status: 'In Progress',
      priority: 'High',
      assignedTo: 102,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      requester: 'Ayşe Yılmaz',
      requesterId: 104,
      assignee: 'Demo BT Personeli',
    };
    localStorage.setItem(demoDataKey, JSON.stringify({
      history: {},
      nextId: 9006,
      nextHistoryId: 1,
      tickets: [
        ticket,
        {
          ...ticket,
          id: '9005',
          title: 'Diğer aktif ticket',
          status: 'Open',
          assignedTo: 106,
          assignee: 'Zeynep Demir',
        },
      ],
    }));

    const released = updateDemoTicket(ticket, { assignedTo: null }, getDemoUsers());

    expect(released.status).toBe('Open');
    expect(released.assignedTo).toBeNull();
    expect(getDemoTicketHistory(ticket.id)).toHaveLength(2);
  });

  test('keeps the first resolution time when a demo ticket is reopened', () => {
    const user = { id: 102, name: 'Demo BT Personeli', role: 'it_staff' };
    sessionStorage.setItem(sessionKey, JSON.stringify({ demo: true, user }));

    const created = createDemoTicket({
      title: 'Çözüm süresi testi',
      description: 'Süre ilk çözümde sabitlenir.',
      priority: 'medium',
      createdBy: '104',
    }, getDemoUsers(), user);
    const resolved = updateDemoTicket(created, { status: 'Resolved' }, getDemoUsers());
    const reopened = updateDemoTicket(resolved, { status: 'Open' }, getDemoUsers());

    expect(reopened.resolvedAt).toBe(resolved.resolvedAt);
    expect(getDemoTicketHistory(created.id)).toHaveLength(2);
  });

  test('allows only demo administrators to delete a ticket and its history', () => {
    sessionStorage.setItem(sessionKey, JSON.stringify({
      demo: true,
      user: { id: 103, name: 'Demo BT Yöneticisi', role: 'it_admin' },
    }));
    const ticketId = '9001';

    deleteDemoTicket(ticketId);

    expect(getDemoTickets().some((ticket) => ticket.id === ticketId)).toBe(false);
    expect(() => getDemoTicketHistory(ticketId)).toThrow('bulunamadı');

    sessionStorage.setItem(sessionKey, JSON.stringify({
      demo: true,
      user: { id: 102, name: 'Demo BT Personeli', role: 'it_staff' },
    }));
    expect(() => deleteDemoTicket('9002')).toThrow('yetkiniz yok');
    expect(getDemoTickets().some((ticket) => ticket.id === '9002')).toBe(true);
  });
});
