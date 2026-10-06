export function formatPhp(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `₱${safe.toLocaleString('en-PH')}`;
}

export function formatMeters(value: number, digits = 2): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${Number(safe.toFixed(digits))}m`;
}

export function clampBudgetPhp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function parseDimensionParam(value?: string | string[]): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function firstParam(value?: string | string[]): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
