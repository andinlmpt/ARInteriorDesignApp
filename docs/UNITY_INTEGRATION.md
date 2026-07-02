# Unity Integration Guide for 3D Layout Visualization

> **IKEA-style AR furniture (real room, AR Foundation):** see [UNITY_AR_IKEA_STYLE.md](./UNITY_AR_IKEA_STYLE.md).  
> **Step-by-step in InteriorDesignViewer:** see [UNITY_AR_SETUP_INTERIORDESIGNVIEWER.md](./UNITY_AR_SETUP_INTERIORDESIGNVIEWER.md).

This guide explains how to integrate Unity for professional-grade 3D visualization in your AR Interior Design App.

## Overview

Unity offers superior 3D rendering capabilities compared to Three.js, with:
- **Better Performance**: Optimized rendering pipeline
- **Advanced Graphics**: Real-time lighting, shadows, post-processing
- **Rich Asset Library**: Access to Unity Asset Store
- **Professional Tools**: Industry-standard 3D authoring
- **Cross-Platform**: iOS, Android, Web, VR/AR support

## Integration Options

### Option 1: Unity as Native Module (Recommended for Production)

Requires **Expo Development Build** or **Bare React Native**.

#### Setup Steps:

1. **Install Unity Integration Package**
```bash
npm install react-native-unity-view
# or
npm install @azesmway/react-native-unity
```

2. **Install Unity 2021.3 LTS or later**
   - Download from [unity.com](https://unity.com/download)
   - Ensure Android Build Support and iOS Build Support are installed

3. **Create Unity Project**
   - Create new Unity project
   - Configure for Mobile (Android/iOS)
   - Enable AR Foundation for AR features
   - Build Unity Library that can be embedded

4. **Configure Expo Development Build**
   - Create `eas.json` for EAS Build
   - Add Unity native modules
   - Build custom development client

### Option 2: Unity WebGL (Works with Expo Managed)

This option embeds Unity as a WebGL build in a WebView, works with Expo managed workflow.

#### Pros:
- ✅ Works with Expo managed workflow
- ✅ No native module configuration
- ✅ Cross-platform (iOS, Android, Web)

#### Cons:
- ⚠️ Larger bundle size
- ⚠️ Slightly lower performance than native
- ⚠️ Limited native API access

#### Setup Steps:

1. **Build Unity Project as WebGL**
   - Open Unity project
   - File → Build Settings → WebGL
   - Configure player settings
   - Build WebGL project

2. **Host WebGL Build**
   - Host Unity WebGL build on CDN or local server
   - Or embed in app bundle (larger size)

3. **Embed in React Native**
   - Use `react-native-webview` to display Unity WebGL
   - Communicate via `window.postMessage` and `onMessage`

### Option 3: Unity Cloud Build API

Use Unity Cloud Build to generate builds programmatically and embed them.

## Recommended Approach: Unity WebGL with Expo

For this project, we'll use Unity WebGL since it works with Expo managed workflow.

## Implementation

### Step 1: Unity Project Setup

1. Create Unity project with these settings:
   - **Template**: 3D (URP)
   - **Platform**: WebGL
   - **API Compatibility**: .NET Standard 2.1

2. Create scene for room visualization:
   - Floor, walls, ceiling
   - Furniture spawner system
   - Camera controls
   - Lighting setup

3. Create communication bridge:
   - JavaScript interface for React Native communication
   - Methods to update room dimensions
   - Methods to place furniture
   - Methods to change camera view

4. Build as WebGL:
   - Build Settings → WebGL
   - Configure compression
   - Build and deploy

### Step 2: React Native Integration

See `Unity3DViewer.tsx` component below for implementation.

## Communication Protocol

Unity ↔ React Native communication via:

```javascript
// React Native → Unity
UnityWebView.postMessage({
  method: 'updateRoom',
  data: {
    width: 5.0,
    length: 6.0,
    height: 2.7
  }
});

// Unity → React Native
window.ReactNativeWebView.postMessage(JSON.stringify({
  event: 'roomUpdated',
  data: { success: true }
}));
```

## Unity C# Scripts

### RoomManager.cs
```csharp
using UnityEngine;
using System;

public class RoomManager : MonoBehaviour
{
    [SerializeField] private GameObject floorPrefab;
    [SerializeField] private GameObject wallPrefab;
    [SerializeField] private GameObject ceilingPrefab;
    
    private GameObject currentRoom;
    
    public void CreateRoom(float width, float length, float height)
    {
        if (currentRoom != null)
        {
            Destroy(currentRoom);
        }
        
        currentRoom = new GameObject("Room");
        CreateFloor(width, length);
        CreateWalls(width, length, height);
        CreateCeiling(width, length, height);
    }
    
    private void CreateFloor(float width, float length)
    {
        GameObject floor = Instantiate(floorPrefab, currentRoom.transform);
        floor.transform.localScale = new Vector3(width, 1, length);
    }
    
    private void CreateWalls(float width, float length, float height)
    {
        // Create 4 walls
        // North, South, East, West
    }
    
    private void CreateCeiling(float width, float length, float height)
    {
        GameObject ceiling = Instantiate(ceilingPrefab, currentRoom.transform);
        ceiling.transform.position = new Vector3(0, height, 0);
        ceiling.transform.localScale = new Vector3(width, 1, length);
    }
}
```

### UnityBridge.cs
```csharp
using UnityEngine;
using System.Runtime.InteropServices;
using Newtonsoft.Json;

public class UnityBridge : MonoBehaviour
{
    private RoomManager roomManager;
    
    void Start()
    {
        roomManager = FindObjectOfType<RoomManager>();
    }
    
    // Called from JavaScript/React Native
    [DllImport("__Internal")]
    private static extern void SendMessageToReactNative(string message);
    
    public void HandleMessageFromReactNative(string message)
    {
        try
        {
            var data = JsonConvert.DeserializeObject<MessageData>(message);
            
            switch (data.method)
            {
                case "updateRoom":
                    var roomData = JsonConvert.DeserializeObject<RoomData>(data.data);
                    roomManager.CreateRoom(
                        roomData.width,
                        roomData.length,
                        roomData.height
                    );
                    SendMessageToReactNative(JsonConvert.SerializeObject(
                        new { event = "roomUpdated", success = true }
                    ));
                    break;
                    
                case "placeFurniture":
                    // Handle furniture placement
                    break;
            }
        }
        catch (Exception e)
        {
            Debug.LogError($"Unity Bridge Error: {e.Message}");
        }
    }
    
    private class MessageData
    {
        public string method { get; set; }
        public string data { get; set; }
    }
    
    private class RoomData
    {
        public float width { get; set; }
        public float length { get; set; }
        public float height { get; set; }
    }
}
```

## Performance Considerations

- **WebGL Build Size**: Optimize textures, compress models
- **Loading Time**: Show loading screen while Unity initializes
- **Memory**: Monitor memory usage on mobile devices
- **Frame Rate**: Target 30-60 FPS on mobile

## Alternative: Keep Three.js, Enhance Later

If Unity integration is complex, consider:
- Enhancing current Three.js implementation
- Adding better lighting and shadows
- Importing GLTF models
- Optimizing rendering pipeline

Unity integration can be added later without breaking existing functionality.

