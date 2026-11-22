import type { Accent } from './types'

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function stripHtml(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim()
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function wordCount(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

export function readingTime(text: string): number {
  return Math.max(1, Math.ceil(wordCount(text) / 220))
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

export function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), wait)
  }
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
  return ACCENTS[color as Accent]?.hex || color
}

export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  if (!query.trim()) return [{ text, hit: false }]
  const q = query.trim().toLowerCase()
  const lower = text.toLowerCase()
  const parts: { text: string; hit: boolean }[] = []
  let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(q, i)
    if (idx === -1) { parts.push({ text: text.slice(i), hit: false }); break }
    if (idx > i) parts.push({ text: text.slice(i, idx), hit: false })
    parts.push({ text: text.slice(idx, idx + q.length), hit: true })
    i = idx + q.length
  }
  return parts
}

export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
}

export function shortcut(key: string): string {
  return isMac() ? `⌘${key}` : `Ctrl+${key}`
}
