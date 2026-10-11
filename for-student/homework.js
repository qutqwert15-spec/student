/* ============================================================
   homework.js — نظام الواجبات اليومية | منصة جماعة الإعفاء
   نسخة v3: إضافة reveal() حتى تظهر أقسام الصفحة
   ============================================================ */
"use strict";

const HW_KEY = "jamaat_alefaa_homework_v1";
const HWStore = {
  blank() {
    const today = new Date().toISOString().split("T")[0];
    return { date: today, subjects: [], completed: false, completedAt: null, percentage: 0 };
  },
  get() {
    try {
      const raw = localStorage.getItem(HW_KEY);
      if (!raw) return HWStore.blank();
      const d = JSON.parse(raw);
      if (!d || !d.date) return HWStore.blank();
      const today = new Date().toISOString().split("T")[0];
      if (d.date !== today) return HWStore.blank();
      return Object.assign(HWStore.blank(), d);
    } catch { return HWStore.blank(); }
  },
  save(hw) { try { localStorage.setItem(HW_KEY, JSON.stringify(hw)); } catch {} },
  reset()  { try { localStorage.removeItem(HW_KEY); } catch {} }
};
let HW = HWStore.get();

function hwFormatDate(dateStr) {
  const d = new Date(dateStr);
  const days = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  return `${days[d.getDay()]}، ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function hwCalcProgress() {
  if (!HW.subjects.length) return 0;
  const total = HW.subjects.reduce((s, x) => s + MathEx.num(x.totalPages), 0);
  const done  = HW.subjects.reduce((s, x) => s + MathEx.num(x.completedPages), 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function hwIsAllComplete() {
  return HW.subjects.length > 0 &&
    HW.subjects.every(x => MathEx.num(x.completedPages) >= MathEx.num(x.totalPages));
}

function hwRender() {
  hwRenderDate();
  hwRenderAdd();
  hwRenderList();
  hwRenderComplete();
  hwRenderDone();
  if (typeof renderHUD === "function") renderHUD();
  /* ⭐ السطر الناقص: يكشف الأقسام المخفية (كلاس rv) */
  if (typeof reveal === "function") reveal();
}

function hwRenderDate() {
  const el = $("#hw-date");
  if (el) el.textContent = hwFormatDate(HW.date);
}

function hwRenderAdd() {
  const s = $("#hw-add-section");
  if (s) s.hidden = HW.completed;
}

function hwRenderList() {
  const list = $("#hw-list");
  if (!list) return;
  list.textContent = "";

  if (!HW.subjects.length) {
    list.append(h("div", { class: "empty glass" }, "📚 ماكو واجبات بعد — أضف أول واجب"));
    return;
  }

  for (const subj of HW.subjects) {
    const total  = MathEx.num(subj.totalPages);
    const done   = MathEx.num(subj.completedPages);
    const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
    const isDone = done >= total;

    const minusBtn = h("button", { class: "btn btn-ghost btn-sm hw-btn", onclick: () => hwDec(subj) }, "−1");
    if (done <= 0) minusBtn.disabled = true;

    const plusBtn = h("button", { class: "btn btn-acc btn-sm hw-btn", onclick: () => hwInc(subj) }, "+1");
    if (isDone) plusBtn.disabled = true;

    const card = h("article", { class: "hw-card glass" + (isDone ? " hw-card-complete" : "") },
      h("header", { class: "hw-card-head" },
        h("h3", { class: "hw-card-name" }, (isDone ? "✓ " : "") + subj.name),
        h("button", { class: "icon-btn danger", title: "حذف", onclick: () => hwDel(subj) }, "🗑")),
      h("div", { class: "hw-card-body" },
        h("div", { class: "hw-progress" },
          h("span", { class: "hw-progress-label" }, "الإنجاز"),
          h("span", { class: "hw-progress-value" }, `${done} من ${total} صفحة (${pct}%)`)),
        h("div", { class: "hw-progress-bar" },
          h("i", { style: `width:${pct}%` })),
        h("div", { class: "hw-card-actions" },
          minusBtn,
          h("span", { class: "hw-counter" }, done),
          plusBtn)));
    list.append(card);
  }
}

function hwRenderComplete() {
  const s = $("#hw-complete-section");
  const btn = $("#hw-complete-btn");
  if (HW.completed) { if (s) s.hidden = true; return; }
  if (s) s.hidden = !HW.subjects.length;
  if (btn) {
    const p = hwCalcProgress();
    btn.textContent = p === 100
      ? "✔️ تم — كملت كل واجباتي (100%)"
      : `✔️ تم — هذه هي كل واجباتي (${p}%)`;
  }
}

function hwRenderDone() {
  const s = $("#hw-done-section");
  const stats = $("#hw-done-stats");
  if (HW.completed) {
    if (s) s.hidden = false;
    if (stats) {
      const total = HW.subjects.reduce((a, x) => a + MathEx.num(x.totalPages), 0);
      const done  = HW.subjects.reduce((a, x) => a + MathEx.num(x.completedPages), 0);
      stats.textContent = `أكملت ${done} من ${total} صفحة (${HW.percentage}%) عبر ${HW.subjects.length} مواد`;
    }
  } else if (s) s.hidden = true;
}

function hwAdd() {
  const nameEl = $("#hw-name");
  const pagesEl = $("#hw-pages");
  if (!nameEl || !pagesEl) return;
  const name = nameEl.value.trim();
  const pages = Math.max(1, parseInt(pagesEl.value) || 1);
  if (!name) return toast("اكتب اسم المادة أولًا", "warn");
  if (HW.subjects.some(s => s.name === name)) return toast("هذه المادة مضافة بالفعل", "warn");
  HW.subjects.push({ id: uid(), name, totalPages: pages, completedPages: 0 });
  HWStore.save(HW);
  nameEl.value = "";
  pagesEl.value = "1";
  hwRender();
  toast(`تمت إضافة «${name}» ✓`);
}

function hwDel(subj) {
  ask("حذف الواجب", `راح تنحذف «${subj.name}» من قائمة اليوم. متأكد؟`, "احذف", true).then(y => {
    if (!y) return;
    HW.subjects = HW.subjects.filter(s => s.id !== subj.id);
    HWStore.save(HW);
    hwRender();
  });
}

function hwInc(subj) {
  if (MathEx.num(subj.completedPages) < MathEx.num(subj.totalPages)) {
    subj.completedPages = MathEx.num(subj.completedPages) + 1;
    HWStore.save(HW);
    hwRender();
    if (subj.completedPages >= subj.totalPages) toast(`✓ أكملت «${subj.name}»!`);
  }
}

function hwDec(subj) {
  if (MathEx.num(subj.completedPages) > 0) {
    subj.completedPages = MathEx.num(subj.completedPages) - 1;
    HWStore.save(HW);
    hwRender();
  }
}

async function hwComplete() {
  const p = hwCalcProgress();
  if (!hwIsAllComplete() && p < 100) {
    const yes = await ask("⚠️ واجبات غير مكتملة",
      `ما كملت كل الواجبات (${p}%). هل تريد الانتهاء رغم ذلك؟`, "نعم، أنهي");
    if (!yes) return;
  }
  HW.completed = true;
  HW.completedAt = new Date().toISOString();
  HW.percentage = p;
  HWStore.save(HW);
  await hwShowGTA(p);
  if (typeof updateFromHomework === "function") updateFromHomework(p);
  hwRender();
}

function hwShowGTA(p) {
  return new Promise(resolve => {
    const screen = $("#gta-screen");
    const statsEl = $("#gta-stats");
    const cont = $("#gta-continue");
    if (!screen || !statsEl) return resolve();

    const total = HW.subjects.reduce((a, x) => a + MathEx.num(x.totalPages), 0);
    const done  = HW.subjects.reduce((a, x) => a + MathEx.num(x.completedPages), 0);
    const subjDone = HW.subjects.filter(x => MathEx.num(x.completedPages) >= MathEx.num(x.totalPages)).length;

    const items = [
      { label: "المواد المكتملة", value: `${subjDone} من ${HW.subjects.length}` },
      { label: "الصفحات المنجزة", value: `${done} من ${total}` },
      { label: "النسبة المئوية", value: `${p}%` },
      { label: "التقييم", value: p === 100 ? "ممتاز ✨" : p >= 75 ? "جيد 👍" : "مقبول" }
    ];
    statsEl.textContent = "";
    items.forEach((it, i) => {
      setTimeout(() => {
        statsEl.append(h("div", { class: "gta-stat-item" },
          h("span", { class: "gta-stat-label" }, it.label),
          h("span", { class: "gta-stat-value" }, it.value)));
      }, 800 + i * 550);
    });

    screen.classList.add("on");
    if (p === 100) play("great");
    else if (p >= 75) play("good");
    else if (p >= 50) play("nice");

    let closed = false;
    const close = () => { if (!closed) { closed = true; screen.classList.remove("on"); resolve(); } };
    if (cont) cont.onclick = close;
    setTimeout(close, 9000);
  });
}

function hwNewDay() {
  ask("يوم جديد", "راح تبدأ قائمة واجبات جديدة ليوم جديد. متأكد؟", "نعم").then(y => {
    if (!y) return;
    HWStore.reset();
    HW = HWStore.get();
    hwRender();
    toast("يوم جديد — حظ موفق! 🌅");
  });
}

function initHomework() {
  if (typeof h === "undefined" || typeof $ === "undefined") {
    setTimeout(initHomework, 80);
    return;
  }
  const addBtn = $("#hw-add-btn");
  if (addBtn) addBtn.addEventListener("click", hwAdd);
  const nameEl = $("#hw-name");
  if (nameEl) nameEl.addEventListener("keydown", e => { if (e.key === "Enter") hwAdd(); });
  const pagesEl = $("#hw-pages");
  if (pagesEl) pagesEl.addEventListener("keydown", e => { if (e.key === "Enter") hwAdd(); });
  const compBtn = $("#hw-complete-btn");
  if (compBtn) compBtn.addEventListener("click", hwComplete);
  const newBtn = $("#hw-new-day");
  if (newBtn) newBtn.addEventListener("click", hwNewDay);
  hwRender();
  console.log("✅ homework.js v3 — reveal مفعلة");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomework);
} else {
  initHomework();
}