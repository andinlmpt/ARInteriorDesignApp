package com.azesmwayreactnativeunity;

import android.app.Activity;
import android.content.Context;
import android.content.res.Configuration;
import android.widget.FrameLayout;

import com.unity3d.player.*;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/**
 * Reflection wrapper around UnityPlayer / UnityPlayerForActivityOrService.
 * Unity 6 no longer uses a stable constructors()[1] index — pick by signature.
 */
public class UPlayer {
    private static UnityPlayer unityPlayer;

    public UPlayer(final Activity activity, final ReactNativeUnity.UnityPlayerCallback callback)
        throws ClassNotFoundException, InvocationTargetException, IllegalAccessException, InstantiationException {
        super();

        Class<?> playerClass;
        try {
            playerClass = Class.forName("com.unity3d.player.UnityPlayerForActivityOrService");
        } catch (ClassNotFoundException e) {
            playerClass = Class.forName("com.unity3d.player.UnityPlayer");
        }

        Object instance = createPlayerInstance(playerClass, activity, callback);
        if (instance == null) {
            throw new InstantiationException(
                "No compatible Unity player constructor found for " + playerClass.getName()
            );
        }

        unityPlayer = (UnityPlayer) instance;
    }

    private static Object createPlayerInstance(
        Class<?> playerClass,
        Activity activity,
        final ReactNativeUnity.UnityPlayerCallback callback
    ) {
        IUnityPlayerLifecycleEvents lifecycleEvents = new IUnityPlayerLifecycleEvents() {
            @Override
            public void onUnityPlayerUnloaded() {
                callback.onUnload();
            }

            @Override
            public void onUnityPlayerQuitted() {
                callback.onQuit();
            }
        };

        // Unity 6 preferred: (Context, IUnityPlayerLifecycleEvents)
        try {
            Class<?> lifecycleClass = Class.forName("com.unity3d.player.IUnityPlayerLifecycleEvents");
            Constructor<?> ctor = playerClass.getConstructor(Context.class, lifecycleClass);
            return ctor.newInstance(activity, lifecycleEvents);
        } catch (Exception ignored) {
        }

        // Unity 6 alternate: (Context)
        try {
            Constructor<?> ctor = playerClass.getConstructor(Context.class);
            return ctor.newInstance(activity);
        } catch (Exception ignored) {
        }

        // Legacy: (Activity)
        try {
            Constructor<?> ctor = playerClass.getConstructor(Activity.class);
            return ctor.newInstance(activity);
        } catch (Exception ignored) {
        }

        // Last resort: scan public constructors by assignable types (never use [1] index).
        for (Constructor<?> ctor : playerClass.getConstructors()) {
            Class<?>[] params = ctor.getParameterTypes();
            try {
                if (params.length == 2
                    && params[0].isAssignableFrom(activity.getClass())
                    && params[1].getName().contains("IUnityPlayerLifecycleEvents")) {
                    return ctor.newInstance(activity, lifecycleEvents);
                }
                if (params.length == 1 && params[0].isAssignableFrom(activity.getClass())) {
                    return ctor.newInstance(activity);
                }
            } catch (Exception ignored) {
            }
        }

        return null;
    }

    public static void UnitySendMessage(String gameObject, String methodName, String message) {
        UnityPlayer.UnitySendMessage(gameObject, methodName, message);
    }

    public void pause() {
        unityPlayer.pause();
    }

    public void windowFocusChanged(boolean b) {
        unityPlayer.windowFocusChanged(b);
    }

    public void resume() {
        unityPlayer.resume();
    }

    public void unload() {
        unityPlayer.unload();
    }

    public Object getParentPlayer() throws NoSuchMethodException, InvocationTargetException, IllegalAccessException {
        try {
            Method getFrameLayout = unityPlayer.getClass().getMethod("getFrameLayout");
            FrameLayout frame = (FrameLayout) this.requestFrame();
            return frame.getParent();
        } catch (NoSuchMethodException e) {
            Method getParent = unityPlayer.getClass().getMethod("getParent");
            return getParent.invoke(unityPlayer);
        }
    }

    public void configurationChanged(Configuration newConfig) {
        unityPlayer.configurationChanged(newConfig);
    }

    public void destroy() {
        unityPlayer.destroy();
    }

    public void requestFocusPlayer() throws NoSuchMethodException, InvocationTargetException, IllegalAccessException {
        try {
            Method getFrameLayout = unityPlayer.getClass().getMethod("getFrameLayout");
            FrameLayout frame = (FrameLayout) this.requestFrame();
            frame.requestFocus();
        } catch (NoSuchMethodException e) {
            Method requestFocus = unityPlayer.getClass().getMethod("requestFocus");
            requestFocus.invoke(unityPlayer);
        }
    }

    public FrameLayout requestFrame() throws NoSuchMethodException {
        try {
            Method getFrameLayout = unityPlayer.getClass().getMethod("getFrameLayout");
            return (FrameLayout) getFrameLayout.invoke(unityPlayer);
        } catch (NoSuchMethodException | IllegalAccessException | InvocationTargetException e) {
            // Legacy Unity where UnityPlayer IS-A FrameLayout.
            return (FrameLayout) (Object) unityPlayer;
        }
    }

    public void setZ(float v) throws NoSuchMethodException, InvocationTargetException, IllegalAccessException {
        try {
            Method setZ = unityPlayer.getClass().getMethod("setZ", float.class);
            setZ.invoke(unityPlayer, v);
        } catch (NoSuchMethodException e) {
            // Optional on some Unity versions.
        }
    }

    public Object getContextPlayer() {
        return unityPlayer.getContext();
    }
}
