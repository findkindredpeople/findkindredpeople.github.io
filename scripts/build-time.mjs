export function buildTime() {
  const now = process.env.KINDRED_BUILD_AT ? new Date(process.env.KINDRED_BUILD_AT) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('KINDRED_BUILD_AT must be a valid date and time.');
  return now;
}
