import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatTicketId } from '../api.js';
import { priorityLabel, statusLabel } from '../translations.js';

const priorityOrder = { High: 0, Medium: 1, Low: 2 };

function isActiveTicket(ticket) {
  const status = ticket.status.toLowerCase().replaceAll('_', ' ');
  return !['resolved', 'closed'].includes(status);
}

export default function AdminAssignments({ tickets, technicians, onAssign }) {
  const [selectedTechnicians, setSelectedTechnicians] = useState({});
  const [savingTicketId, setSavingTicketId] = useState(null);
  const [error, setError] = useState('');
  const unassignedTickets = tickets
    .filter((ticket) =>
      !ticket.assignedTo && !['Resolved', 'Closed'].includes(ticket.status),
    )
    .sort((first, second) =>
      priorityOrder[first.priority] - priorityOrder[second.priority]
        || Date.parse(first.createdAt) - Date.parse(second.createdAt)
        || Number(first.id) - Number(second.id));
  const busyTechnicianIds = new Set(
    tickets
      .filter((ticket) => ticket.assignedTo && isActiveTicket(ticket))
      .map((ticket) => String(ticket.assignedTo)),
  );
  const idleTechnicians = technicians.filter(
    (technician) => !busyTechnicianIds.has(String(technician.id)),
  );

  async function assign(ticket) {
    const technicianId = selectedTechnicians[ticket.id];
    if (!technicianId) {
      setError('Atanacak BT personelini seçin.');
      return;
    }

    setError('');
    setSavingTicketId(ticket.id);
    try {
      await onAssign(ticket, Number(technicianId));
    } catch (assignError) {
      setError(assignError.message);
    } finally {
      setSavingTicketId(null);
    }
  }

  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <h2>Atama kuyruğu</h2>
          <p>
            {unassignedTickets.length} atanmamış talep · Otomatik sıra öncelik ve bekleme süresine göredir.
          </p>
        </div>
        <Link className="secondary-button" to="/tickets">Tüm talepler</Link>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="detail-card idle-staff-card" aria-labelledby="idle-staff-heading">
        <div className="idle-staff-heading">
          <h3 id="idle-staff-heading">Boşta personel</h3>
          <span>{idleTechnicians.length} kişi</span>
        </div>
        {idleTechnicians.length > 0 ? (
          <ul className="idle-staff-list">
            {idleTechnicians.map((technician) => (
              <li key={technician.id}>{technician.name}</li>
            ))}
          </ul>
        ) : (
          <p className="idle-staff-empty" role="status">Şu anda boşta personel yok.</p>
        )}
      </section>
      {unassignedTickets.length === 0 ? (
        <section className="detail-card assignment-empty">
          <h3>Atanmamış talep yok</h3>
          <p>Yeni talepler otomatik olarak boşta olan BT personeline atanır.</p>
        </section>
      ) : (
        <section className="assignment-queue" aria-label="Atanmamış talepler">
          {unassignedTickets.map((ticket) => (
            <article className="detail-card assignment-item" key={ticket.id}>
              <div>
                <p className="ticket-id">#{formatTicketId(ticket.id)} · {priorityLabel(ticket.priority)} öncelik</p>
                <h3><Link to={`/tickets/${ticket.id}`}>{ticket.title}</Link></h3>
                <p>{ticket.requester} · {statusLabel(ticket.status)}</p>
              </div>
              <div className="queue-assignment-controls">
                <label>
                  BT personeli
                  <select
                    aria-label={`${ticket.title} için BT personeli`}
                    value={selectedTechnicians[ticket.id] ?? ''}
                    onChange={(event) => setSelectedTechnicians((current) => ({
                      ...current,
                      [ticket.id]: event.target.value,
                    }))}
                  >
                    <option value="">Otomatik atama bekliyor</option>
                    {technicians.map((technician) => (
                      <option key={technician.id} value={technician.id}>
                        {technician.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary-button"
                  type="button"
                  disabled={savingTicketId === ticket.id || technicians.length === 0}
                  onClick={() => assign(ticket)}
                >
                  {savingTicketId === ticket.id ? 'Atanıyor…' : 'Manuel ata'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
