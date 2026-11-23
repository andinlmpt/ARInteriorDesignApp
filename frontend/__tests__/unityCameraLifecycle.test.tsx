import React, { act, createRef } from 'react';
import { UnityARViewer, type UnityARViewerHandle } from '@/components/UnityARViewer';

// jest-expo supplies this renderer without separate TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('react-test-renderer');

const mockNative = {
  resumeUnity: jest.fn(),
  pauseUnity: jest.fn(),
  windowFocusChanged: jest.fn(),
  postMessage: jest.fn(),
};

jest.mock('@/utils/unityAvailability', () => ({ isUnityViewAvailable: () => true }));
jest.mock('@azesmway/react-native-unity', () => {
  // Keep React inside the hoisted mock factory.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return { __esModule: true, default: React.forwardRef(function MockUnityView(_props: unknown, ref: unknown) {
    React.useImperativeHandle(ref, () => mockNative);
    return null;
  }) };
});

describe('Unity camera ownership', () => {
  let renderer: { update: (element: React.ReactElement) => void; unmount: () => void };
  const ref = createRef<UnityARViewerHandle>();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    jest.useRealTimers();
  });

  it('keeps a hidden or backgrounded AR screen paused, including delayed and imperative wake calls', () => {
    act(() => { renderer = create(<UnityARViewer ref={ref} active />); });
    expect(mockNative.resumeUnity).toHaveBeenCalled();
    act(() => { renderer.update(<UnityARViewer ref={ref} active={false} />); });
    expect(mockNative.pauseUnity).toHaveBeenCalledWith(true);
    jest.clearAllMocks();

    act(() => {
      jest.advanceTimersByTime(1000);
      ref.current?.resumeUnityPlayer();
      ref.current?.wakeUnityPlayer();
    });
    expect(mockNative.resumeUnity).not.toHaveBeenCalled();
    expect(mockNative.windowFocusChanged).not.toHaveBeenCalledWith(true);
    expect(mockNative.postMessage).not.toHaveBeenCalled();
  });

  it('resumes the same layout after returning from the summary without clearing or scanning again', () => {
    act(() => { renderer = create(<UnityARViewer ref={ref} active />); });
    act(() => { renderer.update(<UnityARViewer ref={ref} active={false} />); });
    jest.clearAllMocks();
    act(() => { renderer.update(<UnityARViewer ref={ref} active />); });
    expect(mockNative.resumeUnity).toHaveBeenCalled();
    expect(mockNative.windowFocusChanged).toHaveBeenCalledWith(true);
    expect(mockNative.postMessage).not.toHaveBeenCalled();
  });

  it('does not open the camera when mounted while inactive', () => {
    act(() => { renderer = create(<UnityARViewer ref={ref} active={false} />); });
    act(() => { jest.runAllTimers(); });
    expect(mockNative.pauseUnity).toHaveBeenCalledWith(true);
    expect(mockNative.resumeUnity).not.toHaveBeenCalled();
  });

  it('does not pause a newer AR view when the previous view unmounts', () => {
    act(() => { renderer = create(<UnityARViewer ref={ref} active />); });
    jest.clearAllMocks();
    act(() => { renderer.unmount(); });
    expect(mockNative.pauseUnity).not.toHaveBeenCalled();
  });
});
