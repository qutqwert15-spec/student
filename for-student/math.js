/* ============================================================
   math.js — محرك الحسابات | منصة جماعة الإعفاء
   ============================================================ */
"use strict";

const MathEx = (() => {

  const num   = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1    = v => Math.round(v * 10) / 10;
  const sum   = arr => arr.reduce((t, v) => t + num(v), 0);
  const avg   = arr => (arr.length ? sum(arr) / arr.length : 0);
  const fmt   = v => (v == null ? "—" : String(r1(v)));

  const norm = (score, max) => {
    const s = num(score), m = num(max);
    if (m <= 0) return 0;
    return clamp((s / m) * 100, 0, 100);
  };

  const TIERS = {
    jewel : { id:"jewel",  label:"جوهرة",        sticker:"💎", sound:"great",   level:+3    },
    gold  : { id:"gold",   label:"ذهبي",         sticker:"🥇", sound:"good",    level:+1    },
    silver: { id:"silver", label:"فضي",          sticker:"🥈", sound:"nice",    level:+0.5  },
    bronze: { id:"bronze", label:"برونزي",       sticker:"🥉", sound:"not-bad", level:+0.25 },
    fail  : { id:"fail",   label:"ضعيف — فشل",   sticker:"❌", sound:"fail",    level:-1    },
    die   : { id:"die",    label:"نهاية الطريق", sticker:"💀", sound:"die",     level:-2    }
  };

  const tierOf = v => {
    const g = r1(num(v));
    if (g >= 100) return TIERS.jewel;
    if (g >= 85)  return TIERS.gold;
    if (g >= 75)  return TIERS.silver;
    if (g >= 50)  return TIERS.bronze;
    if (g >= 35)  return TIERS.fail;
    return TIERS.die;
  };

  const monthValues = subj =>
    (subj.months || []).filter(m => m.filled).map(m => norm(m.score, m.max));

  const monthSum = subj => r1(sum(monthValues(subj)));

  const partsTotal = subj => {
    const parts  = (subj.parts || []).filter(p => p.filled);
    const sMax   = sum(parts.map(p => num(p.max)));
    const sScore = sum(parts.map(p => num(p.score)));
    return { parts, sMax, sScore };
  };

  const subjectTermGrade = subj => {
    if (Array.isArray(subj.parts)) {
      const { parts, sMax, sScore } = partsTotal(subj);
      if (!parts.length) return null;
      return sMax > 0 ? clamp((sScore / sMax) * 100, 0, 100) : 0;
    }
    const vals = monthValues(subj);
    return vals.length ? avg(vals) : null;
  };

  const TERM_KEYS = ["s1", "mid", "s2"];

  const termAverage = (terms, key) => {
    const gs = ((terms && terms[key]) ? terms[key].subjects : [])
      .map(subjectTermGrade)
      .filter(v => v != null);
    return gs.length ? r1(avg(gs)) : null;
  };

  const yearlySubjects = terms => {
    const map = new Map();
    for (const k of TERM_KEYS) {
      const list = (terms && terms[k]) ? terms[k].subjects : [];
      for (const s of list) {
        if (!map.has(s.name)) map.set(s.name, { name: s.name, per: {}, vals: [] });
        const g = subjectTermGrade(s);
        if (g != null) {
          const e = map.get(s.name);
          e.per[k] = r1(g);
          e.vals.push(g);
        }
      }
    }
    const out = [];
    for (const e of map.values()) {
      if (e.vals.length) out.push({ name: e.name, per: e.per, grade: r1(avg(e.vals)) });
    }
    return out;
  };

  const overallAverage = terms => {
    const ys = yearlySubjects(terms);
    return ys.length ? r1(avg(ys.map(y => y.grade))) : null;
  };

  const exemption = terms => {
    const ys = yearlySubjects(terms);
    if (!ys.length) return { type: "none", overall: null, subjects: [] };
    const overall = r1(avg(ys.map(y => y.grade)));
    const high    = ys.filter(y => y.grade >= 90);
    const general = overall >= 85 && ys.every(y => y.grade >= 75);
    if (general)     return { type: "general",    overall, subjects: high };
    if (high.length) return { type: "individual", overall, subjects: high };
    return { type: "none", overall, subjects: [] };
  };

  const levelDelta = grade => tierOf(grade).level;

  const homeworkProgress = hw => {
    if (!hw || !hw.subjects || !hw.subjects.length) return 0;
    const total = hw.subjects.reduce((s, x) => s + num(x.totalPages), 0);
    const done  = hw.subjects.reduce((s, x) => s + num(x.completedPages), 0);
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  const homeworkComplete = hw => {
    if (!hw || !hw.subjects || !hw.subjects.length) return false;
    return hw.subjects.every(x => num(x.completedPages) >= num(x.totalPages));
  };

  return {
    num, clamp, r1, sum, avg, fmt, norm,
    TIERS, tierOf,
    monthValues, monthSum, partsTotal, subjectTermGrade,
    TERM_KEYS, termAverage, yearlySubjects, overallAverage,
    exemption, levelDelta,
    homeworkProgress, homeworkComplete
  };
})();