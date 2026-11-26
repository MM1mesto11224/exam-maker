/* رسم ورقة الامتحان ونموذج الإجابة (للمعاينة والطباعة) */
"use strict";
window.EM = window.EM || {};

EM.paper = (function () {
  const E = EM.esc;
  const num = v => { const n = parseFloat(v); return isNaN(n) ? "" : (Math.round(n * 100) / 100); };

  function header(S, L) {
    const i = S.info, d = S.design;
    const logo = i.logo ? "<img src='" + i.logo + "' alt=''>" : "";
    const row = (k, v) => v ? "<div><b>" + k + ":</b> " + E(v) + "</div>" : "";
    const dateTxt = i.date || "";
    return "<div class='ph phd-" + d.head + "'>" +
      "<div class='colr'>" + (i.ministry ? "<div class='min'>" + E(i.ministry) + "</div>" : "") + "<div class='sname'>" + E(i.school) + "</div></div>" +
      "<div class='colc'>" + logo + (i.year ? "<div class='yr'>" + E(i.year) + "</div>" : "") + "<div class='trm'>" + E(i.term) + "</div></div>" +
      "<div class='coll'>" + row(L.subject, i.subject) + row(L.grade, i.grade) + row(L.date, dateTxt) + row(L.time, i.time) +
      row(L.total, i.total === "" ? "" : String(i.total)) + "</div></div>";
  }

  function poetry(S) {
    const i = S.info; if (!i.poet && !i.verses.trim()) return "";
    return "<div class='poetry'>" + (i.poet ? "<div class='poet'>" + E(i.poet) + "</div>" : "") +
      "<div class='verses'>" + i.verses.split("\n").filter(x => x.trim()).map(E).join("<br>") + "</div></div>";
  }

  function sep(d) {
    if (d.sep === "none") return "";
    const mid = d.sep === "orn" ? "❖" : d.sep === "star" ? "✦" : "";
    return "<div class='qsep'><span class='ql'></span>" + (mid ? "<span class='qo'>" + mid + "</span><span class='ql'></span>" : "") + "</div>";
  }

  function linesHtml(q, d) {
    const n = q.lines === "" || q.lines == null ? +d.lines || 0 : +q.lines || 0;
    return n > 0 ? "<div class='alines'>" + "<div></div>".repeat(Math.min(n, 12)) + "</div>" : "";
  }

  function questionHtml(q, idx, S, key) {
    const d = S.design, L = EM.LABELS[d.lang];
    const bl = k => L.branch[k] || String(k + 1);
    let h = "<div class='pq'><div class='pqtitle'><span><span class='qnum'>" + E(EM.qName(idx, d.lang)) + "</span>" +
      (q.note ? " <span class='pqnote'>" + E(q.note) + "</span>" : "") + "</span>" +
      "<span class='pm'>(" + num(EM.qMark(q)) + " " + L.marks + ")</span></div>";
    if (!key) {
      if (q.html) h += "<div class='pqtext'>" + q.html + "</div>";
      if (q.type === "mcq") {
        h += "<div class='mcq'>" + q.opts.map((o, k) => o ? "<div><b>" + bl(k) + ")</b> " + E(o) + "</div>" : "").join("") + "</div>";
      }
      q.branches.forEach((b, k) => {
        h += "<div class='pbranch'><span class='bl'>" + bl(k) + "-</span><div class='bt'>" + b.html + "</div>" +
          (num(b.mark) !== "" ? "<span class='bm'>(" + num(b.mark) + ")</span>" : "") + "</div>";
      });
      h += linesHtml(q, d);
    } else {
      let any = false;
      if (q.type === "mcq" && q.opts[q.correct]) { any = true; h += "<div class='ansprint'><span class='alab'>✔</span> " + bl(q.correct) + ") " + E(q.opts[q.correct]) + "</div>"; }
      if (q.ans && q.ans.replace(/<[^>]*>|&nbsp;/g, "").trim()) { any = true; h += "<div class='ansprint'>" + q.ans + "</div>"; }
      q.branches.forEach((b, k) => {
        if (b.ans && b.ans.replace(/<[^>]*>|&nbsp;/g, "").trim()) {
          any = true;
          h += "<div class='pbranch'><span class='bl'>" + bl(k) + "-</span><div class='bt ansprint'>" + b.ans + "</div>" +
            (num(b.mark) !== "" ? "<span class='bm'>(" + num(b.mark) + ")</span>" : "") + "</div>";
        }
      });
      if (!any) h += "<div class='pqtext meta2'>—</div>";
    }
    return h + "</div>";
  }

  function marksTable(S, L) {
    const qs = S.questions;
    const th = qs.map((q, i) => "<th>" + (i + 1) + "</th>").join("");
    const full = qs.map(q => "<td>" + num(EM.qMark(q)) + "</td>").join("");
    const blank = qs.map(() => "<td>&nbsp;</td>").join("");
    return "<div class='mtabp'><div class='mtabh'>" + L.marksTitle + "</div><table><tr><th></th>" + th + "<th>" + L.sum + "</th></tr>" +
      "<tr><th>" + L.full + "</th>" + full + "<td><b>" + num(EM.totalMarks()) + "</b></td></tr>" +
      "<tr><th>" + L.obtained + "</th>" + blank + "<td>&nbsp;</td></tr></table></div>";
  }

  /* key=true: نموذج الإجابة */
  function render(S, opts) {
    opts = opts || {};
    const d = S.design, L = EM.LABELS[d.lang], key = !!opts.key;
    const style = "--hc:" + d.hcolor + ";--qc:" + d.qcolor + ";--qgap:" + d.qgap + "mm;font-family:" + d.font +
      ";font-size:" + d.size + "px;line-height:" + d.lineH + ";color:" + d.tcolor + ";--hs:" + d.hsize + "px;padding-top:" + d.padTop + "mm";
    let h = "<div class='paper' dir='" + L.dir + "' style=\"" + style + "\"><div class='frame " + d.frame + "'></div><div class='pcontent'>";
    h += header(S, L);
    if (key) h += "<div class='akey'>" + L.key + "</div>";
    else {
      h += poetry(S);
      if (d.instr && d.instrText) h += "<div class='instr " + d.instrColor + "'>" + E(d.instrText) + "</div>";
    }
    S.questions.forEach((q, i) => { if (i) h += sep(d); h += questionHtml(q, i, S, key); });
    if (!key && d.marksTable) h += marksTable(S, L);
    h += "<div class='pfoot'><span>" + (S.info.teacher ? L.teacher + ": " + E(S.info.teacher) : "") + "</span></div>";
    if (d.phrase && !key) h += "<div class='phrase'>" + E(d.phrase) + "</div>";
    return h + "</div></div>";
  }

  /* تجميع صفحات الطباعة: نسخ × عدد في الصفحة × ملاءمة */
  function printHtml(S, mode) {
    const d = S.design, per = +d.perPage || 1, copies = Math.max(1, +d.copies || 1);
    const sheets = Math.ceil(copies / per);
    const key = mode === "key";
    const one = render(S, { key });
    let out = "";
    for (let s = 0; s < sheets; s++) {
      if (per === 1) out += "<div class='sheet'>" + one + "</div>";
      else out += "<div class='sheet land n" + per + "'>" + ("<div class='cell'>" + one + "</div>").repeat(per) + "</div>";
    }
    if (mode === "exam" && d.answersSheet) out += "<div class='sheet'>" + render(S, { key: true }) + "</div>";
    return out;
  }

  return { render, printHtml };
})();
