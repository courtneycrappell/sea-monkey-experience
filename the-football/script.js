/* ===========================================================
   THE FOOTBALL — retro Chiefs companion
   Vanilla JS. Boot → phrase + voice.
   v4.0: American football only. The bank is TOPICAL for the
   2026 Chiefs season, by request — it will need a refresh before
   next season. Keep phrases to season-long storylines (comebacks,
   signings, coaching, the redemption arc), not weekly results, so
   nothing goes stale between September and February.
   =========================================================== */
(function () {
  "use strict";

  /* ---- Phrase bank ------------------------------------- */
  /* 2026 Chiefs, season-long storylines only: no scores, no records,
     no week numbers, no standings. Names are fine. If it could be
     false by next Sunday, it doesn't belong here. */
  var PHRASES = [
    /* Mahomes, back from the ACL */
    "Mahomes is back, the knee is fine, and the rest of the league is going to have to deal with that.",
    "The ACL is healed. The chip on the shoulder is not.",
    "Mahomes on a rebuilt knee is still better than most quarterbacks on two good ones.",
    "Mahomes came back. The playoffs will too.",
    "He tied Brady's win pace through 150 starts, in case anybody asks. Somebody will.",
    "A year of watching from the sideline did not make him patient. Good.",

    /* Kelce, un-retired */
    "Kelce said he was thinking about retiring. Then he thought about it some more.",
    "The Kelce retirement watch is now a Kelce touchdown watch.",
    "Every Kelce catch this year is a bonus track.",
    "Kelce has more yards after contact than a man his age has any right to.",
    "Kelce un-retired for a reason. That reason is a fourth ring.",
    "Kelce's last dance keeps getting extended, and nobody in this building is complaining.",

    /* Kenneth Walker III */
    "Kenneth Walker was a Super Bowl MVP for somebody else. We'll allow it.",
    "Walker doesn't go down on first contact. Or second. Somebody should tell the defense.",
    "Walker in the backfield means play action actually works again.",
    "Walker was the best player in the Super Bowl last year. Now he wears red. Somebody in the front office earned a raise.",
    "Mahomes has never had a running back like this. You can tell by the smile.",

    /* Bieniemy back at OC */
    "Bieniemy is back calling plays. Turns out the playbook missed him too.",
    "Bieniemy went to Chicago, saw what it was like, and came home.",
    "Bieniemy's back, the screen game's back, everything's back.",
    "Spending a year in Chicago made Bieniemy appreciate having a quarterback.",

    /* The 6-11 redemption arc */
    "6-11 was a typo. That's the official position of this household.",
    "Last year was a gap year. Everybody's allowed one.",
    "We don't talk about last season. We reference it obliquely.",
    "They called it a down year. It was a plot twist.",
    "The Kingdom does not do rebuilding years. We do reloading years with worse records.",
    "Last year taught us something. Mostly that we'd rather not learn anything.",
    "The AFC West goes through Arrowhead again. It just took a year off.",
    "A losing season buys you a high draft pick and a lot of humility. We kept the pick.",

    /* Reid, elder statesman */
    "Andy Reid has outlasted every other coach in the league, and he's not done ordering cheeseburgers.",
    "Reid's the longest-tenured coach in the league now. The walrus abides.",
    "Reid has been here longer than some of these rookies have been alive. Roughly.",
    "Reid still looks like he's about to say something profound, and it's usually about dinner.",
    "Same quarterback, same coach, same tight end, same expectations.",
    "Andy Reid has forgotten more trick plays than most coordinators have drawn up."
  ];

  /* ---- State -------------------------------------------- */
  var muted = false;
  var currentPhrase = "";
  var bag = null;
  var preferredVoice = null;

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
  /* Draw from a shuffled bag of all phrases; a phrase can't come up again
     until every other one has been used. When the bag empties it's
     reshuffled, and rotated if the new bag would start with the phrase we
     just showed, so there's no repeat across the boundary. */
  function shuffled(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function nextPhrase() {
    if (!PHRASES.length) return "";
    if (PHRASES.length === 1) return PHRASES[0];
    if (!bag || !bag.queue.length) {
      var last = bag ? bag.last : null;
      var queue = shuffled(PHRASES);
      // Avoid an immediate repeat when a fresh bag begins with the last draw.
      if (queue[0] === last) queue.push(queue.shift());
      bag = { queue: queue, last: last };
    }
    var phrase = bag.queue.shift();
    bag.last = phrase;
    return phrase;
  }

  /* ---- DOM ---------------------------------------------- */
  var bootEl = document.getElementById("boot");
  var bootText = document.getElementById("bootText");
  var appEl = document.getElementById("app");
  var readoutEl = document.getElementById("readout");
  var phraseEl = document.getElementById("phrase");
  var replayHint = document.getElementById("replayHint");
  var quoteBtn = document.getElementById("quoteBtn");
  var muteBtn = document.getElementById("muteBtn");

  /* ---- Fit the phrase to the readout -------------------- */
  /* The bank varies from six words to twenty, so a fixed type size either
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
  function showPhrase() {
    currentPhrase = nextPhrase();
    phraseEl.textContent = currentPhrase;
    replayHint.hidden = false;
    fitPhrase();
    readoutEl.classList.remove("flash");
    // force reflow so the animation restarts
    void readoutEl.offsetWidth;
    readoutEl.classList.add("flash");
    quoteBtn.classList.remove("pressed");
    void quoteBtn.offsetWidth;
    quoteBtn.classList.add("pressed");
    speak(currentPhrase);
  }

  /* ---- Boot animation ----------------------------------- */
  var BOOT_LINES = [
    { t: "THE FOOTBALL v4.0", cls: "amber", after: 260 },
    { t: "", after: 90 },
    { t: "Initializing football database...", after: 560 },
    { t: "Loading Chiefs knowledge...", after: 560 },
    { t: "Unloading last season...", after: 560 },
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
  }

  if (prefersReduced) {
    // Skip the animated boot for reduced-motion users.
    startApp();
  } else {
    runBoot(startApp);
  }

  /* Old links (#chiefs, #football, #worldcup, #soccer) all land here now;
     there's only one view, so the hash is simply ignored. */

  /* ---- Wiring ------------------------------------------- */
  quoteBtn.addEventListener("click", showPhrase);

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
