import AsyncStorage from '@react-native-async-storage/async-storage';
import { getJson, removeKey } from '@/utils/storage';
import type {
  CustomizedDesignLayout,
  DesignFlowGenerationResult,
  SavedFinalDesignResponse,
} from '@/types/design-flow';

const STORAGE_KEY = 'designFlowLastGeneration';
const CUSTOMIZED_KEY = 'designFlowCustomizedLayout';
const FINALIZED_KEY = 'designFlowLastFinalized';

export async function saveDesignGeneration(
  result: DesignFlowGenerationResult,
): Promise<void> {
  // A fresh generation starts a new draft; the previous room's edits/final cannot win.
  await AsyncStorage.multiRemove([CUSTOMIZED_KEY, FINALIZED_KEY]);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(result));
}

export async function loadDesignGeneration(): Promise<DesignFlowGenerationResult | null> {
  const stored = await getJson<DesignFlowGenerationResult | null>(STORAGE_KEY, null);
  if (!stored || !Array.isArray(stored.proposals) || stored.proposals.length === 0) {
    return null;
  }
  return stored;
}

export async function clearDesignGeneration(): Promise<void> {
  await removeKey(STORAGE_KEY);
  await removeKey(CUSTOMIZED_KEY);
  await removeKey(FINALIZED_KEY);
}

export async function saveCustomizedLayout(layout: CustomizedDesignLayout): Promise<void> {
  await AsyncStorage.setItem(CUSTOMIZED_KEY, JSON.stringify(layout));
}

export async function loadCustomizedLayout(): Promise<CustomizedDesignLayout | null> {
  const stored = await getJson<CustomizedDesignLayout | null>(CUSTOMIZED_KEY, null);
  if (!stored || !Array.isArray(stored.items)) return null;
  return stored;
}

export async function saveFinalizedDesign(result: SavedFinalDesignResponse): Promise<void> {
  await AsyncStorage.setItem(FINALIZED_KEY, JSON.stringify(result));
}

export async function loadFinalizedDesign(): Promise<SavedFinalDesignResponse | null> {
  const stored = await getJson<SavedFinalDesignResponse | null>(FINALIZED_KEY, null);
  if (!stored?.finalLayout) return null;
  return stored;
}
