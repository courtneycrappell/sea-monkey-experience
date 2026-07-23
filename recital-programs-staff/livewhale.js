/* ============================================================================
   livewhale.js — pure LiveWhale (Style 2) fragment generator
   ----------------------------------------------------------------------------
   Turns a wizard snapshot ( buildSnapshot() output: { recitalDetails,
   programEntries, ... } ) into an inline-styled HTML fragment that can be
   pasted into a LiveWhale calendar event's  < >  Source Code box.

   WHY inline styles only: the LiveWhale event editor is TinyMCE, which STRIPS
   <style> blocks, <script>, and class="" attributes when the event is Saved.
   So every style is set inline, and the two-column title/composer rows use a
   borderless <table> (tables survive TinyMCE) instead of flexbox/classes.

   Pure + dependency-free: each program entry already carries its formatted
   .html (from the wizard's buildEntry) inside the snapshot, so this needs no
   wizard state and no app.js. Loaded standalone by staff.html.

   Style 2 = "Match the page": UMKC-blue sans-serif headings, no gold, no serif
   (see livewhale-embed/preview.html for the visual reference).
   ========================================================================== */
(function (global) {
  'use strict';

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Mirror of app.js hasDegreeFooter() — duplicated to keep this file standalone.
  function hasDegreeFooter(recitalType) {
    return ['Student Chamber Music Recital'].indexOf(recitalType) === -1;
  }

  // ── Style 2 inline-style constants ──
  var S = {
    wrap:       'max-width:620px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#333;line-height:1.5',
    kicker:     'text-align:center;font-size:12px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;color:#1b3f8f;margin:0 0 4px',
    performers: 'text-align:center;font-size:15px;color:#555',
    eventmeta:  'text-align:center;font-size:14px;color:#595959;margin:0 0 22px',
    lecture:    'text-align:center;font-style:italic;font-size:15px;color:#555;margin:0 0 18px',
    progHead:   'font-size:16px;font-weight:bold;color:#13294b;border-bottom:1px solid #ccd2dd;padding-bottom:6px;margin:0 0 16px',
    work:       'margin:0 0 18px',
    title:      'font-weight:bold;font-size:16px;color:#13294b',
    indent:     'padding-left:20px;font-size:15px;color:#444;margin-top:2px',
    perf:       'padding-left:20px;font-size:13px;color:#6b6b6b;font-style:italic;margin-top:3px',
    interm:     'text-align:center;font-size:13px;font-weight:bold;color:#13294b;margin:20px 0;text-transform:uppercase;letter-spacing:.08em',
    secHead:    'font-size:16px;font-weight:bold;color:#13294b;margin:22px 0 10px',
    para:       'font-size:14px;color:#333;margin:8px 0',
    fineWrap:   'border-top:1px solid #ddd;margin-top:22px;padding-top:14px',
    fine:       'font-size:13px;color:#6b6b6b;margin:6px 0'
  };

  // Borderless two-column row: title/label left, composer/dates right.
  function twoCol(leftHTML, rightHTML, indentLeft) {
    var lpad = indentLeft ? 'padding:0 0 0 20px' : 'padding:0';
    return '<table style="width:100%;border-collapse:collapse"><tr>' +
      '<td style="text-align:left;vertical-align:top;' + lpad + '">' + leftHTML + '</td>' +
      '<td style="text-align:right;vertical-align:top;padding:0 0 0 12px;color:#595959;font-size:14px">' + rightHTML + '</td>' +
      '</tr></table>';
  }

  // Strip anything executable out of entry HTML. This page loads a .json chosen
  // from disk, so by the time the markup gets here it is untrusted input — a
  // hand-edited project file can carry an event-handler attribute, and staff
  // opening it would run the author's code on a umkc.edu origin. The builder
  // has an equivalent scrub (sanitizeEntryHtml in app.js).
  // Allowlist, mirroring sanitizeEntryHtml() in app.js — keep the two in step.
  var ALLOWED_TAGS  = ['DIV','SPAN','EM','I','B','STRONG','BR','SUP','SUB','U','SMALL','P'];
  var ALLOWED_ATTRS = ['class', 'style'];
  var DROP_TAGS =
    'script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,' +
    'svg,math,template,base,noscript,audio,video,img,source,track,canvas,applet,frame,frameset';
  var BAD_STYLE = /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:/i;
  function safeStyle(v) { return !BAD_STYLE.test(String(v || '')); }

  function scrub(root) {
    // 1. Dangerous elements go entirely, subtree and all.
    Array.prototype.slice.call(root.querySelectorAll(DROP_TAGS))
      .forEach(function (n) { n.parentNode && n.parentNode.removeChild(n); });

    // 2. Unwrap anything else off the allowlist, keeping its text.
    var changed = true, guard = 0;
    while (changed && guard++ < 20) {
      changed = false;
      Array.prototype.slice.call(root.querySelectorAll('*')).forEach(function (el) {
        if (ALLOWED_TAGS.indexOf(el.tagName) !== -1 || !el.parentNode) return;
        while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
        el.parentNode.removeChild(el);
        changed = true;
      });
    }

    // 3. Strip non-allowlisted attributes; vet the survivors.
    Array.prototype.slice.call(root.querySelectorAll('*')).forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        var n = a.name.toLowerCase();
        if (ALLOWED_ATTRS.indexOf(n) === -1) el.removeAttribute(a.name);
        else if (n === 'style' && !safeStyle(a.value)) el.removeAttribute(a.name);
      });
    });
    return root;
  }

  // Restyle one entry's stored .html (which uses buildEntry's classes) into
  // inline-styled, TinyMCE-safe markup.
  function restyleEntry(html) {
    var doc  = new DOMParser().parseFromString('<body><div id="__r">' + html + '</div></body>', 'text/html');
    var root = doc.getElementById('__r');
    // No safe way to scrub a string we couldn't parse — escape it instead of
    // passing raw markup through.
    if (!root) return '<div style="' + S.indent + '">' + esc(html) + '</div>';
    scrub(root);

    // Manually-edited entries may be loose text with no element structure —
    // pass them through rather than dropping them.
    if (root.children.length === 0) {
      return '<div style="font-size:15px;color:#444">' + root.innerHTML + '</div>';
    }

    var out = '';
    Array.prototype.forEach.call(root.children, function (el) {
      var cl = el.classList;
      if (cl.contains('entry-row')) {
        // Title (left) + composer / dates / arranger (right, stacked)
        var titleEl   = el.querySelector('.entry-title');
        var titleHTML = titleEl ? '<span style="' + S.title + '">' + titleEl.innerHTML + '</span>' : '';
        var pieces = Array.prototype.map.call(
          el.querySelectorAll('.entry-composer, .entry-right, .entry-arranger'),
          function (s) { return s.innerHTML.trim(); }
        ).filter(Boolean);
        out += twoCol(titleHTML, pieces.join('<br>'), false);
      } else if (cl.contains('entry-indent-right')) {
        // Indented left label + right meta (movement+lyricist, or "from Work" + dates)
        var leftHTML = el.children.length ? el.children[0].innerHTML : el.innerHTML;
        var rEl = el.querySelector('.entry-right, .entry-lyr');
        out += twoCol('<span style="font-size:15px;color:#444">' + leftHTML + '</span>',
                      rEl ? rEl.innerHTML.trim() : '', true);
      } else if (cl.contains('entry-indent')) {
        out += '<div style="' + S.indent + '">' + el.innerHTML + '</div>';
      } else if (cl.contains('entry-perf')) {
        out += '<div style="' + S.perf + '">' + el.innerHTML + '</div>';
      } else {
        out += '<div style="font-size:15px;color:#444;margin-top:2px">' + el.innerHTML + '</div>';
      }
    });
    return out;
  }

  function paras(txt) {
    return String(txt || '')
      .split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean)
      .map(function (p) { return '<p style="' + S.para + '">' + esc(p).replace(/\n/g, '<br>') + '</p>'; })
      .join('');
  }

  /**
   * Build the Style 2 LiveWhale fragment from a wizard snapshot.
   * @param {object} snapshot - buildSnapshot() output.
   * @param {object} [opts]   - { includeEventDetails: true } adds a date · time · venue
   *                            line under the performers. Off by default because the
   *                            LiveWhale event page already shows those; on for archival PDFs.
   * @returns {string} inline-styled HTML fragment (empty string if no entries).
   */
  function buildLiveWhaleFragment(snapshot, opts) {
    snapshot = snapshot || {};
    opts     = opts || {};
    var rd      = snapshot.recitalDetails || {};
    var entries = snapshot.programEntries || [];

    // ── Program body ──
    var body = '';
    entries.forEach(function (item) {
      if (!item) return;
      if (item.type === 'intermission') {
        body += '<div style="' + S.interm + '">Intermission</div>';
      } else if (item.type === 'entry' && item.html) {
        body += '<div style="' + S.work + '">' + restyleEntry(item.html) + '</div>';
      }
    });
    if (!body) return '';

    // ── Hero (no date/time/venue — the event's left column already shows those) ──
    var kicker   = [rd.recitalType || 'Recital', rd.academicYear].filter(Boolean).join(' · ');
    var perfLine = [];
    var namePart = [rd.performerName, rd.instrument].filter(Boolean).map(esc).join(', ');
    if (namePart)       perfLine.push(namePart);
    if (rd.accompanist) perfLine.push(esc(rd.accompanist) + ', piano');
    (rd.additionalPerformers || '').split('\n').map(function (l) { return l.trim(); })
      .filter(Boolean).forEach(function (l) { perfLine.push(esc(l)); });

    // Event details (date · time · venue) — only for archival copies.
    var eventBits = [];
    if (opts.includeEventDetails) {
      if (rd.recitalDate) eventBits.push(esc(rd.recitalDate));
      var tv = [rd.recitalTime, rd.venue].filter(Boolean).map(esc).join(' · ');
      if (tv) eventBits.push(tv);
    }
    var showEvent = eventBits.length > 0;

    var hero = '';
    if (kicker) hero += '<div style="' + S.kicker + '">' + esc(kicker) + '</div>';
    if (perfLine.length) {
      hero += '<div style="' + S.performers + ';margin:0 0 ' + (showEvent ? '10px' : '22px') + '">' +
              perfLine.join(' · ') + '</div>';
    }
    if (showEvent) hero += '<div style="' + S.eventmeta + '">' + eventBits.join(' · ') + '</div>';
    if (rd.lectureTitle && rd.recitalType === 'Doctoral Lecture Recital') {
      hero += '<div style="' + S.lecture + '">“' + esc(rd.lectureTitle) + '”</div>';
    }

    // ── Program + optional Notes / Bio (plain sections, no accordions) ──
    var prog  = '<div style="' + S.progHead + '">Program</div>' + body;
    var notes = (rd.programNotes && rd.programNotes.trim())
      ? '<div style="' + S.secHead + '">Program Notes</div>' + paras(rd.programNotes) : '';
    var bio   = (rd.performerBio && rd.performerBio.trim())
      ? '<div style="' + S.secHead + '">About the Performer</div>' + paras(rd.performerBio) : '';

    // ── Fine print ──
    var fine = '';
    if (rd.profName && rd.performerName) {
      fine += '<p style="' + S.fine + '"><em>' + esc(rd.performerName) + ' is a student of ' +
              esc(rd.profTitle || 'Professor') + ' ' + esc(rd.profName) + '.</em></p>';
    }
    if (hasDegreeFooter(rd.recitalType) && rd.degree) {
      fine += '<p style="' + S.fine + '">This recital is presented in partial fulfillment of the requirements for the degree of ' +
              esc(rd.degree) + '.</p>';
    }
    fine += '<p style="' + S.fine + '">UMKC Conservatory recitals are recorded. Please silence all electronic devices and ' +
            'help us maintain a hall conducive to music-making.</p>';
    var fineBlock = '<div style="' + S.fineWrap + '">' + fine + '</div>';

    return '<div style="' + S.wrap + '">' + hero + prog + notes + bio + fineBlock + '</div>';
  }

  global.buildLiveWhaleFragment = buildLiveWhaleFragment;
})(typeof window !== 'undefined' ? window : this);
