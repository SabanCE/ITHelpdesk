const apiBaseUrl = import.meta.env.VITE_API_URL ?? '';
const sessionKey = 'helpdesk-session';

function isDemoSession() {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null')?.demo === true;
  } catch {
    sessionStorage.removeItem(sessionKey);
    return false;
  }
}

function getToken() {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null')?.token;
  } catch {
    sessionStorage.removeItem(sessionKey);
    return undefined;
  }
}

async function request(path, options) {
  let response;
  try {
    const token = getToken();
    response = await fetch(`${apiBaseUrl}${path}`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...options?.headers,
      },
      ...options,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      const unavailableError = new Error(
        'Sunucuya bağlanılamadı. Backend ve SQL Server bağlantısını kontrol edin.',
      );
      unavailableError.code = 'NETWORK_UNAVAILABLE';
      throw unavailableError;
    }
    throw error;
  }
  if (
    path === '/api/auth/login'
    && [404, 502, 503, 504].includes(response.status)
  ) {
    const unavailableError = new Error('Backend sunucusuna ulaşılamıyor.');
    unavailableError.code = 'NETWORK_UNAVAILABLE';
    throw unavailableError;
  }

  if (response.status === 204) return undefined;

  let body;
  try {
    body = await response.json();
  } catch (error) {
    if (path === '/api/auth/login') {
      const unavailableError = new Error('Backend sunucusu yanıt vermiyor.');
      unavailableError.code = 'NETWORK_UNAVAILABLE';
      throw unavailableError;
    }
    throw new Error(`Sunucudan geçersiz yanıt alındı: ${error.message}`);
  }

  if (response.status === 401 && path !== '/api/auth/login') {
    sessionStorage.removeItem(sessionKey);
    window.dispatchEvent(new Event('helpdesk-session-expired'));
  }

  if (!response.ok) {
    throw new Error(body.message || `İstek başarısız oldu (${response.status}).`);
  }

  return body;
}

export async function isBackendAvailable() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/health`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return false;

    let body;
    try {
      body = await response.json();
    } catch (error) {
      if (error instanceof SyntaxError) return false;
      throw error;
    }

    return body?.status === 'ok';
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

export function login(credentials) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }).catch(async (error) => {
    if (error.code !== 'NETWORK_UNAVAILABLE') throw error;
    if (await isBackendAvailable()) throw error;
    const { loginDemo } = await import('./demo.js');
    return loginDemo(credentials);
  });
}

function displayStatus(status) {
  return status
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatTicketId(id) {
  return `HD-${String(id).padStart(3, '0')}`;
}

export function mapTicket(record, users = []) {
  const requester = users.find(
    (user) => String(user.id) === String(record.CreatedBy),
  );
  const assignee = users.find(
    (user) => String(user.id) === String(record.AssignedTo),
  );

  return {
    id: String(record.Id),
    title: record.Title,
    description: record.Description,
    status: displayStatus(record.Status),
    priority: displayStatus(record.Priority),
    assignedTo: record.AssignedTo ?? null,
    createdAt: record.CreatedAt,
    resolvedAt: record.ResolvedAt ?? null,
    requester: record.EmployeeName
      ?? requester?.name
      ?? (record.CreatedBy ? `Çalışan #${record.CreatedBy}` : 'Talep sahibi bilgisi yok'),
    assignee: record.AssignedITStaff ?? assignee?.name ?? 'Atanmadı',
  };
}

export async function getTickets() {
  if (isDemoSession()) {
    const { getDemoTickets } = await import('./demo.js');
    return getDemoTickets();
  }
  const records = await request('/api/tickets');
  return records.map((record) => mapTicket(record));
}

export async function getUsers(role) {
  if (isDemoSession()) {
    const { getDemoUsers } = await import('./demo.js');
    return getDemoUsers(role);
  }
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  const records = await request(`/api/users${query}`);

  return records.map((record) => ({
    id: record.Id,
    name: record.Name,
    role: record.Role,
  }));
}

export async function createTicket(ticket, users, currentUser) {
  if (isDemoSession()) {
    const { createDemoTicket } = await import('./demo.js');
    return createDemoTicket(ticket, users, currentUser);
  }
  const record = await request('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority.toLowerCase(),
      ...(ticket.createdBy ? { createdBy: Number(ticket.createdBy) } : {}),
    }),
  });

  return mapTicket(record, [...users, currentUser]);
}

export async function updateTicket(ticket, updates, users) {
  if (isDemoSession()) {
    const { updateDemoTicket } = await import('./demo.js');
    return updateDemoTicket(ticket, updates, users);
  }
  const record = await request(`/api/tickets/${ticket.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(updates.status ? {
        status: updates.status.toLowerCase().replaceAll(' ', '_'),
      } : {}),
      ...(Object.hasOwn(updates, 'assignedTo')
        ? { assignedTo: updates.assignedTo }
        : {}),
    }),
  });

  const updatedTicket = mapTicket(record, users);

  return {
    ...updatedTicket,
    resolvedAt: record.ResolvedAt ?? ticket.resolvedAt ?? null,
    requester: record.EmployeeName
      ?? users.find((user) => String(user.id) === String(record.CreatedBy))?.name
      ?? ticket.requester
      ?? updatedTicket.requester,
  };
}

export async function deleteTicket(ticketId) {
  if (isDemoSession()) {
    const { deleteDemoTicket } = await import('./demo.js');
    return deleteDemoTicket(ticketId);
  }
  await request(`/api/tickets/${ticketId}`, { method: 'DELETE' });
}

export function getTicketHistory(ticketId) {
  if (isDemoSession()) {
    return import('./demo.js').then(({ getDemoTicketHistory }) =>
      getDemoTicketHistory(ticketId),
    );
  }
  return request(`/api/tickets/${ticketId}/history`);
}
