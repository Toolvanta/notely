import { useEffect } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import { CommandPalette } from './components/CommandPalette'
import { EditorPane } from './components/EditorPane'
import { HistoryModal } from './components/HistoryModal'
import { SettingsModal } from './components/SettingsModal'
import { Sidebar } from './components/Sidebar'
import { Toast } from './components/Toast'
import { cn } from './lib/utils'
import type { Surface } from './lib/storage'
import { NotebookPen } from 'lucide-react'

export type Mode = Surface

/** True when a key press is aimed at something that handles keys itself (fields, the editor, open menus). */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/**
 * Layout architecture
 * -------------------
 * app-shell
 *  ├─ Sidebar        permanent 30% rail (open tabs · all notes · trash)
 *  └─ workspace      remaining 70%, filled entirely by the editor
 */
function Workspace({ mode }: { mode: Mode }) {
  const {
    ready, settings, selectedId, paletteOpen, settingsOpen, historyOpen, toast,
    setPaletteOpen, setSettingsOpen, setHistoryOpen, createNote, selectNote,
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
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(!paletteOpen); return }
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); createNote(); return }
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (paletteOpen) { setPaletteOpen(false); return }
      if (historyOpen) { setHistoryOpen(false); return }
      if (settingsOpen) { setSettingsOpen(false); return }
      // Don't yank the note away while the user is typing in it or a menu is open.
      if (isTypingTarget(e.target) || document.querySelector('.popover')) return
      if (selectedId) selectNote(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, settingsOpen, historyOpen, selectedId, setPaletteOpen, setSettingsOpen, setHistoryOpen, createNote, selectNote])

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
      {historyOpen && <HistoryModal />}
      {toast && <Toast />}
    </div>
  )
}

export default function App({ mode }: { mode: Mode }) {
  return <AppProvider surface={mode}><Workspace mode={mode} /></AppProvider>
}
