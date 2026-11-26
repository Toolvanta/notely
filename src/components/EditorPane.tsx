import { useEffect, useRef, useState, type MouseEvent, type RefObject } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowUpRight, Bold,
  Check, CheckSquare, ChevronDown, Clock, Code2,
  Eraser, FileText, Heading1, Heading2, Heading3, Highlighter,
  IndentDecrease, IndentIncrease, Italic, Link2, List, ListOrdered,
  Minus, NotebookPen, Pin, Quote, Redo2, RotateCcw,
  Settings2, Smile, Sparkles, SquareCode, Strikethrough, Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  Underline, Undo2, X,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { StatsView } from './StatsView'
import { NoteMenu } from './NoteMenu'
import { cn, formatFullDate, safeUrl, wordCount } from '../lib/utils'
import { sanitizeHtml, upgradeLegacyHtml } from '../lib/sanitize'
import type { FontFamily, Note } from '../lib/types'

const HIGHLIGHTS = ['#fde047', '#86efac', '#f9a8d4', '#93c5fd', '#fdba74']
const FONTS: { id: FontFamily; label: string; family: string }[] = [
  { id: 'sans', label: 'Sans', family: 'var(--font)' },
  { id: 'serif', label: 'Serif', family: 'var(--font-serif)' },
  { id: 'mono', label: 'Mono', family: 'var(--font-mono)' },
]
const EMOJIS = [
  '😀', '😂', '😍', '🥰', '😎', '🤔', '😊', '😉',
  '😁', '😅', '😭', '😡', '👍', '👎', '👏', '🙌',
  '🤝', '🙏', '💪', '🔥', '✨', '🎉', '❤️', '💯',
  '✅', '❌', '⭐', '🚀', '💡', '📌', '📝', '🌈',
  '☀️', '🌙', '🍀', '🍕', '☕', '🎯', '🧠', '💬',
]
type ToolMenu = 'font' | 'emoji' | 'highlight'

function buildExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        protocols: ['mailto'],
        isAllowedUri: (url, ctx) => ctx.defaultValidate(url) && !!safeUrl(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`),
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
    }),
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: 'Start writing… try “# ” for a heading, “- ” for a list or “[ ] ” for a task.' }),
  ]
}

export function EditorPane() {
  const {
    notes, view, selectedId, updateNote, togglePin, createNote, setSettingsOpen, restoreNote,
  } = useApp()
  const note = notes.find((n) => n.id === selectedId)

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
            <p>Pick a note from the rail, or start something new. Your ideas deserve a good home.</p>
            <button className="btn btn--primary" onClick={() => createNote()}><Sparkles size={14} /> New note</button>
            <div className="shortcut-hint" style={{ marginTop: 18 }}>
              <kbd>Ctrl</kbd> + <kbd>K</kbd> <span>for commands</span> <span>·</span> <kbd>Ctrl</kbd> + <kbd>N</kbd> <span>for a new note</span>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="editor-pane">
      <div className="editor-topbar">
        <div className="breadcrumb">
          <input
            className="breadcrumb__title"
            value={note.title}
            placeholder="Untitled note"
            aria-label="Note title"
            readOnly={note.trashed}
            onChange={(e) => updateNote(note.id, { title: e.target.value })}
          />
        </div>
        {note.archived && <span className="note-badge">Archived</span>}
        <button className={cn('icon-btn', note.pinned && 'icon-btn--active')} title={note.pinned ? 'Unpin' : 'Pin'} onClick={() => togglePin(note.id)} disabled={note.trashed}>
          <Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} />
        </button>
        <NoteMenu note={note} />
        <button className="icon-btn" title="Settings" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={16} />
        </button>
      </div>
      {note.trashed && (
        <div className="note-banner">
          This note is in the trash and is read-only.
          <button className="btn btn--ghost btn--sm" onClick={() => restoreNote(note.id)}><RotateCcw size={13} /> Restore</button>
        </div>
      )}
      {/* One editor instance per note: undo history never leaks between notes. */}
      <NoteEditor key={note.id} note={note} />
    </section>
  )
}

function NoteEditor({ note }: { note: Note }) {
  const { settings, setSettings, updateNote } = useApp()
  const updateRef = useRef(updateNote)
  updateRef.current = updateNote
  /** Last HTML this editor produced, to tell our own updates apart from changes made elsewhere. */
  const lastEmitted = useRef(note.content)
  const [menu, setMenu] = useState<{ kind: ToolMenu; left: number; top: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: buildExtensions(),
    content: upgradeLegacyHtml(note.content),
    editable: !note.trashed,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'editor-content', spellcheck: 'true', 'aria-label': 'Note content' },
      // Clean pasting: strip scripts, styles, images and anything the schema can't represent.
      transformPastedHTML: (html) => sanitizeHtml(html),
      handleClick: (_view, _pos, event) => {
        const anchor = (event.target as HTMLElement | null)?.closest('a')
        if (!anchor || !(event.ctrlKey || event.metaKey)) return false
        const url = safeUrl(anchor.getAttribute('href'))
        if (url) window.open(url, '_blank', 'noopener,noreferrer')
        return true
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : ed.getHTML()
      lastEmitted.current = html
      const plainText = ed.getText({ blockSeparator: '\n' }).replace(/\s+/g, ' ').trim()
      updateRef.current(note.id, { content: html, plainText })
    },
  })

  // Content changed somewhere else (another view, background, version restore): load it
  // without adding the swap to the undo history.
  useEffect(() => {
    if (!editor || note.content === lastEmitted.current) return
    lastEmitted.current = note.content
    editor.chain().setMeta('addToHistory', false).setContent(upgradeLegacyHtml(note.content), { emitUpdate: false }).run()
  }, [editor, note.content])

  useEffect(() => { editor?.setEditable(!note.trashed) }, [editor, note.trashed])

  const openMenu = (kind: ToolMenu, e: MouseEvent<HTMLButtonElement>) => {
    if (menu?.kind === kind) { setMenu(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const bar = toolbarRef.current?.getBoundingClientRect()
    setMenu({
      kind,
      left: bar ? Math.max(4, rect.left - bar.left) : 0,
      top: bar ? rect.bottom - bar.top + 6 : 34,
    })
  }

  const fontFamily = settings.fontFamily === 'serif' ? 'var(--font-serif)' : settings.fontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font)'
  const words = wordCount(note.plainText)
  const source = safeUrl(note.source)

  return (
    <>
      <div className="editor-scroll">
        <div className="editor-inner">
          {editor && !note.trashed && (
            <Toolbar editor={editor} toolbarRef={toolbarRef} menu={menu} openMenu={openMenu} closeMenu={() => setMenu(null)}
              fontFamily={settings.fontFamily} onFont={(id) => setSettings({ fontFamily: id })} />
          )}
          <div
            className="editor-host"
            style={{
              ['--editor-font-size' as string]: `${settings.fontSize}px`,
              ['--editor-font-family' as string]: fontFamily,
            }}
          >
            <EditorContent editor={editor} />
          </div>

          {source && (
            <div className="editor-source">
              <a href={source} target="_blank" rel="noopener noreferrer">
                Open source <ArrowUpRight size={12} />
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="editor-status">
        <span><FileText size={11} /> {words} words</span>
        <span><Clock size={11} /> {note.plainText.length} chars</span>
        <span className="status-hint">Markdown shortcuts work · Ctrl+click opens links</span>
        <span className="status-right">Created {formatFullDate(note.createdAt)}</span>
      </div>
    </>
  )
}

interface ToolbarProps {
  editor: Editor
  toolbarRef: RefObject<HTMLDivElement>
  menu: { kind: ToolMenu; left: number; top: number } | null
  openMenu: (kind: ToolMenu, e: MouseEvent<HTMLButtonElement>) => void
  closeMenu: () => void
  fontFamily: FontFamily
  onFont: (id: FontFamily) => void
}

type Tool = { divider: true } | {
  key: string
  icon: typeof Bold
  title: string
  run: () => void
  active?: boolean
  disabled?: boolean
}

function Toolbar({ editor, toolbarRef, menu, openMenu, closeMenu, fontFamily, onFont }: ToolbarProps) {
  const { showToast } = useApp()
  // Re-render the toolbar only when the bits it displays change.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const listType = e.isActive('taskItem') ? 'taskItem' : 'listItem'
      return {
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        subscript: e.isActive('subscript'),
        superscript: e.isActive('superscript'),
        highlight: e.isActive('highlight'),
        code: e.isActive('code'),
        codeBlock: e.isActive('codeBlock'),
        h1: e.isActive('heading', { level: 1 }),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        quote: e.isActive('blockquote'),
        bullet: e.isActive('bulletList'),
        ordered: e.isActive('orderedList'),
        task: e.isActive('taskList'),
        left: e.isActive({ textAlign: 'left' }),
        center: e.isActive({ textAlign: 'center' }),
        right: e.isActive({ textAlign: 'right' }),
        justify: e.isActive({ textAlign: 'justify' }),
        link: e.isActive('link'),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        canSink: e.can().sinkListItem(listType),
        canLift: e.can().liftListItem(listType),
        listType,
      }
    },
  })

  const chain = () => editor.chain().focus()

  const addLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const input = window.prompt('Link URL (leave empty to remove the link)', previous ?? 'https://')
    if (input === null) return
    const trimmed = input.trim()
    if (!trimmed || trimmed === 'https://') { chain().extendMarkRange('link').unsetLink().run(); return }
    const url = safeUrl(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (!url) { showToast('Only http, https and mailto links are allowed', 'error'); return }
    if (editor.state.selection.empty && !editor.isActive('link')) {
      chain().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run()
    } else {
      chain().extendMarkRange('link').setLink({ href: url }).run()
    }
  }

  const formatTools: Tool[] = [
    { key: 'undo', icon: Undo2, title: 'Undo (Ctrl+Z)', run: () => chain().undo().run(), disabled: !s.canUndo },
    { key: 'redo', icon: Redo2, title: 'Redo (Ctrl+Shift+Z)', run: () => chain().redo().run(), disabled: !s.canRedo },
    { divider: true },
    { key: 'bold', icon: Bold, title: 'Bold (Ctrl+B)', run: () => chain().toggleBold().run(), active: s.bold },
    { key: 'italic', icon: Italic, title: 'Italic (Ctrl+I)', run: () => chain().toggleItalic().run(), active: s.italic },
    { key: 'underline', icon: Underline, title: 'Underline (Ctrl+U)', run: () => chain().toggleUnderline().run(), active: s.underline },
    { key: 'strike', icon: Strikethrough, title: 'Strikethrough (Ctrl+Shift+S)', run: () => chain().toggleStrike().run(), active: s.strike },
    { divider: true },
    { key: 'subscript', icon: SubscriptIcon, title: 'Subscript', run: () => chain().toggleSubscript().run(), active: s.subscript },
    { key: 'superscript', icon: SuperscriptIcon, title: 'Superscript', run: () => chain().toggleSuperscript().run(), active: s.superscript },
    { key: 'removeFormat', icon: Eraser, title: 'Clear formatting', run: () => chain().unsetAllMarks().clearNodes().run() },
    { divider: true },
    { key: 'h1', icon: Heading1, title: 'Heading 1 (# )', run: () => chain().toggleHeading({ level: 1 }).run(), active: s.h1 },
    { key: 'h2', icon: Heading2, title: 'Heading 2 (## )', run: () => chain().toggleHeading({ level: 2 }).run(), active: s.h2 },
    { key: 'h3', icon: Heading3, title: 'Heading 3 (### )', run: () => chain().toggleHeading({ level: 3 }).run(), active: s.h3 },
    { key: 'quote', icon: Quote, title: 'Quote (> )', run: () => chain().toggleBlockquote().run(), active: s.quote },
  ]

  const blockTools: Tool[] = [
    { key: 'bullet', icon: List, title: 'Bullet list (- )', run: () => chain().toggleBulletList().run(), active: s.bullet },
    { key: 'ordered', icon: ListOrdered, title: 'Numbered list (1. )', run: () => chain().toggleOrderedList().run(), active: s.ordered },
    { key: 'task', icon: CheckSquare, title: 'Checklist ([ ] )', run: () => chain().toggleTaskList().run(), active: s.task },
    { divider: true },
    { key: 'outdent', icon: IndentDecrease, title: 'Decrease indent (Shift+Tab)', run: () => chain().liftListItem(s.listType).run(), disabled: !s.canLift },
    { key: 'indent', icon: IndentIncrease, title: 'Increase indent (Tab)', run: () => chain().sinkListItem(s.listType).run(), disabled: !s.canSink },
    { divider: true },
    { key: 'left', icon: AlignLeft, title: 'Align left', run: () => chain().setTextAlign('left').run(), active: s.left },
    { key: 'center', icon: AlignCenter, title: 'Align center', run: () => chain().setTextAlign('center').run(), active: s.center },
    { key: 'right', icon: AlignRight, title: 'Align right', run: () => chain().setTextAlign('right').run(), active: s.right },
    { key: 'justify', icon: AlignJustify, title: 'Justify', run: () => chain().setTextAlign('justify').run(), active: s.justify },
    { divider: true },
    { key: 'link', icon: Link2, title: 'Insert or edit link', run: addLink, active: s.link },
    { key: 'code', icon: Code2, title: 'Inline code (`code`)', run: () => chain().toggleCode().run(), active: s.code },
    { key: 'codeBlock', icon: SquareCode, title: 'Code block (```)', run: () => chain().toggleCodeBlock().run(), active: s.codeBlock },
    { key: 'hr', icon: Minus, title: 'Divider (---)', run: () => chain().setHorizontalRule().run() },
  ]

  const renderTool = (tool: Tool, i: number, prefix: string) => 'divider' in tool ? (
    <span className="tool-divider" key={`${prefix}-${i}`} />
  ) : (
    <button
      key={tool.key}
      className={cn('tool-btn', tool.active && 'tool-btn--active')}
      title={tool.title}
      aria-label={tool.title}
      aria-pressed={tool.active ?? undefined}
      disabled={tool.disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={tool.run}
    >
      <tool.icon size={15} />
    </button>
  )

  const popoverLeft = (offset: number, width: number) =>
    Math.max(4, Math.min((menu?.left ?? 0) - offset, (toolbarRef.current?.clientWidth ?? 400) - width))

  return (
    <div className="editor-toolbar" ref={toolbarRef}>
      <div className="tool-row">
        {/* undo … superscript, then the highlight colour picker, then the rest */}
        {formatTools.slice(0, 10).map((t, i) => renderTool(t, i, 'f'))}
        <button
          className={cn('tool-btn', (s.highlight || menu?.kind === 'highlight') && 'tool-btn--active')}
          title="Highlight"
          aria-label="Highlight"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => openMenu('highlight', e)}
        >
          <Highlighter size={15} />
        </button>
        {formatTools.slice(10).map((t, i) => renderTool(t, i, 'f2'))}
        <div className="toolbar-spacer" />
        <button
          className={cn('font-select', menu?.kind === 'font' && 'font-select--open')}
          title="Editor font"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => openMenu('font', e)}
        >
          <span>{FONTS.find((f) => f.id === fontFamily)?.label ?? 'Sans'}</span>
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="tool-row">
        {blockTools.map((t, i) => renderTool(t, i, 'b'))}
        <button
          className={cn('tool-btn', menu?.kind === 'emoji' && 'tool-btn--active')}
          title="Insert emoji"
          aria-label="Insert emoji"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => openMenu('emoji', e)}
        >
          <Smile size={15} />
        </button>
      </div>

      {menu && (
        <>
          <div className="popover-backdrop" onClick={closeMenu} />
          {menu.kind === 'font' && (
            <div className="popover font-menu__popover" style={{ left: popoverLeft(70, 180), top: menu.top }}>
              {FONTS.map((font) => (
                <button
                  key={font.id}
                  className={cn(fontFamily === font.id && 'font-menu__active')}
                  style={{ fontFamily: font.family }}
                  onClick={() => { onFont(font.id); closeMenu() }}
                >
                  {fontFamily === font.id ? <Check size={15} /> : <span className="font-menu__check" />}
                  {font.label}
                </button>
              ))}
            </div>
          )}
          {menu.kind === 'emoji' && (
            <div className="popover emoji-popover" style={{ left: popoverLeft(90, 236), top: menu.top }}>
              <div className="emoji-popover__title">Emoji</div>
              <div className="emoji-grid">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    title={emoji}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { chain().insertContent(`${emoji} `).run(); closeMenu() }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
          {menu.kind === 'highlight' && (
            <div className="popover color-popover" style={{ left: popoverLeft(60, 190), top: menu.top }}>
              <div className="color-popover__label">Highlight</div>
              <div className="color-popover__swatches">
                {HIGHLIGHTS.map((color) => (
                  <button
                    key={color}
                    className="color-swatch"
                    title={`Highlight ${color}`}
                    style={{ background: color }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { chain().setHighlight({ color }).run(); closeMenu() }}
                  />
                ))}
              </div>
              <button className="color-popover__clear" onMouseDown={(e) => e.preventDefault()} onClick={() => { chain().unsetHighlight().run(); closeMenu() }}>
                <X size={13} /> Remove highlight
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
