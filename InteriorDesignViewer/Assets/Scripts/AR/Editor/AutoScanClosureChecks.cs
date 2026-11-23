#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;

/// <summary>Exercises real scan evaluation, outline rendering, Review and late input without AR hardware.</summary>
public static class AutoScanClosureChecks
{
    const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;
    static int checks;

    [UnityEditor.MenuItem("AR Interior/Test Auto Scan Closure")]
    public static void Run()
    {
        checks = 0;
        AutoWallGeometryChecks.Run();
        var rectangle = new[] { new Vector2(0, 0), new Vector2(4, 0), new Vector2(4, 3), new Vector2(0, 3) };
        using (var f = new Fixture(new[] { rectangle[0], rectangle[1], rectangle[2] }))
            Check(!f.Floor.loop && !f.Ceiling.loop, "three open corners do not look like a closed triangle");
        using (var f = new Fixture(rectangle))
        {
            Check(!f.Floor.loop && !f.Ceiling.loop, "four open corners are drawn open in AR");
            Set(f.Auto, "<CornerCount>k__BackingField", 4);
            Set(f.Auto, "<WallCount>k__BackingField", 3);
            Check(!(bool)Call(f.Auto, "TryAutoCloseOutline"), "four points without a complete wall boundary stay open");
            Set(f.Auto, "<WallCount>k__BackingField", 4);
            Set(f.Auto, "<OpenEndCount>k__BackingField", 1);
            Check(!(bool)Call(f.Auto, "TryAutoCloseOutline"), "an unfinished wall end prevents automatic closure");

            f.SeedWalls(rectangle);
            Call(f.Auto, "Evaluate");
            Check(f.Builder.IsLoopClosed && f.Auto.CurrentStep == ARAutoRoomScan.Step.Closed,
                "evaluation closes a complete four-wall boundary synchronously");
            Check(f.Spatial.CurrentPhase == ARDesignSpatialMappingController.Phase.ConfirmReview,
                "automatic closure enters Review");
            Check(f.Floor.loop && f.Ceiling.loop, "both AR outlines close when the room actually closes");
            Check(!f.Auto.HasTarget && !Get<bool>(f.Auto, "dwellRunning"), "closure clears the pending target and hold");

            var placed = Get<List<Vector2>>(f.Auto, "placed");
            var before = new List<Vector3>(f.Builder.Corners);
            var count = placed.Count;
            // Also defend against a stale step, rather than relying only on Step.Closed.
            Set(f.Auto, "<CurrentStep>k__BackingField", ARAutoRoomScan.Step.Walls);
            Call(f.Auto, "TickWalls");
            Call(f.Auto, "TickCornerHold");
            Call(f.Auto, "OnTapped", new Vector3(2, 0, 2));
            Call(f.Auto, "OnLongPressed", before[0]);
            Call(f.Auto, "AddPlaced", new Vector2(2, 2));
            Call(f.Auto, "Evaluate");
            f.Auto.StartWallsOver();
            Check(!f.Auto.Undo(), "closed outlines require an explicit reopen before undoing corners");
            f.Builder.SetCorners(new[] { Vector3.zero });
            Check(placed.Count == count && f.Auto.CornerCount == 4 && f.Builder.CornerCount == 4,
                "late evaluation, hold, touch, restart and replacement cannot add or remove closed corners");
            for (var i = 0; i < before.Count; i++)
                Check(f.Builder.Corners[i] == before[i], "closed corner position is unchanged");

            f.Spatial.BackToWalk();
            Check(!f.Builder.IsLoopClosed && !f.Floor.loop && !f.Ceiling.loop
                && f.Spatial.CurrentPhase == ARDesignSpatialMappingController.Phase.Outline,
                "Back to walking explicitly reopens the outline and its rendering");
            Check(!(bool)Call(f.Auto, "TryAutoCloseOutline"), "retained complete walls do not immediately close a reopened outline");
            Call(f.Auto, "AddPlaced", new Vector2(5, 2));
            Check(placed.Count == count + 1, "a reopened outline accepts another corner");
        }

        using (var f = new Fixture(rectangle))
        {
            Get<List<Vector2>>(f.Auto, "placed").Clear();
            f.SeedWalls(rectangle);
            Call(f.Auto, "Evaluate");
            Call(f.Auto, "Evaluate");
            Check(!f.Builder.IsLoopClosed, "newly detected intersections wait for repeated confirmation");
            Call(f.Auto, "Evaluate");
            Check(f.Builder.IsLoopClosed && f.Auto.CornerCount == 4,
                "four automatically confirmed intersections close and freeze the room");
        }

        using (var f = new Fixture(new[] { rectangle[0], rectangle[2], rectangle[1], rectangle[3] }))
        {
            Set(f.Auto, "<CornerCount>k__BackingField", 4);
            Set(f.Auto, "<WallCount>k__BackingField", 4);
            Check(!(bool)Call(f.Auto, "TryAutoCloseOutline"), "crossing outlines cannot auto-close");
        }

        var lRoom = new[] {
            new Vector2(0, 0), new Vector2(5, 0), new Vector2(5, 2),
            new Vector2(2.5f, 2), new Vector2(2.5f, 4), new Vector2(0, 4),
        };
        using (var f = new Fixture(lRoom))
        {
            f.SeedWalls(lRoom);
            Call(f.Auto, "Evaluate");
            Check(f.Builder.IsLoopClosed && f.Builder.CornerCount == 6 && f.Auto.CornerCount == 6,
                "a complete L-shaped room closes with all six corners");
        }

        // Unconfirmed intersections can close the wall ends before they join the outline.
        // They must settle before the scan freezes, or an L room could lose its final corners.
        using (var f = new Fixture(rectangle))
        {
            Set(f.Auto, "<CornerCount>k__BackingField", 4);
            Set(f.Auto, "<WallCount>k__BackingField", 4);
            Get<List<Vector2>>(f.Auto, "placed").Clear();
            var walls = f.MakeWalls(lRoom);
            Call(f.Auto, "TrackCorners", AutoWallGeometry.FindCorners(walls, AutoWallGeometry.Settings.Default));
            Check(!(bool)Call(f.Auto, "TryAutoCloseOutline"), "pending detected corners prevent premature closure");
        }
        Debug.Log($"[AutoScanClosureChecks] Passed {checks} automatic closure, Review, late-input and reopen checks.");
    }

    sealed class Fixture : IDisposable
    {
        readonly GameObject host = new("Auto scan closure checks");
        public readonly ARDesignCornerRoomBuilder Builder;
        public readonly ARAutoRoomScan Auto;
        public readonly ARDesignSpatialMappingController Spatial;
        public readonly LineRenderer Floor;
        public readonly LineRenderer Ceiling;

        public Fixture(Vector2[] points)
        {
            // Inactive components avoid native AR/scene discovery. The real geometry, visuals
            // and event handlers are wired explicitly; no phone state or preferences are changed.
            host.SetActive(false);
            Builder = host.AddComponent<ARDesignCornerRoomBuilder>();
            Auto = host.AddComponent<ARAutoRoomScan>();
            Spatial = host.AddComponent<ARDesignSpatialMappingController>();
            Set(Builder, "root", host.transform);
            Floor = Child("Floor").AddComponent<LineRenderer>();
            Ceiling = Child("Ceiling").AddComponent<LineRenderer>();
            Set(Builder, "floorLoop", Floor);
            Set(Builder, "ceilingLoop", Ceiling);
            Set(Builder, "showEdgeMeasurements", false);
            Set(Builder, "autoOutline", true);
            var markers = Get<List<GameObject>>(Builder, "markers");
            var corners = new List<Vector3>();
            foreach (var point in points)
            {
                markers.Add(Child("Corner"));
                corners.Add(new Vector3(point.x, 0, point.y));
            }
            Builder.SetCorners(corners);
            Set(Auto, "builder", Builder);
            Set(Auto, "root", host.transform);
            Set(Auto, "<CurrentStep>k__BackingField", ARAutoRoomScan.Step.Walls);
            Get<List<Vector2>>(Auto, "placed").AddRange(points);
            Set(Auto, "dwellRunning", true);
            Call(Auto, "OnEnable");
            Set(Spatial, "cornerBuilder", Builder);
            Builder.CornersChanged += OnCornersChanged;
        }

        GameObject Child(string name)
        {
            var child = new GameObject(name);
            child.transform.SetParent(host.transform, false);
            return child;
        }

        void OnCornersChanged() => Call(Spatial, "OnCornersChanged");

        public List<AutoWallGeometry.Wall> MakeWalls(Vector2[] points)
        {
            var pieces = new List<AutoWallGeometry.WallPiece>();
            for (var i = 0; i < points.Length; i++)
            {
                var a = points[i];
                var b = points[(i + 1) % points.Length];
                var dir = (b - a).normalized;
                pieces.Add(new AutoWallGeometry.WallPiece {
                    a = Vector2.Lerp(a, b, 0.2f), b = Vector2.Lerp(a, b, 0.8f),
                    normal = new Vector2(-dir.y, dir.x), weight = 4f,
                });
            }
            return AutoWallGeometry.MergeWalls(pieces, AutoWallGeometry.Settings.Default);
        }

        public void SeedWalls(Vector2[] points)
        {
            var tracker = Get<AutoWallTracker>(Auto, "wallTracker");
            var walls = MakeWalls(points);
            for (var i = 0; i < 32; i++) tracker.Update(walls);
        }

        public void Dispose()
        {
            Builder.CornersChanged -= OnCornersChanged;
            Call(Auto, "OnDisable");
            UnityEngine.Object.DestroyImmediate(host);
        }
    }

    static object Call(object target, string name, params object[] args) => target.GetType().GetMethod(name, Private).Invoke(target, args);
    static void Set(object target, string name, object value) => target.GetType().GetField(name, Private).SetValue(target, value);
    static T Get<T>(object target, string name) => (T)target.GetType().GetField(name, Private).GetValue(target);
    static void Check(bool ok, string what)
    {
        if (!ok) throw new Exception("[AutoScanClosureChecks] Failed: " + what);
        checks++;
    }
}
#endif
