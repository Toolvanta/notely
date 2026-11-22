import { useState, type MouseEvent } from 'react'
import { Copy, MoreHorizontal, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { cn, colorHex, NOTE_COLORS, stripHtml } from '../lib/utils'
import type { Note } from '../lib/types'

/** Untitled notes borrow their first few words of body text as the tab label. */
function displayTitle(note: Note): string {
  const title = (note.title || '').trim()
  if (title && title.toLowerCase() !== 'untitled note') return title
  const body = (note.plainText || stripHtml(note.content) || '').replace(/\s+/g, ' ').trim()
  if (!body) return 'Untitled note'
  const words = body.split(' ').slice(0, 5).join(' ')
  return body.length > words.length ? `${words}…` : words
}

type TabMenu = { id: string; top: number; left: number } | null

/**
 * Vertical list of every open note. Each row has a quick-delete action and a
 * three-dot menu that opens to the right of the rail; right-click opens it too.
 */
export function TabBar() {
  const {
    notes, tabs, pinnedTabs, selectedId,
    selectNote, closeTab, toggleTabPin, createNote,
    updateNote, duplicateNote, deleteForever,
  } = useApp()
  const [menu, setMenu] = useState<TabMenu>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')

  const visible = tabs
    .map((id) => notes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => Boolean(n))

  const onAuxClick = (e: MouseEvent, id: string) => {
    if (e.button === 1) { e.preventDefault(); closeTab(id) }
  }

  // Fixed positioning lets the menu escape the scrolling rail and open on the right.
  const placeMenu = (id: string, x: number, y: number) => {
    const rail = document.querySelector('.sidebar')?.getBoundingClientRect()
    const left = Math.max(x + 6, (rail?.right ?? 0) + 8)
    setMenu({
      id,
      left: Math.min(left, window.innerWidth - 190),
      top: Math.max(8, Math.min(y - 6, window.innerHeight - 250)),
    })
  }

  const onContextMenu = (e: MouseEvent, id: string) => {
    e.preventDefault()
    if (menu?.id === id) { setMenu(null); return }
    placeMenu(id, e.clientX, e.clientY)
  }

  const openFromButton = (e: MouseEvent<HTMLButtonElement>, id: string) => {
    if (menu?.id === id) { setMenu(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    placeMenu(id, rect.right, rect.top + 6)
  }

  const startRename = (id: string, title: string) => {
    setTitleDraft(title || 'Untitled note')
    setRenamingId(id)
    setMenu(null)
  }

  const commitRename = (id: string) => {
    const next = titleDraft.trim()
    if (next) updateNote(id, { title: next })
    setRenamingId(null)
  }

  const editNote = (id: string) => {
    selectNote(id)
    setMenu(null)
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.editor-content')?.focus())
  }

  const run = (fn: () => void) => { fn(); setMenu(null) }

  return (
    <nav className="side-tabs" aria-label="Open tabs">
      <div className="side-tabs__header">
        <button className="nav-group__add" title="New note" onClick={() => createNote()}>
          <Plus size={14} />
        </button>
      </div>

      <div className="side-tabs__list">
        {visible.length === 0 ? (
          <div className="side-tabs__empty">No open tabs — open a note to begin.</div>
        ) : visible.map((note, index) => {
          const pinned = pinnedTabs.includes(note.id)
          const dotColor = colorHex(note.color ?? NOTE_COLORS[index % NOTE_COLORS.length])
          const title = displayTitle(note)
          return (
            <div
              key={note.id}
              className="side-tab-wrap"
              onContextMenu={(e) => onContextMenu(e, note.id)}
            >
              <button
                className={cn('side-tab', selectedId === note.id && 'side-tab--active')}
                onClick={() => renamingId !== note.id && selectNote(note.id)}
                onAuxClick={(e) => onAuxClick(e, note.id)}
                title={title}
              >
                <span className="side-tab__dot" style={{ background: dotColor }} />
                {renamingId === note.id ? (
                  <input
                    className="side-tab__rename"
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => commitRename(note.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); commitRename(note.id) }
                      if (e.key === 'Escape') { e.preventDefault(); setRenamingId(null) }
                    }}
                  />
                ) : (
                  <span className="side-tab__title">{title}</span>
                )}
                {pinned && <Pin size={11} className="side-tab__pin" />}
              </button>

              <button
                className="side-tab__delete"
                title={`Delete “${title}”`}
                onClick={() => deleteForever(note.id)}
              >
                <Trash2 size={12} />
              </button>
              <button
                className={cn('side-tab__more', menu?.id === note.id && 'side-tab__more--active')}
                title="More actions"
                aria-label="More actions"
                onClick={(e) => openFromButton(e, note.id)}
              >
                <MoreHorizontal size={14} />
              </button>

              {menu?.id === note.id && (
                <>
                  <div className="popover-backdrop" onClick={() => setMenu(null)} />
                  <div
                    className="popover side-tabs__menu"
                    style={{ position: 'fixed', left: menu.left, top: menu.top }}
                  >
                    <button onClick={() => editNote(note.id)}><Pencil size={13} /> Edit note</button>
                    <button onClick={() => startRename(note.id, note.title)}><Pencil size={13} /> Change title</button>
                    <button onClick={() => run(() => duplicateNote(note.id))}><Copy size={13} /> Duplicate note</button>
                    <div className="popover__sep" />
                    <button onClick={() => run(() => toggleTabPin(note.id))}>
                      <Pin size={13} /> {pinned ? 'Unpin tab' : 'Pin tab'}
                    </button>
                    <div className="popover__sep" />
                    <button className="danger" onClick={() => run(() => deleteForever(note.id))}>
                      <Trash2 size={13} /> Delete note
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
