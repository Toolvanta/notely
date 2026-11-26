import { useState, type MouseEvent } from 'react'
import {
  Archive, ArchiveRestore, BookOpen, Check, ClipboardCopy, Copy, FileCode2, FileDown, FileText,
  FolderPlus, History, MoreHorizontal, Save, Tag, Trash2,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { exportNote, noteAsMarkdown } from '../lib/export'
import { colorHex } from '../lib/utils'
import type { Note } from '../lib/types'

/** Overflow menu for the open note: notebook, tags, history, export, archive, trash. */
export function NoteMenu({ note }: { note: Note }) {
  const {
    folders, updateNote, createFolder, saveVersion, setHistoryOpen, duplicateNote,
    toggleArchive, trashNote, showToast,
  } = useApp()
  const [pos, setPos] = useState<{ right: number; top: number } | null>(null)

  const open = (e: MouseEvent<HTMLButtonElement>) => {
    if (pos) { setPos(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ right: Math.max(8, window.innerWidth - rect.right), top: rect.bottom + 6 })
  }
  const run = (fn: () => void) => { fn(); setPos(null) }

  const editTags = () => {
    const input = window.prompt('Tags (comma separated)', note.tags.join(', '))
    if (input === null) return
    const tags = [...new Set(input.split(',').map((t) => t.trim().replace(/^#/, '').slice(0, 40)).filter(Boolean))]
    updateNote(note.id, { tags })
  }

  const newNotebook = () => {
    const name = window.prompt('New notebook name')?.trim()
    if (!name) return
    const folder = createFolder(name.slice(0, 80))
    updateNote(note.id, { folderId: folder.id })
  }

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(noteAsMarkdown(note))
      showToast('Copied as Markdown')
    } catch {
      showToast('Clipboard is not available here', 'error')
    }
  }

  return (
    <>
      <button className={pos ? 'icon-btn icon-btn--active' : 'icon-btn'} title="More actions" aria-haspopup="menu" aria-expanded={!!pos} onClick={open}>
        <MoreHorizontal size={16} />
      </button>
      {pos && (
        <>
          <div className="popover-backdrop" onClick={() => setPos(null)} />
          <div className="popover note-menu" role="menu" style={{ position: 'fixed', right: pos.right, top: pos.top }}>
            {!note.trashed && (
              <>
                <div className="popover__label">Notebook</div>
                <button role="menuitemradio" aria-checked={!note.folderId} onClick={() => run(() => updateNote(note.id, { folderId: null }))}>
                  {!note.folderId ? <Check size={13} /> : <span className="popover__icon-gap" />} No notebook
                </button>
                {folders.map((f) => (
                  <button key={f.id} role="menuitemradio" aria-checked={note.folderId === f.id} onClick={() => run(() => updateNote(note.id, { folderId: f.id }))}>
                    {note.folderId === f.id ? <Check size={13} /> : <span className="folder-dot" style={{ background: colorHex(f.color) }} />}
                    {f.name}
                  </button>
                ))}
                <button onClick={() => run(newNotebook)}><FolderPlus size={13} /> New notebook…</button>
                <button onClick={() => run(editTags)}><Tag size={13} /> Tags{note.tags.length ? `: ${note.tags.map((t) => `#${t}`).join(' ')}` : '…'}</button>
                <div className="popover__sep" />
                <button onClick={() => run(() => setHistoryOpen(true))}><History size={13} /> Version history</button>
                <button onClick={() => run(() => saveVersion(note.id, true))}><Save size={13} /> Save a version now</button>
                <div className="popover__sep" />
              </>
            )}
            <div className="popover__label">Export</div>
            <button onClick={() => run(() => exportNote(note, 'md'))}><FileDown size={13} /> Markdown (.md)</button>
            <button onClick={() => run(() => exportNote(note, 'html'))}><FileCode2 size={13} /> Web page (.html)</button>
            <button onClick={() => run(() => exportNote(note, 'txt'))}><FileText size={13} /> Plain text (.txt)</button>
            <button onClick={() => run(() => void copyMarkdown())}><ClipboardCopy size={13} /> Copy as Markdown</button>
            {!note.trashed && (
              <>
                <div className="popover__sep" />
                <button onClick={() => run(() => duplicateNote(note.id))}><Copy size={13} /> Duplicate</button>
                <button onClick={() => run(() => toggleArchive(note.id))}>
                  {note.archived ? <><ArchiveRestore size={13} /> Unarchive</> : <><Archive size={13} /> Archive</>}
                </button>
                <button className="danger" onClick={() => run(() => trashNote(note.id))}><Trash2 size={13} /> Move to trash</button>
              </>
            )}
            {note.folderId && (
              <div className="popover__foot"><BookOpen size={11} /> {folders.find((f) => f.id === note.folderId)?.name}</div>
            )}
          </div>
        </>
      )}
    </>
  )
}
