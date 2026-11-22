import type { Folder, Note } from './types'
import { stripHtml, uid } from './utils'

const DAY = 86_400_000
const now = Date.now()

function note(fields: Partial<Note> & { title: string; content: string }): Note {
  return {
    id: uid(),
    plainText: stripHtml(fields.content),
    folderId: null,
    tags: [],
    color: null,
    pinned: false,
    archived: false,
    trashed: false,
    createdAt: now - DAY * 3,
    updatedAt: now - Math.random() * DAY * 2,
    source: null,
    ...fields,
  }
}

export function seedFolders(): Folder[] {
  return [
    { id: uid(), name: 'Personal', color: 'rose', createdAt: now - DAY * 10 },
    { id: uid(), name: 'Work', color: 'blue', createdAt: now - DAY * 9 },
    { id: uid(), name: 'Ideas', color: 'amber', createdAt: now - DAY * 8 },
  ]
}

export function seedNotes(folders: Folder[]): Note[] {
  const [personal, work, ideas] = folders
  return [
    note({
      title: 'Welcome to Notely 👋',
      content: `<h2>Your thoughts, beautifully organized.</h2>
<p>Notely is more than a notepad — it's a calm space to think, write, and capture everything that matters. Here's a quick tour:</p>
<blockquote><p><strong>Tip:</strong> Press <code>Ctrl/⌘ + K</code> anywhere to open the command palette and jump to any action.</p></blockquote>
<h3>Getting started</h3>
<ul><li>Create notebooks in the sidebar</li><li>Pin important notes to the top</li><li>Select text on any webpage and save it instantly</li></ul>
<h3>Things to try</h3>
<ul><li><strong>Bold</strong>, <em>italic</em>, and <u>underlined</u> text</li><li>Highlighted <mark>ideas</mark></li><li>Inline <code>code snippets</code></li></ul>
<pre>const idea = "make something wonderful";</pre>
<p>Happy writing! ✨</p>`,
      tags: ['welcome', 'guide'],
      color: 'violet',
      pinned: true,
      folderId: personal.id,
      updatedAt: now - 1000 * 60 * 12,
    }),
    note({
      title: 'This week',
      content: `<h2>Focus &amp; tasks</h2>
<p>Keep the momentum going — small steps every day.</p>
<ul><li>Review the design mockups</li><li>Draft the project brief</li><li>Reply to outstanding emails</li><li>Book that dentist appointment</li></ul>
<p><strong>Win of the week:</strong> shipped the new feature ahead of schedule 🎉</p>`,
      tags: ['todo', 'weekly'],
      color: 'emerald',
      folderId: personal.id,
      updatedAt: now - 1000 * 60 * 60 * 5,
    }),
    note({
      title: 'Product ideas',
      content: `<h2>Things worth building</h2>
<ol><li><strong>Voice notes</strong> — dictate ideas hands-free</li><li><strong>Daily digest</strong> — a morning summary of your notes</li><li><strong>Smart tags</strong> — suggested from note content</li></ol>
<blockquote><p>"Simplicity is the ultimate sophistication."</p></blockquote>
<p>Explore these when there's a quiet afternoon.</p>`,
      tags: ['ideas', 'product'],
      color: 'amber',
      folderId: ideas.id,
      updatedAt: now - DAY,
    }),
    note({
      title: 'Meeting notes — Q3 kickoff',
      content: `<h2>Q3 kickoff</h2>
<p><strong>Attendees:</strong> Alex, Priya, Sam</p>
<h3>Decisions</h3>
<ul><li>Ship the beta by end of month</li><li>Weekly check-ins on Thursdays</li></ul>
<h3>Action items</h3>
<ul><li>Priya — finalize roadmap</li><li>Alex — prepare demo environment</li><li>Sam — update documentation</li></ul>`,
      tags: ['meeting', 'work'],
      color: 'blue',
      folderId: work.id,
      updatedAt: now - DAY * 2,
    }),
    note({
      title: 'Reading list',
      content: `<h2>Books &amp; articles</h2>
<ul><li>Deep Work — Cal Newport</li><li>The Design of Everyday Things — Don Norman</li><li>Thinking in Systems — Donella Meadows</li></ul>
<p>Save interesting quotes here as you read.</p>`,
      tags: ['reading'],
      folderId: personal.id,
      updatedAt: now - DAY * 3,
    }),
    note({
      title: 'Saved from the web',
      content: `<blockquote><p>Good design is as little design as possible.</p></blockquote>
<p><a href="https://en.wikipedia.org/wiki/Diet_Rams">Dieter Rams</a></p>`,
      tags: ['capture', 'quote'],
      color: 'rose',
      source: 'https://en.wikipedia.org/wiki/Diet_Rams',
      updatedAt: now - DAY * 4,
    }),
  ]
}
