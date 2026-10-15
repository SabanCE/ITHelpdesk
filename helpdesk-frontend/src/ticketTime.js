export function formatElapsedTime(ticket, now = Date.now()) {
  const createdAt = Date.parse(ticket.createdAt);
  const resolvedAt = ticket.resolvedAt ? Date.parse(ticket.resolvedAt) : null;
  const endTime = resolvedAt ?? (
    ticket.status === 'Resolved' ? null : now
  );

  if (!Number.isFinite(createdAt) || endTime === null || !Number.isFinite(endTime)) {
    return 'Süre kaydı yok';
  }

  const elapsedMinutes = Math.max(0, Math.floor((endTime - createdAt) / 60_000));
  return `${elapsedMinutes} dk`;
}
