const demoStorageKey = 'helpdesk-demo-data';

const demoUsers = [
  { id: 101, name: 'Demo Çalışan', email: 'employee@demo.local', password: 'Employee123!', role: 'employee' },
  { id: 102, name: 'Demo BT Personeli', email: 'it.staff@demo.local', password: 'Staff123!', role: 'it_staff' },
  { id: 103, name: 'Demo BT Yöneticisi', email: 'it.admin@demo.local', password: 'Admin123!', role: 'it_admin' },
  { id: 104, name: 'Ayşe Yılmaz', email: 'ayse@demo.local', password: '', role: 'employee' },
  { id: 105, name: 'Mehmet Kaya', email: 'mehmet@demo.local', password: '', role: 'employee' },
  { id: 106, name: 'Zeynep Demir', email: 'zeynep@demo.local', password: '', role: 'it_staff' },
];

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function initialData() {
  const tickets = [
    {
      id: '9003',
      title: 'Yazıcı bağlantı sorunu',
      description: 'Muhasebe katındaki yazıcı ağa bağlanmıyor.',
      status: 'Open',
      priority: 'High',
      assignedTo: 106,
      createdAt: minutesAgo(73),
      resolvedAt: null,
      requester: 'Ayşe Yılmaz',
      requesterId: 104,
      assignee: 'Zeynep Demir',
    },
    {
      id: '9002',
      title: 'VPN erişimi',
      description: 'Uzaktan bağlantıda VPN kimlik doğrulaması başarısız oluyor.',
      status: 'In Progress',
      priority: 'Medium',
      assignedTo: 102,
      createdAt: minutesAgo(145),
      resolvedAt: null,
      requester: 'Demo Çalışan',
      requesterId: 101,
      assignee: 'Demo BT Personeli',
    },
    {
      id: '9001',
      title: 'E-posta kurulumu',
      description: 'Yeni telefonda kurumsal e-posta yapılandırıldı.',
      status: 'Resolved',
      priority: 'Low',
      assignedTo: 102,
      createdAt: minutesAgo(320),
      resolvedAt: minutesAgo(255),
      requester: 'Mehmet Kaya',
      requesterId: 105,
      assignee: 'Demo BT Personeli',
    },
  ];
  const history = {
    9001: [{
      Id: 1,
      TicketId: 9001,
      OldStatus: 'open',
      NewStatus: 'resolved',
      CreatedAt: tickets[2].resolvedAt,
      ChangedByName: 'Demo BT Personeli',
    }],
  };

  return { tickets, history, nextId: 9004, nextHistoryId: 2 };
}

function readData() {
  try {
    const storedData = localStorage.getItem(demoStorageKey);
    if (!storedData) {
      const data = initialData();
      localStorage.setItem(demoStorageKey, JSON.stringify(data));
      return data;
    }
    return JSON.parse(storedData);
  } catch (error) {
    throw new Error(`Demo verileri okunamadı: ${error.message}`);
  }
}

function writeData(data) {
  try {
    localStorage.setItem(demoStorageKey, JSON.stringify(data));
  } catch (error) {
    throw new Error(`Demo verileri kaydedilemedi: ${error.message}`);
  }
}

function dispatchDemoTickets(data) {
  const activeStaffIds = new Set(
    data.tickets
      .filter((ticket) => ticket.assignedTo && !['Resolved', 'Closed'].includes(ticket.status))
      .map((ticket) => Number(ticket.assignedTo)),
  );
  const idleStaff = demoUsers
    .filter((user) => user.role === 'it_staff' && !activeStaffIds.has(user.id))
    .sort((first, second) => first.id - second.id);
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  const queue = data.tickets
    .filter((ticket) => !ticket.assignedTo && ticket.status === 'Open')
    .map((ticket) => {
      const lastRelease = (data.history[ticket.id] ?? []).find((entry) =>
        ['open', 'in_progress'].includes(entry.OldStatus)
          && entry.NewStatus === 'open');
      return { ...ticket, lastReleasedBy: lastRelease?.ChangedBy };
    })
    .sort((first, second) =>
      priorityOrder[first.priority] - priorityOrder[second.priority]
        || Date.parse(first.createdAt) - Date.parse(second.createdAt)
        || Number(first.id) - Number(second.id));

  idleStaff.forEach((staff) => {
    const ticketIndex = queue.findIndex((ticket) =>
      Number(ticket.lastReleasedBy) !== Number(staff.id));
    if (ticketIndex < 0) return;
    const [ticket] = queue.splice(ticketIndex, 1);
    const storedTicket = data.tickets.find((item) => item.id === ticket.id);
    storedTicket.assignedTo = staff.id;
    storedTicket.assignee = staff.name;
  });
}

function getCurrentDemoUser() {
  try {
    const session = JSON.parse(sessionStorage.getItem('helpdesk-session') ?? 'null');
    return session?.demo ? session.user : null;
  } catch {
    return null;
  }
}

export function loginDemo(credentials) {
  const user = demoUsers.find(
    (candidate) => candidate.email === credentials.email.trim().toLowerCase()
      && candidate.password
      && candidate.password === credentials.password,
  );

  if (!user) {
    throw new Error('Demo hesabı bulunamadı veya şifre hatalı.');
  }

  const { password: _password, ...publicUser } = user;
  return {
    demo: true,
    token: `demo-${user.role}-session`,
    user: {
      Id: publicUser.id,
      Name: publicUser.name,
      Email: publicUser.email,
      Role: publicUser.role,
    },
  };
}

export function getDemoTickets() {
  const user = getCurrentDemoUser();
  const { tickets } = readData();
  const visibleTickets = user?.role === 'employee'
    ? tickets.filter((ticket) => ticket.requesterId === user.id)
    : tickets;

  return structuredClone(visibleTickets);
}

export function getDemoUsers(role) {
  return demoUsers
    .filter((user) => user.role !== 'it_admin' && (!role || user.role === role))
    .map(({ id, name, role: userRole }) => ({ id, name, role: userRole }));
}

export function createDemoTicket(ticket, users, currentUser) {
  const data = readData();
  const requesterId = currentUser.role === 'employee'
    ? currentUser.id
    : Number(ticket.createdBy);
  const requester = demoUsers.find(
    (user) => user.id === requesterId && user.role === 'employee',
  );

  if (!requester) {
    throw new Error('Talep sahibi olarak geçerli bir çalışan seçilmelidir.');
  }

  const createdTicket = {
    id: String(data.nextId),
    title: ticket.title,
    description: ticket.description,
    status: 'Open',
    priority: ticket.priority[0].toUpperCase() + ticket.priority.slice(1),
    assignedTo: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    requester: requester.name,
    requesterId: requester.id,
    assignee: 'Atanmadı',
  };

  data.nextId += 1;
  data.tickets.unshift(createdTicket);
  data.history[createdTicket.id] = [];
  dispatchDemoTickets(data);
  writeData(data);
  return structuredClone(data.tickets.find((ticket) => ticket.id === createdTicket.id));
}

export function updateDemoTicket(ticket, updates, users) {
  const data = readData();
  const currentTicket = data.tickets.find((item) => item.id === ticket.id);
  if (!currentTicket) throw new Error('Demo talebi bulunamadı.');

  const nextAssignedTo = Object.hasOwn(updates, 'assignedTo')
    ? updates.assignedTo
    : currentTicket.assignedTo;
  const nextStatus = updates.status
    ?? (updates.assignedTo === null && currentTicket.status === 'In Progress'
      ? 'Open'
      : undefined);

  if (nextStatus === 'In Progress' && !nextAssignedTo) {
    throw new Error('Atanmamış talep işlemde durumuna alınamaz.');
  }

  if (nextStatus && nextStatus !== currentTicket.status) {
    if (nextStatus === 'Resolved' && !currentTicket.resolvedAt) {
      currentTicket.resolvedAt = new Date().toISOString();
    }
    data.history[currentTicket.id] ??= [];
    data.history[currentTicket.id].unshift({
      Id: data.nextHistoryId,
      TicketId: Number(currentTicket.id),
      OldStatus: currentTicket.status.toLowerCase().replaceAll(' ', '_'),
      NewStatus: nextStatus.toLowerCase().replaceAll(' ', '_'),
      CreatedAt: new Date().toISOString(),
      ChangedByName: getCurrentDemoUser()?.name ?? 'Demo kullanıcı',
      ChangedBy: getCurrentDemoUser()?.id ?? null,
    });
    data.nextHistoryId += 1;
    currentTicket.status = nextStatus;
  }

  if (
    updates.assignedTo === null
    && currentTicket.assignedTo !== null
    && currentTicket.assignedTo !== undefined
    && !['Resolved', 'Closed'].includes(currentTicket.status)
  ) {
    data.history[currentTicket.id] ??= [];
    data.history[currentTicket.id].unshift({
      Id: data.nextHistoryId,
      TicketId: Number(currentTicket.id),
      OldStatus: 'open',
      NewStatus: 'open',
      CreatedAt: new Date().toISOString(),
      ChangedByName: getCurrentDemoUser()?.name ?? 'Demo kullanıcı',
      ChangedBy: getCurrentDemoUser()?.id ?? null,
    });
    data.nextHistoryId += 1;
  }

  if (Object.hasOwn(updates, 'assignedTo')) {
    const assignedTo = updates.assignedTo === null ? null : Number(updates.assignedTo);
    const assignee = users.find(
      (user) => user.id === assignedTo && user.role === 'it_staff',
    );
    if (assignedTo !== null && !assignee) {
      throw new Error('Atanacak demo BT personeli bulunamadı.');
    }
    currentTicket.assignedTo = assignedTo;
    currentTicket.assignee = assignee?.name ?? 'Atanmadı';
  }

  dispatchDemoTickets(data);
  writeData(data);
  return structuredClone(currentTicket);
}

export function deleteDemoTicket(ticketId) {
  const user = getCurrentDemoUser();
  if (user?.role !== 'it_admin') {
    throw new Error('Bu işlem için yetkiniz yok.');
  }

  const data = readData();
  const ticketIndex = data.tickets.findIndex(
    (ticket) => ticket.id === String(ticketId),
  );
  if (ticketIndex < 0) throw new Error('Demo talebi bulunamadı.');

  data.tickets.splice(ticketIndex, 1);
  delete data.history[ticketId];
  writeData(data);
}

export function getDemoTicketHistory(ticketId) {
  const data = readData();
  const user = getCurrentDemoUser();
  const ticket = data.tickets.find((item) => item.id === String(ticketId));
  if (!ticket || (user?.role === 'employee' && ticket.requesterId !== user.id)) {
    throw new Error('Demo talebi bulunamadı.');
  }
  return structuredClone(data.history[ticketId] ?? []);
}
