/* الحالة والحفظ المحلي والأرشيف */
"use strict";
window.EM = window.EM || {};

EM.KEY = "examMaker:current:v1";
EM.ARCH = "examMaker:archive:v1";
EM.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

EM.newQ = () => ({ id: EM.uid(), type: "normal", mark: 10, note: "", html: "", opts: ["", "", "", ""], correct: 0,
  branches: [], ans: "", lines: "" });
EM.newBranch = () => ({ id: EM.uid(), html: "", mark: "", ans: "" });

EM.defaults = () => ({
  info: { ministry: "", school: "", subject: "", grade: "", year: "2026-2027", term: "الدور الأول", date: "", time: "",
    total: 100, logo: "", poet: "", verses: "", teacher: "" },
  design: { font: "'Traditional Arabic',serif", size: 17, hsize: 15, padTop: 14, lineH: 1.8, qgap: 3.4, qcolor: "#174a7c",
    hcolor: "#174a7c", tcolor: "#111111", head: "classic", lang: "ar", frame: "f-double", sep: "orn", instr: false,
    instrText: "", instrColor: "orange", marksTable: true, phrase: EM.PHRASES[0], answersSheet: true, copies: 1,
    perPage: "1", fit: "0", lines: 0 },
  questions: [EM.newQ()]
});

/* دمج بيانات محمّلة مع الافتراضيات مع تنظيف HTML */
EM.normalize = function (d) {
  const f = EM.defaults();
  if (!d || typeof d !== "object" || !Array.isArray(d.questions)) return f;
  const out = { info: Object.assign(f.info, d.info || {}), design: Object.assign(f.design, d.design || {}), questions: [] };
  const S = EM.sanitize;
  out.info.logo = /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(out.info.logo || "") ? out.info.logo : "";
  out.questions = d.questions.map(q => {
    const b = Object.assign(EM.newQ(), q);
    b.html = S(b.html); b.ans = S(b.ans); b.note = String(b.note || "");
    b.opts = (Array.isArray(b.opts) ? b.opts : []).concat(["", "", "", ""]).slice(0, 4).map(String);
    b.branches = (Array.isArray(q.branches) ? q.branches : []).map(x => {
      const c = Object.assign(EM.newBranch(), x); c.html = S(c.html); c.ans = S(c.ans); return c;
    });
    return b;
  });
  if (!out.questions.length) out.questions.push(EM.newQ());
  return out;
};

EM.S = EM.defaults();

EM.load = function () {
  try { EM.S = EM.normalize(JSON.parse(localStorage.getItem(EM.KEY))); } catch (e) { EM.S = EM.defaults(); }
};

let saveTimer = null;
EM.save = function (now) {
  clearTimeout(saveTimer);
  const run = () => {
    try { localStorage.setItem(EM.KEY, JSON.stringify(EM.S)); }
    catch (e) { EM.toast("تعذّر الحفظ التلقائي (الذاكرة ممتلئة). صدّر نسخة JSON من تبويب الأرشيف.", true); }
  };
  now ? run() : (saveTimer = setTimeout(run, 400));
};

/* قراءة/كتابة بمسار نقطي مثل design.size */
EM.get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), EM.S);
EM.set = (path, v) => { const p = path.split("."), k = p.pop(); p.reduce((o, x) => o[x], EM.S)[k] = v; };

/* الأرشيف */
EM.archive = {
  list() { try { return JSON.parse(localStorage.getItem(EM.ARCH)) || []; } catch (e) { return []; } },
  write(a) { try { localStorage.setItem(EM.ARCH, JSON.stringify(a)); return true; } catch (e) { EM.toast("الذاكرة ممتلئة — احذف عناصر من الأرشيف", true); return false; } },
  add(name) { const a = this.list(); a.unshift({ id: EM.uid(), name, savedAt: Date.now(), data: JSON.parse(JSON.stringify(EM.S)) }); return this.write(a); },
  remove(id) { this.write(this.list().filter(x => x.id !== id)); },
  get(id) { return this.list().find(x => x.id === id); }
};

/* إشعار صغير */
EM.toast = function (msg, err) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(EM.toast._t); EM.toast._t = setTimeout(() => (t.className = ""), 2800);
};

/* ترقيم الأسئلة وأسماؤها */
EM.qName = (i, lang) => { const L = EM.LABELS[lang]; return L.question + " " + (L.ordinal ? (EM.ORD_AR[i] || (i + 1)) : (i + 1)); };

/* مجموع درجات سؤال: درجته إن وُجدت، وإلا مجموع فروعه */
EM.qMark = q => { const m = parseFloat(q.mark); if (!isNaN(m)) return m; return q.branches.reduce((s, b) => s + (parseFloat(b.mark) || 0), 0); };
EM.totalMarks = () => EM.S.questions.reduce((s, q) => s + EM.qMark(q), 0);
