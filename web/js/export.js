/* التصدير: Word (.docx) و Excel (.xlsx) و JSON — بدون مكتبات خارجية */
"use strict";
window.EM = window.EM || {};

EM.exp = (function () {
  const enc = new TextEncoder();
  const X = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

  /* ---------- ZIP (تخزين بدون ضغط) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const parts = [], central = []; let off = 0;
    const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    files.forEach(f => {
      const name = enc.encode(f.name), data = f.data instanceof Uint8Array ? f.data : enc.encode(f.data), crc = crc32(data);
      const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(new Uint8Array([0x50, 0x4B, 3, 4, ...common]), name, data);
      central.push(new Uint8Array([0x50, 0x4B, 1, 2, ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
      off += 30 + name.length + data.length;
    });
    const csize = central.reduce((s, a) => s + a.length, 0);
    const end = new Uint8Array([0x50, 0x4B, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), 0, 0]);
    const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
    let p = 0; all.forEach(a => { out.set(a, p); p += a.length; }); return out;
  }

  /* ---------- حفظ الملفات (متصفح أو غلاف أندرويد) ---------- */
  function download(name, mime, bytes) {
    if (window.Android && typeof Android.saveFileBase64 === "function") {
      let bin = ""; for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      Android.saveFileBase64(name, mime, btoa(bin)); return;
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes], { type: mime })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const fileName = ext => ((EM.S.info.subject || "امتحان") + "-" + (EM.S.info.grade || "")).replace(/[\\/:*?"<>|]+/g, " ").trim().replace(/\s+/g, "_") + "." + ext;

  /* ---------- نص عادي من HTML ---------- */
  function plain(html) {
    const d = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
    const walk = n => {
      if (n.nodeType === 3) return n.textContent.replace(/ /g, " ");
      if (n.nodeType !== 1) return "";
      const c = n.classList;
      if (c.contains("frac")) return "(" + walk(n.firstChild) + ")/(" + walk(n.lastChild) + ")";
      if (c.contains("rs")) return "√";
      if (c.contains("blank")) return "______";
      if (n.tagName === "IMG" || n.tagName === "SVG" || n.tagName === "svg") return "";
      const inner = [...n.childNodes].map(walk).join("");
      if (n.tagName === "BR") return "\n";
      if (/^(DIV|P|TR)$/.test(n.tagName)) return inner + "\n";
      if (n.tagName === "TD" || n.tagName === "TH") return inner + "\t";
      return inner;
    };
    return walk(d.body).replace(/\n{2,}/g, "\n").trim();
  }

  /* ---------- Excel ---------- */
  function xlsx() {
    const S = EM.S, L = EM.LABELS[S.design.lang], rows = [["#", "نوع السؤال", "نص السؤال", "الفرع", "نص الفرع", "الدرجة", "الإجابة النموذجية"]];
    S.questions.forEach((q, i) => {
      const qa = plain(q.ans || "") || (q.type === "mcq" ? q.opts[q.correct] || "" : "");
      let qt = plain(q.html) + (q.type === "mcq" ? "\n" + q.opts.map((o, k) => L.branch[k] + ") " + o).join("  ") : "");
      if (!q.branches.length) rows.push([i + 1, q.type === "mcq" ? "اختيار من متعدد" : "تحرير", qt, "", "", EM.qMark(q), qa]);
      else q.branches.forEach((b, k) => rows.push([k ? "" : i + 1, k ? "" : (q.type === "mcq" ? "اختيار من متعدد" : "تحرير"), k ? "" : qt + (q.note ? " (" + q.note + ")" : ""),
        L.branch[k] || k + 1, plain(b.html), b.mark === "" ? "" : +b.mark, plain(b.ans)]));
    });
    rows.push(["", "", "", "", "المجموع", EM.totalMarks(), ""]);
    const col = n => String.fromCharCode(65 + n);
    const sheet = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><worksheet xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'>" +
      "<sheetViews><sheetView workbookViewId='0' rightToLeft='1'/></sheetViews><cols><col min='1' max='2' width='12'/><col min='3' max='3' width='50'/><col min='4' max='4' width='8'/><col min='5' max='5' width='40'/><col min='6' max='6' width='10'/><col min='7' max='7' width='40'/></cols><sheetData>" +
      rows.map((r, ri) => "<row r='" + (ri + 1) + "'>" + r.map((v, ci) => {
        const ref = col(ci) + (ri + 1), st = ri === 0 ? " s='1'" : " s='2'";
        if (typeof v === "number") return "<c r='" + ref + "'" + st + "><v>" + v + "</v></c>";
        return "<c r='" + ref + "'" + st + " t='inlineStr'><is><t xml:space='preserve'>" + X(v) + "</t></is></c>";
      }).join("") + "</row>").join("") + "</sheetData></worksheet>";
    const styles = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><styleSheet xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main'><fonts count='2'><font><sz val='12'/><name val='Arial'/></font><font><b/><sz val='12'/><name val='Arial'/></font></fonts><fills count='3'><fill><patternFill patternType='none'/></fill><fill><patternFill patternType='gray125'/></fill><fill><patternFill patternType='solid'><fgColor rgb='FFD9E8EE'/></patternFill></fill></fills><borders count='2'><border><left/><right/><top/><bottom/><diagonal/></border><border><left style='thin'/><right style='thin'/><top style='thin'/><bottom style='thin'/><diagonal/></border></borders><cellStyleXfs count='1'><xf numFmtId='0' fontId='0' fillId='0' borderId='0'/></cellStyleXfs><cellXfs count='3'><xf numFmtId='0' fontId='0' fillId='0' borderId='0' xfId='0'/><xf numFmtId='0' fontId='1' fillId='2' borderId='1' xfId='0' applyFont='1' applyFill='1' applyBorder='1'><alignment horizontal='center' vertical='center'/></xf><xf numFmtId='0' fontId='0' fillId='0' borderId='1' xfId='0' applyBorder='1' applyAlignment='1'><alignment vertical='top' wrapText='1'/></xf></cellXfs></styleSheet>";
    const bytes = zip([
      { name: "[Content_Types].xml", data: "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'><Default Extension='rels' ContentType='application/vnd.openxmlformats-package.relationships+xml'/><Default Extension='xml' ContentType='application/xml'/><Override PartName='/xl/workbook.xml' ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'/><Override PartName='/xl/worksheets/sheet1.xml' ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'/><Override PartName='/xl/styles.xml' ContentType='application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml'/></Types>" },
      { name: "_rels/.rels", data: "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument' Target='xl/workbook.xml'/></Relationships>" },
      { name: "xl/workbook.xml", data: "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><workbook xmlns='http://schemas.openxmlformats.org/spreadsheetml/2006/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships'><sheets><sheet name='الأسئلة' sheetId='1' r:id='rId1'/></sheets></workbook>" },
      { name: "xl/_rels/workbook.xml.rels", data: "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet' Target='worksheets/sheet1.xml'/><Relationship Id='rId2' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles' Target='styles.xml'/></Relationships>" },
      { name: "xl/worksheets/sheet1.xml", data: sheet }, { name: "xl/styles.xml", data: styles }]);
    download(fileName("xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes);
  }

  /* ---------- Word ---------- */
  const NS = "xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main' xmlns:r='http://schemas.openxmlformats.org/officeDocument/2006/relationships' xmlns:m='http://schemas.openxmlformats.org/officeDocument/2006/math' xmlns:wp='http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing' xmlns:a='http://schemas.openxmlformats.org/drawingml/2006/main' xmlns:pic='http://schemas.openxmlformats.org/drawingml/2006/picture'";
  const AR = /[؀-ۿ]/;

  /* تحويل SVG إلى صورة PNG وضبط أبعاد الصور مسبقًا */
  const imgLoad = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  async function prepare(html) {
    const d = new DOMParser().parseFromString("<body>" + (html || "") + "</body>", "text/html");
    for (const s of [...d.querySelectorAll("svg")]) {
      try {
        s.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const w = +s.getAttribute("width") || 170, h = +s.getAttribute("height") || 128;
        const im = await imgLoad("data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(s)));
        const c = document.createElement("canvas"); c.width = w * 2; c.height = h * 2;
        const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        const img = d.createElement("img"); img.setAttribute("src", c.toDataURL("image/png")); img.setAttribute("data-w", w); img.setAttribute("data-h", h);
        s.replaceWith(img);
      } catch (e) { s.remove(); }
    }
    for (const i of [...d.querySelectorAll("img")]) {
      try { const im = await imgLoad(i.getAttribute("src")); i.setAttribute("data-w", im.naturalWidth); i.setAttribute("data-h", im.naturalHeight); } catch (e) { i.remove(); }
    }
    return d.body;
  }

  async function docx() {
    const S = EM.S, D = S.design, I = S.info, L = EM.LABELS[D.lang], rtl = D.lang === "ar";
    const fam = (/'([^']+)'/.exec(D.font) || /^([A-Za-z ]+)/.exec(D.font) || [0, "Arial"])[1];
    const sz = Math.round(D.size * 1.5), media = [];
    let imgId = 100;

    const rpr = (p, text) => {
      let r = "<w:rFonts w:ascii='" + fam + "' w:hAnsi='" + fam + "' w:cs='" + fam + "'/>";
      if (p.b) r += "<w:b/><w:bCs/>"; if (p.i) r += "<w:i/><w:iCs/>";
      r += p.color ? "<w:color w:val='" + p.color + "'/>" : ""; r += "<w:sz w:val='" + (p.sz || sz) + "'/><w:szCs w:val='" + (p.sz || sz) + "'/>";
      if (p.u) r += "<w:u w:val='single'/>"; if (p.sup) r += "<w:vertAlign w:val='superscript'/>"; if (p.sub) r += "<w:vertAlign w:val='subscript'/>";
      if (rtl && AR.test(text)) r += "<w:rtl/>";
      return "<w:rPr>" + r + "</w:rPr>";
    };
    const run = (t, p) => t ? "<w:r>" + rpr(p, t) + "<w:t xml:space='preserve'>" + X(t) + "</w:t></w:r>" : "";
    const toHex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || "") || /^rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(c || ""); if (!m) return null; return m.length === 2 ? m[1].toUpperCase() : [m[1], m[2], m[3]].map(n => (+n).toString(16).padStart(2, "0")).join("").toUpperCase(); };
    const omml = inner => "<m:oMath>" + inner + "</m:oMath>";
    const mr = t => "<m:r><m:t xml:space='preserve'>" + X(t) + "</m:t></m:r>";
    /* تحويل عقد HTML (كسر/جذر/أس/دليل) إلى معادلة Word (OMML) */
    function om(nodes) {
      const items = [];
      const base = () => items.pop() || mr("");
      const sub = ns => om(ns) || mr("");
      nodes.forEach(n => {
        if (n.nodeType === 3) { const t = n.textContent.replace(/\u00a0/g, " "); if (!t) return; if (t.length > 1) items.push(mr(t.slice(0, -1))); items.push(mr(t.slice(-1))); return; }
        if (n.nodeType !== 1) return;
        const t = n.tagName, c = n.classList, kids = [...n.childNodes];
        if (t === "SUP") items.push("<m:sSup><m:e>" + base() + "</m:e><m:sup>" + sub(kids) + "</m:sup></m:sSup>");
        else if (t === "SUB") items.push("<m:sSub><m:e>" + base() + "</m:e><m:sub>" + sub(kids) + "</m:sub></m:sSub>");
        else if (c.contains("frac")) items.push("<m:f><m:num>" + sub([...n.firstChild.childNodes]) + "</m:num><m:den>" + sub([...n.lastChild.childNodes]) + "</m:den></m:f>");
        else if (c.contains("rt")) { const r = n.querySelector(".root"); items.push("<m:rad><m:radPr><m:degHide m:val='1'/></m:radPr><m:deg/><m:e>" + sub(r ? [...r.childNodes] : []) + "</m:e></m:rad>"); }
        else items.push(om(kids));
      });
      return items.join("");
    }

    function addImage(dataUrl, wpx, hpx, pct) {
      const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i.exec(dataUrl); if (!m) return "";
      const ext = m[1].toLowerCase().replace("jpg", "jpeg"); if (ext === "webp") return "";
      const bin = atob(m[2]), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const id = ++imgId, name = "image" + id + "." + ext; media.push({ id: "rId" + id, name, bytes, ext });
      let cx = pct ? Math.round(pct / 100 * 6000000) : Math.round(wpx * 9525 * 0.8); cx = Math.min(cx, 6000000);
      let cy = Math.round(cx * (hpx / wpx)); if (cy > 8000000) { cx = Math.round(cx * 8000000 / cy); cy = 8000000; }
      return "<w:r><w:drawing><wp:inline distT='0' distB='0' distL='0' distR='0'><wp:extent cx='" + cx + "' cy='" + cy + "'/><wp:docPr id='" + id + "' name='" + name + "'/><a:graphic><a:graphicData uri='http://schemas.openxmlformats.org/drawingml/2006/picture'><pic:pic><pic:nvPicPr><pic:cNvPr id='" + id + "' name='" + name + "'/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed='rId" + id + "'/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x='0' y='0'/><a:ext cx='" + cx + "' cy='" + cy + "'/></a:xfrm><a:prstGeom prst='rect'><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>";
    }

    /* العناصر المضمّنة داخل الفقرة */
    function inline(node, p) {
      if (node.nodeType === 3) return run(node.textContent.replace(/ /g, " "), p);
      if (node.nodeType !== 1) return "";
      const t = node.tagName, c = node.classList;
      if (c.contains("frac") || c.contains("rt")) return omml(om([node]));
      if (c.contains("blank")) return run("________", p);
      if (t === "BR") return "<w:r><w:br/></w:r>";
      if (t === "IMG") { const w = node.getAttribute("style") && /width:\s*(\d+)%/.exec(node.getAttribute("style")); return addImage(node.getAttribute("src"), +node.getAttribute("data-w") || 200, +node.getAttribute("data-h") || 150, w ? +w[1] : 0); }
      const q = Object.assign({}, p);
      if (t === "B" || t === "STRONG") q.b = 1; if (t === "I" || t === "EM") q.i = 1; if (t === "U") q.u = 1;
      if (t === "SUP") q.sup = 1; if (t === "SUB") q.sub = 1;
      const st = node.getAttribute && node.getAttribute("style") || "";
      if (/font-weight:\s*(bold|[6-9]00)/.test(st)) q.b = 1; if (/font-style:\s*italic/.test(st)) q.i = 1; if (/underline/.test(st)) q.u = 1;
      const col = toHex((/(?:^|;)\s*color:\s*([^;]+)/.exec(st) || [])[1]) || toHex(node.getAttribute && node.getAttribute("color")); if (col) q.color = col;
      return [...node.childNodes].map(n => inline(n, q)).join("");
    }
    const para = (inner, o) => { o = o || {}; return "<w:p><w:pPr>" + (rtl ? "<w:bidi/>" : "") + (o.keep ? "<w:keepNext/>" : "") + (o.border || "") + "<w:spacing w:after='" + (o.after == null ? 60 : o.after) + "'/>" + (o.jc ? "<w:jc w:val='" + o.jc + "'/>" : "") + "</w:pPr>" + inner + "</w:p>"; };

    function table(node) {
      const rows = [...node.querySelectorAll("tr")], cols = Math.max(1, ...rows.map(r => r.children.length)), w = Math.floor(9000 / cols);
      const b = "<w:top w:val='single' w:sz='6'/><w:left w:val='single' w:sz='6'/><w:bottom w:val='single' w:sz='6'/><w:right w:val='single' w:sz='6'/><w:insideH w:val='single' w:sz='6'/><w:insideV w:val='single' w:sz='6'/>";
      return "<w:tbl><w:tblPr><w:tblW w:w='5000' w:type='pct'/>" + (rtl ? "<w:bidi/>" : "") + "<w:tblBorders>" + b + "</w:tblBorders></w:tblPr><w:tblGrid>" + ("<w:gridCol w:w='" + w + "'/>").repeat(cols) + "</w:tblGrid>" +
        rows.map(r => "<w:tr>" + [...r.children].map(c => { const th = c.tagName === "TH"; return "<w:tc><w:tcPr><w:tcW w:w='" + w + "' w:type='dxa'/>" + (th ? "<w:shd w:val='clear' w:color='auto' w:fill='E8EEF5'/>" : "") + "</w:tcPr>" +
          para([...c.childNodes].map(n => inline(n, th ? { b: 1 } : {})).join(""), { after: 0 }) + "</w:tc>"; }).join("") + "</w:tr>").join("") + "</w:tbl>";
    }

    /* تحويل جسم HTML إلى فقرات وجداول. prefix/suffix يُدرجان في أول/آخر فقرة */
    function blocks(body, prefix, suffix) {
      const items = []; let cur = "";
      const flush = () => { if (cur.trim() !== "") items.push({ p: cur }); cur = ""; };
      const walk = (nodes) => nodes.forEach(n => {
        if (n.nodeType === 1 && /^(DIV|P)$/.test(n.tagName) && !n.classList.contains("eq")) { flush(); if (n.querySelector("table,div,p")) walk([...n.childNodes]); else { cur = [...n.childNodes].map(x => inline(x, {})).join(""); if (!cur) cur = ""; flush(); } }
        else if (n.nodeType === 1 && n.tagName === "TABLE") { flush(); items.push({ t: table(n) }); }
        else cur += inline(n, {});
      });
      walk([...body.childNodes]); flush();
      if (!items.length) items.push({ p: "" });
      const first = items.findIndex(x => x.p != null);
      if (prefix) { if (first === 0) items[0].p = prefix + items[0].p; else items.unshift({ p: prefix }); }
      if (suffix) { const last = items[items.length - 1]; if (last.p != null) last.p += suffix; else items.push({ p: suffix }); }
      return items.map(x => x.t ? x.t : para(x.p)).join("");
    }
    const txt = (t, p, o) => para(run(t, p || {}), o);
    const num = v => { const n = parseFloat(v); return isNaN(n) ? "" : String(Math.round(n * 100) / 100); };

    /* ---- بناء المستند ---- */
    let body = "";
    const nb = "<w:top w:val='nil'/><w:left w:val='nil'/><w:bottom w:val='single' w:sz='12'/><w:right w:val='nil'/><w:insideH w:val='nil'/><w:insideV w:val='nil'/>";
    const logo = I.logo ? await prepare("<img src='" + I.logo + "'>") : null;
    const logoXml = logo && logo.querySelector("img") ? (() => { const i = logo.querySelector("img"); return addImage(i.getAttribute("src"), +i.getAttribute("data-w"), +i.getAttribute("data-h"), 0); })() : "";
    const cell = inner => "<w:tc><w:tcPr><w:tcW w:w='3000' w:type='dxa'/></w:tcPr>" + inner + "</w:tc>";
    const hp = { b: 1, sz: Math.round(D.hsize * 1.6) }, hn = { sz: Math.round(D.hsize * 1.5) };
    const info = [[L.subject, I.subject], [L.grade, I.grade], [L.date, I.date], [L.time, I.time], [L.total, I.total === "" ? "" : String(I.total)]].filter(x => x[1]);
    body += "<w:tbl><w:tblPr><w:tblW w:w='5000' w:type='pct'/>" + (rtl ? "<w:bidi/>" : "") + "<w:tblBorders>" + nb + "</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w='3000'/><w:gridCol w='3000'/><w:gridCol w='3000'/></w:tblGrid><w:tr>" +
      cell((I.ministry ? txt(I.ministry, hn, { after: 0 }) : "") + txt(I.school, hp, { after: 0 })) +
      cell((logoXml ? para(logoXml, { jc: "center", after: 0 }) : "") + (I.year ? txt(I.year, hn, { jc: "center", after: 0 }) : "") + txt(I.term, hp, { jc: "center", after: 0 })) +
      cell(info.map(([k, v]) => para(run(k + ": ", { b: 1, sz: hn.sz }) + run(v, hn), { after: 0 })).join("") || para("")) + "</w:tr></w:tbl>" + para("", { after: 0 });

    if (I.poet || I.verses.trim()) body += txt([I.poet].concat(I.verses.split("\n")).filter(x => x && x.trim()).join("  —  "), { i: 1 }, { jc: "center" });
    if (D.instr && D.instrText) body += para(run(D.instrText, { b: 1 }), { jc: "center", border: "<w:pBdr><w:top w:val='single' w:sz='8' w:space='1' w:color='E07B00'/><w:left w:val='single' w:sz='8' w:space='4' w:color='E07B00'/><w:bottom w:val='single' w:sz='8' w:space='1' w:color='E07B00'/><w:right w:val='single' w:sz='8' w:space='4' w:color='E07B00'/></w:pBdr>" });

    const bl = k => L.branch[k] || String(k + 1);
    const qColor = toHex(D.qcolor) || "174A7C";
    async function questions(key) {
      let out = "";
      for (let i = 0; i < S.questions.length; i++) {
        const q = S.questions[i];
        out += para(run(EM.qName(i, D.lang), { b: 1, color: qColor }) + (q.note ? run("  " + q.note, { i: 1 }) : "") + run("   (" + num(EM.qMark(q)) + " " + L.marks + ")", { b: 1 }), { keep: true, after: 40 });
        if (!key) {
          if (q.html) out += blocks(await prepare(q.html));
          if (q.type === "mcq") out += para(q.opts.map((o, k) => o ? run(bl(k) + ") " + o + "      ", {}) : "").join(""));
          for (let k = 0; k < q.branches.length; k++) { const b = q.branches[k]; out += blocks(await prepare(b.html), run(bl(k) + "- ", { b: 1 }), num(b.mark) ? run("   (" + num(b.mark) + ")", {}) : ""); }
          const n = q.lines === "" ? +D.lines || 0 : +q.lines || 0;
          for (let k = 0; k < Math.min(n, 12); k++) out += "<w:p><w:pPr><w:pBdr><w:bottom w:val='dotted' w:sz='6' w:space='1' w:color='888888'/></w:pBdr><w:spacing w:after='120'/></w:pPr></w:p>";
        } else {
          if (q.type === "mcq" && q.opts[q.correct]) out += txt("✔ " + bl(q.correct) + ") " + q.opts[q.correct], { b: 1 });
          if (plain(q.ans)) out += blocks(await prepare(q.ans));
          for (let k = 0; k < q.branches.length; k++) if (plain(q.branches[k].ans)) out += blocks(await prepare(q.branches[k].ans), run(bl(k) + "- ", { b: 1 }));
        }
      }
      return out;
    }
    body += await questions(false);
    if (D.marksTable) {
      const qs = S.questions, w = Math.floor(9000 / (qs.length + 2));
      const row = (h, cells, bold) => "<w:tr>" + [h].concat(cells).map(c => "<w:tc><w:tcPr><w:tcW w:w='" + w + "' w:type='dxa'/></w:tcPr>" + para(run(c, { b: bold, sz: 22 }), { jc: "center", after: 0 }) + "</w:tc>").join("") + "</w:tr>";
      const bd = "<w:top w:val='single' w:sz='6'/><w:left w:val='single' w:sz='6'/><w:bottom w:val='single' w:sz='6'/><w:right w:val='single' w:sz='6'/><w:insideH w:val='single' w:sz='6'/><w:insideV w:val='single' w:sz='6'/>";
      body += txt(L.marksTitle, { b: 1 }, { jc: "center", keep: true }) + "<w:tbl><w:tblPr><w:tblW w:w='5000' w:type='pct'/>" + (rtl ? "<w:bidi/>" : "") + "<w:tblBorders>" + bd + "</w:tblBorders></w:tblPr><w:tblGrid>" + ("<w:gridCol w:w='" + w + "'/>").repeat(qs.length + 2) + "</w:tblGrid>" +
        row("", qs.map((q, i) => String(i + 1)).concat([L.sum]), 1) + row(L.full, qs.map(q => num(EM.qMark(q))).concat([num(EM.totalMarks())]), 0) + row(L.obtained, qs.map(() => "").concat([""]), 0) + "</w:tbl>" + para("");
    }
    if (I.teacher) body += txt(L.teacher + ": " + I.teacher, {}, { after: 0 });
    if (D.phrase) body += txt(D.phrase, { b: 1 }, { jc: "center" });

    if (D.answersSheet) {
      body += "<w:p><w:r><w:br w:type='page'/></w:r></w:p>" + txt(L.key, { b: 1, sz: sz + 6 }, { jc: "center" }) + await questions(true);
    }

    const sect = "<w:sectPr><w:pgSz w:w='11906' w:h='16838'/><w:pgMar w:top='850' w:right='1000' w:bottom='850' w:left='1000' w:header='500' w:footer='500' w:gutter='0'/>" + (rtl ? "<w:bidi/>" : "") + "</w:sectPr>";
    const document = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><w:document " + NS + "><w:body>" + body + sect + "</w:body></w:document>";
    const exts = [...new Set(media.map(m => m.ext))];
    const files = [
      { name: "[Content_Types].xml", data: "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Types xmlns='http://schemas.openxmlformats.org/package/2006/content-types'><Default Extension='rels' ContentType='application/vnd.openxmlformats-package.relationships+xml'/><Default Extension='xml' ContentType='application/xml'/>" + exts.map(e => "<Default Extension='" + e + "' ContentType='image/" + e + "'/>").join("") + "<Override PartName='/word/document.xml' ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'/><Override PartName='/word/styles.xml' ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml'/></Types>" },
      { name: "_rels/.rels", data: "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'><Relationship Id='rId1' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument' Target='word/document.xml'/></Relationships>" },
      { name: "word/styles.xml", data: "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><w:styles xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii='" + fam + "' w:hAnsi='" + fam + "' w:cs='" + fam + "'/><w:sz w:val='" + sz + "'/><w:szCs w:val='" + sz + "'/><w:lang w:val='" + (rtl ? "ar-SA" : "en-US") + "' w:bidi='ar-SA'/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type='paragraph' w:default='1' w:styleId='Normal'><w:name w:val='Normal'/></w:style></w:styles>" },
      { name: "word/document.xml", data: document },
      { name: "word/_rels/document.xml.rels", data: "<?xml version='1.0' encoding='UTF-8' standalone='yes'?><Relationships xmlns='http://schemas.openxmlformats.org/package/2006/relationships'>" + media.map(m => "<Relationship Id='" + m.id + "' Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/image' Target='media/" + m.name + "'/>").join("") + "</Relationships>" }
    ].concat(media.map(m => ({ name: "word/media/" + m.name, data: m.bytes })));
    download(fileName("docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", zip(files));
  }

  /* ---------- JSON ---------- */
  const exportJson = () => download(fileName("json").replace(/\.json$/, "") + ".json", "application/json", enc.encode(JSON.stringify(EM.S)));

  return { docx, xlsx, exportJson, download, plain };
})();
