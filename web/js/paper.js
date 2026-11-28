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
      const labs = EM.stdLabels(q, L);
      q.branches.forEach((b, k) => {
        if (b.kind === "head") { h += "<div class='sthead'>" + b.html + "</div>"; return; }
        h += "<div class='pbranch'><span class='bl'>" + labs[k] + "-</span><div class='bt'>" + b.html + (b.kind === "mcq" ? EM.stdOpts(b, L) : "") + "</div>" +
          (num(b.mark) !== "" ? "<span class='bm'>(" + num(b.mark) + ")</span>" : "") + "</div>";
      });
      h += linesHtml(q, d);
    } else {
      let any = false;
      if (q.type === "mcq" && q.opts[q.correct]) { any = true; h += "<div class='ansprint'><span class='alab'>✔</span> " + bl(q.correct) + ") " + E(q.opts[q.correct]) + "</div>"; }
      if (q.ans && q.ans.replace(/<[^>]*>|&nbsp;/g, "").trim()) { any = true; h += "<div class='ansprint'>" + q.ans + "</div>"; }
      const labs = EM.stdLabels(q, L);
      q.branches.forEach((b, k) => {
        if (b.kind === "head") return;
        const mcA = b.kind === "mcq" && b.opts[b.correct] ? L.branch[b.correct] + ") " + E(b.opts[b.correct]) + " " : "";
        if (mcA || (b.ans && b.ans.replace(/<[^>]*>|&nbsp;/g, "").trim())) {
          any = true;
          h += "<div class='pbranch'><span class='bl'>" + labs[k] + "-</span><div class='bt ansprint'>" + mcA + (b.ans || "") + "</div>" +
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


  /* ===== نمط الامتحان الإنكليزي / الفرنسي: أقسام A,B,C بعمودين وترقيم متسلسل ===== */
  const hasTxt = h => !!(h && h.replace(/<[^>]*>|&nbsp;/g, "").trim());
  const secLetter = i => String.fromCharCode(65 + (i % 26));
  const optLetters = ["a", "b", "c", "d"];
  const dots = n => "<div class='alines'>" + "<div></div>".repeat(Math.max(0, Math.min(n, 12))) + "</div>";

  /* رقم كل فرع (الفروع من نوع head بلا رقم) */
  function examNumbers(S) {
    let n = 0; const map = new Map();
    S.questions.forEach(q => q.branches.forEach(b => { if (b.kind !== "head") map.set(b.id, ++n); }));
    return map;
  }

  const bmk = (b, L) => { const m = num(b.mark); return m === "" ? "" : "<span class='exbm'>(" + m + (L === EM.LABELS.fr ? " pts" : "") + ")</span>"; };
  function examBranches(q, nums, L, key) {
    let h = "", i = 0; const br = q.branches, sf = L === EM.LABELS.fr ? "-" : ".";
    while (i < br.length) {
      const b = br[i], n = nums.get(b.id);
      if (b.kind === "head") { if (!key) h += "<div class='exhead'>" + b.html + "</div>"; i++; continue; }
      if (b.kind === "match") {
        const grp = []; while (i < br.length && br[i].kind === "match") grp.push(br[i++]);
        if (!key) {
          h += "<table class='exmatch'><tr><th>" + L.partA + "</th><th>" + L.partB + "</th></tr>" + grp.map((m, k) =>
            "<tr><td><span class='exn'>" + nums.get(m.id) + sf + "</span> " + m.html + " <span class='exbox'>( )</span></td><td><b>" + "abcdefghij"[k % 10] + sf + "</b> " + E(m.right) + "</td></tr>").join("") + "</table>";
        } else {
          h += "<div class='ansprint'>" + grp.map(m => "<span class='exn'>" + nums.get(m.id) + "</span> → " + (hasTxt(m.ans) ? m.ans : "—")).join(" &nbsp; ") + "</div>";
        }
        continue;
      }
      i++;
      let t = "";
      if (!key) {
        if (b.kind === "mcq") {
          t += "<div class='exb'><span class='exn'>" + n + ".</span><div class='bt'>" + b.html + "</div>" + bmk(b, L) + "</div><div class='exopts'>" +
            b.opts.map((o, k) => "<div><b>" + optLetters[k] + sf + "</b> " + (o ? E(o) : "…………") + "</div>").join("") + "</div>";
        } else if (b.kind === "tf") {
          t += "<div class='exb'><span class='exn'>" + n + ".</span><div class='bt'>" + b.html + "</div>" + (sf === "-" ? "" : "<span class='exbox'>( )</span>") + bmk(b, L) + "</div>";
        } else if (b.kind === "ulines") {
          t += "<div class='exb'><span class='exn'>" + n + ".</span><div class='bt'>" + b.html + "</div>" + bmk(b, L) + "</div>" + dots(b.lines === "" ? 2 : +b.lines);
        } else {
          t += "<div class='exb'><span class='exn'>" + n + ".</span><div class='bt'>" + b.html + "</div>" + bmk(b, L) + "</div>" + (+b.lines > 0 ? dots(+b.lines) : "");
        }
      } else {
        let a = "";
        if (b.kind === "mcq") a = optLetters[b.correct] + ". " + E(b.opts[b.correct] || "");
        else if (b.kind === "tf") a = b.tf === "F" ? "F" : "T";
        if (hasTxt(b.ans)) a += (a ? " — " : "") + b.ans;
        t += "<div class='exb ansprint'><span class='exn'>" + n + ".</span><div class='bt'>" + (a || "—") + "</div></div>";
      }
      h += "<div class='xqitem'>" + t + "</div>";
    }
    return h;
  }

  function renderExam(S, key) {
    const d = S.design, L = EM.LABELS[d.lang === "fr" ? "fr" : "en"], A = EM.LABELS.ar, nums = examNumbers(S);
    const style = "--hc:" + d.hcolor + ";--qc:" + d.qcolor + ";--qgap:" + d.qgap + "mm;font-family:" + d.font +
      ";font-size:" + d.size + "px;line-height:" + d.lineH + ";color:" + d.tcolor + ";--hs:" + d.hsize + "px;padding-top:" + d.padTop + "mm";
    let h = "<div class='paper examp' dir='rtl' style=\"" + style + "\"><div class='frame " + d.frame + "'></div><div class='pcontent'>";
    h += header(S, A);
    h += "<div class='exname'><span>" + A.name_ar + ": ..............................</span><span>" + A.num_ar + ": ...............................</span></div>";
    if (key) h += "<div class='akey' dir='ltr'>" + L.key + "</div>";
    h += "<div class='exbody" + (d.lang === "fr" ? " c1" : "") + "' dir='ltr'>";
    S.questions.forEach((q, i) => {
      const t = (q.title || "").trim(), m = num(EM.qMark(q));
      h += "<div class='exsec'><div class='exh'><u>" + E(q.tag || secLetter(i) + ".") + (t ? " " + E(t) : "") + "</u>" + (m !== "" ? " <span class='exm'>(" + m + " " + L.marks + ")</span>" : "") + "</div>";
      if (!key && q.note) h += "<div class='exnote'><u>" + E(q.note) + "</u></div>";
      if (!key && (hasTxt(q.html) || (q.box && d.lang === "fr"))) h += "<div class='expass" + (d.lang === "fr" ? " frbox" : "") + "'>" + q.html + "</div>";
      if (key && hasTxt(q.ans)) h += "<div class='ansprint'>" + q.ans + "</div>";
      h += examBranches(q, nums, L, key) + (!key && +q.lines > 0 ? dots(+q.lines) : "") + "</div>";
    });
    h += "</div>";
    if (!key && d.marksTable) h += marksTable(S, L);
    h += "<div class='exend' dir='ltr'>" + (key ? "" : L.end) + "</div></div></div>";
    return h;
  }

  /* key=true: نموذج الإجابة */
  function render(S, opts) {
    opts = opts || {};
    if (S.design.layout === "exam") return renderExam(S, !!opts.key);
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
  function printHtml(S, mode, o) {
    o = o || {};
    const d = S.design, per = +d.perPage || 1, copies = Math.max(1, +d.copies || 1);
    const sheets = Math.ceil(copies / per);
    const key = mode === "key";
    const one = render(S, { key });
    let out = "";
    for (let s = 0; s < sheets; s++) {
      if (per === 1) out += "<div class='sheet'>" + one + "</div>";
      else out += "<div class='sheet land n" + per + "'>" + ("<div class='cell'>" + one + "</div>").repeat(per) + "</div>";
    }
    if (mode === "exam" && d.answersSheet && !o.noKey) out += "<div class='sheet'>" + render(S, { key: true }) + "</div>";
    return out;
  }

  return { render, printHtml, examNumbers };
})();
