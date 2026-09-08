/* ==========================================================================
   Meta Pixel — loader + event helpers
   Loaded in <head> (not deferred) so PageView fires as early as possible.

   ── SET THIS ──────────────────────────────────────────────────────────────
   Paste your Meta pixel ID below. Until you do, the whole file is inert:
   no network calls, and lfoTrack() becomes a safe no-op so nothing breaks.
   ========================================================================== */
(function () {
  'use strict';

  var PIXEL_ID = '';   // ← e.g. '1234567890123456'

  /* Set true only while testing. Logs every event to the console instead of
     staying silent, so you can confirm firing order without Events Manager. */
  var DEBUG = false;

  /* ----------------------------------------------------------------------
     A stable per-visitor session id. Lets you stitch a partial fill to the
     completed submission that follows it, and dedupe pixel events against
     server-side Conversions API events later.
     ---------------------------------------------------------------------- */
  function sessionId() {
    var KEY = 'lfo_sid';
    var id;
    try { id = sessionStorage.getItem(KEY); } catch (_) {}
    if (!id) {
      id = 'lfo_' + Date.now().toString(36) + '_' +
           Math.random().toString(36).slice(2, 10);
      try { sessionStorage.setItem(KEY, id); } catch (_) {}
    }
    return id;
  }

  var SID = sessionId();
  window.lfoSessionId = function () { return SID; };

  /* Deterministic-ish event id: same event name in the same session dedupes
     against a Conversions API call using the same id. */
  function eventId(name) {
    return SID + '.' + name;
  }
  window.lfoEventId = eventId;

  if (!PIXEL_ID) {
    // No pixel configured — expose no-ops so callers never have to guard.
    window.lfoTrack = function (name) {
      if (DEBUG) console.log('[lfo pixel: not configured]', name);
    };
    window.lfoIdentify = function () {};
    return;
  }

  /* ---- standard Meta pixel bootstrap ---- */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView', {}, { eventID: eventId('PageView') });

  /* ----------------------------------------------------------------------
     Advanced matching. Re-initialising with the visitor's details lets Meta
     match the conversion to a real account, which materially improves
     attribution and lowers CPL. The pixel hashes these client-side before
     they leave the browser — raw values are never transmitted.
     ---------------------------------------------------------------------- */
  window.lfoIdentify = function (d) {
    if (!d) return;
    var ud = {};
    if (d.email)      ud.em = String(d.email).trim().toLowerCase();
    if (d.phone)      ud.ph = String(d.phone).replace(/\D/g, '');
    if (d.first_name) ud.fn = String(d.first_name).trim().toLowerCase();
    if (d.last_name)  ud.ln = String(d.last_name).trim().toLowerCase();
    if (!Object.keys(ud).length) return;
    fbq('init', PIXEL_ID, ud);
    if (DEBUG) console.log('[lfo pixel] identify', Object.keys(ud));
  };

  /* ----------------------------------------------------------------------
     lfoTrack(name, params, opts)
       opts.custom  → trackCustom instead of track (for non-standard events)
       opts.eventID → override the dedupe id
     ---------------------------------------------------------------------- */
  window.lfoTrack = function (name, params, opts) {
    opts = opts || {};
    var method = opts.custom ? 'trackCustom' : 'track';
    var p = params || {};
    p.session_id = SID;
    var o = { eventID: opts.eventID || eventId(name) };
    if (DEBUG) console.log('[lfo pixel]', method, name, p, o);
    try { fbq(method, name, p, o); } catch (e) {
      if (DEBUG) console.warn('[lfo pixel] failed', e);
    }
  };
})();
