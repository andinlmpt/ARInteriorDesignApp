/**
 * AI Design Form Hook
 * Manages form state and validation for AI design generation
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { BudgetType, OptimizationGoal, DesignFormState } from '@/types/ai-design-ui';
import { LIMITS, TIMINGS } from '@/config/aiDesign.config';
import { validateDesignInputs, ValidationResult } from '@/utils/aiDesignValidation';
import { saveDesignState, loadDesignState } from '@/utils/aiDesignStorage';

export function useAIDesignForm(initialParams?: Partial<DesignFormState>) {
  const [prompt, setPrompt] = useState(initialParams?.prompt || '');
  const [selectedStyle, setSelectedStyle] = useState(initialParams?.selectedStyle || '');
  const [selectedRoom, setSelectedRoom] = useState(initialParams?.selectedRoom || '');
  const [roomWidth, setRoomWidth] = useState(initialParams?.roomWidth || String(LIMITS.DEFAULT_ROOM_WIDTH));
  const [roomLength, setRoomLength] = useState(initialParams?.roomLength || String(LIMITS.DEFAULT_ROOM_LENGTH));
  const [roomHeight, setRoomHeight] = useState(initialParams?.roomHeight || String(LIMITS.DEFAULT_ROOM_HEIGHT));
  const [budget, setBudget] = useState<BudgetType>(initialParams?.budget || 'medium');
  const [optimizationGoal, setOptimizationGoal] = useState<OptimizationGoal>(initialParams?.optimizationGoal || 'balanced');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load persisted state on mount
  useEffect(() => {
    const loadState = async () => {
      const state = await loadDesignState();
      if (state) {
        if (state.prompt) setPrompt(state.prompt);
        if (state.selectedStyle) setSelectedStyle(state.selectedStyle);
        if (state.selectedRoom) setSelectedRoom(state.selectedRoom);
        if (state.roomWidth) setRoomWidth(state.roomWidth);
        if (state.roomLength) setRoomLength(state.roomLength);
        if (state.roomHeight) setRoomHeight(state.roomHeight);
        if (state.budget) setBudget(state.budget);
        if (state.optimizationGoal) setOptimizationGoal(state.optimizationGoal);
      }
    };
    loadState();
  }, []);

  // Persist state when it changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const state: DesignFormState = {
        prompt,
        selectedStyle,
        selectedRoom,
        roomWidth,
        roomLength,
        roomHeight,
        budget,
        optimizationGoal,
      };
      saveDesignState(state);
    }, TIMINGS.STATE_SAVE_DEBOUNCE);

    return () => clearTimeout(timer);
  }, [prompt, selectedStyle, selectedRoom, roomWidth, roomLength, roomHeight, budget, optimizationGoal]);

  // Validate form
  const validate = useCallback((): ValidationResult => {
    const result = validateDesignInputs(
      selectedRoom,
      selectedStyle,
      roomWidth,
      roomLength,
      roomHeight,
      prompt
    );
    setValidationErrors(result.errors);
    return result;
  }, [selectedRoom, selectedStyle, roomWidth, roomLength, roomHeight, prompt]);

  // Clear validation errors
  const clearValidationErrors = useCallback(() => {
    setValidationErrors([]);
  }, []);

  // Reset form to defaults
  const resetForm = useCallback(() => {
    setPrompt('');
    setSelectedStyle('');
    setSelectedRoom('');
    setRoomWidth(String(LIMITS.DEFAULT_ROOM_WIDTH));
    setRoomLength(String(LIMITS.DEFAULT_ROOM_LENGTH));
    setRoomHeight(String(LIMITS.DEFAULT_ROOM_HEIGHT));
    setBudget('medium');
    setOptimizationGoal('balanced');
    setValidationErrors([]);
  }, []);

  return useMemo(() => ({
    // State
    prompt,
    selectedStyle,
    selectedRoom,
    roomWidth,
    roomLength,
    roomHeight,
    budget,
    optimizationGoal,
    validationErrors,

    // Setters
    setPrompt,
    setSelectedStyle,
    setSelectedRoom,
    setRoomWidth,
    setRoomLength,
    setRoomHeight,
    setBudget,
    setOptimizationGoal,

    // Actions
    validate,
    clearValidationErrors,
    resetForm,
  }), [
    prompt,
    selectedStyle,
    selectedRoom,
    roomWidth,
    roomLength,
    roomHeight,
    budget,
    optimizationGoal,
    validationErrors,
    validate,
    clearValidationErrors,
    resetForm,
  ]);
}

