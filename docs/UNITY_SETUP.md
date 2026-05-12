# Unity Integration Setup Instructions

## Quick Start

### Option 1: Unity WebGL (Recommended for Expo Managed Workflow)

This works with Expo managed workflow - no native code required!

#### Step 1: Install React Native WebView

```bash
npm install react-native-webview
```

Or for Expo:
```bash
npx expo install react-native-webview
```

#### Step 2: Create Unity Project

1. **Download Unity Hub and Unity Editor**
   - Download from [unity.com/download](https://unity.com/download)
   - Install Unity 2021.3 LTS or later
   - Install WebGL Build Support module

2. **Create New Unity Project**
   - Open Unity Hub
   - Create New Project
   - Select **3D (URP)** template
   - Name: `InteriorDesignViewer`
   - Location: Choose your desired location

3. **Configure for WebGL**
   - Go to File → Build Settings
   - Select **WebGL** platform
   - Click **Switch Platform**
   - Configure Player Settings:
     - Resolution and Presentation
       - Fullscreen Mode: Windowed
       - Default Canvas Width: 1920
       - Default Canvas Height: 1080
     - Publishing Settings
       - Compression Format: Gzip
       - Compression Level: 1 (for faster loading)

#### Step 3: Create Unity Scene

1. **Create RoomManager Script** (C#)
   - Create folder: `Assets/Scripts`
   - Create script: `RoomManager.cs`
   - See example code in `UNITY_INTEGRATION.md`

2. **Create UnityBridge Script** (C#)
   - Create script: `UnityBridge.cs`
   - Handles communication with React Native
   - See example code in `UNITY_INTEGRATION.md`

3. **Create Scene**
   - File → New Scene
   - Add RoomManager and UnityBridge scripts to scene
   - Create floor, walls, ceiling GameObjects
   - Set up lighting (Directional Light)
   - Save scene: `Assets/Scenes/MainScene.unity`

#### Step 4: Build Unity WebGL

1. **Build Settings**
   - File → Build Settings
   - Select WebGL
   - Click **Build**
   - Choose output folder: `unity-build/`

2. **Deploy Build**
   - Option A: Host on CDN (recommended)
     - Upload `unity-build/` folder to your CDN
     - Get URL: `https://your-cdn.com/unity-build/index.html`
   - Option B: Host locally (for development)
     - Serve with local server
     - URL: `http://localhost:8080/index.html`

#### Step 5: Configure React Native App

1. **Set Environment Variable**
   - Create/update `.env` file:
   ```
   EXPO_PUBLIC_UNITY_BUILD_URL=https://your-cdn.com/unity-build/index.html
   ```
   - Or set in `app.config.js`:
   ```javascript
   extra: {
     unityBuildUrl: process.env.UNITY_BUILD_URL || null,
   }
   ```

2. **Use Unity3DViewer Component**
   - Already integrated in `layout-3d.tsx`
   - Toggle between Unity and Three.js using the button
   - Falls back to Three.js if Unity URL not set

### Option 2: Unity Native Module (Advanced)

For production-grade performance, use Unity as a native module.

**Note:** Requires Expo Development Build or Bare React Native.

#### Setup Steps:

1. **Install Unity Native Integration**
   ```bash
   npm install react-native-unity-view
   # or
   npm install @azesmway/react-native-unity
   ```

2. **Configure Expo Development Build**
   ```bash
   npx expo install expo-dev-client
   eas build --profile development --platform ios
   eas build --profile development --platform android
   ```

3. **Build Unity as Native Library**
   - Export Unity project as iOS/Android library
   - Integrate with React Native native modules

## Communication Protocol

### React Native → Unity

```javascript
// Update room dimensions
unityViewer.sendMessageToUnity('updateRoom', {
  width: 5.0,
  length: 6.0,
  height: 2.7
});

// Place furniture
unityViewer.sendMessageToUnity('placeFurniture', {
  id: 'sofa-1',
  name: 'Sofa',
  position: { x: 1.0, y: 0, z: 2.0 },
  rotation: 90,
  dimensions: { width: 2.0, length: 1.0, height: 0.8 }
});
```

### Unity → React Native

```csharp
// Send message to React Native
SendMessageToReactNative(JsonUtility.ToJson(new {
    event = "furniturePlaced",
    success = true,
    furnitureId = furnitureId
}));
```

## Unity C# Scripts

### RoomManager.cs

```csharp
using UnityEngine;

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
        
        // Create floor
        GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
        floor.transform.SetParent(currentRoom.transform);
        floor.transform.localScale = new Vector3(width / 10f, 1, length / 10f);
        floor.transform.position = new Vector3(0, 0, 0);
        
        // Create walls
        CreateWall("North", new Vector3(0, height / 2, -length / 2), width, height);
        CreateWall("South", new Vector3(0, height / 2, length / 2), width, height);
        CreateWall("East", new Vector3(width / 2, height / 2, 0), length, height);
        CreateWall("West", new Vector3(-width / 2, height / 2, 0), length, height);
        
        // Create ceiling
        GameObject ceiling = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ceiling.transform.SetParent(currentRoom.transform);
        ceiling.transform.localScale = new Vector3(width / 10f, 1, length / 10f);
        ceiling.transform.position = new Vector3(0, height, 0);
        ceiling.transform.rotation = Quaternion.Euler(180, 0, 0);
    }
    
    private void CreateWall(string name, Vector3 position, float length, float height)
    {
        GameObject wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
        wall.name = $"Wall-{name}";
        wall.transform.SetParent(currentRoom.transform);
        wall.transform.position = position;
        wall.transform.localScale = new Vector3(length, height, 0.1f);
    }
}
```

### UnityBridge.cs

```csharp
using UnityEngine;
using System;
using Newtonsoft.Json;

public class UnityBridge : MonoBehaviour
{
    private RoomManager roomManager;
    
    void Start()
    {
        roomManager = FindObjectOfType<RoomManager>();
    }
    
    // Called from JavaScript/React Native via WebGL
    public void HandleMessageFromReactNative(string jsonMessage)
    {
        try
        {
            var message = JsonConvert.DeserializeObject<MessageWrapper>(jsonMessage);
            
            switch (message.method)
            {
                case "updateRoom":
                    var roomData = JsonConvert.DeserializeObject<RoomData>(message.data);
                    roomManager.CreateRoom(
                        roomData.width,
                        roomData.length,
                        roomData.height
                    );
                    SendMessageToReactNative(new {
                        @event = "roomUpdated",
                        success = true
                    });
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
    
    private void SendMessageToReactNative(object data)
    {
        // For WebGL builds
        Application.ExternalCall("ReactNative.postMessage", JsonConvert.SerializeObject(data));
    }
    
    private class MessageWrapper
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

## Testing

1. **Test Unity WebGL Build**
   - Open build in browser first
   - Test communication functions
   - Verify rendering works

2. **Test React Native Integration**
   - Set Unity build URL
   - Load layout-3d screen
   - Toggle to Unity view
   - Test room updates
   - Test furniture placement

## Troubleshooting

### Unity Build Not Loading
- Check build URL is correct
- Verify CORS headers if hosting on server
- Check browser console for errors

### Communication Not Working
- Verify `ReactNative.postMessage` function exists
- Check Unity console for JavaScript call errors
- Ensure message format matches expected structure

### Performance Issues
- Reduce Unity build size (compress textures)
- Use Unity compression settings
- Consider progressive loading

## Benefits of Unity Integration

1. **Professional Graphics**: Superior rendering quality
2. **Asset Store**: Access to 3D models and tools
3. **Performance**: Optimized rendering pipeline
4. **Cross-Platform**: iOS, Android, Web support
5. **AR/VR Ready**: Built-in AR Foundation support

## Current Status

- ✅ Unity3DViewer component created
- ✅ Integration with layout-3d screen
- ✅ Toggle between Unity and Three.js
- ✅ Communication bridge setup
- ⏳ Unity project needs to be created
- ⏳ Unity WebGL build needs to be deployed

## Next Steps

1. Create Unity project following steps above
2. Build and deploy Unity WebGL
3. Set `EXPO_PUBLIC_UNITY_BUILD_URL` environment variable
4. Test Unity integration
5. Enhance Unity scene with better graphics

