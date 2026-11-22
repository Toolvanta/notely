export type ThemeMode = 'light' | 'dark' | 'system'
export type Accent = 'violet' | 'blue' | 'emerald' | 'rose' | 'amber' | 'slate'
export type Density = 'comfortable' | 'compact'
export type SortBy = 'updated' | 'created' | 'title'

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
  fontFamily: 'inter' | 'serif' | 'mono'
  density: Density
  sortBy: SortBy
  showLineNumbers: boolean
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
  | { kind: 'favorites' }
  | { kind: 'archive' }
  | { kind: 'trash' }
  | { kind: 'folder'; id: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'stats' }

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'violet',
  fontSize: 15,
  fontFamily: 'inter',
  density: 'comfortable',
  sortBy: 'updated',
  showLineNumbers: false,
}
