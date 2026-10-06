/**
 * useLayoutAlignment Hook
 * Design-flow "View in AR": lines the generated layout up with the user's real room
 * (two floor corners of one wall) before the furniture is placed on the camera view.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type { UnityARViewerHandle } from '@/components/UnityARViewer';
import type { LayoutAlignmentPayload, LayoutViewMode } from '@/types/unity-bridge';

const BEGIN_RETRY_MS = 1500;
const MAX_BEGIN_RETRIES = 4;

const INITIAL_ALIGNING: LayoutAlignmentPayload = {
  state: 'aligning',
  step: 0,
  floorDetected: false,
  measuredM: 0,
  planM: 0,
  view: 'real',
  error: '',
};

interface UseLayoutAlignmentProps {
  /** Only the design-flow AR overlay aligns. */
  enabled: boolean;
  /** Unity has the room shell and furniture placement armed. */
  ready: boolean;
  unityRef: React.RefObject<UnityARViewerHandle | null>;
  /** Called every time the layout lands on the real room (first time and realigns). */
  onAligned?: (payload: LayoutAlignmentPayload, firstTime: boolean) => void;
}

interface UseLayoutAlignmentReturn {
  alignment: LayoutAlignmentPayload | null;
  isAligning: boolean;
  /** True once the layout has been aligned at least once (applyLayout may be sent). */
  hasAligned: boolean;
  handleLayoutAlignment: (payload: LayoutAlignmentPayload) => void;
  markCorner: () => void;
  undoCorner: () => void;
  flip: () => void;
  realign: () => void;
  setView: (view: LayoutViewMode) => void;
}

export function useLayoutAlignment({
  enabled,
  ready,
  unityRef,
  onAligned,
}: UseLayoutAlignmentProps): UseLayoutAlignmentReturn {
  const [alignment, setAlignment] = useState<LayoutAlignmentPayload | null>(null);
  const [hasAligned, setHasAligned] = useState(false);
  const startedRef = useRef(false);
  const heardFromUnityRef = useRef(false);
  const retriesRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef = useRef<LayoutAlignmentPayload | null>(null);
  const hasAlignedRef = useRef(false);
  const onAlignedRef = useRef(onAligned);

  useEffect(() => {
    onAlignedRef.current = onAligned;
  }, [onAligned]);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const sendBegin = useCallback(() => {
    clearRetry();
    heardFromUnityRef.current = false;
    setAlignment((prev) => ({ ...INITIAL_ALIGNING, planM: prev?.planM ?? 0, view: 'real' }));
    unityRef.current?.resumeUnityPlayer?.();
    unityRef.current?.beginLayoutAlignment();

    // UaaL can drop the first message right after the scene handoff.
    retryTimerRef.current = setTimeout(() => {
      if (heardFromUnityRef.current || retriesRef.current >= MAX_BEGIN_RETRIES) return;
      retriesRef.current += 1;
      unityRef.current?.beginLayoutAlignment();
    }, BEGIN_RETRY_MS);
  }, [clearRetry, unityRef]);

  useEffect(() => {
    if (!enabled || !ready || startedRef.current) return;
    startedRef.current = true;
    retriesRef.current = 0;
    sendBegin();
  }, [enabled, ready, sendBegin]);

  useEffect(() => clearRetry, [clearRetry]);

  const handleLayoutAlignment = useCallback(
    (payload: LayoutAlignmentPayload) => {
      if (!enabled) return;
      heardFromUnityRef.current = true;

      if (payload.error === 'noRoom' && retriesRef.current < MAX_BEGIN_RETRIES) {
        // Room shell not confirmed yet — Unity is still rebuilding it.
        retriesRef.current += 1;
        clearRetry();
        retryTimerRef.current = setTimeout(() => unityRef.current?.beginLayoutAlignment(), 1000);
        return;
      }

      const prev = prevRef.current;
      prevRef.current = payload;
      setAlignment(payload);

      if (payload.error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      }

      const markedFirst = payload.state === 'aligning' && payload.step === 1 && prev?.step !== 1;
      if (markedFirst) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      if (payload.state === 'aligned' && prev?.state !== 'aligned') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const firstTime = !hasAlignedRef.current;
        hasAlignedRef.current = true;
        setHasAligned(true);
        onAlignedRef.current?.(payload, firstTime);
      }
    },
    [enabled, clearRetry, unityRef]
  );

  const markCorner = useCallback(() => unityRef.current?.markAlignmentCorner(), [unityRef]);
  const undoCorner = useCallback(() => unityRef.current?.undoAlignmentCorner(), [unityRef]);

  const flip = useCallback(() => {
    unityRef.current?.flipLayoutAlignment();
    prevRef.current = null;
  }, [unityRef]);

  const realign = useCallback(() => {
    retriesRef.current = 0;
    prevRef.current = null;
    sendBegin();
  }, [sendBegin]);

  const setView = useCallback(
    (view: LayoutViewMode) => {
      setAlignment((prev) => (prev ? { ...prev, view } : prev));
      unityRef.current?.setLayoutView(view);
    },
    [unityRef]
  );

  return {
    alignment,
    isAligning: enabled && alignment?.state === 'aligning',
    hasAligned,
    handleLayoutAlignment,
    markCorner,
    undoCorner,
    flip,
    realign,
    setView,
  };
}
