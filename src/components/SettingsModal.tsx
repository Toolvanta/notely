import { useRef, useState } from 'react'
import {
  AlertTriangle, Database, Download, Info, Keyboard, Moon, Palette,
  RotateCcw, Sun, Trash2, Type, Upload, X,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { exportBackup, parseBackup, type ImportResult } from '../lib/export'
import { ACCENTS, cn, NOTE_COLORS, shortcut } from '../lib/utils'
import type { Accent } from '../lib/types'

type Tab = 'appearance' | 'editor' | 'data' | 'about'

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'editor', label: 'Editor', icon: Type },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'about', label: 'About', icon: Info },
]

export function SettingsModal() {
  const {
    settings, setSettings, setSettingsOpen, notes, folders, importData,
    resetWorkspace, showToast,
  } = useApp()
  const [tab, setTab] = useState<Tab>('appearance')
  const [pending, setPending] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setPending(await parseBackup(file))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not read backup', 'error')
    }
  }

  const finishImport = (mode: 'merge' | 'replace') => {
    if (!pending) return
    importData(pending, mode)
    setPending(null)
    setSettingsOpen(false)
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false) }}>
      <div className="modal">
        <div className="modal__header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={() => setSettingsOpen(false)} title="Close"><X size={17} /></button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '10px 18px 0', borderBottom: '1px solid var(--border)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={cn('segment', tab === t.id && 'segment--active')}
              style={{ borderRadius: '9px 9px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        <div className="modal__body">
          {tab === 'appearance' && (
            <>
              <div className="setting-group-title">Theme</div>
              <div className="setting-row">
                <div className="setting-row__text">
                  <div className="setting-row__label">Color mode</div>
                  <div className="setting-row__desc">Choose what feels easiest on your eyes.</div>
                </div>
                <div className="segmented">
                  {([
                    { id: 'light', icon: Sun, label: 'Light' },
                    { id: 'dark', icon: Moon, label: 'Dark' },
                    { id: 'system', icon: Palette, label: 'Auto' },
                  ] as const).map((item) => (
                    <button
                      key={item.id}
                      className={cn('segment', settings.theme === item.id && 'segment--active')}
                      onClick={() => setSettings({ theme: item.id })}
                    >
                      <item.icon size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />{item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-row__text">
                  <div className="setting-row__label">Accent color</div>
                  <div className="setting-row__desc">Add a splash of personality.</div>
                </div>
                <div className="swatches">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color}
                      className={cn('swatch', settings.accent === color && 'swatch--active')}
                      style={{ background: ACCENTS[color as Accent].hex }}
                      title={ACCENTS[color as Accent].name}
                      onClick={() => setSettings({ accent: color })}
                    />
                  ))}
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-row__text">
                  <div className="setting-row__label">Note density</div>
                  <div className="setting-row__desc">How much space your note list uses.</div>
                </div>
                <div className="segmented">
                  <button className={cn('segment', settings.density === 'comfortable' && 'segment--active')} onClick={() => setSettings({ density: 'comfortable' })}>Comfortable</button>
                  <button className={cn('segment', settings.density === 'compact' && 'segment--active')} onClick={() => setSettings({ density: 'compact' })}>Compact</button>
                </div>
              </div>
            </>
          )}

          {tab === 'editor' && (
            <>
              <div className="setting-group-title">Writing experience</div>
              <div className="setting-row">
                <div className="setting-row__text">
                  <div className="setting-row__label">Font size</div>
                  <div className="setting-row__desc">Body text size in the editor.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input className="range" type="range" min={13} max={20} value={settings.fontSize} onChange={(e) => setSettings({ fontSize: Number(e.target.value) })} />
                  <span style={{ width: 32, textAlign: 'right', fontSize: 12, color: 'var(--text-2)' }}>{settings.fontSize}px</span>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-row__text">
                  <div className="setting-row__label">Font family</div>
                  <div className="setting-row__desc">Pick a typeface for your notes.</div>
                </div>
                <div className="segmented">
                  <button className={cn('segment', settings.fontFamily === 'inter' && 'segment--active')} onClick={() => setSettings({ fontFamily: 'inter' })}>Sans</button>
                  <button className={cn('segment', settings.fontFamily === 'serif' && 'segment--active')} onClick={() => setSettings({ fontFamily: 'serif' })}>Serif</button>
                  <button className={cn('segment', settings.fontFamily === 'mono' && 'segment--active')} onClick={() => setSettings({ fontFamily: 'mono' })}>Mono</button>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-row__text">
                  <div className="setting-row__label">Default sort</div>
                  <div className="setting-row__desc">How notes are ordered in the list.</div>
                </div>
                <select className="select-input" value={settings.sortBy} onChange={(e) => setSettings({ sortBy: e.target.value as typeof settings.sortBy })}>
                  <option value="updated">Recently edited</option>
                  <option value="created">Newest first</option>
                  <option value="title">Title A–Z</option>
                </select>
              </div>
              <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--text-2)', fontSize: 12, lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--accent)' }}>Tip:</strong> Use the toolbar to format text, or select text on any webpage and choose <em>Save selection to Notely</em> from the context menu.
              </div>
            </>
          )}

          {tab === 'data' && (
            <>
              <div className="setting-group-title">Backup &amp; restore</div>
              <div className="setting-row">
                <div className="setting-row__text">
                  <div className="setting-row__label">Export everything</div>
                  <div className="setting-row__desc">Download all notes, notebooks and settings as JSON.</div>
                </div>
                <button className="btn btn--ghost" onClick={() => { exportBackup(notes, folders, settings); showToast('Backup downloaded') }}><Download size={14} /> Export</button>
              </div>
              <div className="setting-row">
                <div className="setting-row__text">
                  <div className="setting-row__label">Import a backup</div>
                  <div className="setting-row__desc">Restore notes from a previously exported file.</div>
                </div>
                <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}><Upload size={14} /> Choose file</button>
              </div>
              {pending && (
                <div style={{ marginTop: 12, padding: 14, borderRadius: 12, border: '1px solid var(--accent)', background: 'var(--accent-soft)' }}>
                  <div style={{ fontSize: 12.5, marginBottom: 10 }}>Found <strong>{pending.notes.length}</strong> notes and <strong>{pending.folders.length}</strong> notebooks. How should we import them?</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn--primary btn--sm" onClick={() => finishImport('merge')}>Merge</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => finishImport('replace')}>Replace all</button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setPending(null)}>Cancel</button>
                  </div>
                </div>
              )}

              <div className="setting-group-title">Danger zone</div>
              <div className="setting-row">
                <div className="setting-row__text">
                  <div className="setting-row__label">Reset to sample data</div>
                  <div className="setting-row__desc">Replace your workspace with the starter notes.</div>
                </div>
                <button className="btn btn--ghost" onClick={() => {
                  if (window.confirm('Reset your workspace? Your current notes will be replaced.')) resetWorkspace()
                }}><RotateCcw size={14} /> Reset</button>
              </div>
              <div className="setting-row">
                <div className="setting-row__text">
                  <div className="setting-row__label" style={{ color: 'var(--danger)' }}>Clear everything</div>
                  <div className="setting-row__desc">Permanently remove all notes and notebooks.</div>
                </div>
                <button className="btn btn--danger" onClick={() => {
                  if (window.confirm('Delete ALL notes permanently? This cannot be undone.')) {
                    importData({ notes: [], folders: [] }, 'replace')
                    setSettingsOpen(false)
                    showToast('All notes cleared', 'info')
                  }
                }}><Trash2 size={14} /> Clear</button>
              </div>
              <div className="stat-row">
                <div className="stat-pill"><strong>{notes.length}</strong><small>Notes stored</small></div>
                <div className="stat-pill"><strong>{folders.length}</strong><small>Notebooks</small></div>
                <div className="stat-pill"><strong>Local</strong><small>Sync across views</small></div>
              </div>
            </>
          )}

          {tab === 'about' && (
            <>
              <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
                <div className="brand-mark" style={{ width: 46, height: 46, margin: '0 auto 12px' }}><Palette size={22} /></div>
                <div style={{ fontSize: 18, fontWeight: 750 }}>Notely</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Version 1.0.0 · Advanced Notepad</div>
              </div>
              <div className="setting-group-title">Keyboard shortcuts</div>
              {[
                ['New note', shortcut('N')], ['Command palette', shortcut('K')],
                ['Save selection', 'Ctrl+Shift+S'], ['Open side panel', 'Ctrl+Shift+O'],
                ['Quick note', 'Ctrl+Shift+Y'], ['Focus search', '/'],
                ['Bold / Italic', 'Ctrl+B / Ctrl+I'],
              ].map(([label, keys]) => (
                <div className="setting-row" key={label} style={{ padding: '8px 0' }}>
                  <div className="setting-row__text"><div className="setting-row__label" style={{ fontSize: 12.5 }}>{label}</div></div>
                  <kbd>{keys}</kbd>
                </div>
              ))}
              <div className="setting-group-title">Notes</div>
              <div style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 12, background: 'var(--surface-subtle)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                <AlertTriangle size={16} style={{ flex: '0 0 auto', color: 'var(--warning)' }} />
                <span>Everything is stored locally in your browser. Nothing leaves your device — keep a backup if you clear browser data.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, fontSize: 11, color: 'var(--text-3)' }}>
                <Keyboard size={13} /> Made for people who think in words.
              </div>
            </>
          )}
        </div>

        <div className="modal__footer">
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Changes save automatically</span>
          <div className="spacer" />
          <button className="btn btn--primary" onClick={() => setSettingsOpen(false)}>Done</button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}
