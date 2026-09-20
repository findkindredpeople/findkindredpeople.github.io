export const storageKey = 'kindred-public-plan-v1';
export const invitationFields = ['name','activity','topic','met','place','day','time'];
export const calendarFields = ['title','place','date','time','duration','zone'];
export function validSavedPlan(raw) {
  if (!raw || raw.version !== 1 || !raw.options || !['start','follow','keep'].includes(raw.options.goal) || ![30,60,120].includes(raw.options.budget)) return null;
  const o = raw.options;
  if (['online','quiet','german'].some(key => typeof o[key] !== 'boolean')) return null;
  if (!Array.isArray(raw.checked) || raw.checked.length !== 7 || raw.checked.some(value => typeof value !== 'boolean')) return null;
  if (typeof raw.invitation !== 'string' || raw.invitation.length > 3000 || typeof raw.note !== 'string' || raw.note.length > 600 || typeof raw.savedAt !== 'string' || !Number.isFinite(Date.parse(raw.savedAt))) return null;
  const cleanFields = (fields, values) => Object.fromEntries(fields.map(key => [key, typeof values?.[key] === 'string' ? values[key].slice(0,200) : '']));
  return {version:1, options:{goal:o.goal,budget:o.budget,online:o.online,quiet:o.quiet,german:o.german}, checked:raw.checked, invitation:raw.invitation,note:raw.note,savedAt:raw.savedAt, fields:cleanFields(invitationFields,raw.fields),calendar:cleanFields(calendarFields,raw.calendar), activityId:typeof raw.activityId === 'string' ? raw.activityId.slice(0,100) : ''};
}
