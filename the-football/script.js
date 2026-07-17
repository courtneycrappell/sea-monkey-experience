/* ===========================================================
   THE FOOTBALL — retro World Cup companion
   Vanilla JS. Boot animation → two teams → phrase + voice.
   =========================================================== */
(function () {
  "use strict";

  /* ---- Phrase banks ------------------------------------- */
  var PHRASES = {
    arg: [
      "Classic Argentina.",
      "They're finding another gear now.",
      "This is exactly how Argentina likes to play.",
      "Argentina always looks dangerous in moments like this.",
      "They're staying patient.",
      "That was vintage Argentina.",
      "You can never count Argentina out.",
      "Argentina is controlling the tempo.",
      "That's the fighting spirit you'd expect.",
      "They're making Spain work for everything."
    ],
    esp: [
      "Classic Spain.",
      "Spain is keeping the ball brilliantly.",
      "That's vintage Spain.",
      "Spain is starting to control the rhythm.",
      "This is exactly how Spain wants the game.",
      "They're wearing Argentina down.",
      "Spain always finds another pass.",
      "They're sticking to their style.",
      "Spain looks confident now.",
      "They're making Argentina chase."
    ]
  };

  /* ---- State -------------------------------------------- */
  var muted = false;
  var currentPhrase = "";
  var lastIndex = { arg: -1, esp: -1 };
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
  function nextPhrase(team) {
    var list = PHRASES[team];
    if (!list || !list.length) return "";
    if (list.length === 1) return list[0];
    var i;
    do {
      i = Math.floor(Math.random() * list.length);
    } while (i === lastIndex[team]);
    lastIndex[team] = i;
    return list[i];
  }

  /* ---- DOM ---------------------------------------------- */
  var bootEl = document.getElementById("boot");
  var bootText = document.getElementById("bootText");
  var appEl = document.getElementById("app");
  var readoutEl = document.getElementById("readout");
  var phraseEl = document.getElementById("phrase");
  var replayHint = document.getElementById("replayHint");
  var btnArg = document.getElementById("btnArg");
  var btnEsp = document.getElementById("btnEsp");
  var muteBtn = document.getElementById("muteBtn");

  /* ---- Show a phrase for a team ------------------------- */
  function showPhrase(team, btn) {
    currentPhrase = nextPhrase(team);
    phraseEl.textContent = currentPhrase;
    replayHint.hidden = false;
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

  /* ---- Boot animation ----------------------------------- */
  var BOOT_LINES = [
    { t: "THE FOOTBALL v1.0", cls: "amber", after: 260 },
    { t: "", after: 90 },
    { t: "Initializing football database...", after: 620 },
    { t: "Loading football knowledge...", after: 620 },
    { t: "Calibrating punditry module....", after: 560 },
    { t: "", after: 120 },
    { t: "Ready.", cls: "amber", after: 460 }
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

  /* ---- Wiring ------------------------------------------- */
  btnArg.addEventListener("click", function () { showPhrase("arg", btnArg); });
  btnEsp.addEventListener("click", function () { showPhrase("esp", btnEsp); });

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
    if (muted && synth) {
      try { synth.cancel(); } catch (e) {}
      phraseEl.classList.remove("speaking");
    }
  });

  // Some mobile browsers gate speech behind a user gesture; the button
  // taps that trigger speak() already satisfy that, so nothing else needed.
})();
