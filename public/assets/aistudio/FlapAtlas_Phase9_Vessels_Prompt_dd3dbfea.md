# FlapAtlas 3D — Phase 9: Real blood vessels (BodyParts3D) + skin

Continue the existing app. Do NOT rebuild it. Keep every feature, all flap data, the "Needs review / Verified" workflow and the data-integrity rules unchanged. Z-Anatomy skeleton/muscles/organs loading (Phase 8) stays as it is.

## 0. What changed
The Arteries and Veins slots of "Load Local Per-System GLBs" are empty today because the Z-Anatomy export contained almost no vessels. I now have three new files built from the official BodyParts3D release 4.0 (adult male, 99% polygon-reduced meshes). Load them through the SAME existing file picker ("Select System .GLB Files") and through the remote-URL path, cache them in IndexedDB like the other systems:

| File | Contents |
|---|---|
| arteries.glb | 635 named arteries (aorta and branches, limb, trunk, neck-base, visceral and intracranial arteries) |
| veins.glb | 404 named veins (caval, limb superficial/deep, portal and hepatic branches, pulmonary...) |
| skin.glb | 1 mesh named "skin [FJ2810]": the whole-body skin surface |

File facts (verified in the converter, do not guess otherwise):
- Units metres, Y-up, +Z anterior, +X = the subject's LEFT (same convention as the Z-Anatomy GLBs). Body height about 1.7 m. Do NOT rescale to 175 cm.
- Geometry only: no materials, no UVs, NO normals. After loading, compute smooth vertex normals (vertices are already welded) and apply our own PBR material per system (arteries saturated red, veins deep blue, skin pale and translucent).
- The files may be Draco-compressed (the Draco decoder is already configured for the other systems).
- Every node is named `"<name> [FJxxxx]"` and has `node.extras = { fj, fma, name, side, system }` where side is "left" | "right" | "midline". Read these from `userData` after loading. Display `extras.name` (never the raw node name); show the FJ code only in the detail card as "Source mesh: FJxxxx (BodyParts3D)".

## 1. Tasks (do in order, run and fix after each)

**9a — Load and render**
1. Add arteries, veins and skin to `modelManifest.ts` (ids `arteries`, `veins`, `skin`; license CC BY 4.0; attribution string in section 5). Let the file picker accept all three (and keep accepting the existing ones). Show them as normal layer rows (toggle + opacity), default ON for arteries/veins, skin ON at 25% opacity, double-sided, depthWrite false, with clipping-plane support like the other layers.
2. Merge static geometry per system for performance (WebGL draw calls must stay low) but keep a per-vertex mesh index so hover/click resolves to the individual vessel and its `extras`.
3. Click/hover a vessel: outline it, ghost the rest, open the detail card (name, side, system, "BodyParts3D reference mesh" tag).

**9b — Alignment calibrator (important, do not skip)**
BodyParts3D is the source of the Z-Anatomy meshes but I have NOT verified that the two share exactly the same origin and scale. Build a small "Alignment" panel (Editor mode):
1. Group = arteries + veins + skin. Controls: X/Y/Z offset in cm (±15 cm, 1 mm step, numeric inputs too), uniform scale 90–110%, Reset, Save (IndexedDB, restored on load). Default offsets 0 and scale 1.
2. Console + panel diagnostics: print the bounding box and height of skeleton, muscles, vessels and skin, and the difference of their centres. If the vessel group is within 1 cm of the skeleton centre, show "Aligned".
3. Add a "Calibration view" preset: show only skeleton + abdominal aorta + femoral arteries + internal thoracic arteries + skin at 15% opacity, front view. Show these hints beside it: the abdominal aorta must lie directly in front of the lumbar vertebral bodies; the femoral artery runs over the front of the femoral head toward the medial thigh; the internal thoracic artery runs just lateral to the sternal border behind the costal cartilages; the skin surface must enclose the muscles.

**9c — Declutter (the files contain many brain and organ-branch vessels)**
Add a "Vessel view" selector (data-driven, regex lists editable in `src/data/vesselPresets.json`):
- "Surgical (default)": hide vessels whose `extras.name` matches `cerebr|cerebell|choroid|sulcus|gyrus|callos|pontine|frontobasal|temporal|occipital|parietal|insular|communicating|basilar|spinal|segmental|lobar|lingular|conus|diagonal|coronary|cardiac|hepatovenous|portal|pancreatic|cecal|appendicular|colic|ileal|sigmoid|splenial|hepatic`.
- "Upper limb": `radial|ulnar|brachial|axillary|interosseous|palmar|carpal|metacarpal|digital|cephalic|basilic|median|collateral|humeral|princeps|radialis indicis`
- "Lower limb": `femoral|popliteal|tibial|plantar|dorsalis pedis|genicular|saphenous|fibular|tarsal|metatarsal|calcaneal|perforating|iliac`
- "Trunk wall and shoulder girdle": `epigastric|thoracic|intercostal|subcostal|lumbar|scapular|thoracodorsal|musculophrenic|phrenic|acromial|pectoral|cervical|subclavian|vertebral|carotid|jugular|brachiocephalic|thyrocervical|costocervical`
- "All vessels".
Plus a side filter (Left / Right / Both).

**9d — Flap to vessel linking**
Create `src/data/flapPedicleMap.json` with EXACTLY the JSON in section 4 (it was generated from the BodyParts3D tables; do not edit or extend it). When a flap is selected (match by flap name/synonym; add the mapping to the flap record's `real_vessel_map_key`, do not touch any other field):
1. Use the donor-side switch (Left/Right, default Right) to pick `left` or `right` FJ codes (use `midline` entries on both sides). Resolve meshes by `extras.fj`.
2. Highlight: role "pedicle" bright red (artery) with outline and a pulse; role "vein" bright blue; role "source" medium red. Dim everything else, fly the camera to the union bounding box, and list the resolved vessels in the detail panel with the tag "Real mesh — BodyParts3D reference model".
3. Hide our procedural pedicle tube only for roles that resolved to a real mesh. KEEP all perforator markers, skin paddles, design lines and any procedural segment, and keep their "Schematic — not from source model" tag. BodyParts3D contains NO perforators and no venae comitantes as separate meshes.
4. For flaps listed in `not_in_dataset`, show a notice "No reference mesh for: <vessels> — schematic only" and keep the procedural vessel.
5. Do NOT measure pedicle length, vessel diameter or flap size from these meshes and never write such numbers into flap records: this is one reference male body with 99% polygon reduction, not clinical data. All clinical numbers stay as they are, with their verification status.

**9e — Search**
Index every loaded vessel (`extras.name`, side, FJ, FMA) in the global search. Searching e.g. "inferior epigastric" lists the left/right meshes and flies the camera to them. The Anatomy Explorer shows "flaps that use this vessel" using the map in 9d.

**9f — Credits and honesty tags**
1. Replace the BodyParts3D line in the Credits page with exactly: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International" (note: the current BodyParts3D README states CC BY 4.0; the earlier "CC BY-SA 2.1 Japan" text is superseded — keep Z-Anatomy's own CC BY-SA 4.0 line for the skeleton/muscle/organ GLBs). Add: "Vessels and skin: BodyParts3D release 4.0; converted to glTF (metres, Y-up), vertices welded, no other edits."
2. Add a visible legend on the viewer: "Real mesh (reference body)" vs "Schematic". Add a note in the Anatomy Explorer: "Vessel geometry is a single reference adult male; anatomy varies. Verify with preoperative imaging."

**9g — Tests**
Add tests that (a) every FJ code in `flapPedicleMap.json` resolves to a loaded node when the files are present, and logs the unresolved ones, (b) the Left/Right switch picks the opposite sides, (c) skin and vessels get the same alignment transform, (d) the "Surgical" preset hides at least the cerebral arteries and keeps the femoral, radial, inferior epigastric and thoracodorsal arteries.

## 2. Known gaps in this dataset (shown in the UI, never invented)
No reference mesh exists for: facial, submental, superficial temporal, maxillary, lingual, external carotid and extracranial occipital arteries; supratrochlear and supraorbital arteries; superior and inferior gluteal arteries; internal pudendal and obturator arteries; medial circumflex femoral and deep femoral (profunda) arteries; peroneal (fibular) artery; sural arteries; superficial and deep circumflex iliac arteries; posterior interosseous artery; jejunal arteries; perforator vessels of any flap. Veins exist for several of these (e.g. gluteal, obturator, internal pudendal, deep femoral, fibular).

## 3. Rules
- No invented anatomy or measurements. If something is missing, show "Schematic" or "Not in dataset".
- If a file fails to load, keep the app working and show a small notice.
- Summarize after each sub-phase: what was added, known limitations, what I must do manually.

## 4. flapPedicleMap.json (copy exactly)
```json
{"flaps":{"ALT (anterolateral thigh)":[{"role":"source","name":"femoral artery","left":["FJ2074"],"right":["FJ2143"]},{"role":"pedicle","name":"descending branch of lateral circumflex femoral artery","left":["FJ2063"],"right":["FJ2057"]},{"role":"pedicle","name":"lateral circumflex femoral artery","left":["FJ2078"],"right":["FJ2158"]},{"role":"vein","name":"lateral circumflex femoral vein","left":["FJ2188"],"right":["FJ2201"]}],"DIEP / free TRAM":[{"role":"source","name":"external iliac artery","left":["FJ3466"],"right":["FJ3567"]},{"role":"pedicle","name":"inferior epigastric artery","left":["FJ3511"],"right":["FJ3604"]},{"role":"vein","name":"inferior epigastric vein","left":["FJ3512"],"right":["FJ3605"]}],"Pedicled TRAM / VRAM":[{"role":"source","name":"internal thoracic artery","left":["FJ1972"],"right":["FJ1937"]},{"role":"pedicle","name":"superior epigastric artery","left":["FJ1971"],"right":["FJ1936"]},{"role":"vein","name":"superior epigastric vein","left":["FJ3530"],"right":["FJ3615"]}],"SIEA":[{"role":"pedicle","name":"superficial epigastric artery","left":["FJ3529"],"right":["FJ3614"]},{"role":"vein","name":"superficial epigastric vein","left":["FJ2122"],"right":["FJ2178"]},{"role":"source","name":"femoral artery","left":["FJ2074"],"right":["FJ2143"]}],"Latissimus dorsi / TDAP":[{"role":"source","name":"subscapular artery","left":["FJ2246"],"right":["FJ2298"]},{"role":"pedicle","name":"thoracodorsal artery","left":["FJ2253"],"right":["FJ2305"]},{"role":"vein","name":"thoracodorsal vein","left":["FJ2254"],"right":["FJ2306"]}],"Scapular / parascapular":[{"role":"source","name":"subscapular artery","left":["FJ2246"],"right":["FJ2298"]},{"role":"pedicle","name":"circumflex scapular artery","left":["FJ2221"],"right":["FJ2273"]},{"role":"vein","name":"circumflex scapular vein","left":["FJ2222"],"right":["FJ2274"]}],"Pectoralis major":[{"role":"pedicle","name":"trunk of thoraco-acromial artery","left":["FJ2252"],"right":["FJ2304"]},{"role":"pedicle","name":"pectoral branch of thoraco-acromial artery","left":["FJ2330"],"right":["FJ2361"]},{"role":"pedicle","name":"lateral thoracic artery","left":["FJ1976"],"right":["FJ1938"]}],"Internal mammary perforator (IMAP)":[{"role":"pedicle","name":"internal thoracic artery","left":["FJ1972"],"right":["FJ1937"]},{"role":"vein","name":"internal thoracic vein","midline":["FJ1993"]}],"Radial forearm (RFFF)":[{"role":"source","name":"brachial artery","left":["FJ2219"],"right":["FJ2271"]},{"role":"pedicle","name":"radial artery","left":["FJ2242"],"right":["FJ2294"]},{"role":"vein","name":"radial vein","left":["FJ2244"],"right":["FJ2296"]}],"Ulnar artery flap":[{"role":"pedicle","name":"ulnar artery","left":["FJ2258"],"right":["FJ2310"]},{"role":"vein","name":"ulnar vein","left":["FJ2260"],"right":["FJ2312"]}],"Lateral arm":[{"role":"source","name":"deep brachial artery","left":["FJ2225"],"right":["FJ2277"]},{"role":"pedicle","name":"radial collateral branch of deep brachial artery","left":["FJ2261"],"right":["FJ2262"]},{"role":"pedicle","name":"middle collateral branch of deep brachial artery","left":["FJ2331"],"right":["FJ2362"]}],"Posterior tibial / soleus region":[{"role":"source","name":"popliteal artery","left":["FJ2086"],"right":["FJ2170"]},{"role":"pedicle","name":"posterior tibial artery","left":["FJ2087"],"right":["FJ2172"]},{"role":"vein","name":"posterior tibial vein","left":["FJ2118"],"right":["FJ2173"]}],"Dorsalis pedis flap":[{"role":"source","name":"anterior tibial artery","left":["FJ2065"],"right":["FJ2130"]},{"role":"pedicle","name":"dorsalis pedis artery","left":["FJ2073"],"right":["FJ2055"]}],"Medial plantar (instep)":[{"role":"source","name":"posterior tibial artery","left":["FJ2087"],"right":["FJ2172"]},{"role":"pedicle","name":"medial plantar artery","left":["FJ2082"],"right":["FJ2164"]},{"role":"pedicle","name":"superficial medial plantar artery","left":["FJ2089"],"right":["FJ2179"]},{"role":"pedicle","name":"lateral plantar artery","left":["FJ2079"],"right":["FJ2159"]}],"Trapezius (transverse cervical)":[{"role":"source","name":"subclavian artery","left":["FJ3479"],"right":["FJ3579"]},{"role":"pedicle","name":"transverse cervical artery","left":["FJ2257"],"right":["FJ2309"]},{"role":"pedicle","name":"superficial cervical artery","left":["FJ2256"],"right":["FJ2308"]},{"role":"pedicle","name":"dorsal scapular artery","left":["FJ2232"],"right":["FJ2284"]}],"Omentum (gastro-epiploic)":[{"role":"pedicle","name":"gastro-epiploic artery","left":["FJ3501"],"right":["FJ3596"]},{"role":"vein","name":"gastroepiploic vein","left":["FJ3502"],"right":["FJ3597"]}],"Great saphenous / venous grafts":[{"role":"vein","name":"great saphenous vein","left":["FJ2103"],"right":["FJ2145"]},{"role":"vein","name":"small saphenous vein","left":["FJ2121"],"right":["FJ2176"]},{"role":"vein","name":"cephalic vein","left":["FJ2220"],"right":["FJ2272"]},{"role":"vein","name":"basilic vein","left":["FJ2218"],"right":["FJ2270"]}],"Genicular / popliteal region":[{"role":"pedicle","name":"popliteal artery","left":["FJ2086"],"right":["FJ2170"]},{"role":"pedicle","name":"descending genicular artery","left":["FJ2069"],"right":["FJ2137"]},{"role":"vein","name":"popliteal vein","left":["FJ2117"],"right":["FJ2171"]}]},"not_in_dataset":{"SGAP / IGAP":["superior gluteal artery","inferior gluteal artery"],"Gracilis / medial femoral circumflex":["medial circumflex femoral artery","deep femoral artery (profunda femoris)"],"Fibula free flap / peroneal perforator":["peroneal (fibular) artery"],"Gastrocnemius / sural flaps":["medial sural artery","lateral sural artery"],"Groin flap / DCIA":["superficial circumflex iliac artery","deep circumflex iliac artery"],"Posterior interosseous artery flap":["posterior interosseous artery"],"Head & neck flaps (facial, submental, temporoparietal, paramedian forehead, FAMM)":["facial artery","submental artery","superficial temporal artery","external carotid artery","lingual artery","occipital artery (extracranial)","supratrochlear artery","supraorbital artery"],"Pudendal thigh / Martius / TUG":["internal pudendal artery","obturator artery"],"Jejunal flap":["jejunal arteries"]}}
```

## 5. Attribution strings
- BodyParts3D: "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International"
- Z-Anatomy: keep the existing CC BY-SA 4.0 credit.

Begin with 9a now.
