import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_ANGIOSOMES } from '../data/territories/index';
import { INITIAL_FLAPS } from '../data/index';
import { auditFlapDataset } from '../types/schemas';
import {
  buildPerforasomeJigsawTiles,
  buildSkinSurfaceSpatialGrid,
  classifyCorridorZoomTier,
  CORRIDOR_SCHEMATIC_TAG,
  extractArteryCentrelinePoints,
  filterCorridorDotsForView,
  getCorridorSpecForTerritory,
  getRealSourceArteryCorridorSpecs,
  isRealCorridorTerritory,
  PERFORASOME_DECORATIVE_RADIUS_M,
  PERFORASOME_SCHEMATIC_TAG,
  projectCentrelineOntoSkin,
  type CorridorDotInstance,
} from '../models/perforatorCorridors';
import {
  buildCombinedAuditCsv,
  clearStoredDopplerPlannerMarkers,
  createDopplerPlannerMarker,
  DOPPLER_PLANNER_NOTICE,
  loadDopplerPlannerMarkers,
  saveDopplerPlannerMarkers,
  serializeDopplerMarkersCsv,
} from '../models/dopplerPlanner';
import { useAtlasStore } from '../store/useAtlasStore';

describe('Phase 11e — Real-Artery Perforator Corridors', () => {
  it('excludes all 12 absent/schematic-only angiosomes and never invents corridors for them', () => {
    const specs = getRealSourceArteryCorridorSpecs();
    assert.ok(specs.length >= 20, `expected >= 20 real-artery corridor specs, got ${specs.length}`);

    const absentAngiosomes = BODY_ANGIOSOMES.filter((a) => a.bp3dCoverage === 'none');
    assert.equal(absentAngiosomes.length, 12, 'expected 12 absent/schematic-only body angiosomes');

    const specIds = new Set(specs.map((s) => s.territoryId));
    for (const absent of absentAngiosomes) {
      assert.equal(
        specIds.has(absent.id),
        false,
        `absent territory ${absent.id} (${absent.name}) must NOT appear in real corridor specs`
      );
      assert.equal(
        isRealCorridorTerritory(absent.id),
        false,
        `isRealCorridorTerritory(${absent.id}) must be false`
      );
      assert.equal(
        getCorridorSpecForTerritory(absent.id),
        null,
        `getCorridorSpecForTerritory(${absent.id}) must be null`
      );
    }

    // Peroneal artery (angio-24) is absent in BP3D -> no corridor drawn
    assert.equal(isRealCorridorTerritory('angio-24'), false);
    assert.equal(getCorridorSpecForTerritory('angio-24'), null);

    // Every included spec must have real BP3D coverage ('full' or 'partial')
    for (const s of specs) {
      assert.ok(
        s.bp3dCoverage === 'full' || s.bp3dCoverage === 'partial',
        `spec ${s.territoryId} must have real BP3D coverage`
      );
      assert.equal(isRealCorridorTerritory(s.territoryId), true);
    }

    // Shared femoral mesh (31 & 32): angio-32 resolves to angio-31 without duplicate entries
    assert.equal(specIds.has('angio-31'), true);
    assert.equal(specIds.has('angio-32'), false);
    assert.equal(getCorridorSpecForTerritory('angio-32')?.territoryId, 'angio-31');
  });

  it('encodes Ch. 23 proximal vs distal emphasis and linear forearm / leg septal lines', () => {
    const diea = getCorridorSpecForTerritory('angio-34');
    const lcfa = getCorridorSpecForTerritory('angio-27');
    const radial = getCorridorSpecForTerritory('angio-16');
    const ulnar = getCorridorSpecForTerritory('angio-15');
    const ata = getCorridorSpecForTerritory('angio-26');
    const pta = getCorridorSpecForTerritory('angio-30');

    assert.ok(diea && lcfa && radial && ulnar && ata && pta);

    // Proximal (torso/thigh) = larger & fewer (wider spacing); Distal (forearm/leg) = smaller & more numerous
    assert.equal(diea.densityTier, 'proximal');
    assert.equal(lcfa.densityTier, 'proximal');
    assert.equal(radial.densityTier, 'distal');
    assert.equal(ulnar.densityTier, 'distal');
    assert.equal(ata.densityTier, 'distal');
    assert.equal(pta.densityTier, 'distal');

    assert.ok(diea.dotRadiusMeters > radial.dotRadiusMeters);
    assert.ok(diea.dotSpacingMeters > radial.dotSpacingMeters);
    assert.ok(lcfa.dotRadiusMeters > ata.dotRadiusMeters);
    assert.ok(lcfa.dotSpacingMeters > ata.dotSpacingMeters);

    assert.match(radial.emphasisLabel, /radial/i);
    assert.match(ulnar.emphasisLabel, /ulnar/i);
    assert.match(ata.emphasisLabel, /anterior leg septal/i);
    assert.match(pta.emphasisLabel, /medial-posterior leg septal/i);

    assert.equal(
      CORRIDOR_SCHEMATIC_TAG,
      'Expected perforator zone — schematic; individual perforators vary'
    );
    assert.equal(PERFORASOME_SCHEMATIC_TAG, 'Schematic extent — not a measurement');
  });

  it('extracts ordered artery centreline points and projects them cleanly onto nearest outward skin surface', () => {
    // Synthetic artery running along Y from 0.20 m to 0.40 m at x = 0.05, z = 0.04 (2 cm deep to skin at z = 0.06)
    const arteryCoords: number[] = [];
    for (let i = 0; i <= 40; i++) {
      const y = 0.2 + (i / 40) * 0.2;
      for (let a = 0; a < 4; a++) {
        const ang = (a / 4) * Math.PI * 2;
        arteryCoords.push(0.05 + Math.cos(ang) * 0.002, y, 0.04 + Math.sin(ang) * 0.002);
      }
    }

    const centreline = extractArteryCentrelinePoints(arteryCoords, 0.02, 24);
    assert.ok(centreline.length >= 8 && centreline.length <= 15, `got ${centreline.length} pts`);
    for (const pt of centreline) {
      assert.ok(Math.abs(pt[0] - 0.05) < 0.003);
      assert.ok(Math.abs(pt[2] - 0.04) < 0.003);
    }

    // Synthetic flat anterior skin surface at z = 0.06 with outward normal [0, 0, 1]
    const skinPos: number[] = [];
    const skinNorm: number[] = [];
    for (let ix = 0; ix <= 10; ix++) {
      for (let iy = 0; iy <= 24; iy++) {
        skinPos.push(0.0 + ix * 0.01, 0.15 + iy * 0.012, 0.06);
        skinNorm.push(0, 0, 1);
      }
    }
    const skinGrid = buildSkinSurfaceSpatialGrid(
      new Float32Array(skinPos),
      new Float32Array(skinNorm),
      0.025
    );

    const projected = projectCentrelineOntoSkin(centreline, skinGrid, {
      maxProjectionDistanceMeters: 0.08,
      minDotSpacingMeters: 0.02,
      normalOffsetMeters: 0.003,
    });

    assert.ok(projected.length >= 6, `expected >= 6 projected skin dots, got ${projected.length}`);
    for (const p of projected) {
      assert.ok(Math.abs(p.position[2] - 0.063) < 0.002, 'dot should sit just outside skin z=0.06');
      assert.ok(p.normal[2] > 0.95, 'normal should point outward (+Z)');
    }
  });

  it('clusters and hides corridors cleanly at far zoom while preserving focused corridors', () => {
    assert.equal(classifyCorridorZoomTier(0.9), 'close');
    assert.equal(classifyCorridorZoomTier(1.8), 'medium');
    assert.equal(classifyCorridorZoomTier(2.8), 'clustered_far');
    assert.equal(classifyCorridorZoomTier(4.0), 'hidden_far');

    const dots: CorridorDotInstance[] = [];
    for (let i = 0; i < 12; i++) {
      dots.push({
        territoryId: 'angio-34',
        slotId: 34,
        side: i % 2 === 0 ? 'right' : 'left',
        position: [0.04, 1.0 + i * 0.02, 0.1],
        normal: [0, 0, 1],
        radiusMeters: 0.0056,
        densityTier: 'proximal',
        orderIndex: i,
      });
      dots.push({
        territoryId: 'angio-16',
        slotId: 16,
        side: 'right',
        position: [-0.25, 0.9 + i * 0.01, 0.05],
        normal: [0, 0, 1],
        radiusMeters: 0.0033,
        densityTier: 'distal',
        orderIndex: i,
      });
    }

    const closeRes = filterCorridorDotsForView(dots, {
      sideFilter: 'both',
      focusedTerritoryId: null,
      cameraDistanceMeters: 1.0,
    });
    assert.equal(closeRes.zoomTier, 'close');
    assert.equal(closeRes.visibleDots.length, 24);

    const medRes = filterCorridorDotsForView(dots, {
      sideFilter: 'both',
      focusedTerritoryId: null,
      cameraDistanceMeters: 1.9,
    });
    assert.equal(medRes.zoomTier, 'medium');
    assert.equal(medRes.visibleDots.length, 18); // 12 proximal + 6 thinned distal

    const farRes = filterCorridorDotsForView(dots, {
      sideFilter: 'both',
      focusedTerritoryId: null,
      cameraDistanceMeters: 2.9,
    });
    assert.equal(farRes.zoomTier, 'clustered_far');
    assert.equal(
      farRes.visibleDots.every((d) => d.densityTier === 'proximal'),
      true
    );
    assert.equal(farRes.visibleDots.length, 4); // every 3rd proximal dot

    const hiddenRes = filterCorridorDotsForView(dots, {
      sideFilter: 'both',
      focusedTerritoryId: null,
      cameraDistanceMeters: 4.1,
    });
    assert.equal(hiddenRes.zoomTier, 'hidden_far');
    assert.equal(hiddenRes.visibleDots.length, 0);

    // Focusing a distal territory shows all its dots even at far zoom
    const focusedFar = filterCorridorDotsForView(dots, {
      sideFilter: 'both',
      focusedTerritoryId: 'angio-16',
      cameraDistanceMeters: 4.1,
    });
    assert.equal(focusedFar.visibleDots.length, 12);
    assert.equal(
      focusedFar.visibleDots.every((d) => d.territoryId === 'angio-16'),
      true
    );

    // Side filter isolates right side cleanly
    const rightOnly = filterCorridorDotsForView(dots, {
      sideFilter: 'right',
      focusedTerritoryId: null,
      cameraDistanceMeters: 1.0,
    });
    assert.equal(
      rightOnly.visibleDots.every((d) => d.side === 'right'),
      true
    );
  });
});

describe('Phase 11e — Selected Flap Perforasome Concept (Fig. 23.25)', () => {
  it('builds non-overlapping Voronoi jigsaw tiles using a decorative constant radius independent of flap dimensions', () => {
    const perforators = [
      { id: 'p1', label: 'P1', position: [0.02, 1.0, 0.1] as [number, number, number] },
      { id: 'p2', label: 'P2', position: [0.06, 1.0, 0.1] as [number, number, number] },
      { id: 'p3', label: 'P3', position: [0.04, 1.035, 0.1] as [number, number, number] },
    ];

    const tiles = buildPerforasomeJigsawTiles(
      perforators,
      [0, 0, 1],
      null,
      PERFORASOME_DECORATIVE_RADIUS_M
    );
    assert.equal(tiles.length, 3);

    // Tile 1 (center x=0.02) must be clipped strictly to the left of the bisector x=0.04 (minus seam)
    for (const pt of tiles[0].outlinePoints) {
      assert.ok(
        pt[0] <= 0.04,
        `tile 0 vertex x=${pt[0].toFixed(4)} should not cross bisector at x=0.04`
      );
      const distFromCenter = Math.hypot(pt[0] - 0.02, pt[1] - 1.0);
      assert.ok(
        distFromCenter <= PERFORASOME_DECORATIVE_RADIUS_M + 0.002,
        `tile radius ${distFromCenter} must respect decorative constant ${PERFORASOME_DECORATIVE_RADIUS_M}`
      );
    }

    // Tile 2 (center x=0.06) must be clipped strictly to the right of bisector x=0.04
    for (const pt of tiles[1].outlinePoints) {
      assert.ok(
        pt[0] >= 0.04,
        `tile 1 vertex x=${pt[0].toFixed(4)} should not cross bisector at x=0.04`
      );
    }

    // Each tile has valid triangle fan geometry
    for (const t of tiles) {
      assert.ok(t.outlinePoints.length >= 3);
      assert.equal(t.trianglePositions.length, t.outlinePoints.length * 9);
    }
  });
});

describe('Phase 11e — Local-Only Doppler / CTA Planner (Fig. 23.48C)', () => {
  it('stores pure user input with zero auto-calculated mm values and no PHI fields', async () => {
    await clearStoredDopplerPlannerMarkers();

    const marker = createDopplerPlannerMarker({
      worldPos: [0.042, 1.015, 0.118],
      worldNormal: [0, 0, 1],
    });

    // App must NEVER auto-compute mm measurements from worldPos
    assert.equal(marker.midlineMm, '');
    assert.equal(marker.inferiorUmbilicusMm, '');
    assert.equal(marker.sizeMm, '');
    assert.equal(marker.modality, 'CTA');
    assert.match(DOPPLER_PLANNER_NOTICE, /no PHI/i);
    assert.match(DOPPLER_PLANNER_NOTICE, /no automated calculations/i);

    const updated = {
      ...marker,
      label: 'DIEP R1',
      side: 'R' as const,
      midlineMm: '32',
      inferiorUmbilicusMm: '24',
      sizeMm: '1.8',
      notes: 'Lateral row',
    };

    await saveDopplerPlannerMarkers([updated]);
    const reloaded = await loadDopplerPlannerMarkers();
    assert.equal(reloaded.length, 1);
    assert.equal(reloaded[0].midlineMm, '32');
    assert.equal(reloaded[0].inferiorUmbilicusMm, '24');
    assert.equal(reloaded[0].sizeMm, '1.8');

    const csv = serializeDopplerMarkersCsv(reloaded);
    assert.match(csv, /Midline Distance \(mm, user input\)/);
    assert.match(csv, /Inferior to Umbilicus \(mm, user input\)/);
    assert.match(csv, /Perforator Size \(mm, user input\)/);
    assert.match(csv, /Notes \(No PHI\)/);
    assert.match(csv, /DIEP R1,R,32,24,1\.8,CTA,Lateral row/);
    assert.doesNotMatch(csv, /patient|dob|mrn/i);

    const audit = auditFlapDataset(INITIAL_FLAPS);
    const combined = buildCombinedAuditCsv(INITIAL_FLAPS, audit, reloaded);
    assert.match(combined, /Flap ID,Flap Name,Region,Status/);
    assert.match(combined, /Fig 23\.48C DIEP grid coding/);
    assert.match(combined, /DIEP R1,R,32,24,1\.8/);

    await clearStoredDopplerPlannerMarkers();
    assert.equal((await loadDopplerPlannerMarkers()).length, 0);
  });

  it('manages Phase 11e planner & corridor store lifecycle and restores layers cleanly on Off', () => {
    const store = useAtlasStore.getState();
    store.setTerritoryMode('off');
    store.clearDopplerPlannerMarkers();

    const beforeSkinOpacity = useAtlasStore.getState().layers.skin.opacity;
    const beforeMuscleVis = useAtlasStore.getState().layers.muscle.visible;

    store.setTerritoryMode('perforators');
    assert.equal(useAtlasStore.getState().territoryMode, 'perforators');
    assert.equal(useAtlasStore.getState().showPerforatorCorridors, true);
    assert.equal(useAtlasStore.getState().showFlapPerforasomes, true);

    store.setPlannerDropMode(true);
    assert.equal(useAtlasStore.getState().plannerDropMode, true);

    const created = store.addDopplerPlannerMarker({
      worldPos: [-0.035, 1.01, 0.11],
      worldNormal: [0, 0, 1],
    });
    assert.equal(useAtlasStore.getState().plannerDropMode, false);
    assert.equal(useAtlasStore.getState().selectedPlannerMarkerId, created.id);
    assert.equal(useAtlasStore.getState().dopplerPlannerMarkers.length, 1);

    store.updateDopplerPlannerMarker(created.id, {
      midlineMm: '28',
      inferiorUmbilicusMm: '18',
      sizeMm: '1.5',
    });
    assert.equal(useAtlasStore.getState().dopplerPlannerMarkers[0].midlineMm, '28');

    store.setPlannerDropMode(true);
    store.setTerritoryMode('off');
    assert.equal(useAtlasStore.getState().territoryMode, 'off');
    assert.equal(useAtlasStore.getState().plannerDropMode, false);
    assert.equal(useAtlasStore.getState().layers.skin.opacity, beforeSkinOpacity);
    assert.equal(useAtlasStore.getState().layers.muscle.visible, beforeMuscleVis);

    store.deleteDopplerPlannerMarker(created.id);
    assert.equal(useAtlasStore.getState().dopplerPlannerMarkers.length, 0);
  });
});
