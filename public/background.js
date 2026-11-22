/* Notely background service worker (Manifest V3). */
'use strict'

const K_NOTES = 'notely:notes'
const K_FOLDERS = 'notely:folders'
const K_SETTINGS = 'notely:settings'
const K_SEEDED = 'notely:seeded'

const DEFAULT_SETTINGS = {
  theme: 'system',
  accent: 'violet',
  fontSize: 15,
  fontFamily: 'inter',
  density: 'comfortable',
  sortBy: 'updated',
  showLineNumbers: false,
}

function uid() {
  return globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

async function getNotes() {
  const res = await chrome.storage.local.get(K_NOTES)
  return Array.isArray(res[K_NOTES]) ? res[K_NOTES] : []
}

async function putNotes(notes) {
  await chrome.storage.local.set({ [K_NOTES]: notes })
}

function makeNote(fields) {
  const now = Date.now()
  return {
    id: uid(),
    title: fields.title || 'Untitled note',
    content: fields.content || '',
    plainText: (fields.plainText || '').slice(0, 20000),
    folderId: fields.folderId ?? null,
    tags: fields.tags || [],
    color: fields.color || null,
    pinned: !!fields.pinned,
    archived: false,
    trashed: false,
    createdAt: now,
    updatedAt: now,
    source: fields.source || null,
  }
}

function htmlToPlain(html) {
  // Service workers have no DOM; use a lightweight tag stripper.
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|pre)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

async function addNote(fields) {
  const notes = await getNotes()
  const note = makeNote({ ...fields, plainText: fields.plainText || htmlToPlain(fields.content) })
  notes.unshift(note)
  await putNotes(notes)
  flashBadge()
  return note
}

function flashBadge() {
  try {
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' })
    chrome.action.setBadgeText({ text: '✓' })
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1400)
  } catch (_) { /* noop */ }
}

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message,
      priority: 0,
    })
  } catch (_) { /* noop */ }
}

async function saveSelection(text, title, url) {
  const clean = String(text || '').trim()
  if (!clean) return null
  const content =
    '<blockquote><p>' + escapeHtml(clean).replace(/\n/g, '<br>') + '</p></blockquote>' +
    (url ? '<p><a href="' + escapeHtml(url) + '">' + escapeHtml(title || url) + '</a></p>' : '')
  const note = await addNote({
    title: (title || 'Captured note').slice(0, 90),
    content,
    plainText: clean,
    tags: ['capture'],
    source: url || null,
  })
  notify('Saved to Notely', clean.slice(0, 120) + (clean.length > 120 ? '…' : ''))
  return note
}

async function savePage(tab) {
  const title = tab.title || 'Untitled page'
  const url = tab.url || ''
  const content =
    '<h2>' + escapeHtml(title) + '</h2>' +
    (url ? '<p><a href="' + escapeHtml(url) + '">' + escapeHtml(url) + '</a></p>' : '')
  const note = await addNote({
    title: title.slice(0, 90),
    content,
    plainText: title + ' ' + url,
    tags: ['capture', 'page'],
    source: url || null,
  })
  notify('Page saved to Notely', title.slice(0, 120))
  return note
}

async function openSidePanel(tabId) {
  try {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ tabId })
      return true
    }
  } catch (_) { /* fall through */ }
  try {
    await chrome.tabs.create({ url: chrome.runtime.getURL('options.html') })
  } catch (_) { /* noop */ }
  return false
}

// ---------- Lifecycle ----------
// Match the doubled popup width so the permanent 30% tab rail has room to breathe.
async function configureSidePanel() {
  try {
    if (chrome.sidePanel && chrome.sidePanel.setOptions) {
      await chrome.sidePanel.setOptions({ width: 760 })
    }
  } catch (_) { /* unsupported Chrome version — keep the default width */ }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const existing = await chrome.storage.local.get([K_SETTINGS, K_FOLDERS])
  const defaults = {}
  if (!existing[K_SETTINGS]) defaults[K_SETTINGS] = DEFAULT_SETTINGS
  if (!Array.isArray(existing[K_FOLDERS])) defaults[K_FOLDERS] = []
  if (Object.keys(defaults).length) await chrome.storage.local.set(defaults)
  buildContextMenus()
  await configureSidePanel()
  if (details.reason === 'install') {
    notify('Welcome to Notely 👋', 'Click the toolbar icon to open your new notepad.')
  }
})

chrome.runtime.onStartup.addListener(() => { buildContextMenus(); void configureSidePanel() })
void configureSidePanel()

function buildContextMenus() {
  try { chrome.contextMenus.removeAll(() => {}) } catch (_) { /* noop */ }
  setTimeout(() => {
    const items = [
      { id: 'notely-save-selection', title: 'Save selection to Notely', contexts: ['selection'] },
      { id: 'notely-save-page', title: 'Save page to Notely', contexts: ['page', 'link'] },
      { id: 'notely-new-note', title: 'New note', contexts: ['action', 'page'] },
      { id: 'notely-open', title: 'Open Notely', contexts: ['action'] },
    ]
    items.forEach((item) => {
      try { chrome.contextMenus.create(item) } catch (_) { /* noop */ }
    })
  }, 60)
}
buildContextMenus()

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'notely-save-selection':
      await saveSelection(info.selectionText, tab?.title, tab?.url)
      break
    case 'notely-save-page':
      await savePage(tab || {})
      break
    case 'notely-new-note':
      await addNote({ title: 'New note', content: '' })
      await openSidePanel(tab?.id)
      break
    case 'notely-open':
      try { await chrome.tabs.create({ url: chrome.runtime.getURL('options.html') }) } catch (_) { /* noop */ }
      break
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (command === 'quick-note') {
    await addNote({ title: 'Quick note', content: '' })
    await openSidePanel(tab?.id)
  } else if (command === 'save-selection') {
    let payload = null
    try {
      if (tab?.id) payload = await chrome.tabs.sendMessage(tab.id, { type: 'notely:get-selection' })
    } catch (_) { /* content script unavailable */ }
    if (payload && payload.text) {
      await saveSelection(payload.text, payload.title, payload.url)
    } else {
      notify('Nothing selected', 'Select some text on the page, then press the shortcut again.')
    }
  } else if (command === 'open-sidepanel') {
    await openSidePanel(tab?.id)
  }
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return
  if (msg.type === 'notely:save-selection') {
    saveSelection(msg.text, msg.title, msg.url).then((note) => sendResponse({ ok: !!note, note })).catch(() => sendResponse({ ok: false }))
    return true
  }
  if (msg.type === 'notely:create-note') {
    addNote(msg.fields || {}).then((note) => sendResponse({ ok: true, note })).catch(() => sendResponse({ ok: false }))
    return true
  }
  if (msg.type === 'notely:open-app') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') })
    sendResponse({ ok: true })
    return true
  }
})
