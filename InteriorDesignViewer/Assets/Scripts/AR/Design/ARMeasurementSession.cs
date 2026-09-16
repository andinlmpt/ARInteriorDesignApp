/// <summary>
/// Holds the current standalone measurement session (room name, etc.).
/// </summary>
public static class ARMeasurementSession
{
    public static string RoomName { get; private set; } = string.Empty;

    public static void SetRoomName(string name)
    {
        RoomName = string.IsNullOrWhiteSpace(name) ? "Untitled room" : name.Trim();
    }

    public static void Reset()
    {
        RoomName = string.Empty;
    }
}
