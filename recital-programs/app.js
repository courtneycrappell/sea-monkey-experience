// ════════════════════════════════════════════════════════════════
//  State
// ════════════════════════════════════════════════════════════════
let state = {};
let navHistory = [];
let isFinalized = false;
let programEntries = []; // [{type:'entry', html, text, entryState} | {type:'intermission'}]
let editingIndex = null; // null = new entry; number = editing existing
let recitalDetails = {};

function resetRecitalDetails() {
  recitalDetails = {
    academicYear:        autoAcademicYear(),
    recitalType:         '',
    performerName:       '',
    instrument:          '',
    recitalDate:         '',
    recitalDateISO:      '',
    recitalTime:         '',
    venue:               '',
    accompanist:         '',
    additionalPerformers:'',
    profTitle:           'Professor',
    profName:            '',
    degree:              '',
    lectureTitle:        '',
    programNotes:        '',   // Web Program (Beta) — optional
    performerBio:        '',   // Web Program (Beta) — optional
  };
}

function autoAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based; new academic year displayed starting August
  const startYear = month >= 7 ? year : year - 1;
  return startYear + '\u2013' + String(startYear + 1).slice(-2);
}

function resetState() {
  state = {
    // Path decisions
    workType:           null,   // 'complete' | 'excerpt'
    titleType:          null,   // 'distinctive' | 'genre'
    workSize:           null,   // 'multi' | 'single'
    excerptCount:       null,   // 'one' | 'multiple'

    // Complete work fields
    workTitle:          '',
    catalogType:        '',
    catalogNumber:      '',
    workDate:           '',
    nickname:           '',

    // Excerpt fields
    parentTitle:        '',
    parentCatalogType:  '',
    parentCatalogNumber:'',
    parentDate:         '',
    excerptOnePiece:    '',     // single aria/song title
    excerptMultiple:    '',     // multiple titles, one per line

    // Composer
    composerFirst:      '',
    composerLast:       '',
    composerLiving:     null,
    composerBorn:       '',
    composerDied:       '',

    // Movements
    movements:          '',
    lyricist:           '',

    // Credits
    arrangementRole:    'arr.',
    arrangementName:    '',
    performers:         '',
    premiereType:       '',
  };
  navHistory = [];
}

function updateState(key, value) {
  state[key] = value;
  renderPreview();
  autoSave();
}

// ════════════════════════════════════════════════════════════════
//  Navigation
// ════════════════════════════════════════════════════════════════
const ALL_SCREENS = [
  'welcome', 'recital-details', 'relationship', 'title-type', 'work-size',
  'excerpt-count', 'parent-work', 'excerpt-titles',
  'work-details', 'composer', 'movements', 'credits', 'result'
];

function hideAllScreens() {
  ALL_SCREENS.forEach(id => {
    const el = document.getElementById('screen-' + id);
    if (el) el.classList.remove('active');
  });
}

function goToScreen(id) {
  const current = ALL_SCREENS.find(s => {
    const el = document.getElementById('screen-' + s);
    return el && el.classList.contains('active');
  });
  if (current && current !== id) navHistory.push(current);

  hideAllScreens();
  const target = document.getElementById('screen-' + id);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
  renderProgressFor(id);
  renderPreview();
  updateEntryIndicator();
  const rdBack = document.getElementById('btn-rd-back');
  if (rdBack) rdBack.style.display = (id === 'recital-details' && navHistory.length) ? '' : 'none';
  if (id === 'recital-details' && recitalDetails.performerName) populateRecitalDetailsForm();
  autoSave();
}

function updateEntryIndicator() {
  const el    = document.getElementById('entry-indicator');
  const label = document.getElementById('entry-indicator-label');
  if (!el || !label) return;

  const current = ALL_SCREENS.find(s => {
    const scr = document.getElementById('screen-' + s);
    return scr && scr.classList.contains('active');
  });

  if (!current || current === 'welcome') { el.style.display = 'none'; return; }

  el.style.display = 'block';
  if (editingIndex !== null) {
    label.textContent = 'Editing Program Entry ' + (editingIndex + 1);
  } else {
    label.textContent = 'Program Entry ' + (programEntries.filter(e => e.type === 'entry').length + 1);
  }
}

function goBack() {
  if (!navHistory.length) return;
  const prev = navHistory.pop();
  hideAllScreens();
  const target = document.getElementById('screen-' + prev);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
  renderProgressFor(prev);
  renderPreview();
}

function finalizeEntry() {
  isFinalized = true;
  document.getElementById('preview-card')?.classList.add('finalized');
  const status = document.getElementById('preview-status');
  if (status) status.textContent = 'Entry finalized';
  const actions = document.getElementById('preview-actions');
  if (actions) actions.style.display = 'none';

  // Show/hide correct result screen buttons
  const addBtn   = document.getElementById('btn-add-to-program');
  const newBtns  = document.getElementById('new-entry-buttons');
  const saveRow  = document.getElementById('save-changes-row');
  const introTxt = document.getElementById('result-intro-text');
  if (editingIndex !== null) {
    if (newBtns) newBtns.style.display = 'none';
    if (saveRow) saveRow.style.display = 'flex';
    if (introTxt) introTxt.textContent = 'Review your changes. Click Save to update the entry in your program.';
  } else {
    if (newBtns) newBtns.style.display = 'flex';
    if (saveRow) saveRow.style.display = 'none';
    const n = programEntries.length;
    if (introTxt) introTxt.textContent = n > 0
      ? `Entry ${n + 1} ready. Click Add to program to save it and continue building.`
      : 'Review the formatted entry. Click Add to program to save it and format the next piece.';
  }
  goToScreen('result');
}

function returnToEditing() {
  isFinalized = false;
  document.getElementById('preview-card')?.classList.remove('finalized');
  const status = document.getElementById('preview-status');
  if (status) status.textContent = 'Updates as you fill in the wizard';
  // Only show preview actions if no program entries (otherwise program panel is shown)
  if (programEntries.length === 0) {
    const actions = document.getElementById('preview-actions');
    if (actions) actions.style.display = 'flex';
  }
  const hint = document.getElementById('preview-edit-hint');
  if (hint) hint.style.display = 'none';
  renderPreview();
  goBack();
}

function startOver() {
  if (programEntries.length > 0) {
    if (!confirm('This will clear your entire program. Start over?')) return;
  }
  isFinalized = false;
  editingIndex = null;
  programEntries = [];
  clearSavedSession();
  resetRecitalDetails();
  document.getElementById('preview-card')?.classList.remove('finalized');
  const hint = document.getElementById('preview-edit-hint');
  if (hint) hint.style.display = 'none';
  const status = document.getElementById('preview-status');
  if (status) status.textContent = 'Start answering questions →';
  const actions = document.getElementById('preview-actions');
  if (actions) actions.style.display = 'none';
  updateRightColumn();
  resetState();
  clearFormInputs();
  goToScreen('welcome');
  navHistory = [];
  updatePreviewPlaceholder();
}

function clearFormInputs() {
  document.querySelectorAll('input[type="text"], textarea').forEach(el => el.value = '');
  document.querySelectorAll('input[type="radio"]').forEach(el => el.checked = false);
  document.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
  document.querySelectorAll('.sub-fields').forEach(el => el.classList.remove('visible'));
  document.getElementById('cat-num-field').style.display = 'none';
  document.getElementById('cat-other-field').style.display = 'none';
  document.getElementById('nickname-field').style.display = 'none';
}

// ════════════════════════════════════════════════════════════════
//  Progress indicators
// ════════════════════════════════════════════════════════════════
function getStepList() {
  if (state.workType === 'excerpt') {
    return ['Work type', 'Source work', 'Pieces', 'Composer', 'Credits'];
  }
  const steps = ['Work type', 'Title style'];
  if (state.titleType === 'distinctive') steps.push('Work size');
  steps.push('Details', 'Composer');
  if (state.workSize === 'multi') steps.push('Movements');
  steps.push('Credits');
  return steps;
}

function getCurrentStepIndex(screenId) {
  const complete = state.workType === 'excerpt';
  if (!complete) {
    // Complete work path
    const map = {
      'relationship': 0, 'title-type': 1, 'work-size': 2,
      'work-details': state.titleType === 'distinctive' ? 3 : 2,
      'composer':     state.titleType === 'distinctive' ? 4 : 3,
      'movements':    state.titleType === 'distinctive' ? 5 : 4,
      'credits':      state.workSize === 'multi' ? (state.titleType === 'distinctive' ? 6 : 5) : (state.titleType === 'distinctive' ? 5 : 4),
    };
    return map[screenId] ?? 0;
  } else {
    const map = {
      'relationship': 0, 'excerpt-count': 0,
      'parent-work': 1, 'excerpt-titles': 2,
      'composer': 3, 'credits': 4
    };
    return map[screenId] ?? 0;
  }
}

function renderProgressFor(screenId) {
  const el = document.getElementById('progress-' + screenId);
  if (!el) return;
  const steps = getStepList();
  const currentIdx = getCurrentStepIndex(screenId);
  el.innerHTML = steps.map((s, i) => {
    const cls = i < currentIdx ? 'progress-step complete' : i === currentIdx ? 'progress-step active' : 'progress-step';
    return `<div class="${cls}">${s}</div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════════
//  Auto-advance handlers (radio screens)
// ════════════════════════════════════════════════════════════════
function initRadioHandlers() {
  // Relationship
  document.querySelectorAll('input[name="relationship"]').forEach(r => {
    r.addEventListener('change', () => {
      state.workType = r.value;
      setTimeout(() => {
        if (r.value === 'complete') goToScreen('title-type');
        else goToScreen('excerpt-count');
      }, 180);
    });
  });

  // Title type
  document.querySelectorAll('input[name="titleType"]').forEach(r => {
    r.addEventListener('change', () => {
      state.titleType = r.value;
      // Show/hide nickname field on work-details screen
      const nf = document.getElementById('nickname-field');
      if (nf) nf.style.display = r.value === 'genre' ? 'flex' : 'none';
      // Update work-details question hint
      updateWorkDetailsQuestion();
      setTimeout(() => {
        updateWorkSizeScreen();
        goToScreen('work-size');
      }, 180);
    });
  });

  // Work size
  document.querySelectorAll('input[name="workSize"]').forEach(r => {
    r.addEventListener('change', () => {
      state.workSize = r.value;
      updateWorkDetailsQuestion();
      setTimeout(() => goToScreen('work-details'), 180);
    });
  });

  // Excerpt count
  document.querySelectorAll('input[name="excerptCount"]').forEach(r => {
    r.addEventListener('change', () => {
      state.excerptCount = r.value;
      setTimeout(() => goToScreen('parent-work'), 180);
    });
  });
}

function updateWorkDetailsQuestion() {
  const q = document.getElementById('work-details-question');
  const hint = document.getElementById('title-hint');
  if (!q) return;
  if (state.titleType === 'genre') {
    q.textContent = 'Enter the genre title and details';
    if (hint) hint.textContent = 'Enter the title exactly: e.g. "Piano Sonata No. 6 in F Major" or "Nocturne in E-flat Major"';
  } else if (state.workSize === 'multi') {
    q.textContent = 'Enter the work\'s title and details';
    if (hint) hint.textContent = 'This title will be italicized — e.g. Dichterliebe, Three Irish Legends, Six Elizabethan Songs';
  } else {
    q.textContent = 'Enter the piece\'s title and details';
    if (hint) hint.textContent = 'This title will be in quotation marks — e.g. Beau soir, A Dream, Turning Point';
  }
}

function updateWorkSizeScreen() {
  const isGenre = state.titleType === 'genre';
  const q    = document.getElementById('ws-question');
  const qsub = document.getElementById('ws-question-sub');
  const mLbl = document.getElementById('ws-multi-label');
  const mSub = document.getElementById('ws-multi-sub');
  const sLbl = document.getElementById('ws-single-label');
  const sSub = document.getElementById('ws-single-sub');
  if (!q) return;
  if (isGenre) {
    q.childNodes[0].textContent = 'Does this work have multiple movements?';
    if (qsub) qsub.textContent = 'If yes, you\'ll enter the movement names on the next screen.';
    if (mLbl) mLbl.innerHTML = 'Yes — multi-movement work';
    if (mSub) mSub.textContent = 'Sonata, symphony, suite, concerto, string quartet, etc. — you\'ll list the movements.';
    if (sLbl) sLbl.innerHTML = 'No — single movement or short piece';
    if (sSub) sSub.textContent = 'Nocturne, impromptu, étude, prelude, single piece from a set, etc.';
  } else {
    q.childNodes[0].textContent = 'Is this a larger work, or a single short piece?';
    if (qsub) qsub.textContent = 'Larger works get italics. Single short pieces get quotation marks.';
    if (mLbl) mLbl.innerHTML = 'Larger / multi-movement work → <em>italics</em>';
    if (mSub) mSub.textContent = 'Song cycles, operas, oratorios, cantatas, multi-movement instrumental works — e.g., Dichterliebe, Six Elizabethan Songs, Three Irish Legends';
    if (sLbl) sLbl.innerHTML = 'Single short piece → “quotation marks”';
    if (sSub) sSub.textContent = 'One song, one aria, one short instrumental — e.g., Beau soir, A Dream, Turning Point';
  }
}

// ════════════════════════════════════════════════════════════════
//  Advance handlers (form screens)
// ════════════════════════════════════════════════════════════════
function advanceFromParentWork() {
  // Set up excerpt-titles screen based on count
  const q = document.getElementById('excerpt-titles-question');
  const fields = document.getElementById('excerpt-titles-fields');
  if (state.excerptCount === 'one') {
    q.textContent = 'What aria, song, or movement are you performing?';
    fields.innerHTML = `
      <div class="field">
        <label for="excerpt-one-title">Aria / song title</label>
        <input type="text" id="excerpt-one-title" placeholder='e.g. Glitter and Be Gay'
               oninput="updateState('excerptOnePiece', this.value)">
      </div>`;
    const inp = document.getElementById('excerpt-one-title');
    if (inp) inp.value = state.excerptOnePiece || '';
  } else {
    q.textContent = 'List the pieces you are performing';
    fields.innerHTML = `
      <div class="field">
        <label for="excerpt-multi-titles">Titles (one per line)</label>
        <textarea id="excerpt-multi-titles" rows="5"
                  placeholder="Erbarme dich&#10;Können tränen&#10;Et exultavit"
                  oninput="updateState('excerptMultiple', this.value)"></textarea>
        <span class="field-hint">One per line. To add a per-song arranger, type a pipe after the title: e.g. "Hello" | arr. Jim Snell</span>
      </div>`;
    const ta = document.getElementById('excerpt-multi-titles');
    if (ta) ta.value = state.excerptMultiple || '';
  }
  goToScreen('excerpt-titles');
}

function advanceFromExcerptTitles() {
  goToScreen('composer');
}

function advanceFromWorkDetails() {
  if (!state.workTitle.trim()) return;
  goToScreen('composer');
}

function advanceFromComposer() {
  const valMsg = document.getElementById('composer-val');
  if (!state.composerLast.trim()) {
    valMsg.classList.add('show');
    return;
  }
  valMsg.classList.remove('show');
  // Go to movements only if multi-movement complete work
  if (state.workType === 'complete' && state.workSize === 'multi') {
    goToScreen('movements');
  } else {
    goToScreen('credits');
  }
}

function advanceFromMovements() {
  goToScreen('credits');
}

// ════════════════════════════════════════════════════════════════
//  Composer status handlers
// ════════════════════════════════════════════════════════════════
function updateComposerStatus(val) {
  state.composerLiving = (val === 'living');
  document.getElementById('deceased-fields').classList.toggle('visible', val === 'deceased');
  document.getElementById('living-fields').classList.toggle('visible', val === 'living');
  renderPreview();
}

// ════════════════════════════════════════════════════════════════
//  Catalog type handler
// ════════════════════════════════════════════════════════════════
function updateCatalogType(val) {
  state.catalogType = (val === 'other') ? '' : val;
  const numField   = document.getElementById('cat-num-field');
  const otherField = document.getElementById('cat-other-field');
  // Show number field for known catalogs; show both fields for 'other'
  numField.style.display   = (val && val !== '') ? 'flex' : 'none';
  otherField.style.display = (val === 'other') ? 'flex' : 'none';
  if (val !== 'other') {
    document.getElementById('cat-num-field').style.display = val ? 'flex' : 'none';
  }
  renderPreview();
}

// ════════════════════════════════════════════════════════════════
//  Arrangement status handler
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
//  Credits accordion
// ════════════════════════════════════════════════════════════════
function toggleCredits(section) {
  const header = document.getElementById(section + '-header');
  const body   = document.getElementById(section + '-body');
  if (!header || !body) return;
  const isOpen = header.classList.contains('open');
  header.classList.toggle('open', !isOpen);
  body.classList.toggle('open', !isOpen);
}

// ════════════════════════════════════════════════════════════════
//  Rules Engine
// ════════════════════════════════════════════════════════════════

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Normalize text for jsPDF rendering: Latin-1 chars pass through unchanged;
// characters above U+00FF (e.g. ō, ā, ş) are decomposed to their ASCII base.
// This preserves é, ü, ä, ç, ñ while fixing garbled rendering of ō in "Tōru".
function normalizePdfText(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')  // curly double quotes \u2192 straight
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")  // curly single quotes \u2192 straight
    .split('').map(ch => {
      if (ch.charCodeAt(0) <= 255) return ch;
      // en-dash (\u2013) and em-dash (\u2014) are in WinAnsi -- jsPDF renders them correctly
      if (ch === '\u2013' || ch === '\u2014') return ch;
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return (base && base.charCodeAt(0) <= 127) ? base : '?';
    }).join('');
}

function formatCatalogStr(type, number) {
  if (!type || !number) return '';
  const t = type.trim();
  const n = number.trim();
  if (!n) return '';
  // Catalog systems that don't need a space before the number
  const noSpace = ['D.', 'Hob.', 'J.'];
  return ', ' + t + (noSpace.includes(t) ? '' : ' ') + n;
}

function formatDateStr(dateStr) {
  if (!dateStr) return '';
  return ' (' + dateStr.trim() + ')';
}

function formatComposerDates(born, died, living) {
  if (!born) return '';
  if (living) return '(b. ' + born + ')';
  if (died)   return '(' + born + '–' + died + ')';
  return '(b. ' + born + ')';
}

function formatComposerName() {
  const first = state.composerFirst.trim();
  const last  = state.composerLast.trim();
  if (!last) return '';
  return first ? first + ' ' + last : last;
}

function formatArrangerLine() {
  if (!state.arrangementName.trim()) return '';
  const role = state.arrangementRole || 'arr.';
  return role + ' ' + state.arrangementName.trim();
}

function formatMovementList(movementsStr, lyricist) {
  if (!movementsStr.trim()) return '';
  const lines = movementsStr.split('\n').map(l => l.trim()).filter(l => l);
  return lines.map((line, i) => {
    const lyrPart = (i === 0 && lyricist) ? '    lyr. ' + lyricist : '';
    return '    ' + line + lyrPart;
  }).join('\n');
}

function formatPerformerList(performersStr) {
  if (!performersStr.trim()) return '';
  const lines = performersStr.split('\n').map(l => l.trim()).filter(l => l);
  return lines.map(l => '          ' + l).join('\n');
}

// Build the title HTML string (with <em> or quotes)
function buildTitleHTML() {
  const title = state.workTitle.trim();
  if (!title) return '';
  const cat   = formatCatalogStr(state.catalogType, state.catalogNumber);
  const date  = formatDateStr(state.workDate);

  if (state.titleType === 'genre') {
    const nick = state.nickname.trim().replace(/^[“””’’’]+|[“””’’’]+$/g, '');
    // American style: comma inside closing quote when catalog follows
    const nickPart = nick ? (cat ? ', &quot;' + esc(nick) + ',&quot;' : ', &quot;' + esc(nick) + '&quot;') : '';
    const catPart  = nick && cat ? esc(cat.slice(1)) : esc(cat);
    return esc(title) + nickPart + catPart + esc(date);
  }
  if (state.workSize === 'single') {
    // American style: comma inside closing quotation mark
    if (cat.startsWith(', ')) {
      return '&quot;' + esc(title) + ',&quot;' + esc(cat.slice(1)) + esc(date);
    }
    return '&quot;' + esc(title) + '&quot;' + esc(cat) + esc(date);
  }
  // multi
  return '<em>' + esc(title) + '</em>' + esc(cat) + esc(date);
}

// Build excerpt title HTML string
function buildExcerptTitleHTML() {
  if (state.excerptCount === 'one') {
    const piece = state.excerptOnePiece.trim();
    if (!piece) return '';
    // American style: comma inside closing quotation mark if catalog follows
    // (excerpts typically have no catalog, but apply consistently)
    return '”' + esc(piece) + '”';
  }
  return '';
}

function buildParentWorkRef() {
  const title = state.parentTitle.trim();
  if (!title) return '';
  const cat  = formatCatalogStr(state.parentCatalogType, state.parentCatalogNumber);
  const date = formatDateStr(state.parentDate);
  return '<em>' + esc(title) + '</em>' + esc(cat) + esc(date);
}

// ════════════════════════════════════════════════════════════════
//  Entry builder — returns { html, text }
// ════════════════════════════════════════════════════════════════
function buildEntry() {
  if (!state.workType) return null;
  const composerName  = formatComposerName();
  const composerDates = formatComposerDates(state.composerBorn, state.composerDied, state.composerLiving);
  const arrangerLine  = formatArrangerLine();
  const performers    = formatPerformerList(state.performers);
  const premiere      = state.premiereType.trim();

  let htmlLines = [];
  let textLines = [];

  if (state.workType === 'complete') {
    const titleHTML = buildTitleHTML();
    if (!titleHTML && !composerName) return null;

    // Row 1: Title ........ Composer
    htmlLines.push(
      '<div class="entry-row">' +
      '<span class="entry-title">' + (titleHTML || '&mdash;') + '</span>' +
      (composerName ? '<span class="entry-composer">' + esc(composerName) + '</span>' : '') +
      '</div>'
    );
    textLines.push((state.workTitle || '—') + (composerName ? '    ' + composerName : ''));

    // Row 2: Composer dates (right-aligned)
    if (composerDates) {
      htmlLines.push('<div class="entry-row"><span></span><span class="entry-right">' + esc(composerDates) + '</span></div>');
      textLines.push('                                          ' + composerDates);
    }

    // Arrangement (right-aligned, below dates)
    if (arrangerLine) {
      const arrLines = arrangerLine.split('\n');
      arrLines.forEach(al => {
        htmlLines.push('<div class="entry-row"><span></span><span class="entry-arranger">' + esc(al) + '</span></div>');
        textLines.push('                                          ' + al);
      });
    }

    // Premiere
    if (premiere) {
      htmlLines.push('<div class="entry-indent">(' + esc(premiere) + ')</div>');
      textLines.push('    (' + premiere + ')');
    }

    // Movements
    if (state.workSize === 'multi' && state.movements.trim()) {
      const movLines = state.movements.split('\n').map(l => l.trim()).filter(l => l);
      movLines.forEach((line, i) => {
        const lyr = (i === 0 && state.lyricist.trim()) ? '    lyr. ' + state.lyricist.trim() : '';
        if (lyr) {
          htmlLines.push(
            '<div class="entry-indent-right">' +
            '<span>' + esc(line) + '</span>' +
            '<span style="font-size:0.8rem;color:var(--muted)">' + esc(lyr.trim()) + '</span>' +
            '</div>'
          );
        } else {
          htmlLines.push('<div class="entry-indent">' + esc(line) + '</div>');
        }
        textLines.push('    ' + line + lyr);
      });
    }

    // Per-piece performers
    if (state.performers.trim()) {
      const perfLines = state.performers.split('\n').map(l => l.trim()).filter(l => l);
      perfLines.forEach(pl => {
        htmlLines.push('<div style="text-align:center;font-size:0.85rem;margin-top:0.2rem">' + esc(pl) + '</div>');
        textLines.push('          ' + pl);
      });
    }

  } else {
    // EXCERPT path
    if (state.excerptCount === 'one') {
      const pieceHTML = buildExcerptTitleHTML();
      const parentRef = buildParentWorkRef();

      if (!pieceHTML && !parentRef) return null;

      // American style: comma inside closing quote when “from *Work*” follows on next line
      const pieceDisplay = (pieceHTML && parentRef) ? pieceHTML.replace(/”$/, ',”') : pieceHTML;

      // Row 1: “Aria Title,” ........ Composer
      htmlLines.push(
        '<div class=”entry-row”>' +
        '<span class=”entry-title”>' + (pieceDisplay || '&mdash;') + '</span>' +
        (composerName ? '<span class=”entry-composer”>' + esc(composerName) + '</span>' : '') +
        '</div>'
      );
      textLines.push((state.excerptOnePiece ? '”' + state.excerptOnePiece + (parentRef ? ',' : '') + '”' : '—') +
        (composerName ? '    ' + composerName : ''));

      // Row 2: from *Parent Work*, Catalog (Year)     (dates)
      if (parentRef) {
        const datesHTML = composerDates ? '<span class="entry-right">' + esc(composerDates) + '</span>' : '';
        htmlLines.push(
          '<div class="entry-indent-right">' +
          '<span>from ' + parentRef + '</span>' +
          datesHTML +
          '</div>'
        );
        textLines.push('    from ' + state.parentTitle +
          (state.parentCatalogType ? ', ' + state.parentCatalogType + ' ' + state.parentCatalogNumber : '') +
          (state.parentDate ? ' (' + state.parentDate + ')' : '') +
          (composerDates ? '    ' + composerDates : ''));
      } else if (composerDates) {
        // No parent work — render dates on their own right-aligned row
        htmlLines.push(
          '<div class="entry-indent-right">' +
          '<span></span>' +
          '<span class="entry-right">' + esc(composerDates) + '</span>' +
          '</div>'
        );
        textLines.push('    ' + composerDates);
      }

    } else {
      // Multiple: individual songs first at main level, then "from Work" below
      const parentRef = buildParentWorkRef();
      if (!parentRef && !state.excerptMultiple.trim()) return null;

      const rightMetaHTML = [];
      if (composerName)  rightMetaHTML.push({ cls: 'entry-composer', text: composerName });
      if (composerDates) rightMetaHTML.push({ cls: 'entry-right',    text: composerDates });
      if (arrangerLine)  arrangerLine.split('\n').filter(al => al.trim()).forEach(al => rightMetaHTML.push({ cls: 'entry-arranger', text: al }));

      let rightIdx = 0;
      if (state.excerptMultiple.trim()) {
        const pieces = state.excerptMultiple.split('\n').map(l => l.trim()).filter(l => l);
        pieces.forEach(rawLine => {
          const sepIdx    = rawLine.indexOf(' | ');
          const songTitle = sepIdx >= 0 ? rawLine.slice(0, sepIdx).trim() : rawLine;
          const songArr   = sepIdx >= 0 ? rawLine.slice(sepIdx + 3).trim() : '';
          if (songArr) {
            htmlLines.push(
              '<div class="entry-row">' +
              '<span class="entry-title">' + esc(songTitle) + '</span>' +
              '<span class="entry-arranger" style="font-size:0.8rem">' + esc(songArr) + '</span>' +
              '</div>'
            );
            textLines.push(songTitle + '    ' + songArr);
          } else if (rightIdx < rightMetaHTML.length) {
            const rm = rightMetaHTML[rightIdx++];
            htmlLines.push(
              '<div class="entry-row">' +
              '<span class="entry-title">' + esc(songTitle) + '</span>' +
              '<span class="' + rm.cls + '">' + esc(rm.text) + '</span>' +
              '</div>'
            );
            textLines.push(songTitle + '    ' + rm.text);
          } else {
            htmlLines.push(
              '<div class="entry-row">' +
              '<span class="entry-title">' + esc(songTitle) + '</span>' +
              '<span></span>' +
              '</div>'
            );
            textLines.push(songTitle);
          }
        });
      }
      // Any remaining right-side metadata
      while (rightIdx < rightMetaHTML.length) {
        const rm = rightMetaHTML[rightIdx++];
        htmlLines.push('<div class="entry-row"><span></span><span class="' + rm.cls + '">' + esc(rm.text) + '</span></div>');
        textLines.push('                                          ' + rm.text);
      }
      // "from Work" at the bottom, indented
      if (parentRef) {
        htmlLines.push('<div class="entry-indent">from ' + parentRef + '</div>');
        textLines.push('    from ' + state.parentTitle +
          (state.parentCatalogType ? ', ' + state.parentCatalogType + ' ' + state.parentCatalogNumber : '') +
          (state.parentDate ? ' (' + state.parentDate + ')' : ''));
      }
    }

    // Arrangement for non-excerpt-multiple paths (excerpt-one and complete work)
    if (state.workType !== 'excerpt' || state.excerptCount !== 'multiple') {
      if (arrangerLine) {
        const arrLines = arrangerLine.split('\n');
        arrLines.forEach(al => {
          htmlLines.push('<div class="entry-row"><span></span><span class="entry-arranger">' + esc(al) + '</span></div>');
          textLines.push('                                          ' + al);
        });
      }
    }

    // Premiere
    if (premiere) {
      htmlLines.push('<div class="entry-indent">(' + esc(premiere) + ')</div>');
      textLines.push('    (' + premiere + ')');
    }

    // Performers
    if (state.performers.trim()) {
      const perfLines = state.performers.split('\n').map(l => l.trim()).filter(l => l);
      perfLines.forEach(pl => {
        htmlLines.push('<div style="text-align:center;font-size:0.85rem;margin-top:0.2rem">' + esc(pl) + '</div>');
        textLines.push('          ' + pl);
      });
    }
  }

  return {
    html: htmlLines.join('\n'),
    text: textLines.join('\n')
  };
}

// ════════════════════════════════════════════════════════════════
//  Preview renderer
// ════════════════════════════════════════════════════════════════
function renderPreview() {
  if (isFinalized) return;
  const el = document.getElementById('preview-output');
  const statusEl = document.getElementById('preview-status');
  const actionsEl = document.getElementById('preview-actions');

  const entry = buildEntry();

  if (!entry || (!entry.html.trim())) {
    updatePreviewPlaceholder();
    if (actionsEl) actionsEl.style.display = 'none';
    return;
  }

  el.classList.remove('placeholder');
  el.innerHTML = entry.html;
  if (statusEl) statusEl.textContent = 'Updates as you fill in the wizard';
  // Only show preview actions when program panel is not active
  if (actionsEl && programEntries.length === 0) actionsEl.style.display = 'flex';

  // Also update result screen if visible
  const resultOutput = document.getElementById('result-output');
  if (resultOutput) resultOutput.innerHTML = entry.html;
}

function updatePreviewPlaceholder() {
  const el = document.getElementById('preview-output');
  const entry = buildEntry();
  if (el && (!entry || !entry.html.trim())) {
    el.classList.add('placeholder');
    el.innerHTML = 'Your formatted entry will appear here as you fill in the wizard.';
    const statusEl = document.getElementById('preview-status');
    if (statusEl) statusEl.textContent = 'Start answering questions →';
  }
}

// ════════════════════════════════════════════════════════════════
//  Copy + Edit
// ════════════════════════════════════════════════════════════════
function getPlainText() {
  const entry = buildEntry();
  return entry ? entry.text : '';
}

function copyPreview() {
  const text = getPlainText();
  if (!text) return;
  writeToClipboard(text, 'preview-copy-confirm');
}

function copyResult() {
  // Use edited content if in edit mode, otherwise the clean plain-text build
  let text;
  if (editMode) {
    const el = document.getElementById('result-output');
    text = el ? (el.innerText || '').trim() : '';
  } else {
    text = getPlainText();
  }
  if (!text) return;
  writeToClipboard(text, 'copy-confirm');
}

function writeToClipboard(text, confirmId) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showCopyConfirm(confirmId))
      .catch(() => fallbackCopy(text, confirmId));
  } else {
    fallbackCopy(text, confirmId);
  }
}

function fallbackCopy(text, confirmId) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* silent */ }
  document.body.removeChild(ta);
  showCopyConfirm(confirmId);
}

function showCopyConfirm(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

let editMode = false;
function toggleEdit() {
  const el = document.getElementById('result-output');
  if (!el) return;
  editMode = !editMode;
  el.setAttribute('contenteditable', editMode ? 'true' : 'false');
  // Update the Edit text button in the active btn-row
  const btns = document.querySelectorAll('#new-entry-buttons .btn-secondary, #save-changes-row .btn-secondary');
  btns.forEach(b => { if (b.textContent.includes('Edit') || b.textContent.includes('Done')) b.textContent = editMode ? 'Done editing' : 'Edit text'; });
  if (editMode) el.focus();
}

function editPreview() {
  const el = document.getElementById('preview-output');
  if (!el) return;
  el.setAttribute('contenteditable', 'true');
  el.classList.add('editable');
  el.focus();
  const hint = document.getElementById('preview-edit-hint');
  if (hint) hint.style.display = 'block';
}

// ════════════════════════════════════════════════════════════════
//  Result screen render
// ════════════════════════════════════════════════════════════════
function renderResultScreen() {
  const entry = buildEntry();
  const el = document.getElementById('result-output');
  if (el && entry) el.innerHTML = entry.html;
}

// Override goToScreen for result to trigger result render
const _goToScreen = goToScreen;
// goToScreen already calls renderPreview which updates result-output if visible

// ════════════════════════════════════════════════════════════════
//  Program List — Add / Edit / Remove / Clear
// ════════════════════════════════════════════════════════════════
function addToProgram() {
  const entry = buildEntry();
  if (!entry) return;
  programEntries.push({
    type: 'entry',
    html: entry.html,
    text: entry.text,
    entryState: JSON.parse(JSON.stringify(state))
  });
  renderProgramList();
  updateRightColumn();
  autoSave();

  // Reset for next entry
  isFinalized = false;
  editingIndex = null;
  editMode = false;
  navHistory = [];
  resetState();
  clearFormInputs();

  // Unfreeze preview column state (now showing program panel)
  document.getElementById('preview-card')?.classList.remove('finalized');

  goToScreen('relationship');
}

function saveProgramEntry() {
  const entry = buildEntry();
  if (!entry || editingIndex === null) return;
  programEntries[editingIndex] = {
    type: 'entry',
    html: entry.html,
    text: entry.text,
    entryState: JSON.parse(JSON.stringify(state))
  };
  renderProgramList();
  autoSave();

  editingIndex = null;
  editMode = false;
  isFinalized = false;
  navHistory = [];
  resetState();
  clearFormInputs();
  goToScreen('relationship');
}

function cancelEditEntry() {
  editingIndex = null;
  editMode = false;
  isFinalized = false;
  navHistory = [];
  resetState();
  clearFormInputs();
  goToScreen('relationship');
}

function deleteProgramEntry(index) {
  programEntries.splice(index, 1);
  renderProgramList();
  updateRightColumn();
  autoSave();
}

function clearProgram() {
  if (!confirm('Remove all entries from the program?')) return;
  programEntries = [];
  editingIndex = null;
  clearSavedSession();
  renderProgramList();
  updateRightColumn();
}

function editProgramEntry(index) {
  if (!programEntries[index] || programEntries[index].type !== 'entry') return;
  editingIndex = index;
  isFinalized = false;
  editMode = false;

  // Restore saved state
  state = JSON.parse(JSON.stringify(programEntries[index].entryState));
  navHistory = [];

  // Unfreeze preview
  document.getElementById('preview-card')?.classList.remove('finalized');

  // Populate form fields
  populateFormFromState(state);

  // Navigate to first text-input screen for this path
  const targetScreen = state.workType === 'excerpt' ? 'parent-work' : 'work-details';
  goToScreen(targetScreen);

  // Show edit banner on that screen
  showEditBanner(targetScreen);
}

function showEditBanner(screenId) {
  // Remove any existing banners
  document.querySelectorAll('.edit-entry-banner').forEach(b => b.remove());
  const screen = document.getElementById('screen-' + screenId);
  if (!screen) return;
  const banner = document.createElement('div');
  banner.className = 'edit-entry-banner';
  banner.textContent = `Editing entry ${editingIndex + 1}. Update any details below. Use Back to change the work type.`;
  // Insert after the Back button (first element in screen)
  const backBtn = screen.querySelector('.btn-back');
  if (backBtn) backBtn.after(banner);
  else screen.prepend(banner);
}

// ════════════════════════════════════════════════════════════════
//  Populate form from saved state (for re-editing)
// ════════════════════════════════════════════════════════════════
function populateFormFromState(s) {
  // Radios
  function setRadio(name, value) {
    if (!value) return;
    const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  }
  setRadio('relationship', s.workType === 'complete' ? 'complete' : s.workType === 'excerpt' ? 'excerpt' : null);
  setRadio('titleType', s.titleType);
  setRadio('workSize', s.workSize);
  setRadio('excerptCount', s.excerptCount);

  // Composer status
  if (s.composerLiving === true) {
    setRadio('composerStatus', 'living');
    document.getElementById('living-fields')?.classList.add('visible');
  } else if (s.composerLiving === false) {
    setRadio('composerStatus', 'deceased');
    document.getElementById('deceased-fields')?.classList.add('visible');
  }


  // Text inputs
  function setVal(id, val) { const el = document.getElementById(id); if (el && val) el.value = val; }
  setVal('work-title', s.workTitle);
  setVal('work-date', s.workDate);
  setVal('work-nickname', s.nickname);
  setVal('cat-num', s.catalogNumber);
  setVal('composer-first', s.composerFirst);
  setVal('composer-last', s.composerLast);
  setVal('composer-born', s.composerBorn);
  setVal('composer-born-living', s.composerBorn);
  setVal('composer-died', s.composerDied);
  setVal('movements-input', s.movements);
  setVal('lyricist-input', s.lyricist);
  setVal('arr-name', s.arrangementName);
  setVal('performers-input', s.performers);
  setVal('premiere-input', s.premiereType);
  setVal('parent-title', s.parentTitle);
  setVal('parent-cat-num', s.parentCatalogNumber);
  setVal('parent-date', s.parentDate);

  // Selects
  function setSel(id, val) { const el = document.getElementById(id); if (el && val) el.value = val; }
  setSel('cat-type', s.catalogType || '');
  setSel('parent-cat-type', s.parentCatalogType || '');
  setSel('arr-role', s.arrangementRole || 'arr.');

  // Show/hide catalog number field
  if (s.catalogType) {
    const numField = document.getElementById('cat-num-field');
    if (numField) numField.style.display = 'flex';
  }
  if (s.parentCatalogType) {
    // parent catalog field shown in parent-work screen
  }

  // Show nickname field if genre path
  if (s.titleType === 'genre') {
    const nf = document.getElementById('nickname-field');
    if (nf) nf.style.display = 'flex';
  }

  updateWorkDetailsQuestion();
  updateWorkSizeScreen();
  renderPreview();
}

// ════════════════════════════════════════════════════════════════
//  Program panel rendering
// ════════════════════════════════════════════════════════════════
function updateRightColumn() {
  const previewCard = document.getElementById('preview-card');
  const previewActions = document.getElementById('preview-actions');
  const programPanel = document.getElementById('program-panel');
  const hasProgramEntries = programEntries.filter(e => e.type === 'entry').length > 0;

  if (previewCard) previewCard.style.display = hasProgramEntries ? 'none' : 'block';
  if (previewActions) { if (hasProgramEntries) previewActions.style.display = 'none'; }
  if (programPanel) programPanel.style.display = hasProgramEntries ? 'block' : 'none';
}

// ════════════════════════════════════════════════════════════════
//  Print Preview
// ════════════════════════════════════════════════════════════════
function previewPDF() {
  if (programEntries.filter(e => e.type === 'entry').length === 0) {
    alert('Add at least one program entry before previewing.');
    return;
  }
  generatePDF('preview');
}

// ════════════════════════════════════════════════════════════════
//  Word Doc (.doc) download — HTML blob, opens in Word
// ════════════════════════════════════════════════════════════════
// UTF-8-safe base64 (used to embed reload data inside the program file .doc)
function b64EncodeUtf8(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64DecodeUtf8(b64) { return decodeURIComponent(escape(atob(b64))); }

// Marker wrapping the hidden snapshot inside the program file
const PROGRAM_DATA_MARKER = 'UMKC-RECITAL-DATA:';

// Pull a session snapshot out of an uploaded file's text:
//  1) the hidden marker embedded in a downloaded program file (.doc), or
//  2) a raw .json draft (back-compat).
// Returns null if neither is present (e.g. Word re-saved the file and stripped the marker).
function extractSnapshotFromText(text) {
  const m = text.match(/UMKC-RECITAL-DATA:([A-Za-z0-9+/=]+)/);
  if (m) {
    try { return JSON.parse(b64DecodeUtf8(m[1])); } catch (e) { return null; }
  }
  try {
    const p = JSON.parse(text);
    if (p && typeof p === 'object') return p;
  } catch (e) { /* not raw json */ }
  return null;
}

function generateDoc() {
  const entries = programEntries.filter(e => e.type === 'entry');
  if (entries.length === 0) {
    alert('Add at least one program entry before downloading.');
    return;
  }
  const rd = recitalDetails;

  // Hidden reload data — lets this same .doc be re-opened in the tool later
  const programDataB64 = b64EncodeUtf8(JSON.stringify(buildSnapshot()));

  function entryToDocHtml(e) {
    return e.html || '';
  }

  let programHtml = '';
  programEntries.forEach(item => {
    if (item.type === 'intermission') {
      programHtml += '<p style="text-align:center;font-weight:bold;border-top:1px solid #999;border-bottom:1px solid #999;padding:4pt 0;margin:10pt 0">— INTERMISSION —</p>';
    } else {
      programHtml += '<div style="margin-bottom:14pt;font-family:\'Times New Roman\',serif;font-size:11pt">' + entryToDocHtml(item) + '</div>';
    }
  });

  const footerHtml = rd.profName && rd.performerName
    ? '<p style="text-align:center;font-style:italic;font-size:9pt;margin-top:18pt">' +
      rd.performerName + ' is a student of ' + (rd.profTitle || 'Professor') + ' ' + rd.profName + '</p>'
    : '';
  const degreeHtml = hasDegreeFooter(rd.recitalType) && rd.degree
    ? '<p style="text-align:center;font-size:8pt;color:#555;margin-top:4pt">' +
      'This recital is being presented in partial fulfillment of the requirements for the degree of ' + rd.degree + '.</p>'
    : '';

  // Free-text block -> escaped Word paragraphs (blank line = new paragraph)
  function docParas(txt) {
    return String(txt || '')
      .split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
      .map(p => '<p style="font-size:11pt;text-align:left">' + esc(p).replace(/\n/g, '<br>') + '</p>')
      .join('');
  }
  const notesDocHtml = (rd.programNotes && rd.programNotes.trim())
    ? '<div class="program-head" style="margin-top:20pt">PROGRAM NOTES</div>' + docParas(rd.programNotes)
    : '';
  const bioName = [rd.performerName, rd.instrument].filter(Boolean).join(', ');
  const bioDocHtml = (rd.performerBio && rd.performerBio.trim())
    ? '<div class="program-head" style="margin-top:20pt">ABOUT THE PERFORMER' +
      (bioName ? ' — ' + esc(bioName) : '') + '</div>' + docParas(rd.performerBio)
    : '';

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<style>
  body { font-family: 'Times New Roman', serif; font-size: 11pt; margin: 1in; }
  .disclaimer { background: #FFF3CD; border: 2px solid #FFC107; padding: 10pt 14pt; margin-bottom: 18pt;
                font-family: Arial, sans-serif; font-size: 10pt; font-weight: bold; line-height: 1.5; }
  h1 { font-size: 13pt; text-align: center; font-family: Arial, sans-serif; margin-bottom: 4pt; }
  .subtitle { text-align: center; font-style: italic; font-size: 11pt; margin-bottom: 2pt; }
  .info { text-align: center; font-size: 10pt; margin-bottom: 2pt; }
  hr { border: none; border-top: 1px solid #333; margin: 12pt 0; }
  .program-head { text-align: center; font-family: Arial, sans-serif; font-weight: bold;
                  font-size: 12pt; letter-spacing: .08em; margin: 14pt 0; }
  .entry-row { display: flex; justify-content: space-between; }
  .entry-indent { padding-left: 1.5em; display: block; }
  .entry-indent-right { display: flex; justify-content: space-between; padding-left: 1.5em; }
  .entry-arranger { color: #555; }
  .entry-right { color: #555; }
  em { font-style: italic; }
  .approval { margin-top: 36pt; border-top: 1px solid #ccc; padding-top: 14pt; font-family: Arial, sans-serif; font-size: 10pt; }
</style>
</head>
<body>
<!--${PROGRAM_DATA_MARKER}${programDataB64}-->
<div class="disclaimer">
  ⚠ CONTENT PROOF — Review the text for accuracy: names, titles, dates, repertoire, program notes, and bio.
  The published program is the web (.html) version; this Word copy is for proofing the copy and capturing faculty approval.
</div>
<h1>${rd.recitalType ? rd.recitalType.toUpperCase() : 'RECITAL'}</h1>
${rd.academicYear ? '<p class="info" style="font-size:9pt;color:#555">' + rd.academicYear + '</p>' : ''}
${rd.performerName ? '<p class="subtitle">' + [rd.performerName, rd.instrument].filter(Boolean).join(', ') + '</p>' : ''}
${rd.accompanist ? '<p class="info">' + rd.accompanist + ', piano</p>' : ''}
${(rd.additionalPerformers || '').split('\n').filter(l => l.trim()).map(l => '<p class="info">' + l.trim() + '</p>').join('')}
${rd.lectureTitle && rd.recitalType === 'Doctoral Lecture Recital' ? '<p class="info" style="font-style:italic">&ldquo;' + rd.lectureTitle + '&rdquo;</p>' : ''}
${rd.recitalDate ? '<p class="info">' + rd.recitalDate + '</p>' : ''}
${rd.recitalTime || rd.venue ? '<p class="info">' + [rd.recitalTime, rd.venue].filter(Boolean).join(' · ') + '</p>' : ''}
<hr>
<div class="program-head">PROGRAM</div>
<hr>
${programHtml}
${footerHtml}
${degreeHtml}
<p style="text-align:center;font-size:8pt;color:#888;margin-top:8pt">UMKC Conservatory recitals are recorded. Thank you for helping us maintain a silence in the hall that is conducive to music-making. Be sure to turn off all electronic devices.</p>
${notesDocHtml}
${bioDocHtml}
<div class="approval">
  <p><strong>Faculty Review &amp; Approval</strong></p>
  <p>Reviewed and approved by: ________________________________&nbsp;&nbsp;&nbsp;Date: ______________</p>
  <p style="margin-top:8pt;font-size:9pt;color:#555">Professor signature confirms the program text has been reviewed for accuracy and approved for publishing.</p>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (rd.performerName ? rd.performerName.replace(/\s+/g, '_') : 'Recital') + '_Recital_Program.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════
//  Web Program (.html) download — screen-first, dark-mode default (BETA)
//  Self-contained single file. Reuses each entry's formatted HTML so all
//  Chicago-style repertoire formatting carries over unchanged.
// ════════════════════════════════════════════════════════════════
function generateWebProgram() {
  const entries = programEntries.filter(e => e.type === 'entry');
  if (entries.length === 0) {
    alert('Add at least one program entry before downloading.');
    return;
  }
  const rd = recitalDetails;

  // Free-text block -> escaped HTML paragraphs (blank line = new paragraph)
  function textToParas(txt) {
    return String(txt || '')
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>')
      .join('');
  }

  // ── Program body: reuse each entry's formatted HTML, restyled for screen ──
  let programHtml = '';
  programEntries.forEach(item => {
    if (item.type === 'intermission') {
      programHtml += '<div class="interm">— Intermission —</div>';
    } else if (item.html) {
      programHtml += '<div class="work">' + item.html + '</div>';
    }
  });

  // ── Hero ──
  const kicker = [rd.recitalType || 'Recital', rd.academicYear].filter(Boolean).join(' · ');
  const h1 = [rd.performerName, rd.instrument].filter(Boolean).join(', ') || (rd.recitalType || 'Recital');
  let heroSub = '';
  if (rd.accompanist) heroSub += '<p class="performer">' + esc(rd.accompanist) + ', piano</p>';
  (rd.additionalPerformers || '').split('\n').map(l => l.trim()).filter(Boolean)
    .forEach(l => { heroSub += '<p class="performer">' + esc(l) + '</p>'; });
  if (rd.lectureTitle && rd.recitalType === 'Doctoral Lecture Recital') {
    heroSub += '<p class="lecture">“' + esc(rd.lectureTitle) + '”</p>';
  }
  let heroMeta = '';
  if (rd.recitalDate) heroMeta += '<div>' + esc(rd.recitalDate) + '</div>';
  const tv = [rd.recitalTime, rd.venue].filter(Boolean).join(' · ');
  if (tv) heroMeta += '<div>' + esc(tv) + '</div>';

  // ── Optional collapsible sections ──
  const notesHtml = (rd.programNotes && rd.programNotes.trim())
    ? '<section id="notes"><h2>Program Notes</h2>' +
      '<details><summary>Program Notes <span class="chev">›</span></summary>' +
      '<div class="acc-body">' + textToParas(rd.programNotes) + '</div></details></section>'
    : '';
  const bioName = [rd.performerName, rd.instrument].filter(Boolean).join(', ') || 'Performer';
  const bioHtml = (rd.performerBio && rd.performerBio.trim())
    ? '<section id="bio"><h2>About the Performer</h2>' +
      '<details open><summary>' + esc(bioName) + ' <span class="chev">›</span></summary>' +
      '<div class="acc-body">' + textToParas(rd.performerBio) + '</div></details></section>'
    : '';

  // ── Footer fine print ──
  let fine = '';
  if (rd.profName && rd.performerName) {
    fine += '<p><em>' + esc(rd.performerName) + ' is a student of ' +
            esc(rd.profTitle || 'Professor') + ' ' + esc(rd.profName) + '.</em></p>';
  }
  if (hasDegreeFooter(rd.recitalType) && rd.degree) {
    fine += '<p>This recital is presented in partial fulfillment of the requirements for the degree of ' +
            esc(rd.degree) + '.</p>';
  }
  fine += '<p>UMKC Conservatory recitals are recorded. Please silence all electronic devices and ' +
          'help us maintain a hall conducive to music-making.</p>';

  // ── Nav: only link to sections that exist ──
  let nav = '<a href="#program">Program</a>';
  if (notesHtml) nav += '<a href="#notes">Notes</a>';
  if (bioHtml)   nav += '<a href="#bio">Bio</a>';
  nav += '<a href="#support">Support</a>';

  const titleTag = esc([h1, 'UMKC Conservatory'].join(' · '));

  const html = '<!DOCTYPE html>\n' +
'<html lang="en" data-theme="dark">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<title>' + titleTag + '</title>\n' +
'<style>\n' +
':root{--bg:#fff;--surface:#f6f5f2;--ink:#1a1a1a;--muted:#6b6b6b;--line:#e3e1dc;--brand:#13294b;--accent:#a6892b;--brand-ink:#13294b;--maxw:640px}\n' +
'html[data-theme="dark"]{--bg:#15171c;--surface:#1e2128;--ink:#e9e7e2;--muted:#a3a39d;--line:#2c2f37;--brand:#cdd6e6;--accent:#d9b85a;--brand-ink:#e9e7e2}\n' +
'*{box-sizing:border-box}\n' +
'body{margin:0;background:var(--bg);color:var(--ink);font-family:Georgia,"Times New Roman",serif;line-height:1.55;-webkit-font-smoothing:antialiased;transition:background .2s,color .2s}\n' +
'header{position:sticky;top:0;z-index:10;background:var(--brand);color:#fff;border-bottom:3px solid var(--accent)}\n' +
'html[data-theme="dark"] header{background:var(--surface)}\n' +
'.bar{max-width:var(--maxw);margin:0 auto;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}\n' +
'.bar .school{font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#fff}\n' +
'html[data-theme="dark"] .bar .school{color:var(--brand)}\n' +
'.toggle{appearance:none;border:1px solid rgba(255,255,255,.5);background:transparent;color:inherit;font-size:13px;padding:7px 12px;border-radius:999px;cursor:pointer;min-height:36px;font-family:Arial,sans-serif}\n' +
'html[data-theme="dark"] .toggle{border-color:var(--line)}\n' +
'nav{max-width:var(--maxw);margin:0 auto;padding:0 8px 8px;display:flex;gap:4px;overflow-x:auto}\n' +
'nav a{flex:0 0 auto;color:#fff;opacity:.85;text-decoration:none;font-family:Arial,sans-serif;font-size:13px;padding:6px 12px;border-radius:6px;min-height:32px;display:flex;align-items:center}\n' +
'html[data-theme="dark"] nav a{color:var(--brand)}\n' +
'nav a:hover{opacity:1;background:rgba(255,255,255,.12)}\n' +
'main{max-width:var(--maxw);margin:0 auto;padding:0 20px 64px}\n' +
'section{padding:28px 0;border-bottom:1px solid var(--line)}\n' +
'section:last-child{border-bottom:none}\n' +
'.hero{text-align:center;padding-top:34px}\n' +
'.hero .kicker{font-family:Arial,sans-serif;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-weight:700;margin:0 0 6px}\n' +
'.hero h1{font-size:30px;line-height:1.15;margin:0 0 4px;color:var(--brand-ink)}\n' +
'.hero .performer{font-size:20px;margin:8px 0 2px;font-style:italic}\n' +
'.hero .lecture{font-size:18px;font-style:italic;margin:8px 0 2px;color:var(--muted)}\n' +
'.hero .meta{color:var(--muted);font-size:16px;margin:14px 0 0}\n' +
'.hero .meta div{margin:3px 0}\n' +
'h2{font-family:Arial,sans-serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700;margin:0 0 18px}\n' +
'.work{margin:0 0 24px}\n' +
'.entry-row{display:flex;justify-content:space-between;gap:14px;align-items:baseline}\n' +
'.entry-title{font-weight:700;font-size:18px;color:var(--brand-ink)}\n' +
'.entry-composer{color:var(--muted);font-size:16px;text-align:right;flex:0 0 auto}\n' +
'.entry-right,.entry-arranger{color:var(--muted);font-size:15px;text-align:right}\n' +
'.entry-indent{padding-left:18px;font-size:16px;margin-top:2px}\n' +
'.entry-indent-right{display:flex;justify-content:space-between;gap:14px;padding-left:18px;font-size:16px;margin-top:2px}\n' +
'.interm{text-align:center;font-family:Arial,sans-serif;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin:26px 0;font-weight:700}\n' +
'details{border:1px solid var(--line);border-radius:10px;margin:0 0 12px;background:var(--surface);overflow:hidden}\n' +
'summary{cursor:pointer;list-style:none;padding:16px 18px;min-height:52px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:700;font-size:17px;color:var(--brand-ink)}\n' +
'summary::-webkit-details-marker{display:none}\n' +
'summary .chev{transition:transform .2s;color:var(--accent);font-size:18px;flex:0 0 auto}\n' +
'details[open] summary .chev{transform:rotate(90deg)}\n' +
'.acc-body{padding:0 18px 18px;font-size:16px}\n' +
'.acc-body p{margin:0 0 12px}\n' +
'.acc-body p:last-child{margin-bottom:0}\n' +
'.btn{display:block;text-align:center;text-decoration:none;font-family:Arial,sans-serif;font-weight:700;font-size:16px;padding:15px 16px;border-radius:10px;margin:0 0 12px;min-height:52px}\n' +
'.btn-primary{background:var(--accent);color:#1a1a1a}\n' +
'.btn-outline{border:1.5px solid var(--line);color:var(--brand-ink)}\n' +
'.support p{font-size:15px;color:var(--muted)}\n' +
'.fine{font-size:14px;color:var(--muted);text-align:center}\n' +
'.fine p{margin:8px 0}\n' +
'footer{text-align:center;padding:30px 20px 50px;color:var(--muted);font-size:13px}\n' +
'footer .crest{font-family:Arial,sans-serif;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--brand-ink);font-size:13px}\n' +
'</style>\n</head>\n<body>\n' +
'<header><div class="bar"><span class="school">UMKC Conservatory</span>' +
'<button class="toggle" id="themeBtn" aria-label="Toggle dark mode">☀️ Light</button></div>' +
'<nav>' + nav + '</nav></header>\n' +
'<main>\n' +
'<div class="hero" id="top"><p class="kicker">' + esc(kicker) + '</p>' +
'<h1>' + esc(h1) + '</h1>' + heroSub +
'<div class="meta">' + heroMeta + '</div></div>\n' +
'<section id="program"><h2>Program</h2>' + programHtml + '</section>\n' +
notesHtml + bioHtml +
'<section id="support" class="support"><h2>Support the Conservatory</h2>' +
'<p>The UMKC Conservatory relies on philanthropic support to provide the highest-quality educational experiences for our students and exceptional performances for the community.</p>' +
'<a class="btn btn-primary" href="https://go.umkc.edu/donate-to-conservatory">Make a Gift</a>' +
'<a class="btn btn-outline" href="https://conservatory.umkc.edu">Upcoming Events</a></section>\n' +
'<section class="fine">' + fine + '</section>\n' +
'</main>\n' +
'<footer><p class="crest">UMKC Conservatory</p>' +
'<p>4949 Cherry Street · Kansas City, MO · conservatory.umkc.edu</p></footer>\n' +
'<script>\n' +
'(function(){var root=document.documentElement;var btn=document.getElementById("themeBtn");var saved=null;' +
'try{saved=localStorage.getItem("umkc-theme");}catch(e){}' +
'function setTheme(t){if(t==="dark"){root.setAttribute("data-theme","dark");btn.textContent="☀️ Light";}' +
'else{root.removeAttribute("data-theme");btn.textContent="🌙 Dark";}try{localStorage.setItem("umkc-theme",t);}catch(e){}}' +
'setTheme(saved==="light"?"light":"dark");' +
'btn.addEventListener("click",function(){setTheme(root.getAttribute("data-theme")==="dark"?"light":"dark");});' +
'document.querySelectorAll("nav a").forEach(function(a){a.addEventListener("click",function(e){' +
'var el=document.querySelector(a.getAttribute("href"));if(el){e.preventDefault();el.scrollIntoView({behavior:"smooth"});}});});' +
'})();\n' +
'<\/script>\n</body>\n</html>';

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (rd.performerName ? rd.performerName.replace(/\s+/g, '_') : 'Recital') + '_Recital_Program.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ════════════════════════════════════════════════════════════════
//  Faculty Email Modal
// ════════════════════════════════════════════════════════════════
function openFacultyEmailModal() {
  if (programEntries.filter(e => e.type === 'entry').length === 0) {
    alert('Add at least one program entry before submitting.');
    return;
  }
  const modal = document.getElementById('faculty-email-modal');
  if (modal) modal.style.display = 'flex';
  const input = document.getElementById('faculty-email-input');
  if (input) { input.value = ''; input.focus(); }
  const val = document.getElementById('faculty-email-val');
  if (val) val.style.display = 'none';
}

function closeFacultyEmailModal() {
  const modal = document.getElementById('faculty-email-modal');
  if (modal) modal.style.display = 'none';
}

async function submitToFaculty() {
  const emailEl = document.getElementById('faculty-email-input');
  const valEl   = document.getElementById('faculty-email-val');
  const email   = (emailEl?.value || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (valEl) valEl.style.display = 'block';
    if (emailEl) emailEl.focus();
    return;
  }
  if (valEl) valEl.style.display = 'none';
  closeFacultyEmailModal();

  // Fire mailto synchronously while still inside the user-gesture context.
  // Browsers block mailto when called from async callbacks (await / setTimeout).
  const rd = recitalDetails;
  const subject = encodeURIComponent(
    'Recital Program for Review' +
    (rd.performerName ? ' — ' + rd.performerName : '') +
    (rd.recitalDate   ? ', ' + rd.recitalDate    : '')
  );
  const body = encodeURIComponent(
    'Dear ' + (rd.profTitle || 'Professor') + ' ' + (rd.profName || '') + ',\n\n' +
    'Please find my recital program attached for your review and approval. It is a Word ' +
    'document — please review the text for accuracy (you can use Track Changes or comments) ' +
    'and reply to confirm approval.\n\n' +
    'The Word document (.doc) has been downloaded to your computer — please attach it to this ' +
    'email before sending.\n\n' +
    'Thank you,\n' + (rd.performerName || 'Your student')
  );
  window.location.href = 'mailto:' + email + '?subject=' + subject + '&body=' + body;

  // Download the Word review copy after mailto fires (blob download doesn't navigate away)
  generateDoc();
}

// ════════════════════════════════════════════════════════════════
//  Recital Details
// ════════════════════════════════════════════════════════════════
function updateRD(key, value) {
  recitalDetails[key] = value;
  if (key === 'recitalType') {
    toggleDegreeSection();
    toggleLectureTitle();
  }
  autoSave();
}

// Applied-professor dropdown: each option value is "Title|||Name" (e.g. "Dr.|||Carl Allen").
// Selecting "other" reveals a free-text title + name for faculty not on the list.
function updateProfessor(val) {
  const otherWrap = document.getElementById('rd-prof-other-wrap');
  if (val === 'other') {
    if (otherWrap) otherWrap.style.display = 'block';
    const t = document.getElementById('rd-prof-title');
    const n = document.getElementById('rd-prof-name');
    recitalDetails.profTitle = (t && t.value) || 'Professor';
    recitalDetails.profName = (n && n.value) || '';
  } else {
    if (otherWrap) otherWrap.style.display = 'none';
    const sep = val.indexOf('|||');
    if (sep === -1) {
      recitalDetails.profTitle = 'Professor';
      recitalDetails.profName = '';
    } else {
      recitalDetails.profTitle = val.slice(0, sep);
      recitalDetails.profName = val.slice(sep + 3);
    }
  }
  autoSave();
}

function onDatePick(isoVal) {
  recitalDetails.recitalDateISO = isoVal;
  if (isoVal) {
    const d = new Date(isoVal + 'T00:00:00');
    recitalDetails.recitalDate = d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  } else {
    recitalDetails.recitalDate = '';
  }
  autoSave();
}

function onVenueSelect(val) {
  const customEl = document.getElementById('rd-venue-other');
  if (val === 'other') {
    customEl.style.display = '';
    customEl.focus();
    updateRD('venue', customEl.value);
  } else {
    customEl.style.display = 'none';
    updateRD('venue', val);
  }
}

function onTimeSelect(val) {
  const customEl = document.getElementById('rd-time-other');
  if (val === 'other') {
    customEl.style.display = '';
    customEl.focus();
    updateRD('recitalTime', customEl.value);
  } else {
    customEl.style.display = 'none';
    updateRD('recitalTime', val);
  }
}

function toggleLectureTitle() {
  const isLecture = recitalDetails.recitalType === 'Doctoral Lecture Recital';
  const field = document.getElementById('rd-lecture-field');
  if (field) field.style.display = isLecture ? 'flex' : 'none';
}

function updateDegreeField() {
  const prefix = (document.getElementById('rd-degree-prefix')?.value || '').trim();
  const instrument = (document.getElementById('rd-degree-instrument')?.value || '').trim();
  const wrap = document.getElementById('rd-degree-instrument-wrap');
  if (wrap) wrap.style.display = prefix ? 'block' : 'none';
  recitalDetails.degree = prefix && instrument ? prefix + ' ' + instrument : '';
  autoSave();
}

function toggleDegreeSection() {
  const section = document.getElementById('rd-degree-section');
  const noDegree = ['Student Chamber Music Recital'];
  if (section) section.style.display = noDegree.includes(recitalDetails.recitalType) ? 'none' : 'flex';
}

function advanceFromRecitalDetails() {
  // Pre-fill academic year if blank
  const yearEl = document.getElementById('rd-year');
  if (yearEl && !recitalDetails.academicYear) {
    recitalDetails.academicYear = autoAcademicYear();
    yearEl.value = recitalDetails.academicYear;
  }

  // Required field validation
  const required = [
    { key: 'recitalType',    id: 'rd-type',  label: 'Type of recital' },
    { key: 'performerName',  id: 'rd-name',  label: 'Your name' },
    { key: 'recitalDate',    id: 'rd-date',  label: 'Date' },
    { key: 'venue',          id: 'rd-venue', label: 'Venue' },
  ];
  const missing = required.filter(f => !recitalDetails[f.key]?.trim());
  const valEl = document.getElementById('rd-validation');
  if (missing.length) {
    if (valEl) {
      valEl.textContent = 'Please fill in: ' + missing.map(f => f.label).join(', ');
      valEl.style.display = 'block';
    }
    // Highlight the first missing field
    const firstEl = document.getElementById(missing[0].id);
    if (firstEl) { firstEl.focus(); firstEl.style.borderColor = 'var(--warn-border)'; }
    return;
  }
  if (valEl) valEl.style.display = 'none';
  // Clear any red borders
  required.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) el.style.borderColor = '';
  });
  goToScreen('relationship');
}

// ════════════════════════════════════════════════════════════════
//  Intermission support
// ════════════════════════════════════════════════════════════════
function addIntermissionAfter(index) {
  programEntries.splice(index + 1, 0, { type: 'intermission' });
  renderProgramList();
  autoSave();
}

function removeIntermission(index) {
  programEntries.splice(index, 1);
  renderProgramList();
  autoSave();
}

// ════════════════════════════════════════════════════════════════
//  Program List — updated to support intermission items
// ════════════════════════════════════════════════════════════════
function renderProgramList() {
  const listEl = document.getElementById('program-list');
  const countEl = document.getElementById('entry-count');
  if (!listEl) return;

  const entryCount = programEntries.filter(e => e.type === 'entry').length;
  if (countEl) countEl.textContent = entryCount === 0 ? '' : `(${entryCount} ${entryCount === 1 ? 'entry' : 'entries'})`;

  if (entryCount === 0) {
    listEl.innerHTML = '<div class="program-empty-state">No entries yet. Add your first piece.</div>';
    return;
  }

  listEl.innerHTML = programEntries.map((e, i) => {
    if (e.type === 'intermission') {
      return `<div class="intermission-marker">
        <span>— INTERMISSION —</span>
        <button class="remove-btn" onclick="removeIntermission(${i})" title="Remove intermission">✕</button>
      </div>`;
    }
    // Find the entry index among entries only (for display)
    const entryNum = programEntries.slice(0, i + 1).filter(x => x.type === 'entry').length;
    return `
      <div class="program-entry-card">
        <div class="program-entry-content">${e.html}</div>
        <div class="program-entry-actions">
          <button onclick="editProgramEntry(${i})">✏ Edit</button>
          <button class="add-intermission-btn" onclick="addIntermissionAfter(${i})" title="Add intermission after this piece">+ Intermission</button>
          <button class="remove-btn" onclick="deleteProgramEntry(${i})">✕ Remove</button>
        </div>
      </div>
    `;
  }).join('');
}

// ════════════════════════════════════════════════════════════════
//  Recital type → interior header text
// ════════════════════════════════════════════════════════════════
function getHeaderText(recitalType) {
  const map = {
    "Doctoral Recital":             "DOCTORAL RECITAL",
    "Doctoral Lecture Recital":     "DOCTORAL LECTURE RECITAL",
    "Master's Recital":             "MASTER'S DEGREE RECITAL",
    "Bachelor's Recital":           "BACHELOR'S DEGREE RECITAL",
    "Senior Undergraduate Recital": "BACHELOR'S DEGREE RECITAL",
    "Junior Undergraduate Recital": "BACHELOR'S DEGREE RECITAL",
    "Artist's Certificate Recital": "ARTIST'S CERTIFICATE RECITAL",
    "Performer's Certificate Recital": "PERFORMER'S CERTIFICATE RECITAL",
    "Non-Credit Graduate Recital":  "NON-CREDIT RECITAL",
    "Non-Credit Undergraduate Recital": "NON-CREDIT RECITAL",
    "Student Chamber Music Recital":"STUDENT CHAMBER MUSIC RECITAL",
  };
  return map[recitalType] || recitalType.toUpperCase();
}

function hasDegreeFooter(recitalType) {
  const noDegree = ['Student Chamber Music Recital'];
  return !noDegree.includes(recitalType);
}

// ════════════════════════════════════════════════════════════════
//  PDF Generation (jsPDF)
// ════════════════════════════════════════════════════════════════

let jspdfLoadPromise = null;

function loadJsPDF() {
  if (window.jspdf) return Promise.resolve();
  if (jspdfLoadPromise) return jspdfLoadPromise;
  jspdfLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.integrity = 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk';
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(s);
  });
  return jspdfLoadPromise;
}

// ── Text wrap helper ───────────────────────────────────────────
function pdfWrapText(doc, text, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach(line => { doc.text(line, x, y); y += lineHeight; });
  return y;
}

async function generatePDF(mode = 'save') {
  if (programEntries.filter(e => e.type === 'entry').length === 0) {
    alert('Add at least one program entry before ' + (mode === 'preview' ? 'previewing.' : 'downloading.'));
    return;
  }

  try {
    await loadJsPDF();
  } catch (e) {
    alert('Could not load PDF library. Check your internet connection and try again.');
    return;
  }

  const { jsPDF } = window.jspdf;

  // ── Landscape 11"×8.5" — two 5.5" panels per page ───────────
  const PW = 279.4, PH = 215.9;  // 11" × 8.5" in mm
  const PANEL = 139.7;            // 5.5" per panel
  const LM = 14, RM_PAD = 14;   // inner margins
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PW, PH] });

  // Panel helpers
  const pc = (s) => s === 'R' ? PANEL + PANEL / 2 : PANEL / 2;       // center x
  const pl = (s) => s === 'R' ? PANEL + LM : LM;                       // left x
  const pr = (s) => s === 'R' ? PW - RM_PAD : PANEL - RM_PAD;         // right x
  const cw = PANEL - LM - RM_PAD;                                       // content width

  doc.setTextColor(0, 0, 0);
  const rd = recitalDetails;
  const academicYear = rd.academicYear || autoAcademicYear();
  const recitalDisplayType = rd.recitalType || 'Recital';

  // ── PAGE 1: Outside (fold closed) ─────────────────────────
  // RIGHT PANEL = Front Cover
  doc.setFont('times', 'bold');
  doc.setFontSize(8);
  doc.text('UMKC CONSERVATORY', pc('R'), 14, { align: 'center' });
  doc.setFont('times', 'bold');
  doc.setFontSize(7);
  doc.text(academicYear, pc('R'), 20, { align: 'center' });

  // Recital type — largest text, Times bold for consistency with interior
  const rtLen = recitalDisplayType.length;
  const rtSize = rtLen > 28 ? 13 : rtLen > 22 ? 16 : 20;
  doc.setFont('times', 'bold');
  doc.setFontSize(rtSize);
  doc.text(recitalDisplayType.toUpperCase(), pc('R'), PH * 0.40, { align: 'center' });

  // Performer + instrument
  if (rd.performerName) {
    const perfStr = normalizePdfText([rd.performerName, rd.instrument].filter(Boolean).join(', '));
    doc.setFont('times', 'normal');
    doc.setFontSize(15);
    doc.text(perfStr, pc('R'), PH * 0.40 + 13, { align: 'center' });
  }

  // Date / time / venue
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  let coverY = PH * 0.63;
  [rd.recitalDate, rd.recitalTime, rd.venue].filter(Boolean).forEach(line => {
    doc.text(normalizePdfText(line), pc('R'), coverY, { align: 'center' }); coverY += 7;
  });

  // Thin rule at bottom of front cover
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(PANEL + 20, PH - 16, PW - 20, PH - 16);

  // LEFT PANEL = Back Cover
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('UMKC Conservatory', pc('L'), 20, { align: 'center' });
  doc.setLineWidth(0.3);
  doc.line(pl('L') + 5, 24, pr('L') - 5, 24);

  // Donation text
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  let bcY = 31;
  bcY = pdfWrapText(doc,
    'The UMKC Conservatory relies on philanthropic support to provide the highest quality educational experiences for our students as well as exceptional performances to the community.',
    pl('L'), bcY, cw, 4.5);
  bcY += 2;
  doc.text('To make an online gift, visit:', pl('L'), bcY); bcY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('go.umkc.edu/donate-to-conservatory', pl('L'), bcY); bcY += 6;
  doc.setFont('times', 'normal');
  bcY = pdfWrapText(doc,
    'For information about scholarships, endowed funds, or estate gifts, contact:',
    pl('L'), bcY, cw, 4.5);
  bcY += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Mark Mattison', pl('L'), bcY); bcY += 4.5;
  doc.setFont('times', 'normal');
  doc.text('markmattison@umkc.edu  |  816-235-1247', pl('L'), bcY); bcY += 8;

  doc.setLineWidth(0.3);
  doc.line(pl('L') + 5, bcY - 2, pr('L') - 5, bcY - 2);
  bcY += 2;

  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text('TO PURCHASE TICKETS:', pl('L'), bcY); bcY += 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.text('go.umkc.edu/conservatory-tickets', pl('L'), bcY); bcY += 4.5;
  doc.text('conservatory.umkc.edu', pl('L'), bcY); bcY += 4.5;
  doc.text('Relay Missouri: 800-735-2966 (TTY)  |  CNS 2511813', pl('L'), bcY);

  // Divider line between panels (fold guide)
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(PANEL, 0, PANEL, PH);
  doc.setDrawColor(0, 0, 0);

  // ── PAGE 2: Inside (fold open) ─────────────────────────────
  doc.addPage();

  // LEFT PANEL = blank (inside front cover)
  // (nothing)

  // Divider line between panels
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(PANEL, 0, PANEL, PH);
  doc.setDrawColor(0, 0, 0);

  // RIGHT PANEL = Program Interior
  const iLM = pl('R');  // PANEL + LM
  const iRM = pr('R');  // PW - RM_PAD
  const iTM = 14;
  const iBM = PH - 14;

  const FS = 10;
  const LH = 5.2;
  const SH = 3.5;
  const DARK  = [26, 26, 26];
  const MUTED = [85, 85, 85];
  let y = iTM;

  function cText(text, yPos, opts = {}) {
    const sz = opts.size || FS;
    doc.setFontSize(sz);
    doc.setFont(opts.font || 'times', opts.style || 'normal');
    doc.setTextColor(...(opts.color || DARK));
    doc.text(normalizePdfText(text), pc('R'), yPos, { align: 'center' });
  }

  function checkOverflow(neededMM) {
    if (y + neededMM > iBM - 30) {
      doc.addPage();
      // On overflow pages the interior spans full page
      y = iTM;
    }
  }

  // Header
  cText(getHeaderText(rd.recitalType || ''), y, { font: 'times', style: 'bold', size: 10 });
  y += LH + 1;

  if (rd.performerName) {
    cText([rd.performerName, rd.instrument].filter(Boolean).join(', '), y, { style: 'italic', size: 10 });
    y += LH;
  }
  if (rd.accompanist) { cText(rd.accompanist + ', piano', y, { size: FS }); y += LH; }
  if (rd.additionalPerformers) {
    rd.additionalPerformers.split('\n').filter(l => l.trim()).forEach(line => {
      cText(line.trim(), y, { size: FS }); y += LH;
    });
  }
  if (rd.lectureTitle && rd.recitalType === 'Doctoral Lecture Recital') {
    y += SH;
    cText('”' + rd.lectureTitle + '”', y, { style: 'italic', size: FS });
    y += LH;
  }

  y += LH * 1.5;
  cText('PROGRAM', y, { font: 'times', style: 'bold', size: 10 });
  y += LH * 2;

  // Entries
  programEntries.forEach(item => {
    if (item.type === 'intermission') {
      checkOverflow(LH * 2);
      y += SH;
      cText('INTERMISSION', y, { font: 'times', style: 'bold', size: FS });
      y += LH + SH;
      return;
    }
    y = renderEntryToPDF(doc, item.entryState, iLM, iRM, y, PH, iBM, FS, LH, SH, DARK, MUTED);
    y += LH * 0.8;
  });

  // Footer
  const footerY = Math.max(y + LH, iBM - 32);
  if (rd.profName) {
    const profLine = rd.performerName
      ? rd.performerName + ' is a student of ' + rd.profTitle + ' ' + rd.profName : '';
    if (profLine) cText(profLine, footerY, { style: 'italic', size: 8, color: DARK });
  }
  const f2y = footerY + 5;
  if (hasDegreeFooter(rd.recitalType) && rd.degree) {
    cText('This recital is being presented in partial fulfillment of the requirements', f2y, { size: 7.5, color: MUTED });
    cText('for the degree of ' + rd.degree + '.', f2y + 4, { size: 7.5, color: MUTED });
  }
  const f3y = hasDegreeFooter(rd.recitalType) && rd.degree ? f2y + 11 : f2y;
  cText('UMKC Conservatory recitals are recorded.', f3y, { size: 7.5, color: MUTED });
  cText('Thank you for helping us maintain a silence in the hall that is conducive to', f3y + 4, { size: 7.5, color: MUTED });
  cText('music-making. Be sure to turn off all electronic devices.', f3y + 8, { size: 7.5, color: MUTED });

  // ── Output ─────────────────────────────────────────────────
  const filename = rd.performerName
    ? rd.performerName.replace(/\s+/g, '_') + '_Program.pdf'
    : 'UMKC_Recital_Program.pdf';

  if (mode === 'preview') {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(filename);
  }
}

// ════════════════════════════════════════════════════════════════
//  Render a single program entry to jsPDF
// ════════════════════════════════════════════════════════════════
function renderEntryToPDF(doc, s, LM, RM, y, PH, BM, FS, LH, SH, DARK, MUTED) {
  const CW = RM - LM;
  const p = normalizePdfText; // shorthand for PDF-safe text

  function checkPage() {
    if (y > BM - 36) { doc.addPage(); y = 14; }
    return y;
  }

  function textWidth(str, font, style, size) {
    doc.setFont(font || 'times', style || 'normal');
    doc.setFontSize(size || FS);
    return doc.getTextWidth(str);
  }

  doc.setTextColor(...DARK);

  // ── Normalize user strings for PDF rendering ──
  const workTitle     = p(s.workTitle || '');
  const parentTitle   = p(s.parentTitle || '');
  const excerptOne    = p(s.excerptOnePiece || '');
  const compFirst     = p(s.composerFirst || '');
  const compLast      = p(s.composerLast || '');
  const arrName       = p(s.arrangementName || '');
  const lyricist      = p(s.lyricist || '');
  const premiereType  = p(s.premiereType || '');
  const nickname      = p((s.nickname || '').replace(/^["“”'‘’]+|["“”'‘’]+$/g, ''));

  // ── Build title parts [{text, italic}] ──
  const catStr = (s.catalogType && s.catalogNumber)
    ? ', ' + p(s.catalogType) + ' ' + p(s.catalogNumber) : '';
  const dateStr = s.workDate ? ' (' + p(s.workDate) + ')' : '';
  let titleParts = [];

  if (s.workType === 'complete') {
    if (s.titleType === 'genre') {
      // American style: comma inside closing quote when catalog follows
      const nick    = nickname ? (catStr ? ', "' + nickname + ',"' : ', "' + nickname + '"') : '';
      const catPart = nickname && catStr ? catStr.slice(1) : catStr;
      titleParts = [{ t: workTitle + nick + catPart + dateStr, i: false }];
    } else if (s.workSize === 'single') {
      const leadComma = catStr.startsWith(', ') ? ',' : '';
      const catRest   = leadComma ? catStr.slice(1) : catStr;
      titleParts = [{ t: '"' + workTitle + leadComma + '"' + catRest + dateStr, i: false }];
    } else {
      titleParts = [{ t: workTitle, i: true }, { t: catStr + dateStr, i: false }];
    }
  } else if (s.excerptCount === 'one') {
    const trailingComma = s.parentTitle ? ',' : '';
    titleParts = [{ t: '”' + excerptOne + trailingComma + '”', i: false }];
  } else {
    // Excerpt-multiple: use first song as main title entry; "from Work" drawn after songs
    const songs0 = (s.excerptMultiple || '').split('\n').map(l => l.trim()).filter(l => l);
    const firstSong0 = songs0.length > 0 ? p(songs0[0].replace(/ \| .*$/, '').trim()) : '';
    const pCat0 = s.parentCatalogType ? ', ' + p(s.parentCatalogType) + ' ' + p(s.parentCatalogNumber) : '';
    const pDate0 = s.parentDate ? ' (' + p(s.parentDate) + ')' : '';
    if (firstSong0) {
      titleParts = [{ t: firstSong0, i: false }];
    } else {
      titleParts = [{ t: 'from ', i: false }, { t: parentTitle, i: true }, { t: pCat0 + pDate0, i: false }];
    }
  }

  // Measure title width
  let tw = 0;
  titleParts.forEach(pt => { tw += textWidth(pt.t, 'times', pt.i ? 'italic' : 'normal', FS); });

  // Composer
  const compName  = [compFirst, compLast].filter(Boolean).join(' ');
  const compW     = compName ? textWidth(compName, 'times', 'normal', FS) : 0;
  const compDates = formatComposerDates(s.composerBorn, s.composerDied, s.composerLiving);

  // Dot leaders — require MIN_LEADER mm gap so leaders are always readable
  const MIN_LEADER = 12;
  doc.setFont('times', 'normal');
  doc.setFontSize(FS);
  const dotW   = doc.getTextWidth('.');
  const dotsX  = LM + tw + 1;
  const compX  = RM - compW;
  const sameLine = compName && (CW - tw - compW) >= MIN_LEADER;
  const numDots  = sameLine ? Math.max(0, Math.floor((compX - dotsX - 1) / dotW)) : 0;
  const dots     = '.'.repeat(numDots);

  checkPage();

  // Draw title
  let cx = LM;
  titleParts.forEach(pt => {
    doc.setFont('times', pt.i ? 'italic' : 'normal');
    doc.setFontSize(FS);
    doc.setTextColor(...DARK);
    doc.text(pt.t, cx, y);
    cx += textWidth(pt.t, 'times', pt.i ? 'italic' : 'normal', FS);
  });
  if (sameLine) {
    // Fits with readable leaders: draw dots and composer on same line
    if (dots)    { doc.setFont('times', 'normal'); doc.text(dots, dotsX, y); }
    if (compName){ doc.setFont('times', 'normal'); doc.text(compName, compX, y); }
    y += LH;
  } else {
    // Title too long: composer wraps to its own right-aligned line
    y += LH;
    if (compName) {
      checkPage();
      doc.setFont('times', 'normal'); doc.setFontSize(FS); doc.setTextColor(...DARK);
      doc.text(compName, RM - compW, y);
      y += LH * 0.65;
    }
  }

  // Composer dates — draw here for complete works and excerpt-one;
  // excerpt-multiple pairs dates alongside songs below
  if (compDates && !(s.workType === 'excerpt' && s.excerptCount === 'multiple')) {
    checkPage();
    doc.setFont('times', 'normal'); doc.setFontSize(FS);
    doc.setTextColor(...MUTED);
    doc.text(compDates, RM - textWidth(compDates), y);
    doc.setTextColor(...DARK);
    y += LH * 0.65;
  }

  // Arrangement (entry-level — skip for excerpt-multiple; paired alongside songs below)
  if (arrName && !(s.workType === 'excerpt' && s.excerptCount === 'multiple')) {
    checkPage();
    const arrStr  = (s.arrangementRole || 'arr.') + ' ' + arrName;
    doc.setFont('times', 'normal'); doc.setFontSize(FS);
    doc.setTextColor(...MUTED);
    doc.text(arrStr, RM - textWidth(arrStr), y);
    y += LH * 0.65;
    doc.setTextColor(...DARK);
  }

  // Premiere
  if (premiereType) {
    checkPage();
    doc.setFont('times', 'italic'); doc.setFontSize(FS);
    doc.text('(' + premiereType + ')', LM + 12, y);
    y += LH * 0.65;
    doc.setFont('times', 'normal');
  }

  // Excerpt-one: indented “from *Parent*” line with composer dates on the right
  if (s.workType === 'excerpt' && s.excerptCount === 'one') {
    const pCat    = s.parentCatalogType ? ', ' + p(s.parentCatalogType) + ' ' + p(s.parentCatalogNumber) : '';
    const pDate   = s.parentDate ? ' (' + p(s.parentDate) + ')' : '';
    if (parentTitle || pCat || pDate) {
      checkPage();
      const fromStr = 'from ';
      doc.setFont('times', 'normal'); doc.setFontSize(FS);
      doc.text(fromStr, LM + 12, y);
      const fromW = textWidth(fromStr);
      doc.setFont('times', 'italic');
      doc.text(parentTitle, LM + 12 + fromW, y);
      const ptW = textWidth(parentTitle, 'times', 'italic');
      doc.setFont('times', 'normal');
      doc.text(pCat + pDate, LM + 12 + fromW + ptW, y);
      y += LH;
    }
  }

  // Movements / songs
  // For excerpt-multiple: each line may include a per-song arranger after “ | “
  const movRaw = s.workSize === 'multi' ? (s.movements || '')
    : (s.workType === 'excerpt' && s.excerptCount === 'multiple' ? (s.excerptMultiple || '') : '');
  if (movRaw.trim()) {
    const isExcerptMultiple = s.workType === 'excerpt' && s.excerptCount === 'multiple';

    // Keep movements together: if block won't fit on remaining page but fits on a fresh one, break now
    const movLines = movRaw.trim().split('\n').filter(l => l.trim());
    const movBlockH = movLines.length * LH * 0.85;
    const freshPageH = BM - 36 - 14; // usable height on a new page
    if (movBlockH <= freshPageH && y + movBlockH > BM - 36) {
      doc.addPage();
      y = 14;
    }
    // For excerpt-multiple, build right-side metadata to pair alongside songs
    const pdfRightMeta = [];
    if (isExcerptMultiple) {
      if (compDates) pdfRightMeta.push(compDates);
      if (arrName) {
        pdfRightMeta.push((s.arrangementRole || 'arr.') + ' ' + arrName);
      }
    }
    let pdfRightIdx = 0;

    movRaw.split('\n').filter(l => l.trim()).forEach((rawLine, idx) => {
      // For excerpt-multiple, song[0] is already drawn via titleParts — skip it
      if (isExcerptMultiple && idx === 0) return;
      checkPage();
      const sepIdx    = rawLine.indexOf(' | ');
      const lineTitle = p(sepIdx >= 0 ? rawLine.slice(0, sepIdx).trim() : rawLine.trim());
      const lineArr   = sepIdx >= 0 ? p(rawLine.slice(sepIdx + 3).trim()) : '';

      let rightStr = lineArr;
      if (!rightStr && isExcerptMultiple && pdfRightIdx < pdfRightMeta.length) {
        rightStr = pdfRightMeta[pdfRightIdx++];
      } else if (!rightStr && !isExcerptMultiple && idx === 0 && lyricist) {
        rightStr = 'lyr. ' + lyricist;
      }

      doc.setFont('times', 'normal'); doc.setFontSize(FS);
      doc.setTextColor(...DARK);
      if (isExcerptMultiple) {
        // Remaining songs at main level — no dot leaders (avoids uneven leader lengths)
        doc.text(lineTitle, LM, y);
        if (rightStr) {
          doc.setTextColor(...MUTED);
          doc.text(rightStr, RM - textWidth(rightStr), y);
          doc.setTextColor(...DARK);
        }
        y += LH;
      } else {
        doc.text(lineTitle, LM + 12, y);
        if (rightStr) {
          doc.setTextColor(...MUTED);
          doc.text(rightStr, RM - textWidth(rightStr), y);
          doc.setTextColor(...DARK);
        }
        y += LH * 0.85;
      }
    });

    // Render any right-side metadata that didn't pair with a song
    while (pdfRightIdx < pdfRightMeta.length) {
      checkPage();
      doc.setFont('times', 'normal'); doc.setFontSize(FS);
      doc.setTextColor(...MUTED);
      doc.text(pdfRightMeta[pdfRightIdx], RM - textWidth(pdfRightMeta[pdfRightIdx]), y);
      doc.setTextColor(...DARK);
      y += LH * 0.65;
      pdfRightIdx++;
    }
    // Excerpt-multiple: draw "from Work" indented below the song list
    if (isExcerptMultiple && parentTitle) {
      checkPage();
      const fromStr2 = 'from ';
      doc.setFont('times', 'normal'); doc.setFontSize(FS); doc.setTextColor(...DARK);
      doc.text(fromStr2, LM + 12, y);
      const fromW2 = textWidth(fromStr2);
      doc.setFont('times', 'italic');
      doc.text(parentTitle, LM + 12 + fromW2, y);
      const ptW2 = textWidth(parentTitle, 'times', 'italic');
      doc.setFont('times', 'normal');
      const pCat2  = s.parentCatalogType ? ', ' + p(s.parentCatalogType) + ' ' + p(s.parentCatalogNumber) : '';
      const pDate2 = s.parentDate ? ' (' + p(s.parentDate) + ')' : '';
      doc.text(pCat2 + pDate2, LM + 12 + fromW2 + ptW2, y);
      y += LH * 0.85;
    }
  }

  // Per-piece performers (centered)
  if (s.performers) {
    s.performers.split('\n').filter(l => l.trim()).forEach(line => {
      checkPage();
      doc.setFont('times', 'normal'); doc.setFontSize(FS);
      const safe = p(line.trim());
      const lw   = textWidth(safe);
      doc.text(safe, LM + (CW - lw) / 2, y);
      y += LH * 0.85;
    });
  }

  return y;
}

// ════════════════════════════════════════════════════════════════
//  Init
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Check for saved session BEFORE resetting state
  const saved = loadSavedSession();
  if (saved) {
    showRestoreBanner(saved);
  }
  resetState();
  resetRecitalDetails();
  // Pre-fill academic year
  const yearEl = document.getElementById('rd-year');
  if (yearEl) yearEl.value = autoAcademicYear();
  initRadioHandlers();
  toggleDegreeSection();
  // Spell checker: load dictionaries and wire up fields
  loadDictionaries();
  initSpellCheck();

  // Close faculty modal on overlay click
  const modal = document.getElementById('faculty-email-modal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeFacultyEmailModal(); });
});

// ════════════════════════════════════════════════════════════════
//  Auto-Save (localStorage)
// ════════════════════════════════════════════════════════════════
let autoSaveTimer = null;

// Build a portable snapshot of the whole session (used by autosave AND Save Draft file)
function buildSnapshot() {
  const currentScreen = ALL_SCREENS.find(s => {
    const el = document.getElementById('screen-' + s);
    return el && el.classList.contains('active');
  }) || 'welcome';
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    recitalDetails: JSON.parse(JSON.stringify(recitalDetails)),
    programEntries: JSON.parse(JSON.stringify(programEntries)),
    currentScreen,
    wizardState: JSON.parse(JSON.stringify(state)),
    navHistory: [...navHistory],
  };
}

function autoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    try { localStorage.setItem('umkc-recital-draft', JSON.stringify(buildSnapshot())); }
    catch (e) { /* silent — storage full or disabled */ }
  }, 800);
}

// ── Save Draft to a portable .json file (move between devices / back up) ──
function saveDraftToFile() {
  const snapshot = buildSnapshot();
  const hasContent = (snapshot.programEntries || []).length > 0 ||
    (snapshot.recitalDetails.performerName || '').trim() ||
    (snapshot.wizardState.workTitle || '').trim();
  if (!hasContent) {
    alert('Enter some recital details or add a program entry before saving a draft.');
    return;
  }
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (snapshot.recitalDetails.performerName || 'Recital').replace(/\s+/g, '_') + '_Recital_Draft.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Load Draft from a .json file (e.g. to continue on another device) ──
function triggerLoadDraft() {
  const input = document.getElementById('load-draft-input');
  if (input) { input.value = ''; input.click(); }
}

function loadDraftFromFile(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const parsed = extractSnapshotFromText(String(e.target.result || ''));
    if (!parsed || typeof parsed !== 'object' || (!parsed.recitalDetails && !parsed.programEntries)) {
      alert('This file doesn’t contain reloadable program data.\n\n' +
        'If you opened the program file in Word and re-saved it, Word may have removed the hidden ' +
        'data. Open the program file you downloaded from this tool instead (the one you have not ' +
        're-saved in Word). A .json draft from this tool also works.');
      return;
    }
    const entryCount = (parsed.programEntries || []).filter(x => x && x.type === 'entry').length;
    const summary =
      (parsed.recitalDetails && parsed.recitalDetails.performerName ? 'Performer: ' + parsed.recitalDetails.performerName + '\n' : '') +
      entryCount + ' program ' + (entryCount === 1 ? 'entry' : 'entries') +
      (parsed.savedAt ? '\nSaved: ' + new Date(parsed.savedAt).toLocaleString() : '');
    if (!confirm('Continue from this file? It will replace anything currently in the tool.\n\n' + summary)) return;
    restoreSession(parsed);
    autoSave(); // also persist the loaded program to this browser
  };
  reader.readAsText(file);
}

function loadSavedSession() {
  try {
    const raw = localStorage.getItem('umkc-recital-draft');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Only restore if there's meaningful content
    const hasContent = parsed.programEntries?.length > 0 ||
      parsed.recitalDetails?.performerName?.trim() ||
      parsed.wizardState?.workTitle?.trim();
    return hasContent ? parsed : null;
  } catch (e) { return null; }
}

function clearSavedSession() {
  localStorage.removeItem('umkc-recital-draft');
}

function showRestoreBanner(saved) {
  const banner = document.getElementById('restore-banner');
  const title  = document.getElementById('restore-title');
  const detail = document.getElementById('restore-detail');
  if (!banner) return;

  const entryCount = (saved.programEntries || []).filter(e => e.type === 'entry').length;
  const date = new Date(saved.savedAt);
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (title) title.textContent = 'Continue where you left off on this computer — ' + dateStr;
  if (detail) detail.textContent =
    (entryCount > 0 ? entryCount + ' program ' + (entryCount === 1 ? 'entry' : 'entries') : 'Recital details filled in') +
    ' · Auto-saved ' + timeStr + ' in this browser';

  banner.style.display = 'flex';
  banner._savedData = saved; // store for restore
}

function hideRestoreBanner() {
  const banner = document.getElementById('restore-banner');
  if (banner) banner.style.display = 'none';
}

function restoreSessionFromBanner() {
  const banner = document.getElementById('restore-banner');
  const saved = banner?._savedData;
  if (!saved) { hideRestoreBanner(); return; }
  restoreSession(saved);
}

function dismissRestore() {
  clearSavedSession();
  hideRestoreBanner();
}

function buildEntryFromState(entryState) {
  const prev = state;
  state = entryState;
  const entry = buildEntry();
  state = prev;
  return entry;
}

function restoreSession(saved) {
  recitalDetails = saved.recitalDetails || {};
  // Rebuild HTML from entryState rather than trusting the stored HTML string
  programEntries = (saved.programEntries || []).map(e => {
    if (e.type !== 'entry') return e;
    const rebuilt = buildEntryFromState(e.entryState || {});
    return { ...e, html: rebuilt ? rebuilt.html : e.html, text: rebuilt ? rebuilt.text : e.text };
  });
  state = saved.wizardState || {};
  navHistory = saved.navHistory || [];
  isFinalized = false;
  editingIndex = null;
  editMode = false;

  // Repopulate form fields
  populateRecitalDetailsForm();
  if (state.workType) populateFormFromState(state);

  renderProgramList();
  updateRightColumn();
  updateEntryIndicator();

  const screen = saved.currentScreen || (programEntries.length ? 'relationship' : 'recital-details');
  // Don't restore to welcome — always go at least to recital-details
  const targetScreen = screen === 'welcome' ? 'recital-details' : screen;
  goToScreen(targetScreen);
  hideRestoreBanner();
}

function populateRecitalDetailsForm() {
  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  }
  function setSel(id, val) {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  }
  setVal('rd-type', recitalDetails.recitalType);
  setSel('rd-type', recitalDetails.recitalType);
  setVal('rd-year', recitalDetails.academicYear);
  const presetTimes = ['12:00 p.m.', '2:30 p.m.', '5:00 p.m.', '7:30 p.m.'];
  const savedTime = recitalDetails.recitalTime;
  if (savedTime) {
    if (presetTimes.includes(savedTime)) {
      setSel('rd-time', savedTime);
    } else {
      setSel('rd-time', 'other');
      setVal('rd-time-other', savedTime);
      const customEl = document.getElementById('rd-time-other');
      if (customEl) customEl.style.display = '';
    }
  }
  setVal('rd-date', recitalDetails.recitalDateISO);
  const presetVenues = ['Grant Recital Hall', 'White Recital Hall', "Diastole Scholars' Center"];
  const savedVenue = recitalDetails.venue;
  if (savedVenue) {
    if (presetVenues.includes(savedVenue)) {
      setSel('rd-venue', savedVenue);
    } else {
      setSel('rd-venue', 'other');
      setVal('rd-venue-other', savedVenue);
      const customEl = document.getElementById('rd-venue-other');
      if (customEl) customEl.style.display = '';
    }
  }
  setVal('rd-name', recitalDetails.performerName);
  setVal('rd-instrument', recitalDetails.instrument);
  setVal('rd-accompanist', recitalDetails.accompanist);
  setVal('rd-additional', recitalDetails.additionalPerformers);
  setVal('rd-program-notes', recitalDetails.programNotes);
  setVal('rd-performer-bio', recitalDetails.performerBio);
  // Applied professor: match saved title+name to a dropdown option, else fall back to "Other"
  const profSel = document.getElementById('rd-prof-select');
  const profOtherWrap = document.getElementById('rd-prof-other-wrap');
  if (profSel) {
    const wantVal = (recitalDetails.profTitle || '') + '|||' + (recitalDetails.profName || '');
    const hasOption = recitalDetails.profName &&
      Array.from(profSel.options).some(o => o.value === wantVal);
    if (hasOption) {
      profSel.value = wantVal;
      if (profOtherWrap) profOtherWrap.style.display = 'none';
    } else if (recitalDetails.profName) {
      profSel.value = 'other';
      if (profOtherWrap) profOtherWrap.style.display = 'block';
      setSel('rd-prof-title', recitalDetails.profTitle);
      setVal('rd-prof-name', recitalDetails.profName);
    } else {
      profSel.value = '';
      if (profOtherWrap) profOtherWrap.style.display = 'none';
    }
  }
  // Restore degree hybrid field
  const deg = recitalDetails.degree || '';
  const DEGREE_PREFIXES = [
    "Doctor of Musical Arts in", "Master of Music in", "Bachelor of Music in",
    "Artist's Certificate in", "Performer's Certificate in"
  ];
  let restoredPrefix = '', restoredInstrument = deg;
  for (const p of DEGREE_PREFIXES) {
    if (deg.startsWith(p)) { restoredPrefix = p; restoredInstrument = deg.slice(p.length).trim(); break; }
  }
  setSel('rd-degree-prefix', restoredPrefix);
  setVal('rd-degree-instrument', restoredInstrument);
  const wrap = document.getElementById('rd-degree-instrument-wrap');
  if (wrap) wrap.style.display = restoredPrefix ? 'block' : 'none';
  setVal('rd-lecture', recitalDetails.lectureTitle);
  toggleLectureTitle();
  toggleDegreeSection();
}

// ════════════════════════════════════════════════════════════════
//  Spell Checker — Layer 2 (Typo.js multilingual)
// ════════════════════════════════════════════════════════════════

const SPELL_DICT_LANGS = [
  { code: 'en_US', pkg: 'dictionary-en' },
  { code: 'de_DE', pkg: 'dictionary-de' },
  { code: 'fr_FR', pkg: 'dictionary-fr' },
  { code: 'it_IT', pkg: 'dictionary-it' },
  { code: 'es_ES', pkg: 'dictionary-es' },
  { code: 'pt_PT', pkg: 'dictionary-pt' },
];
let loadedDicts = [];
let dictsReady = false;
const DICT_CACHE = {}; // code → Typo instance | 'loading'

async function loadDictForLang(code) {
  if (DICT_CACHE[code]) return; // already loaded or in flight
  DICT_CACHE[code] = 'loading';
  const lang = SPELL_DICT_LANGS.find(l => l.code === code);
  if (!lang) return;
  const base = 'https://cdn.jsdelivr.net/npm/';
  try {
    const [aff, dic] = await Promise.all([
      fetch(base + lang.pkg + '/index.aff').then(r => r.text()),
      fetch(base + lang.pkg + '/index.dic').then(r => r.text()),
    ]);
    const inst = new Typo(code, aff, dic, { platform: 'any' });
    DICT_CACHE[code] = inst;
    loadedDicts.push(inst);
    dictsReady = true;
    // Re-check active fields now that this dict is ready
    SPELL_TEXTAREA_IDS.concat(SPELL_INPUT_IDS).forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value?.trim()) runSpellCheck(id);
    });
  } catch (e) {
    delete DICT_CACHE[code]; // allow retry on next input
  }
}

async function loadDictionaries() {
  if (typeof Typo === 'undefined') return;
  // Load English only at startup; other languages load on-demand
  await loadDictForLang('en_US');
  if (dictsReady) SPELL_TEXTAREA_IDS.concat(SPELL_INPUT_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value?.trim()) runSpellCheck(id);
  });
}

// Fields to check
const SPELL_TEXTAREA_IDS = ['movements-input', 'rd-additional', 'performers-input'];
const SPELL_INPUT_IDS    = ['rd-degree-instrument', 'rd-lecture', 'lyricist-input'];

// Words and patterns that should never be flagged
const SPELL_SKIP_WORDS = new Set([
  'allegro','andante','adagio','largo','presto','vivace','moderato','lento','grave',
  'piano','forte','pianissimo','fortissimo','mezzo','molto','poco','con','ma','non',
  'e','il','la','le','les','du','des','un','une','und','der','die','das','ein','eine',
  'von','soprano','tenor','baritone','contralto','bass','alto','lyr','arr','trans',
  'op','no','nos','pp','ff','mf','mp','sf','sfz',
]);
const SPELL_SKIP_RE = [
  /^[IVXLCDM]+\.?$/,        // Roman numerals: I. II. XIV
  /^\d/,                     // starts with digit
  /^[^a-zA-ZÀ-ÿĀ-ɏ]/, // non-letter start
  /^[a-z]{1,2}\.?$/,        // short abbreviations: e., p., f.
];

function spellSkip(word) {
  const w = word.replace(/[.,;:!?'"()[\]{}–—]/g, '');
  if (!w || w.length <= 2) return true;
  if (SPELL_SKIP_WORDS.has(w.toLowerCase())) return true;
  return SPELL_SKIP_RE.some(re => re.test(w));
}

function getContextDicts(text) {
  const hasGerman  = /[äöüÄÖÜß]/.test(text);
  const hasFrench  = /[àâçéèêëîïôùûœæÀÂÇÉÈÊËÎÏÔÙÛŒÆ]/.test(text);
  const hasItPt    = /[àèìòùÀÈÌÒÙãõÃÕ]/.test(text);
  const hasSpanish = /[ñÑ]/.test(text);

  // Trigger lazy loading for any needed language not yet fetched (fire and forget)
  if (hasGerman  && !DICT_CACHE['de_DE']) loadDictForLang('de_DE');
  if (hasFrench  && !DICT_CACHE['fr_FR']) loadDictForLang('fr_FR');
  if (hasItPt    && !DICT_CACHE['it_IT']) loadDictForLang('it_IT');
  if (hasItPt    && !DICT_CACHE['pt_PT']) loadDictForLang('pt_PT');
  if (hasSpanish && !DICT_CACHE['es_ES']) loadDictForLang('es_ES');

  // Return whichever relevant dicts are currently loaded
  const codes = ['en_US'];
  if (hasGerman)  codes.push('de_DE');
  if (hasFrench)  codes.push('fr_FR');
  if (hasItPt)    codes.push('it_IT', 'pt_PT');
  if (hasSpanish) codes.push('es_ES');

  if (codes.length === 1) return loadedDicts; // no special chars → use all loaded
  const active = loadedDicts.filter(d => codes.includes(d.dictionary));
  return active.length > 0 ? active : loadedDicts;
}

function spellCheckWithDicts(word, dicts) {
  if (!dictsReady || spellSkip(word)) return true;
  if (!dicts || dicts.length === 0) return true;
  const clean = word.replace(/[.,;:!?'"()[\]{}–—]/g, '');
  if (!clean) return true;
  return dicts.some(d => d.check(clean));
}

function spellCheck(word) {
  return spellCheckWithDicts(word, loadedDicts);
}

function spellSuggest(word) {
  if (!dictsReady) return [];
  const clean = word.replace(/[.,;:!?'"()[\]{}–—]/g, '');
  for (const d of loadedDicts) {
    const s = d.suggest(clean);
    if (s && s.length) return s.slice(0, 5);
  }
  return [];
}

// Tokenise text into word spans and gap spans
function spellTokenize(text) {
  const re = /[a-zA-ZÀ-ÿĀ-ɏḀ-ỿ]+/g;
  const tokens = [];
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push({ word: false, val: text.slice(last, m.index) });
    tokens.push({ word: true, val: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ word: false, val: text.slice(last) });
  return tokens;
}

function escSC(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');
}

// ── Textarea backdrop ──────────────────────────────────────────
const spellBackdrops = {}; // fieldId → backdrop div
const spellTimers   = {};

function initSpellCheck() {
  SPELL_TEXTAREA_IDS.forEach(id => {
    const ta = document.getElementById(id);
    if (!ta) return;
    // Wrap in spell-wrap
    const wrap = document.createElement('div');
    wrap.className = 'spell-wrap';
    ta.parentNode.insertBefore(wrap, ta);
    wrap.appendChild(ta);
    // Create backdrop
    const bd = document.createElement('div');
    bd.className = 'spell-backdrop';
    bd.setAttribute('aria-hidden', 'true');
    wrap.insertBefore(bd, ta);
    spellBackdrops[id] = { bd, ta };
    ta.classList.add('spell-active');
    // Sync on scroll
    ta.addEventListener('scroll', () => { bd.scrollTop = ta.scrollTop; });
    // Check on input (debounced)
    ta.addEventListener('input', () => scheduleSpellCheck(id));
    // Check immediately on blur
    ta.addEventListener('blur',  () => runSpellCheck(id));
    // Status div
    injectSpellStatus(id, ta.parentNode.parentNode);
  });

  SPELL_INPUT_IDS.forEach(id => {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.addEventListener('input', () => scheduleSpellCheck(id));
    inp.addEventListener('blur',  () => runSpellCheck(id));
    injectSpellStatus(id, inp.parentNode);
  });
}

function injectSpellStatus(id, container) {
  const existing = document.getElementById('spell-status-' + id);
  if (existing) return;
  const div = document.createElement('div');
  div.className = 'spell-status';
  div.id = 'spell-status-' + id;
  container.appendChild(div);
}

function scheduleSpellCheck(id) {
  clearTimeout(spellTimers[id]);
  spellTimers[id] = setTimeout(() => runSpellCheck(id), 450);
}

function runSpellCheck(id) {
  if (!dictsReady) return;
  const isTextarea = SPELL_TEXTAREA_IDS.includes(id);
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.value || '';
  const contextDicts = getContextDicts(text);
  const tokens = spellTokenize(text);
  const errors = tokens.filter(t => t.word && !spellCheckWithDicts(t.val, contextDicts)).map(t => t.val);

  if (isTextarea) {
    updateBackdrop(id, tokens, contextDicts);
  }
  updateSpellStatus(id, errors);
}

function updateBackdrop(id, tokens, contextDicts) {
  const info = spellBackdrops[id];
  if (!info) return;
  const { bd, ta } = info;
  // Match backdrop padding/font to textarea
  const cs = window.getComputedStyle(ta);
  bd.style.padding    = cs.padding;
  bd.style.fontSize   = cs.fontSize;
  bd.style.fontFamily = cs.fontFamily;
  bd.style.lineHeight = cs.lineHeight;
  bd.style.borderWidth = cs.borderWidth;

  const html = tokens.map(t => {
    const s = escSC(t.val);
    if (t.word && !spellCheckWithDicts(t.val, contextDicts || loadedDicts)) return '<mark>' + s + '</mark>';
    return s;
  }).join('');
  bd.innerHTML = html;
  bd.scrollTop = ta.scrollTop;
}

function updateSpellStatus(id, errors) {
  const el = document.getElementById('spell-status-' + id);
  if (!el) return;
  if (!errors.length) { el.innerHTML = ''; return; }
  const unique = [...new Set(errors)];
  el.innerHTML = '⚠ Possible spelling: ' +
    unique.map(w =>
      `<span class="spell-word" tabindex="0"
        onclick="showSpellSuggestions(event,'${escSC(w)}','${id}')"
        onkeydown="if(event.key==='Enter')showSpellSuggestions(event,'${escSC(w)}','${id}')"
      >${escSC(w)}</span>`
    ).join(', ');
}

// ── Suggestion popup ───────────────────────────────────────────
let activeSuggPopup = null;

function showSpellSuggestions(evt, word, fieldId) {
  hideSpellSuggestions();
  const suggestions = spellSuggest(word);
  const pop = document.createElement('div');
  pop.className = 'spell-suggestions';
  pop.id = 'spell-popup';

  if (suggestions.length) {
    suggestions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'spell-suggestion-item';
      item.textContent = s;
      item.onclick = () => { applySpellSuggestion(word, s, fieldId); hideSpellSuggestions(); };
      pop.appendChild(item);
    });
  } else {
    const noSugg = document.createElement('div');
    noSugg.className = 'spell-suggestion-item ignore';
    noSugg.textContent = 'No suggestions';
    pop.appendChild(noSugg);
  }
  const ign = document.createElement('div');
  ign.className = 'spell-suggestion-item ignore';
  ign.textContent = 'Ignore';
  ign.onclick = hideSpellSuggestions;
  pop.appendChild(ign);

  document.body.appendChild(pop);
  activeSuggPopup = pop;

  // Position near the clicked word
  const rect = evt.target.getBoundingClientRect();
  pop.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';
  pop.style.top  = (rect.bottom + 4) + 'px';

  // Close on outside click
  setTimeout(() => document.addEventListener('click', hideSpellSuggestions, { once: true }), 10);
  evt.stopPropagation();
}

function hideSpellSuggestions() {
  if (activeSuggPopup) { activeSuggPopup.remove(); activeSuggPopup = null; }
}

function applySpellSuggestion(original, replacement, fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  // Replace only the first occurrence to be safe
  el.value = el.value.replace(original, replacement);
  // Trigger state update
  el.dispatchEvent(new Event('input', { bubbles: true }));
  runSpellCheck(fieldId);
}
