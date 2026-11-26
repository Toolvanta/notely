import DOMPurify from 'dompurify'

/**
 * Allow-list sanitizer for note HTML (DOMPurify). Only the markup the editor can produce
 * survives: no scripts, forms, iframes, SVG, event handlers or remote images, and links are
 * limited to http(s) / mailto.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'hr',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'sub', 'sup', 'mark', 'a', 'span', 'div',
  'ul', 'ol', 'li', 'label', 'input',
]
const ALLOWED_ATTR = ['href', 'target', 'rel', 'type', 'checked', 'disabled', 'data-type', 'data-checked', 'data-color', 'style', 'start']
// DOMPurify's standard shape, restricted to http(s)/mailto. Values without a scheme (e.g. `type="checkbox"`,
// relative links) are allowed; anything with another scheme (javascript:, data:, vbscript:) is not.
const SAFE_URI = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i
// Inline styles the editor itself emits (text alignment, highlight colours). Anything else is dropped.
const SAFE_STYLE = /^(?:\s*(?:text-align|background-color|color)\s*:\s*[#\w\s(),.%-]+;?)+\s*$/i

let hooked = false
function ensureHooks() {
  if (hooked) return
  hooked = true
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    // ALLOW_DATA_ATTR:false would also drop the data-* attributes we need, so filter them here.
    if (data.attrName.startsWith('data-') && !ALLOWED_ATTR.includes(data.attrName)) data.keepAttr = false
    if (data.attrName === 'style' && (!SAFE_STYLE.test(data.attrValue) || /url\s*\(/i.test(data.attrValue))) {
      data.keepAttr = false
    }
    if (data.attrName === 'type' && data.attrValue.toLowerCase() !== 'checkbox') data.keepAttr = false
  })
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer nofollow')
    }
    if (node.tagName === 'INPUT' && node.getAttribute('type') !== 'checkbox') node.remove()
  })
}

export function sanitizeHtml(html: string): string {
  ensureHooks()
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: SAFE_URI,
    KEEP_CONTENT: true,
  })
}

/**
 * Notes written by the old execCommand editor stored checklists as
 * `<ul><li><input type="checkbox"> text</li></ul>`. Convert them to Tiptap task lists
 * so the checkboxes survive the editor's schema.
 */
export function upgradeLegacyHtml(html: string): string {
  if (!html || !/<input[^>]+checkbox/i.test(html) || /data-type="taskList"/.test(html)) return html
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html')
  const root = doc.getElementById('root')
  if (!root) return html
  root.querySelectorAll('ul').forEach((ul) => {
    const items = Array.from(ul.children)
    const isChecklist = items.length > 0 && items.every((li) => li.tagName === 'LI' && li.querySelector(':scope > input[type="checkbox"]'))
    if (!isChecklist) return
    ul.setAttribute('data-type', 'taskList')
    items.forEach((li) => {
      const box = li.querySelector(':scope > input[type="checkbox"]') as HTMLInputElement
      const checked = box.hasAttribute('checked')
      box.remove()
      li.setAttribute('data-type', 'taskItem')
      li.setAttribute('data-checked', String(checked))
      const p = doc.createElement('p')
      while (li.firstChild) p.appendChild(li.firstChild)
      p.innerHTML = p.innerHTML.trim()
      li.appendChild(p)
    })
  })
  return root.innerHTML
}
