/* main.js — вся интерактивность лонгрида.
   Подключается в конце <body>, поэтому DOM уже готов. */
(function () {
  document.documentElement.classList.add("js");

  /* ---- 1. Предлоги и окончания предложений не остаются в одиночестве ----
     Собираем строку через вложенные inline-элементы, но не через блоки и br.
     Меняем только пробелы в исходных текстовых узлах: разметка, обработчики
     кнопок и документальные формулировки сохраняются. */
  var textRuns = [];
  function collectTextRuns(block) {
    var run = [];
    function flush() {
      if (run.some(function (node) { return /\S/.test(node.nodeValue); })) {
        textRuns.push(run);
      }
      run = [];
    }
    function visit(parent) {
      [].forEach.call(parent.childNodes, function (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          run.push(node);
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.namespaceURI !== "http://www.w3.org/1999/xhtml" ||
            /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(node.tagName) ||
            node.isContentEditable) return;
        if (node.tagName === "BR") {
          flush();
          return;
        }
        var display = getComputedStyle(node).display;
        if (display === "inline" || display === "contents") visit(node);
        else {
          flush();
          collectTextRuns(node);
        }
      });
    }
    visit(block);
    flush();
  }
  collectTextRuns(document.body);

  var prepositions = /(?<![\p{L}\p{N}_\-])(?:безо?|благодаря|близ|в|во|вблизи|вдоль|взамен|вместо|вне|внутри|вокруг|возле|вопреки|вроде|вслед|вследствие|для|до|за|из[-\u2011]за|из[-\u2011]под|изо?|к|ко|кроме|меж|между|на|навстречу|наподобие|насч[её]т|о|об|обо|около|от|ото|перед|передо|по|поверх|под|подо|позади|после|посреди|посредством|при|про|против|ради|с|со|сверх|сквозь|согласно|среди|у|через|чрез|а|и|но|да|или|либо|не|ни|in|on|at|to|for|of|from|by|with|without|a|an|the)(\s+)(?=\S)/giu;
  var compoundPrepositions = /(?<![\p{L}\p{N}_\-])(?:в\s+течение|в\s+продолжение|в\s+связи\s+с|в\s+отличие\s+от|в\s+зависимости\s+от|в\s+соответствии\s+с|в\s+целях|в\s+силу|за\s+сч[её]т|по\s+сравнению\s+с|по\s+отношению\s+к|по\s+мере|несмотря\s+на|невзирая\s+на|вместе\s+с|вслед\s+за|вплоть\s+до)\s+(?=\S)/giu;

  var sentenceSegmenter = typeof Intl.Segmenter === "function" ?
    new Intl.Segmenter("ru", {granularity: "sentence"}) : null;
  var shortWord = /^(?:[а-яё]{1,3}|тебе|тебя|меня|себе|себя|если|даже|лишь|пока|кому|куда|чему|этот|этой|этим|этом|того|тому|теми|свой|своя|своё|свои|весь|всех|всем|всей|всём|чтобы|когда|будто|словно|хотя|также|тоже|зато|есть|можно|нужно|надо|может)$/i;
  var afterWordParticle = /^(?:б|бы|ж|же|ли|ль)$/i;

  textRuns.forEach(function (nodes) {
    var text = nodes.map(function (node) { return node.nodeValue; }).join("");
    var chars = text.split("");
    function bindSpace(start, length) {
      chars[start] = "\u00A0";
      for (var i = start + 1; i < start + length; i++) chars[i] = "";
    }
    Array.from(text.matchAll(prepositions)).forEach(function (match) {
      bindSpace(match.index + match[0].length - match[1].length, match[1].length);
    });
    Array.from(text.matchAll(compoundPrepositions)).forEach(function (match) {
      Array.from(match[0].matchAll(/\s+/g)).forEach(function (space) {
        bindSpace(match.index + space.index, space[0].length);
      });
    });
    Array.from(text.matchAll(/\s+—/g)).forEach(function (match) {
      bindSpace(match.index, match[0].length - 1);
    });
    // Первый экран сохраняет согласованный авторский набор с явным br.
    // В остальных фразах защищаем короткие слова и последние два слова
    // предложения, включая подписи, заголовки, интерфейс и таблицу.
    if (!nodes.some(function (node) { return node.parentElement.closest(".hpromise h1"); })) {
      // HTML-переносы в исходнике отображаются пробелами, а не границами фраз.
      // Замена один к одному сохраняет индексы исходных текстовых узлов.
      var normalized = text.replace(/\s/g, " ");
      var sentences = sentenceSegmenter ? Array.from(sentenceSegmenter.segment(normalized)) :
        [{index: 0, segment: normalized}];
      sentences.forEach(function (sentence) {
        var words = Array.from(sentence.segment.matchAll(/[\p{L}\p{N}]+(?:[-/'’][\p{L}\p{N}]+)*/gu));
        if (words.length < 2) return;
        function keepPair(previous, next) {
          var start = previous.index + previous[0].length;
          var between = sentence.segment.slice(start, next.index);
          Array.from(between.matchAll(/\s+/g)).forEach(function (space) {
            bindSpace(sentence.index + start + space.index, space[0].length);
          });
        }
        words.forEach(function (word, i) {
          if (i + 1 < words.length && shortWord.test(word[0])) {
            keepPair(word, words[i + 1]);
          }
          // Частица сохраняет связь и с тем словом, к которому относится.
          if (i > 0 && afterWordParticle.test(word[0])) keepPair(words[i - 1], word);
        });
        keepPair(words[words.length - 2], words[words.length - 1]);
      });
    }
    var offset = 0;
    nodes.forEach(function (node) {
      var length = node.nodeValue.length;
      var value = chars.slice(offset, offset + length).join("");
      if (value !== node.nodeValue) node.nodeValue = value;
      offset += length;
    });
  });

  /* ---- общие ссылки ---- */
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cap = document.getElementById("z0"),
    hn = document.getElementById("hn"),
    spine = document.getElementById("spine");
  var pars = [].slice.call(document.querySelectorAll(".par"));
  var index = document.getElementById("idx");
  var links = [].slice.call(index.querySelectorAll("a"));
  var sections = links.map(function (link) {
    return document.querySelector(link.getAttribute("href"));
  });
  var visited = new Set(["z0"]);
  var returnTarget = null;
  var returnTimer = null;
  var activeSection = "z0";
  var manualLens = false;
  var automaticLensApplied = false;
  var analysisStart = document.getElementById("analysisStart");
  var turn = document.querySelector(".turn");
  var lensChoices = [].slice.call(document.querySelectorAll("[data-lens-choice]"));
  var lastN = -1,
    ticking = false;
  function docH() {
    return document.documentElement.scrollHeight - window.innerHeight;
  }

  /* Сохраняем видимый абзац/иллюстрацию, а не абсолютный процент страницы.
     Вступительная sticky-сцена имеет неизменную высоту и не требует поправки. */
  function readingAnchor() {
    if (cap.getBoundingClientRect().bottom > innerHeight) return null;
    var candidates = [].slice.call(document.querySelectorAll(
      ".txt > .zh, .txt > .lede, .txt > .body-note, .frame, .study .lead, " +
      ".svc, .marks .m, .turn h2, .turn .q, #lensPrompt, .exit p"
    ));
    var visible = candidates.filter(function (element) {
      var rect = element.getBoundingClientRect();
      return rect.bottom > 105 && rect.top < innerHeight && rect.height > 0;
    });
    visible.sort(function (a, b) {
      return Math.abs(a.getBoundingClientRect().top - innerHeight * 0.3) -
        Math.abs(b.getBoundingClientRect().top - innerHeight * 0.3);
    });
    if (visible[0]) return {element: visible[0], top: visible[0].getBoundingClientRect().top};
    // Если читатель находится внутри закрываемого комментария, возвращаем
    // заголовок именно этого раздела, а не перескакиваем в соседнюю эпоху.
    var section = sections.find(function (element) {
      var rect = element.getBoundingClientRect();
      return rect.top < innerHeight * 0.5 && rect.bottom > innerHeight * 0.5;
    });
    var heading = section && section.querySelector(".zh");
    return heading ? {element: heading, top: 110} : null;
  }
  function chooseLens(next, manual) {
    if (manual) manualLens = true;
    var root = document.documentElement;
    if (root.dataset.lens === next) return;
    var anchor = readingAnchor();
    root.style.overflowAnchor = "none";
    root.dataset.lens = next;
    lensChoices.forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.lensChoice === next));
    });
    if (anchor) {
      var previousScroll = scrollY;
      var delta = anchor.element.getBoundingClientRect().top - anchor.top;
      if (Math.abs(delta) > 0.5) scrollTo({top: previousScroll + delta, behavior: "instant"});
      // Колесо продолжает движение от сохранённого участка после перерасчёта.
      dispatchEvent(new CustomEvent("longread:layoutshift", {
        detail: {delta: scrollY - previousScroll}
      }));
    }
    requestAnimationFrame(function () {
      root.style.removeProperty("overflow-anchor");
      onScroll();
    });
  }
  lensChoices.forEach(function (button) {
    button.addEventListener("click", function () {
      chooseLens(button.dataset.lensChoice, true);
    });
    button.addEventListener("keydown", function (event) {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      var buttons = [].slice.call(button.parentElement.querySelectorAll("button"));
      var next = event.key === "Home" ? buttons[0] : event.key === "End" ? buttons[1] :
        buttons[(buttons.indexOf(button) + 1) % buttons.length];
      next.focus();
      next.click();
    });
  });

  function finishReturn() {
    returnTarget = null;
    clearTimeout(returnTimer);
  }
  links.forEach(function (link) {
    link.addEventListener("click", function () {
      returnTarget = document.querySelector(link.getAttribute("href"));
      clearTimeout(returnTimer);
      // Даже при прерывании нативной прокрутки блокировка не остаётся навсегда.
      returnTimer = setTimeout(finishReturn, 2500);
    });
  });
  addEventListener("wheel", finishReturn, {passive: true});
  addEventListener("touchstart", finishReturn, {passive: true});
  addEventListener("keydown", function (event) {
    if (["PageDown", "PageUp", "ArrowDown", "ArrowUp", "Escape"].includes(event.key)) finishReturn();
  });

  function updateTrail(vh) {
    var current = "z0";
    sections.forEach(function (section, i) {
      var rect = section.getBoundingClientRect();
      // Достаточно увидеть начало или оказаться внутри содержимого раздела.
      // Его пустые внешние отступы и пропущенные при прыжке эпохи не считаются
      // посещением; возврат по якорю не открывает промежуточные разделы.
      var heading = section.querySelector(".zhead") || section;
      var head = heading.getBoundingClientRect();
      var content = section.querySelector(".ed") || section;
      if (!returnTarget && head.top <= vh * 0.65 &&
          content.getBoundingClientRect().bottom >= 95) {
        visited.add(section.id);
      }
      if (rect.top <= vh * 0.45 && visited.has(section.id)) current = section.id;
      links[i].hidden = !visited.has(section.id);
    });
    links.forEach(function (link) {
      var active = link.getAttribute("href") === "#" + current;
      link.classList.toggle("on", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    if (activeSection !== current) {
      activeSection = current;
      var activeLink = index.querySelector('[aria-current="location"]');
      if (activeLink && index.scrollWidth > index.clientWidth) {
        var left = activeLink.offsetLeft;
        var right = left + activeLink.offsetWidth;
        if (left < index.scrollLeft) index.scrollLeft = left;
        else if (right > index.scrollLeft + index.clientWidth) {
          index.scrollLeft = right - index.clientWidth;
        }
      }
    }
    if (returnTarget) {
      clearTimeout(returnTimer);
      returnTimer = setTimeout(finishReturn, 180);
    }
  }

  /* ---- 2. Скролл: hero-захват, спайн, прогресс, параллакс ---- */
  function frame() {
    ticking = false;
    var vh = window.innerHeight;

    // Первый проход: сначала весь вступительный эпизод, затем разбор.
    // Любой ручной выбор, в том числе уже активного «Обещания», имеет приоритет.
    if (!manualLens && !automaticLensApplied &&
        analysisStart.getBoundingClientRect().top <= vh * 0.65) {
      automaticLensApplied = true;
      chooseLens("architecture", false);
    }

    // прогресс «захвата» в hero (0..1)
    var r = cap.getBoundingClientRect(),
      total = cap.offsetHeight - vh;
    var p = Math.min(1, Math.max(0, -r.top / total));
    cap.querySelector(".stage").style.setProperty("--p", p.toFixed(4));
    // Шапка читается и на тёмной вступительной сцене в светлой оптике.
    var turnRect = turn.getBoundingClientRect();
    document.documentElement.classList.toggle("reading-dark",
      (r.bottom > 95 && p > 0.62) || (turnRect.top <= 95 && turnRect.bottom > 95));
    var navLine = innerWidth >= 1440 ? vh * 0.5 : 95;
    index.classList.toggle("is-dark", (r.bottom > navLine && p > 0.62) ||
      (turnRect.top <= navLine && turnRect.bottom > navLine));

    // счётчик дней в hero набегает от скролла
    var cp = Math.min(1, Math.max(0, (p - 0.34) / (0.85 - 0.34)));
    var n = Math.round(cp * 46);
    if (n !== lastN) {
      hn.textContent = n;
      lastN = n;
    }

    // общий прогресс: спайн справа
    var g = Math.min(1, Math.max(0, window.scrollY / docH()));
    if (spine) spine.style.setProperty("--prog", (g * 100).toFixed(1) + "%");

    updateTrail(vh);

    // параллакс декоративных годов
    if (!reduce) {
      pars.forEach(function (el) {
        var b = el.getBoundingClientRect();
        var off = b.top + b.height / 2 - vh / 2;
        var sp = parseFloat(el.getAttribute("data-speed") || ".07");
        el.style.transform =
          "translate3d(0," + (-off * sp).toFixed(1) + "px,0)";
      });
    }
  }
  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll, { passive: true });
  addEventListener("load", onScroll);
  frame();

  /* ---- 4. Цепочка-стрик в карточке-модели (45 дней + 1 разрыв) ---- */
  var chain = document.getElementById("svcchain");
  if (chain) {
    var h = "";
    for (var k = 0; k < 20; k++) h += "<i></i>";
    h += '<i class="brk"></i>';
    chain.innerHTML = h;
  }

  /* ---- 5. Счётчик в карточке набегает при появлении (метрика, которая тебя измеряет) ---- */
  var svcnum = document.getElementById("svcnum"),
    counted = false;
  function countUp(el, to) {
    if (reduce) {
      el.textContent = to;
      return;
    }
    var st = null;
    function step(ts) {
      if (!st) st = ts;
      var p = Math.min(1, (ts - st) / 1100);
      el.textContent = Math.round(p * to);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---- 6. Появление текста; фотографии имеют независимый fade-in ниже ---- */
  var io = new IntersectionObserver(
    function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          if (
            e.target.querySelector &&
            e.target.querySelector("#svcnum") &&
            !counted
          ) {
            counted = true;
            countUp(svcnum, 47);
          }
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.14 },
  );
  document.querySelectorAll(".reveal").forEach(function (el) {
    io.observe(el);
  });

})();

/* Фотографии: одинаково при первой загрузке, из кеша и после возврата назад.
   Без JS / IntersectionObserver и при reduced motion фото видны сразу. */
(function () {
  if (
    !("IntersectionObserver" in window) ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) return;

  var photos = [].slice.call(document.querySelectorAll(".frame .ph img"));
  var states = new WeakMap();
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var state = states.get(entry.target);
      state.visible = entry.isIntersecting;
      reveal(entry.target, state);
    });
  }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });

  function reveal(img, state) {
    if (!state.ready || !state.visible || state.shown) return;
    state.shown = true;
    observer.unobserve(img);
    // Два кадра разделяют исходную прозрачность и начало перехода,
    // в том числе если изображение уже было в кеше при запуске скрипта.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        img.classList.add("is-visible");
      });
    });
  }

  photos.forEach(function (img) {
    var state = { ready: false, visible: false, shown: false };
    states.set(img, state);
    function ready() {
      state.ready = true;
      reveal(img, state);
    }
    function loaded() {
      if (img.decode) img.decode().then(ready, ready);
      else ready();
    }
    function failed() {
      state.shown = true;
      img.classList.remove("photo-fade");
      observer.unobserve(img);
    }
    // Подписка до проверки complete исключает пропущенный load из кеша.
    img.addEventListener("load", loaded, { once: true });
    img.addEventListener("error", failed, { once: true });
    img.classList.add("photo-fade");
    observer.observe(img);
    if (img.complete) {
      if (img.naturalWidth) loaded();
      else failed();
    }
  });

  addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    photos.forEach(function (img) {
      var state = states.get(img);
      if (state.shown) return;
      var rect = img.getBoundingClientRect();
      state.visible = rect.bottom > 0 && rect.top < innerHeight - 24 &&
        rect.right > 0 && rect.left < innerWidth;
      if (img.complete && img.naturalWidth) {
        state.ready = true;
        reveal(img, state);
      }
    });
  });
})();

/* ===== «выход, который не выпускает» ===== */
(function () {
  var modal = document.getElementById("trapModal");
  if (modal) {
    var steps = modal.querySelectorAll(".trap-step");
    function show(n) {
      steps.forEach(function (s) {
        s.classList.toggle("on", s.getAttribute("data-step") === String(n));
      });
    }
    function open() {
      show(1);
      modal.classList.add("open");
    }
    function close() {
      modal.classList.remove("open");
    }
    var openBtn = document.getElementById("trapOpen");
    if (openBtn) openBtn.addEventListener("click", open);
    var x = document.getElementById("trapX");
    if (x) x.addEventListener("click", close);
    modal.addEventListener("click", function (e) {
      var go = e.target.getAttribute && e.target.getAttribute("data-go");
      if (go === "close") close();
      else if (go) show(go);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }
  var realBtn = document.getElementById("realExit"),
    realDone = document.getElementById("realDone");
  if (realBtn && realDone) {
    realBtn.addEventListener("click", function () {
      realBtn.style.display = "none";
      realDone.hidden = false;
    });
  }
})();

/* Кольцо и точка: только для мыши, с инверсией настоящего фона под SVG. */
(function () {
  if (!(window.CSS && CSS.supports("mix-blend-mode", "difference")) ||
      !("PointerEvent" in window)) return;

  var mouse = matchMedia("(hover: hover) and (pointer: fine)");
  var root = document.documentElement;
  var cursor = document.createElement("div");
  cursor.className = "custom-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" focusable="false">' +
    '<circle class="cursor-ring" cx="32" cy="32" r="9" fill="none" stroke="#fff" stroke-width="0.6" vector-effect="non-scaling-stroke" />' +
    '<circle cx="32" cy="32" r="1.5" fill="#fff" /></svg>';
  document.body.appendChild(cursor);

  var x = 0, y = 0, inside = false, pending = null;
  function hide() {
    inside = false;
    if (pending !== null) cancelAnimationFrame(pending);
    pending = null;
    cursor.classList.remove("is-visible", "is-hovered");
    root.classList.remove("has-custom-cursor");
  }
  function draw() {
    pending = null;
    if (!inside || !mouse.matches) return;
    var target = document.elementFromPoint(x, y);
    var control = target && target.closest("a[href], button, [role='button'], summary");
    // «Продолжить путь» — часть авторской модели, а не действующий переход.
    var clickable = control && !control.matches(":disabled, .svc .cont") &&
      !control.closest("[inert], [aria-disabled='true']");
    cursor.style.transform = "translate3d(" + (x - 32) + "px," + (y - 32) + "px,0)";
    cursor.classList.toggle("is-hovered", !!clickable);
    cursor.classList.add("is-visible");
    // Системный указатель скрывается только после первого отрисованного положения.
    root.classList.add("has-custom-cursor");
  }
  function requestDraw() {
    if (inside && mouse.matches && pending === null) {
      pending = requestAnimationFrame(draw);
    }
  }
  document.addEventListener("pointermove", function (event) {
    if (!mouse.matches || event.pointerType !== "mouse" ||
        event.clientX < 0 || event.clientY < 0 ||
        event.clientX >= innerWidth || event.clientY >= innerHeight) {
      hide();
      return;
    }
    x = event.clientX;
    y = event.clientY;
    inside = true;
    requestDraw();
  }, { passive: true });
  document.addEventListener("pointerout", function (event) {
    if (!event.relatedTarget) hide();
  }, { passive: true });
  document.addEventListener("pointerdown", function (event) {
    if (event.pointerType !== "mouse") hide();
  }, { passive: true });
  document.addEventListener("pointercancel", hide, { passive: true });
  document.addEventListener("scroll", requestDraw, { capture: true, passive: true });
  document.addEventListener("click", requestDraw, { passive: true });
  document.addEventListener("contextmenu", hide);
  document.addEventListener("keydown", function (event) {
    if (event.key === "Tab") hide();
    else requestDraw();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) hide();
  });
  addEventListener("blur", hide);
  addEventListener("pagehide", hide);
  addEventListener("pageshow", hide);
  addEventListener("resize", hide, { passive: true });
  if (mouse.addEventListener) mouse.addEventListener("change", hide);
  else mouse.addListener(hide);

  // Обновляем hover и без движения мыши: при открытии окна или разблокировке ссылок.
  new MutationObserver(function (records) {
    if (records.some(function (record) { return !cursor.contains(record.target); })) {
      requestDraw();
    }
  }).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "hidden", "disabled", "aria-disabled", "href", "inert"]
  });
})();

/* Мягкое колесо: прокручивается само окно, без transform-обёртки страницы. */
(function () {
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");
  var mouse = matchMedia("(hover: hover) and (pointer: fine)");
  var pending = null, target = 0, position = 0, previousTime = 0, direction = 0;

  function stop() {
    if (pending !== null) cancelAnimationFrame(pending);
    pending = null;
    direction = 0;
  }
  function limit(value) {
    return Math.max(0, Math.min(value,
      document.documentElement.scrollHeight - innerHeight));
  }
  function step(time) {
    var elapsed = Math.min(48, Math.max(0, time - previousTime));
    previousTime = time;
    target = limit(target);
    var distance = target - position;
    if (Math.abs(distance) < 0.5) {
      scrollTo({ top: target, behavior: "instant" });
      pending = null;
      direction = 0;
      return;
    }
    position += distance * (1 - Math.exp(-elapsed / 85));
    scrollTo({ top: position, behavior: "instant" });
    pending = requestAnimationFrame(step);
  }
  function hasInnerScroll(element) {
    for (var node = element; node && node !== document.body &&
         node !== document.documentElement; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 1 &&
          /^(auto|scroll|overlay)$/.test(getComputedStyle(node).overflowY)) return true;
    }
    return false;
  }
  addEventListener("longread:layoutshift", function (event) {
    if (pending !== null) {
      position += event.detail.delta;
      target = limit(target + event.detail.delta);
    }
  });
  addEventListener("wheel", function (event) {
    var element = event.target instanceof Element ? event.target : null;
    if (event.defaultPrevented || !event.cancelable || reduce.matches || !mouse.matches ||
        event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        !event.deltaY || document.querySelector(".trap.open") ||
        (element && (element.closest("input, textarea, select, [contenteditable='true']") ||
          hasInnerScroll(element)))) {
      stop();
      return;
    }
    var unit = event.deltaMode === 1 ? parseFloat(getComputedStyle(document.body).lineHeight) :
      event.deltaMode === 2 ? innerHeight : 1;
    var delta = event.deltaY * unit;
    var nextDirection = delta > 0 ? 1 : -1;
    // Разворот колеса действует сразу, без накопленной инерции в прежнюю сторону.
    var base = pending === null || direction !== nextDirection ? scrollY : target;
    if (pending === null || direction !== nextDirection) position = scrollY;
    target = limit(base + delta);
    if (pending === null && Math.abs(target - scrollY) < 0.5) return;
    event.preventDefault();
    direction = nextDirection;
    if (pending === null) {
      previousTime = performance.now();
      pending = requestAnimationFrame(step);
    }
  }, { passive: false });

  // Нативные якоря, клавиатура, scrollbar и touch сразу получают управление.
  addEventListener("pointerdown", stop, { passive: true });
  addEventListener("touchstart", stop, { passive: true });
  addEventListener("keydown", stop);
  addEventListener("click", stop, { passive: true });
  addEventListener("resize", stop, { passive: true });
  addEventListener("blur", stop);
  addEventListener("pagehide", stop);
  addEventListener("popstate", stop);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
  });
  [reduce, mouse].forEach(function (media) {
    if (media.addEventListener) media.addEventListener("change", stop);
    else media.addListener(stop);
  });
})();
