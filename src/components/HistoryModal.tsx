import { useMemo, useState } from 'react'
import { History, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { sanitizeHtml } from '../lib/sanitize'
import { cn, formatFullDate, formatRelative } from '../lib/utils'

/** Browse, preview, restore and delete saved versions of the open note. */
export function HistoryModal() {
  const { notes, selectedId, history, setHistoryOpen, restoreVersion, deleteVersion, saveVersion } = useApp()
  const note = notes.find((n) => n.id === selectedId)
  const versions = useMemo(() => (selectedId ? history[selectedId] ?? [] : []), [history, selectedId])
  const [activeId, setActiveId] = useState<string | null>(versions[0]?.id ?? null)
  const active = versions.find((v) => v.id === activeId) ?? versions[0]
  const close = () => setHistoryOpen(false)

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="modal history-modal" role="dialog" aria-label="Version history">
        <div className="modal__header">
          <h2><History size={16} style={{ verticalAlign: -2, marginRight: 6 }} />Version history</h2>
          <button className="icon-btn" onClick={close} title="Close"><X size={17} /></button>
        </div>
        {!note ? (
          <div className="modal__body"><p className="history-empty">Open a note to see its history.</p></div>
        ) : (
          <div className="history-body">
            <div className="history-list">
              {versions.length === 0 && (
                <p className="history-empty">No versions yet. Notely saves one automatically every couple of minutes while you write.</p>
              )}
              {versions.map((v) => (
                <button
                  key={v.id}
                  className={cn('history-item', active?.id === v.id && 'history-item--active')}
                  onClick={() => setActiveId(v.id)}
                  title={formatFullDate(v.savedAt)}
                >
                  <strong>{formatRelative(v.savedAt)}</strong>
                  <small>{v.manual ? 'Saved manually' : 'Autosave'} · {v.title || 'Untitled'}</small>
                </button>
              ))}
            </div>
            <div className="history-preview">
              {active ? (
                <>
                  <div className="history-preview__meta">{formatFullDate(active.savedAt)}</div>
                  <h3>{active.title || 'Untitled note'}</h3>
                  {/* Content is sanitized before rendering. */}
                  <div className="editor-content history-preview__content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(active.content) || '<p><em>Empty</em></p>' }} />
                </>
              ) : <p className="history-empty">Select a version to preview it.</p>}
            </div>
          </div>
        )}
        <div className="modal__footer">
          {note && <button className="btn btn--ghost btn--sm" onClick={() => saveVersion(note.id, true)}><Save size={13} /> Save current version</button>}
          <div className="spacer" />
          {note && active && (
            <>
              <button className="btn btn--danger btn--sm" onClick={() => { deleteVersion(note.id, active.id); setActiveId(null) }}><Trash2 size={13} /> Delete</button>
              <button className="btn btn--primary btn--sm" onClick={() => { restoreVersion(note.id, active.id); close() }}><RotateCcw size={13} /> Restore this version</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
