import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import TicketDetails from './TicketDetails.jsx';

vi.mock('../api.js', () => ({
  formatTicketId: (id) => `HD-${String(id).padStart(3, '0')}`,
  getTicketHistory: vi.fn().mockResolvedValue([]),
}));

const ticket = {
  id: '42',
  title: 'E-posta sorunu',
  description: 'E-posta açılmıyor',
  status: 'Open',
  priority: 'Medium',
  assignedTo: null,
  assignee: 'Atanmadı',
  requester: 'Ada Çalışan',
  createdAt: '2026-10-15T10:00:00.000Z',
  resolvedAt: null,
};

function renderDetails(props = {}) {
  const onUpdateTicket = vi.fn().mockResolvedValue({});

  render(
    <MemoryRouter initialEntries={['/tickets/42']}>
      <Routes>
        <Route
          path="/tickets/:ticketId"
          element={(
            <TicketDetails
              tickets={[ticket]}
              onUpdateTicket={onUpdateTicket}
              isStaff
              isAdmin={false}
              currentTime={Date.parse('2026-10-15T10:12:00.000Z')}
              {...props}
            />
          )}
        />
      </Routes>
    </MemoryRouter>,
  );

  return onUpdateTicket;
}

describe('TicketDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('lets IT staff move a ticket to In Progress', async () => {
    const onUpdateTicket = renderDetails();

    fireEvent.change(screen.getByLabelText('Talep durumu'), {
      target: { value: 'In Progress' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Durumu güncelle' }));

    await waitFor(() => {
      expect(onUpdateTicket).toHaveBeenCalledWith(ticket, {
        status: 'In Progress',
      });
    });
  });

  test('shows the assignment selector only to IT administrators', () => {
    renderDetails({
      isAdmin: true,
      technicians: [{ id: 5, name: 'BT Personeli', role: 'it_staff' }],
    });

    expect(screen.getByLabelText('Sorumlu BT personeli')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'BT Personeli' })).toBeTruthy();
  });

  test('lets an IT administrator assign the ticket to a technician', async () => {
    const onUpdateTicket = renderDetails({
      isAdmin: true,
      technicians: [{ id: 5, name: 'BT Personeli', role: 'it_staff' }],
    });

    fireEvent.change(screen.getByLabelText('Sorumlu BT personeli'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Personeli ata' }));

    await waitFor(() => {
      expect(onUpdateTicket).toHaveBeenCalledWith(ticket, { assignedTo: 5 });
    });
  });

  test('does not show assignment controls to regular IT staff', () => {
    renderDetails({ isAdmin: false });

    expect(screen.queryByLabelText('Sorumlu BT personeli')).toBeNull();
  });

  test('lets an administrator confirm ticket deletion', async () => {
    const onDeleteTicket = vi.fn().mockResolvedValue({});
    renderDetails({ isAdmin: true, onDeleteTicket });

    expect(screen.getByRole('button', { name: 'Talebi sil' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Talebi sil' }));
    expect(screen.getByRole('alert').textContent)
      .toContain('durum geçmişi kalıcı olarak silinecek');
    fireEvent.click(screen.getByRole('button', { name: 'Evet, talebi sil' }));

    await waitFor(() => {
      expect(onDeleteTicket).toHaveBeenCalledWith(ticket);
    });
  });

  test('does not show ticket deletion to regular IT staff', () => {
    renderDetails({ isAdmin: false });
    expect(screen.queryByRole('button', { name: 'Talebi sil' })).toBeNull();
  });

  test('lets an assigned IT staff member release a ticket back to the queue', async () => {
    const assignedTicket = { ...ticket, assignedTo: 3 };
    const onUpdateTicket = vi.fn().mockResolvedValue({});

    render(
      <MemoryRouter initialEntries={['/tickets/42']}>
        <Routes>
          <Route
            path="/tickets/:ticketId"
            element={(
              <TicketDetails
                tickets={[assignedTicket]}
                onUpdateTicket={onUpdateTicket}
                isStaff
                isAdmin={false}
                currentUserId={3}
                currentTime={Date.parse('2026-10-15T10:12:00.000Z')}
              />
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'İşi bırak, kuyruğa al' }));

    await waitFor(() => {
      expect(onUpdateTicket).toHaveBeenCalledWith(assignedTicket, {
        assignedTo: null,
      });
    });
  });

  test('disables the In Progress option for an unassigned ticket', () => {
    renderDetails();

    expect(screen.getByRole('option', { name: 'İşlemde' }).disabled).toBe(true);
  });
});
