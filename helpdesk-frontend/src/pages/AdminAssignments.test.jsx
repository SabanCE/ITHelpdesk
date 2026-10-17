import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import AdminAssignments from './AdminAssignments.jsx';

test('lets an administrator manually assign an unassigned ticket', async () => {
  const ticket = {
    id: '42',
    title: 'E-posta sorunu',
    status: 'Open',
    priority: 'High',
    assignedTo: null,
    requester: 'Ada Çalışan',
  };
  const onAssign = vi.fn().mockResolvedValue();

  render(
    <MemoryRouter>
      <AdminAssignments
        tickets={[ticket]}
        technicians={[{ id: 3, name: 'BT Personeli' }]}
        onAssign={onAssign}
      />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText('E-posta sorunu için BT personeli'), {
    target: { value: '3' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Manuel ata' }));

  await waitFor(() => {
    expect(onAssign).toHaveBeenCalledWith(ticket, 3);
  });
});

test('shows unassigned tickets in priority and waiting-time order', () => {
  render(
    <MemoryRouter>
      <AdminAssignments
        tickets={[
          { id: '3', title: 'Düşük öncelik', status: 'Open', priority: 'Low', createdAt: '2026-01-01', assignedTo: null },
          { id: '2', title: 'Yeni yüksek öncelik', status: 'Open', priority: 'High', createdAt: '2026-01-02', assignedTo: null },
          { id: '1', title: 'Eski yüksek öncelik', status: 'Open', priority: 'High', createdAt: '2026-01-01', assignedTo: null },
        ]}
        technicians={[]}
        onAssign={vi.fn()}
      />
    </MemoryRouter>,
  );

  const ticketTitles = screen.getAllByRole('link')
    .filter((link) => link.getAttribute('href')?.startsWith('/tickets/'))
    .map((link) => link.textContent);
  expect(ticketTitles).toEqual([
    'Eski yüksek öncelik',
    'Yeni yüksek öncelik',
    'Düşük öncelik',
  ]);
});

test('lists technicians without active tickets as idle staff', () => {
  render(
    <MemoryRouter>
      <AdminAssignments
        tickets={[
          { id: '1', status: 'open', assignedTo: 3 },
          { id: '2', status: 'in_progress', assignedTo: 4 },
          { id: '3', status: 'resolved', assignedTo: 5 },
        ]}
        technicians={[
          { id: 3, name: 'Meşgul personel' },
          { id: 4, name: 'İşlemde personel' },
          { id: 5, name: 'Çözülmüş işi olan personel' },
          { id: 6, name: 'Boşta personel' },
        ]}
        onAssign={vi.fn()}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: 'Boşta personel' })).toBeTruthy();
  expect(within(screen.getByRole('list')).getByText('Boşta personel')).toBeTruthy();
  expect(screen.queryByText('Meşgul personel')).toBeNull();
  expect(screen.queryByText('İşlemde personel')).toBeNull();
});

test('shows a message when there are no idle technicians', () => {
  render(
    <MemoryRouter>
      <AdminAssignments
        tickets={[{ id: '1', status: 'in_progress', assignedTo: 3 }]}
        technicians={[{ id: 3, name: 'Meşgul personel' }]}
        onAssign={vi.fn()}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole('status').textContent).toBe('Şu anda boşta personel yok.');
});
