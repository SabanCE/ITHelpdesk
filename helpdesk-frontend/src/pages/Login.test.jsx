import { afterEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Login from './Login.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('hides demo credentials when the backend is available', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));

  render(<Login onLogin={vi.fn()} />);

  expect(await screen.findByText(
    'Sunucuya bağlısınız. Sunucuda kayıtlı hesabınızla giriş yapın.',
  )).toBeTruthy();
  expect(screen.queryByLabelText('Demo giriş bilgileri')).toBeNull();
  expect(screen.queryByText(/employee@demo\.local/)).toBeNull();
});

test('shows demo credentials only when the backend is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

  render(<Login onLogin={vi.fn()} />);

  expect(await screen.findByLabelText('Demo giriş bilgileri')).toBeTruthy();
  expect(screen.getByText(/employee@demo\.local/)).toBeTruthy();
});
