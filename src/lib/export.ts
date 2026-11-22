import type { Folder, Note, Settings } from './types'
import { htmlToMarkdown } from './markdown'
import { sanitizeHtml } from './sanitize'
import { formatFullDate } from './utils'

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
<article>${note.content || '<p><em>Empty note</em></p>'}</article>
${note.source ? `<p><a href="${escape(note.source)}">Open source ↗</a></p>` : ''}
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

export async function parseBackup(file: File): Promise<ImportResult> {
  const text = await file.text()
  const data = JSON.parse(text) as Record<string, unknown>
  const notes = Array.isArray(data.notes) ? (data.notes as Note[]) : []
  const folders = Array.isArray(data.folders) ? (data.folders as Folder[]) : []
  const settings = data.settings && typeof data.settings === 'object' ? (data.settings as Settings) : undefined

  const cleanNotes = notes
    .filter((n) => n && typeof n.id === 'string')
    .map((n) => ({
      ...n,
      title: String(n.title || 'Untitled note'),
      content: sanitizeHtml(String(n.content || '')),
      plainText: String(n.plainText || ''),
      tags: Array.isArray(n.tags) ? n.tags.filter((t) => typeof t === 'string') : [],
      pinned: !!n.pinned,
      archived: !!n.archived,
      trashed: !!n.trashed,
      createdAt: Number(n.createdAt) || Date.now(),
      updatedAt: Number(n.updatedAt) || Date.now(),
    }))

  if (!cleanNotes.length && !folders.length) throw new Error('No notes or folders found in this file.')
  return { notes: cleanNotes, folders, settings }
}
