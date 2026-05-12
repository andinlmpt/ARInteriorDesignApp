/// <reference types="three" />

declare module 'expo-gl' {
  import type { FunctionComponent } from 'react';
  import type { ViewProps } from 'react-native';

  export type ExpoWebGLRenderingContext = WebGLRenderingContext & {
    endFrameEXP: () => void;
    drawingBufferWidth: number;
    drawingBufferHeight: number;
    viewportWidth: number;
    viewportHeight: number;
  };

  export interface GLViewProps extends ViewProps {
    onContextCreate: (gl: ExpoWebGLRenderingContext) => void | Promise<void>;
    msaaSamples?: number;
  }

  export const GLView: FunctionComponent<GLViewProps>;
}

declare module 'expo-three' {
  import type { WebGLRendererParameters, WebGLRenderer } from 'three';
  import type { ExpoWebGLRenderingContext } from 'expo-gl';

  export class Renderer extends WebGLRenderer {
    constructor(props: WebGLRendererParameters & { gl: ExpoWebGLRenderingContext });
  }
}

