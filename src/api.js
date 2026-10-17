export async function api(path, method = 'GET', body) {
  const res = await fetch('/api/' + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'שגיאה בשרת');
  return data;
}

export function formatMoney(n) {
  const rounded = Math.round((n || 0) * 100) / 100;
  return '₪' + rounded.toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

const TRIP_IMAGES = ['/img/hero.jpg', '/img/water.jpg', '/img/forest.jpg', '/img/desert.jpg'];

export function getTripImage(trip) {
  if (!trip) return '/img/hero.jpg';
  const text = `${trip.name || ''} ${trip.destination || ''} ${trip.lodging || ''}`;

  if (/מדבר|נגב|ערבה|מכתש|אילת|ים המלח|מצדה|דרום|רמון|צין|פארן|חوارים|חוורים|תמנע|שדה בוקר/.test(text)) {
    return '/img/desert.jpg';
  }
  if (/נחל|מעיין|מים|כנרת|גולן|גליל|ירדן|בניאס|דן|חצבאני|יהודיה|זאכי|מג׳רסה|חוף|ים|עמק המעיינות|סחנה|אסי/.test(text)) {
    return '/img/water.jpg';
  }
  if (/יער|כרמל|פריחה|כלניות|אביב|הרי ירושלים|שפלה|תבור|מירון|גלבוע|אלון|אורן|חורש/.test(text)) {
    return '/img/forest.jpg';
  }

  // Deterministic hash based on trip name so each trip gets a consistent distinct drawing
  let hash = 0;
  const name = trip.name || '';
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return TRIP_IMAGES[hash % TRIP_IMAGES.length];
}
