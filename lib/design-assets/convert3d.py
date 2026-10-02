# Convierte un GLB a otro formato con Blender (lo usa MCP Hub → Diseño → Exportar).
# Uso: blender -b --factory-startup --python convert3d.py -- origen.glb destino.ext formato
import sys
import bpy

src, dst, fmt = sys.argv[sys.argv.index('--') + 1:][:3]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

if fmt == 'fbx':
    bpy.ops.export_scene.fbx(filepath=dst, path_mode='COPY', embed_textures=True, apply_unit_scale=True, bake_space_transform=True)
elif fmt == 'blend':
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=dst, compress=True)
elif fmt == 'usd':
    bpy.ops.wm.usd_export(filepath=dst)
elif fmt == 'abc':
    bpy.ops.wm.alembic_export(filepath=dst)
elif fmt == 'obj':
    bpy.ops.wm.obj_export(filepath=dst, path_mode='COPY')
else:
    raise SystemExit(f'Formato no soportado: {fmt}')
