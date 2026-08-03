/* ===========================================================
   THE FOOTBALL — retro football companion
   Vanilla JS. Boot → sport select → phrase + voice.
   Two sports: soccer and American football. Everything here is
   deliberately evergreen — no players, no seasons, no results —
   so the banks never need updating.
   =========================================================== */
(function () {
  "use strict";

  /* ---- Phrase banks ------------------------------------- */
  /* Rules for anything added here: no player names, no clubs, no
     seasons, no scores, no records. A phrase has to be true of a
     match played in any year, or it doesn't belong in the bank. */
  var PHRASES = {
    /* Soccer — touchline punditry. */
    soccer: [
      "It's a game of two halves, and they've only played one.",
      "They're getting no joy at all down the left.",
      "He's got a great engine on him.",
      "That's a big ask this late on.",
      "You take that result and you move on.",
      "They'll want to keep it tight for the first twenty.",
      "Set pieces win you games like this.",
      "You can't fault the effort. You can fault everything else.",
      "It's a squad game now. It always was.",
      "Nobody wants it to go to penalties. Everybody knows it will.",
      "He's found himself in acres of space there.",
      "That's a foul in any league in the world.",
      "Momentum is real, and also completely imaginary.",
      "They've got to be more clinical in the final third.",
      "One goal is never enough. Two is usually plenty.",
      "The keeper will want that one back.",
      "He'll have put those away in his sleep all week.",
      "They've had all of the ball and none of the chances.",
      "You can't defend a one-goal lead. Everyone tries anyway.",
      "The legs are going. You can see it from up here.",
      "That's why he's in the side.",
      "Great teams find a way. So do lucky ones.",
      "Football's a funny old game, which is what people say instead of explaining.",
      "The drama lives in the time added on.",
      "He's given the referee a decision to make.",
      "They're playing for the badge now.",
      "It's still eleven against eleven, whatever the table says.",
      "A clean sheet away from home is worth two at home."
    ],

    /* American football — booth punditry. */
    football: [
      "Games like this are won in the trenches.",
      "You have to establish the run to open up the play action.",
      "It's a copycat league.",
      "Defense travels.",
      "They just have to protect the football.",
      "Third and manageable is the whole ballgame.",
      "You don't want to be one-dimensional in December.",
      "Nobody remembers who won in September.",
      "It's a chess match out there, if chess had a punter.",
      "Field position is the stat nobody watches and everybody loses to.",
      "They need to take what the defense gives them.",
      "Availability is the best ability, which is a nice way of saying he's hurt.",
      "You can't teach size.",
      "He's a coach's son. You can tell.",
      "Special teams decides more games than anybody wants to admit.",
      "Time of possession means everything or nothing, depending on who won.",
      "Momentum is real right up until it isn't.",
      "They're going to have to score points to win this football game.",
      "Clock management is where seasons go to die.",
      "Turnover margin tells you the whole story.",
      "You have to finish drives.",
      "The red zone is a different sport entirely.",
      "Next man up, which is what you say when the first man's hurt.",
      "It's a long season. It's always a long season.",
      "They'll be watching this one on tape all week.",
      "That's a veteran move right there.",
      "The weather's a factor, and it favors whoever ends up winning.",
      "Play callers get too much credit and exactly enough blame.",
      "You take the points there. Every single time."
    ]
  };

  /* ---- Sport configuration ------------------------------ */
  var SPORTS = {
    soccer: {
      title: "SOCCER",
      subtitle: "&gt; Have an opinion ready.",
      footRight: "NINETY MINUTES",
      buttons: [
        { key: "soccer", icon: "⚽", label: "SOCCER QUOTES", cls: "wide" }
      ]
    },
    football: {
      title: "FOOTBALL",
      subtitle: "&gt; Have an opinion ready.",
      footRight: "FOUR QUARTERS",
      buttons: [
        { key: "football", icon: "🏈", label: "FOOTBALL QUOTES", cls: "wide" }
      ]
    }
  };

  /* Old v2 hashes, kept so any saved link still lands somewhere sensible. */
  var ALIASES = { worldcup: "soccer", chiefs: "football" };

  var MENU = {
    title: "THE&nbsp;FOOTBALL",
    subtitle: "&gt; Never be caught without something footbally to say.",
    footRight: "SELECT SPORT"
  };

  /* ---- State -------------------------------------------- */
  var muted = false;
  var currentPhrase = "";
  var bags = {};
  var preferredVoice = null;
  var booted = false;

  /* ---- Speech synthesis --------------------------------- */
  var synth = window.speechSynthesis || null;

  function pickVoice() {
    if (!synth) return;
    var voices = synth.getVoices() || [];
    if (!voices.length) return;
    // Prefer English (US or UK); fall back to any English, then default.
    var byLang = function (re) {
      return voices.filter(function (v) { return re.test(v.lang || ""); });
    };
    var pool = byLang(/^en[-_](US|GB)/i);
    if (!pool.length) pool = byLang(/^en/i);
    if (!pool.length) pool = voices;
    // Prefer a non-"novelty" default-ish voice if we can find one named Daniel/Samantha/Google.
    var nice = pool.filter(function (v) {
      return /daniel|samantha|google|microsoft|arthur|serena/i.test(v.name || "");
    });
    preferredVoice = (nice[0] || pool[0]) || null;
  }

  if (synth) {
    pickVoice();
    if (typeof synth.onvoiceschanged !== "undefined") {
      synth.onvoiceschanged = pickVoice;
    }
  }

  function stopSpeaking() {
    if (!synth) return;
    try { synth.cancel(); } catch (e) { /* ignore */ }
    phraseEl.classList.remove("speaking");
  }

  function speak(text) {
    if (!synth || muted || !text) return;
    try {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      if (preferredVoice) {
        u.voice = preferredVoice;
        u.lang = preferredVoice.lang;
      } else {
        u.lang = "en-US";
      }
      u.rate = 0.9;
      u.pitch = 1.0;
      u.volume = 1.0;
      u.onstart = function () { phraseEl.classList.add("speaking"); };
      u.onend = function () { phraseEl.classList.remove("speaking"); };
      u.onerror = function () { phraseEl.classList.remove("speaking"); };
      synth.speak(u);
    } catch (e) { /* ignore */ }
  }

  /* ---- Phrase selection (shuffle bag, no repeats until cycled) ----------- */
  /* Each bank draws from a shuffled bag of all its phrases; a phrase can't
     come up again until every other one has been used. When the bag empties
     it's reshuffled, and we reshuffle again if the new bag would start with
     the phrase we just showed, so there's no repeat across the boundary. */
  function shuffled(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function nextPhrase(bank) {
    var list = PHRASES[bank];
    if (!list || !list.length) return "";
    if (list.length === 1) return list[0];
    var state = bags[bank];
    if (!state || !state.queue.length) {
      var last = state ? state.last : null;
      var queue = shuffled(list);
      // Avoid an immediate repeat when a fresh bag begins with the last draw.
      if (queue[0] === last) queue.push(queue.shift());
      state = bags[bank] = { queue: queue, last: last };
    }
    var phrase = state.queue.shift();
    state.last = phrase;
    return phrase;
  }

  /* ---- DOM ---------------------------------------------- */
  var bootEl = document.getElementById("boot");
  var bootText = document.getElementById("bootText");
  var appEl = document.getElementById("app");
  var titleEl = document.getElementById("title");
  var subtitleEl = document.getElementById("subtitle");
  var viewMenu = document.getElementById("viewMenu");
  var viewQuote = document.getElementById("viewQuote");
  var readoutEl = document.getElementById("readout");
  var phraseEl = document.getElementById("phrase");
  var replayHint = document.getElementById("replayHint");
  var buttonsEl = document.getElementById("buttons");
  var footRight = document.getElementById("footRight");
  var muteBtn = document.getElementById("muteBtn");
  var backBtn = document.getElementById("backBtn");
  var btnSoccer = document.getElementById("btnSoccer");
  var btnFootball = document.getElementById("btnFootball");

  /* ---- Fit the phrase to the readout -------------------- */
  /* The banks vary from six words to twenty, so a fixed type size either
     wastes the screen or spills over the header and the buttons. Step the
     size down until the text fits the box it lives in. */
  var PHRASE_MAX = 34;
  var PHRASE_MIN = 11;

  function fitPhrase() {
    if (!phraseEl.textContent) return;
    // The readout centres its children, so overflow escapes top *and*
    // bottom and its own scrollHeight under-reports. Measure the phrase
    // against an explicit budget instead.
    var rs = window.getComputedStyle(readoutEl);
    var padY = parseFloat(rs.paddingTop) + parseFloat(rs.paddingBottom);
    var hintH = 0;
    if (!replayHint.hidden) {
      hintH = replayHint.offsetHeight +
        parseFloat(window.getComputedStyle(replayHint).marginTop);
    }
    var budget = readoutEl.clientHeight - padY - hintH - 2;
    if (budget <= 0) return;

    var size = Math.min(PHRASE_MAX, Math.round(readoutEl.clientWidth * 0.115));
    if (size < PHRASE_MIN) size = PHRASE_MIN;
    phraseEl.style.fontSize = size + "px";
    while (size > PHRASE_MIN && phraseEl.scrollHeight > budget) {
      size -= 1;
      phraseEl.style.fontSize = size + "px";
    }
  }

  var fitTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitPhrase, 120);
  });

  /* ---- Show a phrase ------------------------------------ */
  function showPhrase(bank, btn) {
    currentPhrase = nextPhrase(bank);
    phraseEl.textContent = currentPhrase;
    replayHint.hidden = false;
    fitPhrase();
    readoutEl.classList.remove("flash");
    // force reflow so the animation restarts
    void readoutEl.offsetWidth;
    readoutEl.classList.add("flash");
    if (btn) {
      btn.classList.remove("pressed");
      void btn.offsetWidth;
      btn.classList.add("pressed");
    }
    speak(currentPhrase);
  }

  /* ---- Views -------------------------------------------- */
  function setHead(cfg) {
    titleEl.innerHTML = cfg.title;
    subtitleEl.innerHTML = cfg.subtitle +
      '<span class="cursor" aria-hidden="true">█</span>';
    footRight.innerHTML = cfg.footRight;
  }

  function showMenu() {
    stopSpeaking();
    currentPhrase = "";
    setHead(MENU);
    viewQuote.hidden = true;
    viewMenu.hidden = false;
    backBtn.hidden = true;
  }

  function showSport(name) {
    var cfg = SPORTS[name];
    if (!cfg) { showMenu(); return; }
    stopSpeaking();
    currentPhrase = "";
    setHead(cfg);

    // Reset the readout and rebuild the button bank for this sport.
    phraseEl.style.fontSize = "";
    phraseEl.innerHTML = "&gt;&nbsp;AWAITING&nbsp;INPUT_";
    replayHint.hidden = true;
    buttonsEl.innerHTML = "";
    buttonsEl.className = "buttons" + (cfg.buttons.length === 1 ? " single" : "");

    cfg.buttons.forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "teamBtn" + (b.cls ? " " + b.cls : "");
      btn.setAttribute("aria-label", b.label);
      btn.innerHTML =
        '<span class="btnIcon" aria-hidden="true">' + b.icon + "</span>" +
        '<span class="btnLabel">' + b.label + "</span>";
      btn.addEventListener("click", function () { showPhrase(b.key, btn); });
      buttonsEl.appendChild(btn);
    });

    viewMenu.hidden = true;
    viewQuote.hidden = false;
    backBtn.hidden = false;
  }

  /* ---- Hash routing ------------------------------------- */
  function route() {
    if (!booted) return;
    var name = (location.hash || "").replace(/^#\/?/, "");
    if (ALIASES[name]) name = ALIASES[name];
    if (SPORTS[name]) showSport(name);
    else showMenu();
  }

  function go(name) {
    // Setting the hash fires hashchange, which routes for us.
    if (location.hash.replace(/^#\/?/, "") === name) route();
    else location.hash = name ? "#" + name : "";
  }

  window.addEventListener("hashchange", route);

  /* ---- Boot animation ----------------------------------- */
  var BOOT_LINES = [
    { t: "THE FOOTBALL v3.0", cls: "amber", after: 260 },
    { t: "", after: 90 },
    { t: "Initializing football database...", after: 560 },
    { t: "Loading football knowledge...", after: 560 },
    { t: "Loading other football knowledge...", after: 560 },
    { t: "Calibrating punditry module....", after: 520 },
    { t: "", after: 120 },
    { t: "Ready.", cls: "amber", after: 440 }
  ];

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function runBoot(done) {
    var html = "";
    var i = 0;
    function step() {
      if (i >= BOOT_LINES.length) {
        setTimeout(done, 320);
        return;
      }
      var line = BOOT_LINES[i];
      var text = escapeHtml(line.t);
      if (line.cls) text = '<span class="' + line.cls + '">' + text + "</span>";
      html += text + "\n";
      bootText.innerHTML = html + '<span class="cursor">█</span>';
      i++;
      setTimeout(step, line.after);
    }
    step();
  }

  var prefersReduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function startApp() {
    bootEl.hidden = true;
    appEl.hidden = false;
    booted = true;
    route();
  }

  if (prefersReduced) {
    // Skip the animated boot for reduced-motion users.
    startApp();
  } else {
    runBoot(startApp);
  }

  /* ---- Wiring ------------------------------------------- */
  btnSoccer.addEventListener("click", function () { go("soccer"); });
  btnFootball.addEventListener("click", function () { go("football"); });
  backBtn.addEventListener("click", function () { go(""); });

  // Tap the readout to replay the current phrase.
  function replay() {
    if (!currentPhrase) return;
    readoutEl.classList.remove("flash");
    void readoutEl.offsetWidth;
    readoutEl.classList.add("flash");
    speak(currentPhrase);
  }
  readoutEl.addEventListener("click", replay);
  readoutEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      replay();
    }
  });

  // Mute / unmute
  muteBtn.addEventListener("click", function () {
    muted = !muted;
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    muteBtn.setAttribute("aria-label", muted ? "Unmute voice" : "Mute voice");
    if (muted) stopSpeaking();
  });

  // Some mobile browsers gate speech behind a user gesture; the button
  // taps that trigger speak() already satisfy that, so nothing else needed.
})();
