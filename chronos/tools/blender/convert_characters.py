"""
Builds the game's character GLBs from the CC0 "Modular RPG Characters" pack by System G6
(https://opengameart.org/content/modular-rpg-characters).

Run with Blender's Python module (pip install bpy):
    python convert_characters.py <pack dir with human_male.blend, human_female.blend, textures/> <out dir>

For every look listed below, the chosen body parts are joined into one mesh, their
textures are packed into one atlas (the crowd renderer draws one texture per look),
and the clips the game uses are exported under the names it expects.
"""
import sys, os
import bpy
import numpy as np

SRC, OUT = sys.argv[-2], sys.argv[-1]
CELL = 512
COLS, ROWS = 4, 2

# look id -> (sex, parts). "{s}" is replaced by human_male / human_female.
LOOKS = {
    "villager_a":    ("male",   ["head_default", "hair_1", "light_armor_2", "light_boots_2", "light_gloves_3"]),
    "villager_b":    ("male",   ["head_3", "hair_3", "light_armor_3", "light_boots_2", "light_gloves_3"]),
    "villager_d":    ("male",   ["head_2", "hair_2", "light_armor_2", "light_boots", "hands_default"]),
    "barbarian_hat": ("male",   ["head_6", "hair_6", "light_armor_4", "light_boots_2", "light_gloves_3"]),
    "villager_c":    ("female", ["head_default", "hair_2", "light_armor_3", "light_boots_2", "light_gloves_3"]),
    "villager_e":    ("female", ["head_2", "hair_1", "light_armor_2", "light_boots_2", "light_gloves_3"]),
    "villager_f":    ("female", ["head_3", "hair_3", "light_armor_4", "light_boots_2", "light_gloves_3"]),
    "guard":         ("male",   ["head_4", "heavy_helmet", "heavy_armor", "heavy_boots", "heavy_gloves"]),
    "guard_captain": ("male",   ["head_4", "hair_4", "heavy_armor", "heavy_boots", "heavy_gloves"]),
    "mage":          ("female", ["head_2", "light_helmet", "light_armor", "light_boots", "light_gloves"]),
    "mage_m":        ("male",   ["head_5", "light_helmet", "light_armor", "light_boots", "light_gloves"]),
    "thief":         ("male",   ["head_2", "medium_helmet", "medium_armor", "medium_boots", "medium_gloves"]),
    "thief_f":       ("female", ["head_3", "medium_helmet", "medium_armor", "medium_boots", "medium_gloves"]),
    "kael":          ("male",   ["head_5", "hair_5", "medium_armor", "medium_boots", "medium_gloves"]),
}

# game clip name -> (source action suffix, time stretch, amplitude toward the idle pose)
CLIPS = {
    "Idle": ("idle", 2.2, 1.0),
    "Running_A": ("run", 1.0, 1.0),
    "Walking_A": ("run", 1.9, 0.5),      # no walk in the pack: a slower, smaller run
    "Interact": ("gathering", 1.8, 0.4),   # hands busy, back mostly straight
    "Sit_Floor_Idle": ("pray", 1.0, 1.0),
    "Cheer": ("power_up", 2.2, 1.0),
    "Attack": ("cast_main_hand_melee", 1.5, 1.0),
    "Cast": ("cast_unarmed_magic", 1.8, 1.0),
    "Dodge_Forward": ("jump", 1.0, 1.0),
    "Death": ("death", 1.4, 1.0),
}


def fcurves_of(action):
    if hasattr(action, "fcurves") and len(getattr(action, "fcurves", [])):
        return list(action.fcurves)
    out = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def make_clip(src, name, stretch, amplitude, idle):
    act = src.copy()
    act.name = name
    rest = {(fc.data_path, fc.array_index): fc.evaluate(1) for fc in fcurves_of(idle)}
    for fc in fcurves_of(act):
        base = rest.get((fc.data_path, fc.array_index))
        for kp in fc.keyframe_points:
            for h in (kp.co, kp.handle_left, kp.handle_right):
                h[0] = 1 + (h[0] - 1) * stretch
                if amplitude != 1.0 and base is not None:
                    h[1] = base + (h[1] - base) * amplitude
        # A one-frame pose (pray) becomes a short held clip, so it has a duration.
        if len(fc.keyframe_points) == 1:
            k = fc.keyframe_points[0]
            fc.keyframe_points.insert(k.co[0] + 24, k.co[1])
        fc.update()
    return act


def image_for(material, sex_prefix, tex_dir):
    name = material.name.replace("mat_", "tex_", 1)
    base = (name, name.replace("_skirt", ""), name.replace("_1", ""), name + "_1")
    # Some male parts reuse the female texture (and the other way round).
    swapped = tuple(c.replace("_male_", "_female_") if "_male_" in c else c.replace("_female_", "_male_") for c in base)
    for cand in base + swapped:
        p = os.path.join(tex_dir, cand + ".png")
        if os.path.exists(p):
            return bpy.data.images.load(p, check_existing=True)
    raise RuntimeError(f"no texture for {material.name}")


def build(look, sex, parts):
    bpy.ops.wm.open_mainfile(filepath=os.path.join(SRC, f"human_{sex}.blend"))
    prefix = f"human_{sex}_"
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    for c in bpy.data.collections:
        c.hide_viewport = False
    for lc in bpy.context.view_layer.layer_collection.children:
        lc.exclude = False
        lc.hide_viewport = False
    wanted = []
    for p in parts:
        o = bpy.data.objects.get(prefix + p)
        if o is None:
            raise RuntimeError(f"{look}: missing part {prefix + p}")
        wanted.append(o)
    for o in list(bpy.data.objects):
        if o.type in ("MESH", "LIGHT", "CAMERA", "EMPTY") and o not in wanted:
            bpy.data.objects.remove(o, do_unlink=True)

    # One atlas cell per material; UVs are moved into their cell.
    atlas = np.zeros((ROWS * CELL, COLS * CELL, 4), dtype=np.float32)
    cell = 0
    for o in wanted:
        me = o.data
        uv = me.uv_layers.active.data
        cells = {}
        for slot, mat in enumerate(me.materials):
            img = image_for(mat, prefix, os.path.join(SRC, "textures"))
            img.scale(CELL, CELL)
            px = np.array(img.pixels[:], dtype=np.float32).reshape(CELL, CELL, 4)
            cx, cy = cell % COLS, cell // COLS
            if cy >= ROWS:
                raise RuntimeError(f"{look}: atlas full")
            atlas[cy * CELL:(cy + 1) * CELL, cx * CELL:(cx + 1) * CELL] = px
            cells[slot] = (cx, cy)
            cell += 1
        for poly in me.polygons:
            cx, cy = cells[poly.material_index]
            for li in poly.loop_indices:
                u, v = uv[li].uv
                # Half-texel inset keeps bilinear filtering inside the cell.
                u = min(max(u % 1.0 if not 0 <= u <= 1 else u, 0.002), 0.998)
                v = min(max(v % 1.0 if not 0 <= v <= 1 else v, 0.002), 0.998)
                uv[li].uv = ((cx + u) / COLS, (cy + v) / ROWS)

    img = bpy.data.images.new(f"{look}_atlas", COLS * CELL, ROWS * CELL, alpha=True)
    img.pixels[:] = atlas.ravel()
    img.filepath_raw = os.path.join(OUT, f"{look}_atlas.png")
    img.file_format = "PNG"
    img.save()

    mat = bpy.data.materials.new(f"{look}_mat")
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    try:
        mat.blend_method = "CLIP"
    except Exception:
        pass

    for o in wanted:
        o.data.materials.clear()
        o.data.materials.append(mat)
        o.parent = arm
        if not any(m.type == "ARMATURE" for m in o.modifiers):
            o.modifiers.new("Armature", "ARMATURE").object = arm
    bpy.ops.object.select_all(action="DESELECT")
    for o in wanted:
        o.select_set(True)
    bpy.context.view_layer.objects.active = wanted[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "Body"

    # Clips.
    idle = bpy.data.actions[prefix + "idle"]
    made = [make_clip(bpy.data.actions[prefix + src], name, stretch, amp, idle) for name, (src, stretch, amp) in CLIPS.items()]
    for a in list(bpy.data.actions):
        if a not in made:
            bpy.data.actions.remove(a)
    arm.animation_data_create()
    arm.animation_data.action = made[0]
    arm.name = "Rig"

    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    arm.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT, f"{look}.glb"),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_range=False,
        export_anim_slide_to_zero=True,
        export_optimize_animation_size=True,
        export_image_format="AUTO",
        export_yup=True,
        export_skins=True,
        export_morph=False,
        export_apply=False,
    )
    os.remove(os.path.join(OUT, f"{look}_atlas.png"))
    print("OK", look)


os.makedirs(OUT, exist_ok=True)
only = os.environ.get("ONLY")
for look, (sex, parts) in LOOKS.items():
    if only and look not in only.split(","):
        continue
    build(look, sex, parts)
