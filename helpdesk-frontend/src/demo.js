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
  writeData(data);
  return structuredClone(createdTicket);
}

export function updateDemoTicket(ticket, updates, users) {
  const data = readData();
  const currentTicket = data.tickets.find((item) => item.id === ticket.id);
  if (!currentTicket) throw new Error('Demo talebi bulunamadı.');

  if (updates.status && updates.status !== currentTicket.status) {
    if (updates.status === 'Resolved' && !currentTicket.resolvedAt) {
      currentTicket.resolvedAt = new Date().toISOString();
    }
    data.history[currentTicket.id] ??= [];
    data.history[currentTicket.id].unshift({
      Id: data.nextHistoryId,
      TicketId: Number(currentTicket.id),
      OldStatus: currentTicket.status.toLowerCase().replaceAll(' ', '_'),
      NewStatus: updates.status.toLowerCase().replaceAll(' ', '_'),
      CreatedAt: new Date().toISOString(),
      ChangedByName: getCurrentDemoUser()?.name ?? 'Demo kullanıcı',
    });
    data.nextHistoryId += 1;
    currentTicket.status = updates.status;
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

  writeData(data);
  return structuredClone(currentTicket);
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
