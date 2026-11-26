import { useMemo, useState } from 'react'
import { Archive, Files, Heart, Layers, NotebookPen, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { LINKS, SPONSOR_NAME } from '../lib/links'
import { useApp, type RailView } from '../store/AppContext'
import { TabBar } from './TabBar'
import { cn, colorHex, excerpt, formatRelative } from '../lib/utils'
import type { Note } from '../lib/types'

const RAIL_VIEWS: { id: RailView; label: string; icon: typeof Files }[] = [
  { id: 'tabs', label: 'Open', icon: Layers },
  { id: 'library', label: 'All notes', icon: Files },
  { id: 'trash', label: 'Trash', icon: Trash2 },
]

/**
 * Permanent navigation rail: brand/home, New note, and three views -
 * open tabs, the full library (search, notebooks, archive) and the trash.
 */
export function Sidebar() {
  const { createNote, setView, selectNote, rail, setRail, notes } = useApp()
  const trashCount = notes.filter((n) => n.trashed).length

  const goHome = () => {
    setView({ kind: 'notes' })
    selectNote(null)
  }

  return (
    <aside className="sidebar" aria-label="Navigation">
      <button className="sidebar__brand sidebar__brand--button" onClick={goHome} title="Home">
        <div className="brand-mark"><NotebookPen size={18} strokeWidth={2.2} /></div>
        <div>
          <div className="brand-name">Notely</div>
          <div className="brand-sub">YOUR SPACE TO THINK</div>
        </div>
      </button>

      <button className="sidebar__new" onClick={() => createNote()}>
        <Plus size={16} strokeWidth={2.6} /> New note
      </button>

      <div className="rail-switch" role="tablist" aria-label="Rail view">
        {RAIL_VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={rail === v.id}
            className={cn('rail-switch__btn', rail === v.id && 'rail-switch__btn--active')}
            onClick={() => setRail(v.id)}
            title={v.label}
          >
            <v.icon size={13} />
            <span>{v.label}</span>
            {v.id === 'trash' && trashCount > 0 && <span className="rail-switch__count">{trashCount}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar__scroll">
        {rail === 'tabs' && <TabBar />}
        {rail === 'library' && <Library />}
        {rail === 'trash' && <TrashList />}
      </div>

      <a className="sidebar__sponsor" href={LINKS.sponsor} target="_blank" rel="noopener noreferrer" title={`Visit ${SPONSOR_NAME}`}>
        <Heart size={12} className="sidebar__sponsor-heart" />
        <span>Sponsored by <strong>{SPONSOR_NAME}</strong></span>
      </a>
    </aside>
  )
}

function sortNotes(list: Note[], sortBy: 'updated' | 'created' | 'title') {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '')
    if (sortBy === 'created') return b.createdAt - a.createdAt
    return b.updatedAt - a.updatedAt
  })
}

function Library() {
  const { notes, folders, settings, selectedId, selectNote } = useApp()
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState<string>('all')
  const [showArchived, setShowArchived] = useState(false)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sortNotes(notes.filter((n) => {
      if (n.trashed || n.archived !== showArchived) return false
      if (folder === 'none') { if (n.folderId !== null) return false }
      else if (folder.startsWith('tag:')) { if (!n.tags.includes(folder.slice(4))) return false }
      else if (folder !== 'all' && n.folderId !== folder) return false
      if (!q) return true
      return n.title.toLowerCase().includes(q) || n.plainText.toLowerCase().includes(q) || n.tags.some((t) => t.toLowerCase().includes(q))
    }), settings.sortBy)
  }, [notes, query, folder, showArchived, settings.sortBy])

  const tags = useMemo(() => [...new Set(notes.filter((n) => !n.trashed).flatMap((n) => n.tags))].sort(), [notes])

  return (
    <div className="library">
      <label className="library__search">
        <Search size={13} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…" aria-label="Search notes" />
      </label>
      <div className="library__filters">
        <select className="select-input" value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Filter by notebook or tag">
          <option value="all">All notebooks</option>
          <option value="none">No notebook</option>
          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          {tags.length > 0 && <optgroup label="Tags">{tags.map((t) => <option key={t} value={`tag:${t}`}>#{t}</option>)}</optgroup>}
        </select>
        <button
          className={cn('icon-btn icon-btn--sm', showArchived && 'icon-btn--active')}
          title={showArchived ? 'Showing archived notes' : 'Show archived notes'}
          aria-pressed={showArchived}
          onClick={() => setShowArchived((v) => !v)}
        >
          <Archive size={13} />
        </button>
      </div>
      <div className="library__list">
        {list.length === 0 && <div className="side-tabs__empty">{showArchived ? 'No archived notes.' : 'No notes match.'}</div>}
        {list.map((n) => {
          const f = folders.find((x) => x.id === n.folderId)
          return (
            <button
              key={n.id}
              className={cn('library-item', selectedId === n.id && 'library-item--active')}
              onClick={() => selectNote(n.id)}
            >
              <span className="library-item__title">
                {f && <span className="folder-dot" style={{ background: colorHex(f.color) }} />}
                {n.title || 'Untitled note'}
              </span>
              <span className="library-item__meta">
                {formatRelative(n.updatedAt)}
                {n.tags.includes('capture') && ' · captured'}
                {n.pinned && ' · pinned'}
              </span>
              <span className="library-item__excerpt">{excerpt(n.plainText, 70)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TrashList() {
  const { notes, restoreNote, deleteForever, emptyTrash, selectNote, selectedId } = useApp()
  const trashed = useMemo(() => notes.filter((n) => n.trashed).sort((a, b) => b.updatedAt - a.updatedAt), [notes])

  return (
    <div className="library">
      <div className="library__filters">
        <span className="trash__hint">Notes stay here until you delete them.</span>
        {trashed.length > 0 && (
          <button
            className="btn btn--danger btn--sm"
            onClick={() => {
              if (window.confirm(`Permanently delete ${trashed.length} note${trashed.length === 1 ? '' : 's'}? This cannot be undone.`)) emptyTrash()
            }}
          >
            Empty
          </button>
        )}
      </div>
      <div className="library__list">
        {trashed.length === 0 && <div className="side-tabs__empty">Trash is empty.</div>}
        {trashed.map((n) => (
          <div key={n.id} className={cn('library-item library-item--trash', selectedId === n.id && 'library-item--active')}>
            <button className="library-item__open" onClick={() => selectNote(n.id)} title="Preview">
              <span className="library-item__title">{n.title || 'Untitled note'}</span>
              <span className="library-item__meta">Deleted {formatRelative(n.updatedAt)}</span>
            </button>
            <div className="library-item__actions">
              <button className="icon-btn icon-btn--sm" title="Restore" onClick={() => restoreNote(n.id)}><RotateCcw size={13} /></button>
              <button
                className="icon-btn icon-btn--sm icon-btn--danger"
                title="Delete forever"
                onClick={() => { if (window.confirm(`Permanently delete “${n.title || 'Untitled note'}”? This cannot be undone.`)) deleteForever(n.id) }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
