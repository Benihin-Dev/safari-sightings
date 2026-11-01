/* ==========================================================
   pdf-progress.js  |  Safari Sightings
   A progress ring with a filling PDF page and a percentage
   inside it, plus helpers for smooth show / text changes.

   Load it next to index.html with:
     <script src="pdf-progress.js" defer></script>
   Put <div id="pdfProgress"></div> where the tick circle was.

   API (all safe to call; if the ring is not on the page the
   callbacks still run, so the card never gets stuck):
     PdfProgress.start()            reset to 0 and begin
     PdfProgress.set(percent)       move forward (never backwards)
     PdfProgress.finish(callback)   run to 100, then call callback
     PdfProgress.fail()             error state
     PdfProgress.reason()           why the report is not ready yet
     PdfProgress.reveal(element)    slide + fade an element in
     PdfProgress.swap(element,html) fade old text out, new text in
   ========================================================== */
(function () {
  'use strict';

  /* ---- Words (change freely) ---- */
  var STAGES = [
    [0,  'Gathering your sightings...',        'We are still gathering your sightings.'],
    [15, 'Developing your wildlife photos...', 'We are still developing your wildlife photos.'],
    [50, 'Laying out your safari pages...',    'We are still laying out your safari pages.'],
    [90, 'Adding the final touches...',        'We are adding the final touches to your report.']
  ];
  var FAIL_REASON = 'The report could not be created.';
  var FAIL_STAGE  = 'Something went wrong. Please try again.';

  /* ---- Look (colours are variables on .pp-wrap) ---- */
  var CSS =
    '.pp-wrap{--pp-a:#C9923A;--pp-b:#2E9E5B;--pp-ink:#1E4D3A;--pp-track:rgba(30,77,58,.12);--pp-note:#8A5A1E;--pp-paper:#F4F6F4;display:flex;flex-direction:column;align-items:center;margin:0 auto 12px}' +
    '.pp-ring{position:relative;width:88px;height:88px;border-radius:50%}' +
    '.pp-ring svg.rg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible}' +
    '.pp-track{stroke:var(--pp-track)}' +
    '.pp-fill{stroke-linecap:round;transition:stroke-dashoffset .25s linear;filter:drop-shadow(0 0 3px rgba(201,146,58,.45))}' +
    '.pp-in{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}' +
    '.pp-doc{--dh:42px;position:relative;box-sizing:border-box;width:38px;height:46px;border:2px solid rgba(30,77,58,.4);border-radius:7px;background:#fff;overflow:hidden;display:flex;flex-direction:column;gap:3px;padding:6px 5px}' +
    '.pp-t{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-top:5px;font:800 12px/1 -apple-system,"Segoe UI",sans-serif;color:var(--pp-ink);font-variant-numeric:tabular-nums}' +
    '.pp-liq{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(0deg,var(--pp-ink),var(--pp-b) 55%,var(--pp-a));transition:height .25s linear;overflow:hidden}' +
    '.pp-w{position:absolute;left:0;right:0;bottom:0;height:var(--dh);display:flex;align-items:center;justify-content:center;padding-top:5px;font:800 12px/1 -apple-system,"Segoe UI",sans-serif;color:#fff;font-variant-numeric:tabular-nums}' +
    '.pp-doc i{position:relative;z-index:1;display:block;height:2.5px;border-radius:2px;background:rgba(30,77,58,.3)}' +
    '.pp-doc i.s{width:60%}' +
    '.pp-doc::after{content:"";position:absolute;top:0;right:0;z-index:2;border-top:8px solid var(--pp-paper);border-left:8px solid rgba(30,77,58,.28)}' +
  '.pp-stage{margin-top:8px;min-height:20px;max-height:24px;overflow:hidden;text-align:center;font:italic 14px/20px "Times New Roman",Times,Georgia,serif;letter-spacing:.02em;color:var(--pp-note);opacity:1;transform:none;transition:opacity .45s ease,transform .45s cubic-bezier(.2,.8,.3,1),max-height .5s ease .3s,margin-top .5s ease .3s}' +
'.pp-stage.out{opacity:0;transform:translateY(-10px)}' +
'.pp-stage.pre{opacity:0;transform:translateY(12px);transition:none}' +
'.pp-wrap[data-state=done] .pp-stage{opacity:0;max-height:0;min-height:0;margin-top:0}' +
'.pp-wrap[data-state=done] .pp-doc{animation:pppop 1.1s cubic-bezier(.3,.8,.3,1)}' +
'@keyframes pppop{0%{transform:scale(1);box-shadow:0 0 0 0 rgba(201,146,58,0)}45%{transform:scale(1.4) translateY(-5px);box-shadow:0 0 16px 5px rgba(201,146,58,.6)}100%{transform:scale(1);box-shadow:0 0 0 0 rgba(201,146,58,0)}}' +
    '.pp-wrap[data-state=fail] .pp-fill{stroke:#B3261E;filter:none}' +
    '.pp-wrap[data-state=fail] .pp-stage{color:#B3261E}' +
    '@keyframes ppfade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '@keyframes ppglow{0%{box-shadow:0 0 0 0 rgba(201,146,58,0)}40%{box-shadow:0 0 20px 5px rgba(201,146,58,.55)}100%{box-shadow:0 0 0 0 rgba(201,146,58,0)}}' +
'@media (prefers-reduced-motion:reduce){.pp-wrap,.pp-wrap *{animation:none!important;transition:none!important}}';

  var HTML =
    '<div class="pp-wrap" data-state="loading" role="progressbar" aria-label="Preparing your safari report" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
      '<div class="pp-ring">' +
        '<svg class="rg" viewBox="0 0 160 160" aria-hidden="true">' +
          '<defs><linearGradient id="ppGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#C9923A"/><stop offset="100%" stop-color="#2E9E5B"/></linearGradient></defs>' +
          '<circle class="pp-track" cx="80" cy="80" r="70" stroke-width="9" fill="none"/>' +
          '<circle class="pp-fill" cx="80" cy="80" r="70" stroke-width="9" fill="none" stroke="url(#ppGrad)"/>' +
        '</svg>' +
        '<div class="pp-in"><div class="pp-doc">' +
          '<b class="pp-t"></b><div class="pp-liq"><b class="pp-w"></b></div><i class="s"></i><i></i>' +
        '</div></div>' +
      '</div>' +
      '<div class="pp-stage" aria-live="polite"></div>' +
    '</div>';

  var C = 2 * Math.PI * 70;
  var root = null, el = {};
  var active = false, finishing = false, fired = false, cb = null, timer = 0;
   var target = 0, shown = 0, raf = 0, lastText = '';
  var stageShown = 0, stageAt = 0, sayTimer = 0;
  var DWELL = 900;   /* how long each message stays (milliseconds) */

  function reduced() {
    return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function inject() {
    if (document.getElementById('pp-style')) return;
    var s = document.createElement('style');
    s.id = 'pp-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function mount(host) {
    if (typeof host === 'string') host = document.querySelector(host);
    host = host || document.getElementById('pdfProgress');
    if (!host) return false;
    inject();
    host.innerHTML = HTML;
    root = host.firstElementChild;
    el = {
      fill: root.querySelector('.pp-fill'),
      liq: root.querySelector('.pp-liq'),
      t: root.querySelector('.pp-t'),
      w: root.querySelector('.pp-w'),
      stage: root.querySelector('.pp-stage')
    };
    el.fill.style.strokeDasharray = C;
    el.fill.style.strokeDashoffset = C;
    return true;
  }

  function idx(p) {
    var k = 0;
    for (var i = 0; i < STAGES.length; i++) if (p >= STAGES[i][0]) k = i;
    return k;
  }

  function slideIn(s, t) {
    s.textContent = t;
    s.className = 'pp-stage pre';
    void s.offsetWidth;
    s.className = 'pp-stage';
  }

  function say(t) {
    if (t === lastText) return;
    lastText = t;
    clearTimeout(sayTimer);
    var s = el.stage;
    if (reduced() || !s.textContent) { slideIn(s, t); return; }
    s.className = 'pp-stage out';
    sayTimer = setTimeout(function () { slideIn(s, t); }, 300);
  }

  function label(s) { el.t.textContent = s; el.w.textContent = s; }

  function render() {
    el.fill.style.strokeDashoffset = C * (1 - shown / 100);
    el.liq.style.height = shown + '%';
    root.setAttribute('aria-valuenow', Math.round(shown));
    if (finishing && shown >= 99.5) {
      label('PDF');
      root.setAttribute('data-state', 'done');
      if (!fired) {
        fired = true;
        timer = setTimeout(function () { if (cb) { var f = cb; cb = null; f(); } }, 900);
      }
    } else {
      label(Math.round(shown) + '%');
      say(STAGES[stageShown][1]);
    }
  }

   function loop() {
    raf = 0;
    var now = performance.now(), last = STAGES.length - 1;
    var waited = now - stageAt >= DWELL;
    var limit = stageShown < last ? STAGES[stageShown + 1][0] - 0.5 : (waited ? 100 : 99);
    var goal = Math.min(target, limit);
    if (shown < goal) shown = Math.min(goal, shown + Math.max(0.35, (goal - shown) * 0.2));
    if (stageShown < last && waited && shown >= limit - 0.01 && target >= STAGES[stageShown + 1][0]) {
      stageShown++; stageAt = now;
    }
    render();
    var more = shown < target || (stageShown < last && target >= STAGES[stageShown + 1][0]);
    if (more) raf = requestAnimationFrame(loop);
  }

  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  function stopAll() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (timer) { clearTimeout(timer); timer = 0; }
  }

  /* ---- Smooth helpers for other parts of the card ---- */
  function swap(node, html) {
    if (!node) return;
    if (reduced()) { node.innerHTML = html; return; }
    node.style.transition = 'opacity .35s ease, transform .35s ease';
    node.style.opacity = '0';
    node.style.transform = 'translateY(-8px)';
    setTimeout(function () {
      node.innerHTML = html;
      node.style.transition = 'none';
      node.style.transform = 'translateY(8px)';
      void node.offsetHeight;
      node.style.transition = 'opacity .45s ease, transform .45s ease';
      node.style.opacity = '1';
      node.style.transform = 'translateY(0)';
    }, 360);
  }

  function swap(node, html) {
    if (!node) return;
    if (reduced()) { node.innerHTML = html; return; }
    node.style.transition = 'opacity .25s ease';
    node.style.opacity = '0';
    setTimeout(function () {
      node.innerHTML = html;
      node.style.opacity = '1';
    }, 260);
  }

function reveal(node, dy) {
  if (!node) return;
  node.hidden = false;
  if (reduced()) return;
  node.style.transition = 'none';
  node.style.opacity = '0';
  node.style.transform = 'translateY(' + (dy == null ? 16 : dy) + 'px)';
  void node.offsetHeight;
  node.style.transition = 'opacity .8s ease, transform .8s cubic-bezier(.2,.8,.3,1)';
  node.style.opacity = '1';
  node.style.transform = 'translateY(0)';
}
   
  window.PdfProgress = {
    mount: mount,
    start: function () {
      stopAll();
      cb = null; fired = false; finishing = false; lastText = '';
      if (!root && !mount()) { active = false; return; }
       active = true;
      target = 3; shown = 0;
      stageShown = 0; stageAt = performance.now();
      clearTimeout(sayTimer); el.stage.textContent = ''; el.stage.className = 'pp-stage';
      root.setAttribute('data-state', 'loading');
      render();
      kick();
    },
    set: function (p) {
      if (!active || !root) return;
      p = Math.max(0, Math.min(99, +p || 0));
      if (p > target) target = p;
      kick();
    },
    finish: function (callback) {
      if (!root || !active) { if (callback) callback(); return; }
      active = false; finishing = true; fired = false;
      cb = callback || null;
      target = 100;
      kick();
    },
    fail: function () {
      stopAll();
      cb = null; active = false; finishing = false;
      if (!root) return;
      root.setAttribute('data-state', 'fail');
      say(FAIL_STAGE);
    },
    reason: function () {
      if (root && root.getAttribute('data-state') === 'fail') return FAIL_REASON;
            return STAGES[stageShown][2];
    },
    reveal: reveal,
    swap: swap
  };
})();
