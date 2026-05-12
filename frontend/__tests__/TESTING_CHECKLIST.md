# Testing Checklist for AR Interior Design App

This document provides a comprehensive testing checklist for all features in the AR View screen.

## ✅ Core Functionality Tests

### 1. Rapid Drag Operations
- [ ] **Test rapid drag operations (no visual artifacts)**
  - Drag furniture quickly back and forth
  - Verify no ghost objects remain
  - Verify alignment lines clean up properly
  - Verify dimension labels disappear after drag
  - Check reticle visibility after placement
  - Test with multiple rapid drags in succession
  - Verify drag ghost is properly disposed

**How to test:**
1. Place a furniture item
2. Quickly drag it multiple times in rapid succession
3. Verify no visual artifacts (lines, boxes, ghosts) remain
4. Check console for disposal warnings

**Expected behavior:** All visual guides clean up immediately, no memory leaks

---

### 2. Memory Management
- [ ] **Test memory usage over extended sessions (no leaks)**
  - Run app for 30+ minutes
  - Place and remove 50+ furniture items
  - Create and delete multiple groups
  - Test undo/redo extensively
  - Monitor memory usage in dev tools
  - Check for geometry/material leaks

**How to test:**
1. Use React DevTools Profiler
2. Place 50+ furniture items
3. Remove them all
4. Create/ungroup groups repeatedly
5. Monitor memory trends

**Expected behavior:** Memory stabilizes, no continuous growth

---

### 3. Collision Detection Performance
- [ ] **Test collision detection with 20+ furniture items**
  - Place 20+ furniture items in scene
  - Drag new furniture around
  - Verify collision detection is responsive
  - Check safety scores update correctly
  - Verify no performance degradation
  - Test with spatial partitioning optimizations

**How to test:**
1. Place 20-30 furniture items
2. Try to drag new furniture between existing items
3. Verify collision warnings appear promptly
4. Check frame rate remains smooth

**Expected behavior:** Smooth performance, fast collision checks

---

### 4. History System
- [ ] **Test undo/redo with maximum history entries**
  - Fill history to maximum (50 entries)
  - Test undo from last to first
  - Test redo from first to last
  - Verify history validation works
  - Test with corrupted history data
  - Verify groups persist in history

**How to test:**
1. Perform 50+ furniture operations
2. Undo all the way back
3. Redo all the way forward
4. Check validation removes invalid items

**Expected behavior:** All history operations work correctly, invalid items filtered

---

## 🔧 AR Initialization Tests

### 5. AR Initialization Error Handling
- [ ] **Test AR initialization on low-end devices**
  - Test on device with limited WebGL support
  - Test with poor camera quality
  - Verify graceful degradation
  - Check preview mode fallback
  - Test error recovery mechanisms
  - Verify user-friendly error messages

**How to test:**
1. Use device with limited resources
2. Trigger various initialization errors
3. Verify fallback options appear
4. Check preview mode works as alternative

**Expected behavior:** App doesn't crash, provides clear error messages and alternatives

---

### 6. Camera Permissions
- [ ] **Test camera permission flow (deny → grant)**
  - Deny permission initially
  - Verify error message appears
  - Grant permission from settings
  - Return to app
  - Verify AR activates correctly
  - Test retry mechanism

**How to test:**
1. Deny camera permission on first launch
2. Verify error alert appears
3. Go to device settings
4. Grant permission
5. Return to app
6. Try to activate AR again

**Expected behavior:** App handles permission denial gracefully, allows retry

---

## 🎯 Multi-Select & Grouping Tests

### 7. Multi-Select Functionality
- [ ] **Test multi-select with 10+ items**
  - Select 10+ furniture items
  - Verify all highlight correctly
  - Test selection/deselection
  - Test "Select All" button
  - Test "Clear" button
  - Verify group creation works

**How to test:**
1. Enable multi-select mode
2. Tap to select 10+ furniture items
3. Verify visual highlighting
4. Test group creation
5. Test deletion of multiple items

**Expected behavior:** All selections work smoothly, visual feedback is clear

---

### 8. Group Manipulation
- [ ] **Test drag with all snap modes enabled**
  - Create a furniture group
  - Drag group around
  - Verify all items move together
  - Test group rotation
  - Verify snap modes work with groups
  - Test ungroup functionality

**How to test:**
1. Select 3+ furniture items
2. Create a group
3. Drag the group around
4. Verify all items move together
5. Test rotation controls
6. Ungroup and verify items move independently

**Expected behavior:** Groups move as single units, snap modes work correctly

---

## 📐 Measurement Tools Tests

### 9. Measurement Functionality
- [ ] **Test measurement tools with complex polygons**
  - Measure distance between multiple points
  - Measure area of complex room shapes
  - Measure volume of 3D spaces
  - Verify calculations are accurate
  - Test with irregular room shapes
  - Verify labels display correctly

**How to test:**
1. Enable distance measurement mode
2. Place multiple measurement points
3. Switch to area mode
4. Measure complex room layout
5. Switch to volume mode
6. Verify all calculations

**Expected behavior:** Accurate measurements, clear labels

---

## 🎮 Demo Mode Tests

### 10. Demo Mode
- [ ] **Test demo mode with rapid furniture placement**
  - Start demo mode
  - Verify preset furniture places automatically
  - Test rapid placement scenarios
  - Verify no performance issues
  - Test stop demo mode
  - Verify cleanup on stop

**How to test:**
1. Enable demo mode in settings
2. Start demo mode
3. Watch automatic furniture placement
4. Verify performance remains smooth
5. Stop demo mode
6. Verify all demo furniture is removed

**Expected behavior:** Demo runs smoothly, cleans up properly

---

## 💾 Data Persistence Tests

### 11. Save/Load Functionality
- [ ] **Test save/load with corrupted data**
  - Save a layout
  - Corrupt the saved data manually
  - Attempt to load corrupted data
  - Verify error handling works
  - Verify validation prevents crashes
  - Test recovery mechanisms

**How to test:**
1. Save a layout with furniture
2. Manually corrupt the saved JSON
3. Attempt to load the corrupted layout
4. Verify graceful error handling

**Expected behavior:** App handles corrupted data gracefully, shows user-friendly errors

---

## 🎥 Preview Mode Tests

### 12. Preview Mode Controls
- [ ] **Test preview mode camera controls**
  - Switch to preview mode
  - Test pan/orbit controls
  - Test zoom in/out
  - Test pinch gestures
  - Verify camera resets correctly
  - Test switching back to AR mode

**How to test:**
1. Switch to preview mode
2. Pan camera around
3. Zoom in/out
4. Rotate view
5. Reset camera
6. Switch back to AR

**Expected behavior:** Smooth camera controls, intuitive gestures

---

## ♿ Accessibility Tests

### 13. Accessibility Features
- [ ] **Test accessibility features with screen reader**
  - Enable screen reader
  - Navigate through UI
  - Verify all buttons have labels
  - Test furniture placement announcements
  - Test error announcements
  - Verify AR status announcements

**How to test:**
1. Enable VoiceOver (iOS) or TalkBack (Android)
2. Navigate through all UI elements
3. Place furniture
4. Verify announcements are clear

**Expected behavior:** All UI is accessible, clear announcements

---

### 14. Voice Guidance
- [ ] **Test voice guidance with multiple rapid actions**
  - Enable voice guidance
  - Perform rapid furniture placements
  - Verify announcements don't overlap
  - Test with unsafe placements
  - Verify guidance helps user
  - Test disable/enable toggle

**How to test:**
1. Enable voice guidance
2. Rapidly place multiple furniture items
3. Verify announcements are clear
4. Disable voice guidance
5. Verify no announcements

**Expected behavior:** Clear, non-overlapping announcements, helpful guidance

---

## 📚 Tutorial Tests

### 15. Tutorial Flow
- [ ] **Test tutorial flow completion**
  - Start tutorial
  - Complete all tutorial steps
  - Test navigation between steps
  - Verify completion state saves
  - Test skipping tutorial
  - Verify tutorial doesn't show again after completion

**How to test:**
1. Start tutorial
2. Go through all steps
3. Verify completion
4. Reload app
5. Verify tutorial doesn't show again

**Expected behavior:** Tutorial completes successfully, state persists

---

## 🚀 Performance Benchmarks

### Target Metrics:
- **Frame Rate:** 60 FPS on mid-range devices, 30+ FPS on low-end
- **Memory Usage:** < 200MB baseline, < 500MB with 50+ furniture items
- **Collision Detection:** < 16ms per check (60 FPS target)
- **History Operations:** < 100ms for undo/redo
- **Group Operations:** < 50ms for create/ungroup

### Performance Testing:
- [ ] Profile with React DevTools Profiler
- [ ] Test on low-end device (Android 6+, iOS 12+)
- [ ] Monitor memory over 30+ minute session
- [ ] Check for frame drops during heavy operations
- [ ] Verify garbage collection works properly

---

## 🐛 Edge Cases

### Additional Edge Cases to Test:
- [ ] Place furniture outside room bounds
- [ ] Create group with single item (should fail gracefully)
- [ ] Undo when history is empty
- [ ] Redo when at end of history
- [ ] Drag furniture off-screen
- [ ] Rapidly toggle AR on/off
- [ ] Test with no room data loaded
- [ ] Test with invalid room data
- [ ] Test furniture placement during drag
- [ ] Test multiple simultaneous groups

---

## 📝 Test Results Template

### Test Session: [Date]
### Device: [Model/OS Version]
### App Version: [Version Number]

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Rapid Drag Operations | ⬜ Pass / ⬜ Fail | |
| 2 | Memory Usage | ⬜ Pass / ⬜ Fail | |
| 3 | Collision Detection (20+ items) | ⬜ Pass / ⬜ Fail | |
| 4 | Undo/Redo (Max History) | ⬜ Pass / ⬜ Fail | |
| 5 | AR Init (Low-end Devices) | ⬜ Pass / ⬜ Fail | |
| 6 | Camera Permission Flow | ⬜ Pass / ⬜ Fail | |
| 7 | Multi-Select (10+ items) | ⬜ Pass / ⬜ Fail | |
| 8 | Drag with Snap Modes | ⬜ Pass / ⬜ Fail | |
| 9 | Measurement Tools | ⬜ Pass / ⬜ Fail | |
| 10 | Demo Mode | ⬜ Pass / ⬜ Fail | |
| 11 | Save/Load Corrupted Data | ⬜ Pass / ⬜ Fail | |
| 12 | Preview Mode Controls | ⬜ Pass / ⬜ Fail | |
| 13 | Accessibility (Screen Reader) | ⬜ Pass / ⬜ Fail | |
| 14 | Voice Guidance | ⬜ Pass / ⬜ Fail | |
| 15 | Tutorial Flow | ⬜ Pass / ⬜ Fail | |

**Overall Status:** ⬜ All Tests Pass / ⬜ Issues Found

**Critical Issues Found:**
- [List any critical issues]

**Notes:**
- [Additional notes]

---

## 🔧 Test Utilities

See `__tests__/testHelpers.ts` for helper functions to assist with testing.

## 📞 Reporting Issues

When reporting test failures, include:
1. Test number and name
2. Device/model information
3. Steps to reproduce
4. Expected vs actual behavior
5. Screenshots/videos if applicable
6. Console logs/errors

