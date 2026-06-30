import Foundation
import ARKit

@objc(ARSessionNative)
class ARSessionNative: RCTEventEmitter, ARSessionDelegate {

  private var arSession: ARSession?
  
  override func supportedEvents() -> [String]! {
    return ["onPlaneDetected", "onMeshUpdated"]
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc
  func isSupported(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(ARWorldTrackingConfiguration.isSupported)
  }

  @objc
  func start(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.arSession = ARSession()
      self.arSession?.delegate = self
      
      let configuration = ARWorldTrackingConfiguration()
      configuration.planeDetection = [.horizontal, .vertical]
      
      if ARWorldTrackingConfiguration.supportsSceneReconstruction(.meshWithClassification) {
          configuration.sceneReconstruction = .meshWithClassification
      }
      
      self.arSession?.run(configuration)
      resolve(nil)
    }
  }

  @objc
  func stop(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    self.arSession?.pause()
    self.arSession = nil
    resolve(nil)
  }

  @objc
  func getPlanes(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let anchors = arSession?.currentFrame?.anchors else {
      resolve([])
      return
    }
    
    var planes: [[String: Any]] = []
    for anchor in anchors {
      if let planeAnchor = anchor as? ARPlaneAnchor {
        let normal: [Float] = planeAnchor.alignment == .horizontal
          ? [0, 1, 0]
          : [planeAnchor.transform.columns.2.x, planeAnchor.transform.columns.2.y, planeAnchor.transform.columns.2.z]
        let area = planeAnchor.extent.x * planeAnchor.extent.z
        planes.append([
          "id": planeAnchor.identifier.uuidString,
          "type": planeAnchor.alignment == .horizontal ? "horizontal" : "vertical",
          "center": [planeAnchor.center.x, planeAnchor.center.y, planeAnchor.center.z],
          "normal": normal,
          "extent": [planeAnchor.extent.x, planeAnchor.extent.z],
          "area": area,
          "confidence": 0.85,
          "timestamp": Date().timeIntervalSince1970 * 1000
        ])
      }
    }
    resolve(planes)
  }

  @objc
  func hitTest(_ screenX: NSNumber, screenY: NSNumber, resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let frame = arSession?.currentFrame else {
      resolve(nil)
      return
    }

    let hits = frame.hitTest(
      CGPoint(x: screenX.doubleValue, y: screenY.doubleValue),
      types: [.existingPlaneUsingExtent, .estimatedHorizontalPlane]
    )

    guard let first = hits.first else {
      resolve(nil)
      return
    }

    let position = first.worldTransform.columns.3
    resolve([
      "position": [
        "x": position.x,
        "y": position.y,
        "z": position.z
      ]
    ])
  }

  @objc
  func getMesh(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let anchors = arSession?.currentFrame?.anchors else {
      resolve(nil)
      return
    }
    
    var meshData: [[String: Any]] = []
    for anchor in anchors {
      if let meshAnchor = anchor as? ARMeshAnchor {
        // Parse geometry data here
        meshData.append([
           "id": meshAnchor.identifier.uuidString
        ])
      }
    }
    resolve(meshData)
  }

  @objc
  func getPointCloud(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let rawFeaturePoints = arSession?.currentFrame?.rawFeaturePoints else {
      resolve(nil)
      return
    }
    
    var points: [[String: Float]] = []
    for i in 0..<rawFeaturePoints.points.count {
      let point = rawFeaturePoints.points[i]
      points.append(["x": point.x, "y": point.y, "z": point.z])
    }
    resolve(points)
  }
}
