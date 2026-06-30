package com.arinteriordesign.arsession;

import android.opengl.EGL14;
import android.opengl.EGLConfig;
import android.opengl.EGLContext;
import android.opengl.EGLDisplay;
import android.opengl.EGLSurface;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;

/**
 * Minimal offscreen EGL context required by ARCore to acquire camera frames.
 */
public class ARSessionEGLHelper {
  private static final int EGL_OPENGL_ES2_BIT = 4;

  private EGLDisplay display = EGL14.EGL_NO_DISPLAY;
  private EGLContext context = EGL14.EGL_NO_CONTEXT;
  private EGLSurface surface;

  public void create() {
    display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY);
    int[] version = new int[2];
    EGL14.eglInitialize(display, version, 0, version, 1);

    int[] configAttribs = {
      EGL14.EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT,
      EGL14.EGL_RED_SIZE, 8,
      EGL14.EGL_GREEN_SIZE, 8,
      EGL14.EGL_BLUE_SIZE, 8,
      EGL14.EGL_ALPHA_SIZE, 8,
      EGL14.EGL_DEPTH_SIZE, 16,
      EGL14.EGL_NONE
    };

    EGLConfig[] configs = new EGLConfig[1];
    int[] numConfigs = new int[1];
    EGL14.eglChooseConfig(display, configAttribs, 0, configs, 0, 1, numConfigs, 0);

    int[] contextAttribs = {
      EGL14.EGL_CONTEXT_CLIENT_VERSION, 2,
      EGL14.EGL_NONE
    };
    context = EGL14.eglCreateContext(display, configs[0], EGL14.EGL_NO_CONTEXT, contextAttribs, 0);

    int[] surfaceAttribs = {
      EGL14.EGL_WIDTH, 1,
      EGL14.EGL_HEIGHT, 1,
      EGL14.EGL_NONE
    };
    surface = EGL14.eglCreatePbufferSurface(display, configs[0], surfaceAttribs, 0);
    makeCurrent();
  }

  public void makeCurrent() {
    EGL14.eglMakeCurrent(display, surface, surface, context);
  }

  public int createCameraTexture() {
    int[] textures = new int[1];
    GLES20.glGenTextures(1, textures, 0);
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textures[0]);
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
    return textures[0];
  }

  public void release() {
    if (display != EGL14.EGL_NO_DISPLAY) {
      EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT);
      if (surface != null) {
        EGL14.eglDestroySurface(display, surface);
        surface = null;
      }
      if (context != EGL14.EGL_NO_CONTEXT) {
        EGL14.eglDestroyContext(display, context);
        context = EGL14.EGL_NO_CONTEXT;
      }
      EGL14.eglTerminate(display);
      display = EGL14.EGL_NO_DISPLAY;
    }
  }
}
