const normalise = value => String(value ?? '').trim().toLocaleLowerCase();
const demonstrationTexts = new Set(['hello kindred! this is a test post.']);

export function isPublicDiscussion(post) {
  return post.isDemo !== true && post.status !== 'demo' && !demonstrationTexts.has(normalise(post.text));
}

export function filterDiscussions(posts, {place = '', category = ''} = {}) {
  const wanted = normalise(place);
  return posts.filter(post => isPublicDiscussion(post)
    && (!wanted || normalise([post.city, post.country].filter(Boolean).join(' ')).includes(wanted))
    && (!category || post.category === category));
}

export function localDateKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function filterMeetups(meetups, {place = '', type = ''} = {}, today = localDateKey()) {
  const wanted = normalise(place);
  return meetups.filter(meetup => /^\d{4}-\d{2}-\d{2}$/.test(meetup.date ?? '') && meetup.date >= today
    && (!wanted || normalise([meetup.city, meetup.country].filter(Boolean).join(' ')).includes(wanted))
    && (!type || meetup.type === type))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time ?? '').localeCompare(String(b.time ?? '')));
}
