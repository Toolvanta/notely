/**
 * Storage keys shared by the UI and the background service worker.
 * This module must stay free of DOM / React imports - the service worker loads it.
 */
export const KEYS = {
  /** Legacy single-array notes key (pre per-note storage). Only read for migration. */
  legacyNotes: 'notely:notes',
  notePrefix: 'notely:note:',
  folders: 'notely:folders',
  settings: 'notely:settings',
  seeded: 'notely:seeded',
  tabs: 'notely:tabs',
  /** Active note is per surface (popup / side panel / full app), so views don't hijack each other. */
  activeTabPrefix: 'notely:active-tab:',
  pinnedTabs: 'notely:pinned-tabs',
  history: 'notely:history',
  /** Written by the background to ask open surfaces to focus a freshly created note. */
  openRequest: 'notely:open-request',
  /** Hostnames where the user turned the selection bubble off. */
  bubbleHiddenSites: 'notely:bubble-hidden-sites',
} as const

/** Site access the optional selection bubble needs. Web pages only - never file:// or other schemes. */
export const BUBBLE_ORIGINS = ['http://*/*', 'https://*/*']

export const noteKey = (id: string) => KEYS.notePrefix + id
export const isNoteKey = (key: string) => key.startsWith(KEYS.notePrefix)
export const noteIdFromKey = (key: string) => key.slice(KEYS.notePrefix.length)

export interface OpenRequest { id: string; at: number }
