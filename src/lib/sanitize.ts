const FORBIDDEN = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
  'form', 'button', 'select', 'textarea', 'svg', 'math', 'applet', 'frame', 'frameset',
])

/** Lightweight HTML sanitizer for note content. Keeps rich-text formatting, strips anything executable. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="notely-root">${html || ''}</div>`, 'text/html')
  const root = doc.getElementById('notely-root')
  if (!root) return ''

  const remove: Element[] = []
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  while (walker.nextNode()) {
    const el = walker.currentNode as Element
    const tag = el.tagName.toLowerCase()
    if (FORBIDDEN.has(tag) || (tag === 'input' && el.getAttribute('type')?.toLowerCase() !== 'checkbox')) {
      remove.push(el)
      continue
    }
    if (tag === 'input') {
      Array.from(el.attributes).forEach((attr) => {
        if (!['type', 'checked', 'disabled'].includes(attr.name.toLowerCase())) el.removeAttribute(attr.name)
      })
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || name === 'srcdoc') {
        el.removeAttribute(attr.name)
      } else if ((name === 'href' || name === 'src' || name === 'xlink:href') &&
        (value.startsWith('javascript:') || (value.startsWith('data:') && !value.startsWith('data:image/')))) {
        el.removeAttribute(attr.name)
      } else if (name === 'style' && /expression|url\s*\(\s*['"]?\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name)
      }
    }
  }
  remove.forEach((el) => el.remove())
  return root.innerHTML
}

/** Turn arbitrary plain text into safe HTML paragraphs with preserved line breaks. */
export function plainToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escape(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
