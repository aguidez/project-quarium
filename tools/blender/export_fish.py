# Export of a fish rigged by rig_fish.py to a GLB for Roblox (ROADMAP_V1.1 A2): the skinned mesh and its bones only
# (no material, texture, camera, light or animation: the game keeps the template's SurfaceAppearance, so nothing but
# the model is uploaded). Works on temporary copies; the scene is left as it was.
#
# Axes: Blender's glTF exporter writes Blender (x, y, z) as glTF (x, z, -y), and Roblox's glTF import turns a mesh 180°
# around its vertical axis (tools/group-mesh-upload.js, checked in V0.60.5). The copies are turned 180° around Blender's
# Z first, so the nose (+Y in Blender) lands at Roblox's mesh-local -Z, like every fish template.
#
# Use from the Blender MCP:  exec(open("<repo>/tools/blender/export_fish.py").read(), ns); ns["export_fish"](obj, arm, path)
import math

import bpy


def export_fish(obj, arm, path):
    scene = bpy.context.scene
    keep_frame = scene.frame_current
    keep_action = arm.animation_data.action if arm.animation_data else None
    if arm.animation_data:
        arm.animation_data.action = None
    for pb in arm.pose.bones:  # rest pose
        pb.matrix_basis.identity()

    arm_copy = arm.copy()
    arm_copy.data = arm.data.copy()
    obj_copy = obj.copy()
    obj_copy.data = obj.data.copy()
    obj_copy.data.materials.clear()
    for o in (arm_copy, obj_copy):
        scene.collection.objects.link(o)
    obj_copy.parent = arm_copy
    obj_copy.modifiers["Armature"].object = arm_copy
    name = obj.name
    # the exported objects keep the fish's own names (the MeshPart's name in Roblox): the originals step aside
    obj.name, arm.name = name + "_source", name + "Rig_source"
    arm_copy.name, obj_copy.name = name + "Rig", name

    try:
        bpy.ops.object.select_all(action="DESELECT")
        arm_copy.rotation_euler.z += math.pi
        arm_copy.select_set(True)
        bpy.context.view_layer.objects.active = arm_copy
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        bpy.ops.object.select_all(action="DESELECT")
        obj_copy.select_set(True)
        bpy.context.view_layer.objects.active = obj_copy
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        arm_copy.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format="GLB",
            use_selection=True,
            export_materials="NONE",
            export_animations=False,
            export_skins=True,
            export_yup=True,
            export_apply=False,
        )
        tris = sum(len(p.vertices) - 2 for p in obj_copy.data.polygons)
        return {"path": path, "triangles": tris, "bones": len(arm_copy.data.bones)}
    finally:
        mesh_data, arm_data = obj_copy.data, arm_copy.data
        bpy.data.objects.remove(obj_copy)
        bpy.data.objects.remove(arm_copy)
        bpy.data.meshes.remove(mesh_data)
        bpy.data.armatures.remove(arm_data)
        obj.name, arm.name = name, name + "Rig"
        if keep_action:
            arm.animation_data.action = keep_action
        scene.frame_set(keep_frame)
