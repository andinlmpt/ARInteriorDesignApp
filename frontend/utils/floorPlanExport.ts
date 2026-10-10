/**
 * Floor Plan Export
 * Saves the final design's floor plan PDF where the user can open and share it:
 * on Android through the system folder picker (e.g. Downloads), on iOS through the
 * share sheet. Uses only expo-file-system, so no extra native module is needed.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';
import { buildFloorPlanPdf, type FloorPlanPdfInput } from '@/utils/floorPlanPdf';

export type FloorPlanExportResult = { saved: true; uri: string } | { saved: false };

export function floorPlanFileName(title: string, date = new Date()): string {
  const slug = (title || 'design').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'design';
  return `${slug}-floor-plan-${date.toISOString().slice(0, 10)}.pdf`;
}

export async function exportFloorPlanPdf(input: FloorPlanPdfInput): Promise<FloorPlanExportResult> {
  const pdf = buildFloorPlanPdf(input);
  const fileName = floorPlanFileName(input.title, input.generatedAt);

  if (Platform.OS === 'android') {
    const { StorageAccessFramework } = FileSystem;
    const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return { saved: false };
    const uri = await StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      fileName.replace(/\.pdf$/, ''),
      'application/pdf',
    );
    await FileSystem.writeAsStringAsync(uri, pdf);
    return { saved: true, uri };
  }

  const uri = `${FileSystem.documentDirectory || ''}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, pdf);
  const shared = await Share.share({ url: uri, title: fileName });
  return shared.action === Share.dismissedAction ? { saved: false } : { saved: true, uri };
}
