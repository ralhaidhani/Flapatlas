import * as THREE from 'three';
import type { MergedSubMeshRecord } from './glbLoader';

/**
 * Per-sub-mesh visibility states encoded into a 1D RGBA DataTexture (width = subMeshCount, height = 1).
 * Updated in O(1) per sub-mesh with ZERO geometry or index buffer rebuilds.
 *
 * Texel layout (UnsignedByteType, NearestFilter):
 *   R: 255 = visible, 0 = hidden (discarded in fragment shader before lighting & territory shading)
 *   G: opacity multiplier byte (255 = 1.0 normal, 26 = ~0.10 ghosted, 48 = ~0.19 faint skeleton)
 *   B: reserved (0)
 *   A: 255
 */
export type SubMeshVisibilityMode = 'visible' | 'hidden' | 'ghost' | 'faint-skeleton';

export const GHOST_ALPHA_BYTE = 26; // ~10.2% opacity
export const FAINT_SKELETON_ALPHA_BYTE = 48; // ~18.8% opacity

export interface SubMeshVisibilityUniforms {
  uSubMeshVisTex: { value: THREE.DataTexture };
  uSubMeshVisCount: { value: number };
  uSubMeshVisEnabled: { value: number };
  uSubMeshVisUseDither: { value: number };
}

export interface SubMeshVisibilityController {
  mesh: THREE.Mesh;
  subMeshes: MergedSubMeshRecord[];
  texture: THREE.DataTexture;
  data: Uint8Array;
  count: number;
  uniforms: SubMeshVisibilityUniforms;
  /** True when every visible sub-mesh in this merged mesh is ghosted/faint (safe for smooth alpha blending). */
  allVisibleGhosted: boolean;
  /** True when at least one sub-mesh is hidden or ghosted. */
  hasOverride: boolean;
}

const PATCHED_VIS_MATERIALS = new WeakSet<THREE.Material>();

const BAYER_GLSL = `
uniform sampler2D uSubMeshVisTex;
uniform float uSubMeshVisCount;
uniform float uSubMeshVisEnabled;
uniform float uSubMeshVisUseDither;
varying float vSubMeshVisIdx;
float flapatlasVisBayer4(vec2 p) {
  vec2 f = mod(floor(p), 4.0);
  int idx = int(f.y) * 4 + int(f.x);
  if (idx == 0) return 0.0 / 16.0;
  if (idx == 1) return 8.0 / 16.0;
  if (idx == 2) return 2.0 / 16.0;
  if (idx == 3) return 10.0 / 16.0;
  if (idx == 4) return 12.0 / 16.0;
  if (idx == 5) return 4.0 / 16.0;
  if (idx == 6) return 14.0 / 16.0;
  if (idx == 7) return 6.0 / 16.0;
  if (idx == 8) return 3.0 / 16.0;
  if (idx == 9) return 11.0 / 16.0;
  if (idx == 10) return 1.0 / 16.0;
  if (idx == 11) return 9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return 7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}
`;

/**
 * Attach an O(1) DataTexture-driven visibility & ghosting shader to a merged system mesh
 * that carries per-vertex `aMeshIndex`. Composes cleanly with `territoryShader.ts`.
 */
export function attachSubMeshVisibilityShader(
  mesh: THREE.Mesh
): SubMeshVisibilityController | null {
  const subMeshes = mesh.userData?.subMeshes as MergedSubMeshRecord[] | undefined;
  if (!mesh.userData?.isMergedSystemMesh || !Array.isArray(subMeshes) || subMeshes.length === 0) {
    return null;
  }
  if (!mesh.geometry.getAttribute('aMeshIndex')) {
    return null;
  }

  const existing = mesh.userData?.subMeshVisibilityController as
    | SubMeshVisibilityController
    | undefined;
  if (existing && existing.count === subMeshes.length) {
    return existing;
  }

  const mat = mesh.material;
  if (!(mat instanceof THREE.MeshStandardMaterial)) {
    return null;
  }

  const count = subMeshes.length;
  const data = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    const off = i * 4;
    data[off] = 255; // visible
    data[off + 1] = 255; // normal opacity
    data[off + 2] = 0;
    data[off + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, count, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  const uniforms: SubMeshVisibilityUniforms = {
    uSubMeshVisTex: { value: texture },
    uSubMeshVisCount: { value: count },
    uSubMeshVisEnabled: { value: 0 },
    uSubMeshVisUseDither: { value: 0 },
  };

  if (!PATCHED_VIS_MATERIALS.has(mat)) {
    PATCHED_VIS_MATERIALS.add(mat);
    const uniformsRef = { current: uniforms };
    mat.userData.subMeshVisUniformsRef = uniformsRef;

    const prevBeforeCompile = mat.onBeforeCompile;
    const prevCacheKey =
      typeof mat.customProgramCacheKey === 'function'
        ? mat.customProgramCacheKey.bind(mat)
        : () => '';

    mat.customProgramCacheKey = () => {
      const base = prevCacheKey();
      return base ? `${base}|flapatlas-submesh-vis-v1` : 'flapatlas-submesh-vis-v1';
    };

    mat.onBeforeCompile = (shader, renderer) => {
      if (typeof prevBeforeCompile === 'function') {
        prevBeforeCompile(shader, renderer);
      }

      const u = uniformsRef.current;
      shader.uniforms.uSubMeshVisTex = u.uSubMeshVisTex;
      shader.uniforms.uSubMeshVisCount = u.uSubMeshVisCount;
      shader.uniforms.uSubMeshVisEnabled = u.uSubMeshVisEnabled;
      shader.uniforms.uSubMeshVisUseDither = u.uSubMeshVisUseDither;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
attribute float aMeshIndex;
varying float vSubMeshVisIdx;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vSubMeshVisIdx = aMeshIndex;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${BAYER_GLSL}`)
        .replace(
          '#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>
float subMeshVisAlpha = 1.0;
if (uSubMeshVisEnabled > 0.5) {
  float visIdx = floor(vSubMeshVisIdx + 0.5);
  float visU = (visIdx + 0.5) / max(1.0, uSubMeshVisCount);
  vec4 visState = texture2D(uSubMeshVisTex, vec2(visU, 0.5));
  if (visState.r < 0.5) {
    discard;
  }
  subMeshVisAlpha = visState.g;
  if (subMeshVisAlpha < 0.95 && uSubMeshVisUseDither > 0.5) {
    if (flapatlasVisBayer4(gl_FragCoord.xy) >= max(0.06, subMeshVisAlpha)) {
      discard;
    }
  }
}`
        )
        .replace(
          '#include <dithering_fragment>',
          `if (uSubMeshVisEnabled > 0.5 && subMeshVisAlpha < 0.95) {
  float visLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(visLum * 1.12), 0.42);
  if (uSubMeshVisUseDither < 0.5) {
    gl_FragColor.a *= subMeshVisAlpha;
  }
}
#include <dithering_fragment>`
        );
    };

    mat.needsUpdate = true;
  } else {
    const uniformsRef = mat.userData.subMeshVisUniformsRef as
      | { current: SubMeshVisibilityUniforms }
      | undefined;
    if (uniformsRef) {
      uniformsRef.current = uniforms;
    }
  }

  const controller: SubMeshVisibilityController = {
    mesh,
    subMeshes,
    texture,
    data,
    count,
    uniforms,
    allVisibleGhosted: false,
    hasOverride: false,
  };
  mesh.userData.subMeshVisibilityController = controller;
  return controller;
}

/**
 * Write one sub-mesh texel in O(1) time without touching geometry buffers.
 */
export function setSingleSubMeshVisibilityTexel(
  controller: SubMeshVisibilityController,
  subMeshIndex: number,
  mode: SubMeshVisibilityMode
): void {
  if (subMeshIndex < 0 || subMeshIndex >= controller.count) return;
  const off = subMeshIndex * 4;
  if (mode === 'hidden') {
    controller.data[off] = 0;
    controller.data[off + 1] = 0;
  } else if (mode === 'ghost') {
    controller.data[off] = 255;
    controller.data[off + 1] = GHOST_ALPHA_BYTE;
  } else if (mode === 'faint-skeleton') {
    controller.data[off] = 255;
    controller.data[off + 1] = FAINT_SKELETON_ALPHA_BYTE;
  } else {
    controller.data[off] = 255;
    controller.data[off + 1] = 255;
  }
  controller.data[off + 2] = 0;
  controller.data[off + 3] = 255;
}

export interface SubMeshVisibilityUpdateSummary {
  hiddenCount: number;
  ghostCount: number;
  opaqueCount: number;
  allVisibleGhosted: boolean;
  hasOverride: boolean;
}

/**
 * Refresh the DataTexture for a merged mesh in a tight byte-array pass (zero geometry rebuild).
 * Automatically chooses smooth alpha blending when all visible sub-meshes in this mesh are ghosted,
 * and ordered Bayer screen-door ghosting when opaque and ghosted sub-meshes coexist in the same draw call.
 */
export function updateSubMeshVisibilityBuffer(
  controller: SubMeshVisibilityController,
  resolveMode: (record: MergedSubMeshRecord) => SubMeshVisibilityMode
): SubMeshVisibilityUpdateSummary {
  let hiddenCount = 0;
  let ghostCount = 0;
  let opaqueCount = 0;
  let changed = false;

  const { data, subMeshes } = controller;
  for (let i = 0; i < subMeshes.length; i++) {
    const rec = subMeshes[i];
    const mode = resolveMode(rec);
    let r = 255;
    let g = 255;
    if (mode === 'hidden') {
      r = 0;
      g = 0;
      hiddenCount += 1;
    } else if (mode === 'ghost') {
      r = 255;
      g = GHOST_ALPHA_BYTE;
      ghostCount += 1;
    } else if (mode === 'faint-skeleton') {
      r = 255;
      g = FAINT_SKELETON_ALPHA_BYTE;
      ghostCount += 1;
    } else {
      opaqueCount += 1;
    }

    const off = i * 4;
    if (data[off] !== r || data[off + 1] !== g) {
      data[off] = r;
      data[off + 1] = g;
      changed = true;
    }
  }

  const hasOverride = hiddenCount > 0 || ghostCount > 0;
  const allVisibleGhosted = ghostCount > 0 && opaqueCount === 0;
  const useDither = ghostCount > 0 && opaqueCount > 0;

  controller.hasOverride = hasOverride;
  controller.allVisibleGhosted = allVisibleGhosted;
  controller.uniforms.uSubMeshVisEnabled.value = hasOverride ? 1 : 0;
  controller.uniforms.uSubMeshVisUseDither.value = useDither ? 1 : 0;

  if (changed) {
    controller.texture.needsUpdate = true;
  }

  return {
    hiddenCount,
    ghostCount,
    opaqueCount,
    allVisibleGhosted,
    hasOverride,
  };
}

export function disposeSubMeshVisibilityController(
  controller: SubMeshVisibilityController
): void {
  controller.texture.dispose();
  if (controller.mesh.userData?.subMeshVisibilityController === controller) {
    delete controller.mesh.userData.subMeshVisibilityController;
  }
}
