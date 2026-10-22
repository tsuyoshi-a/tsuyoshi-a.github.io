// tsuyoshi a. — 動きの部分だけ（中身は各 HTML に書いてある）
//   ・ライト / ダークの切り替え（選んだモードはブラウザに記憶。未選択なら OS の設定に従う）
//   ・トップのヘッダー：ヒーロー写真の上では透明、過ぎたら色付き
//   ・スマホのメニュー（ハンバーガー）
//   ・サイト内検索（虫めがね）
//   ・discography の絞り込み
//   ・追跡枠：カーソルを乗せた [data-track] に細い枠が付く（スマホでは画面中央に来たもの）
(() => {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const prefix = location.pathname.includes("/news/") ? "../" : "";

  /* ---------- ライト / ダーク ---------- */
  const THEME_KEY = "ta-theme";
  const currentTheme = () => root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const showTheme = () => { if ($("theme-label")) $("theme-label").textContent = currentTheme(); };
  if ($("theme")) $("theme").addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* 記憶できなくても切り替えは効く */ }
    showTheme();
  });
  showTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", showTheme);

  /* ---------- ヘッダー ---------- */
  const hd = $("hd"), band = $("hband"), panel = $("search-panel");
  const updateHeader = () => {
    if (!hd.classList.contains("over")) return;
    const past = band ? band.getBoundingClientRect().bottom <= hd.offsetHeight : scrollY > 10;
    hd.classList.toggle("solid", past || hd.classList.contains("open") || (panel && !panel.hidden));
  };
  addEventListener("scroll", updateHeader, { passive: true });
  addEventListener("resize", updateHeader);
  updateHeader();

  $("menu").addEventListener("click", () => {
    const open = hd.classList.toggle("open");
    $("menu").setAttribute("aria-expanded", String(open));
    updateHeader();
  });

  /* ---------- discography の絞り込み ---------- */
  if ($("q")) $("q").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    let n = 0;
    document.querySelectorAll("#grid .item").forEach((el) => {
      const hit = !q || el.textContent.toLowerCase().includes(q);
      el.classList.toggle("hide", !hit);
      n += hit;
    });
    $("count").textContent = n;
  });

  /* ---------- サイト内検索 ----------
     虫めがねを押したときに各ページを読み込み、曲名・機材・実績・記事を拾って検索する。
     ページを増やしたら PAGES に足す。ファイルを直接開いた場合（file://）はブラウザの制限で動かない。 */
  (() => {
    const toggle = $("search-toggle");
    if (!toggle || !panel) return;
    const input = panel.querySelector(".search-input"), status = panel.querySelector(".search-status"), list = panel.querySelector(".search-results");
    const PAGES = [
      ["index.html", "home"], ["about.html", "about / gears"], ["discography.html", "discography"],
      ["news.html", "news"], ["works.html", "works"], ["contact.html", "contact"],
    ];
    const clean = (t) => (t || "").replace(/\s+/g, " ").trim();
    const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    let records = null, loading = false;

    function collect(doc, file, label) {
      const out = [];
      const push = (title, desc, url) => { title = clean(title); if (title) out.push({ title, desc: clean(desc), url, page: label }); };
      doc.querySelectorAll(".item").forEach((el) => push(el.querySelector("h3")?.textContent, el.querySelector("p")?.textContent, file));
      doc.querySelectorAll(".works-sec .row").forEach((el) => push(el.querySelector(".who")?.textContent || el.querySelector(".what")?.textContent, el.querySelector(".who") ? el.querySelector(".what")?.textContent : "", file));
      doc.querySelectorAll(".list > a.ni").forEach((el) => push(el.querySelector("h3")?.textContent, el.querySelector("p")?.textContent, el.getAttribute("href")));
      doc.querySelectorAll(".about .sec, .cta-sec").forEach((el) => push(el.querySelector("h3, h2")?.textContent, el.textContent, file));
      return out;
    }

    async function build() {
      if (records || loading) return;
      loading = true; status.textContent = "読み込み中…";
      const parser = new DOMParser(), all = [];
      await Promise.all(PAGES.map(async ([file, label]) => {
        try {
          const res = await fetch(prefix + file);
          if (res.ok) all.push(...collect(parser.parseFromString(await res.text(), "text/html"), file, label));
        } catch (e) { /* 読めないページは飛ばす */ }
      }));
      const seen = new Set();
      records = all.filter((r) => { const k = r.title + "|" + r.url; if (seen.has(k)) return false; seen.add(k); return true; });
      loading = false;
      status.textContent = records.length ? "" : "検索データを読み込めませんでした。公開された状態でお試しください。";
      if (input.value) render(input.value);
    }

    function mark(text, q) {
      const i = text.toLowerCase().indexOf(q);
      if (i < 0) return esc(text);
      return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
    }

    function render(raw) {
      const q = raw.trim().toLowerCase();
      list.innerHTML = "";
      if (!q || !records) return;
      const hits = records.filter((r) => (r.title + " " + r.desc).toLowerCase().includes(q)).slice(0, 15);
      status.textContent = hits.length ? `${hits.length} 件` : "該当するものが見つかりませんでした。";
      list.innerHTML = hits.map((r) => `<li><a href="${prefix}${r.url}"><div class="t">${mark(r.title, q)}</div>${r.desc && r.desc !== r.title ? `<div class="d">${mark(r.desc, q)}</div>` : ""}<div class="p">${esc(r.page)}</div></a></li>`).join("");
    }

    const open = () => { panel.hidden = false; toggle.setAttribute("aria-expanded", "true"); input.focus(); build(); updateHeader(); };
    const close = () => { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); updateHeader(); };
    toggle.addEventListener("click", () => (panel.hidden ? open() : close()));
    let timer;
    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => render(input.value), 120); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { close(); toggle.focus(); } });
  })();

  /* ---------- 追跡枠 ----------
     マウスのある端末：カーソルを乗せた [data-track] に枠が吸い付く。何も乗っていないときは、
       トップのヒーロー写真の上でだけ小さな枠がゆっくり漂う。
     タッチの端末：スクロールして画面の中央付近に来た [data-track] に枠が付く（タップの邪魔はしない）。 */
  const tr = $("tracker"), lbl = $("lbl");
  if (!tr) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canHover = matchMedia("(hover: hover)").matches;
  const fmt = (n) => n.toFixed(3).replace(/^0/, "");
  let hovered = null;
  const setHovered = (el) => {
    if (hovered === el) return;
    if (hovered) hovered.classList.remove("tracked");
    hovered = el;
    if (el) el.classList.add("tracked");
  };
  if (canHover) {
    document.addEventListener("mouseover", (e) => setHovered(e.target.closest("[data-track]")));
    root.addEventListener("mouseleave", () => setHovered(null));
  }
  // 画面の中央に最も近い段を選ぶ。2 列の作品のように同じ高さに複数並んでいるときは、
  // その中から左右ランダムに 1 つ選び、その段が中央にある間は同じものに留める
  let pick = 0;
  function pickCentered(now) {
    if (now - pick < 120) return;
    pick = now;
    const mid = innerHeight / 2, limit = innerHeight * .2;
    const near = [];
    document.querySelectorAll("[data-track]").forEach((el) => {
      if (!el.offsetParent) return;
      const r = el.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid);
      if (d < limit) near.push({ el, d });
    });
    if (!near.length) return setHovered(null);
    const min = Math.min(...near.map((n) => n.d));
    const row = near.filter((n) => n.d - min < 4).map((n) => n.el);
    if (row.includes(hovered)) return;
    setHovered(row[(Math.random() * row.length) | 0]);
  }
  function idle(now) {
    if (!band || !canHover) return null;
    const r = band.getBoundingClientRect();
    if (r.bottom < innerHeight * .3 || r.top > innerHeight * .7) return null;
    const t = now / 1000, s = Math.min(r.width, r.height) * .2;
    const cx = r.left + r.width * (.5 + Math.sin(t * .19) * .36), cy = r.top + r.height * (.5 + Math.cos(t * .13) * .32);
    return { x: cx - s / 2, y: cy - s / 2, w: s, h: s, light: true, label: `id 01 — ${fmt((cx - r.left) / r.width)} ${fmt((cy - r.top) / r.height)}` };
  }

  const box = { x: 0, y: 0, w: 0, h: 0, on: false };
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(50, now - last); last = now;
    let g = null, label = "", light = false;
    // メニューや検索を開いている間は枠を出さない（裏のページを追っても見えないため）
    const covered = hd.classList.contains("open") || (panel && !panel.hidden);
    if (covered) setHovered(null);
    else if (!canHover) pickCentered(now);
    if (covered) { /* 枠なし */ } else if (hovered) {
      const r = hovered.getBoundingClientRect(), p = 8;
      g = { x: r.left - p, y: r.top - p, w: r.width + p * 2, h: r.height + p * 2 };
      label = `${hovered.dataset.track} — x ${fmt((r.left + r.width / 2) / innerWidth)} y ${fmt((r.top + r.height / 2) / innerHeight)}`;
      light = !!hovered.closest("[data-dark]");
    } else {
      const i = idle(now);
      if (i) { g = i; label = i.label; light = i.light; }
    }
    if (g) {
      if (!box.on) Object.assign(box, { x: g.x + g.w / 2, y: g.y + g.h / 2, w: 0, h: 0 });
      const k = reduce ? 1 : 1 - Math.pow(.001, dt / 1000 * 3);
      box.x += (g.x - box.x) * k; box.y += (g.y - box.y) * k; box.w += (g.w - box.w) * k; box.h += (g.h - box.h) * k;
      tr.style.transform = `translate(${box.x}px,${box.y}px)`;
      tr.style.width = box.w + "px"; tr.style.height = box.h + "px";
      if (lbl.textContent !== label) lbl.textContent = label;
    }
    box.on = !!g;
    tr.classList.toggle("on", box.on);
    tr.classList.toggle("light", light);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
