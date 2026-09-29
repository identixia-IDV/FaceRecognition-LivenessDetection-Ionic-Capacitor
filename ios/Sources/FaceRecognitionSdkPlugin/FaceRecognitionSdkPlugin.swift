import Foundation
import Capacitor
import AVFoundation
import UIKit
import CoreImage
import CoreVideo

@objc(FaceRecognitionSdkPlugin)
public class FaceRecognitionSdkPlugin: CAPPlugin, CAPBridgedPlugin, AVCaptureVideoDataOutputSampleBufferDelegate {
  public let identifier = "FaceRecognitionSdkPlugin"
  public let jsName = "FaceRecognitionSdk"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "getMachineCode", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "getLicenseStatus", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "setActivation", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "init", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "deinit", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "lastLicenseError", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "setLandmarkMode", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "getLandmarkMode", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "detect", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "faceDetection", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "templateExtraction", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "cropFace", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "extractFeature", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "similarity", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "quality", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "faceDetect", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "faceAttribute", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "imageQuality", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "landmarks", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "match", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "livenessAll", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "getFeature", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "startVideoWorker", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "stopVideoWorker", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "syncVideoWorkerDatabase", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "probeLiveImage", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "applyLiveFrame", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "exportLastLiveFrame", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "writeStatus", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "estimatorStatus", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "startLivePreview", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "setLivePreviewBounds", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "stopLivePreview", returnType: CAPPluginReturnPromise),
    CAPPluginMethod(name: "takeLiveSnapshot", returnType: CAPPluginReturnPromise),
  ]

  private var captureSession: AVCaptureSession?
  private var previewContainer: UIView?
  private var previewLayer: AVCaptureVideoPreviewLayer?
  private var videoOutput: AVCaptureVideoDataOutput?
  private var boundsObserver: NSKeyValueObservation?
  private let videoQueue = DispatchQueue(label: "com.facerecognitionsdk.camera")
  private let ciContext = CIContext(options: nil)
  private var lastFrameTime: CFTimeInterval = 0
  private var feeding = false
  private var usingFrontCamera = true
  private var originalWebViewOpaque: Bool?

  public override func load() {
    FaceRecognitionSdkBridge.shared().eventHandler = { [weak self] json in
      self?.notifyListeners("FaceRecognitionVideoWorkerEvent", data: ["json": json])
    }
  }

  private func missingSdk(_ call: CAPPluginCall) -> Bool {
    if FaceRecognitionSdkBridge.isAvailable() {
      return false
    }
    call.reject(
      "facerecognitionsdk.framework not linked. Drop frameworks into ios/Frameworks/.",
      "E_SDK"
    )
    return true
  }

  @objc func getMachineCode(_ call: CAPPluginCall) {
    if missingSdk(call) { return }
    FaceRecognitionSdkBridge.shared().getMachineCode({ value in
      call.resolve(["value": value as? String ?? ""])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func getLicenseStatus(_ call: CAPPluginCall) {
    if missingSdk(call) { return }
    FaceRecognitionSdkBridge.shared().getLicenseStatus({ value in
      call.resolve(["value": value as? String ?? ""])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func setActivation(_ call: CAPPluginCall) {
    guard let license = call.getString("license"), !license.isEmpty else {
      call.reject("license is required", "E_ACTIVATION")
      return
    }
    if missingSdk(call) { return }
    FaceRecognitionSdkBridge.shared().setActivation(license, resolver: { value in
      call.resolve(["value": value as? Int ?? 0])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func `init`(_ call: CAPPluginCall) {
    if missingSdk(call) { return }
    FaceRecognitionSdkBridge.shared().initSDK({ value in
      call.resolve(["value": value as? Int ?? 0])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc(deinit:) func deinitSdk(_ call: CAPPluginCall) {
    FaceRecognitionSdkBridge.shared().deinitSDK({ _ in
      call.resolve()
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func lastLicenseError(_ call: CAPPluginCall) {
    FaceRecognitionSdkBridge.shared().lastLicenseError({ value in
      call.resolve(["value": value as? String ?? ""])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func setLandmarkMode(_ call: CAPPluginCall) {
    let mode = call.getInt("mode") ?? 14
    FaceRecognitionSdkBridge.shared().setLandmarkMode(NSNumber(value: mode), resolver: { value in
      call.resolve(["value": value as? Int ?? mode])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func getLandmarkMode(_ call: CAPPluginCall) {
    FaceRecognitionSdkBridge.shared().getLandmarkMode({ value in
      call.resolve(["value": value as? Int ?? 14])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func detect(_ call: CAPPluginCall) {
    guard let image = call.getString("image"), !image.isEmpty else {
      call.reject("image is required", "E_IMAGE")
      return
    }
    let crop = call.getBool("crop") ?? false
    let flags = call.getInt("flags") ?? -1
    FaceRecognitionSdkBridge.shared().detect(image, crop: crop, flags: NSNumber(value: flags), resolver: { value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func faceDetection(_ call: CAPPluginCall) {
    guard let image = call.getString("image"), !image.isEmpty else {
      call.reject("image is required", "E_IMAGE")
      return
    }
    let param = call.getString("param")
    FaceRecognitionSdkBridge.shared().faceDetection(image, paramJson: param, resolver: { value in
      call.resolve(["value": value as? String ?? "[]"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func templateExtraction(_ call: CAPPluginCall) {
    guard let image = call.getString("image"), let box = call.getString("faceBox") else {
      call.reject("image and faceBox are required", "E_TEMPLATE")
      return
    }
    FaceRecognitionSdkBridge.shared().templateExtraction(image, faceBoxJson: box, resolver: { value in
      call.resolve(["value": value as? String ?? ""])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func cropFace(_ call: CAPPluginCall) {
    guard let image = call.getString("image"), let box = call.getString("faceBox") else {
      call.reject("image and faceBox are required", "E_CROP")
      return
    }
    FaceRecognitionSdkBridge.shared().cropFace(image, faceBoxJson: box, resolver: { value in
      call.resolve(["value": value as? String ?? ""])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func extractFeature(_ call: CAPPluginCall) {
    guard let image = call.getString("image") else {
      call.reject("image is required", "E_FEATURE")
      return
    }
    FaceRecognitionSdkBridge.shared().extractFeature(image, resolver: { value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func similarity(_ call: CAPPluginCall) {
    guard let f1 = call.getString("feature1"), let f2 = call.getString("feature2") else {
      call.reject("feature1 and feature2 are required", "E_SIMILARITY")
      return
    }
    FaceRecognitionSdkBridge.shared().similarity(f1, feature2B64: f2, resolver: { value in
      call.resolve(["value": value as? Double ?? -1])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func quality(_ call: CAPPluginCall) {
    guard let image = call.getString("image") else {
      call.reject("image is required", "E_QUALITY")
      return
    }
    let crop = call.getBool("crop") ?? false
    FaceRecognitionSdkBridge.shared().quality(image, crop: crop, resolver: { value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func faceDetect(_ call: CAPPluginCall) {
    guard let image = call.getString("image") else {
      call.reject("image is required", "E_FACE_DETECT")
      return
    }
    let crop = call.getBool("crop") ?? false
    FaceRecognitionSdkBridge.shared().faceDetect(image, crop: crop, resolver: { value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func faceAttribute(_ call: CAPPluginCall) {
    guard let image = call.getString("image") else {
      call.reject("image is required", "E_FACE_ATTRIBUTE")
      return
    }
    let crop = call.getBool("crop") ?? false
    FaceRecognitionSdkBridge.shared().faceAttribute(image, crop: crop, resolver: { value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func imageQuality(_ call: CAPPluginCall) {
    guard let image = call.getString("image") else {
      call.reject("image is required", "E_IMAGE_QUALITY")
      return
    }
    let crop = call.getBool("crop") ?? false
    FaceRecognitionSdkBridge.shared().imageQuality(image, crop: crop, resolver: { value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func landmarks(_ call: CAPPluginCall) {
    guard let image = call.getString("image") else {
      call.reject("image is required", "E_LANDMARKS")
      return
    }
    let mode = call.getInt("mode") ?? 68
    FaceRecognitionSdkBridge.shared().landmarks(image, mode: NSNumber(value: mode), resolver: { value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func match(_ call: CAPPluginCall) {
    guard let imageA = call.getString("imageA") ?? call.getString("image"),
          let imageB = call.getString("imageB") ?? call.getString("image2") else {
      call.reject("imageA and imageB are required", "E_MATCH")
      return
    }
    let crop = call.getBool("crop") ?? false
    FaceRecognitionSdkBridge.shared().match(imageA, imageB: imageB, crop: crop, resolver: { value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func livenessAll(_ call: CAPPluginCall) {
    guard let image = call.getString("image") else {
      call.reject("image is required", "E_LIVENESS_ALL")
      return
    }
    FaceRecognitionSdkBridge.shared().livenessAll(image, resolver: { value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func getFeature(_ call: CAPPluginCall) {
    guard let image = call.getString("image") else {
      call.reject("image is required", "E_FEATURE")
      return
    }
    FaceRecognitionSdkBridge.shared().getFeature(image, resolver: { value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func startVideoWorker(_ call: CAPPluginCall) {
    if missingSdk(call) { return }
    let config = call.getString("config")
    FaceRecognitionSdkBridge.shared().startVideoWorker(config, resolver: { value in
      call.resolve(["value": value as? Int ?? 0])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func stopVideoWorker(_ call: CAPPluginCall) {
    FaceRecognitionSdkBridge.shared().stopVideoWorker({ _ in
      call.resolve()
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func syncVideoWorkerDatabase(_ call: CAPPluginCall) {
    let features = call.getArray("features", String.self) ?? []
    let threshold = call.getDouble("matchThreshold") ?? 0.67
    FaceRecognitionSdkBridge.shared().syncVideoWorkerDatabase(
      features,
      matchThreshold: NSNumber(value: threshold),
      resolver: { value in
        call.resolve(["value": value as? Int ?? 0])
      },
      rejecter: { code, message, _ in
        call.reject(message ?? code, code)
      }
    )
  }

  @objc func probeLiveImage(_ call: CAPPluginCall) {
    guard let image = call.getString("image") else {
      call.reject("image is required", "E_IMAGE")
      return
    }
    FaceRecognitionSdkBridge.shared().probeLiveImage(image, resolver: { value in
      if let dict = value as? [String: Any] {
        call.resolve(dict)
      } else {
        call.resolve(["width": 0, "height": 0])
      }
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func applyLiveFrame(_ call: CAPPluginCall) {
    guard let image = call.getString("image") else {
      call.reject("image is required", "E_FRAME")
      return
    }
    let rotate = call.getDouble("rotateDegrees") ?? 0
    let maxEdge = call.getInt("maxEdge") ?? 640
    let feed = call.getBool("feedWorker") ?? true
    FaceRecognitionSdkBridge.shared().applyLiveFrame(
      image,
      rotateDegrees: NSNumber(value: rotate),
      maxEdge: NSNumber(value: maxEdge),
      feedWorker: feed,
      resolver: { value in
        if let dict = value as? [String: Any] {
          call.resolve(dict)
        } else {
          call.resolve(["ingested": false, "width": 0, "height": 0])
        }
      },
      rejecter: { code, message, _ in
        call.reject(message ?? code, code)
      }
    )
  }

  @objc func exportLastLiveFrame(_ call: CAPPluginCall) {
    FaceRecognitionSdkBridge.shared().exportLastLiveFrame({ value in
      if let dict = value as? [String: Any] {
        call.resolve(dict)
      } else {
        call.reject("No live frame", "E_IMAGE")
      }
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func writeStatus(_ call: CAPPluginCall) {
    let payload = call.getString("payload") ?? "{}"
    FaceRecognitionSdkBridge.shared().writeStatus(payload, resolver: { _ in
      call.resolve()
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func estimatorStatus(_ call: CAPPluginCall) {
    FaceRecognitionSdkBridge.shared().estimatorStatus({ value in
      call.resolve(["value": value as? String ?? "{}"])
    }, rejecter: { code, message, _ in
      call.reject(message ?? code, code)
    })
  }

  @objc func startLivePreview(_ call: CAPPluginCall) {
    let front = call.getBool("frontCamera") ?? true
    DispatchQueue.main.async {
      self.stopSession()
      self.usingFrontCamera = front
      let session = AVCaptureSession()
      // Match native FaceRecognition-LivenessDetection-iOS (16:9) so aspectFill crop matches analysis.
      session.sessionPreset = .hd1280x720
      let position: AVCaptureDevice.Position = front ? .front : .back
      guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position)
        ?? AVCaptureDevice.default(for: .video) else {
        call.reject("No camera", "E_CAMERA")
        return
      }
      do {
        let input = try AVCaptureDeviceInput(device: device)
        if session.canAddInput(input) {
          session.addInput(input)
        }
        let output = AVCaptureVideoDataOutput()
        output.alwaysDiscardsLateVideoFrames = true
        output.videoSettings = [
          kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        output.setSampleBufferDelegate(self, queue: self.videoQueue)
        if session.canAddOutput(output) {
          session.addOutput(output)
        }
        if let conn = output.connection(with: .video) {
          // Keep sample buffers in sensor landscape; imageFromSampleBuffer
          // rotates to portrait (same as CameraFrameUtils). Preview layer
          // still uses .portrait below.
          if conn.isVideoMirroringSupported {
            conn.automaticallyAdjustsVideoMirroring = false
            conn.isVideoMirrored = false
          }
        }
        self.videoOutput = output
        self.captureSession = session
        guard self.attachPreview(session: session, front: front) else {
          self.stopSession()
          call.reject("Could not attach camera preview", "E_CAMERA")
          return
        }
        self.setWebViewTransparent(true)
        DispatchQueue.global(qos: .userInitiated).async {
          session.startRunning()
          DispatchQueue.main.async {
            self.layoutPreview()
            self.applyPreviewConnection()
          }
          call.resolve()
        }
      } catch {
        call.reject(error.localizedDescription, "E_CAMERA", error)
      }
    }
  }

  @objc func stopLivePreview(_ call: CAPPluginCall) {
    DispatchQueue.main.async {
      self.stopSession()
      call.resolve()
    }
  }

  /// Kept for API compatibility — preview is always full WebView (RN absoluteFill).
  @objc func setLivePreviewBounds(_ call: CAPPluginCall) {
    DispatchQueue.main.async {
      self.layoutPreview()
      call.resolve()
    }
  }

  @objc func takeLiveSnapshot(_ call: CAPPluginCall) {
    FaceRecognitionSdkBridge.shared().exportLastLiveFrame({ value in
      if let dict = value as? [String: Any], let uri = dict["uri"] as? String {
        call.resolve(["uri": uri, "path": uri.replacingOccurrences(of: "file://", with: "")])
      } else {
        call.reject("Live preview is not running", "E_CAMERA")
      }
    }, rejecter: { code, message, _ in
      call.reject(message ?? "Live preview is not running", code ?? "E_CAMERA")
    })
  }

  public func captureOutput(
    _ output: AVCaptureOutput,
    didOutput sampleBuffer: CMSampleBuffer,
    from connection: AVCaptureConnection
  ) {
    let now = CACurrentMediaTime()
    if now - lastFrameTime < 0.12 || feeding {
      return
    }
    lastFrameTime = now
    feeding = true
    defer { feeding = false }
    guard let image = imageFromSampleBuffer(sampleBuffer) else { return }
    FaceRecognitionSdkBridge.shared().ingestCameraImage(image)
  }

  /// Same geometry as FaceRecognitionSDK-iOS `CameraFrameUtils.rotatedPortrait`
  /// so FILL_CENTER overlay Y matches the portrait aspectFill preview.
  private func imageFromSampleBuffer(_ sampleBuffer: CMSampleBuffer) -> UIImage? {
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return nil }
    var ciImage = CIImage(cvPixelBuffer: pixelBuffer)
    var extent = ciImage.extent.integral
    guard extent.width > 1, extent.height > 1 else { return nil }

    // Sensor buffer is landscape. Front −90° / back +90° (CW/CCW via CGAffineTransform).
    // Do not use CIImage.oriented — its EXIF mapping skews Y vs the preview layer.
    if extent.width > extent.height {
      let radians = usingFrontCamera ? -CGFloat.pi / 2 : CGFloat.pi / 2
      ciImage = ciImage.transformed(by: CGAffineTransform(rotationAngle: radians))
      extent = ciImage.extent.integral
      ciImage = ciImage.transformed(by: CGAffineTransform(
        translationX: -extent.origin.x,
        y: -extent.origin.y
      ))
      extent = ciImage.extent.integral
    }

    guard let cgImage = ciContext.createCGImage(ciImage, from: extent) else { return nil }
    return UIImage(cgImage: cgImage, scale: 1, orientation: .up)
  }

  private func attachPreview(session: AVCaptureSession, front: Bool) -> Bool {
    guard let webView = self.webView else { return false }
    guard let host = webView.superview ?? self.bridge?.viewController?.view else {
      return false
    }
    // Full-bleed behind WebView — same coordinate space as window.innerWidth/Height overlay.
    let frame = webView.frame.isEmpty ? host.bounds : webView.frame
    let container = UIView(frame: frame)
    container.isUserInteractionEnabled = false
    container.backgroundColor = .black
    container.clipsToBounds = true

    let layer = AVCaptureVideoPreviewLayer(session: session)
    layer.videoGravity = .resizeAspectFill
    layer.frame = container.bounds
    if let conn = layer.connection {
      if conn.isVideoOrientationSupported {
        conn.videoOrientation = .portrait
      }
      if conn.isVideoMirroringSupported {
        conn.automaticallyAdjustsVideoMirroring = false
        conn.isVideoMirrored = front
      }
    }
    container.layer.addSublayer(layer)
    previewLayer = layer
    previewContainer = container

    if let idx = host.subviews.firstIndex(of: webView) {
      host.insertSubview(container, at: idx)
    } else {
      host.insertSubview(container, at: 0)
    }
    host.bringSubviewToFront(webView)

    boundsObserver?.invalidate()
    boundsObserver = webView.observe(\.frame, options: [.new, .initial]) { [weak self] _, _ in
      self?.layoutPreview()
    }
    layoutPreview()
    return true
  }

  private func layoutPreview() {
    guard let container = previewContainer, let webView = webView else { return }
    let host = webView.superview ?? bridge?.viewController?.view
    let frame = webView.frame.isEmpty ? (host?.bounds ?? .zero) : webView.frame
    container.frame = frame
    previewLayer?.frame = container.bounds
    applyPreviewConnection()
  }

  private func applyPreviewConnection() {
    guard let conn = previewLayer?.connection else { return }
    if conn.isVideoOrientationSupported {
      conn.videoOrientation = .portrait
    }
    if conn.isVideoMirroringSupported {
      conn.automaticallyAdjustsVideoMirroring = false
      conn.isVideoMirrored = usingFrontCamera
    }
  }

  private func setWebViewTransparent(_ transparent: Bool) {
    guard let webView = webView else { return }
    if originalWebViewOpaque == nil {
      originalWebViewOpaque = webView.isOpaque
    }
    webView.isOpaque = !transparent && (originalWebViewOpaque ?? true)
    webView.backgroundColor = transparent ? .clear : nil
    webView.scrollView.isOpaque = !transparent
    webView.scrollView.backgroundColor = transparent ? .clear : nil
    webView.scrollView.subviews.forEach { sub in
      if transparent {
        sub.backgroundColor = .clear
      }
    }
  }

  private func stopSession() {
    boundsObserver?.invalidate()
    boundsObserver = nil
    captureSession?.stopRunning()
    captureSession = nil
    videoOutput?.setSampleBufferDelegate(nil, queue: nil)
    videoOutput = nil
    previewLayer?.removeFromSuperlayer()
    previewLayer = nil
    previewContainer?.removeFromSuperview()
    previewContainer = nil
    setWebViewTransparent(false)
  }
}
