/*
 * Per-tab login for "Log in as store owner" (super admin → Organizations → Log in).
 *
 * The app keeps its login in localStorage, which every tab shares. A tab opened from the
 * Log in icon gets the store owner's login in its own sessionStorage instead (see
 * src/app/impersonate/page.js), and this script — loaded before any app code — makes
 * that tab read and write its login keys there. The super admin's tabs are untouched.
 *
 * Only the login keys below are redirected, and only while this tab carries the
 * "impersonation" marker. Closing the tab (or "Exit") ends the store owner session.
 */
(function () {
  try {
    var FLAG = 'impersonation';
    var PREFIX = 'imp:';
    var KEYS = { adminToken: 1, BHARAT_TOKEN: 1, authUser: 1, authUserType: 1, lastActivityAt: 1 };
    var proto = Storage.prototype;
    var get = proto.getItem, set = proto.setItem, del = proto.removeItem;
    var tab = window.sessionStorage, shared = window.localStorage;

    // The hand-off page (/impersonate) opens in a brand-new tab. Mark it per-tab before the
    // app starts: otherwise the app sees the shared login without this tab's "session
    // alive" marker, treats it as expired and clears it — logging the super admin out.
    if (window.location.pathname === '/impersonate' && get.call(tab, FLAG) === null) {
      set.call(tab, FLAG, JSON.stringify({ pending: true }));
    }

    function redirected(store, key) {
      return store === shared && KEYS[key] === 1 && get.call(tab, FLAG) !== null;
    }
    proto.getItem = function (key) { return redirected(this, key) ? get.call(tab, PREFIX + key) : get.call(this, key); };
    proto.setItem = function (key, value) { return redirected(this, key) ? set.call(tab, PREFIX + key, value) : set.call(this, key, value); };
    proto.removeItem = function (key) { return redirected(this, key) ? del.call(tab, PREFIX + key) : del.call(this, key); };

    window.__tabSession = {
      /** { orgName, by } while this tab is logged in as a store owner ({ pending } during the hand-off), else null. */
      info: function () {
        var raw = get.call(tab, FLAG);
        if (raw === null) return null;
        try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
      },
      /** The login every tab shares (the super admin's), bypassing this tab's own. */
      sharedLogin: function (key) { return KEYS[key] === 1 ? get.call(shared, key) : null; },
      /** Save the store owner login for this tab only. */
      start: function (login, info) {
        set.call(tab, FLAG, JSON.stringify(info || {}));
        set.call(tab, PREFIX + 'adminToken', login.token);
        set.call(tab, PREFIX + 'authUser', JSON.stringify(login.user));
        set.call(tab, PREFIX + 'authUserType', login.userType || '');
        set.call(tab, PREFIX + 'lastActivityAt', String(Date.now()));
        set.call(tab, 'sessionAlive', '1');
      },
      /** End the store owner login in this tab (the super admin stays logged in). */
      exit: function () {
        Object.keys(KEYS).forEach(function (key) { del.call(tab, PREFIX + key); });
        del.call(tab, FLAG);
      },
    };
  } catch (e) {
    // Storage unavailable (private mode / blocked): the app behaves as before.
  }
})();
