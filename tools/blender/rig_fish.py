# Auto-rig of a fish mesh (ROADMAP_V1.1 A2): an armature built from the mesh's shape, with weights from the same
# position rules as V1's EditableMesh swim (client/controllers/FishAnimationController.ts), so a new species costs
# one command, not an evening in Blender.
#
# Blender axes (the OBJ imported with forward -Z / up Y, see import_fish): nose toward +Y, tail toward -Y, back +Z,
# right side +X. t = 0 at the nose, 1 at the tail tip (V1's t).
#
# Bones (all deforming):
#   Head -> Spine1 -> Spine2 -> Tail1 -> Tail2   spine chain, pointing tailward; the swim bends at each bone's head
#   FinTop, FinBottom (children of Spine1)       dorsal / ventral fins, lateral flutter
#   FinL, FinR (children of Head)                pectoral fins, paddling
#   Jaw (child of Head)                          the lower lip, a small "blub"
# At most 4 influences per vertex (Roblox's limit), weights normalised.
#
# Use from the Blender MCP:  exec(open("<repo>/tools/blender/rig_fish.py").read()); rig_fish(obj, settings)
# Headless:  blender --background --python tools/blender/rig_fish.py -- <FishType>
#            (imports design/meshes/<FishType>.obj, settings from design/rigs/<FishType>.json if present, saves
#            design/rigs/work/<FishType>.blend)
import json
import os
import sys

import bpy
from mathutils import Vector

# Defaults for an ordinary fish; design/rigs/<FishType>.json overrides any key.
DEFAULTS = {
    # t of each spine joint (where Spine1, Spine2, Tail1, Tail2 start); Head covers the nose up to the first one.
    "joints": [0.35, 0.55, 0.72, 0.86],
    # t width over which two spine bones blend around a joint
    "blend": 0.1,
    # V1's zones (smoothstep edges): dorsal / ventral fins on |height|, pectorals on |side|, lips near the nose
    "dorsal": {"height": [0.45, 0.9], "t_in": [0.25, 0.4], "t_out": [0.75, 0.85]},
    "pectoral": {"side": [0.62, 0.95], "t_in": [0.12, 0.25], "t_out": [0.5, 0.65]},
    "lips": {"t": [0.02, 0.1]},
    # Per-species switches: a hat or a bag on the back is not a dorsal fin (fin_top false), whiskers under the mouth
    # must not move with it (jaw false, CLAUDE.md §7); rigid_top [lo, hi] = smoothstep edges on height above which
    # everything follows the head rigidly (a hat), with a soft transition so nothing tears.
    "fin_top": True,
    "fin_bottom": True,
    "jaw": True,
    "rigid_top": None,
}

SPINE = ["Head", "Spine1", "Spine2", "Tail1", "Tail2"]


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def merged_settings(overrides):
    settings = json.loads(json.dumps(DEFAULTS))
    for key, value in (overrides or {}).items():
        if isinstance(value, dict) and isinstance(settings.get(key), dict):
            settings[key].update(value)
        else:
            settings[key] = value
    return settings


def import_fish(obj_path, name):
    """Imports a Studio-exported OBJ with Roblox's axes (Y up, front -Z) and bakes the axis change into the mesh."""
    bpy.ops.wm.obj_import(filepath=obj_path, forward_axis="NEGATIVE_Z", up_axis="Y")
    obj = bpy.context.selected_objects[0]
    obj.name = name
    obj.data.name = name
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def measure(obj):
    vs = obj.data.vertices
    xs = [v.co.x for v in vs]
    ys = [v.co.y for v in vs]
    zs = [v.co.z for v in vs]
    return {
        "nose": max(ys),
        "length": max(ys) - min(ys),
        "half_width": max(-min(xs), max(xs)),
        "mid_z": (min(zs) + max(zs)) / 2,
        "half_height": (max(zs) - min(zs)) / 2,
    }


def spine_weights(t, joints, blend):
    """Weights of the 5 spine bones for a vertex at t: 1 inside a bone, smooth blend across each joint."""
    w = [0.0] * len(SPINE)
    # index of the bone whose segment holds t
    bounds = [0.0] + list(joints) + [1.0]
    for i in range(len(SPINE)):
        lo, hi = bounds[i], bounds[i + 1]
        rise = 1.0 if i == 0 else smoothstep(lo - blend / 2, lo + blend / 2, t)
        fall = 1.0 if i == len(SPINE) - 1 else 1 - smoothstep(hi - blend / 2, hi + blend / 2, t)
        w[i] = max(0.0, min(rise, fall))
    total = sum(w) or 1.0
    return [x / total for x in w]


def build_armature(obj, m, s):
    """Armature object named <Fish>Rig, parented to nothing, at the mesh's origin."""
    nose, L = m["nose"], m["length"]
    hw, mz, hh = m["half_width"], m["mid_z"], m["half_height"]
    y_at = lambda t: nose - t * L  # noqa: E731

    arm_data = bpy.data.armatures.new(obj.name + "Rig")
    arm = bpy.data.objects.new(obj.name + "Rig", arm_data)
    obj.users_collection[0].objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def bone(name, head, tail, parent=None, roll=0.0):
        b = eb.new(name)
        b.head, b.tail, b.roll = Vector(head), Vector(tail), roll
        if parent:
            b.parent = eb[parent]
            b.use_connect = False
        return b

    starts = [0.05] + list(s["joints"])
    ends = list(s["joints"]) + [1.0]
    for i, name in enumerate(SPINE):
        bone(name, (0, y_at(starts[i]), mz), (0, y_at(ends[i]), mz), SPINE[i - 1] if i else None)
        if i:
            eb[name].use_connect = True

    dt = s["dorsal"]
    t_fin = (dt["t_in"][1] + dt["t_out"][0]) / 2
    if s["fin_top"]:
        bone("FinTop", (0, y_at(t_fin), mz + dt["height"][0] * hh), (0, y_at(t_fin), mz + hh), "Spine1")
    if s["fin_bottom"]:
        bone("FinBottom", (0, y_at(t_fin), mz - dt["height"][0] * hh), (0, y_at(t_fin), mz - hh), "Spine1")

    pc = s["pectoral"]
    t_pec = (pc["t_in"][1] + pc["t_out"][0]) / 2
    for side, name in ((1, "FinR"), (-1, "FinL")):
        bone(name, (side * pc["side"][0] * hw, y_at(t_pec), mz), (side * hw, y_at(t_pec), mz), "Head")

    lp = s["lips"]["t"]
    if s["jaw"]:
        bone("Jaw", (0, y_at(lp[1] * 2), mz - 0.15 * hh), (0, y_at(0.0), mz - 0.15 * hh), "Head")

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def assign_weights(obj, arm, m, s):
    nose, L = m["nose"], m["length"]
    hw, mz, hh = m["half_width"], m["mid_z"], m["half_height"]
    names = [b.name for b in arm.data.bones]
    obj.vertex_groups.clear()
    groups = {n: obj.vertex_groups.new(name=n) for n in names}
    d, p, lp = s["dorsal"], s["pectoral"], s["lips"]["t"]
    stats = {n: 0 for n in names}
    for v in obj.data.vertices:
        t = min(max((nose - v.co.y) / L, 0.0), 1.0)
        side = v.co.x / hw
        height = (v.co.z - mz) / hh
        dorsal = smoothstep(*d["height"], abs(height)) * smoothstep(*d["t_in"], t) * (1 - smoothstep(*d["t_out"], t))
        pectoral = smoothstep(*p["side"], abs(side)) * smoothstep(*p["t_in"], t) * (1 - smoothstep(*p["t_out"], t))
        jaw = (1 - smoothstep(lp[0], lp[1], t)) * min(max(-height * 2, 0.0), 1.0)
        extra = {}
        fin = "FinTop" if height > 0 else "FinBottom"
        if dorsal > 0.001 and fin in groups:
            extra[fin] = dorsal
        if pectoral > 0.001:
            extra["FinR" if side >= 0 else "FinL"] = pectoral
        if jaw > 0.001 and "Jaw" in groups:
            extra["Jaw"] = jaw
        rest = max(0.0, 1.0 - sum(extra.values()))
        weights = dict(extra)
        for name, w in zip(SPINE, spine_weights(t, s["joints"], s["blend"])):
            if w > 0.001:
                weights[name] = weights.get(name, 0.0) + w * rest
        if s["rigid_top"]:
            rigid = smoothstep(*s["rigid_top"], height)
            if rigid > 0.001:
                weights = {name: w * (1 - rigid) for name, w in weights.items()}
                weights["Head"] = weights.get("Head", 0.0) + rigid
        # Roblox: at most 4 influences, normalised
        top = sorted(weights.items(), key=lambda kv: -kv[1])[:4]
        total = sum(w for _, w in top) or 1.0
        for name, w in top:
            groups[name].add([v.index], w / total, "REPLACE")
            stats[name] += 1
    return stats


def rig_fish(obj, overrides=None):
    """Rigs `obj` (a fish mesh, Blender axes above). Returns a summary dict."""
    s = merged_settings(overrides)
    for o in list(bpy.data.objects):
        if o.name == obj.name + "Rig":
            bpy.data.objects.remove(o)
    obj.modifiers.clear()
    obj.parent = None
    m = measure(obj)
    arm = build_armature(obj, m, s)
    stats = assign_weights(obj, arm, m, s)
    obj.parent = arm
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    return {"armature": arm.name, "bones": [b.name for b in arm.data.bones], "vertices_per_bone": stats, "measure": m}


def _main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if not argv:
        print("Usage: blender --background --python tools/blender/rig_fish.py -- <FishType>")
        return
    fish = argv[0]
    root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
    bpy.ops.wm.read_homefile(use_empty=True)
    obj = import_fish(os.path.join(root, "design", "meshes", fish + ".obj"), fish)
    settings_path = os.path.join(root, "design", "rigs", fish + ".json")
    overrides = json.load(open(settings_path)) if os.path.exists(settings_path) else None
    print(json.dumps(rig_fish(obj, overrides)))
    os.makedirs(os.path.join(root, "design", "rigs", "work"), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root, "design", "rigs", "work", fish + ".blend"))


if __name__ == "__main__":
    _main()
