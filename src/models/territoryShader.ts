import * as THREE from 'three';
import {
  sampleTerritoryFieldAtWorldPos,
  type TerritoryFieldData,
} from './territoryFieldCore';
import {
  createTerritoryPaletteLutTexture,
  LUT_WIDTH,
  TERRITORY_SLOT_BY_INDEX,
  updateTerritoryPaletteLutTexture,
} from './territoryPalette';

/**
 * Phase 11b (§3.3) — WebGL2 Data3DTexture + PBR Shader Overlay + Non-WebGL2 Fallback.
 *
 * Key invariants:
 * - When `uTerritoryEnabled.value === 0`, the patched MeshStandardMaterial executes zero
 *   color modifications, guaranteeing 100% identical rendering to Phase 10.
 * - Uses Three.js native PBR lighting, roughness, shadows, and clippingPlanes automatically,
 *   so sagittal/coronal/axial cross-sections show skin→muscle→bone territory layers seamlessly.
 * - When WebGL2 / Data3DTexture is unavailable, builds a graceful subdivided per-vertex
 *   color overlay mesh from `sampleTerritoryFieldAtWorldPos()`.
 */

export type TerritoryShaderTissueKind = 'skin' | 'muscle' | 'bone';

export interface TerritoryShaderUniforms {
  uTerritoryEnabled: { value: number };
  /** 0 = Angiosomes, 1 = Venosomes (blue family + hatched), 2 = Choke & Delay */
  uTerritoryMode: { value: number };
  uTerritoryOpacity: { value: number };
  uFieldTex: { value: THREE.Data3DTexture };
  uPaletteLut: { value: THREE.DataTexture };
  uFieldBoundsMin: { value: THREE.Vector3 };
  uFieldBoundsInvSize: { value: THREE.Vector3 };
  /** 0 = Both, 1 = Right only, 2 = Left only */
  uSideFilter: { value: number };
  /** 0 = None focused, 1..63 = Focused territory slotId */
  uFocusedSlot: { value: number };
  /** 0 = Off, 1 = Highlight adjacent neighbors of focused territory at 35% */
  uShowNeighbors: { value: number };
  /** 3×22-bit float bitmasks (covers slots 0..65 without signed 32-bit int quirks) */
  uNeighborMask0: { value: number };
  uNeighborMask1: { value: number };
  uNeighborMask2: { value: number };
  /** Choke vessel / delay width multiplier (1.0 = baseline 0h, >1.0 = widened after delay) */
  uDelayScale: { value: number };
  /** Computed boundary outline emphasis (0..1) */
  uOutlineStrength: { value: number };
  uTime: { value: number };
}

export interface TerritoryGpuResources {
  fieldTexture: THREE.Data3DTexture;
  paletteLut: THREE.DataTexture;
  uniforms: TerritoryShaderUniforms;
  fallbackMesh: THREE.Mesh | null;
}

const PATCHED_MATERIALS = new WeakSet<THREE.Material>();

/**
 * Uploads the baked RGBA8 voxel array to a WebGL2 `THREE.Data3DTexture`.
 */
export function createTerritoryFieldTexture(field: TerritoryFieldData): THREE.Data3DTexture {
  const [nx, ny, nz] = field.dims;
  const tex = new THREE.Data3DTexture(field.voxels, nx, ny, nz);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.wrapR = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

export function createTerritoryShaderResources(
  field: TerritoryFieldData,
  colorblindMode: boolean
): TerritoryGpuResources {
  const fieldTexture = createTerritoryFieldTexture(field);
  const paletteLut = createTerritoryPaletteLutTexture(colorblindMode);

  const invSize = new THREE.Vector3(
    1 / Math.max(1e-5, field.boundsMax[0] - field.boundsMin[0]),
    1 / Math.max(1e-5, field.boundsMax[1] - field.boundsMin[1]),
    1 / Math.max(1e-5, field.boundsMax[2] - field.boundsMin[2])
  );

  const uniforms: TerritoryShaderUniforms = {
    uTerritoryEnabled: { value: 0 },
    uTerritoryMode: { value: 0 },
    uTerritoryOpacity: { value: 0.65 },
    uFieldTex: { value: fieldTexture },
    uPaletteLut: { value: paletteLut },
    uFieldBoundsMin: {
      value: new THREE.Vector3(field.boundsMin[0], field.boundsMin[1], field.boundsMin[2]),
    },
    uFieldBoundsInvSize: { value: invSize },
    uSideFilter: { value: 0 },
    uFocusedSlot: { value: 0 },
    uShowNeighbors: { value: 0 },
    uNeighborMask0: { value: 0 },
    uNeighborMask1: { value: 0 },
    uNeighborMask2: { value: 0 },
    uDelayScale: { value: 1.0 },
    uOutlineStrength: { value: 0.85 },
    uTime: { value: 0 },
  };

  return {
    fieldTexture,
    paletteLut,
    uniforms,
    fallbackMesh: null,
  };
}

/**
 * Encodes an array of adjacent slotIds (1..63) into the 3×22-bit float bitmask uniforms.
 */
export function setNeighborBitmaskUniforms(
  uniforms: TerritoryShaderUniforms,
  neighborSlots: readonly number[]
): void {
  let m0 = 0;
  let m1 = 0;
  let m2 = 0;
  for (const slot of neighborSlots) {
    if (slot < 1 || slot >= 66) continue;
    if (slot < 22) m0 += Math.pow(2, slot);
    else if (slot < 44) m1 += Math.pow(2, slot - 22);
    else m2 += Math.pow(2, slot - 44);
  }
  uniforms.uNeighborMask0.value = m0;
  uniforms.uNeighborMask1.value = m1;
  uniforms.uNeighborMask2.value = m2;
}

export function syncTerritoryPaletteColorblind(
  resources: TerritoryGpuResources,
  colorblindMode: boolean
): void {
  updateTerritoryPaletteLutTexture(resources.paletteLut, colorblindMode);
}

/**
 * Patches a `MeshStandardMaterial` in-place via `onBeforeCompile` so it samples the
 * shared 3-D vascular territory field in world space when `uTerritoryEnabled > 0.5`.
 *
 * Strictly WebGL2-only (uses `sampler3D`). Idempotent per material instance.
 */
export function patchMaterialWithTerritoryField(
  material: THREE.MeshStandardMaterial,
  uniforms: TerritoryShaderUniforms,
  tissueKind: TerritoryShaderTissueKind
): boolean {
  if (PATCHED_MATERIALS.has(material)) {
    // Rebind live uniform container if the field was rebuilt
    const existing = material.userData.territoryUniformsRef as
      | { current: TerritoryShaderUniforms }
      | undefined;
    if (existing) {
      existing.current = uniforms;
      // Also update bound shader uniforms if already compiled
      const compiled = material.userData.territoryCompiledUniforms as
        | Record<string, { value: unknown }>
        | undefined;
      if (compiled) {
        for (const [k, u] of Object.entries(uniforms)) {
          compiled[k] = u as { value: unknown };
        }
      }
    }
    return false;
  }

  PATCHED_MATERIALS.add(material);
  const uniformsRef = { current: uniforms };
  material.userData.territoryUniformsRef = uniformsRef;

  const prevBeforeCompile = material.onBeforeCompile;
  const prevCacheKey =
    typeof material.customProgramCacheKey === 'function'
      ? material.customProgramCacheKey.bind(material)
      : () => '';
  const lutWidthStr = `${LUT_WIDTH}.0`;
  const tissueTintScale = tissueKind === 'skin' ? '1.0' : tissueKind === 'muscle' ? '0.82' : '0.70';

  material.customProgramCacheKey = () => {
    const base = prevCacheKey();
    const own = `flapatlas-territory-pbr-v1-${tissueKind}`;
    return base ? `${base}|${own}` : own;
  };

  material.onBeforeCompile = (shader, renderer) => {
    if (typeof prevBeforeCompile === 'function') {
      prevBeforeCompile(shader, renderer);
    }

    const u = uniformsRef.current;
    shader.uniforms.uTerritoryEnabled = u.uTerritoryEnabled;
    shader.uniforms.uTerritoryMode = u.uTerritoryMode;
    shader.uniforms.uTerritoryOpacity = u.uTerritoryOpacity;
    shader.uniforms.uFieldTex = u.uFieldTex;
    shader.uniforms.uPaletteLut = u.uPaletteLut;
    shader.uniforms.uFieldBoundsMin = u.uFieldBoundsMin;
    shader.uniforms.uFieldBoundsInvSize = u.uFieldBoundsInvSize;
    shader.uniforms.uSideFilter = u.uSideFilter;
    shader.uniforms.uFocusedSlot = u.uFocusedSlot;
    shader.uniforms.uShowNeighbors = u.uShowNeighbors;
    shader.uniforms.uNeighborMask0 = u.uNeighborMask0;
    shader.uniforms.uNeighborMask1 = u.uNeighborMask1;
    shader.uniforms.uNeighborMask2 = u.uNeighborMask2;
    shader.uniforms.uDelayScale = u.uDelayScale;
    shader.uniforms.uOutlineStrength = u.uOutlineStrength;
    shader.uniforms.uTime = u.uTime;
    material.userData.territoryCompiledUniforms = shader.uniforms;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vTerritoryWorldPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vTerritoryWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vTerritoryWorldPos;
uniform float uTerritoryEnabled;
uniform float uTerritoryMode;
uniform float uTerritoryOpacity;
uniform highp sampler3D uFieldTex;
uniform sampler2D uPaletteLut;
uniform vec3 uFieldBoundsMin;
uniform vec3 uFieldBoundsInvSize;
uniform float uSideFilter;
uniform float uFocusedSlot;
uniform float uShowNeighbors;
uniform float uNeighborMask0;
uniform float uNeighborMask1;
uniform float uNeighborMask2;
uniform float uDelayScale;
uniform float uOutlineStrength;
uniform float uTime;

bool territoryBitTest(float maskVal, float bitIndex) {
  return mod(floor(maskVal / exp2(bitIndex)), 2.0) >= 0.5;
}

bool isTerritoryNeighbor(float slotId) {
  if (slotId < 0.5 || slotId >= 65.5) return false;
  if (slotId < 22.0) return territoryBitTest(uNeighborMask0, slotId);
  if (slotId < 44.0) return territoryBitTest(uNeighborMask1, slotId - 22.0);
  return territoryBitTest(uNeighborMask2, slotId - 44.0);
}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
if (uTerritoryEnabled > 0.5) {
  vec3 tUvw = (vTerritoryWorldPos - uFieldBoundsMin) * uFieldBoundsInvSize;
  if (all(greaterThanEqual(tUvw, vec3(0.0))) && all(lessThanEqual(tUvw, vec3(1.0)))) {
    vec4 tSample = texture(uFieldTex, tUvw);
    float tSlot = floor(tSample.r * 255.0 + 0.5);
    float tBoundary = tSample.b;
    int tFlags = int(floor(tSample.a * 255.0 + 0.5));
    bool tInside = ((tFlags & 1) != 0) && (tSlot > 0.5);
    bool tSchematic = (tFlags & 4) != 0;
    bool tRight = (tFlags & 8) != 0;
    bool tLeft = (tFlags & 16) != 0;

    bool tSidePass = true;
    if (uSideFilter > 0.5 && uSideFilter < 1.5 && !tRight) tSidePass = false;
    if (uSideFilter > 1.5 && !tLeft) tSidePass = false;

    if (tInside && tSidePass) {
      float lutU = (tSlot + 0.5) / ${lutWidthStr};
      float lutV = (uTerritoryMode > 0.5 && uTerritoryMode < 1.5) ? 0.75 : 0.25;
      vec3 tColor = texture2D(uPaletteLut, vec2(lutU, lutV)).rgb;

      // World-space diagonal hatch for schematic-seeded territories & venosome mode
      float hatchCoord = (vTerritoryWorldPos.x + vTerritoryWorldPos.y + vTerritoryWorldPos.z) * 140.0;
      float hatchWave = smoothstep(0.65, 0.92, abs(sin(hatchCoord)));
      if (tSchematic) {
        tColor = mix(tColor, tColor * 0.72 + vec3(0.14), hatchWave * 0.45);
      } else if (uTerritoryMode > 0.5 && uTerritoryMode < 1.5) {
        tColor = mix(tColor, tColor * 0.80 + vec3(0.08, 0.14, 0.22), hatchWave * 0.35);
      }

      // Computed boundary outline from distance channel B
      float outlineBand = 1.0 - smoothstep(0.04, 0.16, tBoundary);
      vec3 outlineCol = vec3(0.06, 0.08, 0.12);

      // Choke & Delay mode (uTerritoryMode >= 1.5): animated dotted choke band widening with delay
      if (uTerritoryMode > 1.5) {
        float chokeWidth = clamp(0.14 * uDelayScale, 0.08, 0.48);
        float chokeMask = 1.0 - smoothstep(chokeWidth * 0.55, chokeWidth, tBoundary);
        float dashPhase = sin((vTerritoryWorldPos.y * 190.0 + vTerritoryWorldPos.x * 130.0) - uTime * 2.5);
        float dashMask = smoothstep(-0.1, 0.25, dashPhase);
        vec3 chokeCol = mix(vec3(0.95, 0.62, 0.12), vec3(0.96, 0.24, 0.24), clamp((uDelayScale - 1.0) * 0.65, 0.0, 1.0));
        tColor = mix(tColor, chokeCol, chokeMask * (0.45 + 0.5 * dashMask));
      } else {
        tColor = mix(tColor, outlineCol, outlineBand * 0.58 * uOutlineStrength);
      }

      float blendAlpha = clamp(uTerritoryOpacity * ${tissueTintScale}, 0.0, 0.95);

      // Focus & adjacent-neighbor emphasis
      if (uFocusedSlot > 0.5) {
        bool isFocused = abs(tSlot - uFocusedSlot) < 0.5;
        bool isNeighbor = (uShowNeighbors > 0.5) && isTerritoryNeighbor(tSlot);
        if (isFocused) {
          tColor = mix(tColor, vec3(1.0), 0.12);
          blendAlpha = clamp(uTerritoryOpacity * 1.15, 0.0, 0.96);
        } else if (isNeighbor) {
          blendAlpha = clamp(uTerritoryOpacity * 0.42, 0.0, 0.65);
        } else {
          float luma = dot(tColor, vec3(0.299, 0.587, 0.114));
          tColor = mix(tColor, vec3(luma), 0.78);
          blendAlpha *= 0.28;
        }
      }

      diffuseColor.rgb = mix(diffuseColor.rgb, tColor, blendAlpha);
    }
  }
}`
      );
  };

  material.needsUpdate = true;
  return true;
}

/**
 * Non-WebGL2 graceful fallback (§3.3): builds a per-vertex colored copy of the skin mesh
 * sampled directly from `sampleTerritoryFieldAtWorldPos()` so territories remain inspectable
 * even on WebGL1 / constrained GPUs that lack `Data3DTexture`.
 */
export function buildVertexColorTerritoryFallbackMesh(
  sourceSkinMesh: THREE.Mesh,
  field: TerritoryFieldData,
  colorblindMode: boolean,
  opacity = 0.6
): THREE.Mesh {
  const geom = sourceSkinMesh.geometry.clone();
  const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);
  const worldPos = new THREE.Vector3();

  sourceSkinMesh.updateMatrixWorld(true);

  for (let i = 0; i < posAttr.count; i++) {
    worldPos.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    worldPos.applyMatrix4(sourceSkinMesh.matrixWorld);
    const sample = sampleTerritoryFieldAtWorldPos(field, [worldPos.x, worldPos.y, worldPos.z]);
    const entry = sample.inside ? TERRITORY_SLOT_BY_INDEX.get(sample.primarySlot) : undefined;
    if (entry) {
      const rgb = colorblindMode ? entry.rgbColorblind : entry.rgbStandard;
      // Darken slightly along boundary voxels
      const borderDim = sample.boundaryDistanceNormalized < 0.12 ? 0.68 : 1.0;
      colors[i * 3] = rgb[0] * borderDim;
      colors[i * 3 + 1] = rgb[1] * borderDim;
      colors[i * 3 + 2] = rgb[2] * borderDim;
    } else {
      colors[i * 3] = 0.76;
      colors[i * 3 + 1] = 0.78;
      colors[i * 3 + 2] = 0.82;
    }
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.02,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'territory-fallback-skin-overlay';
  mesh.visible = false;
  mesh.renderOrder = 4;
  return mesh;
}

export function disposeTerritoryGpuResources(resources: TerritoryGpuResources | null): void {
  if (!resources) return;
  resources.fieldTexture.dispose();
  resources.paletteLut.dispose();
  if (resources.fallbackMesh) {
    resources.fallbackMesh.geometry.dispose();
    if (Array.isArray(resources.fallbackMesh.material)) {
      resources.fallbackMesh.material.forEach((m) => m.dispose());
    } else {
      resources.fallbackMesh.material.dispose();
    }
  }
}
