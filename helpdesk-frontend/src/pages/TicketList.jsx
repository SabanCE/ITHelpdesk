import { Link, useLocation } from 'react-router-dom';
import { formatTicketId } from '../api.js';
import { priorityLabel, statusLabel } from '../translations.js';
import { formatElapsedTime } from '../ticketTime.js';

function statusClass(status) {
  return status.toLowerCase().replace(' ', '-');
}

export default function TicketList({
  tickets,
  mine = false,
  employeeView = false,
  currentUserId,
  currentTime,
}) {
  const { search } = useLocation();
  const selectedStatus = new URLSearchParams(search).get('status');
  const visibleTickets = tickets.filter((ticket) => {
    const matchesOwner = !mine || String(ticket.assignedTo) === String(currentUserId);
    const matchesStatus = !selectedStatus || ticket.status === selectedStatus;
    return matchesOwner && matchesStatus;
  });

  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <h2>{employeeView ? 'Taleplerim' : mine ? 'Bana atanan talepler' : selectedStatus ? `${statusLabel(selectedStatus)} talepler` : 'Tüm destek talepleri'}</h2>
          <p>{visibleTickets.length} talep listeleniyor</p>
        </div>
        <Link className="primary-button" to="/tickets/new">+ Yeni Talep Oluştur</Link>
      </div>

      <div className="filter-row">
        <Link className={!selectedStatus ? 'filter-chip selected' : 'filter-chip'} to={mine ? '/my-tickets' : '/tickets'}>Tüm durumlar</Link>
        {['Open', 'In Progress', 'Resolved'].map((status) => (
          <Link
            className={selectedStatus === status ? 'filter-chip selected' : 'filter-chip'}
            key={status}
            to={`${mine ? '/my-tickets' : '/tickets'}?status=${encodeURIComponent(status)}`}
          >
            {statusLabel(status)}
          </Link>
        ))}
      </div>

      <section className="ticket-panel">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">Talep</th>
                {!employeeView && <th scope="col">Talep Sahibi</th>}
                <th scope="col">Atanan Personel</th>
                <th scope="col">Öncelik</th>
                <th scope="col">Durum</th>
                <th scope="col">Geçen süre</th>
              </tr>
            </thead>
            <tbody>
              {visibleTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link className="ticket-link" to={`/tickets/${ticket.id}`}>
                      <strong>{ticket.title}</strong>
                      <span className="ticket-id">#{formatTicketId(ticket.id)}</span>
                    </Link>
                  </td>
                  {!employeeView && <td>{ticket.requester}</td>}
                  <td>{ticket.assignee}</td>
                  <td><span className={`priority ${ticket.priority.toLowerCase()}`}>{priorityLabel(ticket.priority)}</span></td>
                  <td><span className={`ticket-status ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</span></td>
                  <td>{formatElapsedTime(ticket, currentTime)}</td>
                </tr>
              ))}
              {visibleTickets.length === 0 && (
                <tr><td className="table-empty" colSpan={employeeView ? 5 : 6}>Bu filtreye uygun talep bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
