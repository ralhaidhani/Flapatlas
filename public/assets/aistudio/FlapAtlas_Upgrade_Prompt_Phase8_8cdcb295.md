# FlapAtlas 3D — Upgrade Prompt (Phase 8 & 9): Real Anatomical Models + Visual Redesign

Continue the existing FlapAtlas 3D web app. Do NOT rebuild from scratch; refactor the current code. Keep all existing features, data files, and the data-integrity rules unchanged.

## PART A — Replace the procedural body with real open-source anatomical models

### A1. Model loading architecture
1. Create `/public/models/` and a config file `/src/models/modelManifest.ts` listing every model file with: `id`, `url` (local path OR remote URL), `system` (skeleton | muscles | arteries | veins | nerves | fascia | skin | organs), `sex`, `license`, `attribution`, `sizeMB`.
2. Load models with `useGLTF` (drei) using **Draco/Meshopt-compressed GLB**, progressive loading by system (skin + skeleton first, then muscles, then vessels/nerves), with a loading progress bar and skeleton placeholder.
3. Support **remote model URLs** (CORS-enabled hosting) as well as local files, because the files may be large. Cache loaded models in IndexedDB so the app works offline after first load.
4. **Mesh naming contract:** each mesh name must follow the Terminologia Anatomica name from the source model (e.g., "Vastus lateralis muscle.r"). Build an automatic **name-to-anatomy_id mapper** (`/src/models/anatomyMap.ts`) that links mesh names to the existing records in `vessels.json`, `muscles.json`, `nerves.json`, and flaps. Show an **Unmapped Meshes report** in the Editor mode so the clinician can fix links.
5. Keep the current procedural body as an automatic **fallback** if models fail to load.

### A2. Model sources to support (open source, CC BY-SA)
- **Z-Anatomy** (CC BY-SA 4.0; derived from BodyParts3D, CC BY-SA 2.1 Japan): skeleton, muscles, arteries, veins, nerves, organs, labeled with Terminologia Anatomica. Distributed as .blend / FBX — the user will convert to GLB externally.
- **Open 3D Anatomical Model for Education** (NAV, Netherlands; CC BY-SA), a refined derivative of the above.
- Architecture must allow adding any other CC-licensed GLB later.

### A3. Layer system on real meshes
- Group meshes by system using the manifest; each system gets its own toggle, opacity slider, and color style.
- Individual structure selection with **isolate / hide / show-only-related** (e.g., select "Peroneal artery" → fade everything else, show its branches).
- **Section / clipping planes** (axial, sagittal, coronal) with draggable sliders.
- **Dissection slider** (skin → fascia → superficial muscles → deep muscles → bone).
- Structure search box inside the viewer (type "gracilis" → camera flies to it and highlights it).

### A4. Anchoring flap overlays to the real mesh
Real models contain gross vessels and nerves but NOT perforator-level or flap-specific detail. Therefore:
1. Create a **landmark anchor system**: define named 3D anchor points on the loaded model (ASIS, PSIS, pubic tubercle, umbilicus, patella (superolateral), fibular head, lateral malleolus, medial epicondyle, acromion, inferior angle of scapula, mastoid, etc.), stored in `/src/data/anchors.json`, editable in Editor mode via a **"Click on model to set anchor"** tool.
2. Position flap skin paddles, perforator markers, and pedicle curves **relative to anchors** (e.g., ALT perforators placed by the documented distance from the ASIS–patella line), not by absolute coordinates.
3. Where the real model contains the actual source vessel (e.g., femoral artery, profunda femoris, peroneal artery), **snap the pedicle path** to the real vessel mesh centerline; draw the perforator-level segment as a procedural tube labeled **"Schematic — not from source model."**
4. Every procedural element must show a small "Schematic" tag so users can distinguish real scan-derived geometry from illustrative geometry.
5. Add an **Anchor Calibration page** (Editor mode) that overlays all anchors and lets the clinician adjust and save positions.

### A5. Credits & licensing page (mandatory)
- Add an **"About / Credits"** page and footer link listing each model with: title, author, license (CC BY-SA 4.0 / 2.1 JP), source link, and a statement that the app's anatomical geometry is derived from these works and that **derived model data is shared under the same license**. Include BodyParts3D (Database Center for Life Science) and Z-Anatomy attribution text exactly as required by their license.

### A6. Performance
- Target 60 fps on a mid-range tablet: LOD, frustum culling, instancing for repeated markers, merge static meshes per system, lazy-load unselected systems, texture-less flat-shaded materials with normal maps, adaptive pixel ratio.
- Add a **Quality setting** (Low / Medium / High) and automatic detection of weak devices.

## PART B — Visual redesign (professional medical-atlas look)

### B1. 3D rendering quality
- PBR materials with tissue-appropriate look: skin (subtle subsurface-style shading), muscle (deep red with fiber-like normal map), tendon/fascia (pearl white, slight sheen), bone (ivory), arteries (saturated red), veins (deep blue), nerves (yellow), perforators (glowing markers).
- Studio lighting: soft three-point lighting + HDRI environment, soft shadows, ambient occlusion (SSAO), subtle bloom only on highlights/perforators.
- **Hover/selection outlines** (postprocessing outline pass), pulsing highlight for the selected flap, ghosting (transparent) for non-selected structures.
- **Label system:** leader-line labels that avoid overlap, scale with zoom, and can be toggled by category; label font legible on tablets.
- Smooth camera transitions with easing between preset views; inertia on rotate; double-click to focus.
- Background options: neutral gradient, dark, OR-dim.

### B2. UI redesign
- Cohesive design system: deep slate + teal accent, clear typography (Inter for UI, JetBrains Mono for numeric data), consistent 8-px spacing, rounded cards, soft shadows, subtle motion.
- **Dark / Light / OR-dim** themes with proper contrast.
- Viewport-first layout: collapsible left navigation, floating compact toolbar over the 3D view (layers, views, measure, section, reset), right detail drawer that slides in, bottom sheet on phones.
- Flap detail pages redesigned as clean sectioned cards with **icon badges** for flap type, Mathes–Nahai type, sensate, bone-containing, verification status.
- **Vascular diagram mini-schematics** per flap (2D SVG of pedicle tree with diameters and lengths) shown next to the 3D view.
- Data tables with sticky headers; comparison view with highlighted differences.
- Micro-interactions, skeleton loaders, empty states, tooltips, and an onboarding tour that points to the new tools.
- Fully responsive and touch-friendly; large tap targets (≥44 px).

### B3. Branding
- App logo and wordmark "FlapAtlas 3D", favicon, splash screen, and PWA icons.

## PART C — Deliverables and process
1. Work in sub-phases: **8a** model loader + manifest + fallback; **8b** layer system & section tools; **8c** anchors + flap overlay on real meshes; **8d** credits/licensing page; **9a** rendering quality; **9b** UI redesign; **9c** performance & QA.
2. At the end of each sub-phase, run the app, fix errors, and summarize: what was added, known limitations, and what the user must do manually (e.g., where to place converted GLB files).
3. Provide a short **`MODEL_SETUP.md`** inside the project explaining, step by step: (a) where to download the source models, (b) converting FBX/.blend to GLB in Blender, (c) splitting by system, (d) decimating and compressing with gltf-transform (Draco/Meshopt), (e) naming and placing files in `/public/models/` or hosting remotely, (f) updating `modelManifest.ts`, (g) running the Unmapped Meshes report.
4. Do not invent any anatomical measurements while redesigning; keep the "Needs review / Verified" workflow intact.

Begin with sub-phase 8a now.
