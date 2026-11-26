import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  Archive, ArrowDown, ArrowUp, BarChart3, Command, CornerDownLeft, Download, Files, FileText, History, Maximize2,
  Moon, Pin, Plus, Search, Settings2, Sparkles, Sun, Trash2, Upload,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { exportBackup, parseBackup } from '../lib/export'
import { cn, excerpt } from '../lib/utils'

interface Action {
  id: string
  title: string
  subtitle: string
  icon: typeof Plus
  run: () => void
}

export function CommandPalette() {
  const {
    notes, settings, setSettings, setPaletteOpen, setSettingsOpen, setView, setRail, setHistoryOpen,
    selectNote, createNote, togglePin, trashNote, toggleArchive, selectedId, folders, importData, showToast,
  } = useApp()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const actions = useMemo<Action[]>(() => [
    { id: 'new', title: 'Create a new note', subtitle: 'Start with a blank page', icon: Plus, run: () => createNote() },
    {
      id: 'theme', title: `Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`,
      subtitle: 'Change the appearance', icon: settings.theme === 'dark' ? Sun : Moon,
      run: () => setSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' }),
    },
    { id: 'settings', title: 'Open settings', subtitle: 'Personalize Notely', icon: Settings2, run: () => setSettingsOpen(true) },
    {
      id: 'export', title: 'Export all notes', subtitle: 'Download a JSON backup', icon: Download,
      run: () => { exportBackup(notes, folders, settings); showToast('Backup downloaded') },
    },
    { id: 'import', title: 'Import a backup', subtitle: 'Restore from a JSON file', icon: Upload, run: () => fileRef.current?.click() },
    {
      id: 'full', title: 'Open full app', subtitle: 'Launch in a new tab', icon: Maximize2,
      run: () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.create({ url: chrome.runtime.getURL('options.html') })
        else window.open('options.html', '_blank')
      },
    },
    { id: 'library', title: 'Browse all notes', subtitle: 'Search, notebooks and archive', icon: Files, run: () => setRail('library') },
    { id: 'trash-view', title: 'Open trash', subtitle: 'Restore or permanently delete notes', icon: Trash2, run: () => setRail('trash') },
    { id: 'stats', title: 'Show writing statistics', subtitle: 'Words, notes and activity', icon: BarChart3, run: () => setView({ kind: 'stats' }) },
    ...(selectedId ? [{
      id: 'pin', title: 'Toggle pin on current note', subtitle: 'Keep it close at hand', icon: Pin,
      run: () => togglePin(selectedId),
    }, {
      id: 'history', title: 'Version history of current note', subtitle: 'Preview and restore earlier versions', icon: History,
      run: () => setHistoryOpen(true),
    }, {
      id: 'archive', title: 'Archive / unarchive current note', subtitle: 'Hide it without deleting', icon: Archive,
      run: () => toggleArchive(selectedId),
    }, {
      id: 'trash', title: 'Move current note to trash', subtitle: 'You can restore it later', icon: Trash2,
      run: () => trashNote(selectedId),
    }] : []),
  ], [settings, notes, folders, selectedId, createNote, setSettings, setSettingsOpen, togglePin, trashNote, showToast, setRail, setView, setHistoryOpen, toggleArchive])

  const noteResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes
      .filter((n) => !n.trashed && (!q || n.title.toLowerCase().includes(q) || n.plainText.toLowerCase().includes(q)))
      .slice(0, 7)
  }, [notes, query])

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions.slice(0, 4)
    return actions.filter((a) => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)).slice(0, 6)
  }, [actions, query])

  const items = useMemo(() => [
    ...filteredActions.map((a) => ({ kind: 'action' as const, action: a })),
    ...noteResults.map((n) => ({ kind: 'note' as const, note: n })),
  ], [filteredActions, noteResults])

  useEffect(() => setIndex(0), [query])

  const run = (item: (typeof items)[number]) => {
    if (item.kind === 'action') item.action.run()
    else selectNote(item.note.id)
    // The import action opens a file picker that lives inside the palette; keep it mounted until a file is chosen.
    if (item.kind === 'action' && item.action.id === 'import') return
    setPaletteOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && items[index]) { e.preventDefault(); run(items[index]) }
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPaletteOpen(false) }}>
      <div className="palette" onKeyDown={onKeyDown}>
        <div className="palette__search">
          <Search size={19} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes or type a command…"
          />
          <span className="search-kbd">ESC</span>
        </div>

        <div className="palette__list">
          {filteredActions.length > 0 && <div className="palette__section">Commands</div>}
          {filteredActions.map((action, i) => (
            <button
              key={action.id}
              className={cn('palette__item', index === i && 'palette__item--active')}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run({ kind: 'action', action })}
            >
              <span className="palette__item-icon"><action.icon size={15} /></span>
              <span className="palette__item-text"><strong>{action.title}</strong><small>{action.subtitle}</small></span>
              {index === i && <CornerDownLeft size={14} style={{ color: 'var(--text-3)' }} />}
            </button>
          ))}

          {noteResults.length > 0 && <div className="palette__section">Notes</div>}
          {noteResults.map((note, i) => {
            const position = filteredActions.length + i
            return (
              <button
                key={note.id}
                className={cn('palette__item', index === position && 'palette__item--active')}
                onMouseEnter={() => setIndex(position)}
                onClick={() => run({ kind: 'note', note })}
              >
                <span className="palette__item-icon"><FileText size={15} /></span>
                <span className="palette__item-text"><strong>{note.title || 'Untitled note'}</strong><small>{excerpt(note.plainText, 70)}</small></span>
                {index === position && <CornerDownLeft size={14} style={{ color: 'var(--text-3)' }} />}
              </button>
            )
          })}

          {!items.length && (
            <div className="empty-state" style={{ padding: '36px 20px' }}>
              <div className="empty-state__icon"><Sparkles size={22} /></div>
              <h3>Nothing found</h3>
              <p>Try a different search or create a new note.</p>
            </div>
          )}
        </div>

        <div className="palette__footer">
          <span><ArrowUp size={11} /><ArrowDown size={11} /> navigate</span>
          <span><CornerDownLeft size={11} /> select</span>
          <span><Command size={11} /> + K to toggle</span>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const input = e.currentTarget
          const file = input.files?.[0]
          input.value = ''
          if (!file) return
          try {
            importData(await parseBackup(file), 'merge')
          } catch (err) {
            showToast(err instanceof Error ? err.message : 'Import failed', 'error')
          }
          setPaletteOpen(false)
        }}
      />
    </div>
  )
}
