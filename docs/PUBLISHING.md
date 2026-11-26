# Publishing Notely to the Chrome Web Store

A step-by-step checklist, with copy-paste text for every field the dashboard asks for.

---

## 1. One-time setup

1. Sign in with the Google account that should own the listing. A dedicated account for your publishing work is a good idea.
2. Turn on **2-Step Verification** for that account. The Web Store requires it to publish.
3. Open the **[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)**, accept the developer agreement and pay the one-time **registration fee** (US$5 at the time of writing).
4. Under **Account**, set the **publisher name** shown on the listing (for example *Toolvanta* or *Shoaib Arif*), and **verify your contact email**. You can't publish without a verified email.
5. *(Optional)* Verify a website you own, such as `toolenhancer.com`, in [Google Search Console](https://search.google.com/search-console) so the listing can show it as the official site.

## 2. Build the package

```bash
# 1. Bump the version in BOTH files (the store rejects re-uploads of the same version)
#    public/manifest.json  →  "version": "1.1.0"
#    package.json          →  "version": "1.1.0"

# 2. Build and zip
npm install
npm run package
# → release/notely-1.1.0.zip
```

Before uploading, load `dist/` as an unpacked extension (`chrome://extensions` → Developer mode → **Load unpacked**) and check:

- [ ] popup, side panel (`Alt+Shift+O`) and full tab all open and show the same notes;
- [ ] right-click **Save selection / page / link** creates notes;
- [ ] `Alt+Shift+S` saves the selected text, and `Alt+Shift+Q` opens a quick note;
- [ ] Settings → Editor: turning on the bubble shows Chrome's permission prompt, the bubble appears on a page, and its **✕** hides it there;
- [ ] Settings → Editor: the notifications toggle shows Chrome's permission prompt;
- [ ] no errors on the service worker's console (`chrome://extensions` → Notely → *service worker*).

## 3. Create the item

In the dashboard, click **New item** and upload `release/notely-<version>.zip`. Then fill in the tabs below.

### Store listing

| Field | Value |
| --- | --- |
| **Name** | Notely - Advanced Notepad *(from the manifest)* |
| **Summary** | A beautiful, feature-rich notepad for your browser. Write, organize, capture and find your notes instantly. *(from the manifest; max 132 characters)* |
| **Category** | Productivity → Tools *(or Workflow & Planning)* |
| **Language** | English |
| **Store icon** | `public/icons/icon128.png` (128×128) |
| **Screenshots** | Upload 1–5 from `docs/store/screenshots/` (all exactly 1280×800). Suggested order: `editor-light`, `library`, `note-menu`, `version-history`, `editor-dark` |
| **Small promo tile** | `docs/store/promo-small-440x280.png` |
| **Marquee promo tile** *(optional)* | `docs/store/promo-marquee-1400x560.png` |
| **Official URL** | Your verified site, if you did step 1.5 |
| **Homepage URL** | `https://github.com/Toolvanta/notely` |
| **Support URL** | `https://github.com/Toolvanta/notely/issues` |

**Description** (paste and edit as you like):

```
Notely is a fast, private notepad that lives in your browser. Open it from the toolbar, keep it in Chrome's side panel, or use it in a full tab. Your notes stay in sync everywhere.

WRITE
• Rich-text editor: headings, bold/italic/underline, highlights, quotes, code blocks, links and emoji
• Markdown shortcuts as you type: "# " heading, "- " list, "[ ] " checklist, "> " quote, ``` code
• Checklists with nesting, reliable undo/redo, and clean pasting from any website

ORGANIZE
• Search all notes, filter by notebook or tag, pin and archive
• Version history: preview and restore earlier versions of any note
• Trash with undo: nothing is deleted by accident
• Command palette (Ctrl/⌘+K) for every action

CAPTURE
• Right-click → Save selection, page or link to Notely
• Alt+Shift+S saves the selected text; Alt+Shift+Q starts a quick note
• Optional "Save to Notely" button on text selection, which you can hide per site

EXPORT
• Markdown, HTML or plain text, or copy as Markdown
• Full JSON backup and restore

PRIVATE BY DESIGN
• Everything is stored locally on your device. No account, no servers, no tracking
• No access to websites unless you turn on the optional selection button

Open source: https://github.com/Toolvanta/notely
```

### Privacy practices

**Single purpose**

```
Notely is a notepad: it lets users write, organize and export notes, and save text, pages or links they choose from websites into those notes.
```

**Permission justifications**

| Permission | Justification to paste |
| --- | --- |
| `storage` | Saves the user's notes, notebooks, settings and version history locally on the device. |
| `unlimitedStorage` | Users can keep many long notes plus version history; this avoids silently hitting the default local storage quota and losing data. |
| `activeTab` | When the user presses the "Save selection" shortcut, reads the selected text and page title of the current tab only, to save it as a note. |
| `scripting` | Used with activeTab to read the user's text selection when they press the save shortcut, and to register the optional selection button only after the user enables it in Settings. |
| `contextMenus` | Adds "Save selection / page / link to Notely" and "New note" to the right-click menu. |
| `sidePanel` | Lets users keep Notely open in Chrome's side panel while browsing. |
| Optional host permission `http://*/*`, `https://*/*` | Requested only if the user turns on the optional "Save to Notely" selection button in Settings, so it can appear next to selected text on web pages. Removed when the user turns it off. |
| Optional `notifications` | Requested only if the user turns on capture notifications in Settings; shows a short confirmation that never contains the captured text. |

**Remote code:** *No, I am not using remote code.* All JavaScript is bundled in the package, and the CSP is `script-src 'self'`.

**Data usage:** Notely doesn't collect or transmit user data. Everything stays in `chrome.storage.local` on the user's device. In the data-type checklist, leave everything unchecked, then tick all three certifications:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

> If a reviewer disagrees and asks you to declare **Website content** (the text users choose to save), tick it. The answers above still apply, because the data never leaves the device.

**Privacy policy URL**

```
https://github.com/Toolvanta/notely/blob/master/PRIVACY.md
```

*(Push `PRIVACY.md` to GitHub first; this URL must be publicly reachable.)*

### Distribution

- **Visibility:** *Public*. Or choose *Unlisted* to test the store install with a private link first.
- **Regions:** all regions.
- **Pricing:** free.

## 4. Submit for review

Click **Submit for review**. Reviews usually take from a few days to a couple of weeks. Narrow, well-justified permissions (like Notely's) tend to go faster. You'll get an email when the item is approved or needs changes, and you can choose to publish automatically on approval or by hand.

After it's live, add the store link to the README's **Install** section.

## 5. Shipping updates

1. Make your changes, then bump `version` in `public/manifest.json` **and** `package.json` (e.g. `1.1.0` → `1.1.1`).
2. Run `npm run package`.
3. In the dashboard, open Notely → **Package** → **Upload new package**, select the new zip, then **Submit for review**.
4. Chrome updates installed copies automatically within a few hours of approval.

> Adding a **new required permission** in an update disables the extension for existing users until they accept it. Prefer optional permissions, as Notely already does.

## Common rejection reasons (and how Notely avoids them)

| Reason | Status |
| --- | --- |
| Requesting broad host permissions without need | Host access is optional and only for the bubble ✔ |
| Unclear single purpose / keyword stuffing | One clear purpose; plain description ✔ |
| Missing privacy policy when handling user data | `PRIVACY.md` ✔ |
| Remote code / `eval` | None; strict CSP ✔ |
| Screenshots of the wrong size | 1280×800 in `docs/store/screenshots/` ✔ |
| Misleading branding or name | Name and icon are original ✔ |
