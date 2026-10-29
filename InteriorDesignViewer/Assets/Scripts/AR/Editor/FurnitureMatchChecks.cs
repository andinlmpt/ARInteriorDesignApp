#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Device-independent checks for telling furniture finds apart: chairs at a table and side by side
/// stay separate pieces; one piece seen twice, or under two labels, is merged.
/// </summary>
public static class FurnitureMatchChecks
{
    public static void Run()
    {
        // A 1.2 × 0.8 m classroom table with four chairs pushed in, half under its long edges.
        var table = Find("table", "Table", new Vector3(2f, 0f, 2f), new Vector3(1.2f, 0.75f, 0.8f), 0f, 0.7f);
        var chairs = new[]
        {
            Find("chair", "Chair", new Vector3(1.7f, 0f, 1.55f), Chair, 0f, 0.6f),
            Find("chair", "Chair", new Vector3(2.3f, 0f, 1.55f), Chair, 0f, 0.6f),
            Find("chair", "Chair", new Vector3(1.7f, 0f, 2.45f), Chair, 180f, 0.6f),
            Find("chair", "Chair", new Vector3(2.3f, 0f, 2.45f), Chair, 180f, 0.6f),
        };
        var list = new List<FurnitureAutoSuggestion> { table };
        foreach (var chair in chairs)
            Check(FurnitureMatch.AddOrRefine(list, chair, 30), "a chair pushed in under the table is added");
        Check(list.Count == 5, "table and its four chairs are five pieces");
        Check(list[0].type == "table", "the table is still the table");

        // Each chair seen again a little off (floor-ray noise): no new pieces, each seen twice.
        foreach (var chair in chairs)
        {
            var again = chair;
            again.center += new Vector3(0.1f, 0f, -0.08f);
            again.confidence = 0.5f;
            FurnitureMatch.AddOrRefine(list, again, 30);
        }
        Check(list.Count == 5, "chairs seen again aren't counted twice");
        for (var i = 1; i < list.Count; i++)
            Check(list[i].sightings == 2, "each chair is seen twice");

        // Two chairs side by side, 0.5 m apart, touching.
        var row = new List<FurnitureAutoSuggestion>();
        FurnitureMatch.AddOrRefine(row, Find("chair", "Chair", new Vector3(0f, 0f, 0f), Chair, 0f, 0.6f), 30);
        FurnitureMatch.AddOrRefine(row, Find("chair", "Chair", new Vector3(0.5f, 0f, 0f), Chair, 0f, 0.6f), 30);
        Check(row.Count == 2, "two chairs side by side stay two");

        // One sofa found as "Couch", then more confidently as "Loveseat" with a slightly smaller box.
        var sofas = new List<FurnitureAutoSuggestion>();
        FurnitureMatch.AddOrRefine(sofas, Find("sofa", "Couch", new Vector3(1f, 0f, 1f), new Vector3(2f, 0.8f, 0.9f), 0f, 0.4f), 30);
        FurnitureMatch.AddOrRefine(sofas, Find("sofa", "Loveseat", new Vector3(1.15f, 0f, 1.05f), new Vector3(1.6f, 0.8f, 0.85f), 0f, 0.6f), 30);
        Check(sofas.Count == 1 && sofas[0].label == "Loveseat" && sofas[0].sightings == 2,
            "one sofa under two labels is one piece, with the more confident label");

        // The same piece under two types ("Table" and "Desk"): one piece, not two stacked boxes.
        var desks = new List<FurnitureAutoSuggestion>();
        FurnitureMatch.AddOrRefine(desks, Find("table", "Table", new Vector3(0f, 0f, 0f), new Vector3(1.2f, 0.75f, 0.6f), 0f, 0.5f), 30);
        FurnitureMatch.AddOrRefine(desks, Find("desk", "Desk", new Vector3(0.05f, 0f, 0.05f), new Vector3(1.2f, 0.75f, 0.6f), 0f, 0.4f), 30);
        Check(desks.Count == 1 && desks[0].type == "table", "a table also seen as a desk is one piece");

        // Turned boxes: a chair turned 90° right next to a turned table is still its own piece.
        Check(!FurnitureMatch.SameObject(new Vector3(0f, 0f, 0f), new Vector3(1.2f, 0.75f, 0.8f), 90f,
            new Vector3(0f, 0f, 0.75f), Chair, 90f), "chair at the end of a turned table is separate");
        Check(FurnitureMatch.SameObject(new Vector3(0f, 0f, 0f), new Vector3(1.2f, 0.75f, 0.8f), 90f,
            new Vector3(0.05f, 0f, 0.1f), new Vector3(1.1f, 0.75f, 0.7f), 85f), "a turned table seen twice is the same");

        // The cap: the 31st piece isn't added.
        var full = new List<FurnitureAutoSuggestion>();
        for (var i = 0; i < 31; i++)
            FurnitureMatch.AddOrRefine(full, Find("chair", "Chair", new Vector3(i * 0.6f, 0f, 0f), Chair, 0f, 0.6f), 30);
        Check(full.Count == 30, "at most 30 pieces are kept");

        // A surface guess isn't merged into a recognised piece (recognised pieces replace guesses first).
        var mixed = new List<FurnitureAutoSuggestion> { table };
        var guess = table;
        guess.source = "plane";
        Check(!FurnitureMatch.AddOrRefine(mixed, guess, 30) && mixed.Count == 1, "a surface guess over a found table is left out");

        Debug.Log("[FurnitureMatchChecks] Passed table-and-chairs, side-by-side and same-object checks.");
    }

    static readonly Vector3 Chair = new Vector3(0.5f, 0.9f, 0.5f);

    static int nextId;

    static FurnitureAutoSuggestion Find(string type, string label, Vector3 center, Vector3 size, float yaw, float confidence)
        => new FurnitureAutoSuggestion
        {
            id = $"test-{++nextId}",
            type = type,
            label = label,
            center = center,
            size = size,
            yaw = yaw,
            confidence = confidence,
            source = "coco",
            sightings = 1,
        };

    static void Check(bool ok, string what)
    {
        if (!ok) throw new Exception("[FurnitureMatchChecks] Failed: " + what);
    }
}
#endif
