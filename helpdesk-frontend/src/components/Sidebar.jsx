import { NavLink, Link } from 'react-router-dom';

const menuItems = [
  { label: 'Kontrol Paneli', icon: '▦', to: '/', roles: ['it_staff', 'it_admin'] },
  { label: 'Tüm Talepler', icon: '▤', to: '/tickets', roles: ['it_staff', 'it_admin'] },
  { label: 'Taleplerim', icon: '◷', to: '/my-tickets', role: 'employee' },
  { label: 'Teknik Ekip', icon: '♙', to: '/technicians', roles: ['it_staff', 'it_admin'] },
  { label: 'Yeni Talep', icon: '+', to: '/tickets/new', roles: ['employee', 'it_staff', 'it_admin'] },
];

export default function Sidebar({ user, onLogout }) {
  const initials = user?.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="sidebar">
      <Link className="brand" to="/" aria-label="Yardım masası kontrol paneli">
        <div className="brand-icon">H</div>
        <div>
          <strong>HelpDesk</strong>
          <span>BT Destek Portalı</span>
        </div>
      </Link>

      <p className="menu-heading">ÇALIŞMA ALANI</p>

      <nav className="side-menu" aria-label="Ana menü">
        {menuItems.filter((item) => item.roles?.includes(user.role) || item.role === user.role).map((item) => (
          <NavLink
            to={item.to}
            key={item.label}
            end={item.to === '/'}
            className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
          >
            <span className="menu-icon" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="avatar" aria-hidden="true">{initials || 'BT'}</div>
        <div>
          <strong>{user.name}</strong>
          <span>
            {user.role === 'it_admin'
              ? 'BT Yöneticisi'
              : user.role === 'it_staff'
                ? 'BT Personeli'
                : 'Çalışan'}
          </span>
        </div>
        <button className="logout-button" type="button" onClick={onLogout} aria-label="Oturumu kapat" title="Oturumu kapat">↪</button>
      </div>
    </aside>
  );
}
