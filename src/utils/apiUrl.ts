export function normalizeEndpointUrl(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const cleanPath = path.trim().startsWith('/') ? path.trim() : `/${path.trim()}`;

  if (base.endsWith('/v1') && cleanPath.startsWith('/v1/')) {
    return `${base}${cleanPath.slice(3)}`;
  }
  if (!base.endsWith('/v1') && !cleanPath.startsWith('/v1/')) {
    return `${base}/v1${cleanPath}`;
  }
  return `${base}${cleanPath}`;
}
