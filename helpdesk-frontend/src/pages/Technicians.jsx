export default function Technicians({ users }) {
  const technicians = users.filter((user) => user.role === 'it_staff');

  return (
    <div className="page-content">
      <div className="page-heading">
        <div>
          <h2>Destek ekibimiz</h2>
          <p>Yardım Masası veritabanına kayıtlı teknik destek personeli.</p>
        </div>
        <span className="team-count">{technicians.length} ekip üyesi</span>
      </div>

      <section className="technician-grid" aria-label="Teknik ekip listesi">
        {technicians.map((technician) => (
          <article className="technician-card" key={technician.id}>
            <div className="technician-avatar">
              {technician.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span className="availability available">BT Personeli</span>
            <h3>{technician.name}</h3>
            <p>Teknik Destek Uzmanı</p>
          </article>
        ))}
        {technicians.length === 0 && (
          <p className="table-empty">Kayıtlı BT personeli bulunmuyor.</p>
        )}
      </section>
    </div>
  );
}
