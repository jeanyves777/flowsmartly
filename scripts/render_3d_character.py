#!/usr/bin/env python3
"""
Blender Render Script — Render a 3D GLB/glTF model as a PNG image.

Called via:
    blender -b -P scripts/render_3d_character.py -- --input model.glb --output char_dir/ [--animation idle] [--frames 1]

Uses EEVEE for proper material/texture rendering with transparent background.
Falls back to Workbench if EEVEE headless fails.
Outputs texture.png (full render) and thumbnail.png (256x256 preview).
"""

import sys
import os
import math

import bpy
import mathutils


def parse_args():
    """Parse arguments after '--' separator."""
    argv = sys.argv
    if "--" not in argv:
        print("Error: Pass arguments after '--'")
        sys.exit(1)

    args = argv[argv.index("--") + 1:]
    parsed = {}
    i = 0
    while i < len(args):
        key = args[i]
        if key.startswith("--") and i + 1 < len(args):
            name = key[2:]
            val = args[i + 1]
            if name in ("frames", "width", "height"):
                parsed[name] = int(val)
            else:
                parsed[name] = val
            i += 2
        else:
            i += 1
    return parsed


def clear_scene():
    """Remove all default objects from the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def import_model(filepath):
    """Import a 3D model (GLB/glTF/FBX/OBJ)."""
    ext = os.path.splitext(filepath)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=filepath)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=filepath)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=filepath)
    else:
        raise ValueError(f"Unsupported format: {ext}")


def get_model_bounds():
    """Get tight bounding box of all mesh objects in world space."""
    min_co = mathutils.Vector((float('inf'),) * 3)
    max_co = mathutils.Vector((float('-inf'),) * 3)
    found = False

    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            found = True
            # Use depsgraph for accurate bounds with modifiers
            depsgraph = bpy.context.evaluated_depsgraph_get()
            obj_eval = obj.evaluated_get(depsgraph)
            mesh = obj_eval.to_mesh()
            for v in mesh.vertices:
                world_co = obj.matrix_world @ v.co
                for i in range(3):
                    min_co[i] = min(min_co[i], world_co[i])
                    max_co[i] = max(max_co[i], world_co[i])
            obj_eval.to_mesh_clear()

    if not found:
        # Fallback: use object origins
        for obj in bpy.context.scene.objects:
            if obj.type in ('MESH', 'ARMATURE', 'EMPTY'):
                for i in range(3):
                    min_co[i] = min(min_co[i], obj.location[i] - 1)
                    max_co[i] = max(max_co[i], obj.location[i] + 1)

    return min_co, max_co


def setup_camera(min_co, max_co):
    """Position camera to frame the model from the front, slightly above."""
    center = (min_co + max_co) / 2
    size = max_co - min_co
    max_dim = max(size.x, size.y, size.z)

    cam_data = bpy.data.cameras.new("RenderCam")
    cam_data.type = 'PERSP'
    cam_data.lens = 85  # Longer focal length = less distortion, more flattering

    cam_obj = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    # Position: front of model (negative Y in Blender = front view)
    # Slightly above center for a more flattering angle
    distance = max_dim * 2.5
    cam_obj.location = (
        center.x,                        # Centered horizontally
        center.y - distance,             # In front (Blender Y- = front)
        center.z + size.z * 0.05,        # Slightly above center
    )

    # Look at the model center (slightly above geometric center for characters)
    look_target = mathutils.Vector((center.x, center.y, center.z + size.z * 0.05))
    direction = look_target - cam_obj.location
    rot = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot.to_euler()

    return cam_obj


def setup_lighting():
    """Studio-style 3-point lighting for clean character rendering."""
    # Key light — strong, warm, from front-right-above
    key = bpy.data.lights.new("KeyLight", type='SUN')
    key.energy = 4.0
    key.color = (1.0, 0.97, 0.92)
    key_obj = bpy.data.objects.new("KeyLight", key)
    key_obj.rotation_euler = (math.radians(55), math.radians(0), math.radians(-35))
    bpy.context.scene.collection.objects.link(key_obj)

    # Fill light — softer, cooler, from front-left
    fill = bpy.data.lights.new("FillLight", type='SUN')
    fill.energy = 2.0
    fill.color = (0.9, 0.93, 1.0)
    fill_obj = bpy.data.objects.new("FillLight", fill)
    fill_obj.rotation_euler = (math.radians(45), math.radians(0), math.radians(35))
    bpy.context.scene.collection.objects.link(fill_obj)

    # Rim/back light — subtle edge light
    rim = bpy.data.lights.new("RimLight", type='SUN')
    rim.energy = 1.5
    rim.color = (1.0, 1.0, 1.0)
    rim_obj = bpy.data.objects.new("RimLight", rim)
    rim_obj.rotation_euler = (math.radians(30), math.radians(0), math.radians(160))
    bpy.context.scene.collection.objects.link(rim_obj)


def setup_render_eevee(width, height):
    """Configure EEVEE render settings (proper materials + textures)."""
    scene = bpy.context.scene

    # EEVEE — try different engine names across Blender versions
    for engine_name in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            scene.render.engine = engine_name
            break
        except TypeError:
            continue

    # EEVEE settings
    scene.eevee.taa_render_samples = 32  # Good quality, fast

    # Resolution
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100

    # Transparent background
    scene.render.film_transparent = True

    # Output
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 15

    print(f"  Render engine: EEVEE ({width}x{height})")


def setup_render_workbench(width, height):
    """Fallback: Workbench with TEXTURE color type for GLB materials."""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'

    shading = scene.display.shading
    shading.light = 'STUDIO'
    shading.color_type = 'TEXTURE'  # Shows actual textures from materials
    shading.show_shadows = True
    shading.show_cavity = True
    shading.cavity_type = 'BOTH'
    shading.show_object_outline = True
    shading.object_outline_color = (0.1, 0.1, 0.1)

    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.compression = 15

    print(f"  Render engine: Workbench ({width}x{height})")


def select_animation(animation_name=None):
    """Find and activate an animation clip."""
    # Collect all armatures
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']
    actions = list(bpy.data.actions)

    if not actions:
        return None

    print(f"  Available animations ({len(actions)}):")
    for a in actions[:15]:
        print(f"    - {a.name} (frames {int(a.frame_range[0])}-{int(a.frame_range[1])})")

    target_action = None

    if animation_name:
        # Find matching animation by name
        for action in actions:
            if animation_name.lower() in action.name.lower():
                target_action = action
                break

    if not target_action:
        # Default: prefer "idle" or "survey" or "stand", else first action
        for pref in ["idle", "survey", "stand", "t-pose", "tpose"]:
            for action in actions:
                if pref in action.name.lower():
                    target_action = action
                    break
            if target_action:
                break

    if not target_action and actions:
        target_action = actions[0]

    # Apply to armature
    if target_action and armatures:
        arm = armatures[0]
        if not arm.animation_data:
            arm.animation_data_create()
        arm.animation_data.action = target_action
        print(f"  Using animation: {target_action.name}")

    return target_action


def render_frame(output_path, frame=1):
    """Render a single frame."""
    scene = bpy.context.scene
    scene.frame_set(frame)
    scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)
    print(f"  Rendered frame {frame} -> {output_path}")


def create_thumbnail(texture_path, output_path, size=256):
    """Create a square thumbnail from the rendered texture."""
    img = bpy.data.images.load(texture_path)
    w, h = img.size

    scale = min(size / w, size / h)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))

    img.scale(new_w, new_h)
    img.filepath_raw = output_path
    img.file_format = 'PNG'
    img.save()
    print(f"  Thumbnail: {new_w}x{new_h}")


def main():
    args = parse_args()

    input_path = args.get("input")
    output_dir = args.get("output")
    animation_name = args.get("animation")
    num_frames = args.get("frames", 1)
    width = args.get("width", 600)
    height = args.get("height", 800)

    if not input_path or not output_dir:
        print("Usage: blender -b -P render_3d_character.py -- --input model.glb --output output_dir/")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    print(f"Loading model: {input_path}")
    clear_scene()
    import_model(os.path.abspath(input_path))

    # Setup scene
    min_co, max_co = get_model_bounds()
    print(f"  Bounds: min={min_co}, max={max_co}")
    print(f"  Size: {max_co - min_co}")

    setup_camera(min_co, max_co)
    setup_lighting()

    # Try EEVEE first, fall back to Workbench
    try:
        setup_render_eevee(width, height)
    except Exception as e:
        print(f"  EEVEE setup failed ({e}), falling back to Workbench")
        setup_render_workbench(width, height)

    # Select animation pose
    action = select_animation(animation_name)

    # Pick a good frame (middle of animation for a natural pose)
    render_at = 1
    if action:
        start = int(action.frame_range[0])
        end = int(action.frame_range[1])
        render_at = (start + end) // 2  # Middle frame = natural pose

    if num_frames == 1:
        texture_path = os.path.join(output_dir, "texture.png")
        render_frame(texture_path, frame=render_at)

        thumbnail_path = os.path.join(output_dir, "thumbnail.png")
        create_thumbnail(texture_path, thumbnail_path)
    else:
        # Multi-frame animation render
        scene = bpy.context.scene
        if action:
            start = int(action.frame_range[0])
            end = int(action.frame_range[1])
            total = end - start + 1
            step = max(1, total // num_frames)
        else:
            start, step = 1, 1

        for i in range(num_frames):
            frame = start + i * step
            filepath = os.path.join(output_dir, f"frame_{i:04d}.png")
            scene.frame_set(frame)
            scene.render.filepath = filepath
            bpy.ops.render.render(write_still=True)
        print(f"  Rendered {num_frames} frames")

    print("Done!")


if __name__ == "__main__":
    main()
