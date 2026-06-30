package com.arinteriordesign.arsession;

import android.app.Activity;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.view.WindowManager;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.HitResult;
import com.google.ar.core.Plane;
import com.google.ar.core.PointCloud;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.Trackable;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.CameraNotAvailableException;
import com.google.ar.core.exceptions.UnavailableException;

import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

public class ARSessionNativeModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
  private static final String TAG = "ARSessionNative";
  private static final long UPDATE_INTERVAL_MS = 33;

  private final ReactApplicationContext reactContext;
  private final AtomicReference<Frame> latestFrame = new AtomicReference<>();
  private final Set<String> emittedPlaneIds = new HashSet<>();

  @Nullable
  private Session session;
  @Nullable
  private ARSessionEGLHelper eglHelper;
  @Nullable
  private Thread updateThread;
  private volatile boolean isRunning = false;
  private int displayWidth = 1080;
  private int displayHeight = 1920;
  private int cameraTextureId = -1;

  public ARSessionNativeModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    reactContext.addLifecycleEventListener(this);
    updateDisplayMetrics();
  }

  @Override
  public String getName() {
    return "ARSessionNative";
  }

  @ReactMethod
  public void isSupported(Promise promise) {
    try {
      ArCoreApk.Availability availability = ArCoreApk.getInstance().checkAvailability(reactContext);
      promise.resolve(availability.isSupported() || availability.isTransient());
    } catch (Exception e) {
      promise.resolve(false);
    }
  }

  @ReactMethod
  public void start(Promise promise) {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No active activity for ARCore session");
      return;
    }

    activity.runOnUiThread(() -> {
      try {
        ArCoreApk.InstallStatus installStatus =
          ArCoreApk.getInstance().requestInstall(activity, true);
        if (installStatus != ArCoreApk.InstallStatus.INSTALLED) {
          promise.reject("ARCORE_NOT_INSTALLED", "ARCore is not installed on this device");
          return;
        }

        stopInternal();

        eglHelper = new ARSessionEGLHelper();
        eglHelper.create();
        cameraTextureId = eglHelper.createCameraTexture();

        session = new Session(reactContext);
        Config config = new Config(session);
        config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL);
        config.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
        config.setFocusMode(Config.FocusMode.AUTO);
        session.configure(config);
        session.setCameraTextureName(cameraTextureId);
        updateDisplayGeometry();

        isRunning = true;
        session.resume();
        startUpdateLoop();
        promise.resolve(null);
      } catch (UnavailableException e) {
        cleanupSession();
        promise.reject("ARCORE_UNAVAILABLE", e.getMessage(), e);
      } catch (Exception e) {
        cleanupSession();
        promise.reject("ARCORE_START_FAILED", e.getMessage(), e);
      }
    });
  }

  @ReactMethod
  public void stop(Promise promise) {
    stopInternal();
    promise.resolve(null);
  }

  @ReactMethod
  public void getPlanes(Promise promise) {
    Frame frame = latestFrame.get();
    if (frame == null) {
      promise.resolve(Arguments.createArray());
      return;
    }

    WritableArray planes = Arguments.createArray();
    for (Trackable trackable : frame.getUpdatedTrackables(Plane.class)) {
      if (!(trackable instanceof Plane)) {
        continue;
      }
      Plane plane = (Plane) trackable;
      if (plane.getTrackingState() != TrackingState.TRACKING) {
        continue;
      }

      WritableMap planeMap = planeToMap(plane);
      if (planeMap != null) {
        planes.pushMap(planeMap);
      }
    }
    promise.resolve(planes);
  }

  @ReactMethod
  public void getMesh(Promise promise) {
    // ARCore does not expose scene mesh like ARKit LiDAR reconstruction.
    promise.resolve(null);
  }

  @ReactMethod
  public void getPointCloud(Promise promise) {
    Frame frame = latestFrame.get();
    if (frame == null) {
      promise.resolve(null);
      return;
    }

    try (PointCloud pointCloud = frame.acquirePointCloud()) {
      FloatBuffer buffer = pointCloud.getPoints();
      WritableArray points = Arguments.createArray();
      while (buffer.hasRemaining()) {
        float x = buffer.get();
        float y = buffer.get();
        float z = buffer.get();
        buffer.get(); // confidence

        WritableMap point = Arguments.createMap();
        point.putDouble("x", x);
        point.putDouble("y", y);
        point.putDouble("z", z);
        points.pushMap(point);
      }
      promise.resolve(points);
    } catch (Exception e) {
      promise.resolve(null);
    }
  }

  @ReactMethod
  public void hitTest(float screenX, float screenY, Promise promise) {
    Frame frame = latestFrame.get();
    if (frame == null) {
      promise.resolve(null);
      return;
    }

    try {
      List<HitResult> hits = frame.hitTest(screenX, screenY);
      for (HitResult hit : hits) {
        Trackable trackable = hit.getTrackable();
        if (trackable instanceof Plane) {
          Plane plane = (Plane) trackable;
          if (plane.getTrackingState() != TrackingState.TRACKING) {
            continue;
          }
          if (plane.isPoseInPolygon(hit.getHitPose())) {
            promise.resolve(hitPoseToMap(hit.getHitPose()));
            return;
          }
        }
      }
      promise.resolve(null);
    } catch (Exception e) {
      promise.resolve(null);
    }
  }

  @Override
  public void onHostResume() {
    if (session != null) {
      try {
        session.resume();
        updateDisplayGeometry();
      } catch (CameraNotAvailableException e) {
        Log.w(TAG, "Camera not available on resume", e);
      }
    }
  }

  @Override
  public void onHostPause() {
    if (session != null) {
      session.pause();
    }
  }

  @Override
  public void onHostDestroy() {
    stopInternal();
  }

  private void startUpdateLoop() {
    updateThread = new Thread(() -> {
      while (isRunning && session != null && eglHelper != null) {
        try {
          eglHelper.makeCurrent();
          Frame frame = session.update();
          latestFrame.set(frame);
          emitNewPlanes(frame);
          Thread.sleep(UPDATE_INTERVAL_MS);
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          break;
        } catch (Exception e) {
          Log.w(TAG, "ARCore frame update failed", e);
          try {
            Thread.sleep(100);
          } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            break;
          }
        }
      }
    }, "ARCoreUpdateThread");
    updateThread.start();
  }

  private void emitNewPlanes(Frame frame) {
    for (Trackable trackable : frame.getUpdatedTrackables(Plane.class)) {
      if (!(trackable instanceof Plane)) {
        continue;
      }
      Plane plane = (Plane) trackable;
      if (plane.getTrackingState() != TrackingState.TRACKING) {
        continue;
      }

      String planeId = plane.getAnchor().getTrackingState() == TrackingState.STOPPED
        ? String.valueOf(plane.hashCode())
        : String.valueOf(System.identityHashCode(plane));

      if (!emittedPlaneIds.add(planeId)) {
        continue;
      }

      WritableMap planeMap = planeToMap(plane);
      if (planeMap != null) {
        sendEvent("onPlaneDetected", planeMap);
      }
    }
  }

  @Nullable
  private WritableMap planeToMap(Plane plane) {
    if (plane.getSubsumedBy() != null) {
      return null;
    }

    Pose centerPose = plane.getCenterPose();
    float[] extent = new float[2];
    extent[0] = plane.getExtentX();
    extent[1] = plane.getExtentZ();

    float area = extent[0] * extent[1];
    Pose normalPose = plane.getCenterPose();
    float[] normal = new float[3];
    normalPose.getTransformedAxis(1, 1.0f, normal, 0);

    WritableMap map = Arguments.createMap();
    map.putString("id", String.valueOf(System.identityHashCode(plane)));
    map.putString(
      "type",
      plane.getType() == Plane.Type.HORIZONTAL_UPWARD_FACING
        || plane.getType() == Plane.Type.HORIZONTAL_DOWNWARD_FACING
        ? "horizontal"
        : "vertical"
    );

    WritableArray center = Arguments.createArray();
    center.pushDouble(centerPose.tx());
    center.pushDouble(centerPose.ty());
    center.pushDouble(centerPose.tz());
    map.putArray("center", center);

    WritableArray normalArray = Arguments.createArray();
    normalArray.pushDouble(normal[0]);
    normalArray.pushDouble(normal[1]);
    normalArray.pushDouble(normal[2]);
    map.putArray("normal", normalArray);

    WritableArray extentArray = Arguments.createArray();
    extentArray.pushDouble(extent[0]);
    extentArray.pushDouble(extent[1]);
    map.putArray("extent", extentArray);

    map.putDouble("area", area);
    map.putDouble("confidence", plane.getTrackingState() == TrackingState.TRACKING ? 0.85 : 0.5);
    map.putDouble("timestamp", System.currentTimeMillis());
    return map;
  }

  private WritableMap hitPoseToMap(Pose pose) {
    WritableMap position = Arguments.createMap();
    position.putDouble("x", pose.tx());
    position.putDouble("y", pose.ty());
    position.putDouble("z", pose.tz());

    WritableMap result = Arguments.createMap();
    result.putMap("position", position);
    return result;
  }

  private void updateDisplayMetrics() {
    WindowManager windowManager =
      (WindowManager) reactContext.getSystemService(reactContext.WINDOW_SERVICE);
    if (windowManager == null) {
      return;
    }
    Display display = windowManager.getDefaultDisplay();
    DisplayMetrics metrics = new DisplayMetrics();
    display.getMetrics(metrics);
    displayWidth = metrics.widthPixels;
    displayHeight = metrics.heightPixels;
  }

  private void updateDisplayGeometry() {
    if (session == null) {
      return;
    }
    updateDisplayMetrics();
    session.setDisplayGeometry(0, displayWidth, displayHeight);
  }

  private void sendEvent(String eventName, WritableMap params) {
    if (!reactContext.hasActiveReactInstance()) {
      return;
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(eventName, params);
  }

  private void stopInternal() {
    isRunning = false;
    if (updateThread != null) {
      updateThread.interrupt();
      try {
        updateThread.join(500);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
      updateThread = null;
    }
    cleanupSession();
    latestFrame.set(null);
    emittedPlaneIds.clear();
  }

  private void cleanupSession() {
    if (session != null) {
      session.pause();
      session.close();
      session = null;
    }
    if (eglHelper != null) {
      eglHelper.release();
      eglHelper = null;
    }
    cameraTextureId = -1;
  }
}
