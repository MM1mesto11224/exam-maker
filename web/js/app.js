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
    h += "<input data-f='title' placeholder='عنوان القسم للنمط الإنكليزي/الفرنسي، مثال: Read the following text then choose the correct answer' value='" + E(q.title) + "' style='margin-bottom:6px;direction:ltr;text-align:left'>";
    h += rich("html", "اكتب نص السؤال (أو النص المقروء) هنا…", q.html);
    if (q.type === "mcq") {
      h += "<div class='mcqopts'>" + q.opts.map((o, k) => "<div><input type='radio' name='c" + q.id + "' data-f='correct' data-k='" + k + "' " + (q.correct === k ? "checked" : "") + " title='الإجابة الصحيحة'>" +
        "<b>" + L.branch[k] + ")</b><input data-f='opt' data-k='" + k + "' value='" + E(o) + "' placeholder='الخيار'></div>").join("") + "</div>";
    }
    const exam = EM.S.design.layout === "exam";
    let bn = 0;
    q.branches.forEach((b, k) => {
      const kinds = Object.keys(EM.KINDS).filter(x => exam || x === "text" || x === "mcq" || x === b.kind);
      const lbl = exam ? (b.kind === "head" ? "•" : "#" + (++bn)) : L.branch[k];
      h += "<div class='branch' data-bid='" + b.id + "'><div class='bhead'><span class='blabel'>" + lbl + "</span>" +
        "<select data-f='bkind' style='width:auto;padding:4px'>" + kinds.map(x => "<option value='" + x + "'" + (b.kind === x ? " selected" : "") + ">" + EM.KINDS[x] + "</option>").join("") + "</select>" +
        "<label class='meta' style='display:flex;gap:4px;align-items:center'>درجة <input class='mk' type='number' step='0.5' min='0' data-f='bmark' value='" + E(b.mark) + "' style='width:64px;padding:4px'></label>" +
        "<span style='flex:1'></span><button class='iconbtn' data-act='delb' title='حذف الفرع'>✕</button></div>" +
        rich("html", b.kind === "head" ? "العنوان الفرعي، مثال: Write true (T) or false (F)" : b.kind === "match" ? "عنصر العمود (A)…" : "نص الفرع…", b.html);
      if (b.kind === "mcq") h += "<div class='mcqopts'>" + b.opts.map((o, j) => "<div><input type='radio' name='bc" + b.id + "' data-f='bcorrect' data-k='" + j + "' " + (b.correct === j ? "checked" : "") + " title='الإجابة الصحيحة'><b>" + "abcd"[j] + ")</b><input data-f='bopt' data-k='" + j + "' value='" + E(o) + "' placeholder='الخيار' style='direction:ltr;text-align:left'></div>").join("") + "</div>";
      if (b.kind === "tf") h += "<label class='meta'>الإجابة الصحيحة <select data-f='btf' style='width:auto'><option value='T'" + (b.tf === "T" ? " selected" : "") + ">True (T)</option><option value='F'" + (b.tf === "F" ? " selected" : "") + ">False (F)</option></select></label>";
      if (b.kind === "match") h += "<input data-f='bright' placeholder='عنصر العمود (B) في هذا السطر' value='" + E(b.right) + "' style='margin-top:6px;direction:ltr;text-align:left'>";
      if (b.kind === "ulines" || b.kind === "text") h += "<label class='meta'>سطور نقطية تحته <input type='number' min='0' max='12' data-f='blines' value='" + E(b.lines) + "' placeholder='" + (b.kind === "ulines" ? "2" : "0") + "' style='width:70px;padding:4px'></label>";
      if (b.kind !== "head") h += "<details class='ans'><summary>✔ نموذج إجابة الفرع" + (b.kind === "match" ? " (مثال: c)" : "") + "</summary>" + rich("ans", "الإجابة النموذجية…", b.ans).replace("class='rich'", "class='rich ansed'") + "</details>";
      h += "</div>";
    });
    h += "<details class='ans'><summary>✔ نموذج إجابة السؤال" + (q.ans ? " •" : "") + "</summary>" + rich("ans", "الإجابة النموذجية…", q.ans).replace("class='rich'", "class='rich ansed'") + "</details>";
    h += "<div class='qfoot'><button class='btn sm ghost' data-act='addb'>➕ فرع</button>" + (exam ? "<button class='btn sm ghost' data-act='addhead'>➕ عنوان فرعي</button>" : "") + +
      "<label class='meta'>النوع <select data-f='type'><option value='normal'" + (q.type === "normal" ? " selected" : "") + ">تحرير</option><option value='mcq'" + (q.type === "mcq" ? " selected" : "") + ">اختيار من متعدد</option></select></label>" +
      "<label class='meta'>سطور الإجابة <input type='number' min='0' max='12' data-f='lines' value='" + E(q.lines) + "' placeholder='افتراضي' style='width:78px;padding:4px'></label></div></div>";
    return h;
  }
  function renderQuestions() {
    $("qList").innerHTML = EM.S.questions.map(qCardHtml).join("");
    $("qCount").textContent = "(" + EM.S.questions.length + ")";
  }
  const findQ = id => EM.S.questions.find(q => q.id === id);


  /* ---------- نمط الإنكليزية / الفرنسية ---------- */
  function applyStyle(kind) {
    const d = EM.S.design;
    if (kind === "std") Object.assign(d, { layout: "std", lang: "ar", font: "'Traditional Arabic',serif", size: 17, marksTable: true, sep: "orn", frame: "f-double" });
    else Object.assign(d, { layout: "exam", lang: kind, font: "Arial,sans-serif", size: 12.5, lineH: 1.5, qgap: 3, padTop: 10, frame: "f-thick", sep: "none", marksTable: false, instr: false, phrase: "", lines: 0, hsize: 13 });
    EM.save(); bindAll(); renderQuestions(); if ($("tab-output").classList.contains("on")) renderPreview();
    EM.toast(kind === "std" ? "عدنا إلى النمط العادي" : "تم تطبيق نمط " + (kind === "en" ? "الإنكليزية" : "الفرنسية"));
  }
  function loadLangDemo(lang) {
    if (EM.S.questions.some(q => q.html || q.branches.length) && !confirm("سيُستبدل محتوى الأسئلة الحالي بنموذج جاهز. متابعة؟")) return;
    const en = lang === "en", B = (kind, o) => Object.assign(EM.newBranch(kind), o), Q = o => Object.assign(EM.newQ(), o);
    const mc = (h, opts, c) => B("mcq", { html: h, opts, correct: c });
    const T = en ? {
      a: "Read the following text then choose the correct answer a, b, c, or d:", p1: "Sara lives in a small village near the sea. Every morning she wakes up at six, helps her mother in the kitchen and then walks to school with her brother. After school she reads a book or plays football with her friends.",
      q: [["Where does Sara live?", ["In a city", "Near the sea", "In the desert", "On a farm"], 1], ["What time does she wake up?", ["At five", "At six", "At seven", "At eight"], 1], ["Who walks to school with her?", ["Her father", "Her friend", "Her brother", "Her teacher"], 2]],
      b: "Read the following text then do the tasks below:", p2: "Ahmad is a doctor. He works in a big hospital and helps sick people every day. He likes his job very much.", tfh: "- Write true (T) or false (F)",
      tf: [["Ahmad is a teacher.", "F"], ["He works in a hospital.", "T"]], qh: "- Answer the following questions about the text:", qs: ["What is Ahmad's job?", "Does he like his job?"],
      c: "Choose the correct answer a, b, c, or d:", cq: [["She ... to school every day.", ["go", "goes", "going", "gone"], 1], ["They are ... football now.", ["play", "plays", "playing", "played"], 2]],
      d: "Match each item in (A) with the suitable choice from (B):", m: [["A doctor works in a", "hospital", "a"], ["A teacher works in a", "classroom", "b"], ["A farmer works on a", "farm", "c"]], mr: ["hospital", "school", "farm"],
      e: "Write suitable questions about the underlined words:", u: ["My brother <u>plays football</u> every day.", "She lives <u>in a small village</u>."], f: "Write a 50-word paragraph about ONE of the following topics:", f1: "1. My best friend.   2. My school."
    } : {
      a: "Lisez le texte suivant puis choisissez la bonne réponse a, b, c ou d :", p1: "Léa habite dans un petit village près de la mer. Chaque matin, elle se lève à six heures, aide sa mère dans la cuisine puis va à l'école avec son frère. Après l'école, elle lit un livre ou joue au football avec ses amis.",
      q: [["Où habite Léa ?", ["En ville", "Près de la mer", "Dans le désert", "Dans une ferme"], 1], ["À quelle heure se lève-t-elle ?", ["À cinq heures", "À six heures", "À sept heures", "À huit heures"], 1], ["Qui va à l'école avec elle ?", ["Son père", "Son amie", "Son frère", "Sa maîtresse"], 2]],
      b: "Lisez le texte suivant puis répondez aux questions :", p2: "Karim est médecin. Il travaille dans un grand hôpital et aide les malades chaque jour. Il aime beaucoup son métier.", tfh: "- Vrai (V) ou faux (F) ?",
      tf: [["Karim est professeur.", "F"], ["Il travaille dans un hôpital.", "T"]], qh: "- Répondez aux questions suivantes :", qs: ["Quel est le métier de Karim ?", "Aime-t-il son métier ?"],
      c: "Choisissez la bonne réponse a, b, c ou d :", cq: [["Elle ... à l'école chaque jour.", ["vas", "va", "allons", "aller"], 1], ["Nous ... le football maintenant.", ["joue", "jouez", "jouons", "jouent"], 2]],
      d: "Associez chaque élément de (A) à la réponse qui convient dans (B) :", m: [["Un médecin travaille à l'", "hôpital", "a"], ["Un professeur travaille dans une", "classe", "b"], ["Un fermier travaille dans une", "ferme", "c"]], mr: ["hôpital", "école", "ferme"],
      e: "Posez des questions sur les mots soulignés :", u: ["Mon frère <u>joue au football</u> chaque jour.", "Elle habite <u>dans un petit village</u>."], f: "Rédigez un paragraphe de 50 mots sur UN des sujets suivants :", f1: "1. Mon meilleur ami.   2. Mon école."
    };
    const qA = Q({ mark: 30, title: T.a, html: T.p1, branches: T.q.map(x => mc(x[0], x[1], x[2])) });
    const tfq = T.tf.map(x => B("tf", { html: x[0], tf: x[1] === "F" ? "F" : "T" }));
    const qB = Q({ mark: 20, title: T.b, html: T.p2, branches: [B("head", { html: T.tfh })].concat(tfq, [B("head", { html: T.qh })], T.qs.map(x => B("text", { html: x, lines: 2 }))) });
    const qC = Q({ mark: 20, title: T.c, branches: T.cq.map(x => mc(x[0], x[1], x[2])) });
    const qD = Q({ mark: 15, title: T.d, branches: T.m.map((x, k) => B("match", { html: x[0], right: T.mr[(k + 1) % 3], ans: "abc"[(T.mr.indexOf(x[1]) + 2) % 3] })) });
    const qE = Q({ mark: 10, title: T.e, branches: T.u.map(x => B("ulines", { html: x })) });
    const qF = Q({ mark: 5, title: T.f, html: T.f1, lines: 4 });
    EM.S.questions = [qA, qB, qC, qD, qE, qF];
    Object.assign(EM.S.info, { subject: en ? "اللغة الإنكليزية" : "اللغة الفرنسية", time: "ساعة ونصف", total: 100 });
    applyStyle(lang);
    EM.toast("تم تحميل نموذج امتحان " + (en ? "إنكليزي" : "فرنسي") + " (نصوص تجريبية قابلة للتعديل)");
  }
  function initLangStyle() {
    $("btnStyleEn").addEventListener("click", () => applyStyle("en"));
    $("btnStyleFr").addEventListener("click", () => applyStyle("fr"));
    $("btnStyleStd").addEventListener("click", () => applyStyle("std"));
    $("btnDemoEn").addEventListener("click", () => loadLangDemo("en"));
    $("btnDemoFr").addEventListener("click", () => loadLangDemo("fr"));
  }


  /* ---------- قوالب المواد (قائمة منسدلة: المادة ← الصف ← الفرع) ---------- */
  function initTemplates() {
    const E0 = EM.tplEntries(), selS = $("tplSubject"), selG = $("tplGrade"), selB = $("tplBranch");
    const opt = (v, t) => "<option value='" + E(v) + "'>" + E(t || v) + "</option>";
    const uniq = a => a.filter((x, i) => a.indexOf(x) === i);
    const byOrder = (a, ord) => a.slice().sort((x, y) => { const i = ord.indexOf(x), j = ord.indexOf(y); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    const subjects = byOrder(uniq(E0.map(e => e.s)), EM.TPL_SUBJECT_ORDER);
    selS.innerHTML = subjects.map(x => opt(x)).join("");
    function fillGrades() {
      const gs = byOrder(uniq(E0.filter(e => e.s === selS.value).map(e => e.g)), EM.TPL_GRADE_ORDER);
      selG.innerHTML = gs.map(x => opt(x)).join(""); fillBranches();
    }
    function fillBranches() {
      const bs = uniq(E0.filter(e => e.s === selS.value && e.g === selG.value).map(e => e.b));
      selB.innerHTML = bs.map(x => opt(x, x || "—")).join("");
      $("tplBranchWrap").hidden = bs.length === 1 && bs[0] === "";
      info();
    }
    const cur = () => E0.find(e => e.s === selS.value && e.g === selG.value && e.b === selB.value);
    function info() {
      const e = cur(); if (!e) return $("tplInfo").textContent = "";
      const n = e.t.qs.length, tot = e.t.total;
      $("tplInfo").textContent = "الجهة: " + e.t.ministry + " — " + n + " أقسام — الدرجة الكلية " + tot + (e.t.time ? " — الزمن: " + e.t.time : "") +
        (e.t.gs ? " — هذا القالب يخدم الصفوف: " + e.t.gs.join("، ") : "") + (e.t.L ? " — نمط لغات (عمودان)" : "");
    }
    selS.addEventListener("change", fillGrades); selG.addEventListener("change", fillBranches); selB.addEventListener("change", info);
    $("btnTpl").addEventListener("click", () => {
      const e = cur(); if (!e) return;
      if (EM.S.questions.some(q => q.html || q.branches.length) && !confirm("سيُستبدل محتوى الأسئلة الحالي بهيكل القالب (تبقى بيانات المدرسة والمدرّس والشعار). متابعة؟")) return;
      const t = e.t;
      if (t.L) applyStyle(t.L); else if (EM.S.design.layout === "exam") applyStyle("std");
      EM.S.questions = EM.tplBuild(t);
      Object.assign(EM.S.info, { ministry: t.ministry, subject: t.s, grade: EM.tplGradeHeader(e), time: t.time || "", total: t.total, poet: "", verses: t.verses || "" });
      EM.save(); bindAll(); renderQuestions(); renderMarks && renderMarks();
      EM.toast("تم تحميل قالب " + t.s + (e.g !== "عام (حسب الصف)" ? " — " + e.g : "")); 
    });
    fillGrades();
  }

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
      else if (f === "title") q.title = el.value;
      else if (f === "bopt" && b) b.opts[+el.dataset.k] = el.value;
      else if (f === "bright" && b) b.right = el.value;
      else if (f === "blines" && b) b.lines = el.value;
      else if (f === "lines") q.lines = el.value;
      else if (f === "bmark" && b) b.mark = el.value;
      else if (f === "opt") q.opts[+el.dataset.k] = el.value;
      EM.save(); onChanged("q");
    });
    list.addEventListener("change", e => {
      const el = e.target, { q } = ctx(el); if (!q) return;
      if (el.dataset.f === "type") { q.type = el.value; EM.save(); renderQuestions(); }
      if (el.dataset.f === "correct") { q.correct = +el.dataset.k; EM.save(); }
      const bb = ctx(el).b;
      if (bb && el.dataset.f === "bkind") { bb.kind = el.value; EM.save(); renderQuestions(); onChanged("q"); }
      if (bb && el.dataset.f === "bcorrect") { bb.correct = +el.dataset.k; EM.save(); onChanged("q"); }
      if (bb && el.dataset.f === "btf") { bb.tf = el.value; EM.save(); onChanged("q"); }
    });
    list.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]"); if (!btn) return;
      const { q, b } = ctx(btn), qs = EM.S.questions, i = qs.indexOf(q), act = btn.dataset.act;
      if (act === "up" && i > 0) [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
      else if (act === "down" && i < qs.length - 1) [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]];
      else if (act === "dup") { const c = JSON.parse(JSON.stringify(q)); c.id = EM.uid(); c.branches.forEach(x => (x.id = EM.uid())); qs.splice(i + 1, 0, c); }
      else if (act === "del") { if (qs.length === 1) qs[0] = EM.newQ(); else if (confirm("حذف هذا السؤال؟")) qs.splice(i, 1); else return; }
      else if (act === "addb") q.branches.push(EM.newBranch(EM.S.design.layout === "exam" ? "mcq" : "text"));
      else if (act === "addhead") q.branches.push(EM.newBranch("head"));
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
  function preparePrint(mode) {
    const area = $("printArea"), pages = +EM.S.design.fit || 0;
    const android = !!(window.Android && typeof Android.printPage === "function"), land = (+EM.S.design.perPage || 1) > 1;
    // على أندرويد لا يمكن خلط صفحات أفقية وعمودية في مهمة طباعة واحدة، فيُطبع نموذج الإجابة منفصلًا
    area.innerHTML = EM.paper.printHtml(EM.S, mode, { noKey: android && land });
    if (android && land && mode === "exam" && EM.S.design.answersSheet) EM.toast("طباعة أفقية: اطبع نموذج الإجابة بزر «طباعة نموذج الإجابة» بشكل منفصل");
    if (pages) fitSheets(area, pages);
    return { android, land };
  }
  function doPrint(mode) {
    const { android, land } = preparePrint(mode);
    setTimeout(() => { if (android) Android.printPage(land && mode === "exam"); else window.print(); }, 60);
  }
  /* نسخة ويندوز: حفظ ملف PDF مباشرة دون نافذة طابعة */
  async function savePdf() {
    const { land } = preparePrint("exam");
    await new Promise(r => setTimeout(r, 150));
    const name = ((EM.S.info.subject || "امتحان") + " " + (EM.S.info.grade || "")).trim();
    const r = await window.desktop.savePdf(name, land);
    if (r && r.ok) EM.toast("تم حفظ PDF ✔");
    else if (r && !r.canceled) EM.toast("تعذّر حفظ PDF", true);
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
      note.innerHTML = "نص القرآن غير مضمَّن في البرنامج. حمّل ملف <b>quran-uthmani.txt</b> (النص العثماني، صيغة Tanzil) من <a href='https://tanzil.net/download/' target='_blank' rel='noopener'>tanzil.net/download</a> ثم اختره هنا مرة واحدة فقط — يُحفظ على جهازك ويعمل دون إنترنت.<div class='actions'><button class='btn sm' id='btnQFile'>📂 اختيار ملف القرآن</button><input type='file' id='qFile' hidden></div>";
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
    initLogo(); initQuestions(); initLangStyle(); initTemplates(); EM.editor.init(); initQuran(); renderAll();
    $("btnPrint").addEventListener("click", () => doPrint("exam"));
    $("btnPrintKey").addEventListener("click", () => doPrint("key"));
    if (window.desktop && window.desktop.savePdf) { $("btnPdf").hidden = false; $("btnPdf").addEventListener("click", savePdf); }
    $("btnRefresh").addEventListener("click", renderPreview);
    $("btnWord").addEventListener("click", async () => { try { EM.toast("جارٍ تجهيز ملف Word…"); await EM.exp.docx(); } catch (e) { console.error(e); EM.toast("تعذّر إنشاء ملف Word", true); } });
    $("btnExcel").addEventListener("click", () => { try { EM.exp.xlsx(); } catch (e) { console.error(e); EM.toast("تعذّر إنشاء ملف Excel", true); } });
    window.addEventListener("resize", () => { if ($("tab-output").classList.contains("on")) renderPreview(); });
    window.addEventListener("beforeunload", () => EM.save(true));
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.Android) navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  document.addEventListener("DOMContentLoaded", init);
})();
