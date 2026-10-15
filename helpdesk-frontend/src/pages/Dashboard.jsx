import { Link } from 'react-router-dom';
import { formatTicketId } from '../api.js';
import { priorityLabel, statusLabel } from '../translations.js';
import { formatElapsedTime } from '../ticketTime.js';

const statusLabels = [
  { label: 'Toplam Talep', status: 'all', note: 'Kayıtlı tüm destek talepleri' },
  { label: 'Açık Talepler', status: 'Open', note: 'Destek bekleyen talepler' },
  { label: 'İşlemde', status: 'In Progress', note: 'Üzerinde çalışılan talepler' },
  { label: 'Çözüldü', status: 'Resolved', note: 'Başarıyla tamamlanan talepler' },
];

function statusClass(status) {
  return status.toLowerCase().replace(' ', '-');
}

export default function Dashboard({ tickets, currentTime }) {
  const stats = statusLabels.map((stat) => ({
    ...stat,
    value:
      stat.status === 'all'
        ? tickets.length
        : tickets.filter((ticket) => ticket.status === stat.status).length,
  }));
  const recentTickets = tickets.slice(0, 5);

  return (
    <div className="dashboard-content">
      <div className="welcome-row">
        <div>
          <h2>Tekrar hoş geldiniz!</h2>
          <p>Destek taleplerinizdeki son gelişmeler burada.</p>
        </div>

        <Link className="primary-button" to="/tickets/new">+ Talep Oluştur</Link>
      </div>

      <section className="stats-grid" aria-label="Talep özeti">
        {stats.map((stat) => (
          <Link
            className="stat-card"
            key={stat.label}
            to={stat.status === 'all' ? '/tickets' : `/tickets?status=${encodeURIComponent(stat.status)}`}
          >
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span>{stat.note}</span>
          </Link>
        ))}
      </section>

      <section className="ticket-panel" aria-labelledby="recent-tickets-heading">
        <div className="panel-heading">
          <div>
            <h2 id="recent-tickets-heading">Son Talepler</h2>
              <p>En son oluşturulan destek talepleri</p>
          </div>
            <Link className="secondary-button" to="/tickets">Tümünü gör</Link>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Talep</th>
                <th scope="col">Talep Sahibi</th>
                <th scope="col">Öncelik</th>
                <th scope="col">Durum</th>
                <th scope="col">Geçen süre</th>
              </tr>
            </thead>
            <tbody>
              {recentTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link className="ticket-link" to={`/tickets/${ticket.id}`}>
                      <strong>{ticket.title}</strong>
                      <span className="ticket-id">#{formatTicketId(ticket.id)}</span>
                    </Link>
                  </td>
                  <td>{ticket.requester}</td>
                  <td>
                    <span className={`priority ${ticket.priority.toLowerCase()}`}>
                      {priorityLabel(ticket.priority)}
                    </span>
                  </td>
                  <td>
                    <span className={`ticket-status ${statusClass(ticket.status)}`}>
                      {statusLabel(ticket.status)}
                    </span>
                  </td>
                  <td>{formatElapsedTime(ticket, currentTime)}</td>
                </tr>
              ))}
              {recentTickets.length === 0 && (
                <tr><td className="table-empty" colSpan="5">Henüz talep yok. Başlamak için ilk talebinizi oluşturun.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
