# A generic box rig (ROADMAP_V1.1 A7) for the companions and props that are no fish (the Pelican, the Water Hen, the
# shop's Fisherman): every bone and the zone of vertices it carries are described in the settings
# (design/rigs/<Name>.json, "rig": "boxes"), in the mesh's normalised space:
#   side  -1 left .. 1 right (Blender x / half width)
#   t     0 front .. 1 back (from the front, +Y in Blender)
#   h     0 bottom .. 1 top
# Settings:
#   "root":  {"name", "head": [side, t, h], "tail": [side, t, h]}           everything starts on it
#   "bones": [{"name", "parent", "head", "tail", "box": {"side", "t", "h"}, "fade"}]   in order: a later box takes its
#            vertices from the earlier ones (children after their parents), with a soft edge `fade` (0.05)
#   "preview": [{"bone", "axis": [x, y, z] (Blender world), "deg", "cycles" (whole cycles over the loop), "phase"}]
#            the preview loop only; FishRigController / ShopKeeperController play the game's motions
# Use: convert_fish.convert(repo, name) picks this script from the settings' "rig".
import math

import bpy
from mathutils import Quaternion, Vector

FPS, LOOP_FRAMES = 24, 30


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def _inside(value, lo_hi, fade):
    lo, hi = lo_hi
    return smoothstep(lo - fade, lo + fade, value) * (1 - smoothstep(hi - fade, hi + fade, value))


def rig_boxes(obj, settings):
    vs = obj.data.vertices
    xs = [v.co.x for v in vs]
    ys = [v.co.y for v in vs]
    zs = [v.co.z for v in vs]
    half_w = max(-min(xs), max(xs))
    front, back = max(ys), min(ys)
    zmin, zmax = min(zs), max(zs)
    length, span = front - back, zmax - zmin

    def point(p):
        return Vector((p[0] * half_w, front - p[1] * length, zmin + p[2] * span))

    for o in list(bpy.data.objects):
        if o.name == obj.name + "Rig":
            bpy.data.objects.remove(o)
    obj.modifiers.clear()
    obj.parent = None
    arm_data = bpy.data.armatures.new(obj.name + "Rig")
    arm = bpy.data.objects.new(obj.name + "Rig", arm_data)
    obj.users_collection[0].objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    root = settings["root"]
    b = eb.new(root["name"])
    b.head, b.tail = point(root["head"]), point(root["tail"])
    for spec in settings["bones"]:
        b = eb.new(spec["name"])
        b.head, b.tail = point(spec["head"]), point(spec["tail"])
        b.parent = eb[spec.get("parent", root["name"])]
    bpy.ops.object.mode_set(mode="OBJECT")

    names = [bn.name for bn in arm.data.bones]
    obj.vertex_groups.clear()
    groups = {n: obj.vertex_groups.new(name=n) for n in names}
    counts = {n: 0 for n in names}
    for v in vs:
        side = v.co.x / half_w
        t = (front - v.co.y) / length
        h = (v.co.z - zmin) / span
        weights = {root["name"]: 1.0}
        for spec in settings["bones"]:
            box = spec["box"]
            f = spec.get("fade", 0.05)
            w = _inside(side, box.get("side", [-2, 2]), f) * _inside(t, box["t"], f) * _inside(h, box["h"], f)
            if w > 0.001:
                weights = {k: x * (1 - w) for k, x in weights.items()}
                weights[spec["name"]] = weights.get(spec["name"], 0.0) + w
        top4 = sorted(((k, x) for k, x in weights.items() if x > 0.001), key=lambda kv: -kv[1])[:4]
        total = sum(x for _, x in top4) or 1.0
        for name, x in top4:
            groups[name].add([v.index], x / total, "REPLACE")
        counts[top4[0][0]] += 1
    obj.parent = arm
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    return {"armature": arm.name, "bones": names, "dominant_vertices": counts,
            "measure": {"length": length, "height": span, "half_width": half_w}}


def add_preview_action(arm, speed=1.0, motions=None):
    """A looping preview: each listed bone turns `deg` × sin around a Blender world axis, `cycles` whole cycles a loop."""
    motions = motions if motions is not None else arm.get("preview_motions", [])
    arm.animation_data_create()
    old = bpy.data.actions.get(arm.name + "_Preview")
    if old:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new(arm.name + "_Preview")
    arm.animation_data.action = action
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, LOOP_FRAMES
    by_bone = {}
    for m in motions:
        by_bone.setdefault(m["bone"], []).append(m)
    for frame in range(1, LOOP_FRAMES + 2):
        u = (frame - 1) / LOOP_FRAMES
        for name, ms in by_bone.items():
            pb = arm.pose.bones.get(name)
            if not pb:
                continue
            rest = pb.bone.matrix_local.to_3x3()
            q = Quaternion()
            for m in ms:
                angle = m["deg"] * math.sin(u * math.tau * m.get("cycles", 1) - m.get("phase", 0.0))
                if m.get("positive"):  # a one-sided motion (a wave, a beak that only opens)
                    angle = m["deg"] * 0.5 * (1 - math.cos(u * math.tau * m.get("cycles", 1) - m.get("phase", 0.0)))
                axis = (rest.inverted() @ Vector(m["axis"])).normalized()
                q = q @ Quaternion(axis, math.radians(angle))
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=frame)
    return action


def paint_weights(obj, out_path):
    """A check render: each vertex coloured by its dominant bone (vertex colours, flat emission)."""
    palette = [(0.9, 0.2, 0.2), (0.2, 0.7, 0.2), (0.2, 0.4, 0.95), (0.95, 0.8, 0.1), (0.8, 0.3, 0.9), (0.1, 0.85, 0.85),
               (1.0, 0.5, 0.1), (0.5, 0.5, 0.5), (0.95, 0.95, 0.95), (0.4, 0.2, 0.1), (0.1, 0.3, 0.3)]
    me = obj.data
    names = [g.name for g in obj.vertex_groups]
    colors = me.color_attributes.get("BoneCheck") or me.color_attributes.new("BoneCheck", "FLOAT_COLOR", "POINT")
    for v in me.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None)
        c = palette[best.group % len(palette)] if best else (0, 0, 0)
        colors.data[v.index].color = (*c, 1.0)
    mat = bpy.data.materials.new(obj.name + "_bones")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "BoneCheck"
    nt.links.new(attr.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    keep = list(me.materials)
    me.materials.clear()
    me.materials.append(mat)
    legend = {n: palette[i % len(palette)] for i, n in enumerate(names)}
    return keep, legend
