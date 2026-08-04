// Shared masking helpers for unclaimed provider listings — used by both the
// inline city-page card and the standalone provider profile page. Masking
// happens server-side so unclaimed listings never ship the real digits in
// the HTML; otherwise the "$9.99/mo to unlock" gate is bypassable via
// view-source.

export function maskPhone(raw: string): string {
  const match = raw.match(/^(\(\d{3}\))\s*(.*)$/);
  if (!match) return raw.replace(/\d/g, '•');
  const [, areaCode, rest] = match;
  return `${areaCode} ${rest.replace(/\d/g, '•')}`;
}

export function maskStreet(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[A-Za-z0-9]/g, '•');
}
