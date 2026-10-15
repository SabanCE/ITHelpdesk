import { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
        <p className="login-note">Erişim yetkiniz hesabınızın rolüne göre belirlenir.</p>
        <section className="demo-credentials" aria-label="Demo giriş bilgileri">
          <strong>Şuan Demo Sürümündesin ! Sunucu çalışmıyor.</strong>
          <p>Full repository de sunucu tarafı bulunmaktadır. Demo verileri bu tarayıcıda saklanır.</p>
          <ul>
            <li><span>Çalışan</span> employee@demo.local / Employee123!</li>
            <li><span>BT personeli</span> it.staff@demo.local / Staff123!</li>
            <li><span>BT yöneticisi</span> it.admin@demo.local / Admin123!</li>
          </ul>
          <small>Backend çalışırken bu demo hesapları devre dışıdır.</small>
        </section>
      </section>
    </main>
  );
}
