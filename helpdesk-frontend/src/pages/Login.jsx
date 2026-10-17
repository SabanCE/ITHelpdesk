import { useEffect, useState } from 'react';
import { isBackendAvailable } from '../api.js';

export default function Login({ onLogin, notice = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(null);
  const [backendStatusError, setBackendStatusError] = useState('');

  useEffect(() => {
    let cancelled = false;

    isBackendAvailable()
      .then((available) => {
        if (!cancelled) setBackendAvailable(available);
      })
      .catch((statusError) => {
        if (!cancelled) setBackendStatusError(statusError.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await onLogin({ email: email.trim(), password });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-icon">H</span>
          <div>
            <strong>HelpDesk</strong>
            <span>BT Destek Portalı</span>
          </div>
        </div>
        <div className="login-heading">
          <h1>Hesabınıza giriş yapın</h1>
          <p>Devam etmek için e-posta adresinizi ve şifrenizi girin.</p>
        </div>

        <form className="ticket-form login-form" onSubmit={handleSubmit}>
          {notice && <p className="form-notice" role="status">{notice}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <label>
            E-posta adresi
            <input
              autoComplete="username"
              autoFocus
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ornek@kurum.com"
            />
          </label>
          <label>
            Şifre
            <input
              autoComplete="current-password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Şifrenizi girin"
            />
          </label>
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
        <p className="login-note">
          {backendAvailable
            ? 'Sunucuya bağlısınız. Sunucuda kayıtlı hesabınızla giriş yapın.'
            : 'Erişim yetkiniz hesabınızın rolüne göre belirlenir.'}
        </p>
        {backendStatusError && (
          <p className="form-error" role="alert">
            Sunucu durumu kontrol edilemedi: {backendStatusError}
          </p>
        )}
        {backendAvailable === false && (
          <section className="demo-credentials" aria-label="Demo giriş bilgileri">
            <strong>Sunucuya ulaşılamıyor; demo modu kullanılabilir.</strong>
            <p>Demo verileri yalnızca bu tarayıcıda saklanır.</p>
            <ul>
              <li><span>Çalışan</span> employee@demo.local / Employee123!</li>
              <li><span>BT personeli</span> it.staff@demo.local / Staff123!</li>
              <li><span>BT yöneticisi</span> it.admin@demo.local / Admin123!</li>
            </ul>
          </section>
        )}
      </section>
    </main>
  );
}
