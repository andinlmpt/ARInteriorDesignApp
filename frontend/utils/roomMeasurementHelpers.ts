import type { RoomMeasurementRecord } from '@/types/room-measurement';

const METRES_TO_FEET = 3.28084;

export function formatRoomDate(iso?: string): string {
  if (!iso) return 'Unknown date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatFloorArea(sqm: number, metricUnits: boolean): string {
  if (!sqm || sqm <= 0) return '—';
  if (metricUnits) return `${sqm.toFixed(1)} m²`;
  const sqft = sqm * 10.7639;
  return `${sqft.toFixed(0)} ft²`;
}

export function formatRoomDimensions(
  record: RoomMeasurementRecord,
  metricUnits: boolean,
): string {
  if (record.dimensionLabel?.trim()) {
    return record.dimensionLabel.trim();
  }

  const { width, depth, height } = record;
  if (width <= 0 || depth <= 0 || height <= 0) return '—';

  if (metricUnits) {
    return `L ${formatMetres(depth)} × W ${formatMetres(width)} × H ${formatMetres(height)}`;
  }

  return `L ${formatFeet(depth)} × W ${formatFeet(width)} × H ${formatFeet(height)}`;
}

function formatMetres(metres: number): string {
  return metres >= 1 ? `${metres.toFixed(1)}m` : `${Math.round(metres * 100)}cm`;
}

function formatFeet(metres: number): string {
  const feet = metres * METRES_TO_FEET;
  return feet >= 1 ? `${feet.toFixed(1)}ft` : `${Math.round(feet * 12)}in`;
}
