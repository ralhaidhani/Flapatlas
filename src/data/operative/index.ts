import type { OperativeGuide } from './schema';

export * from './schema';

const OPERATIVE_GUIDE_LOADERS: Record<string, () => Promise<{ default: OperativeGuide }>> = {
  'alt-flap': () => import('./alt-flap'),
};

export function hasOperativeGuide(flapId: string | null | undefined): boolean {
  if (!flapId) return false;
  return Object.prototype.hasOwnProperty.call(OPERATIVE_GUIDE_LOADERS, flapId);
}

/**
 * Lazy-load a flap's operative guide module. Returns null for any flap without a verified-format guide.
 */
export async function loadOperativeGuide(
  flapId: string | null | undefined
): Promise<OperativeGuide | null> {
  if (!flapId) return null;
  const loader = OPERATIVE_GUIDE_LOADERS[flapId];
  if (!loader) return null;
  const mod = await loader();
  return mod.default ?? null;
}
