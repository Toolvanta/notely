import { useEffect } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import { CommandPalette } from './components/CommandPalette'
import { EditorPane } from './components/EditorPane'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { Toast } from './components/Toast'
import { cn } from './lib/utils'
import { NotebookPen } from 'lucide-react'

export type Mode = 'popup' | 'full' | 'sidepanel'

/**
 * Layout architecture
 * -------------------
 * app-shell
 *  ├─ Sidebar        permanent 30% navigation rail (open tabs)
 *  └─ workspace      remaining 70%, filled entirely by the editor
 */
function Workspace({ mode }: { mode: Mode }) {
  const {
    ready, settings, selectedId, paletteOpen, settingsOpen, toast,
    setPaletteOpen, setSettingsOpen, createNote, selectNote,
  } = useApp()

  // Theme + accent live on <html> so portals/overlays inherit them.
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches)
      root.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings.theme])

  useEffect(() => { document.documentElement.dataset.accent = settings.accent }, [settings.accent])

  // Global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(!paletteOpen); return }
      if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); createNote(); return }
      if (e.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false)
        else if (settingsOpen) setSettingsOpen(false)
        else if (selectedId) selectNote(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, settingsOpen, selectedId, setPaletteOpen, setSettingsOpen, createNote, selectNote])

  if (!ready) {
    return (
      <div className={cn('app-shell', `mode-${mode}`)}>
        <div className="app-loader">
          <div className="app-loader__mark"><NotebookPen size={20} color="#fff" /></div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      'app-shell', `mode-${mode}`, `density-${settings.density}`,
    )}>
      <Sidebar />
      <div className="workspace">
        <EditorPane />
      </div>
      {paletteOpen && <CommandPalette />}
      {settingsOpen && <SettingsModal />}
      {toast && <Toast />}
    </div>
  )
}

export default function App({ mode }: { mode: Mode }) {
  return <AppProvider><Workspace mode={mode} /></AppProvider>
}
