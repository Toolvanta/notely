import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowLeft, Bold,
  Check, CheckSquare, ChevronDown, Clock, Code2,
  Eraser, FileText, Heading1, Heading2, Heading3, Highlighter,
  IndentDecrease, IndentIncrease, Italic, Link2, List, ListOrdered,
  Minus, NotebookPen, Pin, Quote, Redo2,
  Settings2, Smile, Sparkles, Strikethrough, Subscript, Superscript,
  Underline, Undo2, X,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { StatsView } from './StatsView'
import { cn, escapeHtml, formatFullDate, wordCount } from '../lib/utils'
import { sanitizeHtml } from '../lib/sanitize'

const HIGHLIGHTS = ['#fde047', '#86efac', '#f9a8d4', '#93c5fd', '#fdba74']
const FONTS = [
  { id: 'inter', label: 'Sans', family: 'var(--font)' },
  { id: 'serif', label: 'Serif', family: 'var(--font-serif)' },
  { id: 'mono', label: 'Mono', family: 'var(--font-mono)' },
] as const
const EMOJIS = [
  '😀', '😂', '😍', '🥰', '😎', '🤔', '😊', '😉',
  '😁', '😅', '😭', '😡', '👍', '👎', '👏', '🙌',
  '🤝', '🙏', '💪', '🔥', '✨', '🎉', '❤️', '💯',
  '✅', '❌', '⭐', '🚀', '💡', '📌', '📝', '🌈',
  '☀️', '🌙', '🍀', '🍕', '☕', '🎯', '🧠', '💬',
]
type ToolMenu = 'font' | 'emoji' | null

export function EditorPane() {
  const {
    notes, view, selectedId, settings, updateNote,
    togglePin, createNote, setSettings, setSettingsOpen,
  } = useApp()
  const note = notes.find((n) => n.id === selectedId)
  const contentRef = useRef<HTMLDivElement>(null)
  const [activeFormats, setActiveFormats] = useState<Record<string, boolean>>({})
  const [colorsOpen, setColorsOpen] = useState(false)
  const [menu, setMenu] = useState<{ kind: ToolMenu; left: number; top: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Load content imperatively when switching notes (uncontrolled contenteditable).
  useEffect(() => {
    if (contentRef.current && note) contentRef.current.innerHTML = note.content || ''
    setActiveFormats({})
    setMenu(null)
  }, [note?.id])

  useEffect(() => {
    document.execCommand?.('styleWithCSS', false, 'true')
  }, [])

  // Reflect which formatting commands are active at the current caret/selection.
  const updateActiveFormats = () => {
    const sel = window.getSelection()
    if (!sel?.anchorNode || !contentRef.current?.contains(sel.anchorNode)) return
    const keys = [
      'bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript',
      'insertUnorderedList', 'insertOrderedList',
      'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
    ]
    const next: Record<string, boolean> = {}
    keys.forEach((k) => { try { next[k] = document.queryCommandState(k) } catch { next[k] = false } })
    let block = ''
    try { block = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '') } catch { /* unsupported */ }
    next.h1 = block === 'h1'
    next.h2 = block === 'h2'
    next.h3 = block === 'h3'
    next.quote = block === 'blockquote'
    setActiveFormats(next)
  }

  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveFormats)
    return () => document.removeEventListener('selectionchange', updateActiveFormats)
  }, [note?.id])

  const syncContent = () => {
    if (!note || !contentRef.current) return
    // Checkbox state lives as a DOM property, so mirror it into attributes before saving.
    contentRef.current.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((box) => {
      if (box.checked) box.setAttribute('checked', '')
      else box.removeAttribute('checked')
    })
    const clean = sanitizeHtml(contentRef.current.innerHTML)
    const plain = contentRef.current.innerText.replace(/\s+/g, ' ').trim()
    updateNote(note.id, { content: clean, plainText: plain })
  }

  const exec = (command: string, value?: string) => {
    contentRef.current?.focus()
    try { document.execCommand(command, false, value) } catch { /* unsupported */ }
    syncContent()
    updateActiveFormats()
  }

  const insertHtml = (html: string) => exec('insertHTML', html)

  const addLink = () => {
    const selection = window.getSelection()?.toString() || ''
    const url = window.prompt('Enter a link URL', selection.startsWith('http') ? selection : 'https://')
    if (!url) return
    if (!selection) insertHtml(`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`)
    else exec('createLink', url)
  }

  const openMenu = (kind: Exclude<ToolMenu, null>, e: MouseEvent<HTMLButtonElement>) => {
    if (menu?.kind === kind) { setMenu(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const bar = toolbarRef.current?.getBoundingClientRect()
    setMenu({
      kind,
      left: bar ? Math.max(4, rect.left - bar.left) : 0,
      top: bar ? rect.bottom - bar.top + 6 : 34,
    })
  }

  // Row 1: text formatting + headings. Row 2: blocks, lists, alignment, insert.
  const formatTools = useMemo(() => ([
    { key: 'undo', icon: Undo2, title: 'Undo (Ctrl+Z)', action: () => exec('undo') },
    { key: 'redo', icon: Redo2, title: 'Redo (Ctrl+Y)', action: () => exec('redo') },
    { divider: true },
    { key: 'bold', icon: Bold, title: 'Bold (Ctrl+B)', action: () => exec('bold') },
    { key: 'italic', icon: Italic, title: 'Italic (Ctrl+I)', action: () => exec('italic') },
    { key: 'underline', icon: Underline, title: 'Underline (Ctrl+U)', action: () => exec('underline') },
    { key: 'strikeThrough', icon: Strikethrough, title: 'Strikethrough', action: () => exec('strikeThrough') },
    { divider: true },
    { key: 'subscript', icon: Subscript, title: 'Subscript', action: () => exec('subscript') },
    { key: 'superscript', icon: Superscript, title: 'Superscript', action: () => exec('superscript') },
    { key: 'highlight', icon: Highlighter, title: 'Highlight', action: () => setColorsOpen((v) => !v) },
    { key: 'removeFormat', icon: Eraser, title: 'Clear formatting', action: () => exec('removeFormat') },
    { divider: true },
    { key: 'h1', icon: Heading1, title: 'Heading 1', action: () => exec('formatBlock', 'h1') },
    { key: 'h2', icon: Heading2, title: 'Heading 2', action: () => exec('formatBlock', 'h2') },
    { key: 'h3', icon: Heading3, title: 'Heading 3', action: () => exec('formatBlock', 'h3') },
    { key: 'quote', icon: Quote, title: 'Quote', action: () => exec('formatBlock', 'blockquote') },
  ]), [note?.id])

  const blockTools = useMemo(() => ([
    { key: 'insertUnorderedList', icon: List, title: 'Bullet list', action: () => exec('insertUnorderedList') },
    { key: 'insertOrderedList', icon: ListOrdered, title: 'Numbered list', action: () => exec('insertOrderedList') },
    { key: 'checklist', icon: CheckSquare, title: 'Checklist', action: () => insertHtml('<ul><li><input type="checkbox"> ' + (window.getSelection()?.toString() || 'Task') + '</li></ul>') },
    { divider: true },
    { key: 'outdent', icon: IndentDecrease, title: 'Decrease indent', action: () => exec('outdent') },
    { key: 'indent', icon: IndentIncrease, title: 'Increase indent', action: () => exec('indent') },
    { divider: true },
    { key: 'justifyLeft', icon: AlignLeft, title: 'Align left', action: () => exec('justifyLeft') },
    { key: 'justifyCenter', icon: AlignCenter, title: 'Align center', action: () => exec('justifyCenter') },
    { key: 'justifyRight', icon: AlignRight, title: 'Align right', action: () => exec('justifyRight') },
    { key: 'justifyFull', icon: AlignJustify, title: 'Justify', action: () => exec('justifyFull') },
    { divider: true },
    { key: 'link', icon: Link2, title: 'Insert link', action: addLink },
    { key: 'code', icon: Code2, title: 'Inline code', action: () => insertHtml('<code>' + escapeHtml(window.getSelection()?.toString() || 'code') + '</code>') },
    { key: 'hr', icon: Minus, title: 'Divider', action: () => exec('insertHorizontalRule') },
  ]), [note?.id])

  if (view.kind === 'stats') {
    return (
      <section className="editor-pane">
        <StatsView />
      </section>
    )
  }

  if (!note) {
    return (
      <section className="editor-pane">
        <div className="no-note">
          <div className="no-note__inner">
            <div className="no-note__art"><NotebookPen size={38} strokeWidth={1.6} /></div>
            <h2>A fresh page awaits</h2>
            <p>Pick a note from the list, or start something new. Your ideas deserve a good home.</p>
            <button className="btn btn--primary" onClick={() => createNote()}><Sparkles size={14} /> New note</button>
            <div className="shortcut-hint" style={{ marginTop: 18 }}>
              <kbd>Ctrl</kbd> + <kbd>K</kbd> <span>for commands</span> <span>·</span> <kbd>Ctrl</kbd> + <kbd>N</kbd> <span>for a new note</span>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const words = wordCount(note.plainText)

  return (
    <section className="editor-pane">
      <div className="editor-topbar">
        <div className="breadcrumb">
          <input
            className="breadcrumb__title"
            value={note.title}
            placeholder="Untitled note"
            aria-label="Note title"
            onChange={(e) => updateNote(note.id, { title: e.target.value })}
          />
        </div>
        <button className={cn('icon-btn', note.pinned && 'icon-btn--active')} title={note.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(note.id)}>
          <Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} />
        </button>
        <button className="icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={16} />
        </button>
      </div>

      <div className="editor-scroll">
        <div className="editor-inner">
          <div className="editor-toolbar" ref={toolbarRef}>
            <div className="tool-row">
              {formatTools.map((tool, i) => 'divider' in tool ? (
                <span className="tool-divider" key={`fd-${i}`} />
              ) : (
                <button
                  key={tool.key}
                  className={cn('tool-btn', activeFormats[tool.key] && 'tool-btn--active')}
                  title={tool.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={tool.action}
                >
                  <tool.icon size={15} />
                </button>
              ))}
              <div className="toolbar-spacer" />
              <button
                className={cn('font-select', menu?.kind === 'font' && 'font-select--open')}
                title="Editor font"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => openMenu('font', e)}
              >
                <span>{FONTS.find((f) => f.id === settings.fontFamily)?.label ?? 'Sans'}</span>
                <ChevronDown size={14} />
              </button>
            </div>
            <div className="tool-row">
              {blockTools.map((tool, i) => 'divider' in tool ? (
                <span className="tool-divider" key={`bd-${i}`} />
              ) : (
                <button
                  key={tool.key}
                  className={cn('tool-btn', activeFormats[tool.key] && 'tool-btn--active')}
                  title={tool.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={tool.action}
                >
                  <tool.icon size={15} />
                </button>
              ))}
              <button
                className={cn('tool-btn', menu?.kind === 'emoji' && 'tool-btn--active')}
                title="Insert emoji"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => openMenu('emoji', e)}
              >
                <Smile size={15} />
              </button>
            </div>

            {menu && (
              <>
                <div className="popover-backdrop" onClick={() => setMenu(null)} />
                {menu.kind === 'font' && (
                  <div
                    className="popover font-menu__popover"
                    style={{ position: 'absolute', left: Math.max(4, Math.min(menu.left - 70, (toolbarRef.current?.clientWidth ?? 400) - 180)), top: menu.top }}
                  >
                    {FONTS.map((font) => (
                      <button
                        key={font.id}
                        className={cn(settings.fontFamily === font.id && 'font-menu__active')}
                        style={{ fontFamily: font.family }}
                        onClick={() => { setSettings({ fontFamily: font.id }); setMenu(null) }}
                      >
                        {settings.fontFamily === font.id ? <Check size={15} /> : <span className="font-menu__check" />}
                        {font.label}
                      </button>
                    ))}
                  </div>
                )}
                {menu.kind === 'emoji' && (
                  <div
                    className="popover emoji-popover"
                    style={{ position: 'absolute', left: Math.max(4, Math.min(menu.left - 90, (toolbarRef.current?.clientWidth ?? 400) - 236)), top: menu.top }}
                  >
                    <div className="emoji-popover__title">Emoji</div>
                    <div className="emoji-grid">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          title={emoji}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { insertHtml(`${emoji} `); setMenu(null) }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {colorsOpen && (
            <div className="popover color-popover color-popover--highlight">
              <div className="color-popover__label">Highlight</div>
              <div className="color-popover__swatches">
                {HIGHLIGHTS.map((color) => (
                  <button
                    key={color}
                    title={`Highlight ${color}`}
                    style={{ width: 24, height: 24, borderRadius: 7, background: color }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { exec('hiliteColor', color); setColorsOpen(false) }}
                  />
                ))}
              </div>
              <button className="color-popover__clear" onMouseDown={(e) => e.preventDefault()} onClick={() => { exec('hiliteColor', 'transparent'); setColorsOpen(false) }}>
                <X size={13} /> Remove highlight
              </button>
            </div>
          )}

          <div
            ref={contentRef}
            className="editor-content"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            data-placeholder="Start writing… let your thoughts flow."
            onInput={syncContent}
            onBlur={syncContent}
            style={{
              ['--editor-font-size' as string]: `${settings.fontSize}px`,
              ['--editor-font-family' as string]: settings.fontFamily === 'serif' ? 'var(--font-serif)' : settings.fontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font)',
            }}
          />

          {note.source && (
            <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <a href={note.source} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Open source <ArrowLeft size={12} style={{ transform: 'rotate(135deg)' }} />
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="editor-status">
        <span><FileText size={11} /> {words} words</span>
        <span><Clock size={11} /> {note.plainText.length} chars</span>
        <span className="status-right">Created {formatFullDate(note.createdAt)}</span>
      </div>
    </section>
  )
}
