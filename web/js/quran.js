/* البحث في القرآن الكريم — يعمل دون إنترنت.
   النص غير مضمَّن في المستودع؛ يُقرأ من الملف data/quran-uthmani.txt (صيغة Tanzil: رقم السورة|رقم الآية|النص)
   أو من ملف يختاره المستخدم ويُحفظ في IndexedDB. انظر README. */
"use strict";
window.EM = window.EM || {};

EM.SURAHS = ["الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم", "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر", "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق", "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج", "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس", "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات", "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", "الناس"];

EM.quran = (function () {
  let verses = null;           // [[surah, ayah, text, normalized]]
  const DB = "examMakerQuran", ST = "files";

  const norm = s => String(s)
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿ]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه")
    .replace(/ا/g, "");   // الألف تُكتب أحيانًا بعلامة صغيرة (ـٰ) في الرسم العثماني، فنتجاهلها في الطرفين

  function parse(text) {
    const out = [];
    text.split(/\r?\n/).forEach(line => {
      if (!line || line[0] === "#") return;
      const m = /^(\d+)\|(\d+)\|(.+)$/.exec(line.trim());
      if (m) out.push([+m[1], +m[2], m[3], norm(m[3])]);
    });
    // الملف يضع البسملة في بداية الآية الأولى من كل سورة (عدا الفاتحة). نفصلها في الذاكرة فقط
    // دون تعديل الملف، فلا تظهر في نتائج البحث ولا عند إدراج الآية.
    const bism = out.length && out[0][0] === 1 && out[0][1] === 1 ? out[0][2] : "";
    if (bism) out.forEach(v => {
      if (v[1] === 1 && v[0] !== 1 && v[2].startsWith(bism + " ")) { v[2] = v[2].slice(bism.length + 1); v[3] = norm(v[2]); }
    });
    return out;
  }

  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  async function idbGet() { try { const db = await idb(); return await new Promise(res => { const q = db.transaction(ST).objectStore(ST).get("txt"); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch (e) { return null; } }
  async function idbPut(t) { try { const db = await idb(); await new Promise((res, rej) => { const q = db.transaction(ST, "readwrite").objectStore(ST).put(t, "txt"); q.onsuccess = res; q.onerror = rej; }); } catch (e) {} }

  async function load() {
    if (verses) return verses;
    let txt = await idbGet();
    if (!txt) { try { const r = await fetch("data/quran-uthmani.txt"); if (r.ok) txt = await r.text(); } catch (e) {} }
    const v = txt ? parse(txt) : [];
    if (v.length > 6000) verses = v;
    return verses;
  }
  async function importFile(file) {
    const t = await file.text(), v = parse(t);
    if (v.length < 6000) throw new Error("bad");
    await idbPut(t); verses = v; return v.length;
  }

  function search(q, surah) {
    if (!verses) return [];
    const words = norm(q).split(/\s+/).filter(Boolean);
    const phrase = words.join(" ");
    const hits = verses.filter(v => (!surah || v[0] === surah) && words.every(w => v[3].includes(w)));
    // الآيات التي تحوي العبارة كاملة متتالية أولًا
    return hits.filter(v => v[3].includes(phrase)).concat(hits.filter(v => !v[3].includes(phrase)));
  }
  const ref = v => "[" + EM.SURAHS[v[0] - 1] + ": " + v[1] + "]";
  const surahVerses = s => (verses || []).filter(v => v[0] === s);

  return { load, importFile, search, ref, surahVerses };
})();
