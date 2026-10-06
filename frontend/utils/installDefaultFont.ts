/**
 * Makes plain React Native <Text> and <TextInput> render in Inter by default.
 *
 * React 19 ignores defaultProps on function components, so the `Text` and
 * `TextInput` getters on the react-native module are redirected to thin
 * wrappers. Must be imported before any screen renders (see app/_layout.tsx).
 * An explicit `fontFamily` in a style always wins.
 */

import React from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import { interFamilyForWeight } from '@/utils/fontFamily';

const INSTALLED = Symbol.for('arInteriorDesign.defaultFontInstalled');

function withDefaultFont(style: unknown) {
  const flat = (StyleSheet.flatten(style as TextStyle) || {}) as TextStyle;
  if (flat.fontFamily) return style;
  return [
    style,
    // Custom fonts ignore fontWeight on Android; the weight lives in the family name.
    { fontFamily: interFamilyForWeight(flat.fontWeight), fontWeight: undefined },
  ];
}

function wrapWithDefaultFont<P extends { style?: unknown }>(
  Original: React.ComponentType<P>,
  displayName: string
): React.ComponentType<P> {
  const Wrapped = (props: P) =>
    React.createElement(Original, { ...props, style: withDefaultFont(props.style) });

  // Keep statics such as TextInput.State that other RN components rely on.
  for (const key of Object.getOwnPropertyNames(Original)) {
    if (key in Wrapped) continue;
    const descriptor = Object.getOwnPropertyDescriptor(Original, key);
    if (descriptor) Object.defineProperty(Wrapped, key, descriptor);
  }
  (Wrapped as { displayName?: string }).displayName = displayName;
  return Wrapped as React.ComponentType<P>;
}

function redirectExport(name: 'Text' | 'TextInput') {
  // `import * as` would hand back an interop copy; the getters live on the real exports object.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const exportsObject = require('react-native') as Record<string, unknown>;
  const Original = exportsObject[name] as React.ComponentType<{ style?: unknown }>;
  const Wrapped = wrapWithDefaultFont(Original, name);
  Object.defineProperty(exportsObject, name, {
    configurable: true,
    enumerable: true,
    get: () => Wrapped,
  });
}

const globalFlags = globalThis as unknown as Record<symbol, boolean>;
if (!globalFlags[INSTALLED]) {
  globalFlags[INSTALLED] = true;
  try {
    redirectExport('Text');
    redirectExport('TextInput');
  } catch (err) {
    console.warn('[installDefaultFont] Could not install default font:', err);
  }
}
