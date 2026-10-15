const statuses = {
  Open: 'Açık',
  'In Progress': 'İşlemde',
  Resolved: 'Çözüldü',
  Closed: 'Kapatıldı',
  open: 'Açık',
  in_progress: 'İşlemde',
  resolved: 'Çözüldü',
  closed: 'Kapatıldı',
};

const priorities = {
  Low: 'Düşük',
  Medium: 'Orta',
  High: 'Yüksek',
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
};

export function statusLabel(status) {
  return statuses[status] ?? status;
}

export function priorityLabel(priority) {
  return priorities[priority] ?? priority;
}
