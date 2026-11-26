import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { KEYS, storage, subscribe, type HistoryMap, type Surface } from '../lib/storage'
import { isNoteKey, noteIdFromKey, type OpenRequest } from '../lib/keys'
import { seedFolders, seedNotes } from '../lib/seed'
import type { ImportResult } from '../lib/export'
import {
  DEFAULT_SETTINGS, makeNote, normalizeSettings,
  type Folder, type Note, type NoteVersion, type Settings, type View,
} from '../lib/types'
import { stripHtml, uid } from '../lib/utils'

type ToastTone = 'success' | 'error' | 'info'
export interface ToastAction { label: string; run: () => void }
interface Toast { id: string; message: string; tone: ToastTone; action?: ToastAction }

/** Open requests from the background older than this are ignored on load. */
const OPEN_REQUEST_TTL = 15_000
const VERSION_INTERVAL = 120_000

export type RailView = 'tabs' | 'library' | 'trash'

interface AppContextValue {
  ready: boolean
  surface: Surface
  rail: RailView
  setRail: (rail: RailView) => void
  notes: Note[]
  folders: Folder[]
  settings: Settings
  view: View
  selectedId: string | null
  paletteOpen: boolean
  settingsOpen: boolean
  historyOpen: boolean
  toast: Toast | null
  tabs: string[]
  pinnedTabs: string[]
  history: HistoryMap

  setView: (view: View) => void
  selectNote: (id: string | null) => void
  setPaletteOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setHistoryOpen: (open: boolean) => void
  showToast: (message: string, tone?: ToastTone, action?: ToastAction) => void
  dismissToast: () => void

  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
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

  setSettings: (patch: Partial<Settings>) => void
  importData: (result: ImportResult, mode: 'merge' | 'replace') => void
  resetWorkspace: () => void
  clearWorkspace: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

function newNote(partial: Partial<Note> = {}): Note {
  return makeNote({ ...partial, plainText: partial.plainText ?? stripHtml(partial.content || '') })
}

export function AppProvider({ children, surface }: { children: ReactNode; surface: Surface }) {
  const [ready, setReady] = useState(false)
  const [notes, setNotesState] = useState<Note[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS)
  const [view, setView] = useState<View>({ kind: 'notes' })
  const [rail, setRail] = useState<RailView>('tabs')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [tabs, setTabs] = useState<string[]>([])
  const [pinnedTabs, setPinnedTabs] = useState<string[]>([])
  const [history, setHistory] = useState<HistoryMap>({})

  const readyRef = useRef(false)
  /** JSON of the last value written to / received from storage, per non-note key, to ignore our own echoes. */
  const lastWritten = useRef<Record<string, string>>({})
  /** JSON of each note as last persisted or received. Lets us write only the notes that changed. */
  const persisted = useRef(new Map<string, string>())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Notes are mirrored in a ref that is updated synchronously on every change, so a flush
  // triggered while the popup is closing always sees the latest keystroke.
  const notesRef = useRef<Note[]>([])
  const mutateNotes = useCallback((fn: (prev: Note[]) => Note[]) => {
    const next = fn(notesRef.current)
    if (next === notesRef.current) return
    notesRef.current = next
    setNotesState(next)
  }, [])
  const historyRef = useRef(history)
  historyRef.current = history

  const flushNotes = useCallback(() => {
    if (!readyRef.current) return
    const changed: Note[] = []
    const seen = new Set<string>()
    for (const note of notesRef.current) {
      seen.add(note.id)
      const json = JSON.stringify(note)
      if (persisted.current.get(note.id) !== json) {
        persisted.current.set(note.id, json)
        changed.push(note)
      }
    }
    const removed = [...persisted.current.keys()].filter((id) => !seen.has(id))
    removed.forEach((id) => persisted.current.delete(id))
    if (changed.length || removed.length) void storage.writeNotes(changed, removed)
  }, [])

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
          await storage.writeNotes(loadedNotes, [])
          await storage.setFolders(loadedFolders)
        }
        await storage.setSeeded(true)
      }
      const [loadedTabs, loadedPinned, loadedHistory, loadedActive, openRequest] = await Promise.all([
        storage.getTabs(), storage.getPinnedTabs(), storage.getHistory(),
        storage.getActiveTab(surface), storage.getOpenRequest(),
      ])
      if (cancelled) return

      loadedNotes.forEach((n) => persisted.current.set(n.id, JSON.stringify(n)))
      lastWritten.current[KEYS.folders] = JSON.stringify(loadedFolders)
      lastWritten.current[KEYS.settings] = JSON.stringify(loadedSettings)

      const validIds = new Set(loadedNotes.filter((n) => !n.trashed).map((n) => n.id))
      let cleanTabs = loadedTabs.filter((id) => validIds.has(id))
      const requested = openRequest && Date.now() - openRequest.at < OPEN_REQUEST_TTL && validIds.has(openRequest.id)
        ? openRequest.id : null
      if (requested && !cleanTabs.includes(requested)) cleanTabs = [...cleanTabs, requested]
      const first = requested
        ?? (loadedActive && cleanTabs.includes(loadedActive) ? loadedActive : null)
        ?? cleanTabs[0]
        ?? loadedNotes.find((n) => !n.trashed && !n.archived)?.id
        ?? null

      notesRef.current = loadedNotes
      setNotesState(loadedNotes)
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
  }, [surface])

  // ---- Persist ----
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(flushNotes, 250)
    return () => clearTimeout(timer)
  }, [notes, ready, flushNotes])

  // Never lose the last keystrokes: flush immediately when the popup / panel / tab is closing.
  useEffect(() => {
    const onHide = () => flushNotes()
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushNotes() }
    window.addEventListener('pagehide', onHide)
    window.addEventListener('beforeunload', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('beforeunload', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flushNotes])

  const persistKey = (key: string, value: unknown, save: () => Promise<void>) => {
    const json = JSON.stringify(value)
    if (lastWritten.current[key] === json) return
    lastWritten.current[key] = json
    void save()
  }
  useEffect(() => { if (ready) persistKey(KEYS.folders, folders, () => storage.setFolders(folders)) }, [folders, ready])
  useEffect(() => { if (ready) persistKey(KEYS.settings, settings, () => storage.setSettings(settings)) }, [settings, ready])
  useEffect(() => { if (ready) persistKey(KEYS.tabs, tabs, () => storage.setTabs(tabs)) }, [tabs, ready])
  useEffect(() => { if (ready) persistKey(KEYS.pinnedTabs, pinnedTabs, () => storage.setPinnedTabs(pinnedTabs)) }, [pinnedTabs, ready])
  useEffect(() => { if (ready) persistKey(KEYS.history, history, () => storage.setHistory(history)) }, [history, ready])
  // The active note is per surface and intentionally not synced, so views don't hijack each other.
  useEffect(() => { if (ready) void storage.setActiveTab(surface, selectedId) }, [selectedId, ready, surface])

  // ---- Cross-context sync ----
  useEffect(() => subscribe((batch) => {
    if (!readyRef.current) return
    const upserts: Note[] = []
    const removals = new Set<string>()
    for (const { key, value } of batch) {
      if (isNoteKey(key)) {
        const id = noteIdFromKey(key)
        if (value === undefined) {
          if (persisted.current.delete(id)) removals.add(id)
          continue
        }
        const json = JSON.stringify(value)
        if (persisted.current.get(id) === json) continue // our own echo
        const incoming = value as Note
        const local = notesRef.current.find((n) => n.id === id)
        // Last writer by edit time wins; our newer local copy will be flushed shortly.
        if (local && local.updatedAt > incoming.updatedAt) continue
        persisted.current.set(id, json)
        upserts.push(incoming)
        continue
      }
      if (value === undefined) continue
      const json = JSON.stringify(value)
      if (lastWritten.current[key] === json) continue
      lastWritten.current[key] = json
      if (key === KEYS.folders && Array.isArray(value)) setFolders(value as Folder[])
      else if (key === KEYS.settings && typeof value === 'object') setSettingsState(normalizeSettings(value))
      else if (key === KEYS.tabs && Array.isArray(value)) setTabs(value as string[])
      else if (key === KEYS.pinnedTabs && Array.isArray(value)) setPinnedTabs(value as string[])
      else if (key === KEYS.history && typeof value === 'object') setHistory(value as HistoryMap)
      else if (key === KEYS.openRequest) {
        const req = value as OpenRequest
        if (req?.id && Date.now() - req.at < OPEN_REQUEST_TTL) {
          setTabs((prev) => prev.includes(req.id) ? prev : [...prev, req.id])
          setSelectedId(req.id)
          setView({ kind: 'notes' })
        }
      }
    }
    if (upserts.length || removals.size) {
      mutateNotes((prev) => {
        let next = prev.filter((n) => !removals.has(n.id))
        for (const incoming of upserts) {
          const index = next.findIndex((n) => n.id === incoming.id)
          next = index === -1 ? [incoming, ...next] : next.map((n, i) => i === index ? incoming : n)
        }
        return next
      })
    }
  }), [mutateNotes])

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  const showToast = useCallback((message: string, tone: ToastTone = 'success', action?: ToastAction) => {
    clearTimeout(toastTimer.current)
    setToast({ id: uid(), message, tone, action })
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 2800)
  }, [])

  // ---- Tabs ----
  const openTab = useCallback((id: string) => {
    setTabs((prev) => prev.includes(id) ? prev : [...prev, id])
    setSelectedId(id)
  }, [])

  const selectNote = useCallback((id: string | null) => {
    if (id) { openTab(id); setView({ kind: 'notes' }) } else setSelectedId(null)
  }, [openTab])

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const index = prev.indexOf(id)
      if (index === -1) return prev
      const next = prev.filter((t) => t !== id)
      setSelectedId((current) => current === id ? next[Math.max(0, index - 1)] ?? null : current)
      return next
    })
    setPinnedTabs((prev) => prev.filter((t) => t !== id))
  }, [])

  const closeOtherTabs = useCallback((id: string) => {
    setTabs((prev) => prev.includes(id) ? [id] : [])
    setPinnedTabs((prev) => prev.filter((t) => t === id))
    setSelectedId(id)
  }, [])


  const toggleTabPin = useCallback((id: string) => {
    setPinnedTabs((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id])
  }, [])

  // ---- Versions ----
  const saveVersion = useCallback((id: string, manual = false) => {
    const note = notesRef.current.find((n) => n.id === id)
    if (!note) return
    const list = historyRef.current[id] || []
    const last = list[0]
    if (!manual && last && Date.now() - last.savedAt < VERSION_INTERVAL) return
    if (last && last.content === note.content && last.title === note.title) {
      if (manual) showToast('No changes since the last version', 'info')
      return
    }
    const version: NoteVersion = {
      id: uid(), title: note.title, content: note.content,
      plainText: note.plainText, savedAt: Date.now(), manual,
    }
    const next = { ...historyRef.current, [id]: [version, ...list].slice(0, 20) }
    historyRef.current = next
    setHistory(next)
    if (manual) showToast('Version saved')
  }, [showToast])

  const restoreVersion = useCallback((id: string, versionId: string) => {
    const version = historyRef.current[id]?.find((v) => v.id === versionId)
    if (!version) return
    saveVersion(id, true) // keep the current text so the restore itself can be undone
    mutateNotes((prev) => prev.map((n) => n.id === id ? {
      ...n,
      title: version.title,
      content: version.content,
      plainText: version.plainText,
      updatedAt: Date.now(),
    } : n))
    showToast('Version restored')
  }, [saveVersion, mutateNotes, showToast])

  const deleteVersion = useCallback((id: string, versionId: string) => {
    setHistory((prev) => ({ ...prev, [id]: (prev[id] || []).filter((v) => v.id !== versionId) }))
  }, [])

  const dropHistory = useCallback((ids: string[]) => {
    if (!ids.length) return
    setHistory((prev) => {
      const next = { ...prev }
      ids.forEach((id) => { delete next[id] })
      return next
    })
  }, [])

  // ---- Notes ----
  const createNote = useCallback((partial: Partial<Note> = {}) => {
    const created = newNote(partial)
    mutateNotes((prev) => [created, ...prev])
    openTab(created.id)
    setView({ kind: 'notes' })
    return created
  }, [mutateNotes, openTab])

  const duplicateNote = useCallback((id: string) => {
    const original = notesRef.current.find((n) => n.id === id)
    if (!original) return null
    const copy = newNote({
      ...original,
      id: undefined,
      title: `${original.title || 'Untitled note'} (copy)`,
      pinned: false,
      archived: false,
      trashed: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    mutateNotes((prev) => [copy, ...prev])
    openTab(copy.id)
    showToast('Note duplicated')
    return copy
  }, [mutateNotes, openTab, showToast])

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    if (patch.content !== undefined) saveVersion(id)
    mutateNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))
  }, [saveVersion, mutateNotes])

  const restoreNote = useCallback((id: string) => {
    mutateNotes((prev) => prev.map((n) => n.id === id ? { ...n, trashed: false, updatedAt: Date.now() } : n))
    showToast('Note restored')
  }, [mutateNotes, showToast])

  const trashNote = useCallback((id: string) => {
    const wasOpen = tabs.includes(id)
    mutateNotes((prev) => prev.map((n) => n.id === id ? { ...n, trashed: true, pinned: false, updatedAt: Date.now() } : n))
    closeTab(id)
    showToast('Moved to trash', 'info', {
      label: 'Undo',
      run: () => { restoreNote(id); if (wasOpen) openTab(id) },
    })
  }, [tabs, mutateNotes, closeTab, showToast, restoreNote, openTab])

  const deleteForever = useCallback((id: string) => {
    mutateNotes((prev) => prev.filter((n) => n.id !== id))
    dropHistory([id])
    closeTab(id)
    showToast('Note deleted permanently', 'info')
  }, [mutateNotes, dropHistory, closeTab, showToast])

  const emptyTrash = useCallback(() => {
    const trashedIds = notesRef.current.filter((n) => n.trashed).map((n) => n.id)
    mutateNotes((prev) => prev.filter((n) => !n.trashed))
    setTabs((prev) => prev.filter((id) => !trashedIds.includes(id)))
    setPinnedTabs((prev) => prev.filter((id) => !trashedIds.includes(id)))
    setSelectedId((current) => current && trashedIds.includes(current) ? null : current)
    dropHistory(trashedIds)
    showToast('Trash emptied', 'info')
  }, [mutateNotes, dropHistory, showToast])

  const togglePin = useCallback((id: string) => {
    mutateNotes((prev) => prev.map((n) => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n))
  }, [mutateNotes])

  const toggleArchive = useCallback((id: string) => {
    const note = notesRef.current.find((n) => n.id === id)
    if (!note) return
    mutateNotes((prev) => prev.map((n) => n.id === id ? { ...n, archived: !n.archived, pinned: false, updatedAt: Date.now() } : n))
    if (!note.archived) {
      closeTab(id)
      showToast('Note archived', 'info', { label: 'Undo', run: () => { toggleArchiveRef.current(id); openTab(id) } })
    } else {
      showToast('Note unarchived')
    }
  }, [mutateNotes, closeTab, showToast, openTab])
  const toggleArchiveRef = useRef(toggleArchive)
  toggleArchiveRef.current = toggleArchive

  const createFolder = useCallback((name: string, color: Folder['color'] = 'violet') => {
    const folder: Folder = { id: uid(), name, color, createdAt: Date.now() }
    setFolders((prev) => [...prev, folder])
    showToast(`Notebook “${name}” created`)
    return folder
  }, [showToast])

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((prev) => normalizeSettings({ ...prev, ...patch }))
  }, [])

  const replaceAll = useCallback((nextNotes: Note[], nextFolders: Folder[]) => {
    mutateNotes(() => nextNotes)
    setFolders(nextFolders)
    const first = nextNotes.find((n) => !n.trashed && !n.archived)
    setTabs(first ? [first.id] : [])
    setPinnedTabs([])
    setHistory({})
    setSelectedId(first?.id ?? null)
    setView({ kind: 'notes' })
  }, [mutateNotes])

  const importData = useCallback((result: ImportResult, mode: 'merge' | 'replace') => {
    if (mode === 'replace') {
      const folderIds = new Set(result.folders.map((f) => f.id))
      replaceAll(
        result.notes.map((n) => n.folderId && !folderIds.has(n.folderId) ? { ...n, folderId: null } : n),
        result.folders,
      )
    } else {
      // Map imported notebooks onto existing ones with the same name, or give them fresh ids,
      // and re-point imported notes at the new ids so none are orphaned.
      const existingFolders = folders
      const folderMap = new Map<string, string>()
      const addedFolders: Folder[] = []
      for (const f of result.folders) {
        const match = existingFolders.find((e) => e.name.toLowerCase() === f.name.toLowerCase())
          ?? addedFolders.find((e) => e.name.toLowerCase() === f.name.toLowerCase())
        if (match) folderMap.set(f.id, match.id)
        else {
          const fresh = { ...f, id: uid() }
          folderMap.set(f.id, fresh.id)
          addedFolders.push(fresh)
        }
      }
      const existingIds = new Set(notesRef.current.map((n) => n.id))
      const imported = result.notes.map((n) => ({
        ...n,
        id: existingIds.has(n.id) ? uid() : n.id,
        folderId: n.folderId ? folderMap.get(n.folderId) ?? null : null,
      }))
      mutateNotes((prev) => [...imported, ...prev])
      setFolders((prev) => [...prev, ...addedFolders])
    }
    if (result.settings) setSettingsState(normalizeSettings(result.settings))
    showToast(`Imported ${result.notes.length} note${result.notes.length === 1 ? '' : 's'}`)
  }, [folders, replaceAll, mutateNotes, showToast])

  const resetWorkspace = useCallback(() => {
    const freshFolders = seedFolders()
    replaceAll(seedNotes(freshFolders), freshFolders)
    setSettingsState(DEFAULT_SETTINGS)
    showToast('Workspace reset to sample data', 'info')
  }, [replaceAll, showToast])

  const clearWorkspace = useCallback(() => {
    replaceAll([], [])
    showToast('All notes cleared', 'info')
  }, [replaceAll, showToast])

  const value = useMemo<AppContextValue>(() => ({
    ready, surface, rail, setRail, notes, folders, settings, view, selectedId, paletteOpen, settingsOpen, historyOpen, toast,
    tabs, pinnedTabs, history,
    setView, selectNote, setPaletteOpen, setSettingsOpen, setHistoryOpen, showToast, dismissToast,
    closeTab, closeOtherTabs, toggleTabPin,
    createNote, duplicateNote, updateNote, trashNote, restoreNote, deleteForever, emptyTrash, togglePin, toggleArchive,
    saveVersion, restoreVersion, deleteVersion,
    createFolder,
    setSettings, importData, resetWorkspace, clearWorkspace,
  }), [
    ready, surface, rail, notes, folders, settings, view, selectedId, paletteOpen, settingsOpen, historyOpen, toast,
    tabs, pinnedTabs, history,
    selectNote, showToast, dismissToast, closeTab, closeOtherTabs, toggleTabPin,
    createNote, duplicateNote, updateNote, trashNote, restoreNote, deleteForever, emptyTrash, togglePin, toggleArchive,
    saveVersion, restoreVersion, deleteVersion,
    createFolder, setSettings, importData, resetWorkspace, clearWorkspace,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
