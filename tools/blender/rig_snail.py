# Auto-rig of the Snail companion (ROADMAP_V1.1 A7): not a fish, its own skeleton, built from its shape.
# Blender axes (imported like the fish, rig_fish.import_fish): up +Z, front +Y (Roblox -Z), right +X.
# t = 0 at the front of the mesh, 1 at its back; h = 0 at the bottom of the foot, 1 at the top of the shell.
#
# Bones (all deforming):
#   Foot                the root, the middle of the foot
#   Shell               the shell, rigid (it rocks a little as the snail crawls)
#   SnailHead           the head, the neck and the front of the foot: it reaches forward ...
#   SnailTail           ... and the back of the foot follows: the body stretches and gathers as it crawls
#   EyeL, EyeR          the eye stalks (children of SnailHead): they sway
# FishRigController drives them by name. Settings (design/rigs/Snail.json, "rig": "snail") override DEFAULTS.
import math

import bpy
from mathutils import Vector

DEFAULTS = {
    "foot": 0.13,  # h of the top of the foot slab
    "neck": [0.22, 0.3],  # t where the head / neck gives way to the shell (smoothstep edges)
    "front_foot": [0.25, 0.42],  # t where the front of the foot stops following the head
    "back_foot": [0.62, 0.8],  # t from where the back of the foot follows the tail
    "eyes": {"h": [0.66, 0.74], "t_max": 0.24, "x_gap": 0.08},  # the stalks: high, at the front, one per side
}


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def rig_snail(obj, overrides=None):
    s = {k: (dict(v) if isinstance(v, dict) else v) for k, v in DEFAULTS.items()}
    for k, v in (overrides or {}).items():
        if k in s:
            s[k] = v
    vs = obj.data.vertices
    xs = [v.co.x for v in vs]
    ys = [v.co.y for v in vs]
    zs = [v.co.z for v in vs]
    front, back = max(ys), min(ys)
    zmin, zmax = min(zs), max(zs)
    length, span = front - back, zmax - zmin
    half_w = max(-min(xs), max(xs))
    y_at = lambda t: front - t * length  # noqa: E731
    z_at = lambda h: zmin + h * span  # noqa: E731
    e = s["eyes"]
    stalks = {side: [v for v in vs if (v.co.z - zmin) / span > e["h"][0] and (front - v.co.y) / length < e["t_max"]
                     and v.co.x * side > e["x_gap"] * half_w] for side in (-1, 1)}
    eye_x = {side: (sum(v.co.x for v in pts) / len(pts) if pts else side * 0.35 * half_w) for side, pts in stalks.items()}
    eye_y = {side: (sum(v.co.y for v in pts) / len(pts) if pts else y_at(0.1)) for side, pts in stalks.items()}

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

    def bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        if parent:
            b.parent = eb[parent]
        return b

    foot_z = z_at(s["foot"] / 2)
    bone("Foot", (0, y_at(0.5), foot_z), (0, y_at(0.35), foot_z))
    bone("Shell", (0, y_at(0.6), z_at(s["foot"])), (0, y_at(0.6), zmax), "Foot")
    bone("SnailHead", (0, y_at(0.3), foot_z), (0, y_at(0.0), foot_z), "Foot")
    bone("SnailTail", (0, y_at(0.7), foot_z), (0, y_at(1.0), foot_z), "Foot")
    for side, name in ((-1, "EyeL"), (1, "EyeR")):
        bone(name, (eye_x[side], eye_y[side], z_at(e["h"][0])), (eye_x[side], eye_y[side], zmax), "SnailHead")
    bpy.ops.object.mode_set(mode="OBJECT")

    names = [b.name for b in arm.data.bones]
    obj.vertex_groups.clear()
    groups = {n: obj.vertex_groups.new(name=n) for n in names}
    for v in vs:
        t = (front - v.co.y) / length
        h = (v.co.z - zmin) / span
        foot = 1 - smoothstep(s["foot"] - 0.04, s["foot"] + 0.04, h)
        neck = 1 - smoothstep(s["neck"][0], s["neck"][1], t)  # 1 on the head / neck, 0 on the shell
        weights = {}
        # the foot slab: its front follows the head, its back the tail, its middle stays on Foot
        if foot > 0:
            to_head = 1 - smoothstep(*s["front_foot"], t)
            to_tail = smoothstep(*s["back_foot"], t)
            weights["SnailHead"] = foot * to_head
            weights["SnailTail"] = foot * to_tail
            weights["Foot"] = foot * max(0.0, 1 - to_head - to_tail)
        above = 1 - foot
        if above > 0:
            weights["SnailHead"] = weights.get("SnailHead", 0.0) + above * neck
            weights["Shell"] = weights.get("Shell", 0.0) + above * (1 - neck)
            # the stalks: high on the head, one per side
            stalk = smoothstep(*e["h"], h) * (1 - smoothstep(e["t_max"] - 0.04, e["t_max"] + 0.04, t)) * above
            if stalk > 0.001:
                side = "EyeR" if v.co.x >= 0 else "EyeL"
                keep = 1 - stalk
                weights = {k: w * keep for k, w in weights.items()}
                weights[side] = stalk
        top4 = sorted(((k, w) for k, w in weights.items() if w > 0.001), key=lambda kv: -kv[1])[:4]
        total = sum(w for _, w in top4) or 1.0
        for name, w in top4:
            groups[name].add([v.index], w / total, "REPLACE")
    obj.parent = arm
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    return {"armature": arm.name, "bones": names,
            "measure": {"length": length, "height": span, "eye_x": [eye_x[-1], eye_x[1]], "stalk_vertices": [len(stalks[-1]), len(stalks[1])]}}


# The crawl (as FishRigController plays it, at its strolling speed): the head reaches forward, the back of the foot
# follows, the shell rocks a little; the eye stalks sway all the time, a little apart.
CRAWL_FREQUENCY = 0.8  # stretches per second while strolling
STRETCH = 0.06  # × its length, how far the head reaches / the tail follows
TAIL_LAG = 1.4  # radians: the tail gathers after the head has reached
SHELL_ROCK = 3.0  # degrees
EYE_SWAY = 12.0  # degrees
EYE_FREQUENCY = 0.6
FPS, LOOP_FRAMES = 24, 30


def add_preview_action(arm, speed=1.0):
    """A looping preview of the crawl (30 frames = 1.25 s: one stretch)."""
    from mathutils import Quaternion

    bones = arm.data.bones
    length = max(b.head_local.y for b in bones) - min(b.tail_local.y for b in bones)
    arm.animation_data_create()
    old = bpy.data.actions.get(arm.name + "_Crawl")
    if old:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new(arm.name + "_Crawl")
    arm.animation_data.action = action
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, LOOP_FRAMES
    for frame in range(1, LOOP_FRAMES + 2):
        u = (frame - 1) / LOOP_FRAMES
        p = u * math.tau * speed
        # whole cycles over the loop, or the stalks jump when the GIF starts over: 1 sway, 2 tilts
        q = u * math.tau
        q_tilt = u * math.tau * 2
        for pb in arm.pose.bones:
            rest = pb.bone.matrix_local.to_3x3()

            def rot(axis, degrees):
                return Quaternion((rest.inverted() @ Vector(axis)).normalized(), math.radians(degrees))

            name = pb.name
            if name == "SnailHead":
                pb.location = rest.inverted() @ Vector((0, STRETCH * length * 0.5 * (1 + math.sin(p)), 0))
                pb.keyframe_insert("location", frame=frame)
            elif name == "SnailTail":
                pb.location = rest.inverted() @ Vector((0, STRETCH * length * 0.5 * (1 + math.sin(p - TAIL_LAG)), 0))
                pb.keyframe_insert("location", frame=frame)
            elif name == "Shell":
                pb.rotation_quaternion = rot((0, 1, 0), SHELL_ROCK * math.sin(p))
                pb.keyframe_insert("rotation_quaternion", frame=frame)
            elif name in ("EyeL", "EyeR"):
                lag = 0.0 if name == "EyeL" else 1.3
                pb.rotation_quaternion = rot((1, 0, 0), EYE_SWAY * math.sin(q - lag)) @ rot((0, 1, 0), 0.5 * EYE_SWAY * math.sin(q_tilt + lag))
                pb.keyframe_insert("rotation_quaternion", frame=frame)
    return action
