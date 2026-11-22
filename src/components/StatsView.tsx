import { useMemo } from 'react'
import { BarChart3, BookOpen, FileText, Hash, PenLine, TrendingUp } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { wordCount } from '../lib/utils'

const DAY = 86_400_000

export function StatsView() {
  const { notes, folders } = useApp()

  const stats = useMemo(() => {
    const active = notes.filter((n) => !n.trashed)
    const words = active.reduce((sum, n) => sum + wordCount(n.plainText), 0)
    const chars = active.reduce((sum, n) => sum + n.plainText.length, 0)
    const tags = new Set(active.flatMap((n) => n.tags))
    const days = Array.from({ length: 7 }, (_, i) => {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const dayStart = start.getTime() - (6 - i) * DAY
      const count = active.filter((n) => n.updatedAt >= dayStart && n.updatedAt < dayStart + DAY).length
      return {
        label: new Date(dayStart).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2),
        count,
      }
    })
    const byFolder = folders.map((f) => ({
      name: f.name,
      color: f.color,
      count: active.filter((n) => n.folderId === f.id).length,
    })).sort((a, b) => b.count - a.count)
    const max = Math.max(1, ...days.map((d) => d.count))
    return { total: active.length, words, chars, tags: tags.size, days, max, byFolder, archived: notes.filter((n) => n.archived).length }
  }, [notes, folders])

  const cards = [
    { icon: FileText, label: 'Total notes', value: stats.total, tone: 'violet' },
    { icon: PenLine, label: 'Words written', value: stats.words.toLocaleString(), tone: 'blue' },
    { icon: BookOpen, label: 'Characters', value: stats.chars.toLocaleString(), tone: 'emerald' },
    { icon: Hash, label: 'Unique tags', value: stats.tags, tone: 'amber' },
  ]

  return (
    <section className="stats-view">
      <div className="stats-view__inner">
        <h1>Your writing, in numbers</h1>
        <p className="stats-view__sub">A little snapshot of everything you've captured in Notely.</p>

        <div className="stats-grid">
          {cards.map((card) => (
            <div className="stat-card" key={card.label}>
              <div className="stat-card__icon"><card.icon size={16} /></div>
              <strong>{card.value}</strong>
              <small>{card.label}</small>
            </div>
          ))}
        </div>

        <div className="chart-card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={15} /> Activity this week</h3>
          <div className="chart-bars">
            {stats.days.map((day, i) => (
              <div className="chart-bar-wrap" key={i}>
                <div className="chart-bar" style={{ height: `${Math.max(3, (day.count / stats.max) * 100)}%` }} title={`${day.count} note${day.count === 1 ? '' : 's'}`} />
                <span className="chart-label">{day.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card" style={{ marginTop: 14 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={15} /> Notes by notebook</h3>
          {stats.byFolder.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
              {stats.byFolder.map((f) => (
                <div key={f.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{f.name}</span>
                    <span style={{ color: 'var(--text-3)' }}>{f.count}</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-hover)', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.total ? (f.count / stats.total) * 100 : 0}%`, height: '100%', borderRadius: 99, background: `var(--accent)` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-3)', fontSize: 12.5 }}>Create a notebook to see the breakdown here.</p>
          )}
        </div>
      </div>
    </section>
  )
}
