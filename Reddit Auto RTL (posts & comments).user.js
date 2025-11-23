// ==UserScript==
// @name         Reddit Auto RTL (posts & comments)
// @namespace    https://github.com/aboda7m/reddit-auto-rtl
// @version      1.1.1
// @description  Auto-detect RTL text on reddit and set direction/text-align for those blocks (posts, comments, inputs). Works on new.reddit.com and old.reddit.com. Uses MutationObserver for live content.
// @author       Aboda7m (Abdulrahman Alnotefi)
// @match        https://*.reddit.com/*
// @match        https://reddit.com/*
// @grant        none
// @run-at       document-end
// @license      MIT
// @homepageURL  https://github.com/Aboda7m/reddit-auto-rtl
// @supportURL   https://github.com/Aboda7m/reddit-auto-rtl/issues
// ==/UserScript==

(function () {
  'use strict';

  // --- char ranges copied/adapted from Bidier for robust RTL detection ---
  const RTL_RANGES = [
  
    [0x0600,0x06FF], // Arabic
    [0x0750,0x077F], // Arabic Supplement
    [0x08A0,0x08FF], // Arabic Extended-A
    [0x0700,0x074F], // Syriac
    [0x0780,0x07BF], // Thaana
    [0xFB50,0xFDFF], // Arabic Presentation Forms-A
    [0xFE70,0xFEFF], // Arabic Presentation Forms-B
    [0x1EE00,0x1EEFF] // Arabic Mathematical Alphabets, etc
  ];

  function isRtlChar(cp) {
    for (let r of RTL_RANGES) {
      if (cp >= r[0] && cp <= r[1]) return true;
    }
    return false;
  }

  function textIsRTL(text) {
    if (!text) return false;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      // skip neutral-ish whitespace and punctuation quickly
      if (code <= 32 || (code >= 33 && code <= 47)) continue;
      if (isRtlChar(code)) return true;
      // if we encounter strong LTR letter early, prefer LTR
      if ((code >= 0x0041 && code <= 0x007A) || (code >= 0x00C0 && code <= 0x024F)) return false;
    }
    return false;
  }

  // --- CSS we inject to force direction on marked nodes ---
  const CSS = `
.rtl-applied, .rtl-applied * {
  direction: rtl !important;
  text-align: right !important;
  unicode-bidi: plaintext !important;
}
/* avoid breaking inline code blocks inside markdown that rely on monospace alignment */
.rtl-applied code, .rtl-applied pre { direction: ltr !important; text-align: left !important; unicode-bidi: embed !important; }
`;

  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // --- selectors to check for RTL text on reddit (new + old) ---
  const SELECTORS = [
    // new reddit rich text and legacy markdown containers
    '.Post div[data-click-id="text"]',           // new posts textual body
    '.Post .RichTextJSON-root',                  // new richtext
    '.Comment .md, .Comment .RichTextJSON-root', // comments
    '.md',                                       // generic markdown blocks
    '.md p',                                     // paragraphs
    '.RichTextJSON-root',                        // general rich text root
    '[data-test-id="post-content"]',             // post content wrapper
    '.title',                                    // titles/headlines
    '.post-title, .Post__title, h1, h2, h3',     // fallbacks
    'textarea', 'input[type="text"]'             // inputs
  ];

  // nodes we already processed
  const processed = new WeakSet();

  function shouldProcess(node) {
    if (!node || processed.has(node)) return false;
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) return false;
    return true;
  }

  // Gets visible text content but avoids text of nested controls like buttons etc.
  function getTextForNode(node) {
    if (!node) return '';
    // prefer textContent trimmed
    let t = node.textContent || '';
    t = t.replace(/\s+/g, ' ').trim();
    // limit size to speed detection
    if (t.length > 5000) t = t.slice(0, 5000);
    return t;
  }

  function applyIfRtl(el) {
    if (!el || processed.has(el)) return;
    // skip if element or any ancestor already has explicit dir attribute set to ltr/rtl
    for (let a = el; a && a.nodeType === 1; a = a.parentNode) {
      if (a.hasAttribute && a.hasAttribute('dir')) {
        // if dir present and matches, don't override
        // but if dir is not present or is neutral, continue
        return;
      }
    }

    const text = getTextForNode(el);
    if (!text) {
      processed.add(el);
      return;
    }
    if (textIsRTL(text)) {
      el.classList.add('rtl-applied');
    }
    processed.add(el);
  }

  function scanOnce(root=document) {
    try {
      for (const sel of SELECTORS) {
        const list = root.querySelectorAll ? root.querySelectorAll(sel) : [];
        for (let i = 0; i < list.length; i++) {
          const el = list[i];
          applyIfRtl(el);
        }
      }
    } catch (e) {
      // querySelectorAll may fail on weird roots or shadow roots, ignore
      console.error('RTL-scan error', e);
    }
  }

  // handle inputs: live input listener so typing flips class
  function attachInputListeners(root=document) {
    try {
      const inputs = root.querySelectorAll('textarea, input[type="text"], input[type="search"]');
      for (let i = 0; i < inputs.length; i++) {
        const el = inputs[i];
        if (el._rtl_listener) continue;
        const fn = (e) => {
          if (textIsRTL(el.value || el.textContent || '')) el.classList.add('rtl-applied');
          else el.classList.remove('rtl-applied');
        };
        el.addEventListener('input', fn);
        el._rtl_listener = true;
        // initial check
        fn();
      }
    } catch (e) {}
  }

  // MutationObserver for dynamic content
  function watchDom() {
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.addedNodes && r.addedNodes.length) {
          for (let i = 0; i < r.addedNodes.length; i++) {
            const n = r.addedNodes[i];
            if (!n) continue;
            // if element node, scan sub-tree
            if (n.nodeType === Node.ELEMENT_NODE) {
              scanOnce(n);
              attachInputListeners(n);
            } else if (n.nodeType === Node.TEXT_NODE) {
              // try parent
              const p = n.parentNode;
              if (p) applyIfRtl(p);
            }
          }
        }
        if (r.type === 'characterData') {
          const p = r.target && r.target.parentNode;
          if (p) applyIfRtl(p);
        }
      }
    });
    mo.observe(document, {childList: true, subtree: true, characterData: true});
  }

  // init
  injectCSS();
  scanOnce();
  attachInputListeners();
  watchDom();

  // additional periodic scan as fallback for content that is inserted inside closed shadow roots etc
  const intervalId = setInterval(() => {
    scanOnce();
    attachInputListeners();
  }, 3500);

  // stop interval after some time to avoid perpetual CPU use
  setTimeout(() => clearInterval(intervalId), 120000);
})();
