function placeName(places, id, customNames) {
  const place = places.find((item) => item.id === id);
  if (!place) return '';
  if (place.custom) {
    return String(customNames?.[id] || '').trim();
  }
  return place.name;
}

function whenLine(whenWindows, whenId, weekendDay) {
  const windowItem = whenWindows.find((item) => item.id === whenId);
  if (!windowItem) return '';
  const day = String(weekendDay || '').trim();
  if (windowItem.needsDay && day) {
    return `${windowItem.label}, ${day}.`;
  }
  return `${windowItem.label}.`;
}

export function buildNote({ places = [], whenWindows = [], moods = [], state }) {
  const when = whenLine(whenWindows, state.whenId, state.weekendDay);
  const her = String(state.herLine || '').trim();

  if (state?.path === 'write') {
    const raw = String(state.herPlace || '').trim();
    if (!raw) return '';
    const where = /[.!?…]$/.test(raw) ? raw : `${raw}.`;
    return [where, when, her, 'Иду.'].filter(Boolean).join('\n');
  }

  const ids = Array.isArray(state?.placeIds) ? state.placeIds.filter(Boolean) : [];
  const first = placeName(places, ids[0], state?.customNames);
  if (!first) return '';

  const second = placeName(places, ids[1], state?.customNames);
  const where = second ? `${first} и ещё ${second}.` : `${first}.`;

  if (state?.path === 'poster') {
    const place = places.find((item) => item.id === ids[0]);
    const memory = place?.memory || '';
    return [where, when, memory, her, 'Иду.'].filter(Boolean).join('\n');
  }

  const mood = moods.find((item) => item.id === state.moodId);
  const moodText = mood ? `Настроение: ${mood.label}.` : '';

  return [where, when, moodText, her, 'Иду.'].filter(Boolean).join('\n');
}

export function whatsappUrl(number, text) {
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text || '')}`;
}

export function mailtoHref(address, text) {
  const mail = String(address || '').trim();
  if (!mail) return '';
  return `mailto:${mail}?body=${encodeURIComponent(text || '')}`;
}
