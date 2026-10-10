import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveDesignGeneration, loadDesignGeneration, saveCustomizedLayout, loadCustomizedLayout,
  saveFinalizedDesign, loadFinalizedDesign,
} from '@/utils/designFlowStorage';
import type { CustomizedDesignLayout, DesignFlowGenerationResult } from '@/types/design-flow';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const draft: CustomizedDesignLayout = {
  proposalId: 'old-proposal', sessionId: 'old-session',
  room: { width: 4, length: 5, height: 2.7 }, items: [], totalPhp: 0, updatedAt: 1,
};
const generation: DesignFlowGenerationResult = {
  sessionId: 'new-session', room: draft.room,
  preferences: { roomType: 'Bedroom', style: 'Minimalist', budgetPhp: 30000, requiredItemIds: [], requiredCategories: [] },
  proposals: [{ id: 'new-proposal', title: 'New room', description: '', items: [], totalPhp: 0,
    overBudget: false, colorPalette: [], score: { overall: 0, space: 0, flow: 0, budgetFit: 100 } }],
};

beforeEach(async () => { jest.restoreAllMocks(); await AsyncStorage.clear(); });

it('starts a fresh generation without reopening the previous room edits or final', async () => {
  await saveCustomizedLayout(draft);
  await saveFinalizedDesign({ sessionId: 'old-session', status: 'finalized', finalLayout: draft, finalizedAt: 1 });
  await saveDesignGeneration(generation);
  expect(await loadDesignGeneration()).toEqual(generation);
  expect(await loadCustomizedLayout()).toBeNull();
  expect(await loadFinalizedDesign()).toBeNull();
});

it('reports storage failures so navigation cannot claim the draft was saved', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Storage full'));
  await expect(saveCustomizedLayout(draft)).rejects.toThrow('Storage full');
});
