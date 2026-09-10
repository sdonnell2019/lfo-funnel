/* ==========================================================================
   Lighthouse For Others, Funnel behavior
   VSL tap-to-unmute · FAQ accordion · qualification form · stat count-up
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     CONFIG, the only block you need to touch
     ------------------------------------------------------------------------ */
  var CONFIG = {
    /* Where step 1 sends the lead. Leave '' and the funnel still works
       (lead is kept in sessionStorage and passed to the calendar), but nothing
       reaches your CRM. Drop in a GoHighLevel / Zapier / Make inbound
       webhook URL to capture every submission. */
    leadWebhook: 'https://services.leadconnectorhq.com/hooks/OYVI9OmXcn3l0iz3AYz1/webhook-trigger/f7cd0d6e-8ad4-4252-ba07-026f35021a69',

    /* Partial fills go here. Point it at the same webhook as leadWebhook and
       branch on the payload's `stage` field ("partial" vs "complete"), or use
       a separate URL to keep half-finished records out of your main pipeline.
       Leave '' to disable partial capture entirely. */
    partialWebhook: 'https://services.leadconnectorhq.com/hooks/OYVI9OmXcn3l0iz3AYz1/webhook-trigger/f7cd0d6e-8ad4-4252-ba07-026f35021a69',

    /* Don't send a partial until we have something we could actually contact
       them with, a record with only a first name is noise. */
    partialNeedsContact: true,

    /* Minimum gap between partial updates for one visitor. The first partial
       always sends immediately; this only throttles the follow-ups. Lower it
       for finer-grained drop-off data at the cost of more CRM writes. */
    partialThrottleMs: 45000,

    /* Funnel step paths, relative to wherever the site is mounted.
       BASE (computed below) turns these into real URLs, so the funnel works
       served from a domain root OR from a subpath like /lfo-funnel/. */
    stepBook:   'calendar/',
    stepThanks: 'case-studies/',

    /* GHL calendar, Luke's Calendar (30 min). Widget id from the embed code. */
    ghlCalendarId: 'KjdM4H052HH3RCIGuB1M',

    /* Hero VSL (Vimeo id) */
    vslId: '1223439033'
  };

  window.LFO = { config: CONFIG };

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var track = function (n, p, o) { if (window.lfoTrack) window.lfoTrack(n, p, o); };
  var sid   = function () { return window.lfoSessionId ? window.lfoSessionId() : ''; };

  /* Which funnel step this page is. Set via <body data-step="…">.
     This gates the conversion events: without it, the step-3 initializer
     runs on every page and fires Schedule on the landing page, which would
     wreck campaign optimization. */
  var STEP = document.body ? (document.body.getAttribute('data-step') || '') : '';

  /* ======================================================================
     Where the site is mounted. On a custom domain this is '/', on GitHub
     Pages it's '/lfo-funnel/'. Derived from the current path so the step
     redirects land correctly either way.
     ====================================================================== */
  var BASE = (function () {
    var p = location.pathname;
    /* every page sits exactly one directory below the mount point, so
       stripping a known page segment yields the root */
    var m = p.match(/^(.*\/)(get-started|calendar|case-studies|privacy|terms)\/?$/);
    if (m) return m[1];
    return p.replace(/[^\/]*$/, '');
  })();

  /* Absolute URL for a funnel path. Named stepUrl, not url, because
     post(url, ...) below takes a parameter of that name and would shadow it. */
  function stepUrl(rel) {
    return BASE + String(rel).replace(/^\/+/, '');
  }
  window.LFO_BASE = BASE;

  /* ======================================================================
     Attribution, read once, persist for the whole session.
     Steps 2 and 3 have no ad params in their URL, so without stashing these
     the click source is lost the moment the visitor leaves step 1.
     ====================================================================== */
  var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
                   'utm_term', 'fbclid', 'gclid', 'ttclid', 'msclkid'];

  function attribution() {
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem('lfo_attr') || '{}'); } catch (_) {}

    var qs = new URLSearchParams(location.search);
    var fresh = false;
    ATTR_KEYS.forEach(function (k) {
      var v = qs.get(k);
      if (v) { stored[k] = v; fresh = true; }
    });
    if (!stored.landing_page) { stored.landing_page = location.href; fresh = true; }
    if (!stored.referrer && document.referrer) { stored.referrer = document.referrer; fresh = true; }

    if (fresh) {
      try { sessionStorage.setItem('lfo_attr', JSON.stringify(stored)); } catch (_) {}
    }
    return stored;
  }

  /* ======================================================================
     Delivery. `beacon` uses sendBeacon, which is the only transport that
     reliably survives the page being closed, required for abandonment.
     ====================================================================== */
  function post(url, payload, beacon) {
    if (!url) return Promise.resolve();
    var body = JSON.stringify(payload);

    if (beacon && navigator.sendBeacon) {
      try {
        // text/plain avoids a CORS preflight, which would be dropped on unload
        var ok = navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        if (ok) return Promise.resolve();
      } catch (_) {}
    }

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      keepalive: true,
      mode: 'cors'
    }).catch(function () {});
  }

  /* ======================================================================
     1. Hero VSL, muted autoplay loop, then tap for sound
     ====================================================================== */
  function initVSL() {
    var shell = $('[data-vsl]');
    if (!shell) return;

    var id    = shell.getAttribute('data-vsl') || CONFIG.vslId;
    var frame = $('iframe', shell);
    var tap   = $('.vsl-tap', shell);
    if (!frame) return;

    // attract state: silent, looping, chrome-free
    frame.src = 'https://player.vimeo.com/video/' + id +
                '?muted=1&autoplay=1&loop=1&autopause=0&controls=0&title=0' +
                '&byline=0&portrait=0&badge=0&dnt=1&playsinline=1';

    if (!tap) return;

    tap.addEventListener('click', function () {
      // reload with sound + controls, from the top. The src swap happens
      // inside the click handler so autoplay-with-audio is permitted.
      frame.src = 'https://player.vimeo.com/video/' + id +
                  '?muted=0&autoplay=1&loop=0&autopause=0&controls=1&title=0' +
                  '&byline=0&portrait=0&badge=0&dnt=1&playsinline=1#t=0s';
      tap.hidden = true;
    });
  }

  /* ======================================================================
     2. FAQ accordion
     ====================================================================== */
  function initFAQ() {
    $$('.faq-i').forEach(function (item) {
      var btn  = $('.faq-q', item);
      var body = $('.faq-a', item);
      if (!btn || !body) return;

      btn.setAttribute('aria-expanded', 'false');

      btn.addEventListener('click', function () {
        var open = item.classList.contains('is-open');

        // one at a time, like the reference
        $$('.faq-i.is-open').forEach(function (other) {
          other.classList.remove('is-open');
          var ob = $('.faq-a', other), oq = $('.faq-q', other);
          if (ob) ob.style.maxHeight = '0px';
          if (oq) oq.setAttribute('aria-expanded', 'false');
        });

        if (!open) {
          item.classList.add('is-open');
          body.style.maxHeight = body.scrollHeight + 'px';
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });

    // keep an open panel correctly sized through orientation changes
    window.addEventListener('resize', function () {
      var open = $('.faq-i.is-open .faq-a');
      if (open) open.style.maxHeight = open.scrollHeight + 'px';
    });
  }

  /* ======================================================================
     3. Stat count-up
     ====================================================================== */
  function initCountUp() {
    var els = $$('[data-count]');
    if (!els.length || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);

        var el     = e.target;
        var target = parseFloat(el.getAttribute('data-count'));
        var suffix = el.getAttribute('data-suffix') || '';
        var dp     = (el.getAttribute('data-dp') | 0);
        var start  = performance.now();
        var dur    = 1100;

        (function tick(now) {
          var p = Math.min((now - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = (target * eased).toFixed(dp) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        })(start);
      });
    }, { threshold: 0.4 });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ======================================================================
     4. Qualification form → step 2
        Also captures partial fills: anyone who starts typing but leaves
        without submitting still produces a contactable record.
     ====================================================================== */
  var FIELDS = ['first_name', 'last_name', 'email', 'phone',
                'business', 'revenue', 'spend', 'start'];

  function initForm() {
    if (STEP !== 'apply') return;
    var form = $('#qualify');
    if (!form) return;

    var errBox = $('.form-err', form);
    var submit = $('.form-submit', form);

    /* ---- partial-fill state ---- */
    var openedAt   = Date.now();
    var started    = false;   // fired FormStart yet?
    var submitted  = false;   // don't report abandonment after a real submit
    var lastSentAt = 0;
    var lastSig    = '';
    var lastEvent  = '';
    var lastField  = '';
    var pixelIdentified = false;
    var partialTracked  = false;

    function snapshot() {
      var fd = new FormData(form);
      var data = {};
      fd.forEach(function (v, k) {
        if (typeof v === 'string') { v = v.trim(); if (v) data[k] = v; }
      });
      return data;
    }

    function contactable(d) {
      var email = d.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email);
      var phone = d.phone && d.phone.replace(/\D/g, '').length >= 7;
      return !!(email || phone);
    }

    function buildPayload(data, stage, event) {
      var filled = FIELDS.filter(function (k) { return !!data[k]; });

      /* One-line digest so whoever takes the call can read the whole
         qualification at a glance on the contact record. */
      var bits = [];
      if (data.revenue)  bits.push('Revenue ' + data.revenue);
      if (data.spend)    bits.push('Spend ' + data.spend);
      if (data.start)    bits.push('Start ' + data.start);
      if (data.business) bits.push(data.business);

      var p = {
        stage: stage,
        event: event,
        session_id: sid(),
        fields_filled: filled,
        /* CRMs map flat strings, not arrays, GHL can't do anything useful
           with fields_filled, so send a joined copy alongside it. */
        fields_filled_csv: filled.join(', '),
        fields_total: FIELDS.length,
        completion_pct: Math.round(filled.length / FIELDS.length * 100),
        last_field: lastField,
        time_on_form_ms: Date.now() - openedAt,
        summary: bits.join(' · '),
        page: location.href,
        occurred_at: new Date().toISOString()
      };
      FIELDS.forEach(function (k) { if (data[k]) p[k] = data[k]; });
      var attr = attribution();
      Object.keys(attr).forEach(function (k) { p[k] = attr[k]; });
      return p;
    }

    /* Send a partial. Deduped on content, throttled, and (by default) held
       back until there's a contact method worth storing. */
    function sendPartial(event, beacon) {
      if (!CONFIG.partialWebhook || submitted) return;

      var data = snapshot();
      if (!Object.keys(data).length) return;
      if (CONFIG.partialNeedsContact && !contactable(data)) return;

      var sig = FIELDS.map(function (k) { return data[k] || ''; }).join('|');
      var now = Date.now();

      if (event === 'abandoned') {
        /* pagehide and visibilitychange both fire on a single navigation, so
           collapse identical back-to-back sends, but stay able to re-fire
           later if they tab away, come back, type more, then leave for good. */
        if (sig === lastSig && lastEvent === 'abandoned' && now - lastSentAt < 3000) return;
      } else {
        /* Throttle on TIME, not content. Content changes on every field, so a
           signature check never throttles, someone filling all eight fields
           would push eight partials into the CRM for one person. Send the
           first one immediately (so a lead who vanishes instantly is still
           captured), then at most one update per interval. The abandonment
           beacon always delivers the final state regardless. */
        if (lastSentAt && now - lastSentAt < CONFIG.partialThrottleMs) return;
      }

      lastSig = sig;
      lastEvent = event;
      lastSentAt = now;

      var payload = buildPayload(data, 'partial', event);
      post(CONFIG.partialWebhook, payload, beacon);

      /* The webhook wants every update (it's the latest-state record), but the
         pixel wants one event per visitor, otherwise a single person filling
         eight fields fires eight PartialLeads and skews the audience counts. */
      if (!partialTracked) {
        partialTracked = true;
        track('PartialLead', { completion_pct: payload.completion_pct }, { custom: true });
      }
    }

    function showErr(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.hidden = false;
    }
    function clearErr() {
      if (errBox) errBox.hidden = true;
      $$('.is-bad', form).forEach(function (el) { el.classList.remove('is-bad'); });
    }

    /* ---- engagement listeners ---- */
    form.addEventListener('focusin', function (e) {
      if (e.target.name) lastField = e.target.name;
      if (!started) {
        started = true;
        track('FormStart', {}, { custom: true });
      }
    });

    form.addEventListener('input', function (e) {
      // live-clear the error state as the user fixes things
      if (e.target.classList) e.target.classList.remove('is-bad');
      if (e.target.name) lastField = e.target.name;
    });

    // a completed field is the natural checkpoint to record progress
    form.addEventListener('change', function (e) {
      if (e.target.name) lastField = e.target.name;
      var data = snapshot();
      if (!pixelIdentified && contactable(data)) {
        pixelIdentified = true;
        if (window.lfoIdentify) window.lfoIdentify(data);
      }
      sendPartial('partial_progress', false);
    });

    /* Abandonment. pagehide is the reliable one on iOS Safari, where most
       of this traffic lands, because it fires on tab switch and back/forward
       navigation where unload does not. */
    function onLeave() {
      if (submitted) return;
      sendPartial('abandoned', true);
    }
    window.addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') onLeave();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErr();

      var bad = null;

      // required text/email/tel/textarea
      $$('[data-required]', form).forEach(function (el) {
        var v = (el.value || '').trim();
        var ok = !!v;
        if (ok && el.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
        if (ok && el.type === 'tel')   ok = (v.replace(/\D/g, '').length >= 7);
        if (!ok) { el.classList.add('is-bad'); bad = bad || el; }
      });

      // required radio groups
      $$('[data-required-group]', form).forEach(function (group) {
        var name = group.getAttribute('data-required-group');
        if (!form.querySelector('input[name="' + name + '"]:checked')) {
          group.classList.add('is-bad');
          bad = bad || group;
        }
      });

      if (bad) {
        showErr('Please complete the highlighted fields so we can review your application.');
        bad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (bad.focus) bad.focus({ preventScroll: true });
        return;
      }

      // ---- collect ----
      submitted = true;
      var lead = buildPayload(snapshot(), 'complete', 'submitted');
      lead.submitted_at = lead.occurred_at;

      try { sessionStorage.setItem('lfo_lead', JSON.stringify(lead)); } catch (_) {}

      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Checking availability…';
      }

      // ---- pixel: this is the Lead conversion ----
      if (window.lfoIdentify) window.lfoIdentify(lead);
      track('Lead', {
        content_name: 'Qualification Application',
        revenue_band: lead.revenue || '',
        spend_band:   lead.spend   || '',
        start_window: lead.start   || ''
      });

      // ---- deliver ----
      var moved = false;
      var done = function () {
        if (moved) return;
        moved = true;
        var p = new URLSearchParams({
          first_name: lead.first_name || '',
          last_name:  lead.last_name  || '',
          email:      lead.email      || '',
          phone:      lead.phone      || ''
        });
        location.href = stepUrl(CONFIG.stepBook) + '?' + p.toString();
      };

      if (CONFIG.leadWebhook) {
        post(CONFIG.leadWebhook, lead, false).then(done, done);
        // never let a slow/blocked webhook trap the lead on step 1
        setTimeout(done, 2500);
      } else {
        // give the pixel a moment to flush before navigating
        setTimeout(done, 250);
      }
    });
  }

  /* ======================================================================
     5. Step 2, GHL booking widget, prefilled, with post-booking hand-off
     ====================================================================== */
  function initCalendar() {
    if (STEP !== 'book') return;
    var frame = $('#ghl-calendar');
    if (!frame) return;

    var qs = new URLSearchParams(location.search);
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem('lfo_lead') || '{}'); } catch (_) {}

    var first = qs.get('first_name') || stored.first_name || '';
    var last  = qs.get('last_name')  || stored.last_name  || '';
    var email = qs.get('email')      || stored.email      || '';
    var phone = qs.get('phone')      || stored.phone      || '';

    /* Verified against the live widget: first_name, last_name, email and phone
       all prefill. calendar_notes does NOT accept a query param, so the
       business description isn't passed here, it already reaches the CRM via
       the lead webhook. */
    var id  = frame.getAttribute('data-booking') || CONFIG.ghlCalendarId;
    var url = new URL('https://api.leadconnectorhq.com/widget/booking/' + id);
    if (first) url.searchParams.set('first_name', first);
    if (last)  url.searchParams.set('last_name',  last);
    if (email) url.searchParams.set('email',      email);
    if (phone) url.searchParams.set('phone',      phone);

    frame.src = url.toString();

    // greet by name if we have it (leading comma so the sentence reads right
    // whether or not a name came through)
    var hi = $('[data-firstname]');
    if (hi && first) hi.textContent = ', ' + first;

    // advanced matching carries onto this step too
    if (window.lfoIdentify) {
      window.lfoIdentify({ first_name: first, last_name: last, email: email, phone: phone });
    }
    track('ViewBookingPage', {}, { custom: true });

    /* GHL's widget doesn't emit a "booking complete" event. What it does emit
      when the calendar's confirmation is set to redirect, is
       ['modify-parent-url', url], which form_embed.js turns into a parent
       navigation. We listen for the same message purely to fire the pixel
       before the page unloads; form_embed.js still does the navigating.

       Note the payload is a plain ARRAY, not the {event:…} object Calendly
       uses, GHL indexes into e.data[0]. */
    window.addEventListener('message', function (e) {
      if (!Array.isArray(e.data)) return;
      if (e.data[0] !== 'modify-parent-url') return;

      track('AddToCart', { content_name: 'Booking completed' });

      /* Safety net: if the calendar redirects somewhere that isn't our thanks
         page, Schedule would never fire. Send them to step 3 ourselves so the
         conversion is recorded, unless form_embed.js is already taking them
         there. */
      var target = e.data[1] || '';
      if (target.indexOf(CONFIG.stepThanks) === -1) {
        setTimeout(function () { location.href = stepUrl(CONFIG.stepThanks); }, 300);
      }
    });
  }

  /* ======================================================================
     6. Step 3, add-to-calendar links
     ====================================================================== */
  function initThanks() {
    /* Hard gate. Schedule is the conversion event campaigns optimize for,
       it must fire on this page and nowhere else. */
    if (STEP !== 'thanks') return;

    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem('lfo_lead') || '{}'); } catch (_) {}

    var hi = $('[data-firstname]');
    if (hi && stored.first_name) hi.textContent = ', ' + stored.first_name;

    /* This is the real conversion, a call actually on the calendar. Optimize
       your Meta campaigns for Schedule, not Lead. */
    if (window.lfoIdentify) window.lfoIdentify(stored);
    track('Schedule', {
      content_name: '30-Minute Discovery Call',
      revenue_band: stored.revenue || '',
      spend_band:   stored.spend   || ''
    });

    /* Tell the CRM the booking completed, so a lead that submitted but never
       booked is distinguishable from one that did. */
    if (CONFIG.leadWebhook && stored.email && !stored.booked_reported) {
      stored.stage = 'booked';
      stored.event = 'call_booked';
      stored.booked_at = new Date().toISOString();
      var q = new URLSearchParams(location.search);
      if (q.get('event_start_time')) stored.event_start_time = q.get('event_start_time');
      if (q.get('event_end_time'))   stored.event_end_time   = q.get('event_end_time');
      post(CONFIG.leadWebhook, stored, false);
      stored.booked_reported = true;
      try { sessionStorage.setItem('lfo_lead', JSON.stringify(stored)); } catch (_) {}
    }

    /* Add-to-calendar buttons were removed from step 3, the page is now a
       proof page, and GHL's confirmation email carries the invite. Everything
       above this line (Schedule pixel event, `booked` webhook) still runs.
       Kept intact so the buttons can be restored by re-adding the elements. */
    var gcal = $('[data-gcal]');
    var ical = $('[data-ical]');
    if (!gcal && !ical) return;

    var title = 'Discovery Call with Lighthouse For Others';
    var details =
      'Your 30-minute discovery call with the Lighthouse For Others team.\n\n' +
      'Check your email for the confirmation and the video link.\n\n' +
      'Before the call, watch the short video at ' + location.origin + stepUrl(CONFIG.stepThanks);

    /* We need the booked slot to build a dated calendar file. GHL doesn't
       append it automatically, you put it in the calendar's redirect URL
       yourself using merge fields (see README):

         …/case-studies/?event_start_time={{appointment.start_time}}
                              &event_end_time={{appointment.end_time}}

       Several spellings are accepted so this keeps working if GHL's merge
       field names differ from the above, or if you switch scheduler later.
       With no usable date the Google button still works undated and the iCal
       button hides itself. */
    var qs = new URLSearchParams(location.search);
    var pick = function (names) {
      for (var i = 0; i < names.length; i++) {
        var v = qs.get(names[i]);
        if (v) return v;
      }
      return null;
    };
    var start = pick(['event_start_time', 'start_time', 'appointment_start_time']);
    var end   = pick(['event_end_time',   'end_time',   'appointment_end_time']);

    var startD = start ? new Date(start) : null;
    var endD   = end   ? new Date(end)   : null;
    var dated  = !!(startD && !isNaN(startD.getTime()));

    if (dated && (!endD || isNaN(endD.getTime()))) {
      endD = new Date(startD.getTime() + 30 * 60 * 1000); // 30-minute call
    }

    // ICS/Google want UTC basic format: 20260903T204500Z
    var stamp = function (d) {
      return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    if (gcal) {
      var g = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
              '&text='    + encodeURIComponent(title) +
              '&details=' + encodeURIComponent(details);
      // With no dates Google still opens a prefilled event for the user to
      // place, useful, so we always render this button.
      if (dated) g += '&dates=' + stamp(startD) + '/' + stamp(endD);
      gcal.href = g;
    }

    if (ical) {
      if (!dated) {
        // A VEVENT with no DTSTART is invalid and most calendar apps reject
        // the file outright. Better to not offer a broken download.
        ical.hidden = true;
      } else {
        var ics = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Lighthouse For Others//Funnel//EN',
          'CALSCALE:GREGORIAN',
          'METHOD:PUBLISH',
          'BEGIN:VEVENT',
          'UID:' + stamp(startD) + '-lfo@lighthouseforothers.com',
          'DTSTAMP:' + stamp(new Date()),
          'DTSTART:' + stamp(startD),
          'DTEND:'   + stamp(endD),
          'SUMMARY:' + title,
          'DESCRIPTION:' + details.replace(/\n/g, '\\n'),
          'ORGANIZER;CN=Lighthouse For Others:mailto:management@lighthouseforothers.com',
          'END:VEVENT',
          'END:VCALENDAR'
        ].join('\r\n');
        ical.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
        ical.setAttribute('download', 'lighthouse-discovery-call.ics');
      }
    }
  }

  /* ======================================================================
     boot
     ====================================================================== */
  function boot() {
    initVSL();
    initFAQ();
    initCountUp();
    initForm();
    initCalendar();
    initThanks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
