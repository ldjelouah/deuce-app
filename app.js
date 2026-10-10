/* Deuce — renders data/today.json (the day's matches) and data/track.json (Bilan), both written
   by `deuce site build`. No odds anywhere. */
(() => {
  "use strict";

  const pct = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const longDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
  const fullDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const hour = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const stamp = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const pct1 = new Intl.NumberFormat("fr-FR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const int = new Intl.NumberFormat("fr-FR");
  const ll = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const shortDay = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const COURT = { Hard: "dur", Clay: "terre battue", Grass: "gazon", Indoor: "dur en salle" };
  const ROUND = { F: "finale", SF: "demi-finale", QF: "quart de finale", R16: "8e de finale", R32: "16e de finale", R64: "32e de finale", R128: "1er tour", RR: "round robin", Q1: "qualif. 1er tour", Q2: "qualif. 2e tour", Q3: "qualif. 3e tour" };

  let DATA = null;
  let TRACK = null;
  let trackState = "loading"; // loading | ok | error
  let dataState = "loading";
  let filter = "all";
  let view = location.hash === "#bilan" ? "bilan" : "day";

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const isoDay = (s) => new Date(s + "T00:00:00Z");
  const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function rows(list, mid) {
    const box = el("div", "rows");
    for (const o of list) {
      const r = el("div", "row" + (o === mid ? " mid" : ""));
      r.append(el("span", "lab", "+ de " + num.format(o.line) + " jeux"));
      const bar = el("span", "bar");
      const fill = el("i");
      fill.style.width = (o.p * 100).toFixed(1) + "%";
      bar.append(fill);
      r.append(bar, el("span", "v", pct.format(o.p)));
      box.append(r);
    }
    return box;
  }

  function resultLine(m) {
    const r = m.result;
    const winner = r.winner === "a" ? m.a : m.b;
    const favourite = m.pa >= 0.5 ? "a" : "b";
    const line = el("p", "result");
    line.append(el("strong", null, winner), ` gagne ${r.score}`);
    const hit = r.winner === favourite;
    line.append(el("span", "verdict " + (hit ? "hit" : "miss"), hit ? "pronostic juste" : "pronostic manqué"));
    return line;
  }

  function card(m) {
    const done = Boolean(m.result);
    const c = el("article", "card" + (done ? " done" : ""));
    const meta = el("div", "meta");
    if (done) meta.append(el("span", "status done", "Terminé"));
    else meta.append(el("span", "status " + (m.ok ? "ok" : "warn"), m.ok ? "Prédiction fiable" : "Prudence : " + m.why.join(", ")));
    const when = [];
    if (m.start_utc) when.push(hour.format(new Date(m.start_utc)));
    if (m.round && ROUND[m.round]) when.push(ROUND[m.round]);
    if (when.length) meta.append(el("span", "when", when.join(" · ")));

    const players = el("div", "players");
    const a = el("div", "p a");
    a.append(el("div", "pct", pct.format(m.pa)), el("div", "name", m.a));
    const b = el("div", "p b");
    b.append(el("div", "pct", pct.format(1 - m.pa)), el("div", "name", m.b));
    players.append(a, el("div", "vs", "contre"), b);
    if (done) (m.result.winner === "a" ? a : b).classList.add("won");

    const split = el("div", "split");
    split.setAttribute("role", "img");
    split.setAttribute("aria-label", `${m.a} ${pct.format(m.pa)}, ${m.b} ${pct.format(1 - m.pa)}`);
    const sa = el("div", "sa");
    sa.style.width = (m.pa * 100).toFixed(1) + "%";
    const sb = el("div", "sb");
    sb.style.width = ((1 - m.pa) * 100).toFixed(1) + "%";
    split.append(sa, sb);

    c.append(meta);
    if (done) c.append(resultLine(m));
    c.append(players, split);
    if (m.overs.length) {
      const tot = el("section", "tot");
      const h = el("h3");
      let expected = "attendu : " + num.format(m.expected) + " jeux";
      if (done && m.result.games != null) {
        expected += ` · réel : ${m.result.games}` + (m.result.retired ? " (abandon)" : "");
      }
      h.append("Total de jeux", el("span", null, expected));
      let k = 0;
      let best = 1;
      m.overs.forEach((o, i) => {
        const d = Math.abs(o.p - 0.5);
        if (d < best) { best = d; k = i; }
      });
      const near = m.overs.slice(Math.max(0, k - 3), k + 4);
      tot.append(h, rows(near, m.overs[k]));
      if (m.overs.length > near.length) {
        const det = el("details");
        det.append(el("summary", null, "Toutes les lignes (" + m.overs.length + ")"), rows(m.overs, m.overs[k]));
        tot.append(det);
      }
      c.append(tot);
    }
    return c;
  }

  function render() {
    const list = document.getElementById("list");
    list.textContent = "";
    const ms = DATA.matches.filter((m) => filter === "all" || (filter === "ok" ? m.ok && !m.result : m.tour === filter));
    const groups = new Map();
    for (const m of ms) {
      const key = m.tour.toUpperCase() + " · " + m.tournament;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }
    for (const [key, arr] of groups) {
      const g = el("section", "group");
      const h = el("h2", null, key);
      const m0 = arr[0];
      h.append(el("small", null, (COURT[m0.court] || m0.court) + " · " + arr.length + " match" + (arr.length > 1 ? "s" : "")));
      g.append(h);
      arr.forEach((m) => g.append(card(m)));
      list.append(g);
    }
    if (!ms.length) {
      list.append(el("p", "empty", DATA.matches.length ? "Aucun match pour ce filtre." : (DATA.note || "Aucun match ATP ou WTA au programme.")));
    }
  }

  function header() {
    document.getElementById("title").textContent = "Pronostics du " + longDay.format(isoDay(DATA.date));
    const upcoming = DATA.matches.filter((m) => !m.result);
    const okN = upcoming.filter((m) => m.ok).length;
    const doneN = DATA.matches.length - upcoming.length;
    const parts = [`${DATA.matches.length} matchs ATP et WTA`];
    if (upcoming.length) parts.push(`${okN} prédiction${okN > 1 ? "s" : ""} fiable${okN > 1 ? "s" : ""} à venir`);
    if (doneN) parts.push(`${doneN} terminé${doneN > 1 ? "s" : ""}`);
    document.getElementById("sub").textContent = DATA.matches.length ? parts.join(" · ") : "Aucun match au programme";
    const notice = document.getElementById("notice");
    notice.hidden = !(DATA.date < todayIso());
    if (!notice.hidden) {
      notice.textContent = `Ces pronostics datent du ${fullDay.format(isoDay(DATA.date))} : ceux du jour ne sont pas encore publiés.`;
    }
    const through = Object.values(DATA.data_through || {}).sort()[0];
    const foot = document.getElementById("foot");
    foot.textContent = "";
    foot.append(
      el("p", null,
        "Probabilités calculées par le modèle deuce" +
        (through ? ` à partir des résultats jusqu'à la semaine du ${fullDay.format(isoDay(through))}` : "") +
        ". Elles ne tiennent pas compte des blessures ou forfaits annoncés depuis. « Prudence » signale une prédiction moins sûre : peu de matchs récents, longue absence, abandon récent ou désaccord entre modèles."),
      el("p", null, "Mis à jour le " + stamp.format(new Date(DATA.generated_at)) + ".")
    );
  }

  // ------------------------------------------------------------------ Bilan (data/track.json)
  const plural = (n, word) => `${int.format(n)} ${word}${n > 1 ? "s" : ""}`;
  const pctRange = (lo, hi) => `${Math.round(lo * 100)}–${Math.round(hi * 100)} %`;
  const points = (d) => (d > 0 ? "+" : d < 0 ? "−" : "±") + Math.abs(d) + (Math.abs(d) > 1 ? " pts" : " pt");
  const bilanTour = () => (filter === "atp" || filter === "wta" ? filter : "all");
  const bilanSubset = () => (filter === "ok" ? "ok" : "all");

  function periods() {
    const since = TRACK.since ? "Depuis le " + longDay.format(isoDay(TRACK.since)) : "Depuis le début";
    return [["7", "7 derniers jours"], ["30", "30 derniers jours"], ["all", since]];
  }

  function tile(label, s) {
    const t = el("article", "kpi");
    t.append(el("h3", null, label));
    if (!s || !s.n) {
      t.append(el("div", "big muted", "–"), el("div", "kpi-lines", "aucun match joué"));
      return t;
    }
    t.setAttribute("aria-label", `${label} : ${pct.format(s.accuracy)} de pronostics justes, ${s.hits} sur ${s.n}`);
    t.append(el("div", "big", pct.format(s.accuracy)));
    const lines = el("div", "kpi-lines");
    lines.append(el("p", null, `${plural(s.hits, "juste")} sur ${int.format(s.n)}`));
    lines.append(el("p", null, `attendu ${pct.format(s.expected)}`));
    const lo = Math.max(0, s.expected - 2 * s.sd);
    const hi = Math.min(1, s.expected + 2 * s.sd);
    lines.append(el("p", "zone", `zone normale ${pctRange(lo, hi)}`));
    const d = Math.round((s.accuracy - s.elo_accuracy) * 100);
    const delta = el("p", "delta " + (d > 0 ? "up" : d < 0 ? "down" : "flat"));
    delta.append(el("strong", null, points(d)), ` vs favori Elo (${pct.format(s.elo_accuracy)})`);
    lines.append(delta);
    t.append(lines);
    return t;
  }

  function dayRows(list) {
    const sec = el("section", "panel days");
    const h = el("h3");
    h.append("Jour par jour", el("span", null, "barre : pronostics justes · trait : attendu"));
    sec.append(h);
    const box = el("div", "rows");
    for (const d of list) {
      const share = d.hits / d.n;
      const r = el("div", "row");
      r.append(el("span", "lab", shortDay.format(isoDay(d.date))));
      const bar = el("span", "bar");
      bar.setAttribute("role", "img");
      bar.setAttribute("aria-label", `${d.hits} justes sur ${d.n} (${pct.format(share)}), attendu ${pct.format(d.expected)}`);
      bar.title = bar.getAttribute("aria-label");
      const fill = el("i");
      fill.style.width = (share * 100).toFixed(1) + "%";
      const tick = el("b", "tick");
      tick.style.left = (d.expected * 100).toFixed(1) + "%";
      bar.append(fill, tick);
      r.append(bar, el("span", "v", `${d.hits}/${d.n}`));
      box.append(r);
    }
    sec.append(box);
    return sec;
  }

  function reference(tour) {
    const R = TRACK.reference || {};
    const tours = (tour === "all" ? ["atp", "wta"] : [tour]).filter((t) => R[t]);
    if (!tours.length) return document.createDocumentFragment();
    const sec = el("section", "panel ref");
    sec.append(el("h3", null, "Repère : le test historique"));
    for (const t of tours) {
      const r = R[t];
      sec.append(el("p", null,
        `${t.toUpperCase()}, ${r.years[0]}–${r.years[1]} : ${pct1.format(r.accuracy)} de pronostics justes sur ` +
        `${int.format(r.n)} matchs jamais vus à l'entraînement, contre ${pct1.format(r.elo_accuracy)} pour le favori Elo.`));
    }
    return sec;
  }

  function detailTable(S, sub) {
    const det = el("details", "panel");
    det.append(el("summary", null, "Indicateurs détaillés"));
    const table = el("table", "detail");
    const head = el("tr");
    ["Période", "Matchs", "Justes : modèle / Elo", "Log-loss : modèle / Elo"].forEach((x) => head.append(el("th", null, x)));
    table.append(el("thead"), el("tbody"));
    table.tHead.append(head);
    for (const [pid, label] of periods()) {
      const s = S[pid][sub];
      const tr = el("tr");
      tr.append(el("th", null, label));
      if (!s || !s.n) {
        tr.append(el("td", null, "0"), el("td", null, "–"), el("td", null, "–"));
      } else {
        tr.append(
          el("td", null, int.format(s.n)),
          el("td", null, `${pct.format(s.accuracy)} / ${pct.format(s.elo_accuracy)}`),
          el("td", null, `${ll.format(s.logloss)} / ${ll.format(s.elo_logloss)}`)
        );
      }
      table.tBodies[0].append(tr);
    }
    det.append(table, el("p", "note", "La log-loss mesure la justesse des probabilités elles-mêmes, pas seulement du favori : plus elle est basse, mieux c'est."));
    return det;
  }

  function renderBilan() {
    const box = document.getElementById("bilan");
    box.textContent = "";
    if (trackState !== "ok") {
      box.append(el("p", "empty", trackState === "loading" ? "Chargement du bilan…" : "Le bilan n'a pas pu être chargé. Réessayez plus tard."));
      return;
    }
    const tour = bilanTour();
    const sub = bilanSubset();
    const S = TRACK.stats[tour];
    const total = S.all[sub];
    if (!total || !total.n) {
      const since = TRACK.since ? ` depuis le ${fullDay.format(isoDay(TRACK.since))}` : "";
      box.append(el("p", "empty",
        `Aucun pronostic${filter === "ok" ? " fiable" : ""} publié${since} n'a encore son résultat. ` +
        "Le bilan se remplit à mesure que les matchs pronostiqués sont joués."));
      box.append(reference(tour));
      return;
    }
    const kpis = el("section", "kpis");
    kpis.setAttribute("aria-label", "Part de pronostics justes par période");
    for (const [pid, label] of periods()) kpis.append(tile(label, S[pid][sub]));
    box.append(kpis);
    const days = TRACK.days[sub === "ok" ? "ok" : tour] || [];
    if (days.length) box.append(dayRows(days));
    box.append(reference(tour), detailTable(S, sub));
  }

  function bilanHeader() {
    document.getElementById("title").textContent = "Bilan des pronostics";
    document.getElementById("notice").hidden = true;
    const sub = document.getElementById("sub");
    if (trackState !== "ok") {
      sub.textContent = trackState === "loading" ? "Chargement…" : "Bilan indisponible";
    } else {
      const c = TRACK.counts || {};
      const scored = (TRACK.stats.all.all.all || {}).n || 0;
      const parts = [];
      parts.push(scored ? `${plural(scored, "match")} joué${scored > 1 ? "s" : ""}` : "Aucun match joué pour l'instant");
      if (c.open) parts.push(`${int.format(c.open)} en attente du résultat`);
      sub.textContent = parts.join(" · ");
    }
    const foot = document.getElementById("foot");
    foot.textContent = "";
    foot.append(
      el("p", null,
        "Un pronostic compte s'il a été publié avant le match : c'est le dernier affiché avant que le résultat soit connu. " +
        "« Juste » : le joueur que le modèle donnait favori a gagné. Les forfaits et les abandons ne sont pas comptés."),
      el("p", null,
        "« Attendu » est la part de pronostics justes que le modèle prévoyait lui-même. La zone normale tient compte du hasard : " +
        "sur 20 matchs, un écart de 10 points avec l'attendu reste courant. Le favori Elo, classement de référence du tennis, sert de comparaison.")
    );
    if (trackState === "ok") foot.append(el("p", null, "Mis à jour le " + stamp.format(new Date(TRACK.generated_at)) + "."));
  }

  // ------------------------------------------------------------------ views and filters
  function draw() {
    if (view === "bilan") {
      bilanHeader();
      renderBilan();
    } else if (DATA) {
      header();
      render();
    } else {
      document.getElementById("title").textContent = "Pronostics du jour";
      document.getElementById("sub").textContent =
        dataState === "error" ? "Impossible de charger les pronostics. Réessayez plus tard." : "Chargement…";
      document.getElementById("foot").textContent = "";
    }
  }

  function setView(v) {
    view = v;
    document.querySelectorAll(".views a").forEach((a) => {
      if (a.dataset.v === v) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    document.getElementById("list").hidden = v !== "day";
    document.getElementById("bilan").hidden = v !== "bilan";
    document.querySelector(".filters").setAttribute("aria-label", v === "day" ? "Filtrer les matchs" : "Filtrer le bilan");
    draw();
  }
  window.addEventListener("hashchange", () => setView(location.hash === "#bilan" ? "bilan" : "day"));

  document.querySelectorAll(".filters button").forEach((btn) =>
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filters button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      filter = btn.dataset.f;
      draw();
    })
  );

  const getJson = (url) => fetch(url, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });

  setView(view);
  getJson("data/today.json")
    .then((d) => {
      DATA = d;
      dataState = "ok";
    })
    .catch(() => {
      dataState = "error";
    })
    .finally(() => {
      if (view === "day") draw();
    });
  getJson("data/track.json")
    .then((t) => {
      TRACK = t;
      trackState = "ok";
    })
    .catch(() => {
      trackState = "error";
    })
    .finally(() => {
      if (view === "bilan") draw();
    });

  // Install. Chrome fires beforeinstallprompt only after some engagement with the page, so on
  // Android the button is shown right away and, without a prompt to call, explains the ⋮ menu.
  // iOS Safari has no prompt API: a dismissible hint explains the Share menu instead.
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  const installBtn = document.getElementById("install");
  const hint = document.getElementById("install-hint");
  const hintText = document.getElementById("install-hint-text");
  let deferredPrompt = null;

  const showHint = (parts) => {
    hintText.textContent = "";
    for (const [text, strong] of parts) hintText.append(strong ? el("strong", null, text) : text);
    hint.hidden = false;
  };
  const ANDROID_HINT = [["Pour installer l'app : menu ", false], ["⋮", true], [" en haut à droite, puis ", false], ["Installer l'application", true], [" (ou « Ajouter à l'écran d'accueil »).", false]];
  const IOS_HINT = [["Pour installer l'app : bouton ", false], ["Partager", true], [" puis ", false], ["Sur l'écran d'accueil", true], [".", false]];

  if (!standalone && store.get("deuce-installed") !== "1") {
    if (android) installBtn.hidden = false;
    if (ios && store.get("deuce-ios-hint") !== "hidden") showHint(IOS_HINT);
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!standalone) installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) {
      showHint(ANDROID_HINT);
      return;
    }
    deferredPrompt.prompt();
    let outcome = "dismissed";
    try { outcome = (await deferredPrompt.userChoice).outcome; } catch { /* ignored */ }
    deferredPrompt = null;
    if (outcome === "accepted") installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
    hint.hidden = true;
    store.set("deuce-installed", "1");
  });
  document.getElementById("install-hint-close").addEventListener("click", () => {
    hint.hidden = true;
    if (ios) store.set("deuce-ios-hint", "hidden");
  });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
