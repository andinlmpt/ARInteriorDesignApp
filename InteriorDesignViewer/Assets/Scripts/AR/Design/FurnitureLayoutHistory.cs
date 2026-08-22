using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Undo / redo stack for furniture place, remove, and transform edits.
/// RN drives this via ARSceneBridge undo / redo methods.
/// </summary>
[DefaultExecutionOrder(-110)]
public class FurnitureLayoutHistory : MonoBehaviour
{
    [SerializeField] private FurniturePlacementController placementController;
    [SerializeField] private FurnitureManipulator manipulator;
    [SerializeField] private int maxSteps = 40;

    public event Action HistoryChanged;

    public bool CanUndo => undo.Count > 0;
    public bool CanRedo => redo.Count > 0;

    public HistoryStatePayload BuildState()
    {
        return new HistoryStatePayload
        {
            canUndo = CanUndo,
            canRedo = CanRedo,
            undoCount = undo.Count,
            redoCount = redo.Count,
        };
    }

    readonly List<ICommand> undo = new();
    readonly List<ICommand> redo = new();

    bool suppressRecording;
    TransformSnapshot gestureStart;
    bool gestureSnapshotValid;

    void Awake()
    {
        if (placementController == null) placementController = FindFirstObjectByType<FurniturePlacementController>();
        if (manipulator == null) manipulator = FindFirstObjectByType<FurnitureManipulator>();
    }

    void OnEnable()
    {
        if (placementController != null)
        {
            placementController.FurniturePlaced += OnPlaced;
            placementController.FurnitureRemoved += OnRemoved;
        }

        if (manipulator != null)
        {
            manipulator.GestureBegan += OnGestureBegan;
            manipulator.GestureEnded += OnGestureEnded;
        }
    }

    void OnDisable()
    {
        if (placementController != null)
        {
            placementController.FurniturePlaced -= OnPlaced;
            placementController.FurnitureRemoved -= OnRemoved;
        }

        if (manipulator != null)
        {
            manipulator.GestureBegan -= OnGestureBegan;
            manipulator.GestureEnded -= OnGestureEnded;
        }
    }

    public bool Undo()
    {
        if (undo.Count == 0) return false;

        suppressRecording = true;
        var command = undo[undo.Count - 1];
        undo.RemoveAt(undo.Count - 1);
        command.Undo(placementController);
        redo.Add(command);
        suppressRecording = false;

        HistoryChanged?.Invoke();
        return true;
    }

    public bool Redo()
    {
        if (redo.Count == 0) return false;

        suppressRecording = true;
        var command = redo[redo.Count - 1];
        redo.RemoveAt(redo.Count - 1);
        command.Redo(placementController);
        undo.Add(command);
        suppressRecording = false;

        HistoryChanged?.Invoke();
        return true;
    }

    public void Clear()
    {
        undo.Clear();
        redo.Clear();
        gestureSnapshotValid = false;
        HistoryChanged?.Invoke();
    }

    void OnPlaced(PlacedFurniture furniture)
    {
        if (suppressRecording || furniture == null) return;
        Push(new PlaceCommand(SnapshotOf(furniture)));
    }

    void OnRemoved(string instanceId)
    {
        if (suppressRecording || string.IsNullOrEmpty(instanceId)) return;

        // Payload was captured by PlacementController before destroy via LastRemovedSnapshot.
        var snapshot = placementController != null ? placementController.LastRemovedSnapshot : null;
        if (snapshot == null || snapshot.instanceId != instanceId) return;

        Push(new RemoveCommand(snapshot));
    }

    void OnGestureBegan(PlacedFurniture furniture)
    {
        if (furniture == null) return;
        gestureStart = SnapshotOf(furniture);
        gestureSnapshotValid = true;
    }

    void OnGestureEnded(PlacedFurniture furniture)
    {
        if (!gestureSnapshotValid || furniture == null) return;
        gestureSnapshotValid = false;

        var after = SnapshotOf(furniture);
        if (gestureStart.ApproximatelyEquals(after)) return;

        Push(new TransformCommand(gestureStart, after));
    }

    void Push(ICommand command)
    {
        undo.Add(command);
        while (undo.Count > maxSteps)
            undo.RemoveAt(0);

        redo.Clear();
        HistoryChanged?.Invoke();
    }

    static TransformSnapshot SnapshotOf(PlacedFurniture furniture)
    {
        return new TransformSnapshot
        {
            instanceId = furniture.InstanceId,
            modelId = furniture.ModelId,
            catalogId = furniture.ModelId,
            width = furniture.RequestedDimensions.x,
            height = furniture.RequestedDimensions.y,
            depth = furniture.RequestedDimensions.z,
            position = furniture.transform.position,
            rotationY = furniture.transform.eulerAngles.y,
            scaleMultiplier = furniture.ScaleMultiplier,
        };
    }

    interface ICommand
    {
        void Undo(FurniturePlacementController placement);
        void Redo(FurniturePlacementController placement);
    }

    sealed class PlaceCommand : ICommand
    {
        readonly TransformSnapshot snapshot;

        public PlaceCommand(TransformSnapshot snapshot) => this.snapshot = snapshot;

        public void Undo(FurniturePlacementController placement)
            => placement.RemoveFurniture(snapshot.instanceId);

        public void Redo(FurniturePlacementController placement)
            => placement.RestoreFurniture(snapshot);
    }

    sealed class RemoveCommand : ICommand
    {
        readonly TransformSnapshot snapshot;

        public RemoveCommand(TransformSnapshot snapshot) => this.snapshot = snapshot;

        public void Undo(FurniturePlacementController placement)
            => placement.RestoreFurniture(snapshot);

        public void Redo(FurniturePlacementController placement)
            => placement.RemoveFurniture(snapshot.instanceId);
    }

    sealed class TransformCommand : ICommand
    {
        readonly TransformSnapshot before;
        readonly TransformSnapshot after;

        public TransformCommand(TransformSnapshot before, TransformSnapshot after)
        {
            this.before = before;
            this.after = after;
        }

        public void Undo(FurniturePlacementController placement)
            => placement.ApplyTransformSnapshot(before);

        public void Redo(FurniturePlacementController placement)
            => placement.ApplyTransformSnapshot(after);
    }
}

[Serializable]
public sealed class TransformSnapshot
{
    public string instanceId;
    public string modelId;
    public string catalogId;
    public float width;
    public float height;
    public float depth;
    public Vector3 position;
    public float rotationY;
    public float scaleMultiplier = 1f;
    public ARDesignLayoutModeController.ViewMode placementSpace =
        ARDesignLayoutModeController.ViewMode.RealRoom;

    public bool ApproximatelyEquals(TransformSnapshot other)
    {
        if (other == null) return false;
        return instanceId == other.instanceId
               && (position - other.position).sqrMagnitude < 1e-6f
               && Mathf.Abs(Mathf.DeltaAngle(rotationY, other.rotationY)) < 0.05f
               && Mathf.Abs(scaleMultiplier - other.scaleMultiplier) < 1e-4f;
    }
}
