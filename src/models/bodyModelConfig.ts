/**
 * Modular 3D Anatomical Model Configuration.
 *
 * Swapping in a higher-resolution licensed medical GLB/GLTF model
 * (e.g. BodyParts3D / Z-Anatomy CC-BY-SA) requires setting `externalGlbUrl`
 * below to a hosted or `/public/models/...` GLB file whose mesh names match
 * `anatomy_id` conventions. When `externalGlbUrl` is null, FlapAtlas 3D
 * builds its sculpted multi-layer procedural human body model.
 */
export const BODY_MODEL_CONFIG = {
  externalGlbUrl: null as string | null,
  bodyHeightMeters: 1.75,
  bodyHeightCm: 175,
  groundY: 0,
};

export interface AnatomyPalette {
  skin: number;
  fat: number;
  fascia: number;
  muscle: number;
  muscleHighlight: number;
  bone: number;
  artery: number;
  arteryHighlight: number;
  vein: number;
  nerve: number;
  lymphatic: number;
  organs: number;
  other: number;
  perforator: number;
  perforasome: number;
  paddle: number;
  cuttingGuide: number;
  landmark: number;
  defect: number;
  arc: number;
}

export const STANDARD_CLINICAL_PALETTE: AnatomyPalette = {
  skin: 0xdab299,
  fat: 0xe6c86e,
  fascia: 0xd9e1e8,
  muscle: 0xa63c3c,
  muscleHighlight: 0xd64545,
  bone: 0xeae4d6,
  artery: 0xdc2626,
  arteryHighlight: 0xff4d4d,
  vein: 0x2563eb,
  nerve: 0xeab308,
  lymphatic: 0x16a34a,
  organs: 0xb06b73,
  other: 0x94a3b8,
  perforator: 0xf97316,
  perforasome: 0x06b6d4,
  paddle: 0x0f766e,
  cuttingGuide: 0x14b8a6,
  landmark: 0x0ea5e9,
  defect: 0xe11d48,
  arc: 0x0891b2,
};

/**
 * Okabe-Ito colorblind-safe anatomical vascular palette
 * (distinguishable across deuteranopia, protanopia, and tritanopia).
 */
export const COLORBLIND_SAFE_PALETTE: AnatomyPalette = {
  skin: 0xd9b8a3,
  fat: 0xe6d38a,
  fascia: 0xdbe2ea,
  muscle: 0x9c5a4a,
  muscleHighlight: 0xc2705a,
  bone: 0xece7dc,
  artery: 0xd55e00, // Vermilion
  arteryHighlight: 0xff7b1c,
  vein: 0x0072b2, // Strong blue
  nerve: 0xf0e442, // Bright yellow
  lymphatic: 0x009e73, // Bluish green
  organs: 0xaa6f88,
  other: 0x94a3b8,
  perforator: 0xcc79a7, // Reddish purple
  perforasome: 0x56b4e9, // Sky blue
  paddle: 0x009e73, // Bluish green
  cuttingGuide: 0x56b4e9, // Sky blue
  landmark: 0x56b4e9,
  defect: 0xcc79a7,
  arc: 0x56b4e9,
};

export function getAnatomyPalette(colorblindMode: boolean): AnatomyPalette {
  return colorblindMode ? COLORBLIND_SAFE_PALETTE : STANDARD_CLINICAL_PALETTE;
}
