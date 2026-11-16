import React, { act } from 'react';
import { useLayoutAlignment } from '@/hooks/useLayoutAlignment';
import type { UnityARViewerHandle } from '@/components/UnityARViewer';
import type { LayoutAlignmentPayload } from '@/types/unity-bridge';

// jest-expo supplies the renderer without separate TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer');
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

const aligned: LayoutAlignmentPayload = {
  state: 'aligned', autoPlaced: true, step: 0, floorDetected: true,
  measuredM: 0, planM: 0, view: 'real', error: '',
};

describe('whole-room realignment', () => {
  let renderer: { unmount: () => void };
  let alignment: ReturnType<typeof useLayoutAlignment>;
  const begin = jest.fn();
  const manual = jest.fn();
  const onAligned = jest.fn();
  const unityRef = { current: {
    beginLayoutAlignment: begin, realignLayout: manual, resumeUnityPlayer: jest.fn(),
  } as unknown as UnityARViewerHandle };

  function Harness() {
    alignment = useLayoutAlignment({ enabled: true, ready: true, unityRef, onAligned });
    return null;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    act(() => { renderer = create(<Harness />); });
  });
  afterEach(() => {
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  it('lets an automatically placed layout be manually aligned without forgetting it was already placed', () => {
    act(() => alignment.handleLayoutAlignment(aligned));
    expect(onAligned).toHaveBeenCalledWith(aligned, true);
    act(() => alignment.realign());
    expect(manual).toHaveBeenCalledTimes(1);
    expect(alignment.isAligning).toBe(true);
    expect(alignment.hasAligned).toBe(true);

    const corrected = { ...aligned, autoPlaced: false, measuredM: 3.6, planM: 3.617 };
    act(() => alignment.handleLayoutAlignment(corrected));
    expect(onAligned).toHaveBeenLastCalledWith(corrected, false);
    expect(alignment.isAligning).toBe(false);
  });

  it('keeps retries manual instead of accepting the same automatic room placement again', () => {
    act(() => alignment.handleLayoutAlignment(aligned));
    act(() => alignment.realign());
    act(() => jest.advanceTimersByTime(1500));
    expect(manual).toHaveBeenCalledTimes(2);
    expect(begin).toHaveBeenCalledTimes(1);
    act(() => alignment.handleLayoutAlignment({ ...aligned, state: 'aligning', error: 'noRoom' }));
    act(() => jest.advanceTimersByTime(1000));
    expect(manual).toHaveBeenCalledTimes(3);
    expect(begin).toHaveBeenCalledTimes(1);
  });
});
