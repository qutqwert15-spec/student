/* ============================================================
   script.js — منطق الواجهة والتخزين | منصة جماعة الإعفاء
   ============================================================ */
"use strict";

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const h = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (k === "value") n.value = v;
    else if (k === "disabled") { if (v) n.disabled = true; }
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return n;
};

/* ---------------- التخزين الدائم ---------------- */
const KEY = "jamaat_alefaa_v1";
const Store = {
  blank() {
    return {
      v: 1, level: 1, streak: 0, bestStreak: 0,
      blocked: false, finished: false,
      terms: {
        s1:  { status: "open",   subjects: [] },
        mid: { status: "locked", subjects: [] },
        s2:  { status: "locked", subjects: [] }
      },
      log: []
    };
  },
  get() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return Store.blank();
      const d = JSON.parse(raw);
      if (!d || d.v !== 1 || !d.terms) return Store.blank();
      return Object.assign(Store.blank(), d);
    } catch { return Store.blank(); }
  },
  save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} },
  reset()  { try { localStorage.removeItem(KEY); } catch {} }
};
let ST = Store.get();

/* ---------------- التكامل مع الواجبات اليومية ---------------- */
function updateFromHomework(percentage) {
  if (percentage === 100) {
    ST.level = MathEx.r1(ST.level + 1);
    ST.streak += 1;
    ST.bestStreak = Math.max(ST.bestStreak, ST.streak);
    Store.save(ST); renderHUD();
    toast("🎉 +1 مستوى و+1 ستريك لإكمال كل الواجبات!");
  } else if (percentage >= 75) {
    ST.level = MathEx.r1(ST.level + 0.5);
    Store.save(ST); renderHUD();
    toast("👍 +0.5 مستوى لإنجاز جيد!");
  } else if (percentage > 0 && percentage < 50) {
    ST.streak = Math.max(0, ST.streak - 1);
    Store.save(ST); renderHUD();
    toast("⚠️ -1 ستريك — حاول تكمل أكثر!");
  }
}

/* ---------------- الأصوات ---------------- */
const SOUNDS = {
  "great":"great.mp3", "good":"good.mp3", "nice":"nice.mp3",
  "not-bad":"not-bad.mp3", "fail":"fail.mp3", "die":"die.mp3", "win":"win.mp3"
};
function play(name, vol = 0.75) {
  try {
    const a = new Audio(SOUNDS[name] || name);
    a.volume = vol;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch {}
}
let AC = null;
function tick(freq = 620) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.06, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.12);
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + 0.13);
  } catch {}
}

/* ---------------- الثيم ---------------- */
function applyTheme() {
  const overall = MathEx.overallAverage(ST.terms);
  const tier = overall == null ? null : MathEx.tierOf(overall);
  document.body.dataset.tier = tier ? tier.id : "base";
  $$("[data-sticker]").forEach(el => el.textContent = tier ? tier.sticker : "🎓");
  return overall;
}

/* ---------------- التنبيهات والمودال ---------------- */
function toast(msg, kind = "") {
  const box = $("#toasts"); if (!box) return;
  const t = h("div", { class: "toast " + kind }, msg);
  box.append(t);
  requestAnimationFrame(() => t.classList.add("on"));
  setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 400); }, 3200);
}

let _resolveAsk = null;
function ask(title, body, okText = "نعم", danger = false) {
  const ov = $("#modal");
  if (!ov) return Promise.resolve(true);
  $("#modal-title").textContent = title;
  $("#modal-body").textContent  = body;
  const ok = $("#modal-ok");
  ok.textContent = okText;
  ok.classList.toggle("btn-danger", danger);
  ok.classList.toggle("btn-acc", !danger);
  ov.classList.add("on");
  return new Promise(res => { _resolveAsk = res; });
}
function closeAsk(v) {
  const ov = $("#modal");
  if (ov) ov.classList.remove("on");
  if (_resolveAsk) { const r = _resolveAsk; _resolveAsk = null; r(v); }
}

function showDieOverlay() {
  const ov = $("#die-ov");
  if (ov) ov.classList.add("on");
}

/* ---------------- الـ HUD ---------------- */
function renderHUD() {
  const overall = applyTheme();
  const lv = $("#hud-level"), sk = $("#hud-streak"), av = $("#hud-avg");
  if (lv) lv.textContent = "⚡ " + MathEx.fmt(ST.level);
  if (sk) sk.textContent = ST.streak > 0 ? "🔥 " + ST.streak : "🔥 —";
  if (av) av.textContent = "📊 " + MathEx.fmt(overall);
  const bar = $("#hud-lvbar");
  if (bar) {
    const f = ST.level % 1;
    bar.style.width = Math.max(4, f * 100) + "%";
  }
}

let IO = null;
function reveal() {
  IO = IO || new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); IO.unobserve(e.target); }
  }), { threshold: .12 });
  $$(".rv:not(.in)").forEach(el => IO.observe(el));
}

function animateNumber(el, target, dash = false) {
  if (!el) return;
  if (dash) { el.textContent = "—"; return; }
  const dur = 900, t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = MathEx.fmt(target * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------------- Debounce ---------------- */
const DEBOUNCE_MS = 650;
const _timers = new Map();
function debounce(id, fn) {
  if (_timers.has(id)) clearTimeout(_timers.get(id));
  _timers.set(id, setTimeout(() => { _timers.delete(id); fn(); }, DEBOUNCE_MS));
}

/* ============================================================
   صفحة تسجيل الدرجات
   ============================================================ */
const TERMS = [
  { key: "s1",  title: "الفصل الأول",  kind: "months", doneTxt: "اكتمل الفصل" },
  { key: "mid", title: "نصف السنة",    kind: "parts",  doneTxt: "اكتملت امتحانات نصف السنة" },
  { key: "s2", title: "الفصل الثاني", kind: "months", doneTxt: "اكتمل الفصل" }
];
const MONTH_NAMES = ["الشهر الأول","الشهر الثاني","الشهر الثالث","الشهر الرابع",
  "الشهر الخامس","الشهر السادس","الشهر السابع","الشهر الثامن",
  "الشهر التاسع","الشهر العاشر","الشهر الحادي عشر","الشهر الثاني عشر"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const blankRow = () => ({ score: "", max: "100", filled: false });
const makeSubj = (name, kind) => ({
  id: uid(), name: String(name).trim().slice(0, 40),
  ...(kind === "parts" ? { parts: [blankRow()] } : { months: [blankRow(), blankRow()] })
});

function renderSing() {
  renderHUD(); renderSteps();
  const area = $("#terms-area"); if (!area) return;
  area.textContent = "";
  for (const T of TERMS) {
    const term = ST.terms[T.key];
    if (term.status === "done")      area.append(archiveCard(T));
    else if (term.status === "open") area.append(termEditor(T));
    else                             area.append(lockedCard(T));
  }
  if (ST.finished) {
    area.append(h("div", { class: "glass done-panel" },
      h("div", { class: "done-emoji" }, "🏁"),
      h("h2", {}, "اكتملت السنة الدراسية!"),
      h("p", { class: "muted" }, "الفصل الأول + نصف السنة + الفصل الثاني — كله مسجل ومقفول."),
      h("a", { class: "btn btn-acc btn-big", href: "finel.html" }, "شوف نتيجتك النهائية ←")));
  }
  if (ST.blocked) showDieOverlay();
  reveal();
}

function renderSteps() {
  const stepsEl = $("#steps"); if (!stepsEl) return;
  stepsEl.textContent = "";
  const order = [...TERMS.map(t => t.key), "final"];
  for (let i = 0; i < order.length; i++) {
    const k = order[i];
    const label = k === "final" ? "النتيجة النهائية" : TERMS[i].title;
    let st = "lock";
    if (k === "final") st = ST.finished ? "done" : "lock";
    else {
      const s = ST.terms[k].status;
      st = s === "done" ? "done" : s === "open" ? "now" : "lock";
    }
    const node = h("div", { class: "step " + st },
      h("span", {}, st === "done" ? "✓" : st === "now" ? "●" : "🔒"),
      h("span", {}, label));
    if (st === "done" && k === "final") node.addEventListener("click", () => location.href = "finel.html");
    stepsEl.append(node);
    if (i < order.length - 1) stepsEl.append(h("div", { class: "step-line " + (st === "done" ? "done" : "") }));
  }
}

function termEditor(T) {
  const term = ST.terms[T.key];
  const box = h("section", { class: "glass term-panel", id: "panel-" + T.key },
    h("header", { class: "term-head" },
      h("div", {},
        h("h2", {}, T.title),
        h("p", { class: "muted small" },
          T.kind === "months"
            ? "سجّل درجة كل شهر و«من كم» — المعدل ينحسب بعد أن تترك الحقل"
            : "امتحان واحد لكل مادة — تكدر تضيف أجزاء (تحريري من 80 + شفهي من 20 مثلًا)")),
      h("span", { class: "pill live" }, "قيد التسجيل")),
    h("div", { class: "add-subj" }, (() => {
      const inp = h("input", { class: "inp", type: "text", placeholder: "اسم المادة… مثال: الرياضيات", maxlength: "40" });
      const btn = h("button", { class: "btn btn-acc", onclick: () => addSubject(T, inp) }, "+ إضافة مادة");
      inp.addEventListener("keydown", e => { if (e.key === "Enter") addSubject(T, inp); });
      return h("div", { class: "add-row" }, inp, btn);
    })()),
    h("div", { class: "subj-list", id: "list-" + T.key },
      term.subjects.length
        ? term.subjects.map(s => subjectCard(T, s, true))
        : h("div", { class: "empty" }, "📚 ماكو مواد بعد — ابدأ بإضافة أول مادة")));
  if (term.subjects.some(s => MathEx.subjectTermGrade(s) != null)) {
    box.append(h("div", { class: "term-foot" },
      h("button", { class: "btn btn-big btn-lock", onclick: () => completeTerm(T) }, "🔒 " + T.doneTxt)));
  }
  return box;
}

function lockedCard(T) {
  return h("div", { class: "glass locked-panel" },
    h("span", { class: "arch-ic" }, "⏳"),
    h("div", {}, h("b", {}, T.title), h("p", { class: "muted small" }, "ينفتح بعد إكمال المرحلة السابقة")));
}

function archiveCard(T) {
  const term = ST.terms[T.key];
  const tavg = MathEx.termAverage(ST.terms, T.key);
  const tier = tavg == null ? null : MathEx.tierOf(tavg);
  return h("details", { class: "glass archive" },
    h("summary", {},
      h("span", { class: "arch-ic" }, "🔒"),
      h("b", {}, T.title),
      h("span", { class: "done-pill" }, T.doneTxt),
      h("span", { class: "chip", "data-tier": tier ? tier.id : "none" }, "معدل الفصل: " + MathEx.fmt(tavg))),
    h("div", { class: "arch-body" },
      term.subjects.map(s => {
        const g = MathEx.subjectTermGrade(s);
        const t2 = g == null ? null : MathEx.tierOf(g);
        return h("div", { class: "arch-row" },
          h("span", {}, s.name),
          h("span", { class: "chip sm", "data-tier": t2 ? t2.id : "none" }, MathEx.fmt(g)));
      })));
}

function subjectCard(T, s, editable) {
  const g = MathEx.subjectTermGrade(s);
  const tier = g == null ? null : MathEx.tierOf(g);
  const chip = h("span", { class: "chip", "data-tier": tier ? tier.id : "none",
    title: "اضغط لسماع صوت الفئة" },
    tier ? `${tier.label} · ${MathEx.fmt(g)}` : "لم تُسجل");
  if (tier) chip.addEventListener("click", () => play(tier.sound, .5));

  const head = h("header", { class: "subj-head" },
    h("span", { class: "subj-dot" }, tier ? tier.sticker : "📖"),
    h("h3", { class: "subj-name" }, s.name),
    chip,
    editable ? h("button", { class: "icon-btn danger", title: "حذف المادة", onclick: () => delSubject(T, s) }, "🗑") : null);

  const rowsWrap = h("div", { class: "rows" });
  (T.kind === "months" ? s.months : s.parts).forEach((row, i) =>
    rowsWrap.append(rowEl(T, s, row, i, editable)));

  const card = h("article", { class: "subj glass2", id: "subj-" + s.id }, head, rowsWrap);
  if (editable) {
    card.append(h("button", { class: "btn btn-ghost btn-sm add-row-btn", onclick: () => addRow(T, s) },
      T.kind === "months" ? "+ إضافة شهر" : "+ إضافة جزء (شفهي / أعمال)"));
  }
  card.append(totalFooter(T, s));
  return card;
}

function rowEl(T, s, row, i, editable) {
  const label = T.kind === "months"
    ? (MONTH_NAMES[i] || `الشهر ${i + 1}`)
    : (i === 0 ? "الدرجة الأساسية" : `جزء إضافي ${i}`);

  const score = h("input", { class: "inp num", type: "number", inputmode: "decimal",
    min: "0", step: "any", placeholder: "الدرجة", value: row.score });
  const max = h("input", { class: "inp num small-inp", type: "number", inputmode: "decimal",
    min: "1", step: "any", placeholder: "100", value: row.max, title: "من كم الدرجة؟" });
  if (!editable) { score.disabled = true; max.disabled = true; }
  const chip = h("span", { class: "chip row-chip", "data-tier": "none" }, "—");

  const debounceId = `${s.id}-${T.key}-${i}`;

  const liveUpdate = () => {
    row.score = score.value;
    row.max = max.value;
    const sNum = MathEx.num(score.value, -1);
    const mNum = MathEx.num(max.value);
    row.filled = score.value !== "" && sNum >= 0 && mNum > 0;
    score.classList.toggle("over", row.filled && sNum > mNum);
    Store.save(ST);
    if (row.filled) {
      if (T.kind === "months") {
        const n = MathEx.norm(row.score, row.max);
        chip.textContent = "= " + MathEx.fmt(n);
        chip.dataset.tier = MathEx.tierOf(n).id;
      } else {
        chip.textContent = `${sNum} / ${mNum}`;
        chip.dataset.tier = "none";
      }
    } else {
      chip.textContent = "—";
      chip.dataset.tier = "none";
    }
  };

  const fullCompute = () => {
    refreshSubject(T, s);
    renderHUD();
    if (row.filled) {
      const n = T.kind === "months"
        ? MathEx.norm(row.score, row.max)
        : MathEx.clamp(MathEx.num(row.score) / MathEx.num(row.max) * 100, 0, 100);
      if (n < 35) warnAboutLowGrade(s.name, n);
    }
  };

  const onInput = () => { liveUpdate(); debounce(debounceId, fullCompute); };
  score.addEventListener("input", onInput);
  max.addEventListener("input", onInput);

  const onBlur = () => {
    if (_timers.has(debounceId)) { clearTimeout(_timers.get(debounceId)); _timers.delete(debounceId); }
    fullCompute();
  };
  score.addEventListener("blur", onBlur);
  max.addEventListener("blur", onBlur);

  const arr = T.kind === "months" ? s.months : s.parts;
  const del = (editable && arr.length > 1)
    ? h("button", { class: "icon-btn", title: "حذف", onclick: () => delRow(T, s, i) }, "✕")
    : h("span", { class: "row-spacer" });

  return h("div", { class: "mrow" },
    h("span", { class: "mrow-label" }, label),
    h("div", { class: "mrow-in" }, score, h("span", { class: "of" }, "من"), max),
    chip, del);
}

let _warningShown = false;
async function warnAboutLowGrade(subjectName, grade) {
  if (_warningShown) return;
  _warningShown = true;
  const yes = await ask(
    "⚠️ درجة منخفضة جدًا",
    `درجة «${subjectName}» هي ${MathEx.fmt(grade)} (أقل من 35). وفق نظام المنصة، هذه الدرجة تعني النهاية.\nهل تريد تعديلها قبل أن تُقفل؟`,
    "سأعدّلها الآن", false);
  _warningShown = false;
  if (!yes) triggerDie();
  else toast("عدّل الدرجة قبل أن تفوّتها 👀");
}

function triggerDie() {
  ST.blocked = true;
  Store.save(ST);
  play("die");
  renderHUD();
  showDieOverlay();
}

async function startOver() {
  const yes = await ask("البداية من جديد",
    "راح تنمسح كل الدرجات والمستوى والستريك نهائيًا. متأكد؟",
    "أمسح وابدأ", true);
  if (yes) { Store.reset(); location.reload(); }
}

function totalFooter(T, s) {
  const g = MathEx.subjectTermGrade(s);
  const tier = g == null ? null : MathEx.tierOf(g);
  if (T.kind === "months") {
    return h("footer", { class: "subj-total", "data-tier": tier ? tier.id : "none" },
      h("span", { class: "lock-ic" }, "🔒"),
      h("span", { class: "lock-cell" }, "مجموع الأشهر: ", h("b", {}, MathEx.fmt(MathEx.monthSum(s)))),
      h("span", { class: "lock-cell strong" }, "معدل المادة: ", h("b", {}, MathEx.fmt(g)),
        h("i", {}, "من 100 · مقسوم على عدد الأشهر")));
  }
  const { parts, sMax, sScore } = MathEx.partsTotal(s);
  return h("footer", { class: "subj-total", "data-tier": tier ? tier.id : "none" },
    h("span", { class: "lock-ic" }, "🔒"),
    h("span", { class: "lock-cell" }, "المجموع: ",
      h("b", {}, parts.length ? `${MathEx.r1(sScore)} من ${MathEx.r1(sMax)}` : "—")),
    h("span", { class: "lock-cell strong" }, "معدل المادة: ", h("b", {}, MathEx.fmt(g)), h("i", {}, "من 100")));
}

function refreshSubject(T, s) {
  const card = $("#subj-" + s.id); if (!card) return;
  const rows = T.kind === "months" ? s.months : s.parts;
  $$(".row-chip", card).forEach((chipEl, i) => {
    const row = rows[i]; if (!row) return;
    if (!row.filled) { chipEl.textContent = "—"; chipEl.dataset.tier = "none"; return; }
    if (T.kind === "months") {
      const n = MathEx.norm(row.score, row.max);
      chipEl.textContent = "= " + MathEx.fmt(n);
      chipEl.dataset.tier = MathEx.tierOf(n).id;
    } else {
      chipEl.textContent = `${MathEx.num(row.score)} / ${MathEx.num(row.max)}`;
      chipEl.dataset.tier = "none";
    }
  });
  const foot = $(".subj-total", card);
  if (foot) foot.replaceWith(totalFooter(T, s));
  const g = MathEx.subjectTermGrade(s);
  const tier = g == null ? null : MathEx.tierOf(g);
  const chip = $(".subj-head .chip", card);
  if (chip) chip.textContent = tier ? `${tier.label} · ${MathEx.fmt(g)}` : "لم تُسجل";
  if (chip) chip.dataset.tier = tier ? tier.id : "none";
  const dot = $(".subj-dot", card);
  if (dot) dot.textContent = tier ? tier.sticker : "📖";
  const panel = $("#panel-" + T.key);
  if (panel) {
    const has = ST.terms[T.key].subjects.some(x => MathEx.subjectTermGrade(x) != null);
    let fb = $(".term-foot", panel);
    if (has && !fb) {
      panel.append(h("div", { class: "term-foot" },
        h("button", { class: "btn btn-big btn-lock", onclick: () => completeTerm(T) }, "🔒 " + T.doneTxt)));
    }
    if (!has && fb) fb.remove();
  }
}

function addSubject(T, inp) {
  if (ST.blocked) return showDieOverlay();
  const name = inp.value.trim();
  if (!name) return toast("اكتب اسم المادة أولًا", "warn");
  const exists = TERMS.some(t => ST.terms[t.key].subjects.some(s => s.name === name));
  if (exists) return toast("هذه المادة مسجلة سابقًا — سجل درجاتها بنفس القائمة", "warn");
  ST.terms[T.key].subjects.push(makeSubj(name, T.kind));
  Store.save(ST);
  tick(700);
  renderSing();
  toast(`تمت إضافة «${name}» ✓`);
}
function addRow(T, s) {
  if (ST.blocked) return showDieOverlay();
  (T.kind === "months" ? s.months : s.parts).push(blankRow());
  Store.save(ST); tick(760); renderSing();
}
function delRow(T, s, i) {
  const arr = T.kind === "months" ? s.months : s.parts;
  if (arr.length <= 1) return;
  arr.splice(i, 1);
  Store.save(ST); renderSing();
}
function delSubject(T, s) {
  ask("حذف المادة", `راح تنحذف «${s.name}» بكل درجاتها. متأكد؟`, "احذف", true).then(y => {
    if (!y) return;
    ST.terms[T.key].subjects = ST.terms[T.key].subjects.filter(x => x.id !== s.id);
    Store.save(ST); tick(300); renderSing();
  });
}

async function completeTerm(T) {
  const term = ST.terms[T.key];
  const graded = term.subjects.filter(s => MathEx.subjectTermGrade(s) != null);
  if (!graded.length) return toast("سجّل درجة واحدة على الأقل قبل الإكمال", "warn");
  const emptyCount = term.subjects.length - graded.length;

  const yes = await ask("هل انت متأكد؟",
    `بعد التأكيد تنقفل درجات «${T.title}» وما تكدر تعدلها أبدًا.` +
    (emptyCount ? `(راح تنحذف ${emptyCount} مادة بدون درجات)` : ""),
    "نعم، اقفلها");
  if (!yes) return;

  term.subjects = graded;
  let gotDie = false, gotFail = false;

  for (const s of graded) {
    const g = MathEx.subjectTermGrade(s);
    const tier = MathEx.tierOf(g);
    if (tier.id === "die") {
      const confirm = await ask("⚠️ درجة نهاية الطريق",
        `مادة «${s.name}» درجتها ${MathEx.fmt(g)} (أقل من 35).\nإكمال هذا الفصل يعني نهاية المنصة لك.\nمتأكد تريد المتابعة؟`,
        "نعم، أقبل النتيجة", true);
      if (!confirm) { toast("تم إلغاء الإكمال — عدّل درجاتك"); return; }
    }
  }

  for (const s of graded) {
    const g = MathEx.subjectTermGrade(s);
    const tier = MathEx.tierOf(g);
    ST.level = Math.max(0, MathEx.r1(ST.level + tier.level));
    if (g >= 85) { ST.streak += 1; ST.bestStreak = Math.max(ST.bestStreak, ST.streak); }
    else ST.streak = 0;
    ST.log.push({ name: s.name, term: T.title, grade: MathEx.r1(g), tier: tier.id, delta: tier.level });
    if (tier.id === "die")  gotDie = true;
    if (tier.id === "fail") gotFail = true;
  }

  term.status = "done";
  const tavg = MathEx.termAverage(ST.terms, T.key);
  const tierAvg = MathEx.tierOf(tavg);
  ST.log.push({ name: `معدل ${T.title}`, term: T.title, grade: tavg, tier: tierAvg.id, delta: 0, avg: true });

  const idx = TERMS.findIndex(x => x.key === T.key);
  const next = TERMS[idx + 1];
  if (next) {
    const nt = ST.terms[next.key];
    nt.status = "open";
    nt.subjects = graded.map(s => makeSubj(s.name, next.kind));
  } else {
    ST.finished = true;
  }

  if (gotDie) ST.blocked = true;
  Store.save(ST);
  play(gotDie ? "die" : tierAvg.sound);
  renderSing();
  if (ST.blocked) return;
  toast(gotFail ? "تم الإكمال… بس انتبه لبعض الدرجات 👀"
    : `تم إكمال «${T.title}» 🎉 المستوى: ${MathEx.fmt(ST.level)}`);
  if (ST.finished) setTimeout(() => toast("خلصت السنة! روح لصفحة النتيجة 🏁"), 900);
}

/* ============================================================
   الصفحة الرئيسية
   ============================================================ */
function renderIndex() {
  renderHUD();
  const overall = MathEx.overallAverage(ST.terms);
  const tier = overall == null ? null : MathEx.tierOf(overall);

  const dial = $("#dial");
  if (dial) {
    dial.style.setProperty("--p", overall ?? 0);
    animateNumber($("#dial-num"), overall ?? 0, overall == null);
    $("#dial-cap").textContent = overall == null ? "ابدأ التسجيل" : "معدلك الحالي";
  }
  const stick = $("#board-sticker");
  if (stick) { stick.textContent = tier ? tier.sticker : "🎓"; stick.classList.toggle("idle", !tier); }
  const bt = $("#board-tier");
  if (bt) bt.textContent = tier ? `التقييم الحالي: ${tier.label}` : "لسه ماكو درجات — سجل أول مادة وابدأ";

  const tp = $("#term-progress");
  if (tp) {
    tp.textContent = "";
    for (const T of TERMS) {
      const s = ST.terms[T.key];
      const tavg = s.status === "done" ? MathEx.termAverage(ST.terms, T.key) : null;
      tp.append(h("div", { class: "tp-item " + s.status },
        h("b", {}, T.title),
        h("span", {}, s.status === "done" ? `✔ ${MathEx.fmt(tavg)}`
          : s.status === "open" ? "قيد التسجيل…" : "مقفول")));
    }
  }

  const cta = $("#cta");
  if (cta) {
    cta.textContent = "";
    if (ST.blocked) {
      cta.append(h("div", { class: "glass danger-banner" },
        "💀 نحن نتأسف لك… لكن لا تستطيع الاستمرار معنا في هذه المنصة. الطريقة الوحيدة للرجوع: البداية من جديد.",
        h("button", { class: "btn btn-danger", onclick: startOver }, "أبدأ من جديد")));
    } else if (ST.finished) {
      cta.append(h("a", { class: "btn btn-acc btn-big", href: "finel.html" }, "🏁 شوف النتيجة النهائية"));
    } else {
      const openT = TERMS.find(t => ST.terms[t.key].status === "open");
      const started = ST.log.length > 0 || TERMS.some(t => ST.terms[t.key].subjects.length);
      cta.append(h("a", { class: "btn btn-acc btn-big", href: "sing-mark.html" },
        started ? `متابعة التسجيل — ${openT ? openT.title : ""} ←` : "🚀 ابدأ تسجيل درجاتك"));
      if (started) cta.append(h("a", { class: "btn btn-ghost btn-big", href: "finel.html" }, "النتيجة النهائية"));
    }
  }

  const lg = $("#log-list");
  if (lg) {
    lg.textContent = "";
    const items = ST.log.filter(l => !l.avg).slice(-8).reverse();
    if (!items.length) lg.append(h("p", { class: "muted" }, "ماكو درجات موثقة لحد الآن."));
    items.forEach(l => lg.append(h("div", { class: "log-row" },
      h("span", { class: "log-term" }, l.term),
      h("b", {}, l.name),
      h("span", { class: "chip sm", "data-tier": l.tier }, MathEx.fmt(l.grade)),
      h("span", { class: "delta " + (l.delta >= 0 ? "up" : "down") },
        (l.delta >= 0 ? "+" : "") + MathEx.fmt(l.delta) + " مستوى"))));
  }
  reveal();
}

/* ============================================================
   صفحة النتيجة النهائية
   ============================================================ */
function renderFinel() {
  renderHUD();
  const allDone = TERMS.every(t => ST.terms[t.key].status === "done");
  const ready = $("#finel-ready"), notYet = $("#finel-notyet");

  if (!allDone) {
    if (ready)  ready.hidden = true;
    if (notYet) notYet.hidden = false;
    const list = $("#ny-list");
    if (list) {
      list.textContent = "";
      TERMS.forEach(T => {
        const s = ST.terms[T.key].status;
        list.append(h("div", { class: "tp-item " + s },
          h("b", {}, T.title),
          h("span", {}, s === "done" ? "✔ مكتمل" : s === "open" ? "قيد التسجيل" : "لم يُفتح بعد")));
      });
    }
    reveal();
    return;
  }
  if (notYet) notYet.hidden = true;
  if (ready)  ready.hidden = false;

  const ex = MathEx.exemption(ST.terms);
  const overall = ex.overall;
  const tier = MathEx.tierOf(overall);
  const ys = MathEx.yearlySubjects(ST.terms);

  const dial = $("#f-dial");
  if (dial) dial.style.setProperty("--p", overall ?? 0);
  animateNumber($("#f-num"), overall ?? 0);
  const fs = $("#f-sticker"); if (fs) fs.textContent = tier.sticker;
  const tn = $("#f-tier-name"); if (tn) tn.textContent = tier.label;

  const v = $("#verdict");
  if (v) {
    v.textContent = "";
    if (ex.type === "general") {
      v.className = "verdict v-general";
      v.append(
        h("div", { class: "v-emoji" }, "🎖️"),
        h("h2", {}, "مبروك! إعفاء عام من الامتحانات النهائية 🎉"),
        h("p", { class: "muted" }, `معدلك ${MathEx.fmt(overall)} وكل موادك فوق 75 — جماعة الإعفاء تفتخر فيك.`));
      if (ex.subjects.length) {
        v.append(h("p", { class: "small" },
          `ومن ضمنها ${ex.subjects.length} مادة فوق الـ90: ${ex.subjects.map(s => s.name).join("، ")}`));
      }
      play("win");
    } else if (ex.type === "individual") {
      v.className = "verdict v-indiv";
      v.append(
        h("div", { class: "v-emoji" }, "🎉"),
        h("h2", {}, "مبروك! حصلت على إعفاء فردي"),
        h("p", { class: "muted" }, `معدلك ${MathEx.fmt(overall)} — المواد التالية 90+ وانعفيت من امتحانها النهائي:`),
        h("div", { class: "ex-chips" },
          ex.subjects.map(s => h("span", { class: "chip", "data-tier": MathEx.tierOf(s.grade).id },
            `${s.name} · ${MathEx.fmt(s.grade)}`))));
      play("win");
    } else {
      v.className = "verdict v-none";
      v.append(
        h("div", { class: "v-emoji" }, "💪"),
        h("h2", {}, "ما حصلت على إعفاء هالمرة"),
        h("p", { class: "muted" }, `معدلك ${MathEx.fmt(overall)}. لا بأس — النهائي فرصة تعويض، وجماعة الإعفاء وياك.`));
      play(tier.sound);
    }
  }

  const rb = $("#btn-replay");
  if (rb) rb.onclick = () => play(ex.type === "none" ? tier.sound : "win");

  const tb = $("#f-tbody");
  if (tb) {
    tb.textContent = "";
    ys.forEach(y => {
      const t = MathEx.tierOf(y.grade);
      const isEx = y.grade >= 90;
      tb.append(h("tr", {},
        h("td", {}, h("b", {}, y.name)),
        h("td", { class: "c" }, MathEx.fmt(y.per.s1)),
        h("td", { class: "c" }, MathEx.fmt(y.per.mid)),
        h("td", { class: "c" }, MathEx.fmt(y.per.s2)),
        h("td", { class: "c" }, h("span", { class: "chip", "data-tier": t.id }, `${MathEx.fmt(y.grade)} · ${t.label}`)),
        h("td", { class: "c" },
          isEx ? h("span", { class: "ex-badge" }, "🛡️ إعفاء") : h("span", { class: "muted" }, "—"))));
    });
  }

  const setT = (id, val) => { const e = $(id); if (e) e.textContent = val; };
  setT("#st-level", MathEx.fmt(ST.level));
  setT("#st-streak", ST.streak);
  setT("#st-best", ST.bestStreak);
  setT("#st-count", ys.length);
  reveal();
}

/* ============================================================
   الإقلاع
   ============================================================ */
function init() {
  document.addEventListener("click", e => {
    if (e.target && e.target.id === "modal-ok") closeAsk(true);
    else if (e.target && (e.target.id === "modal-no" || e.target.id === "modal")) closeAsk(false);
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAsk(false); });

  const dr = $("#die-restart");
  if (dr) dr.addEventListener("click", startOver);
  $$("[data-reset]").forEach(b => b.addEventListener("click", startOver));

  if (ST.blocked) showDieOverlay();

  const page = document.body.dataset.page;
  if (page === "sing") renderSing();
  else if (page === "finel") renderFinel();
  else if (page === "homework") { /* homework.js يتولى */ }
  else renderIndex();
}
document.addEventListener("DOMContentLoaded", init);