/**
 * Helpers for opening Unity AR layout exports in the 3D model preview screen.
 * Until Unity is embedded in RN, users save the .glb from Unity's share sheet,
 * then open it here with the document picker.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { Href } from 'expo-router';
import type { ExportResultPayload } from '@/types/unity-bridge';
import { projectService } from '@/services/ProjectService';

/** Mobile three.js preview struggles above this (full file is loaded into JS memory). */
const MAX_PREVIEW_BYTES = 40 * 1024 * 1024;

/** Normalize Unity persistentDataPath / file URIs for expo-file-system. */
export function toFileUri(pathOrUri: string): string {
  const value = String(pathOrUri || '').trim();
  if (!value) return '';
  if (value.startsWith('file://')) return value;
  if (value.startsWith('/')) return `file://${value}`;
  return value;
}

export function buildModelPreviewExportHref(options: {
  uri: string;
  title?: string;
  furnitureCount?: number;
  projectId?: string;
}): Href {
  const exportUri = toFileUri(options.uri);
  return {
    pathname: '/model-preview',
    params: {
      mode: 'export',
      exportUri,
      exportTitle: options.title || 'Exported layout',
      furnitureCount:
        options.furnitureCount != null ? String(options.furnitureCount) : undefined,
      projectId: options.projectId,
    },
  };
}

/**
 * Read ONLY the first 4 bytes. Never load the whole GLB (exports can be 100MB+).
 * GLB magic is ASCII "glTF".
 */
async function hasGlbMagicHeader(uri: string): Promise<boolean | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 4,
      position: 0,
    });
    // "glTF" → base64 "Z2xURg==" (often returned without padding)
    return base64.startsWith('Z2xURg');
  } catch (err) {
    console.warn('[modelPreviewExport] Partial GLB header read failed:', err);
    return null;
  }
}

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : '';
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * Pick a .glb saved from Unity's Android share sheet and prepare it for 3D preview.
 * Android pickers often omit/mangle extensions; we prefer a 4-byte header check
 * and never load the entire file just to validate it.
 */
export async function pickUnityExportGlb(options?: {
  saveToProjects?: boolean;
}): Promise<{ href: Href } | { cancelled: true } | { error: string }> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { cancelled: true };
    }

    const asset = result.assets[0];
    const sourceUri = asset.uri;
    const rawName = (asset.name || '').trim();
    const mime = (asset.mimeType || '').toLowerCase();
    const ext = extensionOf(rawName);

    if (ext === 'obj' || ext === 'fbx' || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') {
      return {
        error: 'Please choose the .glb file from Unity export (not an image or .obj).',
      };
    }

    const nameLooksOk =
      ext === 'glb' ||
      ext === 'gltf' ||
      /room-layout/i.test(rawName) ||
      mime.includes('gltf') ||
      mime.includes('glb');

    const magic = await hasGlbMagicHeader(sourceUri);
    // Accept when header says GLB, or name/mime looks right and header couldn't be read.
    const accept = magic === true || (magic === null && nameLooksOk) || (magic !== false && nameLooksOk);

    if (!accept) {
      return {
        error:
          'That file does not look like a Unity layout export. Choose the room-layout-….glb file from Downloads (or Files).',
      };
    }

    const displayName =
      rawName && /\.glb$/i.test(rawName)
        ? rawName
        : rawName
          ? `${rawName.replace(/\.[^.]+$/, '')}.glb`
          : `room-layout-${Date.now()}.glb`;

    const cacheRoot = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!cacheRoot) {
      return { error: 'No cache directory available on this device.' };
    }

    const safeName = displayName.replace(/[^a-zA-Z0-9._-]+/g, '-');
    const destName = /\.glb$/i.test(safeName) ? safeName : `${safeName}.glb`;
    const dest = `${cacheRoot}unity-exports/${Date.now()}-${destName}`;
    await FileSystem.makeDirectoryAsync(`${cacheRoot}unity-exports`, {
      intermediates: true,
    }).catch(() => undefined);

    // copyToCacheDirectory may already have copied; still normalize into our folder.
    await FileSystem.copyAsync({ from: sourceUri, to: dest });

    const info = await FileSystem.getInfoAsync(dest);
    const byteLength =
      info.exists && 'size' in info && typeof info.size === 'number'
        ? info.size
        : asset.size || 0;

    if (byteLength > MAX_PREVIEW_BYTES) {
      // Still save to Projects so the export is tracked, but don't open the WebGL viewer
      // (loading ~200MB into JS memory OOMs on most phones).
      if (options?.saveToProjects !== false) {
        const payload: ExportResultPayload = {
          success: true,
          path: dest.startsWith('file://') ? dest : `file://${dest}`,
          fileName: destName,
          byteLength,
          furnitureCount: 0,
          roomMeshCount: 0,
          error: '',
        };
        try {
          await projectService.saveUnityLayoutExport(payload);
        } catch (err) {
          console.warn('[modelPreviewExport] Could not save large GLB to Projects:', err);
        }
      }

      return {
        error:
          `This export is ${formatMb(byteLength)}, which is too large to open in the phone 3D viewer (limit ~${formatMb(MAX_PREVIEW_BYTES)}). ` +
          `It was saved to Projects. For in-app preview, export a lighter layout from Unity (fewer / smaller textures), or open the .glb on a PC.`,
      };
    }

    let projectId: string | undefined;
    if (options?.saveToProjects !== false) {
      const payload: ExportResultPayload = {
        success: true,
        path: dest.startsWith('file://') ? dest : `file://${dest}`,
        fileName: destName,
        byteLength,
        furnitureCount: 0,
        roomMeshCount: 0,
        error: '',
      };

      try {
        const project = await projectService.saveUnityLayoutExport(payload);
        projectId = project.id;
      } catch (err) {
        console.warn('[modelPreviewExport] Could not save picked GLB to Projects:', err);
      }
    }

    return {
      href: buildModelPreviewExportHref({
        uri: dest,
        title: destName,
        projectId,
      }),
    };
  } catch (err) {
    console.error('[modelPreviewExport] pickUnityExportGlb failed:', err);
    return {
      error: err instanceof Error ? err.message : 'Could not open the selected file.',
    };
  }
}
