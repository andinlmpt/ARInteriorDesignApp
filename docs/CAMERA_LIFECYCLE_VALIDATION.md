# Camera lifecycle validation

The scan controller owns tracking cleanup and waits for it before enabling height/corner input. Layout handoff waits for any outstanding scan reset. Explicit exits cancel pending scan/layout work. Returning from the final summary resumes the existing layout without starting another scan.

The AR route pauses the native player when hidden or backgrounded, including before opening the final summary. Android host/window resume respects that pause and the current Unity view's ownership. Camera health uses fresh frame timestamps, with at most three automatic recovery attempts before showing Retry camera. Permission denial offers Settings; unsupported devices get an explanation.

## Automated checks

From `frontend`:

```powershell
npx tsc --noEmit
npx jest --runInBand __tests__/unityCameraLifecycle.test.tsx __tests__/savedDesignAr.test.ts __tests__/roomLocalToUnity.test.ts __tests__/planView.test.ts
node --test scripts/patch-unity-export.test.js
```

In Unity, run `CameraLifecycleChecks.Run` with `-executeMethod` in batch mode. It checks repeated frame timestamps, bounded recovery, permission denial, orbit view, and exit versus layout-handoff cleanup. This requires a valid Unity Editor license.

## Device checks after exporting Unity and rebuilding the app

All rows below still require a live device run. Repeat each reopen case at least five times; verify that the camera remains responsive and no previous outline, height, furniture, or progress appears in a new scan.

| Path | Expected result |
| --- | --- |
| Fresh launch → scan | Permission prompt when needed; live camera; height/corner input starts after preparation. |
| Successful scan/save → new scan | Previous room stays saved; new scan has fresh geometry and tracking. |
| Scan save fails → retry save | Measurement remains available; retry saves it without rescanning. |
| Scan save fails → exit → reopen | Exit clears the unsaved draft; new scan starts clean. |
| Exit during startup or mid-scan → reopen | No late callback revives the exited scan; camera opens once. |
| Android system Back → confirm exit → reopen | Same cleanup and pause behavior as the in-app Back button. |
| Current session → View in AR | Loads the chosen layout; reuses scan alignment only while its tracking frame is valid. |
| Saved project → View in AR | Loads saved edits; alignment is requested when needed. |
| AR → Finish → summary → View in AR | Camera pauses on summary; returning preserves the placed arrangement. |
| Leave AR → background app → return on Projects | Camera remains paused. |
| Background active AR → return | Camera resumes without clearing the scan or layout. |
| Deny permission → Settings → allow → return | Explanation appears promptly; camera resumes after permission is granted. |
| Interrupt camera / freeze frame delivery | Recovery preserves room coordinates; repeated failure exposes Retry camera. |
| Exit one project → open another | Old view callbacks cannot control the new project's Unity player. |

Check camera-use indicators and runtime logs as well as the visible image. Capture startup time, crashes, and memory across the repeated cycles.
