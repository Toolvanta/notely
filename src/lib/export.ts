import { isAccent, normalizeSettings, type Folder, type Note, type Settings } from './types'
import { htmlToMarkdown } from './markdown'
import { sanitizeHtml } from './sanitize'
import { formatFullDate, safeUrl, stripHtml, uid } from './utils'

export type ExportFormat = 'md' | 'html' | 'txt'

function safeName(name: string): string {
  return (name || 'untitled').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 70)
}

export function download(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function noteAsMarkdown(note: Note): string {
  const parts: string[] = [`# ${note.title || 'Untitled note'}`, '']
  if (note.tags.length) parts.push(`*${note.tags.map((t) => `#${t}`).join('  ')}*`, '')
  if (note.content) parts.push(htmlToMarkdown(note.content))
  if (note.source) parts.push('', `Source: ${note.source}`)
  parts.push('', `---`, `Created ${formatFullDate(note.createdAt)} · Updated ${formatFullDate(note.updatedAt)}`)
  return parts.join('\n').trim() + '\n'
}

export function noteAsHtml(note: Note): string {
  // The exported file is opened outside the extension (no CSP), so everything is re-sanitized.
  const source = safeUrl(note.source)
  const tags = note.tags.length
    ? `<div class="tags">${note.tags.map((t) => `<span>#${escape(t)}</span>`).join('')}</div>`
    : ''
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(note.title || 'Untitled note')}</title>
<style>
  body{max-width:760px;margin:56px auto;padding:0 24px;font:16px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#23212e;background:#fbfbfd}
  h1{font-size:34px;letter-spacing:-.03em;margin:0 0 8px;color:#171521}
  .meta{color:#8b879c;font-size:13px;margin-bottom:28px}
  .tags{display:flex;gap:8px;margin-bottom:24px}.tags span{background:#efeaff;color:#7c5cff;padding:4px 10px;border-radius:99px;font-size:12px;font-weight:600}
  blockquote{border-left:3px solid #7c5cff;margin:18px 0;padding:4px 0 4px 18px;color:#5b576b;background:#f4f1ff}
  pre{background:#1e1b2e;color:#e8e6f5;padding:16px 18px;border-radius:12px;overflow:auto}
  code{font-family:"SF Mono",Consolas,monospace;font-size:14px}
  a{color:#7c5cff}img{max-width:100%;border-radius:10px}
  hr{border:0;border-top:1px solid #e8e6ef;margin:36px 0}
  input[type=checkbox]{accent-color:#7c5cff}
</style></head><body>
<h1>${escape(note.title || 'Untitled note')}</h1>
<div class="meta">Created ${formatFullDate(note.createdAt)} · Updated ${formatFullDate(note.updatedAt)}</div>
${tags}
<article>${sanitizeHtml(note.content) || '<p><em>Empty note</em></p>'}</article>
${source ? `<p><a href="${escape(source)}" rel="noopener noreferrer">Open source ↗</a></p>` : ''}
</body></html>`
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export function exportNote(note: Note, format: ExportFormat) {
  const name = safeName(note.title || 'untitled')
  if (format === 'md') download(`${name}.md`, noteAsMarkdown(note), 'text/markdown;charset=utf-8')
  else if (format === 'html') download(`${name}.html`, noteAsHtml(note), 'text/html;charset=utf-8')
  else download(`${name}.txt`, `${note.title}\n\n${note.plainText}`, 'text/plain;charset=utf-8')
}

export function exportBackup(notes: Note[], folders: Folder[], settings: Settings) {
  const payload = {
    app: 'Notely',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes,
    folders,
    settings,
  }
  const date = new Date().toISOString().slice(0, 10)
  download(`notely-backup-${date}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8')
}

export interface ImportResult {
  notes: Note[]
  folders: Folder[]
  settings?: Settings
}

const MAX_BACKUP_BYTES = 50 * 1024 * 1024

export async function parseBackup(file: File): Promise<ImportResult> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('This file is too large to be a Notely backup.')
  let data: Record<string, unknown>
  try {
    data = JSON.parse(await file.text()) as Record<string, unknown>
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (!data || typeof data !== 'object') throw new Error('This file is not a Notely backup.')
  const rawNotes = Array.isArray(data.notes) ? (data.notes as Record<string, unknown>[]) : []
  const rawFolders = Array.isArray(data.folders) ? (data.folders as Record<string, unknown>[]) : []
  const settings = data.settings && typeof data.settings === 'object' ? normalizeSettings(data.settings) : undefined

  const folderIds = new Set<string>()
  const folders: Folder[] = []
  for (const f of rawFolders) {
    if (!f || typeof f.id !== 'string' || typeof f.name !== 'string' || folderIds.has(f.id)) continue
    folderIds.add(f.id)
    folders.push({
      id: f.id,
      name: f.name.slice(0, 80) || 'Notebook',
      color: isAccent(f.color) ? f.color : 'violet',
      createdAt: Number(f.createdAt) || Date.now(),
    })
  }

  const noteIds = new Set<string>()
  const notes: Note[] = []
  for (const n of rawNotes) {
    if (!n || typeof n !== 'object') continue
    // Duplicate ids inside one file would make two notes share a storage key.
    const id = typeof n.id === 'string' && n.id && !noteIds.has(n.id) ? n.id : uid()
    noteIds.add(id)
    const content = sanitizeHtml(String(n.content ?? ''))
    const folderId = typeof n.folderId === 'string' && folderIds.has(n.folderId) ? n.folderId : null
    notes.push({
      id,
      title: String(n.title ?? 'Untitled note').slice(0, 300),
      content,
      plainText: typeof n.plainText === 'string' ? n.plainText : stripHtml(content),
      folderId,
      tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 40)) : [],
      // Colours end up in inline CSS: only accent ids or #hex, never url(...) or other CSS.
      color: isAccent(n.color) || (typeof n.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(n.color)) ? (n.color as string) : null,
      pinned: !!n.pinned,
      archived: !!n.archived,
      trashed: !!n.trashed,
      createdAt: Number(n.createdAt) || Date.now(),
      updatedAt: Number(n.updatedAt) || Date.now(),
      source: safeUrl(typeof n.source === 'string' ? n.source : null),
    })
  }

  if (!notes.length && !folders.length) throw new Error('No notes or folders found in this file.')
  return { notes, folders, settings }
}
