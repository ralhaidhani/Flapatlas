import { useEffect, useRef } from 'react';
import { useAtlasStore } from '../store/useAtlasStore';

function hasOpenMenus(): boolean {
  const s = useAtlasStore.getState();
  return Boolean(
    s.viewerContextMenu ||
      s.menuOpen ||
      s.searchPaletteOpen ||
      s.helpModalOpen ||
      s.assistantOpen
  );
}

function hasExpandedSheet(): boolean {
  return useAtlasStore.getState().sheetSnap !== 'collapsed';
}

function hasActiveModes(): boolean {
  const s = useAtlasStore.getState();
  const hasClipping =
    s.clippingPlanes.axial.enabled ||
    s.clippingPlanes.sagittal.enabled ||
    s.clippingPlanes.coronal.enabled;
  return Boolean(
    s.territoryMode !== 'off' ||
      s.measureMode ||
      s.animationMode !== 'none' ||
      s.plannerDropMode ||
      s.calibrationViewActive ||
      s.calibratingAnchorId !== null ||
      s.selectedAnatomyInfo !== null ||
      s.selectedSchematicMuscleId !== null ||
      s.focusedTerritoryId !== null ||
      hasClipping
  );
}

function hasAnyDismissibleState(): boolean {
  return hasOpenMenus() || hasExpandedSheet() || hasActiveModes();
}

/**
 * Android Back / browser Back navigation priority:
 * 1) Close open menus / overlays
 * 2) Collapse the bottom sheet
 * 3) Exit active 3D modes (territories, measure, animation, clipping, calibration, selection)
 * 4) Leave the app (no history trap when idle)
 */
export function useBackNavigation() {
  const guardActiveRef = useRef(false);
  const suppressNextPopRef = useRef(false);

  const dismissible = useAtlasStore((s) => {
    const hasClipping =
      s.clippingPlanes.axial.enabled ||
      s.clippingPlanes.sagittal.enabled ||
      s.clippingPlanes.coronal.enabled;
    return Boolean(
      s.viewerContextMenu ||
        s.menuOpen ||
        s.searchPaletteOpen ||
        s.helpModalOpen ||
        s.assistantOpen ||
        s.sheetSnap !== 'collapsed' ||
        s.territoryMode !== 'off' ||
        s.measureMode ||
        s.animationMode !== 'none' ||
        s.plannerDropMode ||
        s.calibrationViewActive ||
        s.calibratingAnchorId !== null ||
        s.selectedAnatomyInfo !== null ||
        s.selectedSchematicMuscleId !== null ||
        s.focusedTerritoryId !== null ||
        hasClipping
    );
  });

  // Push a single history guard entry whenever dismissible UI becomes active;
  // pop it cleanly when all dismissible UI is closed manually so Back leaves the app.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (dismissible && !guardActiveRef.current) {
      window.history.pushState({ flapAtlasGuard: true }, '');
      guardActiveRef.current = true;
    } else if (!dismissible && guardActiveRef.current) {
      guardActiveRef.current = false;
      if (window.history.state?.flapAtlasGuard) {
        suppressNextPopRef.current = true;
        window.history.back();
      }
    }
  }, [dismissible]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPopState = () => {
      if (suppressNextPopRef.current) {
        suppressNextPopRef.current = false;
        return;
      }

      guardActiveRef.current = false;
      const s = useAtlasStore.getState();

      // Priority 1: Close open menus / popups / drawers
      if (hasOpenMenus()) {
        if (s.viewerContextMenu) s.setViewerContextMenu(null);
        else if (s.menuOpen) s.setMenuOpen(false);
        else if (s.searchPaletteOpen) s.setSearchPaletteOpen(false);
        else if (s.helpModalOpen) s.setHelpModalOpen(false);
        else if (s.assistantOpen) s.closeAssistant();
      }
      // Priority 2: Collapse the sheet
      else if (hasExpandedSheet()) {
        s.setSheetSnap('collapsed');
      }
      // Priority 3: Exit active modes
      else if (hasActiveModes()) {
        if (s.plannerDropMode) s.setPlannerDropMode(false);
        else if (s.measureMode) s.setMeasureMode(false);
        else if (s.animationMode !== 'none') s.setAnimationMode('none');
        else if (s.calibrationViewActive) s.toggleCalibrationView(false);
        else if (s.calibratingAnchorId !== null) s.setCalibratingAnchorId(null);
        else if (s.focusedTerritoryId !== null) s.focusTerritory(null);
        else if (s.selectedSchematicMuscleId !== null) s.setSelectedSchematicMuscleId(null);
        else if (s.territoryMode !== 'off') s.setTerritoryMode('off');
        else if (s.selectedAnatomyInfo !== null) s.setSelectedAnatomyInfo(null);
        else s.resetClippingPlanes();
      }
      // Priority 4: Nothing dismissible remains — allow natural Back exit
      else {
        return;
      }

      // If additional dismissible layers remain after this step, re-arm the guard
      if (hasAnyDismissibleState()) {
        window.history.pushState({ flapAtlasGuard: true }, '');
        guardActiveRef.current = true;
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
}
