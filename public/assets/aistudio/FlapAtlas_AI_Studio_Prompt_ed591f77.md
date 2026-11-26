# AI Studio Prompt: "FlapAtlas 3D" — Interactive Anatomical Atlas of Flaps for Plastic & Reconstructive Surgeons

## 0. ROLE AND GOAL

You are a senior full-stack engineer and medical-software designer, working with a plastic and reconstructive surgery consultant as clinical advisor. Build a complete, polished, production-quality web app named **FlapAtlas 3D**: an interactive 3D human anatomy atlas dedicated to **flaps used in plastic and reconstructive surgery**, showing for every flap its donor region, skin paddle, vascular pedicle, perforators, nerves, dimensions, arc of rotation, indications, and technique, together with a **defect-based flap selection engine**.

**Audience:** plastic surgery residents, fellows, and attending surgeons. The UI language and all content must be in **professional medical English**, using standard surgical terminology (e.g., "perforator," "pedicle," "angiosome," "arc of rotation," "reconstructive ladder").

**Reference standards the content must be consistent with (cite by book and chapter/section in each flap record; do NOT reproduce long verbatim passages — summarize facts in original wording):**
1. Zenn MR, Jones G. *Reconstructive Surgery: Anatomy, Technique, and Clinical Applications* (Thieme/QMP).
2. Blondeel PN, Morris SF, Hallock GG, Neligan PC. *Perforator Flaps: Anatomy, Technique, & Clinical Applications*, 3rd ed.
3. *Grabb's Encyclopedia of Flaps* (Strauch, Vasconez, Hall-Findlay, Lee), 4th ed.
4. Classical frameworks: Mathes–Nahai classification (muscle/musculocutaneous flaps, Types I–V); Cormack–Lamberty fasciocutaneous classification (Types A–D); Taylor's angiosome concept; Saint-Cyr's perforasome concept; Nakajima fasciocutaneous classification; Hallock's perforator-flap nomenclature; the 2002 Gent Consensus on Perforator Flap Terminology; Tokyo/ Gent naming conventions for perforator flaps.

---

## 1. NON-NEGOTIABLE DATA-INTEGRITY RULES (CRITICAL)

This is a medical education tool. Accuracy outranks completeness.

1. **Never fabricate numbers.** If a value (pedicle length, vessel diameter, flap dimension, etc.) is not reliably known, display **"Not specified — verify in source"** instead of guessing.
2. Every numeric value must be stored as a **range** (min–max) with **units** (mm, cm, cm²) and a `confidence` flag: `"high"`, `"moderate"`, or `"verify"`.
3. Every flap record must include a `references` array: `{ book, edition, chapter_or_section, note }`. If the exact page/chapter is uncertain, give the book + topic and mark `"verify": true`.
4. Display a persistent, non-intrusive footer disclaimer: *"For education and reference only. Anatomical variation is common. Always verify against primary references and confirm with preoperative imaging (CT angiography / Doppler / MRA) before surgery."*
5. Provide a **"Data Verification Status"** badge on each flap: `Verified`, `Partially verified`, `Needs review`. Default all newly generated records to `Needs review` so the surgeon-user can review and promote them.
6. Provide an **in-app Editor mode** (admin toggle) so the clinician can edit any field, change verification status, add references, and export/import the whole dataset as JSON. Persist edits to `localStorage` / IndexedDB.
7. Keep **all content in a separate data layer** (`/data/flaps.json` + `/data/vessels.json` + `/data/regions.json` + `/data/defects.json`), not hard-coded in components, so the dataset can be audited and expanded without touching UI code.

---

## 2. TECH STACK

- **React + TypeScript + Vite**, Tailwind CSS, shadcn/ui-style components, lucide-react icons.
- **3D:** Three.js via `@react-three/fiber` and `@react-three/drei`.
- **State:** Zustand. **Search:** Fuse.js (fuzzy) with weighted fields. **Persistence:** IndexedDB (idb-keyval) + JSON import/export.
- **PWA / offline-capable** (service worker, installable, works in operating-room Wi-Fi dead zones).
- **Responsive:** desktop, tablet (primary), phone. Touch-friendly (pinch zoom, two-finger pan, tap to select).
- **Optional AI Assistant** using the Gemini API (see §9), strictly grounded in the app's own dataset.
- Accessibility: keyboard navigation, ARIA labels, WCAG AA contrast, colorblind-safe palette option.

---

## 3. 3D ANATOMICAL MODEL

### 3.1 Body model
- Full-body 3D human model, **male/female toggle**, with smooth rotation, zoom, pan, and preset camera views: *Anterior, Posterior, Left/Right Lateral, Head & Neck, Chest/Breast, Abdomen, Back, Upper Limb (anterior/posterior), Hand, Lower Limb (anterior/posterior), Foot, Perineum.*
- Architecture must allow loading an external **GLB/GLTF** anatomical model (e.g., CC-licensed sources such as Z-Anatomy / BodyParts3D) through a single config path. **Ship a built-in procedural fallback** (segmented, clean, stylized anatomical figure with correct proportions, muscles as separate named meshes) so the app works immediately without external assets. Every mesh must have a stable `anatomy_id`.
- Show an on-screen **orientation cube** and a **scale reference** (cm ruler overlay for the selected flap).

### 3.2 Layers panel (toggle + opacity slider for each)
Skin · Subcutaneous fat · Deep fascia · Muscles (individually selectable) · Skeleton · Arteries (red) · Veins (blue) · Nerves (yellow) · Lymphatics (green, optional) · **Perforators** (bright markers) · **Angiosomes** (Taylor, colored territories) · **Perforasomes** · Skin-paddle outlines · Skin-island design lines · Landmarks (ASIS, PSIS, pubic tubercle, fibular head, lateral malleolus, etc.).
- **X-ray / dissection mode:** progressively peel layers (skin → fat → fascia → muscle → bone) via a slider.

### 3.3 Flap visualization (when a flap is selected)
- Highlight the **donor site and skin paddle** with true-to-anatomy shape and **calibrated size** (display length × width in cm and area in cm²).
- Render the **dominant pedicle** (artery + venae comitantes) from source vessel to flap, with correct course, branching, and perforator emergence points; **color-coded vessel tree** (arteries red, veins blue); labels with name, **diameter (mm)**, **length (cm)**, and **Mathes–Nahai type**.
- Show **minor / secondary pedicles** in lighter shade.
- Show **perforator locations** as numbered markers with **distance from bony landmarks** (e.g., "ALT: perforators clustered within a 3-cm radius of the midpoint of the line ASIS–superolateral patella"), and indicate musculocutaneous vs septocutaneous course.
- Show **motor and sensory nerves** (e.g., thoracodorsal, lateral femoral cutaneous, deep peroneal) and whether the flap can be **innervated/sensate**.
- **Arc of rotation** animation for pedicled flaps (pivot point, radius, reach), and **free-flap transfer** animation (donor → recipient with anastomosis site suggestion).
- **Cutting guides:** show typical **incision lines / skin-paddle design lines**.
- Clicking any vessel, perforator, muscle, or nerve opens an **anatomy detail card** (name, origin, course, branches, relations, dimensions, variants, clinical relevance, references).

### 3.4 Interaction
- Hover = tooltip; click = select; double-click = focus camera; right-click/long-press = context menu (Add to compare, Favorite, Show in library, Copy citation).
- **Split-screen**: 3D view + data panel; **picture-in-picture** for donor vs recipient.
- **Measuring tool:** click two points to measure surface distance in cm on the model.

---

## 4. FLAP LIBRARY (SCOPE)

Build a **comprehensive** library. Start with the ~60 core flaps below (all fields complete as far as reliable), architected for easy extension to 200+. Group by **region** and by **flap type**.

### 4.1 Head & Neck
Scalp / forehead (paramedian forehead, supratrochlear/supraorbital, scalp rotation flaps), nasolabial, facial artery musculomucosal (FAMM), submental island, temporoparietal fascia (TPFF), temporalis muscle, platysma, deltopectoral, pectoralis major (for H&N), trapezius (lower, lateral, upper), SCM, cervicofacial advancement, Karapandzic/Abbé–Estlander (lip), Limberg/rhomboid, bilobed, Dufourmentel, **free flaps:** radial forearm (RFFF), ALT, **fibula (osteocutaneous)**, scapular / parascapular, DCIA (iliac crest), lateral arm, medial sural artery perforator (MSAP), jejunal, gracilis, latissimus dorsi, rectus abdominis.

### 4.2 Trunk — Breast, Chest, Abdomen, Back
Pectoralis major / minor, serratus anterior, latissimus dorsi (LD, extended LD, TDAP), **TRAM (pedicled/free, MS-TRAM)**, **DIEP**, **SIEA**, **SGAP / IGAP**, **TUG / PAP / LAP**, omental flap, rectus abdominis (VRAM), external oblique, internal oblique, paraspinous / trapezius / gluteal rotation flaps for sacral & spinal wounds, V-Y advancement flaps, thoracoepigastric, Limberg.

### 4.3 Upper Extremity
Radial forearm (including reverse flow), posterior interosseous artery (PIA), ulnar artery, lateral arm, posterior arm, groin flap (SCIA), first dorsal metacarpal artery (Kite), cross-finger, thenar, Moberg, Atasoy V-Y, Littler neurovascular island, dorsal reverse metacarpal, free medial femoral condyle, toe-to-hand (great toe, second toe), medial plantar / instep.

### 4.4 Lower Extremity
Gastrocnemius (medial/lateral), soleus (hemisoleus), tibialis anterior, peroneus brevis, flexor digitorum longus, **ALT**, anteromedial thigh (AMT), TFL, rectus femoris, gracilis, vastus lateralis, biceps femoris, gluteus maximus (superior/inferior), hamstring V-Y, sural artery (distally based), reverse sural, posterior tibial artery perforator, **peroneal artery perforator**, medial plantar artery (instep), lateral calcaneal, abductor hallucis, extensor digitorum brevis, free fibula, MSAP, saphenous.

### 4.5 Perineum, Genital, Pelvis
Gracilis, VRAM, gluteal fold flap, pudendal thigh (Singapore) flap, Martius flap, TUG, inferior epigastric.

### 4.6 Local / Random pattern flaps & techniques
Advancement, rotation, transposition, interpolation, rhomboid/Limberg, bilobed, V-Y, Z-plasty (with angle–gain table: 30°=25%, 45°=50%, 60°=75%, 75°=100%, 90°=120%), VY/YV, island flaps, keystone flap.

### 4.7 Taxonomy filters for every flap
- **Vascular classification:** Mathes–Nahai Type I–V (muscle), Cormack–Lamberty A–D (fasciocutaneous), perforator (direct / septocutaneous / musculocutaneous), axial pattern, random pattern.
- **Tissue composition:** skin, fascia, fasciocutaneous, muscle, musculocutaneous, osseous, osteocutaneous, chimeric, composite, visceral (omentum, jejunum), nerve-containing, tendon-containing.
- **Mobilization:** local, regional (pedicled), free, perforator-propeller, island, interpolated, delayed.
- **Reconstructive ladder level:** primary closure → skin graft → local flap → regional flap → free flap.

---

## 5. FLAP DATA SCHEMA (use for every record)

```json
{
  "id": "alt-flap",
  "name": "Anterolateral Thigh (ALT) Flap",
  "synonyms": ["ALT", "Lateral femoral cutaneous perforator flap"],
  "region": "Lower extremity (thigh)",
  "flap_type": ["Perforator", "Fasciocutaneous", "Free", "Pedicled (regional)"],
  "classification": {
    "mathes_nahai": null,
    "cormack_lamberty": "Type ...",
    "perforator_type": "Septocutaneous / musculocutaneous"
  },
  "tissue_components": ["Skin", "Subcutaneous fat", "Fascia lata", "Vastus lateralis (optional)", "Motor nerve (optional)"],
  "vascular_anatomy": {
    "dominant_pedicle": {
      "artery": "Descending branch of lateral circumflex femoral artery",
      "artery_origin": "Profunda femoris / lateral circumflex femoral",
      "artery_diameter_mm": { "min": 0, "max": 0, "confidence": "verify" },
      "veins": "Venae comitantes (paired)",
      "vein_diameter_mm": { "min": 0, "max": 0, "confidence": "verify" },
      "pedicle_length_cm": { "min": 0, "max": 0, "confidence": "verify" }
    },
    "minor_pedicles": [],
    "perforators": [
      { "label": "A", "type": "Musculocutaneous", "location": "...", "relation_to_landmarks": "...", "typical_count": "...", "caliber_mm": null }
    ],
    "angiosome": "...",
    "venous_drainage_notes": "...",
    "vascular_variants": ["..."]
  },
  "nerves": { "motor": ["..."], "sensory": ["..."], "can_be_sensate": true, "donor_numbness_note": "..." },
  "dimensions": {
    "max_skin_paddle_cm": { "length": 0, "width": 0, "confidence": "verify" },
    "thickness_notes": "...",
    "primary_closure_max_width_cm": 0
  },
  "arc_of_rotation": { "pivot_point": "...", "reach_description": "...", "reach_cm": null },
  "indications": ["..."],
  "contraindications": ["..."],
  "advantages": ["..."],
  "disadvantages": ["..."],
  "donor_site": { "closure": "...", "morbidity": ["..."], "functional_loss": "..." },
  "technique": {
    "patient_positioning": "...",
    "preoperative_planning": ["Handheld Doppler", "CT angiography"],
    "landmarks": ["..."],
    "design": "...",
    "harvest_steps": ["Step 1 ...", "Step 2 ..."],
    "pearls": ["..."],
    "pitfalls": ["..."]
  },
  "recipient_vessels_options": ["..."],
  "complications": ["..."],
  "alternatives": ["flap-id-1", "flap-id-2"],
  "reconstructive_ladder_level": "Free flap",
  "references": [{ "book": "...", "edition": "...", "chapter_or_section": "...", "verify": true }],
  "verification_status": "Needs review",
  "last_reviewed": null
}
```

---

## 6. SEARCH (ADVANCED)

- Global **search bar** (⌘/Ctrl+K command palette) with fuzzy matching, autocomplete, and synonyms/abbreviations (e.g., "DIEP", "deep inferior epigastric", "TRAM", "ALT", "PAP", "LD", "RFFF", "gastroc").
- Search across: flap names, synonyms, vessels, nerves, muscles, perforators, landmarks, indications, complications, and references.
- **Faceted filters:** region · flap type · tissue composition · pedicle artery · Mathes–Nahai/Cormack–Lamberty type · free vs pedicled · sensate · bone-containing · chimeric · defect size range · pedicle length ≥ X cm · vessel diameter · verification status.
- **Search by vessel:** pick an artery (e.g., "Peroneal artery") → list all flaps based on it (with perforators highlighted in 3D).
- **Search by anatomical region:** click a body region in 3D → list all flaps whose donor site or reach overlaps it.
- Results show a 3D thumbnail, key facts, and a verification badge. Recent searches and saved searches.

---

## 7. DEFECT-BASED FLAP SELECTION ENGINE ("Flap Advisor")

A guided, interactive module that recommends the most suitable flap(s) for a given defect.

### 7.1 Inputs (step-by-step wizard + single-page quick mode)
1. **Defect location:** click on the 3D body (or choose from list): scalp, forehead, orbit, nose (subunits), cheek, lip, ear, oral cavity, mandible, neck, chest wall, sternum, breast (partial/total), abdominal wall, back (spine, sacrum), ischium/trochanter (pressure sores), groin, perineum, shoulder, arm, elbow, forearm, hand (dorsum/palm/digits), thigh, knee, leg (proximal/middle/distal third), ankle, heel, foot (plantar/dorsal).
2. **Defect size:** length × width (cm) and depth; auto-calculate area.
3. **Tissues missing:** skin, subcutaneous fat, fascia, muscle, bone (length of segment), tendon, nerve, mucosa/lining, composite (e.g., through-and-through).
4. **Wound characteristics:** exposed structures (bone, tendon, hardware, vessels, dura, implant), infection/osteomyelitis, dead space, radiated field, contaminated, irradiated/chronic wound, malignancy status.
5. **Functional requirement:** bulk, contour, thin/pliable coverage, sensation, motor function restoration, durability, weight-bearing surface, color/texture match.
6. **Recipient vessel status:** available / zone of injury / previous radiation / need for vein grafts.
7. **Patient factors:** age, smoking, diabetes, peripheral vascular disease, BMI, prior surgery at donor site, anticoagulation, comorbidities, preference for scar location.
8. **Surgical preferences:** reconstructive ladder level allowed, pedicled vs free, operative time constraint.

### 7.2 Output
- **Ranked list of recommended flaps** (top 5), each with: suitability score (0–100%, shown with the reasoning), match explanation ("Why this flap"), size compatibility check (green/yellow/red), pedicle reach check, expected donor-site morbidity, key risks, and a **"Backup options"** list.
- 3D preview of the recommended flap **placed virtually on the defect** with arc-of-rotation or free-transfer path.
- **Side-by-side comparison table** (up to 4 flaps): pedicle, dimensions, thickness, sensate?, bone?, donor morbidity, technical difficulty, operative time, usual recipient vessels, evidence/references.
- **Decision logic must be transparent and rule-based** (stored in `/data/defects.json` and a typed scoring function). Do not use an opaque LLM for the ranking; the LLM (optional) may only *explain* the rule output.
- Include built-in **classic algorithm presets** (e.g., lower-extremity reconstruction by third of the leg; sacral pressure-sore reconstruction; head & neck composite defects; breast reconstruction autologous options; hand/finger tip reconstruction; chest wall; abdominal wall; scalp; oncologic defects) with the standard reconstructive ladder displayed.

---

## 8. ADDITIONAL FEATURES

1. **Compare mode:** side-by-side 3D and data comparison of 2–4 flaps.
2. **Flap detail page** with tabs: *Overview · Vascular Anatomy · Nerves · Dimensions & Design · Technique (step-by-step) · Pearls & Pitfalls · Indications · Donor Site · Complications · Alternatives · References.*
3. **Step-by-step Surgical Technique viewer:** animated 3D steps (incision → dissection → perforator identification → pedicle dissection → flap inset → anastomosis → donor closure), each step with a short text description and key anatomical warnings.
4. **Anatomy Explorer:** browse regional anatomy of muscles, vessels (with angiosome territories), nerves, and fascial planes independently of flaps; "show all flaps supplied by this vessel."
5. **Angiosome & Perforasome atlas** (Taylor / Saint-Cyr) with interactive territory overlays and linking-vessel (choke vessel) display.
6. **Perforator mapping helper:** enter bony-landmark measurements → app proposes the typical Doppler/CTA search zone on the 3D model (educational only).
7. **Pedicle & reach calculator:** user enters defect location and pedicle length → app visualizes the reach and gives a feasibility verdict.
8. **Z-plasty and local-flap geometry simulator:** adjustable angles, limb lengths, and gain in length with animated transposition.
9. **Quiz / Learning mode:** MCQs and "identify the vessel/flap on the 3D model," spaced-repetition flashcards, board-style cases ("A 55-year-old with a distal-third tibial defect with exposed bone… choose the flap"), score tracking, weak-topic analytics.
10. **Case Planner:** create a case (patient-agnostic, no personal identifiers), pick defect + flap, add notes/photos, export a **1-page planning sheet (PDF)**. *Do not store or request any patient-identifiable information; show a privacy notice.*
11. **Favorites, collections, personal notes, highlights, and tags.**
12. **Glossary** of reconstructive-surgery terms and abbreviations with tooltip definitions throughout the app.
13. **Classification reference pages:** Mathes–Nahai, Cormack–Lamberty, Gent consensus, reconstructive ladder/elevator, angiosome list, perforator nomenclature.
14. **Export:** flap sheet as PDF, copy citation, share link (deep-linkable URLs per flap), screenshot of 3D view with labels.
15. **Settings:** light/dark/OR-dim theme, metric/imperial, label size, language fixed to English (architected for i18n), layer presets, "Teaching mode" (hides labels for self-test), colorblind palette.
16. **Onboarding tour** and contextual help; keyboard shortcut cheat sheet.

---

## 9. OPTIONAL AI ASSISTANT (Gemini API, GROUNDED)

- Chat panel: "Ask FlapAtlas."
- **Grounding rule:** answer only from the app's dataset (retrieve relevant flap/vessel records and pass them to the model as context). If the dataset does not contain the answer, reply: *"Not available in the current dataset — please consult the primary references."* Never invent anatomy, numbers, or citations.
- Always show **which records were used** (clickable chips) and keep the verification badge visible.
- Capabilities: explain a flap in plain language, compare flaps, quiz me, summarize technique steps, suggest alternatives when the first-choice flap is contraindicated, convert a clinical scenario into the structured inputs of the Flap Advisor.
- Include safety wording: educational use, not a substitute for clinical judgment.
- Use environment variable `GEMINI_API_KEY`; handle errors and rate limits gracefully; app must remain fully functional without the assistant.

---

## 10. UI / UX REQUIREMENTS

- **Layout:** left sidebar (Library · Anatomy · Flap Advisor · Compare · Quiz · Case Planner · Glossary · Settings), center 3D viewport, right context panel (details), top bar with global search and layer toggle button.
- Clean, clinical, modern aesthetic: neutral background, teal/slate accent, high-contrast labels, smooth transitions, no clutter. Dark and "OR-dim" modes.
- Loading skeletons, empty states, error boundaries, and 60-fps target on mid-range tablets (use LOD, instancing, lazy-loaded assets).
- Everything reachable in **≤ 3 clicks**; breadcrumbs; back/forward navigation within the app; deep links.

---

## 11. PROJECT STRUCTURE (suggested)

```
/src
  /components   (Viewer3D, LayerPanel, FlapCard, FlapDetail, Search, Advisor, Compare, Quiz, CasePlanner, Glossary, Editor)
  /data         (flaps.json, vessels.json, nerves.json, muscles.json, regions.json, defects.json, glossary.json, quiz.json)
  /engine       (searchEngine.ts, advisorEngine.ts, reachCalculator.ts, zplastyCalc.ts)
  /models       (bodyModel config, procedural fallback body, GLB loader)
  /store        (zustand stores)
  /types        (Flap, Vessel, Defect schemas — strict TypeScript + runtime validation with zod)
```
- Validate the whole dataset on load with **zod**; show a **Data Quality Dashboard** (counts by verification status, missing fields, records lacking references).

---

## 12. BUILD PLAN (execute in phases; after each phase, run and fix errors before continuing)

1. **Phase 1:** Project scaffold, types/schemas, data layer, layout, theme, search + library with the first 15 flaps (full records: ALT, DIEP, SIEA, TRAM, LD, TDAP, gracilis, RFFF, fibula, PAP, SGAP, gastrocnemius, pectoralis major, paramedian forehead, groin flap).
2. **Phase 2:** 3D viewer with procedural body, layers, region navigation, flap highlighting, vessel/perforator rendering.
3. **Phase 3:** Flap detail pages, compare mode, technique viewer, anatomy explorer.
4. **Phase 4:** Flap Advisor engine + presets + 3D placement preview.
5. **Phase 5:** Expand dataset to 60+ flaps; angiosomes/perforasomes; local-flap and Z-plasty simulator; reach calculator.
6. **Phase 6:** Quiz/learning, case planner (PDF export), glossary, favorites/notes, Editor mode and JSON import/export.
7. **Phase 7:** Gemini grounded assistant, PWA/offline, accessibility pass, performance pass, final QA with a self-review checklist (data integrity rules in §1 verified on every record).

**Begin with Phase 1 now. At the end of each phase, summarize what was built, list known limitations, and state exactly which data fields are marked "verify" so the clinical advisor can review them.**
