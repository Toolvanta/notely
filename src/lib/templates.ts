export interface NoteTemplate {
  id: string
  name: string
  description: string
  title: string
  tags: string[]
  content: string
}

export const TEMPLATES: NoteTemplate[] = [
  {
    id: 'meeting',
    name: 'Meeting notes',
    description: 'Agenda, decisions and action items',
    title: 'Meeting notes',
    tags: ['meeting'],
    content: `<h2>Meeting notes</h2>
<p><strong>Date:</strong> {{date}} &nbsp; <strong>Attendees:</strong> </p>
<h3>Agenda</h3>
<ul><li></li></ul>
<h3>Decisions</h3>
<ul><li></li></ul>
<h3>Action items</h3>
<ul><li><input type="checkbox"> </li></ul>`,
  },
  {
    id: 'journal',
    name: 'Daily journal',
    description: 'A page for reflection',
    title: 'Journal',
    tags: ['journal', 'daily'],
    content: `<h2>{{date}}</h2>
<p><strong>How I'm feeling:</strong> </p>
<h3>Today's highlights</h3>
<ul><li></li></ul>
<h3>What I learned</h3>
<p></p>
<h3>Tomorrow</h3>
<ul><li><input type="checkbox"> </li></ul>`,
  },
  {
    id: 'todo',
    name: 'Task list',
    description: 'A simple checklist',
    title: 'Tasks',
    tags: ['todo'],
    content: `<h2>To do</h2>
<ul>
<li><input type="checkbox"> First task</li>
<li><input type="checkbox"> Second task</li>
<li><input type="checkbox"> Third task</li>
</ul>
<h3>Done ✓</h3>
<ul><li><input type="checkbox" checked> </li></ul>`,
  },
  {
    id: 'code',
    name: 'Code snippet',
    description: 'Save a useful piece of code',
    title: 'Code snippet',
    tags: ['code'],
    content: `<h2>Code snippet</h2>
<p><strong>Language:</strong> </p>
<pre><code>// Paste your code here
</code></pre>
<p><strong>Notes:</strong> </p>`,
  },
]

export function templateContent(template: NoteTemplate): string {
  return template.content.replace(/\{\{date\}\}/g, new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }))
}

export function dailyNoteTitle(date = new Date()): string {
  const key = date.toISOString().slice(0, 10)
  return `Daily — ${key}`
}

export function makeDailyNote(): { title: string; content: string; tags: string[]; color: string } {
  const date = new Date()
  const title = dailyNoteTitle(date)
  const content = `<h2>${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
<p>A fresh page for today. What matters most?</p>
<h3>Focus</h3>
<ul><li><input type="checkbox"> </li></ul>
<h3>Notes</h3>
<p></p>
<h3>Gratitude</h3>
<p></p>`
  return { title, content, tags: ['daily', 'journal'], color: 'blue' }
}
