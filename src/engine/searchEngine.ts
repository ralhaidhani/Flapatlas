import Fuse from 'fuse.js';
import type { FlapRecord, VerificationStatus, VesselRecord } from '../types/schemas';

export interface FlapFilterCriteria {
  query?: string;
  regionGroup?: string;
  flapType?: string;
  tissueComponent?: string;
  mobilization?: 'All' | 'Pedicled' | 'Free' | 'Local / Random';
  mathesNahai?: string;
  sensateOnly?: boolean;
  boneOnly?: boolean;
  chimericOnly?: boolean;
  verificationStatus?: VerificationStatus | 'All';
  vesselId?: string;
  favoritesOnly?: boolean;
  favoriteIds?: string[];
}

export function createFlapSearchIndex(flaps: FlapRecord[]): Fuse<FlapRecord> {
  return new Fuse(flaps, {
    includeScore: true,
    threshold: 0.36,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'name', weight: 3.0 },
      { name: 'synonyms', weight: 2.5 },
      { name: 'vascular_anatomy.dominant_pedicle.artery', weight: 2.2 },
      { name: 'vascular_anatomy.dominant_pedicle.artery_origin', weight: 1.5 },
      { name: 'region', weight: 1.6 },
      { name: 'region_group', weight: 1.2 },
      { name: 'flap_type', weight: 1.3 },
      { name: 'tissue_components', weight: 1.1 },
      { name: 'indications', weight: 1.4 },
      { name: 'technique.landmarks', weight: 1.0 },
      { name: 'nerves.sensory', weight: 1.0 },
      { name: 'nerves.motor', weight: 0.9 },
      { name: 'complications', weight: 0.7 },
      { name: 'vascular_anatomy.angiosome', weight: 1.1 },
    ],
  });
}

export function filterAndSearchFlaps(
  flaps: FlapRecord[],
  criteria: FlapFilterCriteria,
  vessels: VesselRecord[] = []
): FlapRecord[] {
  let list = flaps;

  if (criteria.query && criteria.query.trim().length > 0) {
    const fuse = createFlapSearchIndex(list);
    list = fuse.search(criteria.query.trim()).map((res) => res.item);
  }

  if (criteria.regionGroup && criteria.regionGroup !== 'All') {
    list = list.filter((f) => f.region_group === criteria.regionGroup);
  }

  if (criteria.flapType && criteria.flapType !== 'All') {
    const target = criteria.flapType.toLowerCase();
    list = list.filter((f) =>
      f.flap_type.some((t) => t.toLowerCase().includes(target))
    );
  }

  if (criteria.tissueComponent && criteria.tissueComponent !== 'All') {
    const target = criteria.tissueComponent.toLowerCase();
    list = list.filter((f) =>
      f.tissue_components.some((c) => c.toLowerCase().includes(target))
    );
  }

  if (criteria.mobilization && criteria.mobilization !== 'All') {
    if (criteria.mobilization === 'Pedicled') {
      list = list.filter((f) => f.advisor_tags.pedicled_capable);
    } else if (criteria.mobilization === 'Free') {
      list = list.filter((f) => f.advisor_tags.free_capable);
    } else if (criteria.mobilization === 'Local / Random') {
      list = list.filter(
        (f) =>
          f.reconstructive_ladder_level === 'Local flap' ||
          f.region_group === 'Local / Random Pattern'
      );
    }
  }

  if (criteria.mathesNahai && criteria.mathesNahai !== 'All') {
    list = list.filter((f) =>
      (f.classification.mathes_nahai || '')
        .toLowerCase()
        .includes(criteria.mathesNahai!.toLowerCase())
    );
  }

  if (criteria.sensateOnly) {
    list = list.filter((f) => f.nerves.can_be_sensate);
  }

  if (criteria.boneOnly) {
    list = list.filter((f) => f.advisor_tags.provides_bone);
  }

  if (criteria.chimericOnly) {
    list = list.filter((f) => f.advisor_tags.chimeric_capable);
  }

  if (criteria.verificationStatus && criteria.verificationStatus !== 'All') {
    list = list.filter((f) => f.verification_status === criteria.verificationStatus);
  }

  if (criteria.vesselId && criteria.vesselId !== 'All') {
    const vessel = vessels.find((v) => v.id === criteria.vesselId);
    if (vessel) {
      const supplied = new Set(vessel.supplied_flap_ids);
      const vesselNameLower = vessel.name.toLowerCase().replace(/\s*\(.*\)/, '');
      list = list.filter(
        (f) =>
          supplied.has(f.id) ||
          f.vascular_anatomy.dominant_pedicle.artery.toLowerCase().includes(vesselNameLower) ||
          f.vascular_anatomy.dominant_pedicle.artery_origin.toLowerCase().includes(vesselNameLower)
      );
    }
  }

  if (criteria.favoritesOnly && criteria.favoriteIds) {
    const favs = new Set(criteria.favoriteIds);
    list = list.filter((f) => favs.has(f.id));
  }

  return list;
}
