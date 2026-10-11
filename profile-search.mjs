const normalizeCity = value => String(value ?? '').trim().toLowerCase();

export function matchesProfileCity(profileCity, {mode = 'global', city = '', homeCity = ''} = {}) {
  const requestedCity = normalizeCity(city) || (mode === 'nearby' ? normalizeCity(homeCity) : '');
  return !requestedCity || normalizeCity(profileCity).includes(requestedCity);
}
