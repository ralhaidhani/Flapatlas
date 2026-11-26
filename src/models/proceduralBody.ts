import * as THREE from 'three';
import { REGIONS, VESSELS } from '../data/index';
import type { BodySex, LayerKey } from '../store/useAtlasStore';
import { getAnatomyPalette } from './bodyModelConfig';

export interface ProceduralBodyRig {
  root: THREE.Group;
  layerGroups: Record<LayerKey, THREE.Group>;
  interactiveMeshes: THREE.Object3D[];
  vesselMeshMap: Map<string, THREE.Mesh>;
  updatePalette: (colorblindMode: boolean) => void;
  dispose: () => void;
}

function createMicroGrainTexture(size = 128): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const img = ctx.createImageData(size, size);
    let seed = 4219;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 120 + Math.floor(rand() * 24);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

export function createContactShadowDisc(): THREE.Mesh {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.28)');
    grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.11)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const geo = new THREE.PlaneGeometry(0.95, 0.95);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.004;
  mesh.name = 'ground_contact_shadow';
  return mesh;
}

function tagMesh(
  mesh: THREE.Object3D,
  id: string,
  label: string,
  category: string,
  layerKey: LayerKey
) {
  mesh.name = id;
  mesh.userData = {
    anatomy_id: id,
    anatomy_label: label,
    anatomy_category: category,
    layerKey,
  };
}

function createLimbSegment(
  p0: [number, number, number],
  p1: [number, number, number],
  r0: number,
  r1: number,
  radialSegments = 16
): THREE.Mesh {
  const v0 = new THREE.Vector3(...p0);
  const v1 = new THREE.Vector3(...p1);
  const dir = new THREE.Vector3().subVectors(v1, v0);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r1, r0, len, radialSegments, 1, false);
  const mesh = new THREE.Mesh(geo);
  mesh.position.copy(v0).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function createTubeFromPoints(
  pts: Array<[number, number, number]>,
  radius: number,
  tubularSegments = 28,
  radialSegments = 8
): THREE.TubeGeometry {
  const vecs = pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(vecs);
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
}

/**
 * Builds the multi-layer procedural human anatomical body (standing height ~1.78 m,
 * feet resting flat at y = 0, facing +Z). All spatial coordinates match the
 * surgical dataset (`regions.json`, `vessels.json`, `flaps_*.json`).
 */
export function buildProceduralBody(
  sex: BodySex,
  colorblindMode: boolean
): ProceduralBodyRig {
  const root = new THREE.Group();
  root.name = 'FlapAtlasBodyRoot';

  const palette = getAnatomyPalette(colorblindMode);
  const bumpTex = createMicroGrainTexture();

  const layerGroups: Record<LayerKey, THREE.Group> = {
    skin: new THREE.Group(),
    fat: new THREE.Group(),
    fascia: new THREE.Group(),
    muscle: new THREE.Group(),
    organs: new THREE.Group(),
    skeleton: new THREE.Group(),
    arteries: new THREE.Group(),
    veins: new THREE.Group(),
    nerves: new THREE.Group(),
    lymphatics: new THREE.Group(),
    perforators: new THREE.Group(),
    angiosomes: new THREE.Group(),
    perforasomes: new THREE.Group(),
    landmarks: new THREE.Group(),
    paddle: new THREE.Group(),
    cuttingGuides: new THREE.Group(),
  };

  (Object.keys(layerGroups) as LayerKey[]).forEach((k) => {
    layerGroups[k].name = `layer_${k}`;
    root.add(layerGroups[k]);
  });

  const interactiveMeshes: THREE.Object3D[] = [];
  const vesselMeshMap = new Map<string, THREE.Mesh>();

  // Shared materials (cloned per category so opacity updates stay clean)
  const skinMat = new THREE.MeshStandardMaterial({
    color: palette.skin,
    roughness: 0.62,
    metalness: 0.02,
    bumpMap: bumpTex,
    bumpScale: 0.0018,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  const fatMat = new THREE.MeshStandardMaterial({
    color: palette.fat,
    roughness: 0.72,
    metalness: 0.0,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });

  const fasciaMat = new THREE.MeshStandardMaterial({
    color: palette.fascia,
    roughness: 0.45,
    metalness: 0.05,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    wireframe: false,
  });

  const muscleMat = new THREE.MeshStandardMaterial({
    color: palette.muscle,
    roughness: 0.52,
    metalness: 0.04,
    bumpMap: bumpTex,
    bumpScale: 0.0028,
    transparent: true,
    opacity: 0.82,
  });

  const boneMat = new THREE.MeshStandardMaterial({
    color: palette.bone,
    roughness: 0.68,
    metalness: 0.03,
    transparent: true,
    opacity: 0.92,
  });

  const arteryMat = new THREE.MeshStandardMaterial({
    color: palette.artery,
    roughness: 0.35,
    metalness: 0.08,
  });

  const veinMat = new THREE.MeshStandardMaterial({
    color: palette.vein,
    roughness: 0.38,
    metalness: 0.06,
    transparent: true,
    opacity: 0.75,
  });

  const nerveMat = new THREE.MeshStandardMaterial({
    color: palette.nerve,
    roughness: 0.42,
    metalness: 0.05,
  });

  const lymphaticMat = new THREE.MeshStandardMaterial({
    color: palette.lymphatic,
    roughness: 0.38,
    metalness: 0.06,
    transparent: true,
    opacity: 0.85,
  });

  const isFemale = sex === 'female';
  const shoulderHalf = isFemale ? 0.185 : 0.21;
  const waistRadius = isFemale ? 0.12 : 0.142;
  const hipRadius = isFemale ? 0.172 : 0.158;
  const chestDepthScale = isFemale ? 0.74 : 0.76;

  // =========================================================================
  // 1. SKIN LAYER (Organic sculpted human silhouette)
  // =========================================================================
  const torsoProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.01, 0.82), // Perineum floor
    new THREE.Vector2(hipRadius * 0.92, 0.86),
    new THREE.Vector2(hipRadius, 0.94), // Pelvis / hips
    new THREE.Vector2(hipRadius * 0.88, 1.01),
    new THREE.Vector2(waistRadius, 1.11), // Waist
    new THREE.Vector2(waistRadius * 1.09, 1.21), // Lower ribcage
    new THREE.Vector2(shoulderHalf * 0.9, 1.32), // Chest
    new THREE.Vector2(shoulderHalf * 0.98, 1.42), // Shoulders
    new THREE.Vector2(0.068, 1.47), // Neck base
    new THREE.Vector2(0.056, 1.53), // Upper neck
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 32);
  torsoGeo.scale(1.0, 1.0, chestDepthScale);
  const torsoMesh = new THREE.Mesh(torsoGeo, skinMat);
  tagMesh(torsoMesh, 'skin_torso', 'Trunk & Torso Integument', 'Skin', 'skin');
  layerGroups.skin.add(torsoMesh);

  // Female breast mounds (subtle, clinical proportion)
  if (isFemale) {
    ([-1, 1] as const).forEach((side) => {
      const breastGeo = new THREE.SphereGeometry(0.064, 20, 16);
      breastGeo.scale(1.05, 0.92, 0.76);
      const breast = new THREE.Mesh(breastGeo, skinMat);
      breast.position.set(side * 0.075, 1.28, 0.105);
      tagMesh(
        breast,
        side < 0 ? 'skin_breast_r' : 'skin_breast_l',
        side < 0 ? 'Right Breast Contour' : 'Left Breast Contour',
        'Skin',
        'skin'
      );
      layerGroups.skin.add(breast);
    });
  }

  // Head & Face
  const headGeo = new THREE.SphereGeometry(0.095, 24, 20);
  headGeo.scale(0.86, 1.14, 0.96);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.position.set(0, 1.655, 0.008);
  tagMesh(headMesh, 'skin_head', 'Craniofacial Integument', 'Skin', 'skin');
  layerGroups.skin.add(headMesh);

  // Subtle nasal bridge & chin
  const noseGeo = new THREE.ConeGeometry(0.016, 0.036, 10);
  const noseMesh = new THREE.Mesh(noseGeo, skinMat);
  noseMesh.position.set(0, 1.635, 0.102);
  noseMesh.rotation.x = Math.PI * 0.42;
  tagMesh(noseMesh, 'skin_nose', 'Nasal Subunit Envelope', 'Skin', 'skin');
  layerGroups.skin.add(noseMesh);

  // Bilateral Upper & Lower Extremities (Skin Envelope)
  ([-1, 1] as const).forEach((side) => {
    const sideLabel = side < 0 ? 'Right' : 'Left';
    const shoulderPt: [number, number, number] = [side * (shoulderHalf + 0.015), 1.42, -0.005];
    const elbowPt: [number, number, number] = [side * 0.285, 1.14, 0.005];
    const wristPt: [number, number, number] = [side * 0.355, 0.89, 0.03];
    const handTipPt: [number, number, number] = [side * 0.38, 0.77, 0.045];

    const uArm = createLimbSegment(shoulderPt, elbowPt, 0.048, 0.04);
    uArm.material = skinMat;
    tagMesh(uArm, `skin_upper_arm_${side < 0 ? 'r' : 'l'}`, `${sideLabel} Upper Arm`, 'Skin', 'skin');
    layerGroups.skin.add(uArm);

    const fArm = createLimbSegment(elbowPt, wristPt, 0.039, 0.028);
    fArm.material = skinMat;
    tagMesh(fArm, `skin_forearm_${side < 0 ? 'r' : 'l'}`, `${sideLabel} Forearm`, 'Skin', 'skin');
    layerGroups.skin.add(fArm);

    const handGeo = new THREE.SphereGeometry(0.038, 14, 12);
    handGeo.scale(0.65, 1.55, 0.42);
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(
      (wristPt[0] + handTipPt[0]) * 0.5,
      (wristPt[1] + handTipPt[1]) * 0.5,
      (wristPt[2] + handTipPt[2]) * 0.5
    );
    tagMesh(hand, `skin_hand_${side < 0 ? 'r' : 'l'}`, `${sideLabel} Hand`, 'Skin', 'skin');
    layerGroups.skin.add(hand);

    // Lower Extremity
    const hipPt: [number, number, number] = [side * 0.105, 0.88, 0.0];
    const kneePt: [number, number, number] = [side * 0.108, 0.49, 0.006];
    const anklePt: [number, number, number] = [side * 0.105, 0.09, -0.005];

    const thigh = createLimbSegment(hipPt, kneePt, isFemale ? 0.082 : 0.078, 0.056);
    thigh.material = skinMat;
    tagMesh(thigh, `skin_thigh_${side < 0 ? 'r' : 'l'}`, `${sideLabel} Thigh`, 'Skin', 'skin');
    layerGroups.skin.add(thigh);

    const leg = createLimbSegment(kneePt, anklePt, 0.054, 0.035);
    leg.material = skinMat;
    tagMesh(leg, `skin_leg_${side < 0 ? 'r' : 'l'}`, `${sideLabel} Lower Leg`, 'Skin', 'skin');
    layerGroups.skin.add(leg);

    // Foot resting flat on y = 0
    const footGeo = new THREE.CapsuleGeometry(0.032, 0.135, 8, 14);
    footGeo.rotateX(Math.PI / 2);
    footGeo.scale(1.05, 0.72, 1.0);
    const foot = new THREE.Mesh(footGeo, skinMat);
    foot.position.set(side * 0.108, 0.032, 0.048);
    tagMesh(foot, `skin_foot_${side < 0 ? 'r' : 'l'}`, `${sideLabel} Foot`, 'Skin', 'skin');
    layerGroups.skin.add(foot);

    // Gluteal contour (posterior)
    const gluteGeo = new THREE.SphereGeometry(isFemale ? 0.084 : 0.076, 16, 14);
    gluteGeo.scale(0.95, 1.08, 0.84);
    const glute = new THREE.Mesh(gluteGeo, skinMat);
    glute.position.set(side * 0.078, 0.92, -0.072);
    layerGroups.skin.add(glute);
  });

  // =========================================================================
  // 2. SUBCUTANEOUS FAT & DEEP FASCIA LAYERS
  // =========================================================================
  const abdomFatGeo = new THREE.SphereGeometry(0.115, 20, 16);
  abdomFatGeo.scale(1.15, 0.72, 0.52);
  const abdomFat = new THREE.Mesh(abdomFatGeo, fatMat);
  abdomFat.position.set(0, 1.02, 0.068);
  tagMesh(abdomFat, 'fat_lower_abdomen', 'Infraumbilical Subcutaneous Adipose (DIEP/SIEA Zone)', 'Subcutaneous Fat', 'fat');
  layerGroups.fat.add(abdomFat);

  ([-1, 1] as const).forEach((side) => {
    const fasciaLata = createLimbSegment(
      [side * 0.11, 0.86, 0.0],
      [side * 0.11, 0.51, 0.005],
      0.072,
      0.052,
      14
    );
    fasciaLata.material = fasciaMat;
    tagMesh(
      fasciaLata,
      `fascia_lata_${side < 0 ? 'r' : 'l'}`,
      `${side < 0 ? 'Right' : 'Left'} Fascia Lata & Lateral Intermuscular Septum`,
      'Deep Fascia',
      'fascia'
    );
    layerGroups.fascia.add(fasciaLata);
  });

  // =========================================================================
  // 3. NAMED SURGICAL MUSCLE LAYER
  // =========================================================================
  const addMuscle = (
    id: string,
    label: string,
    geo: THREE.BufferGeometry,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0]
  ) => {
    const m = new THREE.Mesh(geo, muscleMat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    tagMesh(m, id, label, 'Muscle', 'muscle');
    layerGroups.muscle.add(m);
    interactiveMeshes.push(m);
  };

  ([-1, 1] as const).forEach((side) => {
    const sLabel = side < 0 ? 'Right' : 'Left';
    const suf = side < 0 ? 'r' : 'l';

    // Pectoralis Major
    const pecGeo = new THREE.SphereGeometry(0.088, 18, 14);
    pecGeo.scale(1.15, 0.78, 0.34);
    addMuscle(
      `muscle_pec_major_${suf}`,
      `${sLabel} Pectoralis Major (Mathes–Nahai Type V)`,
      pecGeo,
      [side * 0.085, 1.32, 0.078],
      [0, side * -0.18, side * 0.12]
    );

    // Rectus Abdominis (Type III)
    const rectusGeo = new THREE.CapsuleGeometry(0.032, 0.24, 6, 12);
    rectusGeo.scale(1.15, 1.0, 0.42);
    addMuscle(
      `muscle_rectus_abdominis_${suf}`,
      `${sLabel} Rectus Abdominis (Mathes–Nahai Type III)`,
      rectusGeo,
      [side * 0.042, 1.05, 0.076]
    );

    // Latissimus Dorsi (Type V)
    const ldGeo = new THREE.SphereGeometry(0.105, 18, 14);
    ldGeo.scale(0.92, 1.35, 0.24);
    addMuscle(
      `muscle_latissimus_dorsi_${suf}`,
      `${sLabel} Latissimus Dorsi (Mathes–Nahai Type V)`,
      ldGeo,
      [side * 0.092, 1.24, -0.072],
      [0, side * 0.22, side * -0.12]
    );

    // Gluteus Maximus (Type III)
    const gluteMGeo = new THREE.SphereGeometry(0.076, 16, 14);
    gluteMGeo.scale(0.95, 1.0, 0.62);
    addMuscle(
      `muscle_gluteus_maximus_${suf}`,
      `${sLabel} Gluteus Maximus (Mathes–Nahai Type III)`,
      gluteMGeo,
      [side * 0.076, 0.92, -0.068]
    );

    // Vastus Lateralis & Rectus Femoris (ALT septum landmark)
    const vlGeo = new THREE.CapsuleGeometry(0.034, 0.27, 6, 12);
    addMuscle(
      `muscle_vastus_lateralis_${suf}`,
      `${sLabel} Vastus Lateralis (ALT Perforator Septum)`,
      vlGeo,
      [side * 0.132, 0.69, 0.012],
      [0, 0, side * -0.03]
    );

    const rfGeo = new THREE.CapsuleGeometry(0.031, 0.27, 6, 12);
    addMuscle(
      `muscle_rectus_femoris_${suf}`,
      `${sLabel} Rectus Femoris (ALT Medial Landmark)`,
      rfGeo,
      [side * 0.098, 0.70, 0.034]
    );

    // Gracilis (Type II)
    const gracGeo = new THREE.CapsuleGeometry(0.019, 0.28, 6, 10);
    addMuscle(
      `muscle_gracilis_${suf}`,
      `${sLabel} Gracilis Muscle (Mathes–Nahai Type II)`,
      gracGeo,
      [side * 0.064, 0.69, 0.004],
      [0, 0, side * 0.05]
    );

    // Gastrocnemius (Type I) & Soleus (Type II)
    const gastrocGeo = new THREE.CapsuleGeometry(0.028, 0.15, 6, 12);
    addMuscle(
      `muscle_gastrocnemius_${suf}`,
      `${sLabel} Gastrocnemius Muscle (Mathes–Nahai Type I)`,
      gastrocGeo,
      [side * 0.102, 0.36, -0.028]
    );

    const soleusGeo = new THREE.CapsuleGeometry(0.024, 0.18, 6, 10);
    addMuscle(
      `muscle_soleus_${suf}`,
      `${sLabel} Soleus Muscle (Mathes–Nahai Type II)`,
      soleusGeo,
      [side * 0.105, 0.27, -0.018]
    );

    // Sternocleidomastoid (Neck H&N landmark)
    const scm = createLimbSegment(
      [side * 0.02, 1.41, 0.048],
      [side * 0.058, 1.56, -0.015],
      0.012,
      0.011,
      10
    );
    scm.material = muscleMat;
    tagMesh(scm, `muscle_scm_${suf}`, `${sLabel} Sternocleidomastoid Muscle`, 'Muscle', 'muscle');
    layerGroups.muscle.add(scm);
    interactiveMeshes.push(scm);

    // External Oblique flank contour
    const obliqueGeo = new THREE.SphereGeometry(0.068, 14, 12);
    obliqueGeo.scale(0.55, 1.45, 0.85);
    addMuscle(
      `muscle_ext_oblique_${suf}`,
      `${sLabel} External Oblique Muscle`,
      obliqueGeo,
      [side * 0.118, 1.09, 0.015],
      [0, 0, side * -0.08]
    );

    // Deltoid & Forearm Flexor/Extensor mass
    const deltoidGeo = new THREE.SphereGeometry(0.052, 14, 12);
    deltoidGeo.scale(0.88, 1.15, 0.85);
    addMuscle(
      `muscle_deltoid_${suf}`,
      `${sLabel} Deltoid Muscle`,
      deltoidGeo,
      [side * (shoulderHalf + 0.015), 1.40, 0.0]
    );

    const armMuscle = createLimbSegment(
      [side * (shoulderHalf + 0.02), 1.38, 0.0],
      [side * 0.285, 1.15, 0.005],
      0.036,
      0.029,
      12
    );
    armMuscle.material = muscleMat;
    tagMesh(armMuscle, `muscle_brachium_${suf}`, `${sLabel} Biceps / Triceps Brachii`, 'Muscle', 'muscle');
    layerGroups.muscle.add(armMuscle);

    const forearmMuscle = createLimbSegment(
      [side * 0.288, 1.13, 0.006],
      [side * 0.348, 0.92, 0.026],
      0.03,
      0.019,
      12
    );
    forearmMuscle.material = muscleMat;
    tagMesh(forearmMuscle, `muscle_forearm_${suf}`, `${sLabel} Forearm Flexor / Extensor Mass`, 'Muscle', 'muscle');
    layerGroups.muscle.add(forearmMuscle);
  });

  // =========================================================================
  // 4. INTERNAL ARTICULATED SKELETON LAYER
  // =========================================================================
  const addBone = (
    id: string,
    label: string,
    mesh: THREE.Mesh
  ) => {
    mesh.material = boneMat;
    tagMesh(mesh, id, label, 'Skeleton', 'skeleton');
    layerGroups.skeleton.add(mesh);
    interactiveMeshes.push(mesh);
  };

  // Cranium & Mandible
  const skullGeo = new THREE.SphereGeometry(0.076, 18, 14);
  skullGeo.scale(0.85, 1.05, 0.96);
  const skullMesh = new THREE.Mesh(skullGeo, boneMat);
  skullMesh.position.set(0, 1.67, 0.002);
  addBone('bone_cranium', 'Cranium / Calvarium', skullMesh);

  const mandibleGeo = new THREE.TorusGeometry(0.048, 0.011, 8, 18, Math.PI * 1.05);
  const mandibleMesh = new THREE.Mesh(mandibleGeo, boneMat);
  mandibleMesh.position.set(0, 1.565, 0.03);
  mandibleMesh.rotation.set(Math.PI * 0.45, 0, Math.PI * 0.98);
  addBone('bone_mandible', 'Mandible (Fibula / DCIA Reconstruction Target)', mandibleMesh);

  // Vertebral Column
  const spineMesh = createLimbSegment([0, 0.92, -0.042], [0, 1.57, -0.022], 0.022, 0.017, 12);
  addBone('bone_spine', 'Vertebral Column', spineMesh);

  // Sternum & Ribcage
  const sternumGeo = new THREE.BoxGeometry(0.032, 0.145, 0.014);
  const sternumMesh = new THREE.Mesh(sternumGeo, boneMat);
  sternumMesh.position.set(0, 1.30, 0.068);
  addBone('bone_sternum', 'Sternum', sternumMesh);

  for (let i = 0; i < 7; i++) {
    const y = 1.18 + i * 0.032;
    const rx = 0.095 + Math.sin((i / 6) * Math.PI) * 0.032;
    const ribGeo = new THREE.TorusGeometry(rx, 0.0065, 6, 22);
    ribGeo.scale(1.0, 0.66, 1.0);
    const rib = new THREE.Mesh(ribGeo, boneMat);
    rib.position.set(0, y, 0.01);
    rib.rotation.x = Math.PI / 2;
    layerGroups.skeleton.add(rib);
  }

  // Pelvis & Sacrum
  const pelvisGeo = new THREE.TorusGeometry(0.095, 0.022, 10, 24);
  pelvisGeo.scale(1.22, 0.68, 0.85);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, boneMat);
  pelvisMesh.position.set(0, 0.935, 0.0);
  pelvisMesh.rotation.x = Math.PI * 0.42;
  addBone('bone_pelvis', 'Pelvis / Iliac Crest / Sacrum', pelvisMesh);

  // Bilateral Long Bones
  ([-1, 1] as const).forEach((side) => {
    const suf = side < 0 ? 'r' : 'l';
    const sLabel = side < 0 ? 'Right' : 'Left';

    // Clavicle
    addBone(
      `bone_clavicle_${suf}`,
      `${sLabel} Clavicle`,
      createLimbSegment([side * 0.02, 1.41, 0.055], [side * (shoulderHalf - 0.01), 1.43, 0.01], 0.008, 0.008, 8)
    );
    // Humerus
    addBone(
      `bone_humerus_${suf}`,
      `${sLabel} Humerus`,
      createLimbSegment([side * (shoulderHalf + 0.01), 1.41, -0.005], [side * 0.285, 1.14, 0.005], 0.016, 0.014, 10)
    );
    // Radius & Ulna
    addBone(
      `bone_radius_${suf}`,
      `${sLabel} Radius`,
      createLimbSegment([side * 0.292, 1.135, 0.01], [side * 0.365, 0.895, 0.036], 0.009, 0.008, 8)
    );
    addBone(
      `bone_ulna_${suf}`,
      `${sLabel} Ulna`,
      createLimbSegment([side * 0.278, 1.135, 0.0], [side * 0.345, 0.895, 0.024], 0.009, 0.007, 8)
    );
    // Femur
    addBone(
      `bone_femur_${suf}`,
      `${sLabel} Femur`,
      createLimbSegment([side * 0.105, 0.90, 0.0], [side * 0.108, 0.495, 0.006], 0.021, 0.018, 12)
    );
    // Patella
    const patGeo = new THREE.SphereGeometry(0.02, 10, 10);
    patGeo.scale(1.0, 1.1, 0.55);
    const pat = new THREE.Mesh(patGeo, boneMat);
    pat.position.set(side * 0.108, 0.50, 0.044);
    addBone(`bone_patella_${suf}`, `${sLabel} Patella`, pat);
    // Tibia & Fibula
    addBone(
      `bone_tibia_${suf}`,
      `${sLabel} Tibia`,
      createLimbSegment([side * 0.102, 0.48, 0.008], [side * 0.10, 0.095, 0.002], 0.018, 0.014, 10)
    );
    addBone(
      `bone_fibula_${suf}`,
      `${sLabel} Fibula (Free Osteocutaneous Donor Bone)`,
      createLimbSegment([side * 0.128, 0.455, -0.004], [side * 0.124, 0.09, -0.006], 0.0085, 0.0075, 8)
    );
  });

  // =========================================================================
  // 5. VASCULAR & NERVE TREES (From VESSELS dataset + Central Trunk)
  // =========================================================================
  // Central Aorta & Iliac bifurcation
  const aortaGeo = createTubeFromPoints(
    [
      [0.01, 1.36, 0.01],
      [0.005, 1.24, -0.005],
      [0.004, 1.08, -0.008],
      [0.0, 1.0, -0.004],
    ],
    0.011,
    20,
    8
  );
  const aortaMesh = new THREE.Mesh(aortaGeo, arteryMat);
  tagMesh(aortaMesh, 'vessel_aorta', 'Thoracoabdominal Aorta', 'Artery', 'arteries');
  layerGroups.arteries.add(aortaMesh);

  // Central IVC
  const ivcGeo = createTubeFromPoints(
    [
      [-0.014, 1.35, 0.008],
      [-0.015, 1.18, -0.006],
      [-0.014, 1.0, -0.004],
    ],
    0.012,
    18,
    8
  );
  const ivcMesh = new THREE.Mesh(ivcGeo, veinMat);
  tagMesh(ivcMesh, 'vessel_ivc', 'Inferior Vena Cava', 'Vein', 'veins');
  layerGroups.veins.add(ivcMesh);

  for (const vessel of VESSELS) {
    if (!vessel.path3d || vessel.path3d.length < 2) continue;
    const isNerve = vessel.category === 'Nerve';
    const radius = isNerve ? 0.0042 : 0.0052;
    const geo = createTubeFromPoints(vessel.path3d, radius, 26, 8);
    const mat = isNerve ? nerveMat.clone() : arteryMat.clone();
    const mesh = new THREE.Mesh(geo, mat);
    tagMesh(mesh, vessel.id, vessel.name, vessel.category, isNerve ? 'nerves' : 'arteries');
    if (isNerve) {
      layerGroups.nerves.add(mesh);
    } else {
      layerGroups.arteries.add(mesh);
      // Companion venae comitantes subtly offset
      const veinPts: Array<[number, number, number]> = vessel.path3d.map(([x, y, z]) => [
        x + (x >= 0 ? 0.007 : -0.007),
        y,
        z - 0.004,
      ]);
      const vGeo = createTubeFromPoints(veinPts, 0.0042, 20, 7);
      const vMesh = new THREE.Mesh(vGeo, veinMat);
      tagMesh(vMesh, `${vessel.id}_vein`, `${vessel.name} — Companion Vein`, 'Vein', 'veins');
      layerGroups.veins.add(vMesh);
    }
    interactiveMeshes.push(mesh);
    vesselMeshMap.set(vessel.id, mesh);
  }

  // =========================================================================
  // 6. BONY SURGICAL LANDMARKS & ANGIOSOME OVERLAYS (From REGIONS)
  // =========================================================================
  const landmarkGeo = new THREE.SphereGeometry(0.009, 12, 10);
  const landmarkMat = new THREE.MeshStandardMaterial({
    color: palette.landmark,
    roughness: 0.3,
    metalness: 0.15,
  });

  const seenLandmarks = new Set<string>();
  for (const region of REGIONS) {
    for (const lm of region.landmarks) {
      if (seenLandmarks.has(lm.id)) continue;
      seenLandmarks.add(lm.id);
      const pin = new THREE.Mesh(landmarkGeo, landmarkMat);
      pin.position.set(...lm.position);
      tagMesh(pin, `landmark_${lm.id}`, `${lm.name} — ${lm.clinicalNote}`, 'Landmark', 'landmarks');
      layerGroups.landmarks.add(pin);
      interactiveMeshes.push(pin);
    }
  }

  // Angiosome territory translucent shells (subtle clinical overlay when toggled)
  const angiosomeSpecs: Array<{
    id: string;
    label: string;
    pos: [number, number, number];
    scale: [number, number, number];
    color: number;
  }> = [
    { id: 'angio_diea', label: 'DIEA Angiosome (Lower Abdomen)', pos: [0, 1.03, 0.08], scale: [0.13, 0.07, 0.06], color: 0x0ea5e9 },
    { id: 'angio_lcfa', label: 'LCFA Descending Branch Angiosome (Anterolateral Thigh)', pos: [-0.135, 0.70, 0.03], scale: [0.055, 0.16, 0.065], color: 0x0f766e },
    { id: 'angio_tda', label: 'Thoracodorsal Angiosome (Lateral Back)', pos: [0.10, 1.24, -0.08], scale: [0.09, 0.14, 0.05], color: 0x6366f1 },
    { id: 'angio_radial', label: 'Radial Artery Angiosome (Volar Forearm)', pos: [-0.33, 0.99, 0.032], scale: [0.04, 0.11, 0.04], color: 0xec4899 },
    { id: 'angio_sga', label: 'Superior Gluteal Angiosome (Upper Buttock)', pos: [0.08, 0.94, -0.09], scale: [0.075, 0.065, 0.05], color: 0xf59e0b },
    { id: 'angio_peroneal', label: 'Peroneal Artery Angiosome (Lateral Leg)', pos: [-0.145, 0.28, -0.005], scale: [0.042, 0.15, 0.05], color: 0x10b981 },
  ];

  for (const spec of angiosomeSpecs) {
    const geo = new THREE.SphereGeometry(1, 16, 12);
    geo.scale(...spec.scale);
    const mat = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...spec.pos);
    tagMesh(m, spec.id, spec.label, 'Angiosome', 'angiosomes');
    layerGroups.angiosomes.add(m);
  }

  // =========================================================================
  // 7. LYMPHATICS LAYER (Green nodal basins & collectors for VLNT / LVA)
  // =========================================================================
  const nodeGeo = new THREE.SphereGeometry(0.0085, 10, 8);
  const lymphNodes: Array<{ id: string; label: string; pos: [number, number, number] }> = [
    { id: 'lymph_cervical_r', label: 'Right Cervical / Submental Lymph Node Basin (VLNT Donor)', pos: [-0.052, 1.52, 0.022] },
    { id: 'lymph_cervical_l', label: 'Left Cervical / Submental Lymph Node Basin (VLNT Donor)', pos: [0.052, 1.52, 0.022] },
    { id: 'lymph_axillary_r', label: 'Right Axillary / Lateral Thoracic Lymph Node Basin', pos: [-0.175, 1.33, 0.015] },
    { id: 'lymph_axillary_l', label: 'Left Axillary / Lateral Thoracic Lymph Node Basin', pos: [0.175, 1.33, 0.015] },
    { id: 'lymph_inguinal_r', label: 'Right Superficial Inguinal Lymph Node Basin (SCIP/Groin VLNT)', pos: [-0.088, 0.90, 0.066] },
    { id: 'lymph_inguinal_l', label: 'Left Superficial Inguinal Lymph Node Basin (SCIP/Groin VLNT)', pos: [0.088, 0.90, 0.066] },
  ];

  for (const ln of lymphNodes) {
    // Cluster of 3 tiny nodes per basin
    const offsets: Array<[number, number, number]> = [
      [0, 0, 0],
      [0.012, -0.01, 0.005],
      [-0.01, 0.012, 0.004],
    ];
    offsets.forEach((off, idx) => {
      const nm = new THREE.Mesh(nodeGeo, lymphaticMat);
      nm.position.set(ln.pos[0] + off[0], ln.pos[1] + off[1], ln.pos[2] + off[2]);
      tagMesh(nm, `${ln.id}_${idx}`, ln.label, 'Lymphatics', 'lymphatics');
      layerGroups.lymphatics.add(nm);
      if (idx === 0) interactiveMeshes.push(nm);
    });
  }

  // Thoracic duct & bilateral lower/upper extremity lymphatic collectors
  const lymphPaths: Array<{ id: string; label: string; pts: Array<[number, number, number]> }> = [
    {
      id: 'lymph_thoracic_duct',
      label: 'Thoracic Duct & Cisterna Chyli',
      pts: [
        [-0.008, 1.02, -0.015],
        [-0.006, 1.22, -0.014],
        [0.028, 1.42, 0.012],
      ],
    },
    {
      id: 'lymph_collector_leg_r',
      label: 'Right Great Saphenous Lymphatic Collector',
      pts: [
        [-0.092, 0.14, 0.032],
        [-0.084, 0.48, 0.036],
        [-0.088, 0.89, 0.064],
      ],
    },
    {
      id: 'lymph_collector_arm_r',
      label: 'Right Upper Extremity Medial Lymphatic Collector',
      pts: [
        [-0.34, 0.90, 0.036],
        [-0.27, 1.14, 0.022],
        [-0.175, 1.33, 0.016],
      ],
    },
  ];
  for (const lp of lymphPaths) {
    const geo = createTubeFromPoints(lp.pts, 0.0028, 20, 6);
    const mesh = new THREE.Mesh(geo, lymphaticMat);
    tagMesh(mesh, lp.id, lp.label, 'Lymphatics', 'lymphatics');
    layerGroups.lymphatics.add(mesh);
    interactiveMeshes.push(mesh);
  }

  const updatePalette = (cbMode: boolean) => {
    const p = getAnatomyPalette(cbMode);
    skinMat.color.setHex(p.skin);
    fatMat.color.setHex(p.fat);
    fasciaMat.color.setHex(p.fascia);
    muscleMat.color.setHex(p.muscle);
    boneMat.color.setHex(p.bone);
    arteryMat.color.setHex(p.artery);
    veinMat.color.setHex(p.vein);
    nerveMat.color.setHex(p.nerve);
    lymphaticMat.color.setHex(p.lymphatic);
    landmarkMat.color.setHex(p.landmark);
    vesselMeshMap.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mesh.userData.anatomy_category === 'Nerve') {
        mat.color.setHex(p.nerve);
      } else {
        mat.color.setHex(p.artery);
      }
    });
  };

  const dispose = () => {
    bumpTex.dispose();
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  };

  return {
    root,
    layerGroups,
    interactiveMeshes,
    vesselMeshMap,
    updatePalette,
    dispose,
  };
}
