/* Notely content script — runs in page context, isolated world by default. */
;(function () {
  'use strict'

  var HOST_ID = 'notely-selection-bubble'
  var bubble = null
  var shadow = null
  var button = null
  var label = null
  var hideTimer = null
  var savedTimer = null
  var currentSelection = ''

  function ensureBubble() {
    if (bubble) return bubble
    bubble = document.createElement('div')
    bubble.id = HOST_ID
    bubble.style.cssText = 'position:fixed;z-index:2147483647;top:0;left:0;pointer-events:none;'
    shadow = bubble.attachShadow({ mode: 'open' })
    var style = document.createElement('style')
    style.textContent = [
      ':host{all:initial}',
      '* { box-sizing:border-box; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }',
      '.bubble{display:flex;align-items:center;gap:7px;padding:7px 12px 7px 9px;border-radius:11px;',
      'background:rgba(24,22,38,.94);color:#fff;font-size:12.5px;font-weight:600;letter-spacing:.01em;',
      'box-shadow:0 10px 30px rgba(15,12,40,.38),0 2px 8px rgba(0,0,0,.25);',
      'border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(12px);cursor:pointer;',
      'opacity:0;transform:translateY(5px) scale(.96);transition:opacity .16s ease,transform .16s cubic-bezier(.2,.9,.3,1.3);',
      'pointer-events:auto;user-select:none;white-space:nowrap;}',
      '.bubble.show{opacity:1;transform:translateY(0) scale(1)}',
      '.bubble:hover{background:rgba(38,34,62,.98)}',
      '.mark{width:20px;height:20px;border-radius:6px;display:grid;place-items:center;',
      'background:#7c5cff;}',
      '.mark svg{width:13px;height:13px;display:block}',
      '.bubble.saved .mark{background:#16a34a}',
    ].join('')
    shadow.appendChild(style)

    button = document.createElement('div')
    button.className = 'bubble'
    button.setAttribute('role', 'button')
    button.setAttribute('tabindex', '0')
    button.title = 'Save selection to Notely'
    button.innerHTML =
      '<span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/></svg></span>' +
      '<span class="lbl">Save to Notely</span>'
    label = button.querySelector('.lbl')
    shadow.appendChild(button)

    button.addEventListener('click', onSave)
    button.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSave() }
    })
    document.documentElement.appendChild(bubble)
    return bubble
  }

  function onSave() {
    if (!currentSelection) return
    chrome.runtime.sendMessage(
      {
        type: 'notely:save-selection',
        text: currentSelection,
        title: document.title || 'Untitled page',
        url: location.href,
      },
      function () {
        button.classList.add('saved')
        label.textContent = 'Saved!'
        clearTimeout(savedTimer)
        savedTimer = setTimeout(function () {
          button.classList.remove('saved')
          label.textContent = 'Save to Notely'
          hideBubble()
        }, 1100)
      }
    )
  }

  function showBubble(rect, text) {
    ensureBubble()
    currentSelection = text
    var widthGuess = 132
    var left = Math.min(Math.max(8, rect.left + rect.width / 2 - widthGuess / 2), window.innerWidth - widthGuess - 8)
    var top = rect.top - 44
    if (top < 8) top = rect.bottom + 10
    bubble.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)'
    button.classList.add('show')
    clearTimeout(hideTimer)
  }

  function hideBubble() {
    if (!button) return
    button.classList.remove('show')
    currentSelection = ''
  }

  var selectionTimer = null
  function onSelectionChange() {
    clearTimeout(selectionTimer)
    selectionTimer = setTimeout(function () {
      var sel = window.getSelection()
      var text = sel ? sel.toString().trim() : ''
      if (text.length < 2 || !sel || sel.rangeCount === 0) { hideBubble(); return }
      var rect = sel.getRangeAt(0).getBoundingClientRect()
      if (!rect || (rect.width === 0 && rect.height === 0)) { hideBubble(); return }
      showBubble(rect, text.slice(0, 20000))
    }, 140)
  }

  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('mousedown', function (e) {
    if (bubble && bubble.contains(e.target)) return
    hideBubble()
  }, true)
  window.addEventListener('scroll', hideBubble, { passive: true, capture: true })
  window.addEventListener('resize', hideBubble)

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || typeof msg.type !== 'string') return
    if (msg.type === 'notely:get-selection') {
      var sel = window.getSelection()
      sendResponse({
        text: sel ? sel.toString().trim() : '',
        title: document.title || 'Untitled page',
        url: location.href,
        description: (document.querySelector('meta[name="description"]') || {}).content || '',
      })
      return true
    }
    if (msg.type === 'notely:ping') { sendResponse({ ok: true }); return true }
  })
})()
