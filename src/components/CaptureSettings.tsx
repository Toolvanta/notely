import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { BUBBLE_ORIGINS, KEYS } from '../lib/keys'
import { storage, subscribe } from '../lib/storage'
import { cn } from '../lib/utils'

const perms = () => (typeof chrome !== 'undefined' ? chrome.permissions : undefined)

/**
 * Capture & privacy settings. Everything here is opt-in and backed by an optional Chrome
 * permission that is requested only when switched on and released when switched off.
 */
export function CaptureSettings() {
  const { settings, setSettings, showToast } = useApp()
  const [hiddenSites, setHiddenSites] = useState<string[]>([])
  const [notifications, setNotifications] = useState(false)

  useEffect(() => {
    void storage.getHiddenSites().then(setHiddenSites)
    void perms()?.contains({ permissions: ['notifications'] }).then(setNotifications).catch(() => {})
    return subscribe((batch) => {
      for (const { key, value } of batch) {
        if (key === KEYS.bubbleHiddenSites) setHiddenSites(Array.isArray(value) ? (value as string[]) : [])
      }
    })
  }, [])

  // Chrome only shows the permission prompt in response to a click, so request() runs straight away.
  const toggleBubble = async () => {
    const p = perms()
    if (settings.selectionBubble) {
      setSettings({ selectionBubble: false })
      try { await p?.remove({ origins: BUBBLE_ORIGINS }) } catch { /* already gone */ }
      return
    }
    if (!p) { showToast('Only available in the installed extension', 'error'); return }
    try {
      if (await p.request({ origins: BUBBLE_ORIGINS })) setSettings({ selectionBubble: true })
      else showToast('Site access was not granted', 'info')
    } catch {
      showToast('Could not request site access', 'error')
    }
  }

  const toggleNotifications = async () => {
    const p = perms()
    if (!p) { showToast('Only available in the installed extension', 'error'); return }
    try {
      if (notifications) {
        await p.remove({ permissions: ['notifications'] })
        setNotifications(false)
      } else {
        const granted = await p.request({ permissions: ['notifications'] })
        setNotifications(granted)
        if (!granted) showToast('Notifications were not allowed', 'info')
      }
    } catch {
      showToast('Could not change the notification permission', 'error')
    }
  }

  const showOn = (host: string) => {
    const next = hiddenSites.filter((h) => h !== host)
    setHiddenSites(next)
    void storage.setHiddenSites(next)
  }

  return (
    <>
      <div className="setting-group-title">Capture &amp; privacy</div>
      <div className="setting-row">
        <div className="setting-row__text">
          <div className="setting-row__label">“Save to Notely” bubble on web pages</div>
          <div className="setting-row__desc">
            Shows a save button when you select text on http(s) pages. Needs access to web pages, so it’s off by default.
            Nothing is read or sent until you click it. The right-click menu and Alt+Shift+S work without it.
          </div>
        </div>
        <button
          className={cn('toggle', settings.selectionBubble && 'toggle--on')}
          role="switch"
          aria-checked={settings.selectionBubble}
          aria-label="Selection bubble"
          onClick={() => void toggleBubble()}
        />
      </div>
      {hiddenSites.length > 0 && (
        <div className="setting-row setting-row--stack">
          <div className="setting-row__text">
            <div className="setting-row__label">Hidden on these sites</div>
            <div className="setting-row__desc">You turned the bubble off here with its ✕ button.</div>
          </div>
          <div className="site-chips">
            {hiddenSites.map((host) => (
              <span key={host} className="site-chip">
                {host}
                <button title={`Show the bubble on ${host} again`} aria-label={`Show the bubble on ${host} again`} onClick={() => showOn(host)}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="setting-row">
        <div className="setting-row__text">
          <div className="setting-row__label">Desktop notifications when capturing</div>
          <div className="setting-row__desc">The toolbar icon always flashes ✓. Notifications never include the captured text.</div>
        </div>
        <button
          className={cn('toggle', notifications && 'toggle--on')}
          role="switch"
          aria-checked={notifications}
          aria-label="Desktop notifications"
          onClick={() => void toggleNotifications()}
        />
      </div>
    </>
  )
}
