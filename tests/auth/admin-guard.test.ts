import { describe, it, expect } from 'vitest';
import { adminRedirect } from '../../src/lib/admin-guard';

describe('adminRedirect', () => {
  describe('signed-out requests to admin routes redirect to login', () => {
    it('redirects /admin to /admin/login', () => {
      expect(adminRedirect('/admin', false)).toBe('/admin/login');
    });

    it('redirects /admin/ to /admin/login', () => {
      expect(adminRedirect('/admin/', false)).toBe('/admin/login');
    });

    it('redirects a nested admin route to /admin/login', () => {
      expect(adminRedirect('/admin/events', false)).toBe('/admin/login');
    });
  });

  describe('the login page is never redirected (no loop)', () => {
    it('lets a signed-out request to /admin/login through', () => {
      expect(adminRedirect('/admin/login', false)).toBeNull();
    });

    it('lets a signed-in request to /admin/login through', () => {
      expect(adminRedirect('/admin/login', true)).toBeNull();
    });
  });

  describe('signed-in admins reach any admin route', () => {
    it('lets a signed-in request to /admin through', () => {
      expect(adminRedirect('/admin', true)).toBeNull();
    });

    it('lets a signed-in request to a nested admin route through', () => {
      expect(adminRedirect('/admin/events', true)).toBeNull();
    });
  });

  describe('non-admin paths are untouched regardless of auth', () => {
    it('lets the home page through when signed-out', () => {
      expect(adminRedirect('/', false)).toBeNull();
    });

    it('lets /contact through when signed-out', () => {
      expect(adminRedirect('/contact', false)).toBeNull();
    });

    it('lets an API route through when signed-out', () => {
      expect(adminRedirect('/api/rsvp', false)).toBeNull();
    });

    it('lets a non-admin path through when signed-in', () => {
      expect(adminRedirect('/', true)).toBeNull();
    });

    it('does not treat a lookalike prefix as an admin route', () => {
      expect(adminRedirect('/administrator', false)).toBeNull();
    });
  });
});
