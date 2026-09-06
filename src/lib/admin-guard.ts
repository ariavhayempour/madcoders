const ADMIN_PREFIX = '/admin';
const LOGIN_PATH = '/admin/login';

// Pure /admin gate: redirect signed-out requests to login, exempt the login page (no loop), match the prefix exactly. See docs/claude/0011-admin-auth.md
export function adminRedirect(pathname: string, isAuthenticated: boolean): string | null {
  const inAdminArea = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
  if (!inAdminArea) return null;
  if (pathname === LOGIN_PATH) return null;
  return isAuthenticated ? null : LOGIN_PATH;
}
