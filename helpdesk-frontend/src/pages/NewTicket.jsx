import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function NewTicket({
  onCreateTicket,
  employees = [],
  currentUser,
  isDemo = false,
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [createdBy, setCreatedBy] = useState(
    currentUser?.role === 'employee' ? String(currentUser.id) : '',
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await onCreateTicket({
        title: title.trim(),
        description: description.trim(),
        priority,
        createdBy,
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-content form-page">
      <div className="page-heading">
        <div>
          <h2>Destek talebi oluşturun</h2>
          <p>
            {isDemo
              ? 'Demo talebi bu tarayıcıda saklanacaktır.'
              : 'Talebiniz Yardım Masası veritabanına kaydedilecektir.'}
          </p>
        </div>
        <Link className="secondary-button" to="/">İptal</Link>
      </div>

      <form className="ticket-form" onSubmit={handleSubmit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <label>
          Talep başlığı
          <input
            autoFocus
            required
            maxLength="100"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Sorununuzu kısaca açıklayın"
          />
        </label>
        <div className="form-fields-row single-field">
          {currentUser?.role !== 'employee' && (
            <label>
              Talep sahibi çalışan
              <select
                required
                value={createdBy}
                onChange={(event) => setCreatedBy(event.target.value)}
              >
                <option value="">Çalışan seçin</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
              Öncelik
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
            </select>
          </label>
        </div>
        <label>
          Açıklama
          <textarea
            required
            rows="6"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Talebinizin çözülmesine yardımcı olacak ayrıntıları ekleyin"
          />
        </label>
        <div className="form-actions">
          <Link className="secondary-button" to="/">İptal</Link>
          <button className="primary-button" type="submit" disabled={submitting || (currentUser?.role !== 'employee' && employees.length === 0)}>
            {submitting ? 'Gönderiliyor…' : 'Talebi Gönder'}
          </button>
        </div>
      </form>
    </div>
  );
}
