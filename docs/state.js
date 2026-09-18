const STORAGE_KEY = 'pocket-invite';

export const SCREENS = ['s1', 's2', 's3a', 's3b', 's3c', 's4', 's5', 's6', 's7'];

export function emptyState() {
  return {
    screen: 's1',
    path: 'places',
    placeIds: [],
    posterId: null,
    whenId: null,
    weekendDay: '',
    moodId: null,
    herLine: '',
    herPlace: '',
    customNames: {},
    pocketed: false,
  };
}

function sanitizeCustomNames(raw, legacyOther) {
  const names = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([key, value]) => {
      if (typeof key === 'string' && typeof value === 'string') {
        names[key] = value.slice(0, 40);
      }
    });
  }
  if (!names['place-other'] && typeof legacyOther === 'string' && legacyOther.trim()) {
    names['place-other'] = legacyOther.slice(0, 40);
  }
  if (!names['place-other'] && names['cafe-other']) {
    names['place-other'] = names['cafe-other'];
  }
  return names;
}

function sanitize(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;

  const screen = SCREENS.includes(raw.screen) ? raw.screen : 's1';
  const path = raw.path === 'poster' || raw.path === 'write' ? raw.path : 'places';
  const placeIds = Array.isArray(raw.placeIds)
    ? raw.placeIds.filter((id) => typeof id === 'string').slice(0, 2)
    : [];

  return {
    screen,
    path,
    placeIds,
    posterId: typeof raw.posterId === 'string' ? raw.posterId : null,
    whenId: typeof raw.whenId === 'string' ? raw.whenId : null,
    weekendDay: typeof raw.weekendDay === 'string' ? raw.weekendDay.slice(0, 24) : '',
    moodId: typeof raw.moodId === 'string' ? raw.moodId : null,
    herLine: typeof raw.herLine === 'string' ? raw.herLine.slice(0, 80) : '',
    herPlace: typeof raw.herPlace === 'string' ? raw.herPlace.slice(0, 48) : '',
    customNames: sanitizeCustomNames(raw.customNames, raw.otherName),
    pocketed: Boolean(raw.pocketed),
  };
}

export function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  const next = sanitize(state);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function screenFromHash(hash = window.location.hash) {
  const id = String(hash || '').replace(/^#/, '');
  return SCREENS.includes(id) ? id : null;
}

export function writeHash(screen, { replace = false } = {}) {
  if (!SCREENS.includes(screen)) return;
  const url = `${window.location.pathname}${window.location.search}#${screen}`;
  if (replace) {
    history.replaceState({ screen }, '', url);
  } else {
    const current = screenFromHash();
    if (current === screen) {
      history.replaceState({ screen }, '', url);
      return;
    }
    history.pushState({ screen }, '', url);
  }
}
