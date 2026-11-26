/* المحرر الغني وشريط الأدوات: إدراج رموز ومعادلات وأشكال وصور وجداول */
"use strict";
window.EM = window.EM || {};

EM.editor = (function () {
  const $ = id => document.getElementById(id);
  const E = EM.esc;
  let active = null, saved = null;

  /* تتبّع آخر محرر نشط وموضع المؤشر */
  document.addEventListener("selectionchange", () => {
    const sel = getSelection();
    if (!sel.rangeCount) return;
    let n = sel.anchorNode;
    while (n && !(n.classList && n.classList.contains("rich"))) n = n.parentNode;
    if (n) { active = n; saved = sel.getRangeAt(0).cloneRange(); }
  });

  function restore() {
    if (!active) return false;
    active.focus();
    if (saved) { const s = getSelection(); s.removeAllRanges(); s.addRange(saved); }
    return true;
  }
  const notify = () => active && active.dispatchEvent(new Event("input", { bubbles: true }));

  function exec(cmd, val) {
    if (!restore()) return EM.toast("اضغط داخل نص سؤال أو فرع أولًا", true);
    try { document.execCommand("styleWithCSS", false, true); } catch (e) {}
    document.execCommand(cmd, false, val || null);
    notify();
  }

  function insertHTML(html) {
    if (!restore()) return EM.toast("اضغط داخل نص سؤال أو فرع أولًا", true);
    const sel = getSelection();
    if (!sel.rangeCount) { active.insertAdjacentHTML("beforeend", html); return notify(); }
    const r = sel.getRangeAt(0);
    if (!active.contains(r.commonAncestorContainer)) { active.insertAdjacentHTML("beforeend", html); return notify(); }
    r.deleteContents();
    const tmp = document.createElement("div"); tmp.innerHTML = html;
    const frag = document.createDocumentFragment(); let n, last = null;
    while ((n = tmp.firstChild)) last = frag.appendChild(n);
    r.insertNode(frag);
    if (last) { const nr = document.createRange(); nr.setStartAfter(last); nr.collapse(true); sel.removeAllRanges(); sel.addRange(nr); saved = nr.cloneRange(); }
    notify();
  }
  const insertText = t => insertHTML(E(t));
  const hasActive = () => !!active;

  /* وضع الكيمياء: تحويل الرقم بعد الحرف إلى سفلي أثناء الكتابة */
  document.addEventListener("input", e => {
    const ed = e.target;
    if (!ed.classList || !ed.classList.contains("rich") || !$("chemMode").checked || e.isTrusted === false) return;
    const sel = getSelection(); if (!sel.rangeCount) return;
    const node = sel.anchorNode, off = sel.anchorOffset;
    if (!node || node.nodeType !== 3 || off < 2) return;
    const txt = node.textContent;
    if (!/[0-9]/.test(txt[off - 1]) || !/[A-Za-z)\]]/.test(txt[off - 2])) return;
    for (let p = node.parentNode; p && p !== ed; p = p.parentNode) if (p.tagName === "SUB" || p.tagName === "SUP") return;
    const sub = document.createElement("sub"); sub.textContent = txt[off - 1];
    const after = document.createTextNode(txt.slice(off));
    node.parentNode.insertBefore(after, node.nextSibling);
    node.parentNode.insertBefore(sub, after);
    node.textContent = txt.slice(0, off - 1);
    const r = document.createRange(); r.setStart(after, 0); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); saved = r.cloneRange();
  }, true);

  /* لصق كنص عادي فقط (يمنع تلوث التنسيق) */
  document.addEventListener("paste", e => {
    const ed = e.target.closest && e.target.closest(".rich"); if (!ed) return;
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData("text/plain") || "";
    insertHTML(E(t).replace(/\r?\n/g, "<br>"));
  });

  /* ---------- الألواح ---------- */
  const panels = ["symbols", "chem", "eq", "laws", "fig", "img", "table"];
  function togglePanel(name) {
    panels.forEach(p => { const el = $("p-" + p); el.classList.toggle("on", p === name && !el.classList.contains("on")); });
    document.querySelectorAll("[data-panel]").forEach(b => b.classList.toggle("on", $("p-" + b.dataset.panel).classList.contains("on")));
  }
  const noFocus = (el, fn) => el.addEventListener("mousedown", e => { e.preventDefault(); fn(e); });

  function buildPanels() {
    $("p-symbols").innerHTML = EM.SYMBOLS.map(([g, a]) => "<div class='grp'><span class='meta'>" + g + ": </span>" +
      a.map(x => "<button class='symb' data-s='" + E(x) + "'>" + E(x) + "</button>").join("") + "</div>").join("");
    $("p-symbols").querySelectorAll(".symb").forEach(b => noFocus(b, () => insertText(b.dataset.s)));

    $("chemChips").innerHTML = EM.FORMULAS.map(f => "<button data-f='" + E(f) + "'>" + EM.fmt(f, "chem") + "</button>").join("");
    $("chemChips").querySelectorAll("button").forEach(b => noFocus(b, () => insertHTML(EM.fmt(b.dataset.f, "chem") + "&nbsp;")));

    $("p-laws").innerHTML = EM.LAWS.map(([g, arr]) => "<div class='grp'><b class='meta'>" + g + "</b><div class='chips'>" +
      arr.map(([m, s, label]) => "<button data-m='" + m + "' data-s='" + E(s) + "' title='" + E(label) + "'>" + EM.fmt(s, m) + "<br><small class='meta'>" + E(label) + "</small></button>").join("") +
      "</div></div>").join("");
    $("p-laws").querySelectorAll("button").forEach(b => noFocus(b, () => insertHTML(EM.fmt(b.dataset.s, b.dataset.m) + "&nbsp;")));

    /* المعادلة */
    const chips = ["x^2", "x_1", "frac{a}{b}", "sqrt{x}", "->", "<=>", "\\pi", "\\theta", "\\Delta", "\\pm", "<=", ">="];
    $("eqChips").innerHTML = chips.map(c => "<button data-c='" + E(c) + "' dir='ltr'>" + E(c) + "</button>").join("");
    $("eqChips").querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      const i = $("eqIn"), s = i.selectionStart == null ? i.value.length : i.selectionStart;
      i.value = i.value.slice(0, s) + b.dataset.c + i.value.slice(i.selectionEnd == null ? s : i.selectionEnd); i.focus(); prevEq();
    }));
    const prevEq = () => { const v = $("eqIn").value.trim(); $("eqPrev").innerHTML = v ? EM.fmt(v, $("eqMode").value) : "<span class='meta'>المعاينة تظهر هنا…</span>"; };
    $("eqIn").addEventListener("input", prevEq); $("eqMode").addEventListener("change", prevEq);
    noFocus($("eqInsert"), () => { const v = $("eqIn").value.trim(); if (v) insertHTML(EM.fmt(v, $("eqMode").value) + "&nbsp;"); });

    /* الأشكال */
    $("figChips").innerHTML = EM.FIGURES.map((f, i) => "<button data-i='" + i + "' title='" + f.label + "' style='width:70px;height:56px;padding:2px'>" +
      f.svg(0).replace("width='170' height='128'", "width='62' height='46'") + "</button>").join("");
    $("figChips").querySelectorAll("button").forEach(b => noFocus(b, () =>
      insertHTML("<span class='fig' contenteditable='false'>" + EM.FIGURES[b.dataset.i].svg(+$("figRot").value) + "</span>&nbsp;")));
    $("figRot").addEventListener("input", () => ($("figRotVal").textContent = $("figRot").value));
    noFocus($("btnAngle"), () => insertHTML("<span class='fig' contenteditable='false'>" + EM.angleSvg($("angDeg").value) + "</span>&nbsp;"));

    /* جدول */
    noFocus($("tInsert"), () => {
      const r = Math.max(1, Math.min(12, +$("tRows").value || 3)), c = Math.max(1, Math.min(8, +$("tCols").value || 3)), head = $("tHead").checked;
      let t = "<table class='ptable'>";
      for (let i = 0; i < r; i++) { t += "<tr>"; for (let j = 0; j < c; j++) t += (head && i === 0 ? "<th>&nbsp;</th>" : "<td>&nbsp;</td>"); t += "</tr>"; }
      insertHTML(t + "</table><br>");
    });
  }

  /* ---------- الصور ---------- */
  let imgSrc = null, imgCanvas = null;
  function loadImage(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = fr.result; };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  function toCanvas(im, max) {
    const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas");
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return c;
  }
  /* تفريغ الخلفية: ملء من الحواف بلون الزاوية */
  function cutBackground(src, tol) {
    const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
    const x = c.getContext("2d"); x.drawImage(src, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data, W = c.width, H = c.height;
    const bg = [p[0], p[1], p[2]];
    const near = i => Math.abs(p[i] - bg[0]) + Math.abs(p[i + 1] - bg[1]) + Math.abs(p[i + 2] - bg[2]) <= tol * 3 / 2;
    const seen = new Uint8Array(W * H), st = [];
    const push = (px, py) => { if (px < 0 || py < 0 || px >= W || py >= H) return; const k = py * W + px; if (seen[k]) return; seen[k] = 1; if (near(k * 4)) st.push(k); };
    for (let i = 0; i < W; i++) { push(i, 0); push(i, H - 1); }
    for (let j = 0; j < H; j++) { push(0, j); push(W - 1, j); }
    while (st.length) { const k = st.pop(); p[k * 4 + 3] = 0; const px = k % W, py = (k / W) | 0; push(px + 1, py); push(px - 1, py); push(px, py + 1); push(px, py - 1); }
    x.putImageData(d, 0, 0); return c;
  }
  function refreshImg() {
    if (!imgSrc) return;
    imgCanvas = $("imgCut").checked ? cutBackground(imgSrc, +$("imgTol").value) : imgSrc;
    $("imgPrev").src = imgCanvas.toDataURL("image/png");
    $("imgBox").hidden = false;
  }
  function initImages() {
    $("btnPickImg").addEventListener("click", () => $("imgFile").click());
    $("imgFile").addEventListener("change", async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try { imgSrc = toCanvas(await loadImage(f), 900); refreshImg(); } catch (x) { EM.toast("تعذّر قراءة الصورة", true); }
    });
    $("imgW").addEventListener("input", () => ($("imgWVal").textContent = $("imgW").value));
    $("imgTol").addEventListener("input", () => { $("imgTolVal").textContent = $("imgTol").value; refreshImg(); });
    $("imgCut").addEventListener("change", refreshImg);
    $("imgCancel").addEventListener("click", () => { $("imgBox").hidden = true; imgSrc = null; });
    noFocus($("imgInsert"), () => {
      if (!imgCanvas) return;
      const transparent = $("imgCut").checked;
      const url = transparent ? imgCanvas.toDataURL("image/png") : imgCanvas.toDataURL("image/jpeg", 0.85);
      insertHTML("<img src='" + url + "' style='width:" + $("imgW").value + "%' alt=''><br>");
      $("imgBox").hidden = true; imgSrc = null;
    });
  }

  /* ---------- الإملاء الصوتي ---------- */
  function initMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition, btn = $("tbMic");
    if (!SR) { btn.style.display = "none"; return; }
    let rec = null, on = false;
    noFocus(btn, () => {
      if (on) { rec.stop(); return; }
      if (!hasActive()) return EM.toast("اضغط داخل نص سؤال أو فرع أولًا", true);
      rec = new SR(); rec.lang = "ar-IQ"; rec.continuous = true; rec.interimResults = false;
      rec.onresult = ev => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) insertText(ev.results[i][0].transcript + " "); };
      rec.onend = () => { on = false; btn.classList.remove("on"); $("micStatus").textContent = ""; };
      rec.onerror = () => { EM.toast("تعذّر الإملاء الصوتي على هذا الجهاز", true); };
      try { rec.start(); on = true; btn.classList.add("on"); $("micStatus").textContent = "🎙️ جارٍ الاستماع…"; } catch (e) {}
    });
  }

  function init() {
    buildPanels(); initImages(); initMic();
    document.querySelectorAll("[data-cmd]").forEach(b => noFocus(b, () => exec(b.dataset.cmd)));
    document.querySelectorAll("[data-panel]").forEach(b => b.addEventListener("click", () => togglePanel(b.dataset.panel)));
    noFocus($("tbFrac"), () => insertHTML("<span class='eq' dir='ltr'><span class='frac' contenteditable='false'><span class='num' contenteditable='true'>1</span><span class='den' contenteditable='true'>2</span></span></span>&nbsp;"));
    noFocus($("tbRoot"), () => insertHTML("<span class='eq' dir='ltr'><span class='rt'><span class='rs'>√</span><span class='root' contenteditable='true'>x</span></span></span>&nbsp;"));
    noFocus($("tbBlank"), () => insertHTML("<span class='blank'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>&nbsp;"));
    noFocus($("tbColorApply"), () => exec("foreColor", $("tbColor").value));
    noFocus($("tbColorClear"), () => exec("foreColor", "#111111"));
  }

  return { init, insertHTML, insertText, hasActive };
})();
