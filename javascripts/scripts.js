/* scripts.js — вся интерактивность лонгрида.
   Подключается в конце <body>, поэтому DOM уже готов. */
(function () {
  /* ---- 1. Запрет висячих предлогов ----
     привязываем короткие слова и тире неразрывным пробелом по всему тексту */
  function bind(s) {
    s = s.replace(/ +—/g, "\u00A0—");
    var re =
      /(^|[\s(«"„])([A-Za-zА-Яа-яЁё\u0400-\u04FF]{1,2}|для|при|как|что|или|это|его|её|их|так|под|над|без|про|ещё|уже|чем|был|была|были|быть|нас|вас|них|там|где|кто|тот|эта|эти)\s+/g;
    for (var k = 0; k < 3; k++) {
      s = s.replace(re, function (m, a, b) {
        return a + b + "\u00A0";
      });
    }
    return s;
  }
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      var p = n.parentNode ? n.parentNode.nodeName : "";
      if (p === "SCRIPT" || p === "STYLE") return NodeFilter.FILTER_REJECT;
      return /\S\s\S/.test(n.nodeValue)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });
  var nodes = [],
    cur;
  while ((cur = walker.nextNode())) nodes.push(cur);
  nodes.forEach(function (n) {
    var v = bind(n.nodeValue);
    if (v !== n.nodeValue) n.nodeValue = v;
  });

  /* ---- общие ссылки ---- */
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cap = document.getElementById("z0"),
    hn = document.getElementById("hn"),
    spine = document.getElementById("spine");
  var pars = [].slice.call(document.querySelectorAll(".par"));
  var lastN = -1,
    ticking = false;
  function docH() {
    return document.documentElement.scrollHeight - window.innerHeight;
  }

  /* ---- 2. Скролл: hero-захват, спайн, прогресс, параллакс ---- */
  function frame() {
    ticking = false;
    var vh = window.innerHeight;

    // прогресс «захвата» в hero (0..1)
    var r = cap.getBoundingClientRect(),
      total = cap.offsetHeight - vh;
    var p = Math.min(1, Math.max(0, -r.top / total));
    cap.querySelector(".stage").style.setProperty("--p", p.toFixed(4));

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
  frame();

  /* ---- 3. Тумблер оптики (обещание ⇄ устройство = инверсия) ---- */
  document.getElementById("lensBtn").addEventListener("click", function () {
    var c = document.documentElement.getAttribute("data-lens"),
      next = c === "promise" ? "architecture" : "promise";
    document.documentElement.setAttribute("data-lens", next);
    var on = document.querySelector(".pr-on"),
      off = document.querySelector(".ar-on");
    if (next === "architecture") {
      on.classList.replace("on", "off");
      off.classList.replace("off", "on");
    } else {
      on.classList.replace("off", "on");
      off.classList.replace("on", "off");
    }
  });

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

  /* ---- 6. Появление блоков + wipe-проявление кадров при скролле ---- */
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
  document.querySelectorAll(".reveal,.frame.wipe").forEach(function (el) {
    io.observe(el);
  });

  /* ---- 7. Подсветка активной эпохи в индексе ---- */
  var links = [].slice.call(document.querySelectorAll(".index a"));
  var ids = links.map(function (a) {
    return document.querySelector(a.getAttribute("href"));
  });
  var io2 = new IntersectionObserver(
    function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          var i = ids.indexOf(e.target);
          links.forEach(function (l) {
            l.classList.remove("on");
          });
          if (links[i]) links[i].classList.add("on");
        }
      });
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  ids.forEach(function (s) {
    if (s) io2.observe(s);
  });
})();
