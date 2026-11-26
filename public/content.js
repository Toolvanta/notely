/*
 * Notely selection bubble - optional content script.
 * Registered by the background only when the user turns it on in Settings, grants access to
 * web pages, and hasn't hidden it on this site. Runs in the isolated world; the page can't see
 * or drive it (closed shadow root, trusted events only). Nothing is read or sent until the user
 * clicks "Save to Notely".
 */
;(function () {
  'use strict'
  // Guard against double injection (e.g. re-registration after an extension update).
  if (window.__notelySelectionBubble) return
  window.__notelySelectionBubble = true

  var MAX_CHARS = 50000
  var host = null
  var button = null
  var label = null
  var savedTimer = null
  var selectionTimer = null
  var currentSelection = ''

  var SVG_NS = 'http://www.w3.org/2000/svg'
  function svgIcon(paths, stroke) {
    var svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', stroke)
    svg.setAttribute('stroke-width', '2.2')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    paths.forEach(function (d) {
      var p = document.createElementNS(SVG_NS, 'path')
      p.setAttribute('d', d)
      svg.appendChild(p)
    })
    return svg
  }

  function ensureBubble() {
    if (host) return
    host = document.createElement('div')
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;pointer-events:none;'
    // Closed: page scripts can't reach in to read the selection or click the button.
    var shadow = host.attachShadow({ mode: 'closed' })
    var style = document.createElement('style')
    style.textContent = [
      ':host{all:initial}',
      '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
      '.wrap{display:flex;align-items:center;gap:2px;opacity:0;transform:translateY(5px) scale(.96);',
      'transition:opacity .16s ease,transform .16s cubic-bezier(.2,.9,.3,1.3);pointer-events:none}',
      '.wrap.show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}',
      '.bubble,.close{display:flex;align-items:center;gap:7px;border-radius:11px;border:1px solid rgba(255,255,255,.14);',
      'background:rgba(24,22,38,.94);color:#fff;font-size:12.5px;font-weight:600;cursor:pointer;user-select:none;white-space:nowrap;',
      'box-shadow:0 10px 30px rgba(15,12,40,.38),0 2px 8px rgba(0,0,0,.25)}',
      '.bubble{padding:7px 12px 7px 9px}',
      '.close{padding:0;width:26px;height:26px;justify-content:center;opacity:.75}',
      '.bubble:hover,.close:hover{background:rgba(38,34,62,.98);opacity:1}',
      '.bubble:focus-visible,.close:focus-visible{outline:2px solid #a78bfa;outline-offset:2px}',
      '.mark{width:20px;height:20px;border-radius:6px;display:grid;place-items:center;background:#7c5cff}',
      '.mark svg{width:13px;height:13px;display:block}.close svg{width:12px;height:12px;display:block}',
      '.bubble.saved .mark{background:#16a34a}',
    ].join('')
    shadow.appendChild(style)

    var wrap = document.createElement('div')
    wrap.className = 'wrap'

    button = document.createElement('div')
    button.className = 'bubble'
    button.setAttribute('role', 'button')
    button.setAttribute('tabindex', '0')
    button.title = 'Save selection to Notely'
    var mark = document.createElement('span')
    mark.className = 'mark'
    mark.appendChild(svgIcon(['M6 3h9l4 4v14H6z', 'M14 3v5h5', 'M9 13h7M9 17h5'], 'white'))
    label = document.createElement('span')
    label.textContent = 'Save to Notely'
    button.appendChild(mark)
    button.appendChild(label)

    var close = document.createElement('div')
    close.className = 'close'
    close.setAttribute('role', 'button')
    close.setAttribute('tabindex', '0')
    close.title = 'Don’t show on this site'
    close.appendChild(svgIcon(['M6 6l12 12', 'M18 6L6 18'], 'white'))

    wrap.appendChild(button)
    wrap.appendChild(close)
    shadow.appendChild(wrap)
    button._wrap = wrap

    activate(button, onSave)
    activate(close, onHideOnSite)
    document.documentElement.appendChild(host)
  }

  /** Only real user input counts - a page can't trigger saves with synthetic clicks. */
  function activate(el, fn) {
    el.addEventListener('click', function (e) { if (e.isTrusted) fn() })
    el.addEventListener('keydown', function (e) {
      if (!e.isTrusted) return
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
    })
  }

  function send(message, callback) {
    try {
      chrome.runtime.sendMessage(message, function (res) {
        // lastError must be read, or Chrome logs "Unchecked runtime.lastError".
        callback(!chrome.runtime.lastError && !!(res && res.ok))
      })
    } catch (_) {
      // "Extension context invalidated" after the extension is updated or removed.
      callback(false)
    }
  }

  function onSave() {
    if (!currentSelection) return
    // The page title and URL are taken from the tab by the background, not sent from here.
    send({ type: 'notely:save-selection', text: currentSelection }, function (ok) {
      if (ok) button.classList.add('saved')
      label.textContent = ok ? 'Saved!' : 'Couldn’t save - reload the page'
      clearTimeout(savedTimer)
      savedTimer = setTimeout(function () {
        button.classList.remove('saved')
        label.textContent = 'Save to Notely'
        hideBubble()
      }, ok ? 1100 : 2400)
    })
  }

  function onHideOnSite() {
    send({ type: 'notely:hide-bubble-on-site' }, function () { teardown() })
  }

  function showBubble(rect, text) {
    ensureBubble()
    currentSelection = text
    var widthGuess = 162
    var left = Math.min(Math.max(8, rect.left + rect.width / 2 - widthGuess / 2), window.innerWidth - widthGuess - 8)
    var top = rect.top - 44
    if (top < 8) top = rect.bottom + 10
    host.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)'
    button._wrap.classList.add('show')
  }

  function hideBubble() {
    if (button) button._wrap.classList.remove('show')
    currentSelection = ''
  }

  function onSelectionChange() {
    clearTimeout(selectionTimer)
    selectionTimer = setTimeout(function () {
      var sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) { hideBubble(); return }
      var text = sel.toString().trim()
      if (text.length < 2) { hideBubble(); return }
      var rect = sel.getRangeAt(0).getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) { hideBubble(); return }
      showBubble(rect, text.slice(0, MAX_CHARS))
    }, 140)
  }

  function onMouseDown(e) {
    if (host && e.target === host) return // clicks inside the closed shadow root retarget to the host
    hideBubble()
  }

  function teardown() {
    document.removeEventListener('selectionchange', onSelectionChange)
    document.removeEventListener('mousedown', onMouseDown, true)
    window.removeEventListener('scroll', hideBubble, true)
    window.removeEventListener('resize', hideBubble)
    clearTimeout(selectionTimer)
    clearTimeout(savedTimer)
    if (host) host.remove()
    host = button = label = null
    currentSelection = ''
  }

  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('mousedown', onMouseDown, true)
  window.addEventListener('scroll', hideBubble, { passive: true, capture: true })
  window.addEventListener('resize', hideBubble)
})()
