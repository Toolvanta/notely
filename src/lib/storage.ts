import type { Folder, Note, NoteVersion, Settings } from './types'
import { DEFAULT_SETTINGS } from './types'

export const KEYS = {
  notes: 'notely:notes',
  folders: 'notely:folders',
  settings: 'notely:settings',
  seeded: 'notely:seeded',
  tabs: 'notely:tabs',
  activeTab: 'notely:active-tab',
  pinnedTabs: 'notely:pinned-tabs',
  history: 'notely:history',
} as const

const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local

type ChangePayload = { key: string; value: unknown }
const listeners = new Set<(change: ChangePayload) => void>()

if (hasChrome) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    for (const [key, change] of Object.entries(changes)) {
      listeners.forEach((fn) => fn({ key, value: change.newValue }))
    }
  })
  window.addEventListener('storage', (e) => {
    if (!e.key) return
    try {
      listeners.forEach((fn) => fn({ key: e.key!, value: e.newValue ? JSON.parse(e.newValue) : undefined }))
    } catch { /* noop */ }
  })
}

export function subscribe(fn: (change: ChangePayload) => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
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

async function write(key: string, value: unknown): Promise<void> {
  if (hasChrome) {
    await chrome.storage.local.set({ [key]: value })
    return
  }
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* noop */ }
}

export type HistoryMap = Record<string, NoteVersion[]>

export const storage = {
  getNotes: () => read<Note[]>(KEYS.notes, []),
  getFolders: () => read<Folder[]>(KEYS.folders, []),
  getSettings: async () => ({ ...DEFAULT_SETTINGS, ...(await read<Partial<Settings>>(KEYS.settings, {})) }),
  isSeeded: () => read<boolean>(KEYS.seeded, false),
  getTabs: () => read<string[]>(KEYS.tabs, []),
  getActiveTab: () => read<string | null>(KEYS.activeTab, null),
  getPinnedTabs: () => read<string[]>(KEYS.pinnedTabs, []),
  getHistory: () => read<HistoryMap>(KEYS.history, {}),

  setNotes: (notes: Note[]) => write(KEYS.notes, notes),
  setFolders: (folders: Folder[]) => write(KEYS.folders, folders),
  setSettings: (settings: Settings) => write(KEYS.settings, settings),
  setSeeded: (value: boolean) => write(KEYS.seeded, value),
  setTabs: (tabs: string[]) => write(KEYS.tabs, tabs),
  setActiveTab: (id: string | null) => write(KEYS.activeTab, id),
  setPinnedTabs: (tabs: string[]) => write(KEYS.pinnedTabs, tabs),
  setHistory: (history: HistoryMap) => write(KEYS.history, history),

  async clearAll() {
    const keys = Object.values(KEYS)
    if (hasChrome) await chrome.storage.local.remove(keys)
    else keys.forEach((k) => localStorage.removeItem(k))
  },
}
