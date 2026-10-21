(function () {
  "use strict";

  var METRIKA_ID = 107260844; // счётчик storyevent.ru; цели wed_* не использовать для оптимизации Директа без решения ML

  /* ---------------------------------------------------------------------- */
  /* Аналитика: события wed_* уходят в dataLayer и в Метрику, если она есть  */
  /* ---------------------------------------------------------------------- */
  window.dataLayer = window.dataLayer || [];
  function track(name, params) {
    var payload = Object.assign({ event: name }, params || {});
    window.dataLayer.push(payload);
    if (typeof window.ym === "function") {
      try { window.ym(METRIKA_ID, "reachGoal", name, params || {}); } catch (e) { /* счётчик не готов */ }
    }
    if (window.location.search.indexOf("debug=1") !== -1) console.log("[track]", name, payload);
  }

  document.querySelectorAll("[data-track]").forEach(function (el) {
    if (el.type === "submit") return; // клик по кнопке формы считается в обработчике отправки
    el.addEventListener("click", function () {
      var p = {};
      if (el.dataset.place) p.place = el.dataset.place;
      if (el.dataset.source) p.source = el.dataset.source;
      track(el.dataset.track, p);
    });
  });

  /* ---------------------------------------------------------------------- */
  /* Шапка, плавающая кнопка Telegram, мобильная панель                     */
  /* ---------------------------------------------------------------------- */
  var header = document.getElementById("siteHeader");
  var sticky = document.getElementById("stickyCta");
  var tgFloat = document.getElementById("tgFloat");
  var hero = document.getElementById("hero");
  var formSec = document.getElementById("form");
  var heroVisible = true, formVisible = false;

  // меню шапки (как на storyevent.ru): «Событие» и мобильная кнопка
  var dd = document.getElementById("hdrDd"), ddBtn = document.getElementById("hdrDdBtn");
  var burger = document.getElementById("hdrBurger"), menu = document.getElementById("hdrMenu");
  ddBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var open = dd.classList.toggle("open");
    ddBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", function (e) {
    if (!dd.contains(e.target)) { dd.classList.remove("open"); ddBtn.setAttribute("aria-expanded", "false"); }
  });
  burger.addEventListener("click", function () {
    var open = menu.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });

  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 4); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function updateFloating() {
    var on = !heroVisible && !formVisible;
    sticky.classList.toggle("is-on", on);
    tgFloat.classList.toggle("is-on", on);
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; updateFloating(); }, { threshold: 0.15 }).observe(hero);
    new IntersectionObserver(function (e) { formVisible = e[0].isIntersecting; updateFloating(); }, { threshold: 0.2 }).observe(formSec);

    // доскролл до формы: блок виден минимум наполовину не меньше секунды
    var scrollTimer = null, scrollSent = false;
    new IntersectionObserver(function (e) {
      if (scrollSent) return;
      if (e[0].isIntersecting) {
        scrollTimer = window.setTimeout(function () {
          scrollSent = true;
          track("wed_scroll_form", { device: window.innerWidth < 760 ? "mobile" : "desktop" });
        }, 1000);
      } else if (scrollTimer) { window.clearTimeout(scrollTimer); scrollTimer = null; }
    }, { threshold: 0.5 }).observe(formSec);
  } else {
    heroVisible = false; updateFloating();
  }

  /* ---------------------------------------------------------------------- */
  /* Фильм-монтаж: кадры дома → титр → пара → тёмный кадр → логотип → пара. */
  /* Таймлайн задан в CSS. Без JS и при «уменьшении движения» виден сразу   */
  /* финальный кадр.                                                        */
  /* ---------------------------------------------------------------------- */
  (function film() {
    var stage = document.getElementById("film");
    var pauseBtn = document.getElementById("filmPause");
    var replayBtn = document.getElementById("filmReplay");
    var skipBtn = document.getElementById("filmSkip");
    if (!stage || !pauseBtn || !replayBtn || !skipBtn) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { stage.classList.add("is-done"); return; }
    function setPaused(on) {
      stage.classList.toggle("is-paused", on);
      pauseBtn.textContent = on ? "Продолжить" : "Пауза";
      pauseBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    function setDone(on) { pauseBtn.hidden = on; skipBtn.hidden = on; replayBtn.hidden = !on; }
    function play() {
      runId++;
      stage.classList.remove("is-playing", "is-done");
      setPaused(false);
      setDone(false);
      void stage.offsetWidth; // перезапуск анимаций
      stage.classList.add("is-playing");
    }
    var runId = 0;
    function finish() { stage.classList.remove("is-playing"); stage.classList.add("is-done"); setPaused(false); setDone(true); }
    skipBtn.addEventListener("click", function () { finish(); track("wed_film_skip", {}); });
    // последний слой монтажа — кадр с парой: когда он проявился, фильм закончен и кадр остаётся
    stage.querySelector(".film-final").addEventListener("animationend", function () {
      if (stage.classList.contains("is-playing")) finish();
    });
    pauseBtn.addEventListener("click", function () { setPaused(!stage.classList.contains("is-paused")); });
    replayBtn.addEventListener("click", function () { play(); track("wed_film_replay", {}); });
    var started = false;
    function start() { if (!started) { started = true; play(); } }
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(start); window.setTimeout(start, 1500); } else { start(); }
  })();

  /* ---------------------------------------------------------------------- */
  /* Путь по дому: лента с прокруткой, стрелки, счётчик                     */
  /* ---------------------------------------------------------------------- */
  (function walk() {
    var rail = document.getElementById("walkRail");
    if (!rail) return;
    var prev = document.getElementById("walkPrev"), next = document.getElementById("walkNext");
    var items = rail.children, sent = false;
    function step() { return items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : rail.clientWidth; }
    function update() {
      prev.disabled = rail.scrollLeft <= 4;
      next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
    }
    function go(dir) {
      rail.scrollBy({ left: dir * step(), behavior: "smooth" });
      if (!sent) { sent = true; track("wed_walk_scroll", {}); }
    }
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    var raf = null;
    rail.addEventListener("scroll", function () {
      if (raf) return;
      raf = window.requestAnimationFrame(function () { raf = null; update(); });
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  })();

  /* ---------------------------------------------------------------------- */
  /* Пример сметы: число гостей → кейтеринг и итог                          */
  /* ---------------------------------------------------------------------- */
  (function estimate() {
    var box = document.querySelector(".est");
    if (!box) return;
    var rent = +box.getAttribute("data-rent"), per = +box.getAttribute("data-per"), pre = box.getAttribute("data-prefix") || "около";
    var title = document.getElementById("estTitle"), total = document.getElementById("estTotal");
    var cat = document.getElementById("estCat"), catSub = document.getElementById("estCatSub");
    var chips = document.querySelectorAll("#estChips li"), btns = box.querySelectorAll(".est-guests button");
    function rub(v) { return v.toLocaleString("ru-RU") + "\u00a0₽"; }
    function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
    function set(n) {
      title.innerHTML = esc(title.getAttribute("data-tpl").replace("{n}", n)).replace(/\*(.+?)\*/g, "<em>$1</em>");
      chips.forEach(function (c) { c.textContent = c.getAttribute("data-tpl").replace("{n}", n); });
      catSub.textContent = catSub.getAttribute("data-tpl").replace("{n}", n);
      cat.textContent = rub(n * per);
      total.textContent = rub(rent + n * per);
    }
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        set(+b.getAttribute("data-n"));
        track("wed_estimate_guests", { guests: +b.getAttribute("data-n") });
      });
    });
  })();

  /* ---------------------------------------------------------------------- */
  /* Форма записи — CRM-форма Битрикс24 №7 (как на storyevent.ru).          */
  /* Цель b24_form_submit с place=wedding — как у форм сайта.               */
  /* ---------------------------------------------------------------------- */
  // Гипотеза P: «Получить презентацию Story» — та же форма, но с заголовком про презентацию и своей целью
  var b24Box = document.getElementById("b24Wedding"), b24Fallback = document.getElementById("b24Fallback");
  var wantsPresentation = false;
  try { wantsPresentation = sessionStorage.getItem("wedPresentation") === "1"; } catch (e) { /* хранилище недоступно */ }
  var presBtn = document.getElementById("presentationBtn");
  function presentationMode() {
    var h = document.getElementById("formTitle"), s = document.getElementById("formSub");
    if (!h || !presBtn) return;
    h.innerHTML = presBtn.getAttribute("data-h2").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*(.+?)\*/g, "<em>$1</em>");
    s.textContent = presBtn.getAttribute("data-sub");
  }
  if (presBtn) presBtn.addEventListener("click", function () {
    wantsPresentation = true;
    try { sessionStorage.setItem("wedPresentation", "1"); } catch (e) { /* без хранилища — только до перезагрузки */ }
    presentationMode();
  });
  if (wantsPresentation) presentationMode();
  window.addEventListener("b24:form:send:success", function () {
    track("b24_form_submit", { form: "b24-crm-7", place: "wedding", intent: wantsPresentation ? "presentation" : "view" });
    if (wantsPresentation) track("wed_presentation_lead", { form: "b24-crm-7" });
    // после отправки формы ведём на Яндекс Диск; пауза нужна, чтобы цели Метрики успели уйти
    var next = b24Box && b24Box.getAttribute("data-after-submit");
    if (next) window.setTimeout(function () { window.location.href = next; }, 1200);
  });
  window.setTimeout(function () {
    // форма не отрисовалась (нет сети, блокировщик, превью без доступа к Битрикс24) — показываем телефон
    if (b24Box && !b24Box.querySelector(".b24-form")) { b24Box.style.minHeight = "0"; b24Fallback.hidden = false; }
  }, 6000);

  // Кнопки «Записаться на просмотр» ведут к форме: фокус в первое поле, когда форма загрузилась
  document.querySelectorAll("[data-goto-form]").forEach(function (el) {
    el.addEventListener("click", function () {
      if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) return;
      window.setTimeout(function () {
        var f = b24Box && b24Box.querySelector("input:not([type=hidden])");
        if (f) f.focus({ preventScroll: true });
      }, 700);
    });
  });
})();
