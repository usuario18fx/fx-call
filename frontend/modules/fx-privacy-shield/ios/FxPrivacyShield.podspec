Pod::Spec.new do |s|
  s.name           = 'FxPrivacyShield'
  s.version        = '1.0.0'
  s.summary        = 'FX PRIVACY SHIELD: native iOS screenshot and screen-capture state detection'
  s.description    = 'Observes UIApplication.userDidTakeScreenshotNotification and UIScreen.capturedDidChangeNotification.'
  s.license        = 'UNLICENSED'
  s.author         = 'FX CALL'
  s.homepage       = 'https://fxcall.app'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'SWIFT_COMPILATION_MODE' => 'wholemodule' }
end
