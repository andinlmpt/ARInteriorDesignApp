#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;

/// <summary>
/// Device-independent checks for lining a saved layout up with the room: Turn reaches every wall,
/// and the floor the user marked keeps pieces down (2026-11-12).
/// </summary>
public static class LayoutAlignmentChecks
{
    public static void Run()
    {
        // 3.40 x 3.20 m room; the user marked 3.22 m along a 3.40 m wall, so length picks a 3.20 m one.
        var room = new List<Vector3>
        {
            new(0f, 0f, 0f), new(3.4f, 0f, 0f), new(3.4f, 0f, 3.2f), new(0f, 0f, 3.2f),
        };
        var order = ARDesignLayoutAlignmentController.BuildWallOrder(room, matched: 1, measured: 3.22f);
        Check(order.Count == 4, $"Turn offers all four walls of a near-square room (got {order.Count})");
        Check(order[0] == 1 && order[1] == 3, "Turn tries the opposite wall first");
        Check(order.Contains(0) && order.Contains(2), "the 3.40 m walls the user really marked can be reached");

        // A short jog in the outline is not a wall to line up on.
        var jogged = new List<Vector3>
        {
            new(0f, 0f, 0f), new(3.4f, 0f, 0f), new(3.4f, 0f, 3.0f), new(3.1f, 0f, 3.2f), new(0f, 0f, 3.2f),
        };
        var joggedOrder = ARDesignLayoutAlignmentController.BuildWallOrder(jogged, matched: 0, measured: 3.4f);
        Check(!joggedOrder.Contains(2), "a 36 cm jog is not offered as a wall");
        Check(joggedOrder[0] == 0, "the matched wall comes first");

        // The floor of a lined-up design is the floor the user marked; a newer scan takes over.
        ScanPlacement.RememberScan(new[] { new Vector3(0f, -1.30f, 0f), new Vector3(1f, -1.30f, 0f), new Vector3(1f, -1.30f, 1f) });
        ScanPlacement.RememberMarkedFloor(-1.10f);
        Check(ScanPlacement.TryGetScanFloorY(out var marked) && Mathf.Abs(marked + 1.10f) < 1e-4f,
            "pieces stay on the floor the user marked after a line-up");
        ScanPlacement.RememberScan(new[] { new Vector3(0f, -1.25f, 0f), new Vector3(1f, -1.25f, 0f), new Vector3(1f, -1.25f, 1f) });
        Check(ScanPlacement.TryGetScanFloorY(out var scanned) && Mathf.Abs(scanned + 1.25f) < 1e-4f,
            "a newer scan's floor replaces the marked one");

        RecalibrationKeepsPlanPoses();
        Debug.Log("[LayoutAlignmentChecks] Passed wall order, marked-floor and realignment source-pose checks.");
    }

    static void RecalibrationKeepsPlanPoses()
    {
        // Keep the fixture separate from scene cameras/placement, while exposing the real
        // synchronous history notification used to serialize edits back into the 2D plan.
        var fixture = new GameObject("Layout realignment checks");
        fixture.SetActive(false);
        var historyHost = new GameObject("Layout realignment history");
        var existingHistory = UnityEngine.Object.FindFirstObjectByType<FurnitureLayoutHistory>();
        var history = existingHistory != null ? existingHistory : historyHost.AddComponent<FurnitureLayoutHistory>();
        Action observer = null;
        try
        {
            var scan = fixture.AddComponent<RoomScanController>();
            var alignment = fixture.AddComponent<ARDesignLayoutAlignmentController>();
            const BindingFlags flags = BindingFlags.Instance | BindingFlags.NonPublic;
            typeof(ARDesignLayoutAlignmentController).GetField("scan", flags).SetValue(alignment, scan);
            var corners = new[] {
                new Vector3(-2f, 0f, -1.5f), new Vector3(2f, 0f, -1.5f),
                new Vector3(2f, 0f, 1.5f), new Vector3(-2f, 0f, 1.5f),
            };
            Check(scan.ApplyMeasuredRoom(corners, 2.5f), "fixture room is confirmed");
            var source = new Vector3(0.003f, 0f, 0.5605f);
            var firstWorld = new Vector3(9.003f, -1.2f, 12.0605f);
            var currentWorld = firstWorld;
            var currentYaw = 180f;
            var notifications = 0;
            observer = () => {
                var layout = new LayoutPayload();
                layout.furniture.Add(new PlacedFurniturePayload {
                    position = new ARDesignVec3(currentWorld), rotationY = currentYaw,
                });
                alignment.FillSourcePoses(layout);
                var back = layout.furniture[0];
                Check(Mathf.Abs(back.sourcePosition.x - source.x) < 0.001f
                    && Mathf.Abs(back.sourcePosition.z - source.z) < 0.001f,
                    "the history callback sees the original plan position during realignment");
                Check(Mathf.Abs(Mathf.DeltaAngle(back.sourceRotationY, 180f)) < 0.01f,
                    "the history callback preserves the plan rotation");
                notifications++;
            };
            history.HistoryChanged += observer;
            var solve = typeof(ARDesignLayoutAlignmentController).GetMethod("Solve", flags);
            Check((bool)solve.Invoke(alignment, new object[] {
                new Vector3(7f, -1.2f, 10f), new Vector3(11f, -1.2f, 10f), 0, false,
            }), "the layout can be translated onto the marked wall");

            // A second correction turns the already shifted room 90 degrees. Its source frame
            // must still be the original plan, not the result of the first alignment.
            currentWorld = new Vector3(0.5f - source.z, -1.2f, 3f + source.x);
            currentYaw = 90f;
            Check((bool)solve.Invoke(alignment, new object[] {
                new Vector3(2f, -1.2f, 1f), new Vector3(2f, -1.2f, 5f), 0, false,
            }), "the layout can be realigned again after a translation");
            Check(notifications == 2, "both alignments publish updated source poses synchronously");

            var stateField = typeof(ARDesignLayoutAlignmentController).GetField("state", flags);
            stateField.SetValue(alignment, Enum.Parse(stateField.FieldType, "Aligned"));
            typeof(ARDesignLayoutAlignmentController).GetField("autoPlaced", flags).SetValue(alignment, true);
            alignment.Begin(forceManual: true);
            Check(stateField.GetValue(alignment).ToString() == "Aligning",
                "Align room overrides a previous automatic placement");
        }
        finally
        {
            if (observer != null) history.HistoryChanged -= observer;
            UnityEngine.Object.DestroyImmediate(fixture);
            UnityEngine.Object.DestroyImmediate(historyHost);
        }
    }

    static void Check(bool ok, string what)
    {
        if (!ok) throw new Exception("[LayoutAlignmentChecks] Failed: " + what);
    }
}
#endif
