# FlapAtlas 3D — Real Anatomical 3D Model Setup Guide (`MODEL_SETUP.md`)

FlapAtlas 3D is architected to load real, open-source **CC BY-SA** 3D human anatomy models split by anatomical system (`skin`, `skeleton`, `muscles`, `arteries`, `veins`, `nerves`, `organs`, `other`), compressed with **Draco** or **Meshopt**, progressively streamed, cached in **IndexedDB** for offline clinical use, and **auto-normalized from their shared bounding box to 175 cm (1.75 m)** standing height so all cm measurements and flap skin-paddle sizes stay accurate.

If no GLB files are present yet (or if a network error occurs), FlapAtlas 3D automatically falls back to its built-in 175 cm procedural human body.

---

## (a) Where to Download Open-Source Anatomical Models (CC BY-SA)

1. **Z-Anatomy** *(Recommended — clean Blender collections & Terminologia Anatomica mesh names)*
   - Website: https://www.z-anatomy.com/
   - GitHub / Downloads: https://github.com/LluisV/Z-Anatomy (or official Blender `.blend` release package)
   - License: **CC BY-SA 4.0** (derived from BodyParts3D, © Database Center for Life Science, **CC BY-SA 2.1 Japan**).
2. **BodyParts3D / Anatomography**
   - Website: https://lifesciencedb.jp/bp3d/
   - License: **CC BY-SA 2.1 Japan**.
3. **Open 3D Anatomical Model for Education (NAV, Netherlands)**
   - Website: https://www.anatomie.nl/
   - License: **CC BY-SA 4.0**.

> **Share-Alike License Notice:** Because these anatomical meshes are licensed under CC BY-SA, any modified/decimated/converted GLB geometry you redistribute must preserve attribution to BodyParts3D (DBCLS) and Z-Anatomy and be shared under the same CC BY-SA license.

---

## (b) Converting `.blend` / `.fbx` to `.glb` in Blender

1. Open **Blender 4.x** (free at https://www.blender.org/) and load the Z-Anatomy `.blend` file (or `File → Import → FBX (.fbx)`).
2. **Preserve Terminologia Anatomica mesh names** (e.g. `Vastus lateralis muscle.r`, `Peroneal artery.l`, `Deep inferior epigastric artery.r`). Do **not** join all meshes into one unnamed object — FlapAtlas maps each mesh by its Terminologia Anatomica name!
3. Keep all systems in the **same world origin and scale** inside Blender before exporting. You do **not** need to rescale the model manually — FlapAtlas computes a single shared bounding-box normalization transform from `skin.glb` / `skeleton.glb` so the body stands exactly **175 cm tall** with feet at `y = 0` and applies that identical transform to every other system so internal organs and vessels align to the millimeter.
4. When exporting via `File → Export → glTF 2.0 (.glb/.gltf)`:
   - Format: **glTF Binary (.glb)**
   - Transform: check **+Y Up** (default in Blender)
   - Include: check **Selected Objects** (when exporting one system at a time)
   - Geometry: check **Apply Modifiers** and **Normals** (uncheck UVs/Tangents if unused to save bytes)

---

## (c) Splitting into One `.glb` File per System

FlapAtlas expects these 8 system filenames (all optional — any subset works, e.g., `skeleton.glb` + `muscles.glb` + `arteries.glb`):

| File Name | Anatomical System | Progressive Load Stage |
|---|---|---|
| `skin.glb` | Skin / outer body envelope *(175 cm scale reference)* | Stage 1 (loads first) |
| `skeleton.glb` | Bones & cartilages *(175 cm scale reference)* | Stage 1 (loads first) |
| `muscles.glb` | Skeletal muscles & tendons | Stage 2 |
| `arteries.glb` | Arterial tree | Stage 3 |
| `veins.glb` | Venous tree | Stage 3 |
| `nerves.glb` | Peripheral & cranial nerves | Stage 3 |
| `organs.glb` | Visceral organs | Stage 3 |
| `other.glb` | Fascia, ligaments, lymphatics, other structures | Stage 3 |

### Optional Blender Python Batch-Export Script
Paste into Blender's **Scripting** workspace and adjust `COLLECTION_MAP` to match your `.blend` collection names:

```python
import bpy, os

OUT_DIR = "/path/to/raw_glbs"
os.makedirs(OUT_DIR, exist_ok=True)

COLLECTION_MAP = {
    "skin.glb": ["Skin", "Integumentary"],
    "skeleton.glb": ["Skeletal system", "Skeleton", "Bones"],
    "muscles.glb": ["Muscular system", "Muscles"],
    "arteries.glb": ["Arteries", "Arterial system"],
    "veins.glb": ["Veins", "Venous system"],
    "nerves.glb": ["Nervous system", "Nerves"],
    "organs.glb": ["Visceral", "Organs", "Digestive", "Respiratory", "Cardiovascular_Heart"],
    "other.glb": ["Fascia", "Ligaments", "Joints", "Other"],
}

def collect_meshes(col):
    objs = [o for o in col.objects if o.type == 'MESH']
    for child in col.children:
        objs.extend(collect_meshes(child))
    return objs

for filename, keywords in COLLECTION_MAP.items():
    bpy.ops.object.select_all(action='DESELECT')
    matched = []
    for col in bpy.data.collections:
        if any(k.lower() in col.name.lower() for k in keywords):
            matched.extend(collect_meshes(col))
    if not matched:
        continue
    for obj in matched:
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, filename),
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_materials='NONE',
    )
    print(f"Exported {filename} ({len(matched)} meshes)")
```

---

## (d) Decimating & Compressing with `gltf-transform` (Draco / Meshopt)

Raw Z-Anatomy exports can exceed 150 MB. Decimate and compress them to ~15–28 MB total for 60 fps tablet performance:

```bash
npm install -g @gltf-transform/cli

mkdir -p public/models

# Example batch compression loop (Draco geometry compression + 50% mesh simplification)
for f in skin skeleton muscles arteries veins nerves organs other; do
  if [ -f "raw_glbs/${f}.glb" ]; then
    gltf-transform simplify "raw_glbs/${f}.glb" "raw_glbs/${f}_simp.glb" --ratio 0.5 --error 0.001
    gltf-transform draco "raw_glbs/${f}_simp.glb" "public/models/${f}.glb" --method edgebreaker
  fi
done
```

> Both **Draco** (via offline decoders bundled in `/public/draco/`) and **Meshopt** (`gltf-transform meshopt`) are supported natively by FlapAtlas 3D.

---

## (e) Placing Files Locally OR Hosting Remotely (CORS)

### Option 1 — Local Hosting (Recommended for Local Dev / Self-Hosted Builds)
Place the converted `.glb` files directly in:
```text
/public/models/
  skin.glb
  skeleton.glb
  muscles.glb
  arteries.glb
  veins.glb
  nerves.glb
  organs.glb
  other.glb
```
Reload FlapAtlas 3D — the app automatically detects every present `.glb` file via `/api/models/status`, streams them progressively, and caches them in IndexedDB for offline use.

### Option 2 — In-App Multi-File Uploader (Zero Server Setup)
Open **Settings & Data → Multi-System GLB Loader** and click **Select System .GLB Files** to choose all 1–8 `.glb` files directly from your computer. They are auto-classified by filename, stored locally in IndexedDB, and persist offline across page reloads.

### Option 3 — Remote Hosting (Cloudflare R2, AWS S3, GitHub Releases/Pages)
Upload the 8 `.glb` files to a public HTTPS bucket with CORS enabled:
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"]
  }
]
```
Then paste the bucket base URL (e.g., `https://cdn.example.com/flapatlas-models`) into **Settings & Data → Remote CORS Host** and click **Load**.

---

## (f) Updating `/src/models/modelManifest.ts`

If you host custom filenames, sex-specific packs (`female` / `male`), or an additional CC-licensed dataset (such as the NAV Open 3D Anatomical Model), edit `DEFAULT_MODEL_MANIFEST` inside `/src/models/modelManifest.ts` to update `url`, `system`, `sex`, `license`, `attribution`, and `sizeMB`.

---

## (g) Running the Unmapped Meshes Report

1. Open **Settings & Data → Multi-System GLB Loader** and enable **Clinical Editor Mode**.
2. Once your real GLB files are loaded, the **Terminologia Anatomica Unmapped Meshes Report** displays:
   - Total meshes discovered across all loaded systems
   - Auto-mapped coverage % (matching both English and Latin TA names plus `.r`/`.l` laterality)
   - Every unmapped mesh with suggested targets
3. Select the matching FlapAtlas vessel, muscle, nerve, bone, or flap from the dropdown and click **Link**. Overrides are saved immediately to IndexedDB and can be exported via **Export Overrides** JSON.
