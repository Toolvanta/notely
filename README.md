# Notely — Advanced Notepad Browser Extension

A beautiful, feature-rich notepad that lives in your browser. Built with **React + TypeScript + Vite** and Manifest V3.

## ✨ Features

### Writing
- Rich-text editor with a **two-row toolbar**: undo/redo, bold, italic, underline, strikethrough, subscript/superscript, highlight, clear formatting; headings (H1–H3), quote, bullet/numbered/check lists, indent/outdent, text alignment, link, code, emoji and divider
- Active formatting is highlighted on the toolbar (e.g. Bold lights up when the caret is in bold text)
- **Emoji picker** — the smiley opens a compact, scrollable grid of 40 emojis to insert
- A single editable note title in the top bar (no duplicate title in the body); the top bar also has Pin and Settings
- Existing note colors still show as the colored dot on each rail tab
- Clean writing surface: the toolbar is immediately followed by the notepad area
- Word and character count in the status bar (darkened for readability)
- Styled typeface menu (Sans / Serif / Mono) plus adjustable font size in Settings

### Organization
- Open notes live in the left rail tabs; an **untitled** tab shows the first few words of its note instead
- Each tab has a quick-delete icon and a **three-dot menu** that opens to the right of the rail: edit, change title, duplicate, pin/unpin tab, delete
- Settings are available from the gear icon in the editor's top-right bar

### Capture from anywhere
- Select text on any webpage → **Save to Notely** bubble
- Right-click → *Save selection to Notely*, *Save page to Notely*, *New note*
- Keyboard shortcuts: `Ctrl+Shift+Y` quick note, `Ctrl+Shift+S` save selection, `Ctrl+Shift+O` side panel

### Layout & UX
- **Wider canvas** — the popup is 760 × 600 px and the side panel is set to 760 px (double the original width)
- **Permanent 30% rail** — the tab list fills 100% of the rail height with no "Open tabs" heading; the + button sits at the top-right. Every tab spans the full rail width with **delete (🗑)** and **three-dot (⋯)** icons; click a tab to switch, middle/right-click for more tab actions
- **Distraction-free workspace** — the note list is gone entirely; the editor fills the remaining 70% of the shell
- **Solid colors only** — all gradients were replaced with flat accent colors
- **Montserrat** is bundled locally and used throughout the UI and editor (no network needed)
- Three surfaces sharing one state: toolbar **popup**, **side panel**, and **full app** (options page)
- Command palette (`Ctrl/⌘ + K`) for settings, theme, note jump, JSON backup/import
- Light / dark / system themes with six accent colors
- Instant sync between popup, side panel, full app and background capture

### Privacy
Everything is stored locally with `chrome.storage.local`. Nothing is sent anywhere.

## 🚀 Install (development)

```bash
npm install
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist` folder

For Firefox, load `dist` via `about:debugging → This Firefox → Load Temporary Add-on` and select `dist/manifest.json` (Manifest V3 support varies by version).

## 🛠 Development

```bash
npm run dev          # Vite dev server
npm run typecheck    # TypeScript check
npm run build        # Icons + typecheck + production build
```

Open `http://localhost:5173/options.html` during `npm run dev` to use the full app in a normal browser tab (storage falls back to `localStorage` outside an extension).

## 📁 Structure

```
public/
  manifest.json      Extension manifest (MV3)
  background.js      Service worker: context menus, commands, capture, notifications
  content.js         Page selection bubble + selection message API
  icons/             Generated PNG icons
src/
  App.tsx            Shell: permanent 30% rail + .workspace (editor only)
  components/        Sidebar + TabBar (open tabs), editor, palette,
                     settings, stats, toast
  lib/               Storage, sanitizer, markdown, export, seed, templates, utilities
  store/             Shared app state with cross-context storage sync
  styles/            Design system + layout tokens (--nav-width)
popup.html           Toolbar popup entry
sidepanel.html       Side panel entry
options.html         Full app entry
```

## ⌨️ Shortcuts

| Action | Shortcut |
| --- | --- |
| New note | `Ctrl/⌘ + N` |
| Command palette | `Ctrl/⌘ + K` |
| Close current note | `Esc`, or click the brand in the rail |
| Close tab (in rail) | Middle-click, or right-click → Close |
| Save selection | `Ctrl + Shift + S` |
| Quick note | `Ctrl + Shift + Y` |
| Open side panel | `Ctrl + Shift + O` |
