// Shared types. Must stay free of DOM / React imports - the background service worker loads this module.

export type ThemeMode = 'light' | 'dark' | 'system'
export type Accent = 'violet' | 'blue' | 'emerald' | 'rose' | 'amber' | 'slate'
export type Density = 'comfortable' | 'compact'
export type SortBy = 'updated' | 'created' | 'title'
export type FontFamily = 'sans' | 'serif' | 'mono'

export interface Note {
  id: string
  title: string
  content: string
  plainText: string
  folderId: string | null
  tags: string[]
  color: string | null
  pinned: boolean
  archived: boolean
  trashed: boolean
  createdAt: number
  updatedAt: number
  source?: string | null
}

export interface Folder {
  id: string
  name: string
  color: Accent
  createdAt: number
}

export interface Settings {
  theme: ThemeMode
  accent: Accent
  fontSize: number
  fontFamily: FontFamily
  density: Density
  sortBy: SortBy
  /** Show the floating "Save to Notely" bubble when selecting text on web pages (needs optional host access). */
  selectionBubble: boolean
}

export interface NoteVersion {
  id: string
  title: string
  content: string
  plainText: string
  savedAt: number
  manual: boolean
}

export type View =
  | { kind: 'notes' }
  | { kind: 'stats' }

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'violet',
  fontSize: 15,
  fontFamily: 'sans',
  density: 'comfortable',
  sortBy: 'updated',
  selectionBubble: false,
}

const THEMES: ThemeMode[] = ['light', 'dark', 'system']
export const ACCENT_IDS: Accent[] = ['violet', 'blue', 'emerald', 'rose', 'amber', 'slate']
const FONTS: FontFamily[] = ['sans', 'serif', 'mono']
const SORTS: SortBy[] = ['updated', 'created', 'title']

export function isAccent(value: unknown): value is Accent {
  return ACCENT_IDS.includes(value as Accent)
}

/** Validate settings from storage or an imported backup field by field, falling back to defaults. */
export function normalizeSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const font = s.fontFamily === 'inter' ? 'sans' : s.fontFamily // legacy id
  const size = Number(s.fontSize)
  return {
    theme: THEMES.includes(s.theme as ThemeMode) ? (s.theme as ThemeMode) : DEFAULT_SETTINGS.theme,
    accent: isAccent(s.accent) ? s.accent : DEFAULT_SETTINGS.accent,
    fontSize: Number.isFinite(size) && size > 0 ? Math.min(20, Math.max(13, Math.round(size))) : DEFAULT_SETTINGS.fontSize,
    fontFamily: FONTS.includes(font as FontFamily) ? (font as FontFamily) : DEFAULT_SETTINGS.fontFamily,
    density: s.density === 'compact' ? 'compact' : 'comfortable',
    sortBy: SORTS.includes(s.sortBy as SortBy) ? (s.sortBy as SortBy) : DEFAULT_SETTINGS.sortBy,
    selectionBubble: s.selectionBubble === true,
  }
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
}

/** Build a complete note. `plainText` must be supplied by the caller (DOM-free). */
export function makeNote(partial: Partial<Note> = {}): Note {
  const now = Date.now()
  return {
    id: partial.id || uid(),
    title: partial.title ?? 'Untitled note',
    content: partial.content ?? '',
    plainText: (partial.plainText ?? '').slice(0, 200_000),
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
