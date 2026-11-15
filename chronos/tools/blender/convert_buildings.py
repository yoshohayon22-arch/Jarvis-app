"""
Converts Daniel Andersson's CC0 medieval village models (OpenGameArt) from .blend to GLB.

    python convert_buildings.py <out dir> name=path/to/file.blend [name=...]

The files date from Blender 2.6: their materials carry no texture nodes any more, so each
material gets the packed image whose name matches it best. All meshes are joined, and the
model is re-centred on its footprint with its base on the ground.
"""
import sys, os, re, difflib
import bpy
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else sys.argv[1]
JOBS = [a.split("=", 1) for a in sys.argv if "=" in a and a.endswith(".blend")]


def norm(s):
    s = re.sub(r"\.(jpg|png|tga|bmp)(\.\d+)?$|\.\d+$", "", s.lower())
    s = re.sub(r"[^a-z0-9]", "", s)
    return s.replace("treelog", "log").replace("large", "").replace("bricks", "brick").replace("windows", "window")


def pick_image(mat_name, images):
    key = norm(mat_name)
    best, score = None, 0.0
    for img in images:
        k = norm(img.name)
        s = 1.0 if k == key else difflib.SequenceMatcher(None, key, k).ratio()
        if s > score:
            best, score = img, s
    return best if score >= 0.55 else None


def convert(name, path):
    bpy.ops.wm.open_mainfile(filepath=path)
    for c in bpy.data.collections:
        c.hide_viewport = False
    for lc in bpy.context.view_layer.layer_collection.children:
        lc.exclude = False
    images = [i for i in bpy.data.images if i.size[0] > 0 and i.name != "Render Result"]
    missing = []
    for mat in bpy.data.materials:
        img = pick_image(mat.name, images)
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
        bsdf.inputs["Roughness"].default_value = 0.9
        bsdf.inputs["Metallic"].default_value = 0.0
        if img:
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = img
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        else:
            missing.append(mat.name)
            bsdf.inputs["Base Color"].default_value = (0.35, 0.32, 0.29, 1)
    # Ground planes shipped with some scenes are not part of the building.
    def is_ground(o):
        d = o.dimensions
        return d.z < 0.06 and d.x > 6 and d.y > 6
    meshes = [o for o in bpy.context.view_layer.objects if o.type == "MESH" and len(o.data.polygons) > 0 and not is_ground(o)]
    for o in list(bpy.data.objects):
        if o not in meshes:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.hide_set(False)
        o.select_set(True)
        if o.data.users > 1:
            o.data = o.data.copy()
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    for o in meshes:
        for m in list(o.modifiers):
            try:
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.modifier_apply(modifier=m.name)
            except Exception:
                o.modifiers.remove(m)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    xs = [v.co for v in obj.data.vertices]
    lo = Vector((min(v.x for v in xs), min(v.y for v in xs), min(v.z for v in xs)))
    hi = Vector((max(v.x for v in xs), max(v.y for v in xs), max(v.z for v in xs)))
    shift = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    for v in obj.data.vertices:
        v.co -= shift
    obj.data.update()
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{name}.glb"), export_format="GLB", use_selection=True, export_animations=False, export_yup=True, export_apply=True, export_image_format="AUTO")
    print(f"OK {name} size=({hi.x - lo.x:.1f}, {hi.y - lo.y:.1f}, {hi.z - lo.z:.1f}) tris={sum(len(p.vertices) - 2 for p in obj.data.polygons)} untextured={missing}")


os.makedirs(OUT, exist_ok=True)
for name, path in JOBS:
    try:
        convert(name, path)
    except Exception as e:
        print(f"FAIL {name}: {e}")
