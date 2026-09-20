function partsAt(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).formatToParts(date);
  return Object.fromEntries(parts.map(part => [part.type,part.value]));
}
export function wallTimeToUTC(date, time, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Choose a complete date and time.');
  const [year,month,day] = date.split('-').map(Number), [hour,minute] = time.split(':').map(Number);
  const wall = Date.UTC(year,month-1,day,hour,minute);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || new Date(wall).toISOString().slice(0,10) !== date) throw new Error('Choose a valid date and time between 2000 and 2100.');
  // Sample both sides of a possible clock change. Reject nonexistent and ambiguous times.
  const candidates = new Set();
  for (const offset of [-36,0,36]) {
    const probe = new Date(wall + offset * 3600000), p = partsAt(probe,timeZone);
    const zoneOffset = Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute) - probe.getTime();
    const candidate = wall - zoneOffset, c = partsAt(new Date(candidate),timeZone);
    if (`${c.year}-${c.month}-${c.day}` === date && `${c.hour}:${c.minute}` === time) candidates.add(candidate);
  }
  if (candidates.size !== 1) throw new Error(candidates.size ? 'This time occurs twice because the clocks change. Choose another time or use UTC.' : 'This local time does not exist because the clocks change. Choose another time.');
  return new Date([...candidates][0]);
}
const stamp = date => date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const escapeText = text => String(text).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function foldLine(line) {
  let result = '', current = '', size = 0;
  for (const character of line) {
    const length = new TextEncoder().encode(character).length;
    if (size + length > 75) {result += current + '\r\n'; current = ' '; size = 1;}
    current += character; size += length;
  }
  return result + current;
}
export function makeCalendar({title,location = '',description = '',date,time,duration,timeZone = 'Europe/Berlin',source = '',uid}, now = new Date()) {
  if (!title.trim()) throw new Error('Give the calendar entry a title.');
  if (!Number.isInteger(Number(duration)) || Number(duration) < 1 || Number(duration) > 1440) throw new Error('Choose a duration between 1 and 1440 minutes.');
  const start = wallTimeToUTC(date,time,timeZone), end = new Date(+start + Number(duration)*60000);
  let url = '';
  if (source) {const parsed = new URL(source); if (!['http:','https:'].includes(parsed.protocol)) throw new Error('Use a web link for the source.'); url = parsed.href;}
  const safeUid = String(uid || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9@._-]/g,'').slice(0,160);
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Kindred//Personal visit plan//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${safeUid}@findkindredpeople.com`,`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:${escapeText(title)}`,`LOCATION:${escapeText(location)}`,`DESCRIPTION:${escapeText(description + '\nA personal plan, not a booking. Confirm the date, availability and joining terms with the organiser.')}`,...(url ? [`URL:${url}`] : []),'STATUS:TENTATIVE','END:VEVENT','END:VCALENDAR'].map(foldLine).join('\r\n') + '\r\n';
}
export function downloadCalendar(event, filename = 'kindred-visit.ics') {
  const url = URL.createObjectURL(new Blob([makeCalendar(event)], {type:'text/calendar;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
