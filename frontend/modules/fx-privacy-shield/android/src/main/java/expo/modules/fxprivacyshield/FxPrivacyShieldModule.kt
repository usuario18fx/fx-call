package expo.modules.fxprivacyshield

import android.app.Activity
import android.os.Build
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.function.Consumer

/**
 * FX PRIVACY SHIELD (Android)
 * Genuine platform signals only:
 *  - API 34+: Activity.ScreenCaptureCallback (screenshot taken while this activity is visible)
 *  - API 35+: WindowManager.addScreenRecordingCallback (this app's windows are being recorded)
 *  - FLAG_SECURE: optional capture protection (blocks screenshots/recording of the app window)
 * Older Android versions report the capability as unavailable. External cameras cannot be detected.
 */
class FxPrivacyShieldModule : Module() {
  private var screenshotCallback: Any? = null
  private var recordingCallback: Any? = null

  override fun definition() = ModuleDefinition {
    Name("FxPrivacyShield")

    Events("onCaptureEvent")

    Function("getCapabilities") {
      mapOf(
        "screenshot" to (Build.VERSION.SDK_INT >= 34),
        "recording" to (Build.VERSION.SDK_INT >= 35),
        "screenshotSource" to SCREENSHOT_SOURCE,
        "recordingSource" to RECORDING_SOURCE,
        "engine" to "fx-native-kotlin",
        "sdk" to Build.VERSION.SDK_INT
      )
    }

    AsyncFunction("startMonitoring") {
      val activity = appContext.currentActivity ?: return@AsyncFunction
      activity.runOnUiThread { start(activity) }
    }

    AsyncFunction("stopMonitoring") {
      val activity = appContext.currentActivity ?: return@AsyncFunction
      activity.runOnUiThread { stop(activity) }
    }

    AsyncFunction("setSecure") { enabled: Boolean ->
      val activity = appContext.currentActivity ?: return@AsyncFunction
      activity.runOnUiThread {
        if (enabled) activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }

    OnDestroy {
      appContext.currentActivity?.let { a -> a.runOnUiThread { stop(a) } }
    }
  }

  private fun emit(type: String, source: String) {
    sendEvent("onCaptureEvent", mapOf("type" to type, "source" to source))
  }

  private fun start(activity: Activity) {
    stop(activity)
    if (Build.VERSION.SDK_INT >= 34) {
      val cb = Activity.ScreenCaptureCallback { emit("screenshot", SCREENSHOT_SOURCE) }
      activity.registerScreenCaptureCallback(activity.mainExecutor, cb)
      screenshotCallback = cb
    }
    if (Build.VERSION.SDK_INT >= 35) {
      val cb = Consumer<Int> { state ->
        emit(if (state == WindowManager.SCREEN_RECORDING_STATE_VISIBLE) "recording_started" else "recording_stopped", RECORDING_SOURCE)
      }
      val initial = activity.windowManager.addScreenRecordingCallback(activity.mainExecutor, cb)
      recordingCallback = cb
      if (initial == WindowManager.SCREEN_RECORDING_STATE_VISIBLE) emit("recording_started", RECORDING_SOURCE)
    }
  }

  @Suppress("UNCHECKED_CAST")
  private fun stop(activity: Activity) {
    if (Build.VERSION.SDK_INT >= 34) {
      (screenshotCallback as? Activity.ScreenCaptureCallback)?.let { activity.unregisterScreenCaptureCallback(it) }
    }
    if (Build.VERSION.SDK_INT >= 35) {
      (recordingCallback as? Consumer<Int>)?.let { activity.windowManager.removeScreenRecordingCallback(it) }
    }
    screenshotCallback = null
    recordingCallback = null
  }

  companion object {
    const val SCREENSHOT_SOURCE = "android.Activity.ScreenCaptureCallback"
    const val RECORDING_SOURCE = "android.WindowManager.ScreenRecordingCallback"
  }
}
