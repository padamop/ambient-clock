/* Art Frame: shared code for the browser page (index.html) and the Samsung TV app.
 *
 * The app sets window.ARTFRAME_APP = true and window.ARTFRAME_BASE to this site's URL before
 * loading this file, and may provide window.MY_PHOTOS (kept inside the app, never on the site).
 */
window.ARTFRAME_PAGE = 6;   // bump with PAGE_MIN in build_manifest.py when this code changes

(function () {
  "use strict";

  var BASE = window.ARTFRAME_BASE || "";
  var IS_APP = !!window.ARTFRAME_APP;
  var BUILD = window.ART_BUILD || "";
  var LABEL_MS = 40 * 1000;

  function $(id) { return document.getElementById(id); }
  function url(p, local) { return (local || /^(https?:|data:|blob:|file:)/.test(p)) ? p : BASE + p; }
  function load(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k)); return (v === null || v === undefined) ? d : v; }
    catch (e) { return d; }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  // ---------------------------------------------------------------- page structure
  document.body.insertAdjacentHTML("beforeend",
    '<div id="slides"></div>' +
    '<div class="edge"></div>' +
    '<div class="tone" id="tone"></div>' +
    '<div class="dim" id="dim"></div>' +
    '<div class="nav l" id="navL">&#8249;</div>' +
    '<div class="nav r" id="navR">&#8250;</div>' +
    '<div class="menu" id="menu"></div>' +
    '<div class="sleep" id="sleep"></div>' +
    '<div class="toast" id="toast"></div>' +
    '<div class="hint" id="hint">Press OK on the remote for full screen</div>');

  // ---------------------------------------------------------------- settings
  var DEFAULTS = {
    border: 8, mat: "auto", style: "flat", brightness: 100, tone: 0,
    every: 10, order: "shuffle", collection: "all",
    offFrom: -1, onAt: 7, nightDim: true, labels: true
  };
  var S = load("artframe.settings", {});
  var legacyBorder = load("artframe.border", null);
  if (!has(S, "border") && typeof legacyBorder === "number") S.border = legacyBorder;
  for (var dk in DEFAULTS) if (has(DEFAULTS, dk) && !has(S, dk)) S[dk] = DEFAULTS[dk];

  // URL settings override for this visit only (e.g. ?border=0&every=30&label=0&night=0)
  var params = {};
  location.search.replace(/^\?/, "").split("&").forEach(function (kv) {
    if (!kv) return;
    var p = kv.split("=");
    params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
  });
  var OVERRIDE = {};
  if (params.border !== undefined && params.border !== "") OVERRIDE.border = Math.min(15, Math.max(0, parseFloat(params.border) || 0));
  if (params.every) OVERRIDE.every = Math.max(1, parseFloat(params.every) || 10);
  if (params.label === "0") OVERRIDE.labels = false;
  if (params.night === "0") OVERRIDE.nightDim = false;

  function get(k) { return has(OVERRIDE, k) ? OVERRIDE[k] : S[k]; }
  function set(k, v) { S[k] = v; delete OVERRIDE[k]; save("artframe.settings", S); }

  // ---------------------------------------------------------------- artwork + photos
  var ART = window.ART || [];
  var PHOTOS = (window.MY_PHOTOS || []).map(function (p) {
    var ar = p.w / p.h;
    return {
      src: p.src, local: true, title: p.title || "", artist: p.artist || "My photos", date: p.date || "",
      w: p.w, h: p.h, fit: (ar >= 1.55 && ar <= 2.2) ? "fill" : "mat", mat: p.mat || "white", c: "photos", m: ""
    };
  });
  var BY_SRC = {};
  function indexItems() {
    BY_SRC = {};
    ART.concat(PHOTOS).forEach(function (it) { BY_SRC[it.src] = it; });
  }
  indexItems();

  var favs = load("artframe.favs", []);
  function isFav(it) { return !!it && favs.indexOf(it.src) >= 0; }
  function setFav(it, on) {
    if (!it) return;
    var i = favs.indexOf(it.src);
    if (on && i < 0) favs.push(it.src);
    if (!on && i >= 0) favs.splice(i, 1);
    save("artframe.favs", favs);
  }

  var COLLECTIONS = [
    { id: "all", name: "All artwork", test: function (it) { return it.c !== "photos"; } },
    { id: "fav", name: "Favorites", test: isFav },
    { id: "land", name: "Landscapes" },
    { id: "sea", name: "Sea & coast" },
    { id: "cities", name: "Towns & cities" },
    { id: "people", name: "People" },
    { id: "still", name: "Still life" },
    { id: "ink", name: "Asian ink" },
    { id: "photos", name: "My photos" },
    { id: "everything", name: "Art + my photos", test: function () { return true; } }
  ];
  function collection(id) {
    for (var i = 0; i < COLLECTIONS.length; i++) if (COLLECTIONS[i].id === id) return COLLECTIONS[i];
    return COLLECTIONS[0];
  }
  function itemsIn(id) {
    var col = collection(id);
    var test = col.test || function (it) { return it.c === col.id; };
    return ART.concat(PHOTOS).filter(test);
  }
  function collectionChoices() {
    return COLLECTIONS.filter(function (c) {
      if (c.id === "photos" || c.id === "everything") return PHOTOS.length > 0;
      return c.id === "fav" || itemsIn(c.id).length > 0;
    }).map(function (c) { return c.id; });
  }

  // ---------------------------------------------------------------- the deck (play order)
  function shuffle(a) {
    for (var j = a.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = a[j]; a[j] = a[k]; a[k] = t;
    }
    return a;
  }
  function deckKey() { return [get("collection"), get("order"), BUILD, PHOTOS.length].join("|"); }
  var deck = load("artframe.deck2", null);

  function rebuildDeck(keepSrc) {
    var items = itemsIn(get("collection"));
    if (!items.length) {
      if (get("collection") === "fav") toast("No favorites yet — showing all artwork");
      items = itemsIn("all");
    }
    var srcs = items.map(function (it) { return it.src; });
    if (get("order") === "shuffle") shuffle(srcs);
    var pos = keepSrc ? Math.max(0, srcs.indexOf(keepSrc)) : 0;
    deck = { key: deckKey(), order: srcs, pos: pos };
    save("artframe.deck2", deck);
  }
  function deckValid() {
    if (!deck || !deck.order || !deck.order.length || deck.key !== deckKey()) return false;
    for (var i = 0; i < deck.order.length; i++) if (!BY_SRC[deck.order[i]]) return false;
    return deck.pos >= 0 && deck.pos < deck.order.length;
  }
  function currentItem() { return deck ? BY_SRC[deck.order[deck.pos]] : null; }
  function advance(dir) {
    deck.pos += dir;
    if (deck.pos >= deck.order.length) {
      var last = deck.order[deck.order.length - 1];
      if (get("order") === "shuffle") {
        shuffle(deck.order);
        if (deck.order[0] === last && deck.order.length > 1) deck.order.push(deck.order.shift());
      }
      deck.pos = 0;
    }
    if (deck.pos < 0) deck.pos = deck.order.length - 1;
    save("artframe.deck2", deck);
    return currentItem();
  }

  // ---------------------------------------------------------------- slides
  var MATS = {
    white:    { bg: "#ebe8e2", bevel: "#f7f5f0", edge: "rgba(0,0,0,0.10)", ink: "#3b3833" },
    linen:    { bg: "#e3dbcd", bevel: "#f2ede4", edge: "rgba(0,0,0,0.10)", ink: "#463f35" },
    gray:     { bg: "#8e8b86", bevel: "#a7a49e", edge: "rgba(0,0,0,0.20)", ink: "#f4f1ec" },
    charcoal: { bg: "#2a2825", bevel: "#3d3a36", edge: "rgba(0,0,0,0.35)", ink: "#d9d4cb" },
    black:    { bg: "#121212", bevel: "#262626", edge: "rgba(0,0,0,0.45)", ink: "#d8d4cd" },
    night:    { bg: "#1c222a", bevel: "#2f3742", edge: "rgba(0,0,0,0.35)", ink: "#d3d9e0" }
  };
  var MAT_CHOICE = { white: "white", warm: "linen", gray: "gray", black: "black", navy: "night" };
  function matFor(it) {
    var m = get("mat");
    return MATS[m === "auto" ? it.mat : MAT_CHOICE[m]] || MATS.white;
  }

  var host = $("slides");
  var current = null;
  var labelTimer = null;

  function fitBox(it) {
    // non-screen-shaped art: fit inside the mat (86% of the height at most)
    var vw = window.innerWidth, vh = window.innerHeight;
    var ar = it.w / it.h;
    var maxH = vh * 0.86;
    var maxW = Math.min(vw * 0.94, vw - (vh - maxH));
    var w = maxW, h = w / ar;
    if (h > maxH) { h = maxH; w = h * ar; }
    return { w: Math.round(w), h: Math.round(h), left: Math.round((vw - w) / 2), top: Math.round((vh - h) / 2 - vh * 0.008) };
  }

  function layout(slide) {
    if (!slide || !slide.item || !slide.matted) return;
    var vw = window.innerWidth, vh = window.innerHeight;
    var b;
    if (slide.item.fit === "fill") {
      var p = Math.round(vh * get("border") / 100);
      b = { left: p, top: p, w: vw - 2 * p, h: vh - 2 * p };
    } else {
      b = fitBox(slide.item);
    }
    var art = slide.querySelector(".art");
    art.style.width = b.w + "px";
    art.style.height = b.h + "px";
    art.style.left = b.left + "px";
    art.style.top = b.top + "px";
    var label = slide.querySelector(".label");
    var below = vh - (b.top + b.h);
    if (below >= vh * 0.035) {
      label.classList.remove("card");
      label.style.top = (b.top + b.h + below / 2) + "px";
    } else {
      label.classList.add("card");
      label.style.top = "";
    }
  }

  function buildSlide(it, img) {
    var s = document.createElement("div");
    var matted = it.fit !== "fill" || get("border") > 0;
    s.className = "slide " + (matted ? "mat" : "fill") + (matted && get("style") === "shadowbox" ? " shadowbox" : "");
    s.item = it;
    s.matted = matted;
    var art = document.createElement("div");
    art.className = "art";
    art.appendChild(img);
    var artGrain = document.createElement("div");
    artGrain.className = "grain art-grain";
    art.appendChild(artGrain);
    if (matted) {
      var m = matFor(it);
      s.style.backgroundColor = m.bg;
      s.style.setProperty("--bevel", m.bevel);
      s.style.setProperty("--bevel-edge", m.edge);
      s.style.setProperty("--bevel-w", get("style") === "shadowbox" ? "0.9vmin" : "0.55vmin");
      s.style.color = m.ink;
      var paper = document.createElement("div");
      paper.className = "grain";
      s.appendChild(paper);
    }
    s.appendChild(art);

    var label = document.createElement("div");
    label.className = "label";
    var a = document.createElement("span");
    a.className = "artist";
    a.textContent = it.artist;
    var sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "·";
    var w = document.createElement("span");
    w.className = "work";
    w.textContent = it.title + (it.date ? ", " + it.date : "");
    label.appendChild(a);
    if (it.title || it.date) { label.appendChild(sep); label.appendChild(w); }
    s.appendChild(label);
    return s;
  }

  function showLabel(slide, now) {
    if (!get("labels") || !slide) return;
    var label = slide.querySelector(".label");
    clearTimeout(labelTimer);
    setTimeout(function () { label.classList.add("show"); }, now ? 0 : 2500);
    labelTimer = setTimeout(function () { label.classList.remove("show"); }, LABEL_MS);
  }
  function hideLabel() {
    if (current) current.querySelector(".label").classList.remove("show");
  }

  // mode: undefined = slow ambient crossfade, "nav" = quicker fade for remote changes,
  // "fast" = near-instant re-render of the same artwork (setting changes)
  var busy = false;
  var pendingRerender = false;
  function show(it, attempts, mode) {
    if (!it) return;
    if (busy) { if (mode === "fast") pendingRerender = true; return; }
    busy = true;
    attempts = attempts || 0;
    var dur = mode === "fast" ? "0.5s" : (mode === "nav" ? "1.2s" : "");
    var img = new Image();
    img.alt = it.title;
    img.onload = function () {
      var go = function () {
        var s = buildSlide(it, img);
        if (dur) s.style.transition = "opacity " + dur + " ease";
        host.appendChild(s);
        layout(s);
        void s.offsetWidth;
        s.classList.add("on");
        if (current) {
          var old = current;
          if (dur) old.style.transition = "opacity " + dur + " ease";
          old.classList.remove("on");
          setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 4000);
        }
        current = s;
        document.body.style.background = s.matted ? matFor(it).bg : "#000";
        if (mode !== "fast" && !menuOpen) showLabel(s);
        if (menuOpen) renderMenu();
        busy = false;
        if (pendingRerender) { pendingRerender = false; rerender(); }
      };
      if (img.decode) img.decode().then(go, go); else go();
    };
    img.onerror = function () {
      busy = false;
      if (attempts < 5) show(advance(1), attempts + 1, mode);
    };
    img.src = url(it.src, it.local);
  }
  function rerender() { if (current && current.item) show(current.item, 0, "fast"); }

  // ---------------------------------------------------------------- rotation, pause
  var timer = null;
  var paused = false;
  function schedule() {
    clearInterval(timer);
    timer = setInterval(function () {
      if (paused || menuOpen || sleeping) return;
      show(advance(1));
    }, get("every") * 60 * 1000);
  }

  // ---------------------------------------------------------------- brightness, tone, night dim
  var TONES = { "-2": "#d3e1ff", "-1": "#e7eeff", "1": "#fff0dc", "2": "#ffe1bd" };
  function nightHours() { var h = new Date().getHours(); return h >= 23 || h < 6; }
  function updateOverlays() {
    var level = (get("brightness") / 100) * (get("nightDim") && nightHours() ? 0.68 : 1);
    $("dim").style.opacity = (1 - level).toFixed(3);
    var t = String(get("tone"));
    if (TONES[t]) { $("tone").style.backgroundColor = TONES[t]; $("tone").style.opacity = "1"; }
    else { $("tone").style.opacity = "0"; }
  }

  // ---------------------------------------------------------------- art hours (schedule)
  var sleeping = false;
  var wokeUntil = 0;
  function sleepTime() {
    var off = get("offFrom"), on = get("onAt");
    if (off < 0) return false;
    var h = new Date().getHours();
    if (off > on) return h >= off || h < on;
    if (off < on) return h >= off && h < on;
    return false;
  }
  function updateSleep() {
    var s = sleepTime() && Date.now() > wokeUntil;
    if (s !== sleeping) {
      sleeping = s;
      $("sleep").classList.toggle("on", s);
      if (s) closeMenu();
    }
  }
  function wake() {
    wokeUntil = Date.now() + 15 * 60 * 1000;
    updateSleep();
    toast("Showing art for 15 minutes");
  }

  // ---------------------------------------------------------------- toast
  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  // ---------------------------------------------------------------- menu
  function hourName(h) {
    if (h === 0) return "Midnight";
    if (h === 12) return "Noon";
    return (h % 12) + (h < 12 ? " AM" : " PM");
  }
  var ROWS = [
    { key: "fav", name: "Favorite",
      vals: function () { return [false, true]; },
      cur: function () { return isFav(currentItem()); },
      fmt: function (v) { return v ? "★ Yes" : "☆ No"; } },
    { key: "collection", name: "Collection",
      vals: collectionChoices,
      fmt: function (v) { return collection(v).name + " (" + itemsIn(v).length + ")"; } },
    { key: "border", name: "Border",
      vals: function () { return [0, 2, 4, 6, 8, 10, 12]; },
      fmt: function (v) { return v ? String(v) : "None"; } },
    { key: "mat", name: "Mat color",
      vals: function () { return ["auto", "white", "warm", "gray", "black", "navy"]; },
      fmt: function (v) { return { auto: "Auto", white: "White", warm: "Warm", gray: "Gray", black: "Black", navy: "Navy" }[v]; } },
    { key: "style", name: "Mat style",
      vals: function () { return ["flat", "shadowbox"]; },
      fmt: function (v) { return v === "shadowbox" ? "Shadowbox" : "Flat"; } },
    { key: "brightness", name: "Brightness",
      vals: function () { return [50, 60, 70, 80, 90, 100]; },
      fmt: function (v) { return v + "%"; } },
    { key: "tone", name: "Color tone",
      vals: function () { return [-2, -1, 0, 1, 2]; },
      fmt: function (v) { return { "-2": "Cool 2", "-1": "Cool 1", "0": "Standard", "1": "Warm 1", "2": "Warm 2" }[String(v)]; } },
    { key: "every", name: "Change every",
      vals: function () { return [3, 10, 30, 60, 360, 1440]; },
      fmt: function (v) { return v < 60 ? v + " min" : (v < 1440 ? (v / 60) + (v === 60 ? " hour" : " hours") : "1 day"); } },
    { key: "order", name: "Order",
      vals: function () { return ["shuffle", "inorder"]; },
      fmt: function (v) { return v === "shuffle" ? "Shuffle" : "In order"; } },
    { key: "offFrom", name: "Screen off at",
      vals: function () { return [-1, 21, 22, 23, 0, 1]; },
      fmt: function (v) { return v < 0 ? "Never" : hourName(v); } },
    { key: "onAt", name: "Screen on at",
      vals: function () { return [5, 6, 7, 8, 9, 10]; },
      fmt: hourName },
    { key: "nightDim", name: "Dim 11 PM–6 AM",
      vals: function () { return [true, false]; },
      fmt: function (v) { return v ? "On" : "Off"; } },
    { key: "labels", name: "Show labels",
      vals: function () { return [true, false]; },
      fmt: function (v) { return v ? "On" : "Off"; } }
  ];
  var menuOpen = false;
  var sel = 0;
  var menuIdle = null;

  function rowValue(r) { return r.cur ? r.cur() : get(r.key); }
  function changeRow(r, dir) {
    var vals = r.vals();
    var i = vals.indexOf(rowValue(r));
    if (i < 0) {   // value not in the list (e.g. ?border=5): start from the nearest
      i = 0;
      for (var n = 1; n < vals.length; n++) {
        if (Math.abs(vals[n] - rowValue(r)) < Math.abs(vals[i] - rowValue(r))) i = n;
      }
      if (dir > 0 && vals[i] > rowValue(r)) dir = 0;
      if (dir < 0 && vals[i] < rowValue(r)) dir = 0;
    }
    var v = vals[(i + dir + vals.length) % vals.length];
    applySetting(r.key, v);
    renderMenu();
  }
  function applySetting(key, v) {
    var it = currentItem();
    if (key === "fav") {
      setFav(it, v);
      toast(v ? "★ Added to favorites" : "Removed from favorites");
      return;
    }
    set(key, v);
    if (key === "border" || key === "mat" || key === "style") rerender();
    else if (key === "brightness" || key === "tone" || key === "nightDim") updateOverlays();
    else if (key === "every") schedule();
    else if (key === "offFrom" || key === "onAt") { wokeUntil = 0; updateSleep(); }
    else if (key === "labels") { if (!v) hideLabel(); }
    else if (key === "collection" || key === "order") {
      rebuildDeck(it ? it.src : null);          // keeps the current artwork if it's in the new set
      if (currentItem() !== it) show(currentItem(), 0, "nav");
      schedule();
    }
  }

  function renderMenu() {
    var it = currentItem() || {};
    var html = '<div class="head"><div class="app">Art Frame</div>' +
      '<div class="t"></div><div class="a"></div><div class="d"></div></div>';
    ROWS.forEach(function (r, i) {
      html += '<div class="row' + (i === sel ? " sel" : "") + '" data-i="' + i + '">' +
        '<span class="name"></span><span class="val"><span class="arr">&#8249;</span><span class="v"></span>' +
        '<span class="arr">&#8250;</span></span></div>';
    });
    html += '<div class="foot">' + (IS_APP
      ? "↑↓ choose &nbsp;·&nbsp; ←→ change &nbsp;·&nbsp; BACK close"
      : "Click ‹ › to change &nbsp;·&nbsp; click the art to close") + '</div>';
    var m = $("menu");
    m.innerHTML = html;
    m.querySelector(".t").textContent = it.title || "";
    m.querySelector(".a").textContent = it.artist || "";
    m.querySelector(".d").textContent = [it.date, it.m, it.c ? collection(it.c === "photos" ? "photos" : it.c).name : ""]
      .filter(function (x) { return x; }).join(" · ");
    var rows = m.querySelectorAll(".row");
    for (var i = 0; i < rows.length; i++) {
      rows[i].querySelector(".name").textContent = ROWS[i].name;
      rows[i].querySelector(".v").textContent = ROWS[i].fmt(rowValue(ROWS[i]));
    }
  }
  function openMenu() {
    if (!current) return;
    menuOpen = true;
    sel = 0;
    hideLabel();
    renderMenu();
    $("menu").classList.add("open");
    document.body.classList.add("menu-open");
    bumpMenu();
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    $("menu").classList.remove("open");
    document.body.classList.remove("menu-open");
    clearTimeout(menuIdle);
  }
  function bumpMenu() {
    clearTimeout(menuIdle);
    menuIdle = setTimeout(closeMenu, 30000);
  }
  // pointer (browser): click a row's left/right half to step its value
  $("menu").addEventListener("click", function (e) {
    e.stopPropagation();
    if (Date.now() - lastEnterKey < 450) return;   // same press already handled as a key
    var row = e.target.closest ? e.target.closest(".row") : null;
    if (!row) return;
    sel = +row.getAttribute("data-i");
    var rect = row.getBoundingClientRect();
    changeRow(ROWS[sel], e.clientX < rect.left + rect.width * 0.45 ? -1 : 1);
    bumpMenu();
  });
  $("menu").addEventListener("mousemove", function (e) {
    var row = e.target.closest ? e.target.closest(".row") : null;
    if (!row) return;
    var i = +row.getAttribute("data-i");
    if (i === sel) return;
    sel = i;
    var rows = $("menu").querySelectorAll(".row");
    for (var n = 0; n < rows.length; n++) rows[n].classList.toggle("sel", n === sel);
  });

  // ---------------------------------------------------------------- full screen (browser)
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function canFull() {
    var el = document.documentElement;
    return !IS_APP && !!(el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen);
  }
  function goFull() {
    var el = document.documentElement;
    var req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitRequestFullScreen;
    if (req && !isFull()) {
      try { var p = req.call(el); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    $("hint").classList.remove("show");
  }

  // ---------------------------------------------------------------- previous / next
  var ZONE = 0.22;
  var lastNav = 0, lastKeyNav = 0, lastMove = 0, lastX = null, lastY = null;
  var burst = { dx: 0, dy: 0, fired: false, timer: null };
  var hoverTimer = null, ptrTimer = null;

  function flashArrow(dir) {
    var el = $(dir > 0 ? "navR" : "navL");
    el.classList.add("flash");
    setTimeout(function () { el.classList.remove("flash"); }, 60);
  }
  function nav(dir, fromKey) {
    var now = Date.now();
    if (busy || now - lastNav < 350) return;
    lastNav = now;
    if (fromKey) lastKeyNav = now;
    flashArrow(dir);
    show(advance(dir), 0, "nav");
    schedule();
  }
  function zoneAt(x) {
    var w = window.innerWidth;
    return x < w * ZONE ? -1 : (x > w * (1 - ZONE) ? 1 : 0);
  }
  function pointerZone() {
    if (lastX === null || Date.now() - lastMove > 4000) return 0;
    return zoneAt(lastX);
  }
  function updateHover() {
    var z = menuOpen ? 0 : zoneAt(lastX);
    $("navL").classList.toggle("hover", z < 0);
    $("navR").classList.toggle("hover", z > 0);
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      $("navL").classList.remove("hover");
      $("navR").classList.remove("hover");
    }, 4000);
  }
  document.addEventListener("mousemove", function (e) {
    var mx = e.movementX, my = e.movementY;
    if (typeof mx !== "number" || (mx === 0 && my === 0 && lastX !== null)) {
      mx = lastX === null ? 0 : e.clientX - lastX;
      my = lastY === null ? 0 : e.clientY - lastY;
    }
    lastX = e.clientX; lastY = e.clientY;
    if (!mx && !my) return;
    lastMove = Date.now();
    document.body.classList.add("ptr");
    clearTimeout(ptrTimer);
    ptrTimer = setTimeout(function () { document.body.classList.remove("ptr"); }, 3000);
    if (menuOpen) { bumpMenu(); return; }      // the pointer is being used on the menu
    if (sleeping) return;
    updateHover();
    burst.dx += mx; burst.dy += my;
    clearTimeout(burst.timer);
    burst.timer = setTimeout(function () { burst.dx = 0; burst.dy = 0; burst.fired = false; }, 250);
    if (!burst.fired && Math.abs(burst.dx) >= 8 && Math.abs(burst.dx) > 2 * Math.abs(burst.dy)
        && Date.now() - lastKeyNav > 600) {
      burst.fired = true;
      nav(burst.dx > 0 ? 1 : -1, false);
    }
  });

  // ---------------------------------------------------------------- OK / keys
  // One OK press can arrive as both a keydown and a click; presses within 400 ms count once.
  var lastOK = 0, lastEnterKey = 0;
  function onOK() {
    var now = Date.now();
    if (now - lastOK < 400) return;
    lastOK = now;
    if (sleeping) { wake(); return; }
    if (canFull() && !isFull()) { goFull(); showLabel(current, true); return; }
    var z = pointerZone();
    if (z) { lastMove = now; updateHover(); nav(z, false); return; }
    openMenu();
  }
  document.addEventListener("click", function () {
    if (Date.now() - lastEnterKey < 450) return;
    if (menuOpen) { closeMenu(); return; }      // click on the art closes the menu
    onOK();
  });

  var K = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, PLAYPAUSE: 10252, PLAY: 415,
            PAUSE: 19, FF: 417, REW: 412, CHUP: 427, CHDOWN: 428, INFO: 457 };
  function togglePause() {
    paused = !paused;
    toast(paused ? "Slideshow paused" : "Slideshow resumed");
  }
  function exitApp() {
    try { window.tizen.application.getCurrentApplication().exit(); } catch (e) {}
  }
  document.addEventListener("keydown", function (e) {
    var c = e.keyCode, k = e.key || "";
    var isEnter = k === "Enter" || c === K.ENTER;
    var isBack = c === K.BACK || k === "Escape" || k === "Backspace" || k === "GoBack" || k === "XF86Back";
    // In the browser, if the pointer is in use, let the click (which knows where the pointer is) handle OK.
    if (isEnter && !IS_APP && Date.now() - lastMove < 4000) return;
    if (isEnter) lastEnterKey = Date.now();

    if (sleeping) {
      if (isBack && IS_APP) { exitApp(); return; }
      wake(); e.preventDefault(); return;
    }
    if (menuOpen) {
      bumpMenu();
      if (k === "ArrowUp" || c === K.UP) { sel = (sel - 1 + ROWS.length) % ROWS.length; renderMenu(); }
      else if (k === "ArrowDown" || c === K.DOWN) { sel = (sel + 1) % ROWS.length; renderMenu(); }
      else if (k === "ArrowLeft" || c === K.LEFT) { changeRow(ROWS[sel], -1); }
      else if (k === "ArrowRight" || c === K.RIGHT) { changeRow(ROWS[sel], 1); }
      else if (isEnter) { if (Date.now() - lastOK > 400) { lastOK = Date.now(); changeRow(ROWS[sel], 1); } }
      else if (isBack) { closeMenu(); }
      else return;
      e.preventDefault();
      return;
    }
    if (isEnter) { onOK(); }
    else if (k === "ArrowRight" || c === K.RIGHT || k === "MediaFastForward" || k === "MediaTrackNext" || c === K.FF || c === K.CHUP) { nav(1, true); }
    else if (k === "ArrowLeft" || c === K.LEFT || k === "MediaRewind" || k === "MediaTrackPrevious" || c === K.REW || c === K.CHDOWN) { nav(-1, true); }
    else if (k === "ArrowUp" || c === K.UP) { openMenu(); }
    else if (k === "ArrowDown" || c === K.DOWN || c === K.INFO) { showLabel(current, true); }
    else if (k === "MediaPlayPause" || c === K.PLAYPAUSE || c === K.PLAY || c === K.PAUSE) { togglePause(); }
    else if (isBack && IS_APP) { exitApp(); }
    else return;
    e.preventDefault();
  });
  window.addEventListener("resize", function () { layout(current); });

  // ---------------------------------------------------------------- self-update
  // Browser in full screen: swap in the new art list without reloading (a reload exits full screen);
  // art.js itself forces a reload if this page code is too old. Otherwise reload.
  function freshReload(build) {
    if (IS_APP) { location.reload(); return; }
    var q = location.search.replace(/([?&])v=[^&]*&?/, "$1").replace(/[?&]$/, "");
    location.replace(location.pathname + (q ? q + "&" : "?") + "v=" + encodeURIComponent(build));
  }
  function swapArt(build) {
    var s = document.createElement("script");
    s.src = url("art.js?v=" + encodeURIComponent(build));
    s.onload = function () {
      if (window.ART && window.ART.length) {
        ART = window.ART;
        BUILD = window.ART_BUILD || build;
        indexItems();
        rebuildDeck(current && current.item ? current.item.src : null);
      }
      if (s.parentNode) s.parentNode.removeChild(s);
    };
    document.head.appendChild(s);
  }
  function checkVersion() {
    if (!window.fetch || menuOpen) return;
    fetch(url("version.json?t=" + Date.now()), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        if (!v || !v.build || !BUILD || v.build === BUILD) return;
        if (!IS_APP && isFull()) swapArt(v.build); else freshReload(v.build);
      })
      .catch(function () {});
  }

  // ---------------------------------------------------------------- keep the screen on
  function keepAwake() {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request("screen").catch(function () {});
    } catch (e) {}
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") keepAwake();
  });

  function appSetup() {
    if (!IS_APP) return;
    try {   // let the remote's media and channel buttons reach the page
      var tvKeys = ["MediaPlayPause", "MediaPlay", "MediaPause", "MediaFastForward", "MediaRewind",
                    "ChannelUp", "ChannelDown", "Info"];
      tvKeys.forEach(function (name) { try { window.tizen.tvinputdevice.registerKey(name); } catch (e) {} });
    } catch (e) {}
    try {   // keep the TV's screen saver away while art is showing
      var ac = window.webapis && window.webapis.appcommon;
      if (ac) ac.setScreenSaver(ac.AppCommonScreenSaverState.SCREEN_SAVER_OFF, function () {}, function () {});
    } catch (e) {}
  }

  // ---------------------------------------------------------------- start
  if (!ART.length && !PHOTOS.length) return;
  if (!deckValid()) rebuildDeck(null);
  var pick = parseInt(params.i, 10);   // ?i=N shows a specific artwork first (testing)
  if (pick >= 0 && pick < ART.length) {
    var at = deck.order.indexOf(ART[pick].src);
    if (at >= 0) deck.pos = at;
  }
  save("artframe.deck2", deck);
  appSetup();
  updateOverlays();
  updateSleep();
  show(currentItem());
  schedule();
  setInterval(function () { updateOverlays(); updateSleep(); }, 30 * 1000);
  setInterval(checkVersion, 10 * 60 * 1000);
  keepAwake();

  if (canFull() && !isFull() && !load("artframe.hinted", false)) {
    save("artframe.hinted", true);
    $("hint").classList.add("show");
    setTimeout(function () { $("hint").classList.remove("show"); }, 12000);
  }
})();
