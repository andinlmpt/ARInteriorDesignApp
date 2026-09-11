/**
 * Persists confirmed AR room measurements to MongoDB via the backend.
 */

import { callApi } from './apiClient';
import type {
  RoomMeasurementListResponse,
  RoomMeasurementRecord,
  RoomMeasurementResponse,
  SaveRoomMeasurementInput,
} from '@/types/room-measurement';

export class RoomMeasurementService {
  static async save(input: SaveRoomMeasurementInput): Promise<RoomMeasurementRecord> {
    const response = await callApi<RoomMeasurementResponse>('/room-measurements', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.measurement;
  }

  static async getAll(projectId?: string): Promise<RoomMeasurementRecord[]> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const response = await callApi<RoomMeasurementListResponse>(`/room-measurements${query}`);
    return response.measurements ?? [];
  }

  static async getById(id: string): Promise<RoomMeasurementRecord | null> {
    const response = await callApi<RoomMeasurementResponse>(
      `/room-measurements/${encodeURIComponent(id)}`,
    );
    return response.measurement ?? null;
  }
}
