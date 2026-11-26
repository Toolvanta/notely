import type { Folder, Note, NoteVersion, Settings } from './types'
import { normalizeSettings } from './types'
import { isNoteKey, KEYS, noteKey, type OpenRequest } from './keys'

export { KEYS }
export type Surface = 'popup' | 'full' | 'sidepanel'

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local

/** A batch of storage changes from another context (or our own echo). `value` is undefined for removals. */
export type ChangeBatch = Array<{ key: string; value: unknown }>
const listeners = new Set<(changes: ChangeBatch) => void>()

if (hasChrome) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    const batch = Object.entries(changes).map(([key, change]) => ({ key, value: change.newValue }))
    listeners.forEach((fn) => fn(batch))
  })
} else if (typeof window !== 'undefined') {
  // Dev fallback (vite dev server in a normal tab): sync between tabs through localStorage events.
  window.addEventListener('storage', (e) => {
    if (!e.key?.startsWith('notely:')) return
    try {
      const batch = [{ key: e.key, value: e.newValue ? JSON.parse(e.newValue) : undefined }]
      listeners.forEach((fn) => fn(batch))
    } catch { /* ignore malformed values */ }
  })
}

export function subscribe(fn: (changes: ChangeBatch) => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

async function readAll(): Promise<Record<string, unknown>> {
  if (hasChrome) return chrome.storage.local.get(null)
  const out: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith('notely:')) continue
    try { out[key] = JSON.parse(localStorage.getItem(key) || 'null') } catch { /* skip */ }
  }
  return out
}

async function read<T>(key: string, fallback: T): Promise<T> {
  if (hasChrome) {
    const res = await chrome.storage.local.get(key)
    return (res[key] as T) ?? fallback
  }
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/** Fire-and-forget friendly: the chrome call is issued synchronously, so it survives a popup closing. */
function writeMany(items: Record<string, unknown>, remove: string[] = []): Promise<void> {
  if (hasChrome) {
    const ops: Promise<void>[] = []
    if (Object.keys(items).length) ops.push(chrome.storage.local.set(items))
    if (remove.length) ops.push(chrome.storage.local.remove(remove))
    return Promise.all(ops).then(() => {})
  }
  try {
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, JSON.stringify(v))
    remove.forEach((k) => localStorage.removeItem(k))
  } catch { /* quota */ }
  return Promise.resolve()
}

const write = (key: string, value: unknown) => writeMany({ [key]: value })

function isNote(value: unknown): value is Note {
  return !!value && typeof value === 'object' && typeof (value as Note).id === 'string'
}

export type HistoryMap = Record<string, NoteVersion[]>

export const storage = {
  /**
   * Load every note. Notes live under one key each (`notely:note:<id>`), so concurrent
   * writers (popup, side panel, full app, background) never overwrite each other's notes.
   * Migrates the legacy single-array format on first run.
   */
  async getNotes(): Promise<Note[]> {
    const all = await readAll()
    const notes = new Map<string, Note>()
    for (const [key, value] of Object.entries(all)) {
      if (isNoteKey(key) && isNote(value)) notes.set(value.id, value)
    }
    const legacy = all[KEYS.legacyNotes]
    if (Array.isArray(legacy)) {
      const migrated: Record<string, unknown> = {}
      for (const n of legacy) {
        if (isNote(n) && !notes.has(n.id)) { notes.set(n.id, n); migrated[noteKey(n.id)] = n }
      }
      await writeMany(migrated, [KEYS.legacyNotes])
    }
    return [...notes.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  },
  writeNotes: (changed: Note[], removedIds: string[]) =>
    writeMany(Object.fromEntries(changed.map((n) => [noteKey(n.id), n])), removedIds.map(noteKey)),

  getFolders: () => read<Folder[]>(KEYS.folders, []),
  getSettings: async () => normalizeSettings(await read<unknown>(KEYS.settings, {})),
  isSeeded: () => read<boolean>(KEYS.seeded, false),
  getTabs: () => read<string[]>(KEYS.tabs, []),
  getActiveTab: (surface: Surface) => read<string | null>(KEYS.activeTabPrefix + surface, null),
  getPinnedTabs: () => read<string[]>(KEYS.pinnedTabs, []),
  getHistory: () => read<HistoryMap>(KEYS.history, {}),
  getOpenRequest: () => read<OpenRequest | null>(KEYS.openRequest, null),

  setFolders: (folders: Folder[]) => write(KEYS.folders, folders),
  setSettings: (settings: Settings) => write(KEYS.settings, settings),
  setSeeded: (value: boolean) => write(KEYS.seeded, value),
  setTabs: (tabs: string[]) => write(KEYS.tabs, tabs),
  setActiveTab: (surface: Surface, id: string | null) => write(KEYS.activeTabPrefix + surface, id),
  setPinnedTabs: (tabs: string[]) => write(KEYS.pinnedTabs, tabs),
  setHistory: (history: HistoryMap) => write(KEYS.history, history),
  getHiddenSites: async () => {
    const list = await read<unknown>(KEYS.bubbleHiddenSites, [])
    return Array.isArray(list) ? list.filter((h): h is string => typeof h === 'string') : []
  },
  setHiddenSites: (sites: string[]) => write(KEYS.bubbleHiddenSites, sites),
}
