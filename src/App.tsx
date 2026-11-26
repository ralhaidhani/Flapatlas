import React, { Component, ErrorInfo, lazy, ReactNode, Suspense, useEffect } from 'react';
import {
  Award,
  BookOpen,
  GitCompare,
  HeartPulse,
  HelpCircle,
  Info,
  Layers,
  Settings,
  Sliders,
  Sparkles,
  Stethoscope,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { BottomSheet, SHEET_TABS } from './components/BottomSheet';
import { OfflinePackBootstrap } from './components/OfflinePackBootstrap';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallControls';
import { SearchPalette } from './components/SearchPalette';
import { Viewer3D } from './components/Viewer3D';
import { useBackNavigation } from './hooks/useBackNavigation';
import { useOnlineStatus } from './hooks/usePWA';
import { AppTab, useAtlasStore } from './store/useAtlasStore';

const AskAssistantDrawer = lazy(() =>
  import('./components/AskAssistantDrawer').then((m) => ({ default: m.AskAssistantDrawer }))
);
const HelpShortcutsModal = lazy(() =>
  import('./components/HelpShortcutsModal').then((m) => ({ default: m.HelpShortcutsModal }))
);

class PanelErrorBoundary extends Component<
  { children: ReactNode; fallbackTitle: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FlapAtlas ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-center space-y-2 bg-[var(--bg-surface)] h-full flex flex-col items-center justify-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {this.props.fallbackTitle}
          </p>
          <p className="text-sm text-[var(--text-secondary)] max-w-sm">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="min-h-[44px] px-4 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium"
          >
            Reload View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const TAB_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  library: Layers,
  layers: Sliders,
  anatomy: HeartPulse,
  advisor: Stethoscope,
  compare: GitCompare,
  tools: Wrench,
  quiz: Award,
  glossary: BookOpen,
  settings: Settings,
};

export default function App() {
  const activeTab = useAtlasStore((s) => s.activeTab);
  const teachingMode = useAtlasStore((s) => s.teachingMode);
  const compareIds = useAtlasStore((s) => s.compareIds);
  const menuOpen = useAtlasStore((s) => s.menuOpen);
  const assistantOpen = useAtlasStore((s) => s.assistantOpen);
  const helpModalOpen = useAtlasStore((s) => s.helpModalOpen);
  const hydrateFromStorage = useAtlasStore((s) => s.hydrateFromStorage);
  const setActiveTab = useAtlasStore((s) => s.setActiveTab);
  const setSheetSnap = useAtlasStore((s) => s.setSheetSnap);
  const setMenuOpen = useAtlasStore((s) => s.setMenuOpen);
  const setSearchPaletteOpen = useAtlasStore((s) => s.setSearchPaletteOpen);
  const setHelpModalOpen = useAtlasStore((s) => s.setHelpModalOpen);
  const openAssistant = useAtlasStore((s) => s.openAssistant);
  const closeAssistant = useAtlasStore((s) => s.closeAssistant);
  const setViewerContextMenu = useAtlasStore((s) => s.setViewerContextMenu);

  const isOnline = useOnlineStatus();

  // Android Back / Browser Back hierarchy: menus -> collapse sheet -> exit modes -> leave app
  useBackNavigation();

  useEffect(() => {
    void hydrateFromStorage();
  }, [hydrateFromStorage]);

  // Global keyboard shortcuts (Cmd/Ctrl+K, ?, 1-9 module switch, Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchPaletteOpen(true);
      } else if (e.key === 'Escape') {
        const st = useAtlasStore.getState();
        if (st.viewerContextMenu) {
          setViewerContextMenu(null);
        } else if (st.menuOpen) {
          setMenuOpen(false);
        } else if (st.searchPaletteOpen) {
          setSearchPaletteOpen(false);
        } else if (st.helpModalOpen) {
          setHelpModalOpen(false);
        } else if (st.assistantOpen) {
          closeAssistant();
        } else if (st.sheetSnap !== 'collapsed') {
          setSheetSnap('collapsed');
        }
      } else if (!inInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === '?') {
          e.preventDefault();
          setHelpModalOpen(!useAtlasStore.getState().helpModalOpen);
        } else if (e.key >= '1' && e.key <= '9') {
          const idx = Number(e.key) - 1;
          const tab = SHEET_TABS[idx];
          if (tab) {
            setActiveTab(tab.id);
            if (useAtlasStore.getState().sheetSnap === 'collapsed') {
              setSheetSnap('half');
            }
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    setSearchPaletteOpen,
    setHelpModalOpen,
    closeAssistant,
    setActiveTab,
    setSheetSnap,
    setMenuOpen,
    setViewerContextMenu,
  ]);

  const handleMenuSelectTab = (tabId: AppTab) => {
    setMenuOpen(false);
    setActiveTab(tabId);
    setSheetSnap('half');
  };

  return (
    <div
      className={`fixed inset-0 h-[100dvh] w-screen overflow-hidden overscroll-none bg-[var(--bg-canvas)] text-[var(--text-primary)] ${
        teachingMode ? 'text-[15px]' : ''
      }`}
    >
      {/* Full-Screen 100dvh Interactive 3D Human Anatomy Viewport */}
      <main
        id="main-content"
        aria-label="Interactive 3D Human Anatomy Viewport"
        className="absolute inset-0 w-full h-full overflow-hidden touch-none overscroll-none"
      >
        <PanelErrorBoundary fallbackTitle="3D Anatomical Viewer Error">
          <Viewer3D immersive />
        </PanelErrorBoundary>
      </main>

      {/* Single Unified Draggable Bottom Sheet (Portrait) / Right-Hand Panel (Landscape) */}
      <BottomSheet />

      {/* Floating Menu Drawer (opened from top-left Menu button; matches sheet tab list) */}
      {menuOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-950/60 flex"
          onClick={() => setMenuOpen(false)}
          data-testid="floating-nav-menu-backdrop"
        >
          <nav
            aria-label="FlapAtlas Navigation Menu"
            data-testid="floating-nav-menu"
            className="w-[min(82vw,300px)] h-full bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col shadow-2xl overflow-hidden"
            style={{
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              paddingLeft: 'env(safe-area-inset-left, 0px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={`${import.meta.env.BASE_URL}icon.svg`}
                  alt=""
                  className="w-7 h-7 rounded-md shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-base font-semibold text-[var(--text-primary)] leading-tight truncate">
                    FlapAtlas 3D
                  </div>
                  {!isOnline && (
                    <div className="inline-flex items-center gap-1 text-xs text-amber-400">
                      <WifiOff className="w-3.5 h-3.5" />
                      <span>Offline</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                data-testid="floating-nav-menu-close"
                aria-label="Close navigation menu"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1">
              {SHEET_TABS.map((item) => {
                const Icon = TAB_ICON_MAP[item.id] || Layers;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMenuSelectTab(item.id)}
                    data-testid={`menu-tab-${item.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.id === 'compare' && compareIds.length > 0 && (
                      <span className="ml-auto font-mono text-xs text-[var(--text-muted)]">
                        {compareIds.length}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="my-2 border-t border-[var(--border-subtle)]" />

              <button
                type="button"
                onClick={() => handleMenuSelectTab('about')}
                data-testid="menu-tab-about"
                aria-current={activeTab === 'about' ? 'page' : undefined}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors ${
                  activeTab === 'about'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Info className="w-4 h-4 shrink-0" />
                <span>About &amp; Credits</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setHelpModalOpen(true);
                }}
                data-testid="menu-open-help"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-3 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors"
              >
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>Guided Tour &amp; Shortcuts</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  openAssistant();
                }}
                data-testid="menu-open-assistant"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-3 text-[var(--accent-primary)] hover:bg-[var(--accent-soft)] transition-colors"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Ask FlapAtlas</span>
              </button>
            </div>

            <div className="px-3 py-2.5 border-t border-[var(--border-subtle)] shrink-0 space-y-2">
              <PWAInstallButton compact />
              <p className="text-xs text-[var(--text-muted)] leading-snug">
                For educational reference only; confirm anatomy with preoperative imaging.
              </p>
            </div>
          </nav>
        </div>
      )}

      {/* Global Overlays & Offline Banner */}
      <SearchPalette />
      {assistantOpen && (
        <Suspense fallback={null}>
          <AskAssistantDrawer />
        </Suspense>
      )}
      {helpModalOpen && (
        <Suspense fallback={null}>
          <HelpShortcutsModal />
        </Suspense>
      )}
      <OfflinePackBootstrap />
      <OfflineIndicator />
    </div>
  );
}
