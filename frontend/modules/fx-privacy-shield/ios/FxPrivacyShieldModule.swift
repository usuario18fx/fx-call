import ExpoModulesCore
import UIKit

/// FX PRIVACY SHIELD (iOS)
/// Genuine Apple signals only:
///  - UIApplication.userDidTakeScreenshotNotification (fires after a screenshot is taken)
///  - UIScreen.capturedDidChangeNotification + UIScreen.isCaptured (screen recording, AirPlay mirroring)
/// Nothing here can detect an external camera pointed at the display.
public class FxPrivacyShieldModule: Module {
  private var observers: [NSObjectProtocol] = []
  private static let screenshotSource = "ios.UIApplication.userDidTakeScreenshotNotification"
  private static let captureSource = "ios.UIScreen.capturedDidChangeNotification"

  public func definition() -> ModuleDefinition {
    Name("FxPrivacyShield")

    Events("onCaptureEvent")

    Function("getCapabilities") { () -> [String: Any] in
      return [
        "screenshot": true,
        "recording": true,
        "screenshotSource": FxPrivacyShieldModule.screenshotSource,
        "recordingSource": FxPrivacyShieldModule.captureSource,
        "engine": "fx-native-swift"
      ]
    }

    AsyncFunction("isScreenCaptured") { () -> Bool in
      return UIScreen.main.isCaptured
    }.runOnQueue(.main)

    AsyncFunction("startMonitoring") {
      self.stopObservers()
      let center = NotificationCenter.default
      self.observers.append(center.addObserver(forName: UIApplication.userDidTakeScreenshotNotification, object: nil, queue: .main) { [weak self] _ in
        self?.sendEvent("onCaptureEvent", ["type": "screenshot", "source": FxPrivacyShieldModule.screenshotSource])
      })
      self.observers.append(center.addObserver(forName: UIScreen.capturedDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
        let captured = UIScreen.main.isCaptured
        self?.sendEvent("onCaptureEvent", ["type": captured ? "recording_started" : "recording_stopped", "source": FxPrivacyShieldModule.captureSource])
      })
      if UIScreen.main.isCaptured {
        self.sendEvent("onCaptureEvent", ["type": "recording_started", "source": FxPrivacyShieldModule.captureSource])
      }
    }.runOnQueue(.main)

    AsyncFunction("stopMonitoring") {
      self.stopObservers()
    }.runOnQueue(.main)

    OnDestroy {
      self.stopObservers()
    }
  }

  private func stopObservers() {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers.removeAll()
  }
}
