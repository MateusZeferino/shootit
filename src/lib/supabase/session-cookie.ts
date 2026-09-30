export const SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function persistentSessionCookieOptions<T extends { maxAge?: number }>(options: T) {
  return {
    ...options,
    maxAge: options.maxAge === 0 ? 0 : SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}
