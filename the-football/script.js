/* ===========================================================
   THE FOOTBALL — retro World Cup companion
   Vanilla JS. Boot animation → two teams → phrase + voice.
   =========================================================== */
(function () {
  "use strict";

  /* ---- Phrase banks ------------------------------------- */
  var PHRASES = {
    arg: [
      "This is Messi's last World Cup — you can feel it.",
      "No one comes back late like Argentina.",
      "Lautaro's always lurking for the winner.",
      "Back-to-back would put them among the immortals.",
      "Argentina thrives with their backs against the wall.",
      "Messi's still top of the Golden Boot race, you know.",
      "If this goes to penalties, Dibu Martinez is your man.",
      "They've needed a late goal every knockout round — why stop now?",
      "Enzo and De Paul just run this midfield.",
      "Everyone forgets Julian Alvarez is world-class too.",
      "No team's gone back-to-back since Brazil in the fifties.",
      "They're underdogs today, and that's how they like it.",
      "Give Messi one pocket of space and it's over.",
      "Scaloni always sets them up just right for a final.",
      "Twenty-one World Cup goals — nobody's scored more than Messi.",
      "This is the send-off that golden generation deserves.",
      "Mac Allister does the quiet work that makes it click.",
      "Argentina never panic, even a goal down.",
      "That 2022 core knows exactly how to win a final.",
      "You can never count out a team with Messi in it."
    ],
    esp: [
      "Spain's defense has been impenetrable all tournament.",
      "Just give it to Lamine Yamal and watch.",
      "Rodri runs this whole game from deep.",
      "This isn't the old tiki-taka — Spain's direct now.",
      "Oyarzabal always turns up in the big finals.",
      "Thirty-seven unbeaten — that's the longest streak ever.",
      "They've only conceded one goal the whole tournament.",
      "Yamal's nineteen and playing like a veteran.",
      "Pedri might be the best midfielder in the world right now.",
      "Spain are the favorites for a reason.",
      "They knocked France out without breaking a sweat.",
      "De la Fuente's got them peaking at the perfect time.",
      "Nico Williams on the other wing is just unfair.",
      "Cucurella never lets his winger breathe.",
      "This is the deepest Spain squad in years.",
      "They just keep the ball until you make a mistake.",
      "Yamal versus Messi — that's the whole story right there.",
      "Spain haven't won it since 2010, they want this.",
      "Unai Simon has barely had a save to make.",
      "Control the midfield and Spain control the final."
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
