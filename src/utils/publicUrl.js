const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export function toPublicUrl(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  if (ABSOLUTE_URL_PATTERN.test(value)) return value;

  const base = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!base) return value;

  return `${base}/${value.replace(/^\/+/, '')}`;
}

export default toPublicUrl;
