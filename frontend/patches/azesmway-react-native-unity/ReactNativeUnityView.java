package com.azesmwayreactnativeunity;

import static com.azesmwayreactnativeunity.ReactNativeUnity.*;

import android.content.Context;

import android.annotation.SuppressLint;
import android.content.res.Configuration;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import java.lang.reflect.InvocationTargetException;

@SuppressLint("ViewConstructor")
public class ReactNativeUnityView extends FrameLayout {
  private UPlayer view;
  public boolean keepPlayerMounted = false;

  public ReactNativeUnityView(Context context) {
    super(context);
  }

  public void setUnityPlayer(UPlayer player) throws InvocationTargetException, NoSuchMethodException, IllegalAccessException {
    this.view = player;
    addUnityViewToGroup(this);
  }

  @Override
  public void onWindowFocusChanged(boolean hasWindowFocus) {
    super.onWindowFocusChanged(hasWindowFocus);

    if (view == null) {
      return;
    }

    view.windowFocusChanged(hasWindowFocus);

    if (!keepPlayerMounted || !_isUnityReady) {
      return;
    }

    // pause Unity on blur, resume on focus
    if (hasWindowFocus && _isUnityPaused) {
      // view.requestFocus();
      view.resume();
    } else if (!hasWindowFocus && !_isUnityPaused) {
      view.pause();
    }
  }

  @Override
  protected void onConfigurationChanged(Configuration newConfig) {
    super.onConfigurationChanged(newConfig);

    if (view != null) {
      view.configurationChanged(newConfig);
    }
  }

  @Override
  protected void onDetachedFromWindow() {
    // Park the player when the RN view detaches so remount can reattach it.
    // Skip if Unity is already on the activity (onDropViewInstance may have run first).
    try {
      if (view != null) {
        FrameLayout frame = view.requestFrame();
        ViewGroup parent = (ViewGroup) frame.getParent();
        if (parent != null && parent != this) {
          super.onDetachedFromWindow();
          return;
        }
      }
      addUnityViewToBackground();
    } catch (InvocationTargetException | NoSuchMethodException | IllegalAccessException ignored) {
      // Player may already be torn down with the process — ignore.
    } catch (IllegalStateException ignored) {
      // Frame still has a parent during React surface clear — avoid fatal crash.
    }

    super.onDetachedFromWindow();
  }
}
