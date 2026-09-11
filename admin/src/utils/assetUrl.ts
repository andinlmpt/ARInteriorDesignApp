/** Turn absolute local upload URLs into same-origin /uploads paths for the admin Vite proxy. */
export function resolveAssetUrl(url?: string | null): string {
  if (!url) return '';
  const value = String(url).trim();
  if (!value) return '';

  try {
    if (value.startsWith('/uploads/')) return value;
    const parsed = new URL(value, window.location.origin);
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // keep original
  }

  return value;
}
