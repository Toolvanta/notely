function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\*/g, '\\*').replace(/^(\s*)#/gm, '$1\\#')
}

function children(node: Node): string {
  return Array.from(node.childNodes).map(convert).join('')
}

function convert(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent || '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const inner = children(el)

  switch (tag) {
    case 'br': return '\n'
    case 'p': case 'div': return `${inner}\n\n`
    case 'strong': case 'b': return `**${inner}**`
    case 'em': case 'i': return `*${inner}*`
    case 's': case 'strike': case 'del': return `~~${inner}~~`
    case 'u': return `<u>${inner}</u>`
    case 'mark': return `==${inner}==`
    case 'code': return `\`${inner}\``
    case 'pre': return `\n\`\`\`\n${el.textContent || ''}\n\`\`\`\n\n`
    case 'a': return `[${inner}](${el.getAttribute('href') || ''})`
    case 'blockquote':
      return inner.trim().split('\n').map((line) => `> ${line}`).join('\n') + '\n\n'
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
      const level = Number(tag[1])
      return `${'#'.repeat(level)} ${inner}\n\n`
    }
    case 'ul': case 'ol': {
      const ordered = tag === 'ol'
      const start = Number(el.getAttribute('start')) || 1
      const lines = Array.from(el.children).map((li, i) => {
        // Tiptap task items (`li[data-checked]` + label>input) and legacy `li > input` checklists.
        const box = li.querySelector(':scope > label > input[type="checkbox"], :scope > input[type="checkbox"]')
        const isTask = li.hasAttribute('data-checked') || !!box
        const checked = li.getAttribute('data-checked') === 'true' || !!box?.hasAttribute('checked')
        const prefix = isTask ? `- [${checked ? 'x' : ' '}] ` : ordered ? `${start + i}. ` : '- '
        const body = Array.from(li.childNodes)
          .filter((n) => n.nodeName !== 'LABEL' && n.nodeName !== 'INPUT')
          .map(convert).join('')
          .replace(/\n{2,}/g, '\n').trim()
        const [first = '', ...rest] = body.split('\n')
        // Indent continuation lines / nested lists under the item.
        return prefix + first + rest.map((line) => '\n' + ' '.repeat(ordered && !isTask ? prefix.length : 2) + line).join('')
      })
      return `${lines.join('\n')}\n\n`
    }
    case 'input': return ''
    case 'hr': return '\n---\n\n'
    default: return inner
  }
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="root">${html || ''}</div>`, 'text/html')
  const root = doc.getElementById('root')
  if (!root) return ''
  return children(root)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim()
}
