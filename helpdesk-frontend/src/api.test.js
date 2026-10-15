import { afterEach, describe, expect, test, vi } from 'vitest';
import { getTickets, login, updateTicket } from './api.js';

describe('updateTicket', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  describe('demo login fallback', () => {
    afterEach(() => {
      sessionStorage.clear();
      localStorage.clear();
      vi.unstubAllGlobals();
    });

    test('uses a static demo account only when the backend cannot be reached', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      const session = await login({
        email: 'it.admin@demo.local',
        password: 'Admin123!',
      });

      expect(session.demo).toBe(true);
      expect(session.user.Role).toBe('it_admin');
      expect(session.token).toMatch(/^demo-/);
    });

    test('does not switch to demo mode when the backend responds with an error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'E-posta adresi veya şifre hatalı.' }),
      }));

      await expect(login({
        email: 'it.admin@demo.local',
        password: 'Admin123!',
      })).rejects.toThrow('E-posta adresi veya şifre hatalı.');
    });

    test('switches to demo mode when the frontend proxy reports the backend is unavailable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ message: 'Bad Gateway' }),
      }));

      const session = await login({
        email: 'employee@demo.local',
        password: 'Employee123!',
      });

      expect(session.demo).toBe(true);
      expect(session.user.Role).toBe('employee');
    });

    test('uses backend authentication when the backend responds successfully', async () => {
      const backendSession = {
        token: 'backend-token',
        user: { Id: 3, Name: 'Canlı Kullanıcı', Role: 'employee' },
      };
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => backendSession,
      });
      vi.stubGlobal('fetch', fetch);

      await expect(login({
        email: 'employee@demo.local',
        password: 'Employee123!',
      })).resolves.toEqual(backendSession);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('uses browser demo ticket data without calling the backend', async () => {
      sessionStorage.setItem('helpdesk-session', JSON.stringify({
        token: 'demo-employee-session',
        demo: true,
        user: { id: 101, role: 'employee' },
      }));
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);

      const tickets = await getTickets();

      expect(tickets.length).toBeGreaterThan(0);
      expect(tickets.every((ticket) => ticket.requester === 'Demo Çalışan')).toBe(true);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  test('sends the in-progress status and assignment changes to the API', async () => {
    const ticket = {
      id: '42',
      createdAt: '2026-10-15T10:00:00.000Z',
      requester: 'Ada Çalışan',
      resolvedAt: null,
    };
    const responseRecord = {
      Id: 42,
      Title: 'E-posta sorunu',
      Description: 'E-posta açılmıyor',
      Status: 'in_progress',
      Priority: 'medium',
      CreatedBy: 7,
      AssignedTo: null,
      CreatedAt: ticket.createdAt,
      ResolvedAt: null,
      EmployeeName: 'Ada Çalışan',
      AssignedITStaff: null,
    };
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => responseRecord,
    });
    vi.stubGlobal('fetch', fetch);

    await updateTicket(ticket, {
      status: 'In Progress',
      assignedTo: null,
    }, []);

    expect(fetch).toHaveBeenCalledWith('/api/tickets/42', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        status: 'in_progress',
        assignedTo: null,
      }),
    }));
  });

  test('preserves the requester when the update response omits the employee name', async () => {
    const ticket = {
      id: '42',
      requester: 'Ada Çalışan',
      createdAt: '2026-10-15T10:00:00.000Z',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        Id: 42,
        Title: 'E-posta sorunu',
        Description: 'E-posta açılmıyor',
        Status: 'in_progress',
        Priority: 'medium',
        CreatedBy: 7,
        CreatedAt: ticket.createdAt,
      }),
    }));

    const updatedTicket = await updateTicket(ticket, { status: 'In Progress' }, []);

    expect(updatedTicket.requester).toBe('Ada Çalışan');
    expect(updatedTicket.status).toBe('In Progress');
  });
});
