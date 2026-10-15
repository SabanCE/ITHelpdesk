import { useState } from 'react';
import { useLocation } from 'react-router-dom';

const pageTitles = [
  { path: '/my-tickets', title: 'Taleplerim', breadcrumb: 'Çalışma alanı / Taleplerim' },
  { path: '/tickets/new', title: 'Yeni Talep', breadcrumb: 'Çalışma alanı / Yeni talep' },
  { path: '/tickets', title: 'Tüm Talepler', breadcrumb: 'Çalışma alanı / Talepler' },
  { path: '/technicians', title: 'Teknik Ekip', breadcrumb: 'Çalışma alanı / Ekip' },
];

export default function Topbar({ role }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const { pathname } = useLocation();
  const currentPage = pageTitles.find(({ path }) => pathname.startsWith(path));
  const isTicketDetails =
    /^\/tickets\/[^/]+$/.test(pathname) && pathname !== '/tickets/new';
  const title = isTicketDetails
    ? 'Talep Detayı'
    : currentPage?.title ?? (role === 'employee' ? 'Taleplerim' : 'Kontrol Paneli');
  const breadcrumb = isTicketDetails
    ? 'Çalışma alanı / Talep detayı'
    : currentPage?.breadcrumb ?? (
      role === 'employee'
        ? 'Çalışma alanı / Taleplerim'
        : 'Çalışma alanı / Genel Bakış'
    );

  return (
    <header className="topbar">
      <div>
        <p className="breadcrumb">{breadcrumb}</p>
        <h1>{title}</h1>
      </div>

      <div className="topbar-actions">
        <span className="system-status">
          <span className="status-dot" />
          Sistem çalışıyor
        </span>
        <div className="notification-wrap">
          <button
            className="notification-button"
            type="button"
            aria-label="Bildirimler"
            aria-expanded={showNotifications}
            onClick={() => setShowNotifications((visible) => !visible)}
          >
          ♧
          </button>
          {showNotifications && (
            <div className="notification-popover" role="status">
              <strong>Yeni bildiriminiz yok</strong>
              <span>Şu anda görüntülenecek bildirim bulunmuyor.</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
