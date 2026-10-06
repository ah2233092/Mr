// Deterministic motion-graphics engine: every animation is a paused Web Animation
// whose currentTime is set from the frame clock, so any frame renders identically.
// Timing tokens: "w14" (start of word 14), "w14+0.2", "t3.57" (absolute seconds).
(function () {
  const E = {};
  const EASE = 'cubic-bezier(.16,1,.3,1)';          // expo-out: confident, no bounce
  const INOUT = 'cubic-bezier(.65,0,.35,1)';
  const P = {
    fadeUp:  {k: [{opacity: 0, transform: 'translateY(40px)', filter: 'blur(8px)'}, {opacity: 1, transform: 'none', filter: 'none'}], d: .9},
    fadeIn:  {k: [{opacity: 0}, {opacity: 1}], d: .6, e: 'ease-out'},
    blurIn:  {k: [{opacity: 0, transform: 'scale(1.06)', filter: 'blur(18px)'}, {opacity: 1, transform: 'none', filter: 'none'}], d: 1.0},
    slideL:  {k: [{opacity: 0, transform: 'translateX(-60px)', filter: 'blur(6px)'}, {opacity: 1, transform: 'none', filter: 'none'}], d: .9},
    slideR:  {k: [{opacity: 0, transform: 'translateX(60px)', filter: 'blur(6px)'}, {opacity: 1, transform: 'none', filter: 'none'}], d: .9},
    rise:    {k: [{transform: 'translateY(108%)'}, {transform: 'none'}], d: .85},
    wipe:    {k: [{clipPath: 'inset(0 100% 0 0)'}, {clipPath: 'inset(0 0% 0 0)'}], d: .8, e: INOUT},
    wipeDown:{k: [{clipPath: 'inset(0 0 100% 0)'}, {clipPath: 'inset(0 0 0% 0)'}], d: .8, e: INOUT},
    growX:   {k: [{transform: 'scaleX(0)'}, {transform: 'scaleX(1)'}], d: .8, e: INOUT},
    growY:   {k: [{transform: 'scaleY(0)'}, {transform: 'scaleY(1)'}], d: .8, e: INOUT},
    scaleIn: {k: [{opacity: 0, transform: 'scale(.92)'}, {opacity: 1, transform: 'none'}], d: .7},
    bigIn:   {k: [{opacity: 0, transform: 'scale(1.18)', filter: 'blur(20px)'}, {opacity: 1, transform: 'none', filter: 'none'}], d: 1.1},
    track:   {k: [{opacity: 0, letterSpacing: '.6em', filter: 'blur(14px)'}, {opacity: 1, letterSpacing: '0em', filter: 'none'}], d: 1.2},
    cut:     {k: [{opacity: 0}, {opacity: 1}], d: .001, e: 'linear'},
    fadeOut: {k: [{opacity: 1, filter: 'none'}, {opacity: 0, filter: 'blur(10px)'}], d: .45, e: 'ease-in'},
    outUp:   {k: [{opacity: 1, transform: 'none'}, {opacity: 0, transform: 'translateY(-30px)'}], d: .4, e: 'ease-in'},
    cutOut:  {k: [{opacity: 1}, {opacity: 0}], d: .001, e: 'linear'},
    vanish:  {k: [{opacity: 1, filter: 'none'}, {opacity: .06, filter: 'blur(6px)'}], d: .5, e: 'ease-in-out'},
    draw:    {k: [{strokeDashoffset: 1}, {strokeDashoffset: 0}], d: .9, e: INOUT},
    charIn:  {k: [{opacity: 0, transform: 'translateY(.35em) scale(1.08)', filter: 'blur(14px)'}, {opacity: 1, transform: 'none', filter: 'none'}], d: .75},
    flip:    {k: [{opacity: 0, transform: 'perspective(900px) rotateX(-85deg) translateY(.2em)', filter: 'blur(6px)'}, {opacity: 1, transform: 'none', filter: 'none'}], d: .9},
    charOut: {k: [{opacity: 1, transform: 'none', filter: 'none'}, {opacity: 0, transform: 'translateY(-.25em)', filter: 'blur(12px)'}], d: .45, e: 'cubic-bezier(.5,0,.75,0)'},
    shine:   {k: [{backgroundPosition: '170% 0, 0 0'}, {backgroundPosition: '-70% 0, 0 0'}], d: 1.4, e: INOUT},
    drift:   {k: [{transform: 'scale(1)'}, {transform: 'scale(1.035)'}], d: 6, e: 'linear'},
  };
  E.P = P;
  E.init = function (words) {
    E.words = words;
    E.T = function (tok) {
      const m = String(tok).match(/^(w(\d+)|t([\d.]+))([+-][\d.]+)?$/);
      if (!m) throw new Error('bad token ' + tok);
      const base = m[2] !== undefined ? words[+m[2]].T : +m[3];
      return base + (m[4] ? +m[4] : 0);
    };
  };
  E.anim = function (el, name, t0, dur, out, ease) {
    const p = P[name]; if (!p) throw new Error('no preset ' + name);
    return el.animate(p.k, {duration: (dur || p.d) * 1000, delay: t0 * 1000, fill: out ? 'forwards' : 'both', easing: ease || p.e || EASE});
  };
  E.CUES = [];
  E.bind = function (root) {
    root.querySelectorAll('[data-in],[data-out],[data-shine]').forEach(el => {
      if (el.dataset.in) el.dataset.in.split(';').forEach(spec => {
        const [name, tok, dur, stag] = spec.trim().split(/\s+/);
        const t0 = E.T(tok);
        if (el.hasAttribute('data-chars')) {
          E.chars(el).forEach((c, i) => E.anim(c, name === 'flip' ? 'flip' : 'charIn', t0 + i * (+(stag || .035)), dur && +dur));
        } else if (el.hasAttribute('data-split')) {
          E.split(el).forEach((w, i) => E.anim(w, 'rise', t0 + i * (+(stag || .08)), dur && +dur));
        } else E.anim(el, name, t0, dur && +dur);
        if (el.dataset.sfx) E.CUES.push({t: t0, type: el.dataset.sfx});
      });
      if (el.dataset.out) {
        const [name, tok, dur, stag] = el.dataset.out.split(/\s+/);
        if (name === 'charOut' && el._chars) el._chars.forEach((c, i) => E.anim(c, 'charOut', E.T(tok) + i * (+(stag || .02)), dur && +dur, true));
        else E.anim(el, name, E.T(tok), dur && +dur, true);
      }
      if (el.dataset.shine) el.dataset.shine.split(';').forEach(tok => (el._chars || [el]).forEach((c, i) =>
        E.anim(c, 'shine', E.T(tok.trim()) + i * .02, 1.4, true)));
    });
  };
  E.split = function (el) {               // masked word-by-word reveal
    const out = [];
    [...el.childNodes].forEach(n => {
      const wrap = node => { const w = document.createElement('span'); w.className = 'w';
        const i = document.createElement('span'); i.className = 'wi'; i.appendChild(node); w.appendChild(i); out.push(w); };
      if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(p => { if (!p) return;
        if (/^\s+$/.test(p)) out.push(document.createTextNode(' ')); else wrap(document.createTextNode(p)); });
      else wrap(n.cloneNode(true));
    });
    el.innerHTML = ''; out.forEach(n => el.appendChild(n));
    const wis = [...el.querySelectorAll('.wi')];
    if (el.classList.contains('goldg')) { el.classList.remove('goldg'); wis.forEach(w => w.classList.add('goldg')); }
    return wis;
  };
  E.chars = function (el) {                // per-character spans (keeps word wrapping)
    const out = [];
    const walk = (node, cls) => [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(word => {
          if (!word) return;
          if (/^\s+$/.test(word)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.style.display = 'inline-block'; w.style.whiteSpace = 'nowrap';
          [...word].forEach(ch => { const c = document.createElement('span'); c.className = 'ch ' + cls; c.textContent = ch; w.appendChild(c); out.push(c); });
          frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else walk(n, cls + ' ' + (n.className || ''));
    });
    walk(el, el.classList.contains('goldg') ? 'goldg' : '');
    if (el.classList.contains('goldg')) el.classList.remove('goldg');
    el.querySelectorAll('span:not(.ch)').forEach(sp => { if (sp.classList.contains('goldg')) sp.classList.remove('goldg'); });
    el._chars = out;
    return out;
  };
  E.ticks = [];                            // per-frame JS hooks: fn(t)
  E.renderAt = function (t) {
    document.getAnimations().forEach(a => { a.currentTime = t * 1000; });
    E.ticks.forEach(f => f(t));
  };
  E.ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  E.inout = x => { x = Math.min(1, Math.max(0, x)); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  window.E = E;
})();
