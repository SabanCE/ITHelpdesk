import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, test } from 'vitest';
import TicketList from './TicketList.jsx';

const tickets = [
  { id: '1', title: 'Açık talep', status: 'open', priority: 'High', assignedTo: null },
  { id: '2', title: 'İşlemde talep', status: 'in_progress', priority: 'Medium', assignedTo: null },
  { id: '3', title: 'Çözülmüş talep', status: 'resolved', priority: 'Low', assignedTo: null },
];

function renderTicketList(initialEntry = '/my-tickets') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/my-tickets"
          element={(
            <TicketList
              tickets={tickets}
              employeeView
              currentUserId={42}
              currentTime={Date.parse('2026-10-15T10:12:00.000Z')}
            />
          )}
        />
      </Routes>
    </MemoryRouter>,
  );

  return within(screen.getByRole('table'));
}

test('filters employee tickets by open, in-progress, and resolved status', () => {
  const table = renderTicketList();

  expect(table.getByText('Açık talep')).toBeTruthy();
  expect(table.getByText('İşlemde talep')).toBeTruthy();
  expect(table.getByText('Çözülmüş talep')).toBeTruthy();

  fireEvent.click(screen.getByRole('link', { name: 'Açık' }));
  expect(table.getByText('Açık talep')).toBeTruthy();
  expect(table.getByText('İşlemde talep')).toBeTruthy();
  expect(table.queryByText('Çözülmüş talep')).toBeNull();

  fireEvent.click(screen.getByRole('link', { name: 'İşlemde' }));
  expect(table.queryByText('Açık talep')).toBeNull();
  expect(table.getByText('İşlemde talep')).toBeTruthy();

  fireEvent.click(screen.getByRole('link', { name: 'Çözüldü' }));
  expect(table.getByText('Çözülmüş talep')).toBeTruthy();
  expect(table.queryByText('İşlemde talep')).toBeNull();
});

test('matches status filters when backend statuses contain underscores', () => {
  const table = renderTicketList('/my-tickets?status=In%20Progress');

  expect(table.getByText('İşlemde talep')).toBeTruthy();
  expect(table.queryByText('Açık talep')).toBeNull();
  expect(table.queryByText('Çözülmüş talep')).toBeNull();
});
