package com.azesmwayreactnativeunity;

import android.app.Activity;
import android.graphics.PixelFormat;
import android.os.Build;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;

import static android.view.ViewGroup.LayoutParams.MATCH_PARENT;

import java.lang.reflect.InvocationTargetException;

public class ReactNativeUnity {
    private static UPlayer unityPlayer;
    public static boolean _isUnityReady;
    public static boolean _isUnityPaused;
    public static boolean _fullScreen;

    public static UPlayer getPlayer() {
        if (!_isUnityReady) {
            return null;
        }
        return unityPlayer;
    }

    public static boolean isUnityReady() {
        return _isUnityReady;
    }

    public static boolean isUnityPaused() {
        return _isUnityPaused;
    }

    public static void createPlayer(final Activity activity, final UnityPlayerCallback callback) throws InvocationTargetException, NoSuchMethodException, IllegalAccessException {
        if (unityPlayer != null) {
            callback.onReady();

            return;
        }

        if (activity != null) {
            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    activity.getWindow().setFormat(PixelFormat.RGBA_8888);
                    int flag = activity.getWindow().getAttributes().flags;
                    boolean fullScreen = false;
                    if ((flag & WindowManager.LayoutParams.FLAG_FULLSCREEN) == WindowManager.LayoutParams.FLAG_FULLSCREEN) {
                        fullScreen = true;
                    }

                    try {
                        unityPlayer = new UPlayer(activity, callback);
                    } catch (ClassNotFoundException | InstantiationException | IllegalAccessException | InvocationTargetException e) {}

                    try {
                        // wait a moment. fix unity cannot start when startup.
                        Thread.sleep(1000);
                    } catch (Exception e) {}

                    // start unity
                    try {
                        addUnityViewToBackground();
                    } catch (InvocationTargetException | IllegalAccessException | NoSuchMethodException e) {}

                    unityPlayer.windowFocusChanged(true);

                    try {
                        unityPlayer.requestFocusPlayer();
                    } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {}

                    unityPlayer.resume();

                    if (!fullScreen) {
                        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_FORCE_NOT_FULLSCREEN);
                        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
                    }

                    _isUnityReady = true;

                    try {
                        callback.onReady();
                    } catch (InvocationTargetException | IllegalAccessException | NoSuchMethodException e) {}
                }
            });
        }
    }

    public static void pause() {
        if (unityPlayer != null) {
            unityPlayer.pause();
            _isUnityPaused = true;
        }
    }

    public static void resume() {
        if (unityPlayer != null) {
            unityPlayer.resume();
            _isUnityPaused = false;
        }
    }

    public static void unload() {
        if (unityPlayer != null) {
            unityPlayer.unload();
            _isUnityPaused = false;
        }
    }

    /** Remove Unity's FrameLayout from whatever ViewGroup currently hosts it. */
    static void detachUnityFrameFromParent(FrameLayout frame) {
        if (frame == null) {
            return;
        }

        ViewGroup parent = (ViewGroup) frame.getParent();
        if (parent == null) {
            return;
        }

        try {
            parent.endViewTransition(frame);
        } catch (Exception ignored) {
        }

        try {
            parent.removeView(frame);
        } catch (Exception ignored) {
        }
    }

    public static void addUnityViewToBackground() throws InvocationTargetException, NoSuchMethodException, IllegalAccessException {
        if (unityPlayer == null) {
            return;
        }

        FrameLayout frame = unityPlayer.requestFrame();
        detachUnityFrameFromParent(frame);

        // Already parked (or detach failed mid tear-down) — never double addContentView.
        if (frame.getParent() != null) {
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            unityPlayer.setZ(-1f);
        }

        final Activity activity = ((Activity) unityPlayer.getContextPlayer());
        if (activity == null) {
            return;
        }

        ViewGroup.LayoutParams layoutParams = new ViewGroup.LayoutParams(1, 1);
        try {
            activity.addContentView(frame, layoutParams);
        } catch (IllegalStateException e) {
            // RN surface clear can detach while the frame is still transitioning.
        }
    }

    public static void addUnityViewToGroup(ViewGroup group) throws NoSuchMethodException, InvocationTargetException, IllegalAccessException {
        if (unityPlayer == null) {
            return;
        }

        FrameLayout frame = unityPlayer.requestFrame();
        detachUnityFrameFromParent(frame);

        if (frame.getParent() != null) {
            return;
        }

        ViewGroup.LayoutParams layoutParams = new ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT);
        group.addView(frame, 0, layoutParams);
        unityPlayer.windowFocusChanged(true);
        unityPlayer.requestFocusPlayer();
        unityPlayer.resume();
    }

    public interface UnityPlayerCallback {
        void onReady() throws InvocationTargetException, NoSuchMethodException, IllegalAccessException;

        void onUnload();

        void onQuit();
    }
}
