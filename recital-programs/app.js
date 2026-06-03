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
    recitalTime:         '',
    venue:               '',
    accompanist:         '',
    additionalPerformers:'',
    profTitle:           'Professor',
    profName:            '',
    degree:              '',
    lectureTitle:        '',
  };
}

function autoAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based; academic year starts ~Aug
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
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
    arrangementLiving:  null,
    arrangementBorn:    '',
    arrangementDied:    '',
    performers:         '',
    premiereType:       '',
  };
  navHistory = [];
}

function updateState(key, value) {
  state[key] = value;
  renderPreview();
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
        if (r.value === 'distinctive') goToScreen('work-size');
        else goToScreen('work-details');
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

// ════════════════════════════════════════════════════════════════
//  Advance handlers (form screens)
// ════════════════════════════════════════════════════════════════
function advanceFromParentWork() {
  if (!state.parentTitle.trim()) return;

  // Set up excerpt-titles screen based on count
  const q = document.getElementById('excerpt-titles-question');
  const fields = document.getElementById('excerpt-titles-fields');
  if (state.excerptCount === 'one') {
    q.textContent = 'What aria or song are you performing?';
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
        <span class="field-hint">List the individual pieces in the order you will perform them.</span>
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
function updateArrStatus(val) {
  state.arrangementLiving = (val === 'living');
  document.getElementById('arr-deceased-fields').classList.toggle('visible', val === 'deceased');
  document.getElementById('arr-living-fields').classList.toggle('visible', val === 'living');
  renderPreview();
}

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
  let line = role + ' ' + state.arrangementName.trim();
  if (state.arrangementLiving === false && state.arrangementBorn) {
    const dates = formatComposerDates(state.arrangementBorn, state.arrangementDied, false);
    if (dates) line += '\n' + dates;
  }
  return line;
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
  const suffix = esc(cat) + esc(date);

  if (state.titleType === 'genre') {
    const nick = state.nickname.trim();
    const nickPart = nick ? ', &quot;' + esc(nick) + '&quot;' : '';
    return esc(title) + nickPart + suffix;
  }
  if (state.workSize === 'single') {
    return '“' + esc(title) + '”' + suffix;
  }
  // multi
  return '<em>' + esc(title) + '</em>' + suffix;
}

// Build excerpt title HTML string
function buildExcerptTitleHTML() {
  if (state.excerptCount === 'one') {
    const piece = state.excerptOnePiece.trim();
    return piece ? '“' + esc(piece) + '”' : '';
  }
  // multiple: parent work first (handled separately)
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

      // Row 1: "Aria Title" ........ Composer
      htmlLines.push(
        '<div class="entry-row">' +
        '<span class="entry-title">' + (pieceHTML || '&mdash;') + '</span>' +
        (composerName ? '<span class="entry-composer">' + esc(composerName) + '</span>' : '') +
        '</div>'
      );
      textLines.push((state.excerptOnePiece ? '“' + state.excerptOnePiece + '”' : '—') +
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
      }

    } else {
      // Multiple: cycle first
      const parentRef = buildParentWorkRef();
      if (!parentRef) return null;

      // Row 1: from *Parent Work*, Cat (Year) ........ Composer
      htmlLines.push(
        '<div class="entry-row">' +
        '<span class="entry-title">from ' + parentRef + '</span>' +
        (composerName ? '<span class="entry-composer">' + esc(composerName) + '</span>' : '') +
        '</div>'
      );
      textLines.push('from ' + state.parentTitle +
        (state.parentCatalogType ? ', ' + state.parentCatalogType + ' ' + state.parentCatalogNumber : '') +
        (state.parentDate ? ' (' + state.parentDate + ')' : '') +
        (composerName ? '    ' + composerName : ''));

      // Row 2: Composer dates
      if (composerDates) {
        htmlLines.push('<div class="entry-row"><span></span><span class="entry-right">' + esc(composerDates) + '</span></div>');
        textLines.push('                                          ' + composerDates);
      }

      // Individual piece titles
      if (state.excerptMultiple.trim()) {
        const pieces = state.excerptMultiple.split('\n').map(l => l.trim()).filter(l => l);
        pieces.forEach(p => {
          htmlLines.push('<div class="entry-indent">' + esc(p) + '</div>');
          textLines.push('    ' + p);
        });
      }
    }

    // Arrangement
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
  if (el && (!buildEntry() || !buildEntry().html.trim())) {
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
}

function clearProgram() {
  if (!confirm('Remove all entries from the program?')) return;
  programEntries = [];
  editingIndex = null;
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

  // Arrangement status
  if (s.arrangementName) {
    if (s.arrangementLiving === true) {
      setRadio('arrStatus', 'living');
      document.getElementById('arr-living-fields')?.classList.add('visible');
    } else if (s.arrangementLiving === false) {
      setRadio('arrStatus', 'deceased');
      document.getElementById('arr-deceased-fields')?.classList.add('visible');
    }
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
  setVal('arr-born', s.arrangementBorn);
  setVal('arr-born-living', s.arrangementBorn);
  setVal('arr-died', s.arrangementDied);
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
function openPrintPreview() {
  if (programEntries.length === 0) return;
  const win = window.open('', '_blank', 'width=720,height=900,scrollbars=yes');
  if (!win) { alert('Please allow pop-ups for this page to use Print preview.'); return; }

  const entriesHTML = programEntries.map((e, i) =>
    `<div class="entry">${e.html}</div>${i < programEntries.length - 1 ? '<hr class="entry-sep">' : ''}`
  ).join('\n');

  win.document.write(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Concert Program — Print Preview</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif;
         padding: 2.5rem 3rem; font-size: 0.95rem; line-height: 1.4;
         color: #1a1a1a; max-width: 680px; margin: 0 auto; }
  .page-header { font-family: system-ui, sans-serif; font-size: 0.7rem;
                  text-transform: uppercase; letter-spacing: 0.1em;
                  color: #555; margin-bottom: 1.5rem; padding-bottom: 0.5rem;
                  border-bottom: 2px solid #0d3d2a; }
  .entry { margin-bottom: 1.25rem; }
  .entry-sep { border: none; border-top: 1px solid #ddd; margin: 1rem 0; }
  .entry-row { display: flex; justify-content: space-between;
               align-items: baseline; gap: 1rem; margin: 0; line-height: 1.35; }
  .entry-title { flex: 1; }
  .entry-composer { white-space: nowrap; }
  .entry-right { text-align: right; color: #555; font-size: 0.9em; }
  .entry-indent { padding-left: 1.5rem; display: block; margin: 0; line-height: 1.35; }
  .entry-indent-right { padding-left: 1.5rem; display: flex;
                          justify-content: space-between; margin: 0; line-height: 1.35; }
  .entry-arranger { text-align: right; color: #555; }
  em { font-style: italic; }
  #print-btn { font-family: system-ui; font-size: 0.85rem; padding: 0.5rem 1.25rem;
               margin-bottom: 1.5rem; cursor: pointer; background: #0d3d2a;
               color: white; border: none; border-radius: 6px; }
  #print-btn:hover { background: #1a5c3e; }
  @media print { #print-btn { display: none; } }
</style>
</head><body>
<button id="print-btn" onclick="window.print()">Print</button>
<div class="page-header">UMKC Conservatory — Concert Program</div>
${entriesHTML}
</body></html>`);
  win.document.close();
}

// ════════════════════════════════════════════════════════════════
//  Recital Details
// ════════════════════════════════════════════════════════════════
function updateRD(key, value) {
  recitalDetails[key] = value;
}

function toggleLectureTitle() {
  const isLecture = recitalDetails.recitalType === 'Doctoral Lecture Recital';
  const field = document.getElementById('rd-lecture-field');
  if (field) field.style.display = isLecture ? 'flex' : 'none';
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
}

function removeIntermission(index) {
  programEntries.splice(index, 1);
  renderProgramList();
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
    "Guest Artist Recital":         "GUEST ARTIST RECITAL",
    "Faculty Recital":              "FACULTY RECITAL",
    "Faculty Chamber Music Concert":"FACULTY CHAMBER MUSIC CONCERT",
    "Studio Recital":               "STUDIO RECITAL",
    "Graduate Chamber Ensemble Recital": "GRADUATE CHAMBER ENSEMBLE RECITAL",
    "Student Chamber Music Recital":"STUDENT CHAMBER MUSIC RECITAL",
    "Joint Recital":                "JOINT RECITAL",
  };
  return map[recitalType] || recitalType.toUpperCase();
}

function hasDegreeFooter(recitalType) {
  const noDegree = ['Guest Artist Recital','Faculty Recital','Faculty Chamber Music Concert',
    'Studio Recital','Graduate Chamber Ensemble Recital','Student Chamber Music Recital'];
  return !noDegree.includes(recitalType);
}

// ════════════════════════════════════════════════════════════════
//  PDF Generation (jsPDF)
// ════════════════════════════════════════════════════════════════
function generatePDF() {
  if (programEntries.filter(e => e.type === 'entry').length === 0) {
    alert('Add at least one program entry before downloading.');
    return;
  }

  const { jsPDF } = window.jspdf;
  // Page dimensions in mm: 5.5" x 8.5"
  const PW = 139.7, PH = 215.9;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [PW, PH] });

  const LM = 14, RM = PW - 14, TM = 14, BM = PH - 14;
  const CW = RM - LM;
  const UMKC_BLUE = [0, 40, 85];
  const UMKC_GOLD = [181, 148, 90];
  const DARK = [26, 26, 26];
  const MUTED = [85, 85, 85];

  const rd = recitalDetails;
  const academicYear = rd.academicYear || autoAcademicYear();

  // ── PAGE 1: Cover ──────────────────────────────────────────
  // Blue header bar
  doc.setFillColor(...UMKC_BLUE);
  doc.rect(0, 0, PW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(academicYear, LM, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('UMKC CONSERVATORY', LM, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('PERFORMANCE', LM, 21);

  // Recital type (large, centered)
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'normal');
  const recitalDisplayType = rd.recitalType || 'Recital';
  const rtSize = recitalDisplayType.length > 25 ? 14 : 18;
  doc.setFontSize(rtSize);
  doc.text(recitalDisplayType, PW / 2, 48, { align: 'center' });

  // Performer name + instrument
  if (rd.performerName) {
    doc.setFontSize(14);
    const perfStr = rd.instrument ? rd.performerName + ', ' + rd.instrument : rd.performerName;
    doc.text(perfStr, PW / 2, 57, { align: 'center' });
  }

  // Date / time / venue
  doc.setTextColor(...MUTED);
  doc.setFontSize(10);
  let coverY = 74;
  if (rd.recitalDate) { doc.text(rd.recitalDate, PW / 2, coverY, { align: 'center' }); coverY += 7; }
  if (rd.recitalTime) { doc.text(rd.recitalTime, PW / 2, coverY, { align: 'center' }); coverY += 7; }
  if (rd.venue)       { doc.text(rd.venue, PW / 2, coverY, { align: 'center' }); }

  // Gold accent line at bottom
  doc.setDrawColor(...UMKC_GOLD);
  doc.setLineWidth(1.5);
  doc.line(LM, PH - 18, RM, PH - 18);
  doc.setTextColor(...UMKC_GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('UMKC CONSERVATORY', PW / 2, PH - 12, { align: 'center' });

  // ── PAGE 2: Blank ──────────────────────────────────────────
  doc.addPage();

  // ── PAGE 3: Interior ───────────────────────────────────────
  doc.addPage();
  doc.setLineWidth(0.1);

  const FS = 10;  // body font size pt
  const LH = 5.2; // line height mm
  const SH = 3.5; // small line height
  let y = TM;

  function cText(text, yPos, opts = {}) {
    const sz = opts.size || FS;
    doc.setFontSize(sz);
    doc.setFont(opts.font || 'times', opts.style || 'normal');
    doc.setTextColor(...(opts.color || DARK));
    if (opts.align === 'right') {
      const w = doc.getTextWidth(text);
      doc.text(text, RM - w, yPos);
    } else {
      doc.text(text, PW / 2, yPos, { align: 'center' });
    }
  }

  function checkOverflow(neededMM) {
    if (y + neededMM > BM - 30) { // leave room for footer
      doc.addPage();
      y = TM;
    }
  }

  // Recital type header
  const headerText = getHeaderText(rd.recitalType || '');
  cText(headerText, y, { font: 'helvetica', style: 'bold', size: 10 });
  y += LH + 1;

  // Performer name (italic) + instrument
  if (rd.performerName) {
    const perfLine = rd.instrument ? rd.performerName + ', ' + rd.instrument : rd.performerName;
    cText(perfLine, y, { style: 'italic', size: 10 });
    y += LH;
  }

  // Accompanist
  if (rd.accompanist) {
    cText(rd.accompanist + ', piano', y, { size: FS });
    y += LH;
  }

  // Additional performers
  if (rd.additionalPerformers) {
    rd.additionalPerformers.split('\n').filter(l => l.trim()).forEach(line => {
      cText(line.trim(), y, { size: FS });
      y += LH;
    });
  }

  // Lecture title (Doctoral Lecture)
  if (rd.lectureTitle && rd.recitalType === 'Doctoral Lecture Recital') {
    y += SH;
    cText('“' + rd.lectureTitle + '”', y, { style: 'italic', size: FS });
    y += LH;
  }

  // PROGRAM heading
  y += LH * 1.5;
  cText('PROGRAM', y, { font: 'helvetica', style: 'bold', size: 10 });
  y += LH * 2;

  // ── Program entries ────────────────────────────────────────
  programEntries.forEach(item => {
    if (item.type === 'intermission') {
      checkOverflow(LH * 2);
      y += SH;
      cText('INTERMISSION', y, { font: 'times', style: 'bold', size: FS });
      y += LH + SH;
      return;
    }

    const s = item.entryState;
    y = renderEntryToPDF(doc, s, LM, RM, y, PH, BM, FS, LH, SH, DARK, MUTED);
    y += LH * 0.8; // spacing between entries
  });

  // ── Footer ─────────────────────────────────────────────────
  // Push footer to near bottom
  const footerY = Math.max(y + LH, BM - 32);

  doc.setTextColor(...MUTED);

  // "Student is a student of Professor X" — italic, centered
  if (rd.profName) {
    const profLine = rd.performerName
      ? rd.performerName + ' is a student of ' + rd.profTitle + ' ' + rd.profName
      : '';
    if (profLine) {
      cText(profLine, footerY, { style: 'italic', size: 8, color: DARK });
    }
  }

  const f2y = footerY + 5;
  if (hasDegreeFooter(rd.recitalType) && rd.degree) {
    const degLine1 = 'This recital is being presented in partial fulfillment of the requirements';
    const degLine2 = 'for the degree of ' + rd.degree + '.';
    cText(degLine1, f2y, { size: 7.5, color: MUTED });
    cText(degLine2, f2y + 4, { size: 7.5, color: MUTED });
  }

  const f3y = hasDegreeFooter(rd.recitalType) && rd.degree ? f2y + 11 : f2y;
  cText('UMKC Conservatory recitals are recorded.', f3y, { size: 7.5, color: MUTED });
  cText('Thank you for helping us maintain a silence in the hall that is conducive to', f3y + 4, { size: 7.5, color: MUTED });
  cText('music-making. Be sure to turn off all electronic devices.', f3y + 8, { size: 7.5, color: MUTED });

  // ── PAGE 4: Back cover ─────────────────────────────────────
  doc.addPage();

  // Blue header
  doc.setFillColor(...UMKC_BLUE);
  doc.rect(0, 0, PW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('UMKC', PW / 2, 13, { align: 'center' });
  doc.setFontSize(10);
  doc.text('Conservatory', PW / 2, 21, { align: 'center' });

  // Donation text
  doc.setTextColor(...DARK);
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  const donationLines = [
    'The UMKC Conservatory relies on philanthropic support to provide the highest',
    'quality educational experiences for our students as well as exceptional',
    'performances to the community. To make an online gift to the Conservatory or',
    'to direct your gift toward a designated area of study, visit',
  ];
  let bcY = 38;
  donationLines.forEach(line => { doc.text(line, LM, bcY); bcY += 5; });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('go.umkc.edu/donate-to-conservatory', LM, bcY); bcY += 5;
  doc.setFont('times', 'normal');
  doc.text('or scan the QR code. For information about other ways to give', LM, bcY); bcY += 5;
  doc.text('including establishing a scholarship, endowed fund or estate gift,', LM, bcY); bcY += 5;
  doc.text('please contact:', LM, bcY); bcY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...UMKC_BLUE);
  doc.text('Mark Mattison  |  markmattison@umkc.edu  |  816-235-1247', LM, bcY); bcY += 14;

  // Divider line
  doc.setDrawColor(...UMKC_GOLD);
  doc.setLineWidth(0.8);
  doc.line(LM, bcY - 4, RM, bcY - 4);

  // Tickets section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...UMKC_GOLD);
  doc.text('TO PURCHASE TICKETS:', LM, bcY + 2); bcY += 7;
  doc.setTextColor(...UMKC_BLUE);
  doc.setFontSize(9);
  doc.text('go.umkc.edu/conservatory-tickets', LM, bcY); bcY += 6;
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...DARK);
  doc.text('conservatory.umkc.edu', LM, bcY); bcY += 5;
  doc.text('Relay Missouri: 800-735-2966 (TTY)  |  CNS 2511813', LM, bcY);

  // ── Save ───────────────────────────────────────────────────
  const filename = rd.performerName
    ? rd.performerName.replace(/\s+/g, '_') + '_Program.pdf'
    : 'UMKC_Recital_Program.pdf';
  doc.save(filename);
}

// ════════════════════════════════════════════════════════════════
//  Render a single program entry to jsPDF
// ════════════════════════════════════════════════════════════════
function renderEntryToPDF(doc, s, LM, RM, y, PH, BM, FS, LH, SH, DARK, MUTED) {
  const CW = RM - LM;

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

  // ── Build title parts [{text, italic}] ──
  const catStr = (s.catalogType && s.catalogNumber)
    ? ', ' + s.catalogType + (s.catalogType.endsWith('.') ? '' : '') + ' ' + s.catalogNumber : '';
  const dateStr = s.workDate ? ' (' + s.workDate + ')' : '';
  let titleParts = [];

  if (s.workType === 'complete') {
    if (s.titleType === 'genre') {
      const nick = s.nickname ? ', “' + s.nickname + '”' : '';
      titleParts = [{ t: s.workTitle + nick + catStr + dateStr, i: false }];
    } else if (s.workSize === 'single') {
      titleParts = [{ t: '“' + s.workTitle + '”' + catStr + dateStr, i: false }];
    } else {
      titleParts = [{ t: s.workTitle, i: true }, { t: catStr + dateStr, i: false }];
    }
  } else if (s.excerptCount === 'one') {
    titleParts = [{ t: '“' + s.excerptOnePiece + '”', i: false }];
  } else {
    const pCat = s.parentCatalogType ? ', ' + s.parentCatalogType + ' ' + s.parentCatalogNumber : '';
    const pDate = s.parentDate ? ' (' + s.parentDate + ')' : '';
    titleParts = [{ t: 'from ', i: false }, { t: s.parentTitle, i: true }, { t: pCat + pDate, i: false }];
  }

  // Measure title width
  let tw = 0;
  titleParts.forEach(p => { tw += textWidth(p.t, 'times', p.i ? 'italic' : 'normal', FS); });

  // Composer
  const compName = [s.composerFirst, s.composerLast].filter(Boolean).join(' ');
  const compW = compName ? textWidth(compName, 'times', 'normal', FS) : 0;
  const compDates = formatComposerDates(s.composerBorn, s.composerDied, s.composerLiving);

  // Dot leaders
  doc.setFont('times', 'normal');
  doc.setFontSize(FS);
  const dotW = doc.getTextWidth('.');
  const dotsX = LM + tw + 1;
  const compX = RM - compW;
  const numDots = compName && compX > dotsX + 2 ? Math.floor((compX - dotsX - 1) / dotW) : 0;
  const dots = '.'.repeat(Math.max(0, numDots));

  checkPage();

  // Draw title
  let cx = LM;
  titleParts.forEach(p => {
    doc.setFont('times', p.i ? 'italic' : 'normal');
    doc.setFontSize(FS);
    doc.setTextColor(...DARK);
    doc.text(p.t, cx, y);
    cx += textWidth(p.t, 'times', p.i ? 'italic' : 'normal', FS);
  });
  if (dots) { doc.setFont('times', 'normal'); doc.text(dots, dotsX, y); }
  if (compName) { doc.setFont('times', 'normal'); doc.text(compName, compX, y); }
  y += LH;

  // Composer dates
  if (compDates) {
    checkPage();
    doc.setFont('times', 'normal');
    doc.setFontSize(FS);
    doc.setTextColor(...MUTED);
    doc.text(compDates, RM - textWidth(compDates), y);
    doc.setTextColor(...DARK);
    y += LH * 0.8;
  }

  // Arrangement
  if (s.arrangementName) {
    checkPage();
    const arrStr = s.arrangementRole + ' ' + s.arrangementName;
    const arrDates = s.arrangementLiving === false && s.arrangementBorn
      ? formatComposerDates(s.arrangementBorn, s.arrangementDied, false) : '';
    doc.setFont('times', 'normal');
    doc.setFontSize(FS);
    doc.setTextColor(...MUTED);
    doc.text(arrStr, RM - textWidth(arrStr), y);
    y += LH * 0.8;
    if (arrDates) {
      doc.text(arrDates, RM - textWidth(arrDates), y);
      y += LH * 0.8;
    }
    doc.setTextColor(...DARK);
  }

  // Premiere
  if (s.premiereType) {
    checkPage();
    doc.setFont('times', 'italic');
    doc.setFontSize(FS);
    doc.text('(' + s.premiereType + ')', LM + 12, y);
    y += LH * 0.8;
    doc.setFont('times', 'normal');
  }

  // Excerpt one — "from *Parent*" line
  if (s.workType === 'excerpt' && s.excerptCount === 'one') {
    checkPage();
    const pCat = s.parentCatalogType ? ', ' + s.parentCatalogType + ' ' + s.parentCatalogNumber : '';
    const pDate = s.parentDate ? ' (' + s.parentDate + ')' : '';
    const fromStr = 'from ';
    doc.setFont('times', 'normal');
    doc.setFontSize(FS);
    doc.text(fromStr, LM + 12, y);
    const fromW = textWidth(fromStr);
    doc.setFont('times', 'italic');
    doc.text(s.parentTitle, LM + 12 + fromW, y);
    const ptW = textWidth(s.parentTitle, 'times', 'italic');
    doc.setFont('times', 'normal');
    doc.text(pCat + pDate, LM + 12 + fromW + ptW, y);
    if (compDates) {
      doc.setTextColor(...MUTED);
      doc.text(compDates, RM - textWidth(compDates), y);
      doc.setTextColor(...DARK);
    }
    y += LH;
  }

  // Movements (multi-movement complete works or excerpt-multiple)
  const movText = s.workSize === 'multi' ? s.movements
    : (s.workType === 'excerpt' && s.excerptCount === 'multiple' ? s.excerptMultiple : '');
  if (movText) {
    movText.split('\n').filter(l => l.trim()).forEach((line, idx) => {
      checkPage();
      doc.setFont('times', 'normal');
      doc.setFontSize(FS);
      doc.setTextColor(...DARK);
      doc.text(line.trim(), LM + 12, y);
      if (idx === 0 && s.lyricist) {
        const lyrStr = 'lyr. ' + s.lyricist;
        doc.setTextColor(...MUTED);
        doc.text(lyrStr, RM - textWidth(lyrStr), y);
        doc.setTextColor(...DARK);
      }
      y += LH * 0.85;
    });
  }

  // Per-piece performers (centered)
  if (s.performers) {
    s.performers.split('\n').filter(l => l.trim()).forEach(line => {
      checkPage();
      doc.setFont('times', 'normal');
      doc.setFontSize(FS);
      const lw = textWidth(line.trim());
      doc.text(line.trim(), LM + (CW - lw) / 2, y);
      y += LH * 0.85;
    });
  }

  return y;
}

// ════════════════════════════════════════════════════════════════
//  Init
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  resetState();
  resetRecitalDetails();
  // Pre-fill academic year
  const yearEl = document.getElementById('rd-year');
  if (yearEl) yearEl.value = autoAcademicYear();
  initRadioHandlers();
  // Spell checker: load dictionaries and wire up fields
  loadDictionaries();
  initSpellCheck();
});

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

async function loadDictionaries() {
  if (typeof Typo === 'undefined') return; // Typo.js not loaded
  const base = 'https://cdn.jsdelivr.net/npm/';
  try {
    await Promise.all(SPELL_DICT_LANGS.map(async ({ code, pkg }) => {
      try {
        const [aff, dic] = await Promise.all([
          fetch(base + pkg + '/index.aff').then(r => r.text()),
          fetch(base + pkg + '/index.dic').then(r => r.text()),
        ]);
        loadedDicts.push(new Typo(code, aff, dic, { platform: 'any' }));
      } catch (e) { /* silent: one dict failing doesn't block others */ }
    }));
    dictsReady = loadedDicts.length > 0;
    // Re-check any fields that already have content
    if (dictsReady) SPELL_TEXTAREA_IDS.concat(SPELL_INPUT_IDS).forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value?.trim()) runSpellCheck(id);
    });
  } catch (e) { /* silent */ }
}

// Fields to check
const SPELL_TEXTAREA_IDS = ['movements-input', 'rd-additional', 'performers-input'];
const SPELL_INPUT_IDS    = ['rd-degree', 'rd-lecture', 'lyricist-input'];

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

function spellCheck(word) {
  if (!dictsReady || spellSkip(word)) return true;
  const clean = word.replace(/[.,;:!?'"()[\]{}–—]/g, '');
  if (!clean) return true;
  return loadedDicts.some(d => d.check(clean));
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
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
  const tokens = spellTokenize(text);
  const errors = tokens.filter(t => t.word && !spellCheck(t.val)).map(t => t.val);

  if (isTextarea) {
    updateBackdrop(id, tokens);
  }
  updateSpellStatus(id, errors);
}

function updateBackdrop(id, tokens) {
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
    if (t.word && !spellCheck(t.val)) return '<mark>' + s + '</mark>';
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
