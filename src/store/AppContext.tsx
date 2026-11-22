import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { KEYS, storage, subscribe, type HistoryMap } from '../lib/storage'
import { seedFolders, seedNotes } from '../lib/seed'
import type { ImportResult } from '../lib/export'
import {
  DEFAULT_SETTINGS, type Folder, type Note, type NoteVersion, type Settings, type View,
} from '../lib/types'
import { stripHtml, uid } from '../lib/utils'

type ToastTone = 'success' | 'error' | 'info'
interface Toast { id: string; message: string; tone: ToastTone }

interface AppContextValue {
  ready: boolean
  notes: Note[]
  folders: Folder[]
  settings: Settings
  view: View
  selectedId: string | null
  query: string
  paletteOpen: boolean
  settingsOpen: boolean
  toast: Toast | null
  tabs: string[]
  pinnedTabs: string[]
  history: HistoryMap

  setView: (view: View) => void
  selectNote: (id: string | null) => void
  setQuery: (query: string) => void
  setPaletteOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  showToast: (message: string, tone?: ToastTone) => void

  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  closeAllTabs: () => void
  toggleTabPin: (id: string) => void

  createNote: (partial?: Partial<Note>) => Note
  duplicateNote: (id: string) => Note | null
  updateNote: (id: string, patch: Partial<Note>) => void
  trashNote: (id: string) => void
  restoreNote: (id: string) => void
  deleteForever: (id: string) => void
  emptyTrash: () => void
  togglePin: (id: string) => void
  toggleArchive: (id: string) => void

  saveVersion: (id: string, manual?: boolean) => void
  restoreVersion: (id: string, versionId: string) => void
  deleteVersion: (id: string, versionId: string) => void

  createFolder: (name: string, color?: Folder['color']) => Folder
  renameFolder: (id: string, name: string) => void
  deleteFolder: (id: string) => void

  setSettings: (patch: Partial<Settings>) => void
  importData: (result: ImportResult, mode: 'merge' | 'replace') => void
  resetWorkspace: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

function makeNote(partial: Partial<Note> = {}): Note {
  const now = Date.now()
  const content = partial.content || ''
  return {
    id: uid(),
    title: partial.title ?? 'Untitled note',
    content,
    plainText: partial.plainText ?? stripHtml(content),
    folderId: partial.folderId ?? null,
    tags: partial.tags ?? [],
    color: partial.color ?? null,
    pinned: partial.pinned ?? false,
    archived: partial.archived ?? false,
    trashed: partial.trashed ?? false,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    source: partial.source ?? null,
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS)
  const [view, setView] = useState<View>({ kind: 'notes' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [tabs, setTabs] = useState<string[]>([])
  const [pinnedTabs, setPinnedTabs] = useState<string[]>([])
  const [history, setHistory] = useState<HistoryMap>({})

  const readyRef = useRef(false)
  const lastWritten = useRef<Record<string, string>>({})
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ---- Initial load / seeding ----
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const seeded = await storage.isSeeded()
      let [loadedNotes, loadedFolders, loadedSettings] = await Promise.all([
        storage.getNotes(), storage.getFolders(), storage.getSettings(),
      ])

      if (!seeded) {
        if (!loadedNotes.length) {
          loadedFolders = seedFolders()
          loadedNotes = seedNotes(loadedFolders)
          await storage.setFolders(loadedFolders)
          await storage.setNotes(loadedNotes)
          await storage.setSettings(DEFAULT_SETTINGS)
          lastWritten.current[KEYS.folders] = JSON.stringify(loadedFolders)
          lastWritten.current[KEYS.notes] = JSON.stringify(loadedNotes)
          lastWritten.current[KEYS.settings] = JSON.stringify(DEFAULT_SETTINGS)
        }
        await storage.setSeeded(true)
      }
      const [loadedTabs, loadedPinned, loadedHistory, loadedActive] = await Promise.all([
        storage.getTabs(), storage.getPinnedTabs(), storage.getHistory(), storage.getActiveTab(),
      ])
      if (cancelled) return
      if (lastWritten.current[KEYS.notes] === undefined) {
        lastWritten.current[KEYS.notes] = JSON.stringify(loadedNotes)
        lastWritten.current[KEYS.folders] = JSON.stringify(loadedFolders)
        lastWritten.current[KEYS.settings] = JSON.stringify(loadedSettings)
      }
      const validIds = new Set(loadedNotes.map((n) => n.id))
      const cleanTabs = loadedTabs.filter((id) => validIds.has(id))
      const first = loadedActive && cleanTabs.includes(loadedActive)
        ? loadedActive
        : cleanTabs[0] ?? loadedNotes.find((n) => !n.trashed && !n.archived)?.id ?? null

      setNotes(loadedNotes)
      setFolders(loadedFolders)
      setSettingsState(loadedSettings)
      setTabs(cleanTabs.length ? cleanTabs : first ? [first] : [])
      setPinnedTabs(loadedPinned.filter((id) => cleanTabs.includes(id)))
      setHistory(loadedHistory)
      setSelectedId(first)
      readyRef.current = true
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  // ---- Persist ----
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      lastWritten.current[KEYS.notes] = JSON.stringify(notes)
      void storage.setNotes(notes)
    }, 220)
    return () => clearTimeout(timer)
  }, [notes, ready])
  useEffect(() => { if (ready) { lastWritten.current[KEYS.folders] = JSON.stringify(folders); void storage.setFolders(folders) } }, [folders, ready])
  useEffect(() => { if (ready) { lastWritten.current[KEYS.settings] = JSON.stringify(settings); void storage.setSettings(settings) } }, [settings, ready])
  useEffect(() => { if (ready) { lastWritten.current[KEYS.tabs] = JSON.stringify(tabs); void storage.setTabs(tabs) } }, [tabs, ready])
  useEffect(() => { if (ready) { lastWritten.current[KEYS.pinnedTabs] = JSON.stringify(pinnedTabs); void storage.setPinnedTabs(pinnedTabs) } }, [pinnedTabs, ready])
  useEffect(() => { if (ready) { lastWritten.current[KEYS.history] = JSON.stringify(history); void storage.setHistory(history) } }, [history, ready])
  useEffect(() => { if (ready) { lastWritten.current[KEYS.activeTab] = JSON.stringify(selectedId); void storage.setActiveTab(selectedId) } }, [selectedId, ready])

  // ---- Cross-context sync ----
  useEffect(() => subscribe(({ key, value }) => {
    if (!readyRef.current || value === undefined) return
    const serialized = JSON.stringify(value)
    if (lastWritten.current[key] === serialized) return
    if (key === KEYS.notes && Array.isArray(value)) setNotes(value as Note[])
    else if (key === KEYS.folders && Array.isArray(value)) setFolders(value as Folder[])
    else if (key === KEYS.settings && typeof value === 'object') setSettingsState({ ...DEFAULT_SETTINGS, ...(value as Partial<Settings>) })
    else if (key === KEYS.tabs && Array.isArray(value)) setTabs(value as string[])
    else if (key === KEYS.pinnedTabs && Array.isArray(value)) setPinnedTabs(value as string[])
    else if (key === KEYS.history && typeof value === 'object') setHistory(value as HistoryMap)
    else if (key === KEYS.activeTab && (typeof value === 'string' || value === null)) setSelectedId(value as string | null)
  }), [])

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    clearTimeout(toastTimer.current)
    setToast({ id: uid(), message, tone })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  // ---- Tabs ----
  const openTab = useCallback((id: string) => {
    setTabs((prev) => prev.includes(id) ? prev : [...prev, id])
    setSelectedId(id)
  }, [])

  const selectNote = useCallback((id: string | null) => {
    if (id) openTab(id)
    else setSelectedId(null)
  }, [openTab])

  const closeTab = useCallback((id: string) => {
    const index = tabs.indexOf(id)
    const next = tabs.filter((t) => t !== id)
    setTabs(next)
    setPinnedTabs((prev) => prev.filter((t) => t !== id))
    if (selectedId === id) {
      const replacement = next[Math.max(0, index - 1)] ?? null
      setSelectedId(replacement)
    }
  }, [tabs, selectedId])

  const closeOtherTabs = useCallback((id: string) => {
    setTabs(tabs.includes(id) ? [id] : [])
    setPinnedTabs((prev) => prev.filter((t) => t === id))
    if (selectedId !== id && tabs.includes(id)) setSelectedId(id)
  }, [tabs, selectedId])

  const closeAllTabs = useCallback(() => {
    setTabs([])
    setPinnedTabs([])
    setSelectedId(null)
  }, [])

  const toggleTabPin = useCallback((id: string) => {
    setPinnedTabs((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id])
  }, [])

  // ---- Versions ----
  const saveVersion = useCallback((id: string, manual = false) => {
    const note = notes.find((n) => n.id === id)
    if (!note) return
    const last = history[id]?.[0]
    if (!manual && last && Date.now() - last.savedAt < 120_000) return
    const version: NoteVersion = {
      id: uid(), title: note.title, content: note.content,
      plainText: note.plainText, savedAt: Date.now(), manual,
    }
    setHistory((prev) => ({ ...prev, [id]: [version, ...(prev[id] || [])].slice(0, 20) }))
    if (manual) showToast('Version saved')
  }, [notes, history, showToast])

  const restoreVersion = useCallback((id: string, versionId: string) => {
    const version = history[id]?.find((v) => v.id === versionId)
    if (!version) return
    saveVersion(id, true)
    setNotes((prev) => prev.map((n) => n.id === id ? {
      ...n,
      title: version.title,
      content: version.content,
      plainText: version.plainText,
      updatedAt: Date.now(),
    } : n))
    showToast('Version restored')
  }, [history, saveVersion, showToast])

  const deleteVersion = useCallback((id: string, versionId: string) => {
    setHistory((prev) => ({ ...prev, [id]: (prev[id] || []).filter((v) => v.id !== versionId) }))
  }, [])

  // ---- Notes ----
  const createNote = useCallback((partial: Partial<Note> = {}) => {
    const created = makeNote(partial)
    setNotes((prev) => [created, ...prev])
    openTab(created.id)
    if (view.kind === 'trash' || view.kind === 'archive' || view.kind === 'stats') setView({ kind: 'notes' })
    return created
  }, [openTab, view.kind])

  const duplicateNote = useCallback((id: string) => {
    const original = notes.find((n) => n.id === id)
    if (!original) return null
    const copy = makeNote({
      ...original,
      id: undefined,
      title: `${original.title || 'Untitled note'} (copy)`,
      pinned: false,
      archived: false,
      trashed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    setNotes((prev) => [copy, ...prev])
    openTab(copy.id)
    showToast('Note duplicated')
    return copy
  }, [notes, openTab, showToast])

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    if (patch.content !== undefined) saveVersion(id)
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))
  }, [saveVersion])

  const trashNote = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, trashed: true, pinned: false, updatedAt: Date.now() } : n))
    closeTab(id)
    showToast('Note moved to trash', 'info')
  }, [closeTab, showToast])

  const restoreNote = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, trashed: false, updatedAt: Date.now() } : n))
    showToast('Note restored')
  }, [showToast])

  const deleteForever = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    setHistory((prev) => { const next = { ...prev }; delete next[id]; return next })
    closeTab(id)
    showToast('Note deleted permanently', 'info')
  }, [closeTab, showToast])

  const emptyTrash = useCallback(() => {
    const trashedIds = notes.filter((n) => n.trashed).map((n) => n.id)
    setNotes((prev) => prev.filter((n) => !n.trashed))
    setTabs((prev) => prev.filter((id) => !trashedIds.includes(id)))
    setPinnedTabs((prev) => prev.filter((id) => !trashedIds.includes(id)))
    if (selectedId && trashedIds.includes(selectedId)) setSelectedId(null)
    showToast('Trash emptied', 'info')
  }, [notes, selectedId, showToast])

  const togglePin = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n))
  }, [])
  const toggleArchive = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, archived: !n.archived, pinned: false, updatedAt: Date.now() } : n))
  }, [])

  const createFolder = useCallback((name: string, color: Folder['color'] = 'violet') => {
    const folder: Folder = { id: uid(), name, color, createdAt: Date.now() }
    setFolders((prev) => [...prev, folder])
    showToast(`Notebook “${name}” created`)
    return folder
  }, [showToast])
  const renameFolder = useCallback((id: string, name: string) => {
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, name } : f))
  }, [])
  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id))
    setNotes((prev) => prev.map((n) => n.folderId === id ? { ...n, folderId: null } : n))
    setView({ kind: 'notes' })
    showToast('Notebook deleted — notes were kept', 'info')
  }, [showToast])

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }))
  }, [])

  const importData = useCallback((result: ImportResult, mode: 'merge' | 'replace') => {
    if (mode === 'replace') {
      setNotes(result.notes)
      setFolders(result.folders)
      setTabs(result.notes[0] ? [result.notes[0].id] : [])
      setPinnedTabs([])
      setHistory({})
      setSelectedId(result.notes[0]?.id ?? null)
    } else {
      const existingIds = new Set<string>()
      setNotes((prev) => {
        prev.forEach((n) => existingIds.add(n.id))
        return [...result.notes.map((n) => existingIds.has(n.id) ? { ...n, id: uid() } : n), ...prev]
      })
      setFolders((prev) => {
        const names = new Set(prev.map((f) => f.name.toLowerCase()))
        return [...prev, ...result.folders.filter((f) => !names.has(f.name.toLowerCase())).map((f) => ({ ...f, id: uid() }))]
      })
    }
    if (result.settings) setSettingsState({ ...DEFAULT_SETTINGS, ...result.settings })
    showToast(`Imported ${result.notes.length} notes`)
  }, [showToast])

  const resetWorkspace = useCallback(() => {
    const freshFolders = seedFolders()
    const freshNotes = seedNotes(freshFolders)
    setNotes(freshNotes)
    setFolders(freshFolders)
    setSettingsState(DEFAULT_SETTINGS)
    setView({ kind: 'notes' })
    setTabs(freshNotes[0] ? [freshNotes[0].id] : [])
    setPinnedTabs([])
    setHistory({})
    setSelectedId(freshNotes[0]?.id ?? null)
    showToast('Workspace reset to sample data', 'info')
  }, [showToast])

  const value = useMemo<AppContextValue>(() => ({
    ready, notes, folders, settings, view, selectedId, query, paletteOpen, settingsOpen, toast,
    tabs, pinnedTabs, history,
    setView, selectNote, setQuery, setPaletteOpen, setSettingsOpen, showToast,
    closeTab, closeOtherTabs, closeAllTabs, toggleTabPin,
    createNote, duplicateNote, updateNote, trashNote, restoreNote, deleteForever, emptyTrash, togglePin, toggleArchive,
    saveVersion, restoreVersion, deleteVersion,
    createFolder, renameFolder, deleteFolder,
    setSettings, importData, resetWorkspace,
  }), [
    ready, notes, folders, settings, view, selectedId, query, paletteOpen, settingsOpen, toast,
    tabs, pinnedTabs, history,
    selectNote, closeTab, closeOtherTabs, closeAllTabs, toggleTabPin,
    createNote, duplicateNote, updateNote, trashNote, restoreNote, deleteForever, emptyTrash, togglePin, toggleArchive,
    saveVersion, restoreVersion, deleteVersion,
    createFolder, renameFolder, deleteFolder, setSettings, importData, resetWorkspace, showToast,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
