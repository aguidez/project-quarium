# One species (or companion) through the whole Blender side of the bone pipeline (V1.1), in one call from the Blender MCP:
#   ns = {}; exec(open("<repo>/tools/blender/convert_fish.py").read(), ns); ns["convert"]("<repo>", "BlueNeon")
# Needs design/meshes/<Fish>.obj and design/rigs/work/<Fish>_color.png + <Fish>.json (tools/blender/studio/
# export_fish.luau, then rgba-to-png.js). Settings: design/rigs/<Fish>.json if present (rig_fish.py DEFAULTS
# overrides, plus "speed" for the preview). Writes into design/rigs/work/: <Fish>.blend, <Fish>.glb and the preview
# frames <Fish>_frames/ (tools/blender/frames-to-gif.js turns a batch into one GIF for the owner).
import json
import os

import bpy


def _load(repo, name):
    ns = {}
    path = os.path.join(repo, "tools", "blender", name)
    exec(compile(open(path).read(), path, "exec"), ns)
    return ns


def _window_override():
    window = bpy.context.window_manager.windows[0]
    area = next((a for a in window.screen.areas if a.type == "VIEW_3D"), None)
    if area is None:
        return bpy.context.temp_override(window=window)
    region = next(r for r in area.regions if r.type == "WINDOW")
    return bpy.context.temp_override(window=window, area=area, region=region)


def _preview_material(obj, texture_path, tint):
    """The game's look for the preview: the colour texture multiplied by the SurfaceAppearance tint."""
    mat = bpy.data.materials.new(obj.name + "_preview")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.5
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(texture_path, check_existing=True)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[7].default_value = (tint[0] / 255, tint[1] / 255, tint[2] / 255, 1.0)
    nt.links.new(tex.outputs["Color"], mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def convert(repo, fish, render=True):
    work = os.path.join(repo, "design", "rigs", "work")
    rig = _load(repo, "rig_fish.py")
    preview = _load(repo, "preview_swim.py")
    export = _load(repo, "export_fish.py")
    settings_path = os.path.join(repo, "design", "rigs", fish + ".json")
    settings = json.load(open(settings_path)) if os.path.exists(settings_path) else {}
    speed = settings.pop("speed", 1.0)
    # A companion that isn't a fish has its own rig script ("rig": "jellyfish" -> rig_jellyfish.py, with
    # rig_<kind>(obj, settings) and add_preview_action(arm, speed))
    kind = settings.pop("rig", "fish")
    special = _load(repo, "rig_%s.py" % kind) if kind != "fish" else None
    side_path = os.path.join(work, fish + ".json")
    tint = json.load(open(side_path)).get("tint", [255, 255, 255]) if os.path.exists(side_path) else [255, 255, 255]

    bpy.ops.wm.read_homefile(use_empty=True)
    with _window_override():
        obj = rig["import_fish"](os.path.join(repo, "design", "meshes", fish + ".obj"), fish)
        _preview_material(obj, os.path.join(work, fish + "_color.png"), tint)
        summary = special["rig_" + kind](obj, settings) if special else rig["rig_fish"](obj, settings)
        arm = bpy.data.objects[summary["armature"]]
        weights = [sum(1 for g in v.groups if g.weight > 0) for v in obj.data.vertices]
        summary["max_influences"] = max(weights)
        summary["unweighted"] = sum(1 for w in weights if w == 0)
        if special and kind == "boxes":
            special["add_preview_action"](arm, speed, settings.get("preview", []))
        elif special:
            special["add_preview_action"](arm, speed)
        else:
            preview["add_swim_action"](arm, speed)
        if render:
            preview["render_preview"](obj, arm, os.path.join(work, fish + "_frames"), view="three_quarter",
                                      size=(480, 300))
        summary["export"] = export["export_fish"](obj, arm, os.path.join(work, fish + ".glb"))
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(work, fish + ".blend"))
    summary.pop("vertices_per_bone", None)
    summary["tint"] = tint
    return summary
