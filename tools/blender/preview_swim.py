# Swim preview of a fish rigged by rig_fish.py (ROADMAP_V1.1 A2): a looping "Swim" action that mirrors V1's
# procedural swim (client/controllers/FishAnimationController.ts: SWIM_FREQUENCY, BODY_WAVE, fin and mouth beats),
# rendered as PNG frames for the owner (local only, never uploaded). tools/blender/frames-to-gif.js makes the GIF.
#
# Use from the Blender MCP:  exec(open("<repo>/tools/blender/preview_swim.py").read()); add_swim_action(arm)
#                            render_preview(obj, arm, out_dir)
import math
import os

import bpy
from mathutils import Matrix, Quaternion, Vector

FPS = 24
LOOP_FRAMES = 30  # 1.25 s: 2 tail beats (1.6 / s), 3 fin beats (2.4 / s), 1 mouth "blub"
SWIM_CYCLES, FIN_CYCLES, MOUTH_CYCLES = 2, 3, 1
BODY_WAVE = 3.0  # radians of lag from nose to tail tip (V1)

# Peak angles (degrees). The spine angles add up along the chain: the tail tip sways ~0.09 x length, like V1.
# Spine yaw peak (degrees) by the bone's t along the body: V1's 4 / 6 / 9 / 12 at the default joints 0.35 / 0.55 /
# 0.72 / 0.86, linear in between and beyond (never under 1°), shared out over the chain (× 4 / spine bones) so a
# longer chain bends the same in total. FishRigController uses the same curve.
SPINE_CURVE = [(0.35, 4.0), (0.55, 6.0), (0.72, 9.0), (0.86, 12.0)]
EAR_FLOP = 10.0  # Ear* bones: a soft flop behind the swim beat


def spine_peak(t, count):
    pts = SPINE_CURVE
    if t <= pts[0][0]:
        (t0, a0), (t1, a1) = pts[0], pts[1]
    elif t >= pts[-1][0]:
        (t0, a0), (t1, a1) = pts[-2], pts[-1]
    else:
        i = next(i for i in range(len(pts) - 1) if pts[i][0] <= t <= pts[i + 1][0])
        (t0, a0), (t1, a1) = pts[i], pts[i + 1]
    peak = a0 + (a1 - a0) * (t - t0) / (t1 - t0)
    return max(1.0, peak) * 4 / count


def is_spine(name):
    return name not in ("Head",) and (name.startswith("Spine") or name.startswith("Tail")) and name[-1].isdigit()
FIN_FLUTTER = 12.0  # FinTop / FinBottom, sideways
PECTORAL_PADDLE = 20.0  # FinL / FinR, back and forth, alternately
JAW_OPEN = 10.0


def _rotation(pose_bone, world_axis, degrees):
    """Pose rotation (bone space) turning the bone by `degrees` around a world axis, through its rest orientation."""
    rest = pose_bone.bone.matrix_local.to_3x3()
    local_axis = (rest.inverted() @ Vector(world_axis)).normalized()
    return Quaternion(local_axis, math.radians(degrees))


def _bone_t(arm, name, nose, length):
    """t (0 nose .. 1 tail) of a bone's head, for the wave's lag."""
    head = arm.data.bones[name].head_local
    return min(max((nose - head.y) / length, 0.0), 1.0)


# Behaviours (ROADMAP_V1.1 A6), as FishRigController plays them: beat (× rate), amount (× amplitude), paddle (×
# pectoral rate), bend (degrees over the spine, a turn: tail trailing), droop (0 .. 1, weak: fins hang, tail sags).
BEHAVIOURS = {
    "Cruise": {},
    "Rest": {"beat": 0.4, "amount": 0.4, "paddle": 0.75},
    "Sprint": {"beat": 1.7, "amount": 1.3, "paddle": 1.4},
    "Turn": {"bend": -28.0},
    "Weak": {"beat": 0.61, "amount": 0.61, "paddle": 0.75, "droop": 1.0},
}
WEAK_FIN_DROOP = 35.0
WEAK_TAIL_SAG = 15.0
WEAK_FLUTTER = 0.5


def add_swim_action(arm, speed=1.0, behaviour=None):
    """Keys a looping "Swim" action on every frame of the loop (linear, cyclic); `behaviour` = a BEHAVIOURS entry."""
    b = behaviour or {}
    beat, amount, paddle = b.get("beat", 1.0), b.get("amount", 1.0), b.get("paddle", 1.0)
    bend, droop = b.get("bend", 0.0), b.get("droop", 0.0)
    fin_amount = max(amount, 0.75)
    bones = arm.data.bones
    nose = max(b.head_local.y for b in bones)
    length = nose - min(b.tail_local.y for b in bones)
    arm.animation_data_create()
    old = bpy.data.actions.get(arm.name + "_Swim")
    if old:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new(arm.name + "_Swim")
    arm.animation_data.action = action
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start, scene.frame_end = 1, LOOP_FRAMES
    for frame in range(1, LOOP_FRAMES + 2):  # one extra key so the loop closes exactly
        u = (frame - 1) / LOOP_FRAMES
        swim = u * SWIM_CYCLES * math.tau * speed * beat
        fin = u * FIN_CYCLES * math.tau * speed * max(paddle, beat)
        mouth = u * MOUTH_CYCLES * math.tau * speed * beat
        poses = {}
        spine = [bn.name for bn in bones if is_spine(bn.name)]
        t_sum = sum(_bone_t(arm, n, nose, length) for n in spine) or 1.0
        for name in spine:
            t = _bone_t(arm, name, nose, length)
            share = t / t_sum
            poses[name] = ((0, 0, 1), amount * spine_peak(t, len(spine)) * math.sin(swim - t * BODY_WAVE) + bend * share,
                           (1, 0, 0), droop * WEAK_TAIL_SAG * share)
        for bn in bones:
            if bn.name.startswith("Ear"):
                poses[bn.name] = ((1, 0, 0), amount * EAR_FLOP * math.sin(swim - 1.8))
        fin_bone = "FinTop" if "FinTop" in bones else "FinBottom" if "FinBottom" in bones else None
        t_fin = _bone_t(arm, fin_bone, nose, length) if fin_bone else 0.5
        flutter = amount * (1 - (1 - WEAK_FLUTTER) * droop) * FIN_FLUTTER * math.sin(swim - t_fin * BODY_WAVE - 1.2)
        poses["FinTop"] = ((0, 1, 0), flutter)
        poses["FinBottom"] = ((0, 1, 0), -flutter)
        # Blender's length axis (-Y toward the tail) is Roblox's +Z: the droop tilts around (0, -1, 0)
        poses["FinR"] = ((0, 0, 1), fin_amount * PECTORAL_PADDLE * math.sin(fin), (0, -1, 0), -droop * WEAK_FIN_DROOP)
        poses["FinL"] = ((0, 0, 1), -fin_amount * PECTORAL_PADDLE * math.sin(fin + math.pi), (0, -1, 0), droop * WEAK_FIN_DROOP)
        poses["Jaw"] = ((1, 0, 0), -amount * JAW_OPEN * max(0.0, math.sin(mouth)) ** 2)  # opens downward, as in the game
        for name, pose in poses.items():
            pb = arm.pose.bones.get(name)
            if not pb:
                continue
            q = _rotation(pb, pose[0], pose[1])
            if len(pose) > 2 and pose[3]:
                q = q @ _rotation(pb, pose[2], pose[3])
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=frame)
    return action


def render_preview(obj, arm, out_dir, view="top", size=(480, 320)):
    """Renders the loop's frames (EEVEE) to out_dir/frame_0001.png... with a camera framing the fish."""
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    # Colours as in the game: no filmic look, and a blue backdrop that the camera sees but that doesn't light the fish
    # (a neutral grey does), so its texture keeps its true hue.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    world = scene.world or bpy.data.worlds.new("PreviewWorld")
    scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputWorld")
    light = nodes.new("ShaderNodeBackground")
    light.inputs["Color"].default_value = (0.55, 0.55, 0.55, 1)
    backdrop = nodes.new("ShaderNodeBackground")
    backdrop.inputs["Color"].default_value = (0.05, 0.22, 0.32, 1)
    path = nodes.new("ShaderNodeLightPath")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(path.outputs["Is Camera Ray"], mix.inputs["Fac"])
    links.new(light.outputs["Background"], mix.inputs[1])
    links.new(backdrop.outputs["Background"], mix.inputs[2])
    links.new(mix.outputs["Shader"], out.inputs["Surface"])

    cam_data = bpy.data.cameras.get("PreviewCam") or bpy.data.cameras.new("PreviewCam")
    cam = bpy.data.objects.get("PreviewCam") or bpy.data.objects.new("PreviewCam", cam_data)
    if cam.name not in scene.collection.objects:
        scene.collection.objects.link(cam)
    cam_data.type = "ORTHO"
    length = max(v.co.y for v in obj.data.vertices) - min(v.co.y for v in obj.data.vertices)
    height = max(v.co.z for v in obj.data.vertices) - min(v.co.z for v in obj.data.vertices)
    # ortho_scale spans the image's width: a tall fish (Flame Gourami, Red Tetra) needs its height to fit too
    aspect = size[0] / size[1]
    cam_data.ortho_scale = max(length, height * aspect) * 1.35
    if view == "top":  # looking down, nose to the right: the swim wave shows as the body bending sideways
        cam.matrix_world = Matrix.Translation((0, 0, 10)) @ Matrix.Rotation(math.radians(90), 4, "Z")
    elif view == "three_quarter":  # from above the fish's right side, a little ahead: the look for the owner
        eye = Vector((7.0, 2.5, 6.0))
        cam.matrix_world = Matrix.Translation(eye) @ (-eye).to_track_quat("-Z", "Y").to_matrix().to_4x4()
        cam_data.ortho_scale = max(length, height * aspect) * 1.5
    else:  # side view from the fish's right, nose to the right: fins and mouth
        cam.matrix_world = (Matrix.Translation((10, 0, 0)) @ Matrix.Rotation(math.radians(90), 4, "Z")
                            @ Matrix.Rotation(math.radians(90), 4, "X"))
    scene.camera = cam

    sun = bpy.data.objects.get("PreviewSun")
    if not sun:
        sun = bpy.data.objects.new("PreviewSun", bpy.data.lights.new("PreviewSun", "SUN"))
        scene.collection.objects.link(sun)
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(35), math.radians(25), 0)

    os.makedirs(out_dir, exist_ok=True)
    for name in os.listdir(out_dir):
        if name.startswith("frame_") and name.endswith(".png"):
            os.remove(os.path.join(out_dir, name))
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        scene.render.filepath = os.path.join(out_dir, "frame_%04d.png" % frame)
        bpy.ops.render.render(write_still=True)
    return {"frames": scene.frame_end - scene.frame_start + 1, "dir": out_dir}
