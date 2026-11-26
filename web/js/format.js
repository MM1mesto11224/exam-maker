/* محوّل المعادلات النصية البسيطة إلى HTML منسّق + منظّف HTML آمن */
"use strict";
window.EM = window.EM || {};

EM.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/*
  الصيغة:  x^2   x_1   x^{n+1}   frac{a}{b}   sqrt{x}   \pi \theta \Delta ...
  الأسهم:   ->  →      <=>  ⇌      <=  ≤     >=  ≥     !=  ≠     +-  ±
  وضع الكيمياء: الأرقام بعد الحرف أو القوس تصبح سفلية (H2O → H₂O) والشحنة: Fe^3+
*/
EM.fmt = (function () {
  const SYM = { pi: "π", theta: "θ", alpha: "α", beta: "β", gamma: "γ", lambda: "λ", mu: "μ", sigma: "σ", phi: "φ",
    omega: "ω", Delta: "Δ", delta: "δ", Omega: "Ω", Sigma: "Σ", inf: "∞", infty: "∞", deg: "°", times: "×", div: "÷",
    pm: "±", neq: "≠", leq: "≤", geq: "≥", approx: "≈", rarr: "→", therefore: "∴", angle: "∠", cdot: "·" };
  const OPS = [["<=>", "⇌"], ["<->", "↔"], ["->", "→"], ["<=", "≤"], [">=", "≥"], ["!=", "≠"], ["+-", "±"]];

  function render(src, chem) {
    let i = 0;
    const E = EM.esc;

    function braceArg() {
      if (src[i] === "{") { i++; const h = seq("}"); if (src[i] === "}") i++; return h; }
      return token();
    }
    function token() {
      const rest = src.slice(i);
      const m = /^[+\-−]?\d+/.exec(rest) || /^[A-Za-z]/.exec(rest) || /^[+\-−]/.exec(rest);
      if (!m) return "";
      i += m[0].length;
      let t = m[0];
      if (chem && /\d$/.test(t) && /[+\-−]/.test(src[i] || "")) { t += src[i]; i++; }
      return E(t.replace("-", "−"));
    }
    const frac = (a, b) => "<span class='frac'><span class='num'>" + a + "</span><span class='den'>" + b + "</span></span>";
    const root = a => "<span class='rt'><span class='rs'>√</span><span class='root'>" + a + "</span></span>";

    function seq(end) {
      let out = "";
      while (i < src.length && src[i] !== end) {
        const c = src[i], rest = src.slice(i);
        let m;
        if (c === "\\" && (m = /^\\([A-Za-z]+)/.exec(rest))) {
          i += m[0].length;
          const n = m[1];
          if (n === "frac") { const a = braceArg(), b = braceArg(); out += frac(a, b); }
          else if (n === "sqrt") out += root(braceArg());
          else out += SYM[n] ? SYM[n] : E(n);
          continue;
        }
        if ((m = /^(frac|sqrt)(?=\{)/.exec(rest))) {
          i += m[0].length;
          if (m[1] === "frac") { const a = braceArg(), b = braceArg(); out += frac(a, b); } else out += root(braceArg());
          continue;
        }
        const op = OPS.find(o => rest.startsWith(o[0]));
        if (op) { out += op[1]; i += op[0].length; continue; }
        if (c === "^") { i++; out += "<sup>" + braceArg() + "</sup>"; continue; }
        if (c === "_") { i++; out += "<sub>" + braceArg() + "</sub>"; continue; }
        if (c === "{") { i++; out += seq("}"); if (src[i] === "}") i++; continue; }
        if (chem && /[0-9]/.test(c) && i > 0 && /[A-Za-z)\]]/.test(src[i - 1])) {
          m = /^\d+/.exec(rest); i += m[0].length; out += "<sub>" + m[0] + "</sub>"; continue;
        }
        if (c === "-" ) { out += "−"; i++; continue; }
        out += E(c); i++;
      }
      return out;
    }
    return seq(null);
  }

  return (src, mode) => "<span class='eq' dir='ltr'>" + render(String(src || ""), mode === "chem") + "</span>";
})();

/* ---------- منظّف HTML: يسمح فقط بوسوم وسمات آمنة (للاستيراد واللصق) ---------- */
EM.sanitize = (function () {
  const TAGS = new Set(["B", "STRONG", "I", "EM", "U", "SUB", "SUP", "BR", "DIV", "P", "SPAN", "FONT", "TABLE", "TBODY", "THEAD",
    "TR", "TD", "TH", "IMG", "SVG", "G", "PATH", "POLYGON", "RECT", "CIRCLE", "LINE", "TEXT", "FIGURE", "SMALL"]);
  const ATTRS = new Set(["class", "dir", "colspan", "rowspan", "contenteditable", "color", "src", "alt", "width", "height",
    "viewbox", "xmlns", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "d", "points", "x", "y", "cx", "cy",
    "r", "x1", "x2", "y1", "y2", "transform", "font-size", "text-anchor", "style"]);
  const STYLE_OK = /^(color|font-weight|font-style|text-decoration(-line)?|text-align|background-color|width|max-width|font-size|direction)$/;

  function cleanStyle(v) {
    return v.split(";").map(x => x.trim()).filter(Boolean).filter(x => {
      const [k, val] = x.split(":").map(t => t.trim().toLowerCase());
      return STYLE_OK.test(k) && val && !/url\(|expression|javascript/.test(val);
    }).join(";");
  }
  function walk(node) {
    [...node.childNodes].forEach(ch => {
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1) { ch.remove(); return; }
      const tag = ch.tagName.toUpperCase();
      if (!TAGS.has(tag)) {
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|FORM|INPUT|BUTTON|TEXTAREA|SELECT|FOREIGNOBJECT)$/.test(tag)) { ch.remove(); return; }
        while (ch.firstChild) node.insertBefore(ch.firstChild, ch);
        ch.remove(); return;
      }
      [...ch.attributes].forEach(a => {
        const n = a.name.toLowerCase();
        if (!ATTRS.has(n) || n.startsWith("on")) { ch.removeAttribute(a.name); return; }
        if (n === "src" && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(a.value)) ch.removeAttribute(a.name);
        else if (n === "style") { const s = cleanStyle(a.value); s ? ch.setAttribute("style", s) : ch.removeAttribute("style"); }
      });
      walk(ch);
    });
  }
  return html => {
    const doc = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");
    walk(doc.body);
    return doc.body.innerHTML;
  };
})();
