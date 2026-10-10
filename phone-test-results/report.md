# Android YOLO test — 11 October 2026

Device: Xiaomi M2101K6G, Android 13, ARM64, connected by USB.

## Preflight

- ADB connection: passed.
- ARCore installed: passed.
- Backend `/health`: passed.
- Metro development server: running on port 8081.
- USB reverse connections: ports 8081 and 3000 configured.
- YOLO ONNX asset and detector implementation: present.
- Unity Android export: contains generated detector code and was exported after the model was added.

## Build and device tests

- Initial Android ARM64 debug build: passed (9 minutes 20 seconds).
- Initial installation and app launch: passed.
- Camera preview: passed (`ar-start.png`).
- AR floor tracking and room outline: passed; room confirmation reported a horizontal plane and four corners.
- Model initialization: did not occur in the initial run. The serialized measurement scene contains the mapping controller but no furniture suggestion service. Its presence causes the HUD to skip runtime setup of that service.
- Fix: the mapping controller now creates a missing suggestion service; the detector logs inference completion, furniture labels/confidence, and the number of AR suggestions.
- Fixed Unity export: passed (1 minute 20 seconds), including C# compilation.
- Fixed APK rebuild: passed (16 seconds after reapplying the export's existing React Native manifest compatibility patches).
- Fixed APK installation and launch: passed.
- Fixed camera preview: passed (`fixed-camera.png`).
- YOLO model initialization: passed. Device log at 01:41:22 reports `COCO detector ready (GPUCompute)`.
- Camera-only YOLO smoke test: passed on three live frames with a real chair centered in view. An explicit Android intent extra (`yoloSmokeTest=true`) opts into three bounded samples, independent of the room outline.

| Sample | Detected object | Confidence | Inference/readback time |
| --- | --- | --- | --- |
| 1 | chair | 0.71 | 29,497 ms |
| 2 | chair | 0.81 | 1,220 ms |
| 3 | chair | 0.74 | 1,205 ms |

- Furniture detection-to-room-map integration and reopening: awaiting the remaining live room scan.
- Performance: the first inference blocked for approximately 29.5 seconds. Subsequent samples took approximately 1.2 seconds. The existing scan interval is 2.5 seconds (the suggestion service ticks at 3 seconds). This is periodic detection, and does not establish real-time inference performance.
- App memory during the smoke test: approximately 1.29 GB PSS; this is a single snapshot, not a leak test.

The live camera detection test passed. AR world placement and persistence of a YOLO suggestion still require a completed room outline and the existing-furniture step. Other furniture classes, accuracy across environments, and the full seven-step design workflow have not been tested.

An initial Unity startup error reported a missing optional Play Asset Delivery class; camera and room scanning nevertheless started. Early AR initialization recovery messages also preceded the working camera session.

One Android framework startup crash was logged at 01:51:57 during the diagnostic installation/relaunch sequence (`ConfigurationController.updateLocaleListFromAppContext`, null Resources). A later launch succeeded and completed all three YOLO samples. It has not been established whether this crash is reproducible.

## Intended system flow

Room scan → spatial map (boundaries, dimensions, openings, existing furniture) → room/style/budget/required-item preferences → generated arrangements → AR visualization → customization/regeneration → saved design, floor plan, furniture list and estimated cost.

Source inspection confirms the app passes the room polygon, openings and obstacles to measurement saving, and the layout planner checks existing obstacle footprints and opening zones. This is source-level evidence, not a completed end-to-end phone test of layout generation.

## Evidence

- Build log: `../frontend/android/phone-test-build.log`
- Metro log: `../frontend/phone-test-metro.log`
- Device log: `device-logcat.txt`
- Fixed Unity export: `unity-export-retry.log`
