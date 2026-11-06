# Auto-rig of the Jellyfish companion (ROADMAP_V1.1 A7): not a fish, so its own skeleton, built from its shape.
# Blender axes (imported like the fish, rig_fish.import_fish): up +Z, front +Y (Roblox -Z), right +X.
#
# Bones (all deforming):
#   Bell                               the root, at the dome's centre: the whole jellyfish follows it (bob, sway)
#   RimF, RimB, RimL, RimR             from near the dome's top down to its rim, one per side: turning around that
#                                      high pivot, the rim swings in like a skirt and the bell squeezes
#   TentF1..3, TentB1..3, TentL1..3,   a 3-bone chain per side, from the rim down to the tentacles' tips: they trail
#   TentR1..3                          the pulse
# FishRigController drives them by name (front = Roblox -Z, back +Z, left -X, right +X). Settings
# (design/rigs/Jellyfish.json, "rig": "jellyfish") override DEFAULTS.
#
# Use: convert_fish.convert(repo, "Jellyfish") picks this script from the settings' "rig".
import math

import bpy
from mathutils import Vector

DEFAULTS = {
    # height (0 bottom .. 1 top of the mesh) where the dome meets the tentacles, and of the bell bone
    "rim": 0.55,
    "bell": 0.75,
    # height of the rim bones' pivot: near the top, so the dome swings in from there instead of denting
    "pivot": 0.92,
    # heights where the tentacle chains bend (top to bottom)
    "tentacle_joints": [0.37, 0.18],
    # soft blend (in height) between the dome and the tentacles, and between two chain bones
    "blend": 0.08,
}

SIDES = {"F": (0.0, 1.0), "B": (0.0, -1.0), "L": (-1.0, 0.0), "R": (1.0, 0.0)}


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def _sector_weights(x, y):
    """Share of each side (F, B, L, R) for a point around the vertical axis: cos² of the angle to it, normalised."""
    r = math.hypot(x, y)
    if r < 1e-6:
        return {k: 0.25 for k in SIDES}
    w = {k: max(0.0, (x * dx + y * dy) / r) ** 2 for k, (dx, dy) in SIDES.items()}
    total = sum(w.values()) or 1.0
    return {k: v / total for k, v in w.items()}


def rig_jellyfish(obj, overrides=None):
    s = dict(DEFAULTS)
    s.update({k: v for k, v in (overrides or {}).items() if k in DEFAULTS})
    vs = obj.data.vertices
    zs = [v.co.z for v in vs]
    zmin, zmax = min(zs), max(zs)
    span = zmax - zmin
    z_at = lambda h: zmin + h * span  # noqa: E731
    r_max = max(math.hypot(v.co.x, v.co.y) for v in vs)
    rim_r = max(math.hypot(v.co.x, v.co.y) for v in vs if abs((v.co.z - zmin) / span - s["rim"]) < 0.08)

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

    bone("Bell", (0, 0, z_at(s["bell"])), (0, 0, zmax), None)
    heights = [s["rim"]] + list(s["tentacle_joints"]) + [0.0]
    for k, (dx, dy) in SIDES.items():
        bone("Rim" + k, (0, 0, z_at(s["pivot"])), (dx * rim_r, dy * rim_r, z_at(s["rim"])), "Bell")
        parent = "Bell"
        for i in range(3):
            # the chain hangs under the rim, halfway out from the axis
            top, bottom = heights[i], heights[i + 1]
            r = rim_r * 0.55
            bone("Tent%s%d" % (k, i + 1), (dx * r, dy * r, z_at(top)), (dx * r, dy * r, z_at(bottom)), parent)
            parent = "Tent%s%d" % (k, i + 1)
    bpy.ops.object.mode_set(mode="OBJECT")

    names = [b.name for b in arm.data.bones]
    obj.vertex_groups.clear()
    groups = {n: obj.vertex_groups.new(name=n) for n in names}
    f = s["blend"]
    for v in vs:
        h = (v.co.z - zmin) / span
        sectors = _sector_weights(v.co.x, v.co.y)
        dome = smoothstep(s["rim"] - f, s["rim"] + f, h)
        weights = {}
        # the dome: its centre stays on Bell, the rim follows the side bones more and more toward its edge
        out = smoothstep(0.25, 1.0, math.hypot(v.co.x, v.co.y) / r_max) * (1 - smoothstep(0.85, 1.0, h))
        if dome > 0:
            weights["Bell"] = dome * (1 - out)
            for k, sw in sectors.items():
                if sw > 0.001:
                    weights["Rim" + k] = weights.get("Rim" + k, 0.0) + dome * out * sw
        # the tentacles: by side, then by height along the chain
        tent = 1 - dome
        if tent > 0:
            # chain bone i covers heights[i] .. heights[i + 1] (top to bottom), blended across each joint
            below_1 = smoothstep(heights[1] - f, heights[1] + f, h)
            below_2 = smoothstep(heights[2] - f, heights[2] + f, h)
            for i, seg in enumerate((below_1, below_2 * (1 - below_1), 1 - below_2)):
                for k, sw in sectors.items():
                    w = tent * seg * sw
                    if w > 0.001:
                        weights["Tent%s%d" % (k, i + 1)] = weights.get("Tent%s%d" % (k, i + 1), 0.0) + w
        top4 = sorted(weights.items(), key=lambda kv: -kv[1])[:4]
        total = sum(w for _, w in top4) or 1.0
        for name, w in top4:
            groups[name].add([v.index], w / total, "REPLACE")
    obj.parent = arm
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    return {"armature": arm.name, "bones": names, "measure": {"zmin": zmin, "zmax": zmax, "r_max": r_max, "rim_r": rim_r}}


# The pulse (as FishRigController plays it): 0.8 pulses a second, the rim squeezes in, the tentacles trail behind, the
# whole jellyfish rises a little with each squeeze and sways slowly (V1's CompanionAnimationController numbers).
PULSE_FREQUENCY = 0.8
RIM_SQUEEZE = 12.0
TENTACLE_TRAIL = 14.0
TENTACLE_LAG = 0.9  # radians per chain bone
BOB = 0.15  # studs at the game's size; here in mesh units (the preview's mesh is ~2.4 tall, the game's 4.6)
SWAY = 5.0
FPS, LOOP_FRAMES = 24, 30


def add_pulse_action(arm, speed=1.0):
    """A looping preview of the pulse (30 frames: one pulse = 1.25 s)."""
    from mathutils import Quaternion

    arm.animation_data_create()
    old = bpy.data.actions.get(arm.name + "_Pulse")
    if old:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new(arm.name + "_Pulse")
    arm.animation_data.action = action
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, LOOP_FRAMES
    sway_cycles = 0.5  # the sway is slower than the pulse
    for frame in range(1, LOOP_FRAMES + 2):
        u = (frame - 1) / LOOP_FRAMES
        p = u * math.tau * speed  # one pulse per loop
        squeeze = 0.5 + 0.5 * math.sin(p)
        for pb in arm.pose.bones:
            rest = pb.bone.matrix_local.to_3x3()

            def rot(axis, degrees):
                return Quaternion((rest.inverted() @ Vector(axis)).normalized(), math.radians(degrees))

            name = pb.name
            if name == "Bell":
                pb.rotation_quaternion = rot((0, 1, 0), SWAY * math.sin(u * math.tau * sway_cycles))
                pb.location = rest.inverted() @ Vector((0, 0, BOB * 0.5 * squeeze))
                pb.keyframe_insert("location", frame=frame)
            elif name.startswith("Rim"):
                dx, dy = SIDES[name[3]]
                tangent = Vector((0, 0, 1)).cross(Vector((dx, dy, 0)))
                pb.rotation_quaternion = rot(tangent, -RIM_SQUEEZE * squeeze)
            elif name.startswith("Tent"):
                dx, dy = SIDES[name[4]]
                tangent = Vector((0, 0, 1)).cross(Vector((dx, dy, 0)))
                i = int(name[5]) - 1
                pb.rotation_quaternion = rot(tangent, TENTACLE_TRAIL * math.sin(p - (i + 1) * TENTACLE_LAG))
            else:
                continue
            pb.keyframe_insert("rotation_quaternion", frame=frame)
    return action
