import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatTicketId, getTicketHistory } from '../api.js';
import { priorityLabel, statusLabel } from '../translations.js';
import { formatElapsedTime } from '../ticketTime.js';

function formatDate(date) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export default function TicketDetails({
  tickets,
  onUpdateTicket,
  onDeleteTicket,
  isStaff,
  isAdmin,
  currentUserId,
  technicians = [],
  currentTime,
}) {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const ticket = tickets.find((item) => item.id === ticketId);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [assignmentDraft, setAssignmentDraft] = useState(null);
  const [statusDraft, setStatusDraft] = useState(null);
  const currentAssignment = ticket?.assignedTo ? String(ticket.assignedTo) : '';
  const assignedTo = assignmentDraft?.ticketId === ticketId
    && assignmentDraft.serverAssignment === currentAssignment
    ? assignmentDraft.value
    : currentAssignment;
  const status = statusDraft?.ticketId === ticketId
    && statusDraft.serverStatus === ticket?.status
    ? statusDraft.value
    : ticket?.status ?? '';

  useEffect(() => {
    let cancelled = false;

    getTicketHistory(ticketId)
      .then((records) => {
        if (!cancelled) {
          setHistory(records);
          setHistoryError('');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setHistoryError(error.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ticketId, ticket?.status]);

  if (!ticket) {
    return (
      <div className="page-content empty-state">
        <h2>Talep bulunamadı</h2>
        <p>Talep silinmiş veya bağlantı hatalı olabilir.</p>
        <Link className="secondary-button" to="/tickets">Taleplere dön</Link>
      </div>
    );
  }

  async function saveStatus() {
    setActionError('');
    setUpdating(true);

    try {
      await onUpdateTicket(ticket, { status });
    } catch (error) {
      setActionError(error.message);
    } finally {
      setUpdating(false);
    }
  }

  async function saveAssignment() {
    setActionError('');
    setUpdating(true);

    try {
      await onUpdateTicket(ticket, {
        assignedTo: assignedTo ? Number(assignedTo) : null,
      });
    } catch (error) {
      setActionError(error.message);
    } finally {
      setUpdating(false);
    }
  }

  async function releaseAssignment() {
    setActionError('');
    setUpdating(true);

    try {
      await onUpdateTicket(ticket, { assignedTo: null });
    } catch (error) {
      setActionError(error.message);
    } finally {
      setUpdating(false);
    }
  }

  async function deleteTicket() {
    setActionError('');
    setUpdating(true);

    try {
      await onDeleteTicket(ticket);
    } catch (error) {
      setActionError(error.message);
      setUpdating(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <p className="ticket-id">#{formatTicketId(ticket.id)} · {formatDate(ticket.createdAt)}</p>
          <h2>{ticket.title}</h2>
        </div>
        <div className="detail-actions">
          <button className="secondary-button" type="button" onClick={() => navigate(-1)}>Geri</button>
          {isStaff && (
            <div className="status-controls">
              <label>
                Talep durumu
                <select
                  value={status}
                  onChange={(event) => setStatusDraft({
                    ticketId,
                    serverStatus: ticket.status,
                    value: event.target.value,
                  })}
                >
                  <option value="Open">Açık</option>
                  <option value="In Progress" disabled={!ticket.assignedTo}>İşlemde</option>
                  <option value="Resolved">Çözüldü</option>
                </select>
              </label>
              <button
                className="primary-button"
                type="button"
                onClick={saveStatus}
                disabled={updating || status === ticket.status}
              >
                {updating ? 'Kaydediliyor…' : 'Durumu güncelle'}
              </button>
              {!isAdmin && String(ticket.assignedTo) === String(currentUserId) && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={releaseAssignment}
                  disabled={updating}
                >
                  {updating ? 'Kuyruğa alınıyor…' : 'İşi bırak, kuyruğa al'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      <section className="detail-card">
        <div className="detail-badges">
          <span className={`priority ${ticket.priority.toLowerCase()}`}>{priorityLabel(ticket.priority)} öncelik</span>
          <span className={`ticket-status ${ticket.status.toLowerCase().replace(' ', '-')}`}>{statusLabel(ticket.status)}</span>
        </div>
        <h3>Açıklama</h3>
        <p className="ticket-description">{ticket.description}</p>
        <div className="detail-meta">
          <div><span>Talep sahibi</span><strong>{ticket.requester}</strong></div>
          <div><span>Atanan personel</span><strong>{ticket.assignee}</strong></div>
          <div><span>Öncelik</span><strong>{priorityLabel(ticket.priority)}</strong></div>
          <div><span>Oluşturulma</span><strong>{formatDate(ticket.createdAt)}</strong></div>
          <div><span>Çözüm süresi</span><strong>{formatElapsedTime(ticket, currentTime)}</strong></div>
        </div>
        {isAdmin && (
          <div className="assignment-controls">
            <label>
              Sorumlu BT personeli
              <select
                value={assignedTo}
                onChange={(event) => setAssignmentDraft({
                  ticketId,
                  serverAssignment: currentAssignment,
                  value: event.target.value,
                })}
              >
                <option value="">Atama yok</option>
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button"
              type="button"
              onClick={saveAssignment}
              disabled={updating || String(ticket.assignedTo ?? '') === assignedTo}
            >
              {updating ? 'Kaydediliyor…' : 'Personeli ata'}
            </button>
          </div>
        )}
        {isAdmin && (
          <div className="assignment-controls">
            {confirmDelete ? (
              <>
                <p role="alert">
                  Bu talep ve durum geçmişi kalıcı olarak silinecek. Emin misiniz?
                </p>
                <button
                  className="danger-button"
                  type="button"
                  onClick={deleteTicket}
                  disabled={updating}
                >
                  {updating ? 'Siliniyor…' : 'Evet, talebi sil'}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={updating}
                >
                  Vazgeç
                </button>
              </>
            ) : (
              <button
                className="danger-button"
                type="button"
                onClick={() => setConfirmDelete(true)}
              >
                Talebi sil
              </button>
            )}
          </div>
        )}
        {!ticket.assignedTo && ticket.status !== 'Resolved' && (
          <p className="history-empty">Personel ataması yapılana kadar talep açık kalır.</p>
        )}
      </section>

      <section className="detail-card history-card" aria-labelledby="history-heading">
        <h3 id="history-heading">Durum geçmişi</h3>
        {historyError ? (
          <p className="form-error" role="alert">Talep geçmişi yüklenemedi: {historyError}</p>
        ) : history.length === 0 ? (
          <p className="history-empty">Henüz durum değişikliği kaydedilmemiş.</p>
        ) : (
          <ul className="history-list">
            {history.map((entry) => (
              <li key={entry.Id}>
                    {entry.OldStatus === entry.NewStatus ? (
                      <span>{entry.ChangedByName} talebi yeniden atama kuyruğuna bıraktı.</span>
                    ) : (
                      <>
                        <span className={`ticket-status ${entry.OldStatus.replaceAll('_', '-').toLowerCase()}`}>
                          {statusLabel(entry.OldStatus)}
                        </span>
                        <span aria-hidden="true">→</span>
                        <span className={`ticket-status ${entry.NewStatus.replaceAll('_', '-').toLowerCase()}`}>
                          {statusLabel(entry.NewStatus)}
                        </span>
                      </>
                    )}
                <span className="history-entry-meta">
                  {entry.ChangedByName} · {formatDate(entry.CreatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
