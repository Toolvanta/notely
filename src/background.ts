/// <reference types="chrome" />
/* Notely background service worker (Manifest V3, ES module). */
import { BUBBLE_ORIGINS, KEYS, noteKey, type OpenRequest } from './lib/keys'
import { DEFAULT_SETTINGS, makeNote, normalizeSettings, type Note } from './lib/types'

const BUBBLE_SCRIPT_ID = 'notely-selection-bubble'
const MAX_CAPTURE_CHARS = 50_000

function escapeHtml(str: string): string {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function httpUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

function hostOf(url: string | undefined): string | null {
  const safe = httpUrl(url)
  return safe ? new URL(safe).hostname : null
}

// ---------- Notes ----------
// Each note lives under its own key, so writing one never clobbers edits made elsewhere.
async function addNote(fields: Partial<Note>): Promise<Note> {
  const note = makeNote(fields)
  const res = await chrome.storage.local.get(KEYS.tabs)
  const tabs = Array.isArray(res[KEYS.tabs]) ? (res[KEYS.tabs] as string[]) : []
  const request: OpenRequest = { id: note.id, at: Date.now() }
  await chrome.storage.local.set({
    [noteKey(note.id)]: note,
    // Open the new note as a tab so it is visible in the rail, and ask open views to focus it.
    [KEYS.tabs]: tabs.includes(note.id) ? tabs : [...tabs, note.id],
    [KEYS.openRequest]: request,
  })
  return note
}

// ---------- Feedback ----------
function flashBadge(ok: boolean, title: string) {
  chrome.action.setBadgeBackgroundColor({ color: ok ? '#22c55e' : '#ef4444' }).catch(() => {})
  chrome.action.setBadgeText({ text: ok ? '✓' : '!' }).catch(() => {})
  chrome.action.setTitle({ title: `Notely - ${title}` }).catch(() => {})
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' }).catch(() => {})
    chrome.action.setTitle({ title: 'Open Notely' }).catch(() => {})
  }, 2500)
}

/**
 * Always flashes the toolbar badge. Desktop notifications are an optional permission the user
 * can grant in Settings. Messages never contain note text, so captured content doesn't end up
 * in the operating system's notification history.
 */
async function notify(ok: boolean, title: string, message: string) {
  flashBadge(ok, title)
  try {
    if (!(await chrome.permissions.contains({ permissions: ['notifications'] }))) return
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message,
      priority: 0,
    }, () => void chrome.runtime.lastError)
  } catch { /* notifications unavailable */ }
}

// ---------- Capture ----------
async function saveSelection(text: unknown, title: string | undefined, url: string | undefined) {
  const clean = (typeof text === 'string' ? text : '').trim().slice(0, MAX_CAPTURE_CHARS)
  if (!clean) return null
  const link = httpUrl(url)
  const paragraphs = clean.split(/\n{2,}/).map((p) => '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>').join('')
  const content =
    '<blockquote>' + paragraphs + '</blockquote>' +
    (link ? '<p><a href="' + escapeHtml(link) + '">' + escapeHtml(title || link) + '</a></p>' : '')
  const note = await addNote({
    title: (title || 'Captured note').slice(0, 90),
    content,
    plainText: clean,
    tags: ['capture'],
    source: link,
  })
  void notify(true, 'Selection saved', `Saved a quote from ${hostOf(url) ?? 'this page'}.`)
  return note
}

/** Save the page - or, when the menu was opened on a link, the link itself. */
async function saveLink(url: string | undefined, title: string | undefined, isLink: boolean) {
  const link = httpUrl(url)
  if (!link) {
    void notify(false, 'Can’t save this page', 'Only http and https pages can be saved.')
    return
  }
  const name = (isLink ? title?.trim() || link : title?.trim() || 'Untitled page')
  await addNote({
    title: name.slice(0, 90),
    content: '<h2>' + escapeHtml(name) + '</h2><p><a href="' + escapeHtml(link) + '">' + escapeHtml(link) + '</a></p>',
    plainText: name + ' ' + link,
    tags: ['capture', isLink ? 'link' : 'page'],
    source: link,
  })
  void notify(true, isLink ? 'Link saved' : 'Page saved', `Saved ${hostOf(link)} to Notely.`)
}

/**
 * sidePanel.open() only works while the user gesture is still active, so it must be
 * called synchronously at the start of a command / menu handler - before any await.
 */
function openSidePanel(tab: chrome.tabs.Tab | undefined): Promise<void> {
  if (tab?.windowId !== undefined && tab.windowId !== chrome.windows.WINDOW_ID_NONE && chrome.sidePanel?.open) {
    return chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => openFullApp())
  }
  return openFullApp()
}

function openFullApp(): Promise<void> {
  return chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }).then(() => {}, () => {})
}

/** Read the selection from the active tab. The command invocation grants activeTab, so no host access is needed. */
async function readSelection(tab: chrome.tabs.Tab | undefined) {
  if (!tab?.id || !httpUrl(tab.url)) return null
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => String(window.getSelection() || '').trim().slice(0, 50_000),
    })
    // Title and URL come from the browser, not from the page.
    return { text: typeof result?.result === 'string' ? result.result : '', title: tab.title, url: tab.url }
  } catch {
    return null // the Web Store, PDFs, pages Chrome protects
  }
}

// ---------- Optional selection bubble ----------
// The bubble needs access to web pages, so it is opt-in (Settings → Editor), only matches http(s),
// skips sites the user hid it on, and is registered dynamically.
async function getHiddenSites(): Promise<string[]> {
  const res = await chrome.storage.local.get(KEYS.bubbleHiddenSites)
  const list = res[KEYS.bubbleHiddenSites]
  return Array.isArray(list) ? list.filter((h): h is string => typeof h === 'string' && /^[a-z0-9.-]+$/i.test(h)) : []
}

let syncing: Promise<void> = Promise.resolve()
function syncSelectionBubble() {
  // Serialize: overlapping register/unregister calls would race and throw "duplicate script ID".
  syncing = syncing.then(doSyncSelectionBubble, doSyncSelectionBubble)
  return syncing
}

async function doSyncSelectionBubble() {
  try {
    const res = await chrome.storage.local.get(KEYS.settings)
    const settings = normalizeSettings(res[KEYS.settings])
    const granted = await chrome.permissions.contains({ origins: BUBBLE_ORIGINS })
    if (settings.selectionBubble && !granted) {
      // Access was revoked from chrome://extensions: reflect that in Settings.
      await chrome.storage.local.set({ [KEYS.settings]: { ...settings, selectionBubble: false } })
    }
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [BUBBLE_SCRIPT_ID] })
    if (registered.length) await chrome.scripting.unregisterContentScripts({ ids: [BUBBLE_SCRIPT_ID] })
    if (!settings.selectionBubble || !granted) return
    const hidden = await getHiddenSites()
    await chrome.scripting.registerContentScripts([{
      id: BUBBLE_SCRIPT_ID,
      js: ['content.js'],
      matches: BUBBLE_ORIGINS,
      excludeMatches: hidden.flatMap((host) => [`*://${host}/*`]),
      runAt: 'document_idle',
      allFrames: false,
      persistAcrossSessions: true,
    }])
  } catch (err) {
    console.warn('Notely: could not update selection bubble', err)
  }
}

async function hideBubbleOn(host: string) {
  const hidden = await getHiddenSites()
  if (!hidden.includes(host)) await chrome.storage.local.set({ [KEYS.bubbleHiddenSites]: [...hidden, host] })
  // The storage listener below re-registers the script with the new exclusion.
}

// ---------- Lifecycle ----------
chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get([KEYS.settings, KEYS.folders])
  const defaults: Record<string, unknown> = {}
  if (!existing[KEYS.settings]) defaults[KEYS.settings] = DEFAULT_SETTINGS
  if (!Array.isArray(existing[KEYS.folders])) defaults[KEYS.folders] = []
  if (Object.keys(defaults).length) await chrome.storage.local.set(defaults)
  // 1.0 asked for all-site access up front; drop it unless the user opts into the bubble.
  if (details.reason === 'update') {
    const settings = normalizeSettings(existing[KEYS.settings])
    if (!settings.selectionBubble) await chrome.permissions.remove({ origins: BUBBLE_ORIGINS }).catch(() => false)
  }
  await buildContextMenus()
  await syncSelectionBubble()
  if (details.reason === 'install') void openFullApp() // a welcome tab instead of an install notification
})

chrome.runtime.onStartup.addListener(() => { void syncSelectionBubble() })
chrome.permissions.onAdded.addListener(() => { void syncSelectionBubble() })
chrome.permissions.onRemoved.addListener(() => { void syncSelectionBubble() })
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  const bubble = changes[KEYS.settings]
  const bubbleChanged = bubble && normalizeSettings(bubble.oldValue).selectionBubble !== normalizeSettings(bubble.newValue).selectionBubble
  if (bubbleChanged || changes[KEYS.bubbleHiddenSites]) void syncSelectionBubble()
})

// Context menus persist across service-worker restarts; rebuild them only on install/update.
async function buildContextMenus() {
  await chrome.contextMenus.removeAll()
  const pages = ['http://*/*', 'https://*/*']
  const items: chrome.contextMenus.CreateProperties[] = [
    { id: 'notely-save-selection', title: 'Save selection to Notely', contexts: ['selection'], documentUrlPatterns: pages },
    { id: 'notely-save-link', title: 'Save link to Notely', contexts: ['link'], targetUrlPatterns: pages },
    { id: 'notely-save-page', title: 'Save page to Notely', contexts: ['page'], documentUrlPatterns: pages },
    { id: 'notely-new-note', title: 'New note', contexts: ['action', 'page'] },
    { id: 'notely-open', title: 'Open Notely in a tab', contexts: ['action'] },
  ]
  for (const item of items) chrome.contextMenus.create(item, () => void chrome.runtime.lastError)
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'notely-save-selection':
      // Use the frame/page URL Chrome reports, not anything the page says about itself.
      void saveSelection(info.selectionText, tab?.title, info.frameUrl || info.pageUrl || tab?.url)
      break
    case 'notely-save-link':
      void saveLink(info.linkUrl, info.selectionText || undefined, true)
      break
    case 'notely-save-page':
      void saveLink(info.pageUrl || tab?.url, tab?.title, false)
      break
    case 'notely-new-note':
      void openSidePanel(tab) // first: keeps the user gesture
      void addNote({ title: 'New note' })
      break
    case 'notely-open':
      void openFullApp()
      break
  }
})

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'quick-note') {
    void openSidePanel(tab) // first: keeps the user gesture
    void addNote({ title: 'Quick note' })
  } else if (command === 'open-sidepanel') {
    void openSidePanel(tab)
  } else if (command === 'save-selection') {
    void (async () => {
      const payload = await readSelection(tab)
      if (payload?.text) await saveSelection(payload.text, payload.title, payload.url)
      else if (payload) void notify(false, 'Nothing selected', 'Select some text on the page, then press the shortcut again.')
      else void notify(false, 'Can’t read this page', 'Chrome doesn’t allow extensions to read selections on this page.')
    })()
  }
})

// Only our own content script (the selection bubble) sends messages, and only from a tab.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !sender.tab || !msg || typeof msg.type !== 'string') return
  if (msg.type === 'notely:save-selection' && typeof msg.text === 'string') {
    // Title/URL come from Chrome's view of the sending tab, not from the message.
    saveSelection(msg.text, sender.tab.title, sender.url || sender.tab.url)
      .then((note) => sendResponse({ ok: !!note }))
      .catch(() => sendResponse({ ok: false }))
    return true
  }
  if (msg.type === 'notely:hide-bubble-on-site') {
    const host = hostOf(sender.url || sender.tab.url)
    if (!host) { sendResponse({ ok: false }); return }
    hideBubbleOn(host).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }))
    return true
  }
})
