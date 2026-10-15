import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import NewTicket from './pages/NewTicket.jsx';
import Technicians from './pages/Technicians.jsx';
import TicketDetails from './pages/TicketDetails.jsx';
import TicketList from './pages/TicketList.jsx';
import {
  createTicket,
  getTickets,
  getUsers,
  login,
  updateTicket,
} from './api.js';
import './App.css';

const sessionKey = 'helpdesk-session';

function readSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null');
    return session?.token && session?.user ? session : null;
  } catch {
    sessionStorage.removeItem(sessionKey);
    return null;
  }
}

function AppLayout() {
  const [auth, setAuth] = useState(readSession);
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now);
  const navigate = useNavigate();
  const isStaff = ['it_staff', 'it_admin'].includes(auth?.user.role);
  const isAdmin = auth?.user.role === 'it_admin';

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function expireSession() {
      sessionStorage.removeItem(sessionKey);
      setAuth(null);
      setTickets([]);
      setUsers([]);
      setLoadError('');
      navigate('/login', { replace: true });
    }

    window.addEventListener('helpdesk-session-expired', expireSession);
    return () => window.removeEventListener('helpdesk-session-expired', expireSession);
  }, [navigate]);

  useEffect(() => {
    if (!auth) return undefined;

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setLoadError('');

      try {
        const [loadedTickets, employees, technicians] = await Promise.all([
          getTickets(),
          isStaff ? getUsers('employee') : Promise.resolve([]),
          isStaff ? getUsers('it_staff') : Promise.resolve([]),
        ]);

        if (!cancelled) {
          setTickets(loadedTickets);
          setUsers([...employees, ...technicians]);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [auth, isStaff, reloadKey]);

  async function handleLogin(credentials) {
    const session = await login(credentials);
    if (!['employee', 'it_staff', 'it_admin'].includes(session.user.Role)) {
      throw new Error('Hesabınız için tanımlı bir rol bulunamadı.');
    }

    const signedInSession = {
      token: session.token,
      user: {
        id: session.user.Id,
        name: session.user.Name,
        email: session.user.Email,
        role: session.user.Role,
      },
      demo: session.demo === true,
    };
    sessionStorage.setItem(sessionKey, JSON.stringify(signedInSession));
    setAuth(signedInSession);
    navigate('/', { replace: true });
  }

  function handleLogout() {
    sessionStorage.removeItem(sessionKey);
    setAuth(null);
    setTickets([]);
    setUsers([]);
    setLoading(false);
    setLoadError('');
    navigate('/login', { replace: true });
  }

  async function handleCreateTicket(ticketData) {
    const ticket = await createTicket(ticketData, users, auth.user);
    setTickets((currentTickets) => [ticket, ...currentTickets]);
    navigate(`/tickets/${ticket.id}`);
  }

  async function handleUpdateTicket(ticket, updates) {
    const updatedTicket = await updateTicket(ticket, updates, users);
    setTickets((currentTickets) =>
      currentTickets.map((currentTicket) =>
        currentTicket.id === updatedTicket.id ? updatedTicket : currentTicket,
      ),
    );
    return updatedTicket;
  }

  if (!auth) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const employeeTickets = (
    <TicketList
      tickets={tickets}
      employeeView={!isStaff}
      mine={isStaff}
      currentUserId={auth.user.id}
      currentTime={currentTime}
    />
  );

  return (
    <div className="app-layout">
      <Sidebar user={auth.user} onLogout={handleLogout} />
      <main className="main-content">
        <Topbar role={auth.user.role} />
        {auth.demo && (
          <div className="demo-banner" role="status">
            Demo modu: değişiklikler yalnızca bu tarayıcıya kaydedilir; backend veritabanına gönderilmez.
          </div>
        )}
        {loading ? (
          <div className="page-content loading-state" role="status">Yardım masası verileri yükleniyor…</div>
        ) : loadError ? (
          <div className="page-content connection-error" role="alert">
            <h2>Yardım masası verileri yüklenemedi</h2>
            <p>{loadError}</p>
            <button
              className="primary-button"
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Yeniden bağlan
            </button>
          </div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={isStaff ? <Dashboard tickets={tickets} currentTime={currentTime} /> : <Navigate to="/my-tickets" replace />}
            />
            <Route
              path="/my-tickets"
              element={isStaff ? <TicketList tickets={tickets} mine currentUserId={auth.user.id} currentTime={currentTime} /> : employeeTickets}
            />
            <Route
              path="/tickets"
              element={isStaff ? <TicketList tickets={tickets} currentTime={currentTime} /> : <Navigate to="/my-tickets" replace />}
            />
            <Route
              path="/technicians"
              element={isStaff ? <Technicians users={users} /> : <Navigate to="/my-tickets" replace />}
            />
            <Route
              path="/tickets/new"
              element={(
                <NewTicket
                  onCreateTicket={handleCreateTicket}
                  employees={users.filter((user) => user.role === 'employee')}
                  currentUser={auth.user}
                  isDemo={auth.demo}
                />
              )}
            />
            <Route
              path="/tickets/:ticketId"
              element={
                <TicketDetails
                  tickets={tickets}
                  onUpdateTicket={handleUpdateTicket}
                  isStaff={isStaff}
                  isAdmin={isAdmin}
                  technicians={users.filter((user) => user.role === 'it_staff')}
                  currentTime={currentTime}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
