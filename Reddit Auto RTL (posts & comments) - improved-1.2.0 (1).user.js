// ==UserScript==
// @name         Reddit Auto RTL (posts & comments) - improved
// @namespace    https://github.com/aboda7m/reddit-auto-rtl
// @version      1.2.0
// @description  Auto-detect RTL text on reddit and set dir/text-align for posts, comments, inputs. More robust with dir attribute and inline styles.
// @match        https://*.reddit.com/*
// @match        https://reddit.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const RTL_RANGES = [
    [0x0590,0x05FF],[0x0600,0x06FF],[0x0750,0x077F],[0x08A0,0x08FF],
    [0x0700,0x074F],[0x0780,0x07BF],[0xFB50,0xFDFF],[0xFE70,0xFEFF],[0x1EE00,0x1EEFF]
  ];

  function isRtlChar(cp) {
    for (let r of RTL_RANGES) if (cp >= r[0] && cp <= r[1]) return true;
    return false;
  }

  function textIsRTL(text) {
    if (!text) return false;
    for (let i=0;i<text.length;i++){
      const code = text.charCodeAt(i);
      // skip common whitespace/punctuation fast path
      if (code <= 32 || (code >= 33 && code <= 47)) continue;
      if (isRtlChar(code)) return true;
      // strong LTR heuristics (latin letters): treat as LTR
      if ((code >= 0x0041 && code <= 0x007A) || (code >= 0x00C0 && code <= 0x024F)) return false;
    }
    return false;
  }

  const SELECTORS = [
    '.Post div[data-click-id="text"]', '.Post .RichTextJSON-root',
    '.Comment .md', '.Comment .RichTextJSON-root',
    '.md', '.md p', '.RichTextJSON-root',
    '[data-test-id="post-content"]', '.title', '.post-title, .Post__title, h1, h2, h3',
    'textarea', 'input[type="text"]', 'input[type="search"]'
  ];

  const processed = new WeakSet();

  function getTextForNode(node){
    if (!node) return '';
    let t = node.textContent || '';
    t = t.replace(/\s+/g,' ').trim();
    if (t.length > 5000) t = t.slice(0,5000);
    return t;
  }

  function elementHasExplicitDir(el){
    try {
      if (!el || el.nodeType !== 1) return false;
      if (el.hasAttribute('dir')) return true;
      const cs = window.getComputedStyle(el);
      // if computed direction already rtl, treat as explicit enough
      if (cs && cs.direction === 'rtl') return true;
    } catch(e){}
    return false;
  }

  function applyRtlNative(el){
    try {
      if (!el || processed.has(el)) return;
      // don't override if some ancestor explicitly set dir
      for (let a = el; a && a.nodeType === 1; a = a.parentNode) {
        if (a.hasAttribute && a.hasAttribute('dir')) return;
      }
      const text = getTextForNode(el);
      if (!text) { processed.add(el); return; }
      if (textIsRTL(text)) {
        // prefer native dir; inline styles as fallback (inline wins)
        el.setAttribute('dir','rtl');
        // inline style helps when site uses isolation or heavy CSS
        el.style.textAlign = 'right';
        // plaintext usually behaves better for bidi runs
        el.style.unicodeBidi = 'plaintext';
        // ensure code/pre inside remain LTR
        const codeBlocks = el.querySelectorAll && el.querySelectorAll('code, pre');
        if (codeBlocks && codeBlocks.length) {
          for (let i=0;i<codeBlocks.length;i++){
            codeBlocks[i].setAttribute('dir','ltr');
            codeBlocks[i].style.textAlign = 'left';
            codeBlocks[i].style.unicodeBidi = 'embed';
          }
        }
      }
      processed.add(el);
    } catch(e){
      console.error('applyRtlNative error', e);
      try { processed.add(el); } catch(e){}
    }
  }

  function scanOnce(root=document){
    try{
      for (const sel of SELECTORS){
        const list = root.querySelectorAll ? root.querySelectorAll(sel) : [];
        for (let i=0;i<list.length;i++){
          const el = list[i];
          // skip if it already has explicit direction computed
          if (elementHasExplicitDir(el)) { processed.add(el); continue; }
          applyRtlNative(el);
        }
      }
    }catch(e){
      console.error('RTL-scan error', e);
    }
  }

  function attachInputListeners(root=document){
    try{
      const inputs = root.querySelectorAll ? root.querySelectorAll('textarea, input[type="text"], input[type="search"]') : [];
      for (let i=0;i<inputs.length;i++){
        const el = inputs[i];
        if (el._rtl_listener) continue;
        const fn = () => {
          try {
            if (textIsRTL(el.value || el.textContent || '')) {
              el.setAttribute('dir','rtl');
              el.style.textAlign = 'right';
              el.style.unicodeBidi = 'plaintext';
            } else {
              el.removeAttribute('dir');
              el.style.textAlign = '';
              el.style.unicodeBidi = '';
            }
          } catch(e){}
        };
        el.addEventListener('input', fn);
        el._rtl_listener = true;
        fn();
      }
    }catch(e){}
  }

  function watchDom(){
    const mo = new MutationObserver((records) => {
      for (const r of records){
        if (r.addedNodes && r.addedNodes.length){
          for (let i=0;i<r.addedNodes.length;i++){
            const n = r.addedNodes[i];
            if (!n) continue;
            if (n.nodeType === Node.ELEMENT_NODE){
              // scan subtree
              scanOnce(n);
              attachInputListeners(n);
              // scan possible open shadow roots
              try {
                if (n.shadowRoot) { scanOnce(n.shadowRoot); attachInputListeners(n.shadowRoot); }
                const kids = n.querySelectorAll && n.querySelectorAll('*');
                if (kids) {
                  for (let j=0;j<kids.length;j++){
                    const k = kids[j];
                    if (k.shadowRoot) { scanOnce(k.shadowRoot); attachInputListeners(k.shadowRoot); }
                  }
                }
              } catch(e){}
            } else if (n.nodeType === Node.TEXT_NODE){
              const p = n.parentNode;
              if (p) applyRtlNative(p);
            }
          }
        }
        if (r.type === 'characterData'){
          const p = r.target && r.target.parentNode;
          if (p) applyRtlNative(p);
        }
      }
    });
    mo.observe(document, {childList:true, subtree:true, characterData:true});
  }

  // init
  scanOnce();
  attachInputListeners();
  watchDom();

  // fallback periodic scan (clears after timeout)
  const intervalId = setInterval(()=>{
    scanOnce();
    attachInputListeners();
  }, 3000);

  setTimeout(()=> clearInterval(intervalId), 2 * 60 * 1000);

})();
