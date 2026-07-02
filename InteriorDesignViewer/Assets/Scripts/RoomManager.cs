using UnityEngine;

public class RoomManager : MonoBehaviour
{
    private GameObject currentRoom;

    // Called from JavaScript via SendMessage
    public void OnMessageFromApp(string json)
    {
        // Simple parsing — good enough for learning
        if (json.Contains("updateRoom"))
        {
            float width = ParseFloat(json, "width", 5f);
            float length = ParseFloat(json, "length", 6f);
            float height = ParseFloat(json, "height", 2.7f);
            CreateRoom(width, length, height);
        }
    }

    void CreateRoom(float width, float length, float height)
    {
        if (currentRoom != null) Destroy(currentRoom);
        currentRoom = new GameObject("Room");

        var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
        floor.transform.SetParent(currentRoom.transform);
        floor.transform.localScale = new Vector3(width / 10f, 1f, length / 10f);

        var sofa = GameObject.CreatePrimitive(PrimitiveType.Cube);
        sofa.transform.SetParent(currentRoom.transform);
        sofa.transform.localScale = new Vector3(1.5f, 0.5f, 0.8f);
        sofa.transform.position = new Vector3(0, 0.25f, 0);
    }

    float ParseFloat(string json, string key, float fallback)
    {
        var search = "\"" + key + "\":";
        var idx = json.IndexOf(search);
        if (idx < 0) return fallback;
        var start = idx + search.Length;
        var end = json.IndexOfAny(new char[] { ',', '}' }, start);
        if (end < 0) return fallback;
        float.TryParse(json.Substring(start, end - start).Trim(), out var val);
        return val;
    }
}