/* ربط الواجهة: التبويبات، الأسئلة، الدرجات، المعاينة، الطباعة، التدقيق، الأرشيف */
"use strict";
(function () {
  const $ = id => document.getElementById(id);
  const E = EM.esc;
  const PAGE_H = 297 * 96 / 25.4;   // ارتفاع A4 بالبكسل

  /* ---------- التبويبات ---------- */
  function showTab(name) {
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("on", p.id === "tab-" + name));
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
    if (name === "output") renderPreview();
    if (name === "marks") renderMarks();
    if (name === "archive") renderArchive();
    window.scrollTo({ top: 0 });
  }

  /* ---------- ربط الحقول بالحالة ---------- */
  function readEl(el) {
    if (el.type === "checkbox") return el.checked;
    if (el.type === "number" || el.type === "range") return el.value === "" ? "" : parseFloat(el.value);
    return el.value;
  }
  function writeEl(el, v) { if (el.type === "checkbox") el.checked = !!v; else el.value = v == null ? "" : v; }
  function syncOuts() { document.querySelectorAll("[data-out]").forEach(o => (o.textContent = EM.get(o.dataset.out))); }
  function bindAll() {
    document.querySelectorAll("[data-bind]").forEach(el => {
      writeEl(el, EM.get(el.dataset.bind));
      const h = () => { EM.set(el.dataset.bind, readEl(el)); EM.save(); syncOuts(); onChanged(el.dataset.bind); };
      el.addEventListener("input", h); el.addEventListener("change", h);
    });
    syncOuts(); refreshLogo();
  }
  function onChanged(path) {
    if (path === "info.total") renderMarks();
    if ($("tab-output").classList.contains("on")) schedulePreview();
  }

  /* ---------- الشعار ---------- */
  function refreshLogo() { const i = $("logoPreview"), l = EM.S.info.logo; i.hidden = !l; if (l) i.src = l; }
  function initLogo() {
    $("btnLogo").addEventListener("click", () => $("logoFile").click());
    $("btnLogoRemove").addEventListener("click", () => { EM.S.info.logo = ""; EM.save(); refreshLogo(); });
    $("logoFile").addEventListener("change", e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, 300 / Math.max(im.width, im.height)), c = document.createElement("canvas");
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          EM.S.info.logo = c.toDataURL("image/png"); EM.save(); refreshLogo();
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(f);
    });
  }

  /* ---------- بطاقات الأسئلة ---------- */
  const rich = (f, ph, html) => "<div class='rich' contenteditable='true' data-f='" + f + "' data-ph='" + ph + "'>" + (html || "") + "</div>";
  function qCardHtml(q, i) {
    const L = EM.LABELS.ar;
    let h = "<div class='qcard' data-id='" + q.id + "'><div class='qhead'><span class='qtitle'>" + E(EM.qName(i, "ar")) + "</span>" +
      "<label class='meta' style='display:flex;gap:4px;align-items:center'>الدرجة <input class='mk' type='number' step='0.5' min='0' data-f='mark' value='" + E(q.mark) + "'></label>" +
      "<button class='iconbtn' data-act='up' title='أعلى'>↑</button><button class='iconbtn' data-act='down' title='أسفل'>↓</button>" +
      "<button class='iconbtn' data-act='dup' title='نسخ'>⧉</button><button class='iconbtn' data-act='del' title='حذف'>🗑</button></div>";
    h += "<input data-f='note' placeholder='ملاحظة بجانب العنوان (اختياري) مثال: اختر الإجابة الصحيحة' value='" + E(q.note) + "' style='margin-bottom:6px'>";
    h += rich("html", "اكتب نص السؤال هنا…", q.html);
    if (q.type === "mcq") {
      h += "<div class='mcqopts'>" + q.opts.map((o, k) => "<div><input type='radio' name='c" + q.id + "' data-f='correct' data-k='" + k + "' " + (q.correct === k ? "checked" : "") + " title='الإجابة الصحيحة'>" +
        "<b>" + L.branch[k] + ")</b><input data-f='opt' data-k='" + k + "' value='" + E(o) + "' placeholder='الخيار'></div>").join("") + "</div>";
    }
    q.branches.forEach((b, k) => {
      h += "<div class='branch' data-bid='" + b.id + "'><div class='bhead'><span class='blabel'>" + L.branch[k] + "</span>" +
        "<label class='meta' style='display:flex;gap:4px;align-items:center'>درجة <input class='mk' type='number' step='0.5' min='0' data-f='bmark' value='" + E(b.mark) + "' style='width:64px;padding:4px'></label>" +
        "<span style='flex:1'></span><button class='iconbtn' data-act='delb' title='حذف الفرع'>✕</button></div>" +
        rich("html", "نص الفرع…", b.html) +
        "<details class='ans'><summary>✔ نموذج إجابة الفرع</summary>" + rich("ans", "الإجابة النموذجية…", b.ans).replace("class='rich'", "class='rich ansed'") + "</details></div>";
    });
    h += "<details class='ans'><summary>✔ نموذج إجابة السؤال" + (q.ans ? " •" : "") + "</summary>" + rich("ans", "الإجابة النموذجية…", q.ans).replace("class='rich'", "class='rich ansed'") + "</details>";
    h += "<div class='qfoot'><button class='btn sm ghost' data-act='addb'>➕ فرع</button>" +
      "<label class='meta'>النوع <select data-f='type'><option value='normal'" + (q.type === "normal" ? " selected" : "") + ">تحرير</option><option value='mcq'" + (q.type === "mcq" ? " selected" : "") + ">اختيار من متعدد</option></select></label>" +
      "<label class='meta'>سطور الإجابة <input type='number' min='0' max='12' data-f='lines' value='" + E(q.lines) + "' placeholder='افتراضي' style='width:78px;padding:4px'></label></div></div>";
    return h;
  }
  function renderQuestions() {
    $("qList").innerHTML = EM.S.questions.map(qCardHtml).join("");
    $("qCount").textContent = "(" + EM.S.questions.length + ")";
  }
  const findQ = id => EM.S.questions.find(q => q.id === id);

  function initQuestions() {
    const list = $("qList");
    const ctx = el => {
      const card = el.closest(".qcard"); if (!card) return {};
      const q = findQ(card.dataset.id), br = el.closest(".branch");
      return { card, q, b: br && q ? q.branches.find(x => x.id === br.dataset.bid) : null };
    };
    list.addEventListener("input", e => {
      const el = e.target, f = el.dataset.f; if (!f) return;
      const { q, b } = ctx(el); if (!q) return;
      if (el.classList.contains("rich")) { (b || q)[f] = el.innerHTML; }
      else if (f === "mark") q.mark = el.value;
      else if (f === "note") q.note = el.value;
      else if (f === "lines") q.lines = el.value;
      else if (f === "bmark" && b) b.mark = el.value;
      else if (f === "opt") q.opts[+el.dataset.k] = el.value;
      EM.save(); onChanged("q");
    });
    list.addEventListener("change", e => {
      const el = e.target, { q } = ctx(el); if (!q) return;
      if (el.dataset.f === "type") { q.type = el.value; EM.save(); renderQuestions(); }
      if (el.dataset.f === "correct") { q.correct = +el.dataset.k; EM.save(); }
    });
    list.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]"); if (!btn) return;
      const { q, b } = ctx(btn), qs = EM.S.questions, i = qs.indexOf(q), act = btn.dataset.act;
      if (act === "up" && i > 0) [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
      else if (act === "down" && i < qs.length - 1) [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]];
      else if (act === "dup") { const c = JSON.parse(JSON.stringify(q)); c.id = EM.uid(); c.branches.forEach(x => (x.id = EM.uid())); qs.splice(i + 1, 0, c); }
      else if (act === "del") { if (qs.length === 1) qs[0] = EM.newQ(); else if (confirm("حذف هذا السؤال؟")) qs.splice(i, 1); else return; }
      else if (act === "addb") q.branches.push(EM.newBranch());
      else if (act === "delb") q.branches.splice(q.branches.indexOf(b), 1);
      EM.save(); renderQuestions();
    });
    $("btnAddQ").addEventListener("click", () => { EM.S.questions.push(EM.newQ()); EM.save(); renderQuestions(); const c = $("qList").lastElementChild; if (c) c.scrollIntoView({ behavior: "smooth", block: "center" }); });
    $("btnDemo").addEventListener("click", () => {
      if (EM.S.questions.some(q => q.html || q.branches.length) && !confirm("سيُستبدل محتوى الأسئلة الحالي بمثال جاهز. متابعة؟")) return;
      const F = EM.fmt, q1 = EM.newQ(), q2 = EM.newQ(), q3 = EM.newQ();
      Object.assign(q1, { mark: 10, type: "mcq", note: "اختر الإجابة الصحيحة", html: "ما الناتج الرئيسي لعملية البناء الضوئي في النبات؟", opts: ["الأوكسجين والغلوكوز", "ثاني أوكسيد الكربون والماء", "النيتروجين", "الأمونيا"], correct: 0, ans: "الأوكسجين والغلوكوز" });
      Object.assign(q2, { mark: 10, html: "حلّ المعادلة التالية: " + F("x^2 - 5x + 6 = 0") + " ثم احسب قيمة " + F("frac{x_1 + x_2}{2}") + ".", ans: F("x = 2") + " أو " + F("x = 3") + "، والناتج " + F("frac{5}{2}") });
      Object.assign(q3, { mark: 10, html: "اكتب معادلة التفاعل ثم أجب:", branches: [
        { id: EM.uid(), html: "أكمل: " + F("6CO2 + 6H2O -> C6H12O6 + 6O2", "chem"), mark: 5, ans: "الغلوكوز والأوكسجين" },
        { id: EM.uid(), html: "عرّف عملية التنفس الخلوي.", mark: 5, ans: "عملية أكسدة الغذاء داخل الخلية لتحرير الطاقة." }] });
      EM.S.questions = [q1, q2, q3]; Object.assign(EM.S.info, { school: "ثانوية النور", subject: "الأحياء", grade: "التاسع", time: "ساعتان", total: 30 });
      EM.save(); bindAll(); renderQuestions(); EM.toast("تم تحميل مثال جاهز");
    });
  }

  /* ---------- الدرجات ---------- */
  function renderMarks() {
    const qs = EM.S.questions, total = +EM.S.info.total || 0;
    $("marksWrap").innerHTML = "<table class='mtab'><thead><tr><th>السؤال</th><th>الدرجة</th><th>الفروع</th></tr></thead><tbody>" +
      qs.map((q, i) => "<tr><td>" + E(EM.qName(i, "ar")) + "</td><td><input type='number' step='0.5' min='0' data-qi='" + i + "' value='" + E(q.mark) + "'></td><td>" +
        (q.branches.length ? q.branches.map((b, k) => EM.LABELS.ar.branch[k] + ": " + (b.mark === "" ? "—" : E(b.mark))).join(" · ") : "—") + "</td></tr>").join("") +
      "</tbody><tfoot><tr><td>المجموع</td><td id='mSum'></td><td id='mState'></td></tr></tfoot></table>";
    updateMarkSum();
    $("marksWrap").querySelectorAll("input[data-qi]").forEach(inp => inp.addEventListener("input", () => {
      EM.S.questions[+inp.dataset.qi].mark = inp.value; EM.save(); updateMarkSum();
      const c = $("qList").children[+inp.dataset.qi]; if (c) c.querySelector("input[data-f=mark]").value = inp.value;
    }));
  }
  function updateMarkSum() {
    const s = EM.totalMarks(), t = +EM.S.info.total || 0, el = $("mState"); if (!el) return;
    $("mSum").textContent = Math.round(s * 100) / 100;
    el.innerHTML = !t ? "" : (Math.abs(s - t) < 0.001 ? "<span class='okc'>✔ يطابق الدرجة الكلية (" + t + ")</span>" : "<span class='warn'>⚠ الدرجة الكلية " + t + " — الفرق " + Math.round((s - t) * 100) / 100 + "</span>");
  }
  $("btnSpread").addEventListener("click", () => {
    const t = +EM.S.info.total || 0, n = EM.S.questions.length; if (!t || !n) return EM.toast("حدّد الدرجة الكلية أولًا", true);
    const each = Math.floor(t / n * 2) / 2; let rem = t - each * n;
    EM.S.questions.forEach((q, i) => { q.mark = String(each + (i === n - 1 ? rem : 0)); });
    EM.save(); renderMarks(); renderQuestions();
  });

  /* ---------- المعاينة ---------- */
  let pt = null;
  function schedulePreview() { clearTimeout(pt); pt = setTimeout(renderPreview, 350); }
  function renderPreview() {
    const box = $("preview"); box.innerHTML = EM.paper.render(EM.S);
    const wrap = $("previewWrap"), avail = wrap.clientWidth - 24, w = 210 * 96 / 25.4;
    const p = box.firstChild; p.style.zoom = avail > 0 && avail < w ? (avail / w).toFixed(3) : "";
  }

  /* ---------- الطباعة مع الملاءمة ---------- */
  function fitSheets(area, pages) {
    area.style.cssText = "display:block;position:absolute;left:-99999px;top:0;visibility:hidden;width:210mm";
    area.querySelectorAll(".sheet:not(.land) > .paper").forEach(p => {
      let z = 1;
      for (let n = 0; n < 8; n++) {
        p.style.zoom = z; p.style.width = (210 / z) + "mm"; p.style.minHeight = (296.5 / z) + "mm";
        const h = p.getBoundingClientRect().height, target = PAGE_H * pages - 2;
        if (h <= target + 1) break;
        z = z * target / h * 0.985;
      }
      p.style.margin = "0";
    });
    area.querySelectorAll(".sheet:not(.land)").forEach(s => { s.style.height = "calc(296.5mm * " + pages + ")"; s.style.overflow = "hidden"; });
    area.style.cssText = "";
  }
  function doPrint(mode) {
    const area = $("printArea"), pages = +EM.S.design.fit || 0;
    area.innerHTML = EM.paper.printHtml(EM.S, mode);
    if (pages) fitSheets(area, pages);
    setTimeout(() => { if (window.Android && typeof Android.printPage === "function") Android.printPage(); else window.print(); }, 60);
  }

  /* ---------- التدقيق ---------- */
  const PUNCT = [[/[ \t ]+([،؛؟!])/g, "$1"], [/([،؛؟])(?=[^\s\d<)\]])/g, "$1 "], [/ {2,}/g, " "]];
  const RULES = EM.SPELL.concat(PUNCT);
  function fields() {
    const out = [];
    EM.S.questions.forEach((q, i) => {
      const n = EM.qName(i, "ar");
      out.push({ label: n, o: q, k: "html" }); out.push({ label: n + " — الإجابة", o: q, k: "ans" });
      q.branches.forEach((b, k) => { out.push({ label: n + " — فرع " + EM.LABELS.ar.branch[k], o: b, k: "html" }); out.push({ label: n + " — إجابة فرع " + EM.LABELS.ar.branch[k], o: b, k: "ans" }); });
    });
    return out;
  }
  function textNodes(root) { const a = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) a.push(n); return a; }
  function runProof() {
    const issues = [];
    fields().forEach((f, fi) => {
      const root = document.createElement("div"); root.innerHTML = f.o[f.k] || "";
      textNodes(root).forEach(tn => RULES.forEach((r, ri) => {
        const re = new RegExp(r[0].source, r[0].flags), m = re.exec(tn.data);
        if (m) issues.push(ri >= EM.SPELL.length ? { fi, ri, label: f.label, from: "تنسيق المسافات وعلامات الترقيم", to: "مسافات صحيحة" } :
          { fi, ri, label: f.label, from: m[0], to: m[0].replace(new RegExp(r[0].source, r[0].flags.replace("g", "")), r[1]) });
      }));
    });
    const seen = new Set(), uniq = issues.filter(x => { const k = x.fi + "|" + x.ri; if (seen.has(k)) return false; seen.add(k); return true; });
    $("proofOut").innerHTML = uniq.length ? uniq.map((x, n) => "<div class='proofitem'>" + E(x.label) + ": «" + E(x.from) + "» ← «" + E(x.to) + "» <button class='btn sm green' data-n='" + n + "'>إصلاح</button></div>").join("") : "<div class='okc' style='margin-top:8px'>✔ لم يُعثر على أخطاء شائعة.</div>";
    $("btnFixAll").hidden = !uniq.length;
    $("proofOut").dataset.issues = JSON.stringify(uniq.map(x => [x.fi, x.ri]));
  }
  function fix(pairs) {
    const fs = fields();
    pairs.forEach(([fi, ri]) => {
      const f = fs[fi], root = document.createElement("div"); root.innerHTML = f.o[f.k] || "";
      textNodes(root).forEach(tn => (tn.data = tn.data.replace(new RegExp(RULES[ri][0].source, RULES[ri][0].flags), RULES[ri][1])));
      f.o[f.k] = root.innerHTML;
    });
    EM.save(); renderQuestions(); runProof(); EM.toast("تم الإصلاح ✔");
  }
  $("btnProof").addEventListener("click", runProof);
  $("btnFixAll").addEventListener("click", () => fix(JSON.parse($("proofOut").dataset.issues || "[]")));
  $("proofOut").addEventListener("click", e => { const b = e.target.closest("[data-n]"); if (b) fix([JSON.parse($("proofOut").dataset.issues)[+b.dataset.n]]); });

  /* ---------- الأرشيف ---------- */
  function renderArchive() {
    const a = EM.archive.list();
    $("examList").innerHTML = a.length ? a.map(x => "<div class='exitem' data-id='" + x.id + "'><b>" + E(x.name) + "</b><span class='meta'>" + new Date(x.savedAt).toLocaleDateString("ar") + "</span>" +
      "<button class='btn sm' data-a='load'>فتح</button><button class='btn sm danger' data-a='del'>حذف</button></div>").join("") : "<div class='meta' style='margin:10px 0'>لا توجد امتحانات محفوظة بعد.</div>";
  }
  $("btnSaveExam").addEventListener("click", () => {
    const name = $("saveName").value.trim() || (EM.S.info.subject + " " + EM.S.info.grade).trim() || "امتحان";
    if (EM.archive.add(name)) { $("saveName").value = ""; renderArchive(); EM.toast("تم الحفظ في الأرشيف ✔"); }
  });
  $("examList").addEventListener("click", e => {
    const b = e.target.closest("[data-a]"); if (!b) return; const id = b.closest(".exitem").dataset.id;
    if (b.dataset.a === "del") { if (confirm("حذف هذا الامتحان من الأرشيف؟")) { EM.archive.remove(id); renderArchive(); } }
    else { const it = EM.archive.get(id); if (it && confirm("سيُستبدل الامتحان الحالي بالمحفوظ. متابعة؟")) { EM.S = EM.normalize(it.data); EM.save(true); renderAll(); showTab("info"); EM.toast("تم فتح الامتحان"); } }
  });
  $("btnExport").addEventListener("click", EM.exp.exportJson);
  $("btnImport").addEventListener("click", () => $("jsonFile").click());
  $("jsonFile").addEventListener("change", async e => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try { EM.S = EM.normalize(JSON.parse(await f.text())); EM.save(true); renderAll(); EM.toast("تم الاستيراد ✔"); } catch (x) { EM.toast("ملف غير صالح", true); }
  });
  $("btnWipe").addEventListener("click", () => { if (confirm("مسح الامتحان الحالي وبدء امتحان جديد؟ (الأرشيف لا يتأثر)")) { EM.S = EM.defaults(); EM.save(true); renderAll(); showTab("info"); } });

  /* ---------- القرآن ---------- */
  let qHits = [], qShown = 0;
  function renderHits(more) {
    const box = $("qResults");
    if (!more) { box.innerHTML = ""; qShown = 0; }
    const part = qHits.slice(qShown, qShown + 30); qShown += part.length;
    box.querySelectorAll(".moreb").forEach(x => x.remove());
    if (!qHits.length) { box.innerHTML = "<div class='meta'>لا نتائج.</div>"; return; }
    part.forEach(v => {
      const d = document.createElement("div"); d.className = "qitem";
      d.innerHTML = "<div class='qtext'>﴿ " + E(v[2]) + " ﴾</div><div class='qmeta'><span class='meta'>" + E(EM.quran.ref(v)) + "</span><button class='btn sm green'>⬇️ إدراج</button></div>";
      d.querySelector("button").addEventListener("click", () => {
        if (!EM.editor.hasActive()) return EM.toast("اضغط داخل نص سؤال أو فرع (تبويب الأسئلة) أولًا", true);
        showTab("questions");
        setTimeout(() => EM.editor.insertHTML("<span class='ayah'>﴿ " + E(v[2]) + " ﴾</span>" + ($("qRef").checked ? " <span class='qref'>" + E(EM.quran.ref(v)) + "</span>" : "") + "&nbsp;"), 30);
      });
      box.appendChild(d);
    });
    if (qShown < qHits.length) { const m = document.createElement("button"); m.className = "btn ghost sm moreb"; m.textContent = "عرض المزيد (" + (qHits.length - qShown) + ")"; m.onclick = () => renderHits(true); box.appendChild(m); }
  }
  async function initQuran() {
    $("qSurah").innerHTML = "<option value='0'>كل السور</option>" + EM.SURAHS.map((s, i) => "<option value='" + (i + 1) + "'>" + (i + 1) + " — " + s + "</option>").join("");
    const ok = await EM.quran.load(), note = $("quranSetup");
    if (!ok) {
      note.hidden = false;
      note.innerHTML = "نص القرآن غير مضمَّن في البرنامج. حمّل ملف <b>quran-uthmani.txt</b> (النص العثماني، صيغة Tanzil) من <a href='https://tanzil.net/download/' target='_blank' rel='noopener'>tanzil.net/download</a> ثم اختره هنا مرة واحدة فقط — يُحفظ على جهازك ويعمل دون إنترنت.<div class='actions'><button class='btn sm' id='btnQFile'>📂 اختيار ملف القرآن</button><input type='file' id='qFile' accept='.txt' hidden></div>";
      $("btnQFile").onclick = () => $("qFile").click();
      $("qFile").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const n = await EM.quran.importFile(f); note.hidden = true; EM.toast("تم تحميل " + n + " آية ✔"); } catch (x) { EM.toast("الملف غير مطابق للصيغة المطلوبة", true); } };
    }
    $("btnQSearch").addEventListener("click", async () => {
      if (!(await EM.quran.load())) return EM.toast("حمّل ملف القرآن أولًا", true);
      const q = $("qSearch").value.trim(), s = +$("qSurah").value;
      qHits = q ? EM.quran.search(q, s) : (s ? EM.quran.surahVerses(s) : []);
      if (!q && !s) return EM.toast("اكتب كلمات أو اختر سورة", true);
      renderHits(false);
    });
    $("qSearch").addEventListener("keydown", e => { if (e.key === "Enter") $("btnQSearch").click(); });
  }

  /* ---------- بدء التشغيل ---------- */
  function renderAll() { bindAll(); renderQuestions(); renderMarks(); }
  function init() {
    EM.load();
    $("dlSubjects").innerHTML = EM.SUBJECTS.map(s => "<option value='" + E(s) + "'>").join("");
    $("dlGrades").innerHTML = EM.GRADES.map(s => "<option value='" + E(s) + "'>").join("");
    $("dlTerms").innerHTML = EM.TERMS.map(s => "<option value='" + E(s) + "'>").join("");
    $("dlPhrases").innerHTML = EM.PHRASES.map(s => "<option value='" + E(s) + "'>").join("");
    ["creditLink", "creditLink2"].forEach(id => { const a = $(id); a.textContent = EM.CREDIT.name; a.href = EM.CREDIT.url; });
    document.querySelectorAll("#tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
    initLogo(); initQuestions(); EM.editor.init(); initQuran(); renderAll();
    $("btnPrint").addEventListener("click", () => doPrint("exam"));
    $("btnPrintKey").addEventListener("click", () => doPrint("key"));
    $("btnRefresh").addEventListener("click", renderPreview);
    $("btnWord").addEventListener("click", async () => { try { EM.toast("جارٍ تجهيز ملف Word…"); await EM.exp.docx(); } catch (e) { console.error(e); EM.toast("تعذّر إنشاء ملف Word", true); } });
    $("btnExcel").addEventListener("click", () => { try { EM.exp.xlsx(); } catch (e) { console.error(e); EM.toast("تعذّر إنشاء ملف Excel", true); } });
    window.addEventListener("resize", () => { if ($("tab-output").classList.contains("on")) renderPreview(); });
    window.addEventListener("beforeunload", () => EM.save(true));
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.Android) navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  document.addEventListener("DOMContentLoaded", init);
})();
