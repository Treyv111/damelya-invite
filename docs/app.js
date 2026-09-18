import { loadState, saveState, screenFromHash, writeHash, emptyState } from './state.js';
import { buildNote, whatsappUrl, mailtoHref } from './note.js';

const PLACE_LIMIT = 2;
const FLASH_MS = 1800;
const FLAP_MS = 400;
const POCKET_SLIDE = 320;
const POCKET_PAUSE = 80;

let data = null;
let state = emptyState();
let allowPocketStay = false;
let pocketError = false;
let keepTwoTimer = 0;
let flapTimer = 0;
let listsBuilt = false;
let dragStartY = null;
let dragOffset = 0;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function copy(key, fallback = '') {
  return data?.copy?.[key] || fallback;
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function persist() {
  state = saveState(state);
}

function placeById(id) {
  return data.places.find((place) => place.id === id);
}

function posterById(id) {
  return data.posters.find((poster) => poster.id === id);
}

function whenById(id) {
  return data.whenWindows.find((item) => item.id === id);
}

function noteText() {
  return buildNote({
    places: data.places,
    whenWindows: data.whenWindows,
    moods: data.moods,
    state,
  });
}

function go(screen, { replace = false, skipHash = false } = {}) {
  if (!screen) return;
  state.screen = screen;
  persist();
  if (!skipHash) writeHash(screen, { replace });
  showScreen(screen);
  renderScreen(screen);
}

function showScreen(screen) {
  $$('.screen').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.screen === screen);
  });
}

function bindViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const update = () => {
    const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
  };
  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  update();
}

function setTitle() {
  const name = data.nickname || 'Дамеля';
  document.title = `${name}, пойдём погулять`;
}

function skipsMood() {
  return state.path === 'poster' || state.path === 'write';
}

function herPlaceReady() {
  return Boolean(String(state.herPlace || '').trim());
}

function updateLetterCta() {
  const cta = $('#cta-s2');
  if (!cta) return;
  const ready = herPlaceReady();
  cta.disabled = !ready;
  cta.textContent = ready ? copy('chooseWhere') : copy('chooseWhereNeed');
  $('#her-place').value = state.herPlace || '';
}

function hydrateLetter() {
  const letter = data.letter;
  $('#flap-caption').textContent = letter.flapCaption;
  $('#envelope').setAttribute('aria-label', `письмо ${letter.flapCaption}`);
  $('#touch-hint').textContent = copy('touchHint');
  $('#letter-greeting').textContent = letter.greeting;
  $('#letter-headline').textContent = letter.headline;
  $('#letter-body').textContent = letter.body;
  $('#letter-afterthought').textContent = letter.afterthought;
  $('#cta-s2').textContent = copy('chooseWhereNeed');
  $('#link-posters').textContent = copy('orPosters');
  $('#her-place-hint').textContent = copy('herPlaceHint');
  $('#her-place-label').textContent = copy('herPlaceLabel');
  $('#her-place').placeholder = copy('herPlacePlaceholder');
  $('#back-s3a').textContent = copy('backToLetter');
  $('#back-s3b').textContent = copy('backToLetter');
  $('#back-s4').textContent = copy('backToPlaces');
  $('#back-s5').textContent = copy('backToWhen');
  $('#where-caption').textContent = copy('whereCaption');
  $('#and-also').textContent = copy('andAlso');
  $('#keep-two').textContent = copy('keepTwo');
  $('#posters-caption').textContent = copy('postersCaption');
  $('#choose-myself').textContent = copy('chooseMyself');
  $('#back-s3c').textContent = copy('backToPosters');
  $('#cta-s3c').textContent = copy('posterHereNeed');
  $('#cta-s4').textContent = copy('whenCta');
  $('#cta-s5').textContent = copy('moodCta');
  $('#note-caption').textContent = copy('noteCaption');
  $('#her-hint').textContent = copy('herLineHint');
  $('#her-label').textContent = copy('herLineLabel');
  $('#her-line').placeholder = copy('herLinePlaceholder');
  $('#day-label').textContent = copy('dayLabel');
  $('#weekend-day').placeholder = copy('dayPlaceholder');
  $('#without-this').textContent = copy('withoutThis');
  $('#cta-pocket').textContent = copy('pocketCta');
  $('#cta-pocket').setAttribute('aria-label', copy('pocketAria'));
  $('#mail-link').textContent = copy('orMail');
  $('#pocket-error').textContent = copy('pocketError');
  $('#cta-s7').textContent = copy('backToPocket');
  $('#wait-copy').textContent = copy('waitBody');
  updateLetterCta();
}

function photoOrFallback(src, place, extraClass = '') {
  const wrap = document.createElement('div');
  const img = document.createElement('img');
  img.src = src;
  img.alt = place.name;
  img.className = extraClass;
  img.addEventListener('error', () => {
    img.replaceWith(fallbackEl(place, extraClass));
  });
  wrap.append(img);
  return img;
}

function fallbackEl(place, extraClass = '') {
  const el = document.createElement('div');
  el.className = `photo-fallback ${extraClass}`.trim();
  const name = document.createElement('strong');
  name.textContent = place.name;
  el.append(name);
  return el;
}

function buildLists() {
  if (listsBuilt) return;
  renderPlaces();
  renderPosters();
  renderWhens();
  renderMoods();
  listsBuilt = true;
}

function displayPlaceName(place) {
  if (!place) return '';
  if (place.custom) {
    return String(state.customNames?.[place.id] || '').trim() || place.name;
  }
  return place.name;
}

function placesReady() {
  if (!state.placeIds.length) return false;
  return state.placeIds.every((id) => {
    const place = placeById(id);
    if (!place) return false;
    if (place.custom) return Boolean(String(state.customNames?.[id] || '').trim());
    return true;
  });
}

function otherLabel(place) {
  if (place.group === 'park') return copy('otherParkLabel');
  if (place.group === 'cafe') return copy('otherCafeLabel');
  return copy('otherPlaceholder');
}

function placeBlock(place) {
  const wrap = document.createElement('div');
  wrap.className = 'place-block';
  wrap.dataset.placeId = place.id;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'place-card';
  btn.dataset.placeId = place.id;
  btn.setAttribute('aria-pressed', 'false');
  const photo = photoOrFallback(place.photo, place, 'place-card__photo');
  const title = document.createElement('p');
  title.className = 'h2 place-card__name';
  title.textContent = place.name;
  const memory = document.createElement('p');
  memory.className = 'memory place-card__memory';
  memory.textContent = place.memory;
  btn.append(photo, title, memory);
  btn.addEventListener('click', () => selectPlace(place.id));
  wrap.append(btn);

  if (place.custom) {
    const field = document.createElement('div');
    field.className = 'other-field';
    field.hidden = true;
    const label = document.createElement('label');
    label.className = 'sr-only';
    label.htmlFor = `other-${place.id}`;
    label.textContent = otherLabel(place);
    const input = document.createElement('input');
    input.id = `other-${place.id}`;
    input.type = 'text';
    input.maxLength = 40;
    input.autocomplete = 'off';
    input.placeholder = copy('otherPlaceholder');
    input.addEventListener('input', (event) => {
      state.customNames = { ...state.customNames, [place.id]: event.target.value.slice(0, 40) };
      persist();
      updatePlacesUI();
    });
    input.addEventListener('focus', () => {
      input.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
    field.append(label, input);
    wrap.append(field);
  }

  return wrap;
}

function renderPlaces() {
  const deck = $('#place-deck');
  deck.replaceChildren();
  if (!data.places.length) {
    const empty = document.createElement('article');
    empty.className = 'paper empty-deck';
    const p = document.createElement('p');
    p.className = 'body';
    p.style.color = 'var(--ink)';
    p.textContent = copy('placesEmpty');
    const toPosters = document.createElement('button');
    toPosters.type = 'button';
    toPosters.className = 'quiet-link';
    toPosters.textContent = copy('orPosters');
    toPosters.addEventListener('click', () => {
      state.path = 'poster';
      persist();
      go('s3b');
    });
    empty.append(p, toPosters);
    deck.append(empty);
    return;
  }

  const groups = [
    { id: 'cafe', label: copy('groupCafe') },
    { id: 'park', label: copy('groupPark') },
    { id: 'cinema', label: copy('groupCinema') },
  ];
  const used = new Set();
  groups.forEach((group) => {
    const items = data.places.filter((place) => place.group === group.id);
    if (!items.length) return;
    const heading = document.createElement('p');
    heading.className = 'caption deck-label';
    heading.textContent = group.label;
    deck.append(heading);
    items.forEach((place) => {
      used.add(place.id);
      deck.append(placeBlock(place));
    });
  });
  data.places
    .filter((place) => !used.has(place.id))
    .forEach((place) => deck.append(placeBlock(place)));
}

function posterTilt(poster) {
  if (reducedMotion()) return 'none';
  return `rotate(${Number(poster?.tilt) || 0}deg)`;
}

function renderPosters() {
  const list = $('#poster-list');
  list.replaceChildren();
  data.posters.forEach((poster) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'poster-card';
    btn.dataset.posterId = poster.id;
    btn.style.transform = posterTilt(poster);
    btn.setAttribute('aria-label', [poster.title, poster.line].filter(Boolean).join(', '));

    const img = document.createElement('img');
    img.src = poster.photo;
    img.alt = '';
    img.className = 'poster-card__photo';
    img.addEventListener('error', () => {
      img.replaceWith(fallbackEl({ name: poster.title, memory: poster.line }, 'poster-card__photo'));
    });

    const body = document.createElement('div');
    body.className = 'poster-card__body';
    const title = document.createElement('h2');
    title.className = 'h2';
    title.textContent = poster.title;
    const line = document.createElement('p');
    line.className = 'memory poster-card__line';
    line.textContent = poster.line || '';
    body.append(title, line);
    btn.append(img, body);
    btn.addEventListener('click', () => openPoster(poster.id));
    list.append(btn);
  });
}

function renderPosterPlaces() {
  const list = $('#poster-place-list');
  const caption = $('#poster-open-caption');
  const cta = $('#cta-s3c');
  list.replaceChildren();
  const poster = posterById(state.posterId);
  caption.textContent = poster?.title || '';

  const places = (poster?.placeIds || []).map((id) => placeById(id)).filter(Boolean);
  if (!places.length) {
    const empty = document.createElement('article');
    empty.className = 'paper empty-deck';
    const p = document.createElement('p');
    p.className = 'body';
    p.style.color = 'var(--ink)';
    p.textContent = copy('placesEmpty');
    const toDeck = document.createElement('button');
    toDeck.type = 'button';
    toDeck.className = 'quiet-link';
    toDeck.textContent = copy('chooseMyself');
    toDeck.addEventListener('click', () => {
      state.posterId = null;
      state.path = 'places';
      state.placeIds = [];
      persist();
      go('s3a');
    });
    empty.append(p, toDeck);
    list.append(empty);
    cta.hidden = true;
    return;
  }

  cta.hidden = false;
  places.forEach((place) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'poster-place';
    btn.dataset.placeId = place.id;
    btn.setAttribute('aria-pressed', 'false');
    const title = document.createElement('p');
    title.className = 'h2';
    title.textContent = place.name;
    const memory = document.createElement('p');
    memory.className = 'memory poster-place__memory';
    memory.textContent = place.memory;
    btn.append(title, memory);
    btn.addEventListener('click', () => selectPosterPlace(place.id));
    list.append(btn);
  });
}

function renderWhens() {
  const list = $('#when-list');
  list.replaceChildren();
  data.whenWindows.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'when-card';
    btn.dataset.whenId = item.id;
    btn.setAttribute('aria-pressed', 'false');
    const label = document.createElement('span');
    label.className = 'h2';
    label.textContent = item.label;
    const caption = document.createElement('span');
    caption.className = 'caption caption--ink';
    caption.textContent = item.caption;
    btn.append(label, caption);
    btn.addEventListener('click', () => selectWhen(item.id));
    list.append(btn);
  });
}

function renderMoods() {
  const grid = $('#mood-grid');
  grid.replaceChildren();
  data.moods.forEach((mood) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mood-card';
    btn.dataset.moodId = mood.id;
    btn.setAttribute('aria-pressed', 'false');
    const texture = document.createElement('img');
    texture.src = mood.texture;
    texture.alt = '';
    texture.className = 'mood-card__texture';
    const label = document.createElement('span');
    label.className = 'mood-card__label';
    label.textContent = mood.label;
    btn.append(texture, label);
    btn.addEventListener('click', () => selectMood(mood.id));
    grid.append(btn);
  });
}

function selectPlace(id) {
  const ids = [...state.placeIds];
  const index = ids.indexOf(id);
  const wasSelected = index >= 0;
  if (index >= 0) {
    ids.splice(index, 1);
    state.placeIds = ids;
  } else if (ids.length < PLACE_LIMIT) {
    ids.push(id);
    state.placeIds = ids;
  } else {
    ids[1] = id;
    state.placeIds = ids;
    flashKeepTwo();
  }
  state.path = 'places';
  state.posterId = null;
  persist();
  try {
    navigator.vibrate?.(10);
  } catch {
    /* ignore */
  }
  updatePlacesUI();
  if (!wasSelected && placeById(id)?.custom) {
    const input = document.querySelector(`#other-${id}`);
    input?.focus();
  }
}

function flashKeepTwo() {
  const el = $('#keep-two');
  el.hidden = false;
  window.clearTimeout(keepTwoTimer);
  keepTwoTimer = window.setTimeout(() => {
    el.hidden = true;
  }, FLASH_MS);
}

function openPoster(id) {
  if (state.posterId !== id) {
    state.placeIds = [];
  }
  state.posterId = id;
  state.path = 'poster';
  state.moodId = null;
  persist();
  go('s3c');
}

function selectPosterPlace(id) {
  const current = state.placeIds[0];
  state.placeIds = current === id ? [] : [id];
  state.path = 'poster';
  persist();
  try {
    navigator.vibrate?.(10);
  } catch {
    /* ignore */
  }
  updatePosterPlacesUI();
}

function selectWhen(id) {
  state.whenId = state.whenId === id ? null : id;
  if (!whenById(state.whenId)?.needsDay) {
    state.weekendDay = '';
    $('#weekend-day').value = '';
  }
  persist();
  updateWhenUI();
}

function selectMood(id) {
  state.moodId = state.moodId === id ? null : id;
  persist();
  updateMoodUI();
}

function updatePlacesUI() {
  const selected = state.placeIds;
  $$('.place-card').forEach((card) => {
    const id = card.dataset.placeId;
    const index = selected.indexOf(id);
    card.classList.toggle('is-selected', index === 0);
    card.classList.toggle('is-second', index === 1);
    card.classList.toggle('is-dim', selected.length > 0 && index < 0);
    card.setAttribute('aria-pressed', index >= 0 ? 'true' : 'false');
    card.querySelector('.seal')?.remove();
    card.querySelector('.also-tag')?.remove();
    if (index === 0) {
      const seal = document.createElement('span');
      seal.className = 'seal';
      seal.setAttribute('aria-hidden', 'true');
      card.append(seal);
    }
    if (index === 1) {
      const tag = document.createElement('span');
      tag.className = 'also-tag';
      tag.textContent = copy('alsoHere');
      card.append(tag);
    }
  });

  const ribbon = $('#place-ribbon');
  ribbon.replaceChildren();
  if (!selected.length) {
    ribbon.hidden = true;
  } else {
    ribbon.hidden = false;
    selected.forEach((id) => {
      const place = placeById(id);
      if (!place) return;
      const item = document.createElement('div');
      item.className = 'ribbon-item';
      item.append(photoOrFallback(place.photo, place));
      const cap = document.createElement('span');
      cap.className = 'caption caption--ink';
      cap.textContent = displayPlaceName(place);
      item.append(cap);
      ribbon.append(item);
    });
  }

  $$('.other-field').forEach((field) => {
    const input = field.querySelector('input');
    const id = input?.id?.replace(/^other-/, '');
    const on = selected.includes(id);
    field.hidden = !on;
    if (on && input && document.activeElement !== input) {
      input.value = state.customNames?.[id] || '';
    }
  });

  $('#and-also').hidden = selected.length !== 1;
  const cta = $('#cta-s3a');
  const ready = placesReady();
  const needsOther = state.placeIds.some((id) => placeById(id)?.custom) && !ready;
  cta.disabled = !ready;
  cta.textContent = ready
    ? copy('placesCta')
    : needsOther
      ? copy('placesCtaNeedOther')
      : copy('placesCtaNeed');
}

function updatePostersUI() {
  $$('.poster-card').forEach((card) => {
    const poster = posterById(card.dataset.posterId);
    card.style.transform = posterTilt(poster);
  });
}

function posterPlaceReady() {
  const poster = posterById(state.posterId);
  if (!poster) return false;
  const id = state.placeIds[0];
  if (!id || !poster.placeIds.includes(id)) return false;
  const place = placeById(id);
  if (!place) return false;
  if (place.custom) return Boolean(String(state.customNames?.[id] || '').trim());
  return true;
}

function updatePosterPlacesUI() {
  const selected = state.placeIds[0] || '';
  $$('.poster-place').forEach((card) => {
    const on = card.dataset.placeId === selected;
    card.classList.toggle('is-selected', on);
    card.classList.toggle('is-dim', Boolean(selected) && !on);
    card.setAttribute('aria-pressed', on ? 'true' : 'false');
    card.querySelector('.seal')?.remove();
    if (on) {
      const seal = document.createElement('span');
      seal.className = 'seal';
      seal.setAttribute('aria-hidden', 'true');
      card.append(seal);
    }
  });
  const cta = $('#cta-s3c');
  const ready = posterPlaceReady();
  cta.disabled = !ready;
  cta.textContent = ready ? copy('posterHereCta') : copy('posterHereNeed');
}

function whenSelectionReady() {
  if (!state.whenId) return false;
  if (whenById(state.whenId)?.needsDay && !String(state.weekendDay || '').trim()) return false;
  return true;
}

function updateWhenReminder() {
  const el = $('#when-place-reminder');
  if (state.path === 'write') {
    const text = String(state.herPlace || '').trim();
    if (!text) {
      el.hidden = true;
      el.replaceChildren();
      return;
    }
    el.hidden = false;
    el.replaceChildren();
    const name = document.createElement('p');
    name.className = 'body';
    name.textContent = text;
    el.append(name);
    return;
  }
  if (state.path !== 'poster') {
    el.hidden = true;
    el.replaceChildren();
    return;
  }
  const place = placeById(state.placeIds[0]);
  if (!place) {
    el.hidden = true;
    el.replaceChildren();
    return;
  }
  el.hidden = false;
  el.replaceChildren();
  const name = document.createElement('p');
  name.className = 'body';
  name.textContent = displayPlaceName(place);
  const memory = document.createElement('p');
  memory.className = 'memory';
  memory.textContent = place.memory;
  el.append(name, memory);
}

function updateWhenBack() {
  const back = $('#back-s4');
  if (state.path === 'poster') {
    back.textContent = copy('backToOpenPoster');
    back.dataset.go = 's3c';
  } else if (state.path === 'write') {
    back.textContent = copy('backToLetter');
    back.dataset.go = 's2';
  } else {
    back.textContent = copy('backToPlaces');
    back.dataset.go = 's3a';
  }
}

function updateWhenUI() {
  $$('.when-card').forEach((card) => {
    const selected = card.dataset.whenId === state.whenId;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
  const needsDay = Boolean(whenById(state.whenId)?.needsDay);
  $('#day-field').hidden = !needsDay;
  if (needsDay) {
    $('#weekend-day').value = state.weekendDay;
  }
  const ready = whenSelectionReady();
  $('#cta-s4').disabled = !ready;
  $('#cta-s4').dataset.go = skipsMood() ? 's6' : 's5';
}

function updateMoodUI() {
  $$('.mood-card').forEach((card) => {
    const selected = card.dataset.moodId === state.moodId;
    card.classList.toggle('is-selected', selected);
    card.classList.toggle('is-dim', Boolean(state.moodId) && !selected);
    card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    card.querySelector('.seal')?.remove();
    if (selected) {
      const seal = document.createElement('span');
      seal.className = 'seal';
      seal.setAttribute('aria-hidden', 'true');
      card.append(seal);
    }
  });
  $('#cta-s5').disabled = !state.moodId;
}

function updateNoteUI() {
  $('#note-preview').textContent = noteText();
  $('#her-line').value = state.herLine;
  const back = $('#back-s6');
  if (skipsMood()) {
    back.textContent = copy('backToWhen');
    back.dataset.go = 's4';
  } else {
    back.textContent = copy('backToPlaces');
    back.dataset.go = 's3a';
  }

  const mail = mailtoHref(data.mailto, noteText());
  const row = $('#mail-row');
  const link = $('#mail-link');
  if (mail) {
    row.hidden = false;
    link.href = mail;
    link.classList.toggle('is-loud', pocketError);
    link.classList.toggle('quiet-link--cream', !pocketError);
  } else {
    row.hidden = true;
    link.removeAttribute('href');
  }
  $('#pocket-error').hidden = !pocketError;
}

function updateWaitUI() {
  const first = placeById(state.placeIds[0]);
  const hero = $('#wait-hero');
  hero.replaceChildren();
  const title = document.createElement('p');
  title.className = 'display wait-title';
  title.textContent = copy('waiting');
  if (first) {
    hero.append(photoOrFallback(first.photo, first));
    $('#wait-memory').textContent = first.memory;
  } else if (state.path === 'write' && herPlaceReady()) {
    hero.append(fallbackEl({ name: state.herPlace.trim(), memory: '' }));
    $('#wait-memory').textContent = state.herPlace.trim();
  } else {
    hero.append(fallbackEl({ name: data.nickname, memory: '' }));
    $('#wait-memory').textContent = '';
  }
  hero.append(title);

  const second = placeById(state.placeIds[1]);
  const secondRow = $('#wait-second');
  secondRow.replaceChildren();
  if (second) {
    secondRow.hidden = false;
    secondRow.append(photoOrFallback(second.photo, second));
    const cap = document.createElement('span');
    cap.className = 'caption';
    cap.textContent = `${copy('andMore')} ${second.name}`;
    secondRow.append(cap);
  } else {
    secondRow.hidden = true;
  }
}

function renderScreen(screen) {
  if (screen === 's2') updateLetterCta();
  if (screen === 's3a') updatePlacesUI();
  if (screen === 's3b') updatePostersUI();
  if (screen === 's3c') {
    renderPosterPlaces();
    updatePosterPlacesUI();
  }
  if (screen === 's4') {
    updateWhenBack();
    updateWhenReminder();
    updateWhenUI();
  }
  if (screen === 's5') updateMoodUI();
  if (screen === 's6') updateNoteUI();
  if (screen === 's7') updateWaitUI();
}

function canLeave(from, to) {
  if (from === 's2' && to === 's4') return herPlaceReady();
  if (from === 's3a' && to === 's4') return placesReady();
  if (from === 's3c' && to === 's4') return posterPlaceReady();
  if (from === 's4' && to === 's5') {
    if (skipsMood()) return false;
    return whenSelectionReady();
  }
  if (from === 's4' && to === 's6') {
    if (!skipsMood()) return false;
    return whenSelectionReady();
  }
  if (from === 's5' && to === 's6') return Boolean(state.moodId);
  return true;
}

function openEnvelope() {
  window.clearTimeout(flapTimer);
  if (state.screen !== 's1') return;
  const envelope = $('#envelope');
  envelope.classList.add('is-ready');
  if (reducedMotion()) {
    go('s2');
    return;
  }
  envelope.classList.add('is-open');
  flapTimer = window.setTimeout(() => go('s2'), FLAP_MS);
}

function startEnvelope() {
  const envelope = $('#envelope');
  envelope.classList.remove('is-open');
  envelope.classList.add('is-ready');
}

async function pocketNote() {
  pocketError = false;
  const url = whatsappUrl(data.whatsappNumber, noteText());
  if (!url) {
    pocketError = true;
    updateNoteUI();
    return;
  }
  allowPocketStay = false;
  state.pocketed = true;
  persist();

  const sheet = $('#note-sheet');
  if (!reducedMotion() && sheet) {
    sheet.classList.add('is-pocketing');
    await new Promise((resolve) => window.setTimeout(resolve, POCKET_SLIDE + POCKET_PAUSE));
  }

  try {
    window.location.assign(url);
  } catch {
    pocketError = true;
    sheet?.classList.remove('is-pocketing');
    updateNoteUI();
  }
}

function bindNoteDrag() {
  const sheet = $('#note-sheet');
  const onDown = (event) => {
    if (reducedMotion()) return;
    if (event.target.closest('input, a, button')) return;
    dragStartY = event.clientY;
    dragOffset = 0;
    sheet.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event) => {
    if (dragStartY == null) return;
    dragOffset = Math.max(0, event.clientY - dragStartY);
    sheet.style.transform = `translateY(${dragOffset}px)`;
  };
  const onUp = () => {
    if (dragStartY == null) return;
    const dy = dragOffset;
    dragStartY = null;
    dragOffset = 0;
    sheet.style.transform = '';
    if (dy >= 56) pocketNote();
  };
  sheet.addEventListener('pointerdown', onDown);
  sheet.addEventListener('pointermove', onMove);
  sheet.addEventListener('pointerup', onUp);
  sheet.addEventListener('pointercancel', onUp);
}

function maybeS7FromReturn() {
  state = loadState();
  if (state.pocketed && !allowPocketStay) {
    go('s7', { replace: true });
  }
}

function bindNav() {
  $('#envelope').addEventListener('click', openEnvelope);

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-go]');
    if (!btn) return;
    const to = btn.dataset.go;
    if (btn.id === 'cta-s7') {
      allowPocketStay = true;
    }
    if (!canLeave(state.screen, to)) return;
    if (btn.id === 'cta-s2') {
      state.path = 'write';
      state.placeIds = [];
      state.posterId = null;
    }
    if (to === 's3a') state.path = 'places';
    if (to === 's3b') state.path = 'poster';
    persist();
    go(to);
  });

  $('#choose-myself').addEventListener('click', () => {
    state.posterId = null;
    state.path = 'write';
    state.placeIds = [];
    state.whenId = null;
    state.weekendDay = '';
    state.moodId = null;
    persist();
    go('s2');
    $('#her-place')?.focus();
  });

  $('#her-place').addEventListener('input', (event) => {
    state.herPlace = event.target.value.slice(0, 48);
    persist();
    updateLetterCta();
  });
  $('#her-place').addEventListener('focus', () => {
    $('#her-place').scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  });

  $('#weekend-day').addEventListener('input', (event) => {
    state.weekendDay = event.target.value.slice(0, 24);
    persist();
    updateWhenUI();
  });

  $('#her-line').addEventListener('input', (event) => {
    state.herLine = event.target.value.slice(0, 80);
    persist();
    updateNoteUI();
  });

  $('#cta-pocket').addEventListener('click', pocketNote);

  $('#weekend-day').addEventListener('focus', () => {
    $('#weekend-day').scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
  $('#her-line').addEventListener('focus', () => {
    $('#her-line').scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  });

  window.addEventListener('popstate', () => {
    const fromHash = screenFromHash() || 's1';
    enterScreen(fromHash, { replace: true });
  });

  window.addEventListener('hashchange', () => {
    const fromHash = screenFromHash();
    if (fromHash && fromHash !== state.screen) {
      enterScreen(fromHash, { replace: true });
    }
  });

  window.addEventListener('pageshow', maybeS7FromReturn);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') maybeS7FromReturn();
  });
}

async function loadData() {
  const res = await fetch('./data/invite.json');
  if (!res.ok) throw new Error('invite missing');
  return res.json();
}

function resolvedScreen(screen) {
  if (!screen) return screen;
  if (screen === 's5' && skipsMood()) {
    return whenSelectionReady() ? 's6' : 's4';
  }
  if (screen === 's3c' && !posterById(state.posterId)) {
    return 's3b';
  }
  return screen;
}

function enterScreen(screen, { replace = false } = {}) {
  const next = resolvedScreen(screen) || screen;
  go(next, { replace: replace || next !== screen });
}

function resolveStartScreen() {
  const hash = screenFromHash();
  if (state.pocketed && !allowPocketStay) return 's7';
  if (hash) return resolvedScreen(hash);
  return resolvedScreen(state.screen || 's1');
}

async function init() {
  bindViewport();
  try {
    data = await loadData();
  } catch {
    data = { nickname: 'Дамеля', places: [], posters: [], whenWindows: [], moods: [], copy: {}, letter: {}, mailto: '', whatsappNumber: '' };
    $('#envelope').classList.add('is-ready');
    $('#envelope').addEventListener('click', openEnvelope);
    startEnvelope();
    return;
  }
  $('#envelope').classList.add('is-ready');
  state = loadState();
  setTitle();
  hydrateLetter();
  buildLists();
  bindNav();
  bindNoteDrag();

  const start = resolveStartScreen();
  state.screen = start;
  persist();
  writeHash(start, { replace: true });
  showScreen(start);
  renderScreen(start);

  if (start === 's1') startEnvelope();
}

init();
