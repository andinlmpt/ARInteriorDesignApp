/**
 * Icon Components
 * Reusable icon components for the UI
 */

import React from 'react';
import { Ionicons } from '@expo/vector-icons';

interface IconProps {
  size?: number;
  color?: string;
}

export function BackIcon({ size = 24, color = '#000' }: IconProps) {
  return <Ionicons name="arrow-back" size={size} color={color} />;
}

export function CloseIcon({ size = 24, color = '#000' }: IconProps) {
  return <Ionicons name="close" size={size} color={color} />;
}

export function CheckIcon({ size = 24, color = '#000' }: IconProps) {
  return <Ionicons name="checkmark" size={size} color={color} />;
}

export function PlusIcon({ size = 24, color = '#000' }: IconProps) {
  return <Ionicons name="add" size={size} color={color} />;
}

export function MinusIcon({ size = 24, color = '#000' }: IconProps) {
  return <Ionicons name="remove" size={size} color={color} />;
}

export function CameraIcon({ size = 24, color = '#000' }: IconProps) {
  return <Ionicons name="camera" size={size} color={color} />;
}
