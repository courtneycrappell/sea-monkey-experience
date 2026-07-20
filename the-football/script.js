/* ===========================================================
   THE FOOTBALL — retro football companion
   Vanilla JS. Boot → sport select → phrase + voice.
   Two sports: the 2026 World Cup (played) and the Chiefs (upcoming).
   =========================================================== */
(function () {
  "use strict";

  /* ---- Phrase banks ------------------------------------- */
  var PHRASES = {
    /* World Cup — the final is done: Spain 1–0 Argentina (a.e.t.),
       Ferran Torres 106', MetLife Stadium, 19 July 2026. */
    wc: [
      "Spain one, Argentina nil — and it took a hundred and six minutes.",
      "Ferran Torres comes off the bench and wins a World Cup.",
      "Twenty shots to two. That wasn't a final, that was a lecture.",
      "Second star for Spain. First since two thousand ten.",
      "Nineteen years old and Lamine Yamal's a world champion.",
      "Yamal walking over to Messi at the whistle — that's the photo of the tournament.",
      "Six World Cups for Messi. No man had ever done that.",
      "He just sat down on the turf. You didn't need words.",
      "Nobody's saying yet whether that's the last we see Messi in that shirt.",
      "Scaloni says he hasn't even asked him. Let the man breathe.",
      "Argentina couldn't get out of their own half after the hour.",
      "Nico Williams heads it down, Torres does the rest.",
      "Pedro Porro's cross doesn't get half the credit it deserves.",
      "Spain never lost control of it. That's the whole story.",
      "Pedri ran a World Cup final at his own tempo.",
      "That was the torch passing, right there in New Jersey.",
      "A World Cup final in the Meadowlands. Still getting used to that.",
      "The halftime show was, let's be honest, a lot.",
      "You could see Argentina's legs go in extra time.",
      "Spain went the whole tournament without ever looking rushed.",
      "Two shots. Argentina had two shots in a World Cup final.",
      "De la Fuente's got a World Cup now. Nobody wanted him three years ago.",
      "Unai Simon barely had a save to make and still won it.",
      "The scary part is this Spain side could win the next one too."
    ],

    /* Chiefs — hot takes for the 2026 season. */
    hot: [
      "Six and eleven wasn't a fluke. That window's shut.",
      "If Mahomes isn't right by September, they're picking top ten again.",
      "Trading Trent McDuffie is going to look like a disaster by November.",
      "Year fourteen of Andy Reid is one year too many.",
      "Justin Fields starts more games this year than anybody wants to admit.",
      "Kelce should have walked away after last season.",
      "Delane at number six was a reach and everyone in that building knows it.",
      "They rebuilt an entire secondary out of rookies and hope.",
      "Denver's the class of the AFC West now, and it's not close.",
      "Rashee Rice in a contract year is the only thing holding that receiver room together.",
      "Nussmeier is the most interesting player on the roster and he's third string.",
      "Nobody comes back from a knee like that and looks the same.",
      "Veach has drafted one real difference-maker in three years.",
      "That offensive line is a competition because nobody's won a job yet.",
      "Nine wins would be a great season and nobody wants to say it out loud.",
      "The dynasty talk ended the day they missed the playoffs.",
      "Opening on Monday night against Denver is a trap and they know it.",
      "They're built to win in January and they can't get out of October.",
      "If the secondary can't cover, Spags takes a blame that isn't his.",
      "This is the thinnest Chiefs roster of the entire Mahomes era."
    ],

    /* Chiefs — safe takes for the 2026 season. */
    safe: [
      "Camp opens the twenty-ninth. Everything before that is noise.",
      "Health is the season. That's the whole take.",
      "You never bet against Andy Reid in September.",
      "If Mahomes plays sixteen games, they're in the race.",
      "Six and eleven last year, so there's really only one direction left.",
      "Reid's had a full offseason to fix it. He usually does.",
      "The AFC West is going to be a fistfight again.",
      "Delane's got the talent. He just needs that shoulder right.",
      "Kelce on a snap count is still Kelce.",
      "They'll be smart with Mahomes early. No reason not to be.",
      "Week one on Monday night against Denver — what a way to open.",
      "A healthy Rashee Rice changes everything about that offense.",
      "Somebody always comes out of nowhere in St. Joe. Watch the young receivers.",
      "Young offensive lines get better in November.",
      "Spagnuolo will scheme something up. He always does.",
      "One year out of the playoffs isn't a rebuild.",
      "Fields is good insurance. You hope you never need it.",
      "It's July. Nobody's won or lost anything yet.",
      "Padded practices tell you more than minicamp ever did.",
      "Missing a season humbles a team. Sometimes that's the best thing for it."
    ]
  };

  /* ---- Sport configuration ------------------------------ */
  var SPORTS = {
    worldcup: {
      title: "WORLD&nbsp;CUP",
      subtitle: "&gt; The final is played. Have an opinion ready.",
      footRight: "ESP 1&ndash;0 ARG (AET)",
      buttons: [
        { key: "wc", icon: "⚽", label: "WORLD CUP QUOTES", cls: "wide" }
      ]
    },
    chiefs: {
      title: "THE&nbsp;CHIEFS",
      subtitle: "&gt; Camp opens July 29. Choose your risk level.",
      footRight: "2026 SEASON",
      buttons: [
        { key: "hot", icon: "🔥", label: "HOT TAKE" },
        { key: "safe", icon: "👍", label: "SAFE TAKE" }
      ]
    }
  };

  var MENU = {
    title: "THE&nbsp;FOOTBALL",
    subtitle: "&gt; Never be caught without something footbally to say.",
    footRight: "SELECT SPORT"
  };

  /* ---- State -------------------------------------------- */
  var muted = false;
  var currentPhrase = "";
  var lastIndex = {};
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

  /* ---- Phrase selection (no immediate repeat) ----------- */
  function nextPhrase(bank) {
    var list = PHRASES[bank];
    if (!list || !list.length) return "";
    if (list.length === 1) return list[0];
    if (!(bank in lastIndex)) lastIndex[bank] = -1;
    var i;
    do {
      i = Math.floor(Math.random() * list.length);
    } while (i === lastIndex[bank]);
    lastIndex[bank] = i;
    return list[i];
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
  var btnChiefs = document.getElementById("btnChiefs");

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
    { t: "THE FOOTBALL v2.0", cls: "amber", after: 260 },
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
  btnSoccer.addEventListener("click", function () { go("worldcup"); });
  btnChiefs.addEventListener("click", function () { go("chiefs"); });
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
