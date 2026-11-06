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
SPINE_YAW = {"Spine1": 4.0, "Spine2": 6.0, "Tail1": 9.0, "Tail2": 12.0}
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


def add_swim_action(arm, speed=1.0):
    """Keys a looping "Swim" action on every frame of the loop (linear, cyclic)."""
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
        swim = u * SWIM_CYCLES * math.tau * speed
        fin = u * FIN_CYCLES * math.tau * speed
        mouth = u * MOUTH_CYCLES * math.tau * speed
        poses = {}
        for name, peak in SPINE_YAW.items():
            t = _bone_t(arm, name, nose, length)
            poses[name] = ((0, 0, 1), peak * math.sin(swim - t * BODY_WAVE))
        fin_bone = "FinTop" if "FinTop" in bones else "FinBottom" if "FinBottom" in bones else None
        t_fin = _bone_t(arm, fin_bone, nose, length) if fin_bone else 0.5
        flutter = FIN_FLUTTER * math.sin(swim - t_fin * BODY_WAVE - 1.2)
        poses["FinTop"] = ((0, 1, 0), flutter)
        poses["FinBottom"] = ((0, 1, 0), -flutter)
        poses["FinR"] = ((0, 0, 1), PECTORAL_PADDLE * math.sin(fin))
        poses["FinL"] = ((0, 0, 1), -PECTORAL_PADDLE * math.sin(fin + math.pi))
        poses["Jaw"] = ((1, 0, 0), JAW_OPEN * max(0.0, math.sin(mouth)) ** 2)
        for name, (axis, degrees) in poses.items():
            pb = arm.pose.bones.get(name)
            if not pb:
                continue
            pb.rotation_quaternion = _rotation(pb, axis, degrees)
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
