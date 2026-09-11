const formatDate = (value?: string | null) => {
  if (!value) return 'No activity yet';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity yet';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const compactUrl = (url?: string) => {
  if (!url) return 'Untitled destination';

  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
};

export { formatDate, compactUrl };
