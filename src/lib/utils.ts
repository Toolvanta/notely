import type { Accent } from './types'

export { uid } from './types'

/** Only http(s) and mailto links may be opened from note content. */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : null
  } catch {
    return null
  }
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function stripHtml(html: string): string {
  // DOMParser builds an inert document: no resources load and no handlers run.
  const doc = new DOMParser().parseFromString(html || '', 'text/html')
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim()
}

export function wordCount(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

export function excerpt(text: string, max = 120): string {
  if (!text) return 'No additional text'
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

export function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp
  const sec = Math.round(diff / 1000)
  if (sec < 45) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.round(hr / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export const ACCENTS: Record<Accent, { name: string; hex: string; soft: string }> = {
  violet: { name: 'Violet', hex: '#7c5cff', soft: '#efeaff' },
  blue: { name: 'Ocean', hex: '#3b82f6', soft: '#e6f0ff' },
  emerald: { name: 'Emerald', hex: '#10b981', soft: '#e2f8f0' },
  rose: { name: 'Rose', hex: '#f43f5e', soft: '#ffe8ee' },
  amber: { name: 'Amber', hex: '#f59e0b', soft: '#fff3d9' },
  slate: { name: 'Slate', hex: '#64748b', soft: '#e9eef5' },
}

export const NOTE_COLORS = ['violet', 'blue', 'emerald', 'rose', 'amber', 'slate'] as const

export function colorHex(color: string | null, fallback = '#7c5cff'): string {
  if (!color) return fallback
  // Used in inline styles: never pass arbitrary strings (e.g. url(...)) through.
  return ACCENTS[color as Accent]?.hex || (/^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback)
}

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
}

export function shortcut(key: string): string {
  return isMac() ? `⌘${key}` : `Ctrl+${key}`
}
