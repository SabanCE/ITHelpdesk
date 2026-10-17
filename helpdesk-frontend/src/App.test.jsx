import { afterEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

test('ends an existing demo session when the backend is available', async () => {
  sessionStorage.setItem('helpdesk-session', JSON.stringify({
    token: 'demo-employee-session',
    demo: true,
    user: { id: 101, name: 'Demo Çalışan', role: 'employee' },
  }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ status: 'ok' }),
  }));

  render(<App />);

  expect(await screen.findByText(
    'Sunucu yeniden kullanılabilir. Lütfen sunucuda kayıtlı hesabınızla tekrar giriş yapın.',
  )).toBeTruthy();
  expect(sessionStorage.getItem('helpdesk-session')).toBeNull();
});
