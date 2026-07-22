// ════════════════════════════════════════════════════════════════
//  State
// ════════════════════════════════════════════════════════════════
let state = {};
let navHistory = [];
let isFinalized = false;
let programEntries = []; // [{type:'entry', html, text, entryState} | {type:'intermission'}]
let editingIndex = null; // null = new entry; number = editing existing
let recitalDetails = {};

// Full recitalDetails shape with safe defaults. restoreSession() merges saved
// snapshots onto this so fields added later are never undefined after a restore.
function defaultRecitalDetails() {
  return {
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

function resetRecitalDetails() {
  recitalDetails = defaultRecitalDetails();
}

function autoAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based; new academic year displayed starting August
  const startYear = month >= 7 ? year : year - 1;
  return startYear + '\u2013' + String(startYear + 1).slice(-2);
}

// The full wizard-state shape with safe defaults. Reused so that any restored
// entryState is merged onto a complete object — buildEntry() accesses fields like
// premiereType/performers/lyricist with .trim() and would throw on missing fields.
function defaultWizardState() {
  return {
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
}

function resetState() {
  state = defaultWizardState();
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
    // Move focus to the step heading so keyboard/SR users land on the new
    // screen (skip on initial load — only after an actual navigation)
    if (current && current !== id) {
      const h = target.querySelector('h2');
      if (h) h.focus({ preventScroll: true });
    }
  }
  renderProgressFor(id);
  renderPreview();
  updateEntryIndicator();
  // Hide the Live Preview column on the welcome screen — nothing to preview yet,
  // and let the welcome content use the full width (body.on-welcome)
  const previewCol = document.getElementById('preview-col');
  if (previewCol) previewCol.style.display = (id === 'welcome') ? 'none' : '';
  document.body.classList.toggle('on-welcome', id === 'welcome');
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
    const h = target.querySelector('h2');
    if (h) h.focus({ preventScroll: true });
  }
  renderProgressFor(prev);
  renderPreview();
  updateEntryIndicator(); // hide the "Program Entry N" breadcrumb when back on welcome
  // Keep the welcome-screen layout in sync when navigating back to it
  const previewCol = document.getElementById('preview-col');
  if (previewCol) previewCol.style.display = (prev === 'welcome') ? 'none' : '';
  document.body.classList.toggle('on-welcome', prev === 'welcome');
}

function finalizeEntry() {
  isFinalized = true;
  resetResultEditMode(); // arrive at the result screen in a clean, non-editing state
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
  resetResultEditMode(); // manual text edits are regenerated from the wizard fields
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
  resetResultEditMode();
  resetPreviewEditMode();
  document.getElementById('preview-card')?.classList.remove('finalized');
  const status = document.getElementById('preview-status');
  if (status) status.textContent = 'Start answering questions →';
  const actions = document.getElementById('preview-actions');
  if (actions) actions.style.display = 'none';
  updateRightColumn();
  resetState();
  clearFormInputs();
  clearRecitalDetailsInputs();
  goToScreen('welcome');
  navHistory = [];
  updatePreviewPlaceholder();
}

// Screens that make up the per-entry wizard (everything except welcome and
// recital-details). clearFormInputs() is scoped to these so resetting between
// entries never touches the recital-details form.
const ENTRY_SCREENS = [
  'relationship', 'title-type', 'work-size', 'excerpt-count', 'parent-work',
  'excerpt-titles', 'work-details', 'composer', 'movements', 'credits', 'result'
];

// Clear the spell-checker backdrop and status line for fields whose values
// were just cleared programmatically (no input event fires for those)
function clearSpellArtifacts(ids) {
  ids.forEach(id => {
    const info = spellBackdrops[id];
    if (info) info.bd.innerHTML = '';
    const status = document.getElementById('spell-status-' + id);
    if (status) status.innerHTML = '';
    delete spellStatusCache[id];
  });
}

function clearFormInputs() {
  ENTRY_SCREENS.forEach(id => {
    const scr = document.getElementById('screen-' + id);
    if (!scr) return;
    scr.querySelectorAll('input[type="text"], textarea').forEach(el => el.value = '');
    scr.querySelectorAll('input[type="radio"]').forEach(el => el.checked = false);
    scr.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
    scr.querySelectorAll('.sub-fields').forEach(el => el.classList.remove('visible'));
  });
  document.querySelectorAll('.edit-entry-banner').forEach(b => b.remove());
  const hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
  hide('cat-num-field');
  hide('cat-other-field');
  hide('nickname-field');
  hide('parent-cat-other-field');
  clearSpellArtifacts(['movements-input', 'performers-input', 'lyricist-input']);
}

function clearRecitalDetailsInputs() {
  const scr = document.getElementById('screen-recital-details');
  if (!scr) return;
  scr.querySelectorAll('input[type="text"], input[type="date"], textarea').forEach(el => el.value = '');
  scr.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
  const yearEl = document.getElementById('rd-year');
  if (yearEl) yearEl.value = autoAcademicYear();
  const hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
  hide('rd-time-other');
  hide('rd-venue-other');
  hide('rd-prof-other-wrap');
  hide('rd-degree-instrument-wrap');
  hide('rd-lecture-field');
  clearSpellArtifacts(['rd-additional', 'rd-program-notes', 'rd-performer-bio', 'rd-degree-instrument', 'rd-lecture']);
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
  const isExcerpt = state.workType === 'excerpt';
  if (!isExcerpt) {
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
  // The visual strip conveys state by color; the ✓ prefix and the hidden
  // "Step N of M" text carry the same information non-visually.
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = steps.map((s, i) => {
    const cls = i < currentIdx ? 'progress-step complete' : i === currentIdx ? 'progress-step active' : 'progress-step';
    return `<div class="${cls}">${i < currentIdx ? '✓ ' : ''}${s}</div>`;
  }).join('');
  let sr = el.parentElement.querySelector('.progress-sr');
  if (!sr) {
    sr = document.createElement('p');
    sr.className = 'visually-hidden progress-sr';
    el.parentElement.appendChild(sr);
  }
  sr.textContent = `Step ${currentIdx + 1} of ${steps.length}: ${steps[currentIdx] || ''}`;
}

// ════════════════════════════════════════════════════════════════
//  Auto-advance handlers (radio screens)
// ════════════════════════════════════════════════════════════════
// Auto-advance radios listen for click ONLY (not change): mouse click, touch,
// and keyboard Space all fire click — including on an already-selected option
// (which fires no change event, and used to leave the user stuck after Back).
// Keyboard ARROW keys fire change but no click, so arrowing between options
// reviews them without navigating (WCAG 3.2.2 On Input); those users advance
// with Space or the visible Continue button (continueRadioScreen).
// A short guard swallows duplicate advances.
let lastRadioAdvance = 0;
const radioAppliers = {};
function bindAutoAdvance(name, apply) {
  radioAppliers[name] = apply;
  document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
    const go = () => {
      const now = Date.now();
      if (now - lastRadioAdvance < 350) return;
      lastRadioAdvance = now;
      apply(r.value);
    };
    r.addEventListener('click', go);
  });
}

// Explicit Continue path for the radio screens (keyboard users who arrow to a
// choice can activate this instead of Space on the radio)
function continueRadioScreen(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  if (!checked) { alert('Please choose an option to continue.'); return; }
  const now = Date.now();
  if (now - lastRadioAdvance < 350) return;
  lastRadioAdvance = now;
  const apply = radioAppliers[name];
  if (apply) apply(checked.value);
}

function initRadioHandlers() {
  // Relationship
  bindAutoAdvance('relationship', value => {
    state.workType = value;
    setTimeout(() => {
      if (value === 'complete') goToScreen('title-type');
      else goToScreen('excerpt-count');
    }, 180);
  });

  // Title type
  bindAutoAdvance('titleType', value => {
    state.titleType = value;
    // Show/hide nickname field on work-details screen
    const nf = document.getElementById('nickname-field');
    if (nf) nf.style.display = value === 'genre' ? 'flex' : 'none';
    // Update work-details question hint
    updateWorkDetailsQuestion();
    setTimeout(() => {
      updateWorkSizeScreen();
      goToScreen('work-size');
    }, 180);
  });

  // Work size
  bindAutoAdvance('workSize', value => {
    state.workSize = value;
    updateWorkDetailsQuestion();
    setTimeout(() => goToScreen('work-details'), 180);
  });

  // Excerpt count
  bindAutoAdvance('excerptCount', value => {
    state.excerptCount = value;
    setTimeout(() => goToScreen('parent-work'), 180);
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
  const lastEl = document.getElementById('composer-last');
  if (!state.composerLast.trim()) {
    // Un-hide first, then (re)set the text — role="alert" announces on text injection
    valMsg.classList.add('show');
    valMsg.textContent = '⚠ Please enter at least the composer\'s last name.';
    if (lastEl) {
      lastEl.classList.add('field-error');
      lastEl.setAttribute('aria-invalid', 'true');
      lastEl.focus();
    }
    return;
  }
  valMsg.classList.remove('show');
  if (lastEl) {
    lastEl.classList.remove('field-error');
    lastEl.removeAttribute('aria-invalid');
  }
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
  // Both birth-year inputs share state.composerBorn — sync the one being shown
  // so switching living/deceased never displays an empty field while the
  // preview still shows a year typed in the other input
  const bornEl = document.getElementById(val === 'living' ? 'composer-born-living' : 'composer-born');
  if (bornEl) bornEl.value = state.composerBorn || '';
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
  if (numField)   numField.style.display   = val ? 'flex' : 'none';
  if (otherField) otherField.style.display = (val === 'other') ? 'flex' : 'none';
  if (val !== 'other') {
    const otherInput = document.getElementById('cat-other-label');
    if (otherInput) otherInput.value = '';
  }
  renderPreview();
  autoSave();
}

// Parent-work catalog select — same "Other" handling as the main catalog select,
// so choosing Other reveals a custom-prefix input instead of printing "other".
function updateParentCatalogType(val) {
  state.parentCatalogType = (val === 'other') ? '' : val;
  const otherField = document.getElementById('parent-cat-other-field');
  if (otherField) otherField.style.display = (val === 'other') ? 'flex' : 'none';
  if (val !== 'other') {
    const otherInput = document.getElementById('parent-cat-other-label');
    if (otherInput) otherInput.value = '';
  }
  renderPreview();
  autoSave();
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
  header.setAttribute('aria-expanded', String(!isOpen));
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
  return role + ' ' + state.arrangementName.trim();
}

// Build the title HTML string (with <em> or quotes)
function buildTitleHTML() {
  const title = state.workTitle.trim();
  if (!title) return '';
  const cat   = formatCatalogStr(state.catalogType, state.catalogNumber);
  const date  = formatDateStr(state.workDate);

  if (state.titleType === 'genre') {
    const nick = state.nickname.trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, '');
    // American style: comma inside closing quote when catalog follows
    const nickPart = nick ? (cat ? ', “' + esc(nick) + ',”' : ', “' + esc(nick) + '”') : '';
    const catPart  = nick && cat ? esc(cat.slice(1)) : esc(cat);
    return esc(title) + nickPart + catPart + esc(date);
  }
  if (state.workSize === 'single') {
    // American style: comma inside closing quotation mark
    if (cat.startsWith(', ')) {
      return '“' + esc(title) + ',”' + esc(cat.slice(1)) + esc(date);
    }
    return '“' + esc(title) + '”' + esc(cat) + esc(date);
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
    return '“' + esc(piece) + '”';
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

// Right-side block: composer name on top, dates (and any arrangement)
// on the line(s) directly below — kept together as one column so the
// dates stay under the name even when the title wraps to a second line.
function buildComposerBlockHTML(name, dates, arranger) {
  let blk = '';
  if (name)  blk += '<span class="entry-composer">' + esc(name) + '</span>';
  if (dates) blk += '<span class="entry-right">' + esc(dates) + '</span>';
  if (arranger) {
    arranger.split('\n').filter(a => a.trim()).forEach(al => {
      blk += '<span class="entry-arranger">' + esc(al) + '</span>';
    });
  }
  return blk ? '<span class="entry-composer-block">' + blk + '</span>' : '';
}

// ════════════════════════════════════════════════════════════════
//  Entry builder — returns { html, text }
// ════════════════════════════════════════════════════════════════
function buildEntry() {
  if (!state.workType) return null;
  const composerName  = formatComposerName();
  const composerDates = formatComposerDates(state.composerBorn, state.composerDied, state.composerLiving);
  const arrangerLine  = formatArrangerLine();
  const premiere      = state.premiereType.trim();

  let htmlLines = [];
  let textLines = [];

  if (state.workType === 'complete') {
    const titleHTML = buildTitleHTML();
    if (!titleHTML && !composerName) return null;

    // Row 1: Title ........ Composer block (name over dates/arrangement,
    // kept together so the dates stay under the name even if the title wraps)
    htmlLines.push(
      '<div class="entry-row">' +
      '<span class="entry-title">' + (titleHTML || '&mdash;') + '</span>' +
      buildComposerBlockHTML(composerName, composerDates, arrangerLine) +
      '</div>'
    );
    textLines.push((state.workTitle || '—') + (composerName ? '    ' + composerName : ''));

    // Composer dates + arrangement render inside the Row 1 block above;
    // keep them on their own lines in the plain-text output.
    if (composerDates) {
      textLines.push('                                          ' + composerDates);
    }
    if (arrangerLine) {
      arrangerLine.split('\n').forEach(al => {
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
            '<span class="entry-lyr">' + esc(lyr.trim()) + '</span>' +
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
        htmlLines.push('<div class="entry-perf">' + esc(pl) + '</div>');
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
        '<div class="entry-row">' +
        '<span class="entry-title">' + (pieceDisplay || '&mdash;') + '</span>' +
        (composerName ? '<span class="entry-composer">' + esc(composerName) + '</span>' : '') +
        '</div>'
      );
      textLines.push((state.excerptOnePiece ? '“' + state.excerptOnePiece + (parentRef ? ',' : '') + '”' : '—') +
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
        htmlLines.push('<div class="entry-perf">' + esc(pl) + '</div>');
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
  announce('Copied to clipboard');
}

// Screen-reader status announcements (visually hidden role="status" region).
// Clear-then-set so repeating the same message still re-announces.
function announce(msg) {
  const el = document.getElementById('sr-status');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 50);
}

let editMode = false;
let resultEdited = false; // set when the user actually types in the result box

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

// Leave result-screen edit mode cleanly: contenteditable off, button label reset.
// Called whenever an entry is added/saved/cancelled so the next entry's result
// screen doesn't arrive already-editable with a stale "Done editing" label.
function resetResultEditMode() {
  editMode = false;
  resultEdited = false;
  const el = document.getElementById('result-output');
  if (el) el.setAttribute('contenteditable', 'false');
  const btns = document.querySelectorAll('#new-entry-buttons .btn-secondary, #save-changes-row .btn-secondary');
  btns.forEach(b => { if (b.textContent.includes('Done')) b.textContent = 'Edit text'; });
}

function resetPreviewEditMode() {
  const el = document.getElementById('preview-output');
  if (el) { el.setAttribute('contenteditable', 'false'); el.classList.remove('editable'); }
  const hint = document.getElementById('preview-edit-hint');
  if (hint) hint.style.display = 'none';
}

// Sanitize contenteditable HTML before storing it (paste can bring in markup):
// drop active/embedding elements and event-handler or javascript: attributes.
function sanitizeEntryHtml(html) {
  const tmpl = document.createElement('template');
  tmpl.innerHTML = html;
  tmpl.content.querySelectorAll('script,style,iframe,object,embed,link,meta,form').forEach(n => n.remove());
  tmpl.content.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(a => {
      const n = a.name.toLowerCase();
      if (n.startsWith('on') || ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(a.value))) {
        el.removeAttribute(a.name);
      }
    });
  });
  return tmpl.innerHTML;
}

// Current result entry: rebuilt from wizard state, unless the user manually
// edited the text on the result screen — then keep exactly what they typed.
function captureResultEntry() {
  const entry = buildEntry();
  if (!entry) return null;
  const out = document.getElementById('result-output');
  if (resultEdited && out && (out.innerText || '').trim()) {
    return { html: sanitizeEntryHtml(out.innerHTML), text: (out.innerText || '').trim(), edited: true };
  }
  return { html: entry.html, text: entry.text, edited: false };
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

// ════════════════════════════════════════════════════════════════
//  Program List — Add / Edit / Remove / Clear
// ════════════════════════════════════════════════════════════════
function addToProgram() {
  const entry = captureResultEntry();
  if (!entry) return;
  programEntries.push({
    type: 'entry',
    html: entry.html,
    text: entry.text,
    edited: entry.edited,
    entryState: JSON.parse(JSON.stringify(state))
  });
  renderProgramList();
  updateRightColumn();
  autoSave();

  // Reset for next entry
  isFinalized = false;
  editingIndex = null;
  resetResultEditMode();
  resetPreviewEditMode();
  navHistory = [];
  resetState();
  clearFormInputs();

  // Unfreeze preview column state (now showing program panel)
  document.getElementById('preview-card')?.classList.remove('finalized');

  goToScreen('relationship');
}

function saveProgramEntry() {
  const entry = captureResultEntry();
  if (!entry || editingIndex === null) return;
  programEntries[editingIndex] = {
    type: 'entry',
    html: entry.html,
    text: entry.text,
    edited: entry.edited,
    entryState: JSON.parse(JSON.stringify(state))
  };
  renderProgramList();
  autoSave();

  editingIndex = null;
  resetResultEditMode();
  resetPreviewEditMode();
  isFinalized = false;
  navHistory = [];
  resetState();
  clearFormInputs();
  goToScreen('relationship');
}

function cancelEditEntry() {
  editingIndex = null;
  resetResultEditMode();
  resetPreviewEditMode();
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
  if (programEntries[editingIndex]?.edited) {
    banner.textContent += ' Note: this entry’s text was manually edited — saving regenerates it from the fields below unless you edit the text again on the result screen.';
  }
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
  setSel('arr-role', s.arrangementRole || 'arr.');

  // Catalog selects — a custom prefix (entered via "Other") isn't a preset option,
  // so select "Other" and restore the prefix into the custom input instead
  function setCatalogSel(selId, otherFieldId, otherInputId, value) {
    const sel = document.getElementById(selId);
    if (!sel || !value) return;
    const isPreset = Array.from(sel.options).some(o => o.value === value && value !== 'other');
    const otherField = document.getElementById(otherFieldId);
    if (isPreset) {
      sel.value = value;
      if (otherField) otherField.style.display = 'none';
    } else {
      sel.value = 'other';
      if (otherField) otherField.style.display = 'flex';
      const inp = document.getElementById(otherInputId);
      if (inp) inp.value = value;
    }
  }
  setCatalogSel('cat-type', 'cat-other-field', 'cat-other-label', s.catalogType);
  setCatalogSel('parent-cat-type', 'parent-cat-other-field', 'parent-cat-other-label', s.parentCatalogType);

  // Show/hide catalog number field
  if (s.catalogType) {
    const numField = document.getElementById('cat-num-field');
    if (numField) numField.style.display = 'flex';
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
//  Word Doc (.doc) download — HTML blob, opens in Word
// ════════════════════════════════════════════════════════════════
// Make a name safe for download filenames: strip characters that are illegal
// on Windows/macOS, then collapse whitespace to underscores.
function safeFilename(name, fallback) {
  const s = String(name || '').replace(/[\/\\:*?"<>|]+/g, ' ').trim().replace(/\s+/g, '_');
  return s || fallback;
}

// UTF-8-safe base64. Decode only — older .doc files carry an embedded snapshot,
// and extractSnapshotFromText still reads them. Nothing writes that marker now.
function b64DecodeUtf8(b64) { return decodeURIComponent(escape(atob(b64))); }

// Marker wrapping the hidden snapshot inside the program file.
// LEGACY READ PATH: current .doc proofs no longer embed this marker, but old
// downloaded files still carry it — extractSnapshotFromText (and staff.html's
// copy of the same regex) must keep working, and no generated output may ever
// emit text matching /UMKC-RECITAL-DATA:[A-Za-z0-9+/=]+/ by accident.
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

  // NOTE: This .doc is a faculty PROOF only — it deliberately does NOT embed
  // reload data. Saving/reloading uses the separate .json project file
  // (saveDraftToFile), so faculty edits to this document can never be mistaken
  // for the source of truth.

  // Word's HTML engine ignores display:block on inline <span>s, so the program's
  // title/composer/dates spans collapse onto one line with no spaces. Rebuild each
  // entry as Word-safe block markup: "Title — Composer (dates)", indented movements,
  // centered performers. (Real <div>s already break correctly in Word.)
  function entryToDocHtml(e) {
    const html = e.html || '';
    let root;
    try {
      root = new DOMParser().parseFromString('<div id="__d">' + html + '</div>', 'text/html')
               .getElementById('__d');
    } catch (err) { root = null; }
    if (!root || root.children.length === 0) return html;
    let out = '';
    Array.prototype.forEach.call(root.children, function (el) {
      const cl = el.classList;
      if (cl.contains('entry-row')) {
        const titleEl = el.querySelector('.entry-title');
        const title   = titleEl ? titleEl.innerHTML.trim() : '';
        const pieces  = Array.prototype.map.call(
          el.querySelectorAll('.entry-composer, .entry-right, .entry-arranger'),
          function (s) { return s.innerHTML.trim(); }
        ).filter(Boolean);
        const right = pieces.join(' ');
        let line = title ? '<strong>' + title + '</strong>' : '';
        if (right) line += (title ? ' — ' : '') + right;
        out += '<p class="entry-line" style="margin:2pt 0">' + line + '</p>';
      } else if (cl.contains('entry-indent-right')) {
        const left = el.children.length ? el.children[0].innerHTML : el.innerHTML;
        const rEl  = el.querySelector('.entry-right, .entry-lyr');
        const r    = rEl ? rEl.innerHTML.trim() : '';
        out += '<div style="padding-left:24pt;margin:1pt 0">' + left + (r ? '  ' + r : '') + '</div>';
      } else if (cl.contains('entry-indent')) {
        out += '<div style="padding-left:24pt;margin:1pt 0">' + el.innerHTML + '</div>';
      } else if (cl.contains('entry-perf')) {
        out += '<div style="text-align:center;margin:1pt 0">' + el.innerHTML + '</div>';
      } else {
        out += '<div style="margin:1pt 0">' + el.innerHTML + '</div>';
      }
    });
    return out || html;
  }

  let programHtml = '';
  programEntries.forEach(item => {
    if (item.type === 'intermission') {
      programHtml += '<p class="entry" style="font-weight:bold">— Intermission —</p>';
    } else {
      programHtml += '<div class="entry">' + entryToDocHtml(item) + '</div>';
    }
  });

  const footerHtml = rd.profName && rd.performerName
    ? '<p class="footnote"><em>' + esc(rd.performerName) + ' is a student of ' +
      esc(rd.profTitle || 'Professor') + ' ' + esc(rd.profName) + '.</em></p>'
    : '';
  const degreeHtml = hasDegreeFooter(rd.recitalType) && rd.degree
    ? '<p class="footnote">This recital is being presented in partial fulfillment of the requirements for the degree of ' +
      esc(rd.degree) + '.</p>'
    : '';

  // Free-text block -> escaped Word paragraphs (blank line = new paragraph)
  function docParas(txt) {
    return String(txt || '')
      .split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
      .map(p => '<p style="font-size:11pt;text-align:left">' + esc(p).replace(/\n/g, '<br>') + '</p>')
      .join('');
  }
  const notesDocHtml = (rd.programNotes && rd.programNotes.trim())
    ? '<h2 class="program-head" style="margin-top:20pt">PROGRAM NOTES</h2>' + docParas(rd.programNotes)
    : '';
  const bioName = [rd.performerName, rd.instrument].filter(Boolean).join(', ');
  const bioDocHtml = (rd.performerBio && rd.performerBio.trim())
    ? '<h2 class="program-head" style="margin-top:20pt">ABOUT THE PERFORMER' +
      (bioName ? ' — ' + esc(bioName) : '') + '</h2>' + docParas(rd.performerBio)
    : '';

  const html = `<!DOCTYPE html>
<html lang="en"
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${esc(rd.performerName || 'Recital')} — Faculty Proof</title>
<style>
  /* Plain content proof — left-aligned, no program-style formatting.
     This document is for proofing the TEXT; the formatted program is the web (.html) version. */
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.4; margin: 1in; }
  .disclaimer { background: #FFF3CD; border: 1px solid #E0A800; padding: 8pt 12pt; margin-bottom: 16pt;
                font-size: 11pt; line-height: 1.4; }
  h1 { font-size: 14pt; margin: 0 0 8pt; }
  .detail { margin: 1pt 0; }
  /* Real h2 headings for document structure — styled to render exactly like the old bold divs */
  h2.section, h2.program-head { font-weight: bold; font-size: 12pt; margin: 18pt 0 6pt; }
  .entry { margin: 0 0 10pt; }
  .entry-row { display: block; margin: 0; }
  .entry-title { font-weight: bold; }
  .entry-composer, .entry-right, .entry-arranger { display: block; }
  .entry-composer-block { display: block; }
  .entry-indent, .entry-indent-right { display: block; padding-left: 24pt; }
  .entry-lyr { font-size: 10pt; color: #555555; }
  .entry-perf { text-align: center; font-size: 11pt; }
  .footnote { font-size: 11pt; margin: 4pt 0; }
  em { font-style: italic; }
  .approval { margin-top: 28pt; border-top: 1px solid #999; padding-top: 12pt; font-size: 11pt; }
</style>
</head>
<body>
<div class="disclaimer">
  ⚠ PROOF — FOR FACULTY REVIEW ONLY. Review the text for accuracy: names, titles, dates, repertoire, program notes, and bio.
  Please mark corrections as comments or notes — do <strong>not</strong> retype the program here. All changes are made by the student in the online tool, which produces the published program. This Word copy captures faculty approval only.
</div>
<h1>${rd.recitalType ? esc(rd.recitalType) : 'Recital'}</h1>
${rd.performerName ? '<p class="detail"><strong>' + esc([rd.performerName, rd.instrument].filter(Boolean).join(', ')) + '</strong></p>' : ''}
${rd.accompanist ? '<p class="detail">' + esc(rd.accompanist) + ', piano</p>' : ''}
${(rd.additionalPerformers || '').split('\n').filter(l => l.trim()).map(l => '<p class="detail">' + esc(l.trim()) + '</p>').join('')}
${rd.lectureTitle && rd.recitalType === 'Doctoral Lecture Recital' ? '<p class="detail"><em>&ldquo;' + esc(rd.lectureTitle) + '&rdquo;</em></p>' : ''}
${rd.recitalDate ? '<p class="detail">' + esc(rd.recitalDate) + '</p>' : ''}
${rd.recitalTime || rd.venue ? '<p class="detail">' + esc([rd.recitalTime, rd.venue].filter(Boolean).join(' · ')) + '</p>' : ''}
${rd.academicYear ? '<p class="detail">' + esc(rd.academicYear) + '</p>' : ''}
<h2 class="section">PROGRAM</h2>
${programHtml}
${footerHtml}
${degreeHtml}
<p class="footnote">UMKC Conservatory recitals are recorded. Thank you for helping us maintain a silence in the hall that is conducive to music-making. Be sure to turn off all electronic devices.</p>
${notesDocHtml}
${bioDocHtml}
<div class="approval">
  <p><strong>Faculty Review &amp; Approval</strong></p>
  <p style="margin-top:14pt">Reviewed and approved by (professor signature):</p>
  <p style="margin-top:44pt">_______________________________________________________________</p>
  <p style="margin-top:28pt">Date: _______________________________</p>
  <p style="margin-top:22pt;font-size:9pt;color:#555">Professor signature confirms the program text has been reviewed for accuracy and approved for publishing.</p>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = safeFilename(rd.performerName, 'Recital') + '_Recital_Faculty_Proof.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  announce('Faculty Proof downloaded');
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
  // Clear previous error flags before re-validating
  required.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) {
      el.classList.remove('field-error');
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
    }
  });
  if (missing.length) {
    if (valEl) {
      // Un-hide first, then set the text — role="alert" announces on text injection
      valEl.classList.add('show');
      valEl.textContent = '⚠ Please fill in: ' + missing.map(f => f.label).join(', ');
    }
    // Flag every missing field, focus the first
    missing.forEach(f => {
      const el = document.getElementById(f.id);
      if (el) {
        el.classList.add('field-error');
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute('aria-describedby', 'rd-validation');
      }
    });
    const firstEl = document.getElementById(missing[0].id);
    if (firstEl) firstEl.focus();
    return;
  }
  if (valEl) valEl.classList.remove('show');
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
        <button class="remove-btn" onclick="removeIntermission(${i})" aria-label="Remove intermission">✕</button>
      </div>`;
    }
    // Find the entry index among entries only (for display)
    const entryNum = programEntries.slice(0, i + 1).filter(x => x.type === 'entry').length;
    return `
      <div class="program-entry-card">
        <div class="program-entry-content">${e.html}</div>
        <div class="program-entry-actions">
          <button onclick="editProgramEntry(${i})" aria-label="Edit entry ${entryNum}"><span aria-hidden="true">✏</span> Edit</button>
          <button class="add-intermission-btn" onclick="addIntermissionAfter(${i})" aria-label="Add intermission after entry ${entryNum}" title="Add intermission after this piece">+ Intermission</button>
          <button class="remove-btn" onclick="deleteProgramEntry(${i})" aria-label="Remove entry ${entryNum}"><span aria-hidden="true">✕</span> Remove</button>
        </div>
      </div>
    `;
  }).join('');
}

// ════════════════════════════════════════════════════════════════
//  Recital type → interior header text
// ════════════════════════════════════════════════════════════════
function getHeaderText(recitalType) {
  // Includes legacy types no longer offered in the dropdown (e.g. Senior/Junior
  // Undergraduate, Student Chamber Music) so old saved sessions and reloaded
  // program files still render correctly — keep them.
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

  // Typing in a field flagged by validation clears its error state
  document.addEventListener('input', e => {
    const t = e.target;
    if (t && t.classList && t.classList.contains('field-error')) {
      t.classList.remove('field-error');
      t.removeAttribute('aria-invalid');
    }
  });

  // Track manual edits on the result screen so Add to program / Save keeps them
  const resultOut = document.getElementById('result-output');
  if (resultOut) resultOut.addEventListener('input', () => { resultEdited = true; });
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
  a.download = safeFilename(snapshot.recitalDetails.performerName, 'Recital') + '_Recital_ProjectFile.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  announce('Project file downloaded');
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
      alert('This file can’t be reloaded — it has no hidden program data.\n\n' +
        'Most likely cause: it was opened in Word (or Google Docs) and re-saved, which removes the ' +
        'hidden data.\n\n' +
        'Fix: re-open the program file you downloaded straight from this tool — the copy you did NOT ' +
        'edit or re-save in Word. (That untouched copy is your reload file; the marked-up copy from ' +
        'faculty is only for reading their edits.)');
      return;
    }
    const entryCount = (parsed.programEntries || []).filter(x => x && x.type === 'entry').length;
    const savedStr = parsed.savedAt ? new Date(parsed.savedAt).toLocaleString() : null;
    const summary =
      (parsed.recitalDetails && parsed.recitalDetails.performerName ? 'Performer: ' + parsed.recitalDetails.performerName + '\n' : '') +
      entryCount + ' program ' + (entryCount === 1 ? 'entry' : 'entries') +
      (savedStr ? '\nSaved: ' + savedStr : '');
    const wordWarning =
      '\n\nThis loads your program as it was when this file was saved' + (savedStr ? ' (' + savedStr + ')' : '') + '.\n' +
      'Anything typed directly into Word after that is NOT imported — re-apply faculty’s edits here in the tool.';
    if (!confirm('Continue from this file? It will replace anything currently in the tool.\n\n' + summary + wordWarning)) return;
    try {
      restoreSession(parsed);
      autoSave(); // also persist the loaded program to this browser
    } catch (err) {
      console.error('Could not load program file:', err);
      alert('Sorry — this file’s saved data could not be loaded; it may be incomplete or from an ' +
        'incompatible version. If you edited the file in Word, open the original copy you downloaded ' +
        'from this tool instead, or rebuild the program.');
    }
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
  // Merge onto full defaults so newer recitalDetails fields are never undefined
  // after restoring an older snapshot (same pattern as wizardState below)
  recitalDetails = { ...defaultRecitalDetails(), ...(saved.recitalDetails || {}) };
  // Rebuild HTML from entryState rather than trusting the stored HTML string —
  // except manually-edited entries, whose text exists only in the stored HTML
  programEntries = (saved.programEntries || []).map(e => {
    if (e.type !== 'entry') return e;
    if (e.edited) return { ...e, html: sanitizeEntryHtml(e.html || '') };
    // Merge onto full defaults so incomplete/older entryState can't crash buildEntry()
    const rebuilt = buildEntryFromState({ ...defaultWizardState(), ...(e.entryState || {}) });
    return { ...e, html: rebuilt ? rebuilt.html : e.html, text: rebuilt ? rebuilt.text : e.text };
  });
  state = { ...defaultWizardState(), ...(saved.wizardState || {}) };
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

// English is the only Hunspell dictionary we load. Non-English repertoire
// vocabulary is handled by the curated list in musical-terms.js instead.
//
// History (all measured 2026-07-22 against 204 real form submissions):
//
//   it_IT / es_ES / pt_PT — removed. None of these ever worked, including on
//     the live CDN build. Italian spent ~21s parsing on the main thread (which
//     froze the tab) before throwing "RangeError: Too many properties to
//     enumerate"; Spanish and Portuguese threw TypeError in the affix parser.
//     All three errors were swallowed by the catch in loadDictForLang, so the
//     failures looked like general slowness rather than breakage.
//
//   de_DE / fr_FR — replaced by musical-terms.js. They worked, but cost ~0.7s
//     and ~3.4s of blocking main-thread parse time (4.1s total with English)
//     to rescue just 704 distinct words across the whole historical corpus.
//     A 12 KB curated list covers the same vocabulary at effectively zero cost.
//
// Re-adding a Hunspell dictionary means fixing Typo.js first: dictionaryTable
// must become a Map, and parsing must move off the main thread.
const SPELL_DICT_LANGS = [
  { code: 'en_US', pkg: 'dictionary-en' },
];
let loadedDicts = [];
let dictsReady = false;
const DICT_CACHE = {}; // code → Typo instance | 'loading'

async function loadDictForLang(code) {
  if (DICT_CACHE[code]) return; // already loaded or in flight
  DICT_CACHE[code] = 'loading';
  const lang = SPELL_DICT_LANGS.find(l => l.code === code);
  if (!lang) return;
  const base = 'vendor/'; // self-hosted Hunspell dictionaries — no outside calls
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
  // Load English first so checking starts immediately…
  await loadDictForLang('en_US');
  if (dictsReady) SPELL_TEXTAREA_IDS.concat(SPELL_INPUT_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value?.trim()) runSpellCheck(id);
  });
  // Nothing else to load — non-English terms come from musical-terms.js, which
  // is already in memory (a plain array, no parsing) by the time we get here.
}

// Fields to check
const SPELL_TEXTAREA_IDS = ['movements-input', 'rd-additional', 'performers-input', 'rd-program-notes', 'rd-performer-bio'];
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

// Curated non-English repertoire vocabulary (musical-terms.js). Built lazily so
// script order can't leave us with an empty set, and cached once it's available.
let musicalTermSet = null;
const EMPTY_TERM_SET = new Set();
function getMusicalTerms() {
  if (musicalTermSet === null && Array.isArray(window.MUSICAL_TERMS)) {
    musicalTermSet = new Set(window.MUSICAL_TERMS.map(w => w.toLowerCase()));
  }
  return musicalTermSet || EMPTY_TERM_SET;
}

function spellSkip(word) {
  const w = word.replace(/[.,;:!?'"()[\]{}–—]/g, '');
  if (!w || w.length <= 2) return true;
  const lower = w.toLowerCase();
  if (SPELL_SKIP_WORDS.has(lower)) return true;
  if (getMusicalTerms().has(lower)) return true;
  return SPELL_SKIP_RE.some(re => re.test(w));
}

function getContextDicts(text) {
  // English is the only Hunspell dictionary in play. Non-English repertoire
  // vocabulary is matched earlier, in spellSkip(), against musical-terms.js —
  // see the note on SPELL_DICT_LANGS for why the other dictionaries are gone.
  const active = loadedDicts.filter(d => d.dictionary === 'en_US');
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
  // Polite live region — announced when the flagged-word list actually changes
  div.setAttribute('role', 'status');
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

// Last-rendered flagged-word list per field — the spell check runs every 450ms
// while typing; without this guard the live region would chatter on every run
const spellStatusCache = {};

function updateSpellStatus(id, errors) {
  const el = document.getElementById('spell-status-' + id);
  if (!el) return;
  const unique = [...new Set(errors)];
  const key = unique.join(' ');
  if (spellStatusCache[id] === key) return;
  spellStatusCache[id] = key;
  if (!unique.length) { el.innerHTML = ''; return; }
  el.innerHTML = '⚠ Possible spelling: ' +
    unique.map(w =>
      `<button type="button" class="spell-word"
        onclick="showSpellSuggestions(event,'${escSC(w)}','${id}')"
      >${escSC(w)}</button>`
    ).join(', ');
}

// ── Suggestion popup ───────────────────────────────────────────
let activeSuggPopup = null;
let spellPopupInvoker = null; // spell-word button that opened the popup

function showSpellSuggestions(evt, word, fieldId) {
  hideSpellSuggestions(false);
  spellPopupInvoker = evt.currentTarget || evt.target;
  const suggestions = spellSuggest(word);
  const pop = document.createElement('div');
  pop.className = 'spell-suggestions';
  pop.id = 'spell-popup';
  pop.setAttribute('role', 'menu');
  pop.setAttribute('aria-label', 'Spelling suggestions for ' + word);

  const addItem = (label, cls, action) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'spell-suggestion-item' + (cls ? ' ' + cls : '');
    item.setAttribute('role', 'menuitem');
    item.textContent = label;
    item.onclick = action;
    pop.appendChild(item);
  };

  if (suggestions.length) {
    suggestions.forEach(s => addItem(s, '', () => {
      applySpellSuggestion(word, s, fieldId);
      hideSpellSuggestions(false);
      // The invoking button is re-rendered away once the word is fixed —
      // return focus to the corrected field instead
      const f = document.getElementById(fieldId);
      if (f) f.focus();
    }));
  } else {
    addItem('No suggestions', 'ignore', () => hideSpellSuggestions(true));
  }
  addItem('Ignore', 'ignore', () => hideSpellSuggestions(true));

  // Arrow keys cycle the menu; Escape closes and restores focus
  pop.addEventListener('keydown', e => {
    const items = Array.from(pop.querySelectorAll('.spell-suggestion-item'));
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown')      { e.preventDefault(); items[(idx + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Escape')    { e.preventDefault(); e.stopPropagation(); hideSpellSuggestions(true); }
  });

  document.body.appendChild(pop);
  activeSuggPopup = pop;

  // Position near the clicked word
  const rect = (evt.currentTarget || evt.target).getBoundingClientRect();
  pop.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';
  pop.style.top  = (rect.bottom + 4) + 'px';

  const firstItem = pop.querySelector('.spell-suggestion-item');
  if (firstItem) firstItem.focus();

  // Close on outside click (no focus restore — the user clicked elsewhere)
  setTimeout(() => document.addEventListener('click', () => hideSpellSuggestions(false), { once: true }), 10);
  evt.stopPropagation();
}

function hideSpellSuggestions(restoreFocus) {
  if (activeSuggPopup) { activeSuggPopup.remove(); activeSuggPopup = null; }
  if (restoreFocus && spellPopupInvoker && document.contains(spellPopupInvoker)) spellPopupInvoker.focus();
  spellPopupInvoker = null;
}

function applySpellSuggestion(original, replacement, fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  // Replace only the first whole-word occurrence — a plain substring replace
  // could corrupt a longer word that happens to contain the flagged one
  const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const WORD_CH = 'a-zA-ZÀ-ÿĀ-ɏḀ-ỿ';
  const re = new RegExp('(^|[^' + WORD_CH + '])(' + escaped + ')(?![' + WORD_CH + '])');
  el.value = el.value.replace(re, (m, before) => before + replacement);
  // Trigger state update
  el.dispatchEvent(new Event('input', { bubbles: true }));
  runSpellCheck(fieldId);
}
