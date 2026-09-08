# Lighthouse For Others — Funnel

A 1:1 recreation of the Viral Coach `/get-started/about-you` funnel, rebuilt with LFO's
brand, offer and proof. Static HTML/CSS/JS — no build step, deploys anywhere.

**Mobile-first.** Every base style targets a ~390px viewport; media queries only scale
up. ~90% of traffic is expected on mobile, so that's the primary design target.

---

## The three steps

| Step | Path | What it does |
|---|---|---|
| 1 | `/get-started/about-you/` | Hero VSL + qualification form + full proof stack |
| 2 | `/get-started/book/` | "Just Pick a Time" — GHL calendar, prefilled from step 1 |
| 3 | `/get-started/thanks/` | Confirmation, add-to-calendar, prep video |

`/` redirects to step 1, preserving UTM/click params.
`/privacy/` and `/terms/` back the footer links.

---

## Go live — the whole checklist

Two things left before you can run ads. The CRM plumbing and calendar are done.

### 1. Deploy to a real URL — 5 min

Pure static, no build step. Easiest path:

```bash
cd lfo-funnel
npx netlify-cli deploy --prod --dir .
```

Or drag the `lfo-funnel` folder onto [app.netlify.com/drop](https://app.netlify.com/drop).
Vercel (`npx vercel --prod`) and Cloudflare Pages work identically.

Then point a subdomain at it — `go.lighthouseforothers.com` is the convention. Ad-to-page
domain match matters for both trust and Meta's quality scoring, so don't run ads to a
`*.netlify.app` URL.

Directory URLs (`/get-started/about-you/`) resolve from `index.html` on all three hosts
with no config. On bare nginx you need `index index.html;`.

**Your ad link:**
`https://go.lighthouseforothers.com/?utm_source=ig&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`

The root redirect forwards to step 1 and preserves every param, so you can point ads at
the bare domain.

### 2. Meta pixel — 10 min

Open `assets/js/pixel.js` and set one value:

```js
var PIXEL_ID = '';   // ← Events Manager → Data Sources → your pixel → the 15-16 digit ID
```

That's the whole install — the file is already loaded in the `<head>` of all five pages.
Until you set it, the file is completely inert (no network calls, no errors).

**What fires, and where:**

| Event | Fires on | Type | Use |
|---|---|---|---|
| `PageView` | every page | standard | audiences, retargeting |
| `FormStart` | first field focus | custom | how many people engage at all |
| `PartialLead` | first contactable partial | custom | **retargeting audience** |
| `Lead` | form submitted | standard | mid-funnel signal |
| `AddToCart` | booking completed in widget | standard | booking drop-off diagnosis |
| `Schedule` | call actually booked | standard | **optimise campaigns for this** |

Optimise for **`Schedule`**, not `Lead`. `Lead` only means they filled the form —
`Schedule` means a call is genuinely on Anthony's calendar, which is the thing that
makes money. Once you're doing 50+ `Schedule` events a week, that's your primary
conversion. Below that volume, start on `Lead` so the algorithm has enough signal, then
switch.

`PartialLead` is your best retargeting audience — those people typed a real email or
phone and then bailed. Warmest traffic you'll have.

**Advanced matching is on.** Name, email and phone are passed to the pixel on submit, so
Meta can match conversions to real accounts. The pixel hashes them in the browser before
transmission — raw values never leave the device. This measurably lowers CPL; don't
remove it.

**Verify it:** install the Meta Pixel Helper extension, walk the funnel, confirm the
order above. To watch events in the console without Events Manager, set `DEBUG = true`
at the top of `pixel.js`.

**Worth doing later:** the Conversions API (server-side) recovers the ~20-30% of
conversions iOS blocks client-side. Every event already carries a deduplication
`eventID` (`<session_id>.<EventName>`), so you can add CAPI later without double-counting.

### 3. Partial fills + full leads → your CRM — ✅ DONE

Wired and verified end to end. Nothing left to do here.

**What was built in your GHL** (sub-account: Lighthouse For Others, `OYVI9OmXcn3l0iz3AYz1`):

- **Workflow:** `LFO Funnel -> Contact (webhook)` — Published
  - Trigger: Inbound Webhook (premium, ~$0.01/execution)
  - Action: Create/Update Contact, 13 field mappings
- **9 contact custom fields**, all prefixed `LFO ` so they group together
- **Private Integration** `LFO Funnel` with 4 scopes (custom fields r/w, contacts r/w).
  Token stored locally at `~/.lfo_ghl_token`, chmod 600.

The webhook URL is already in `assets/js/funnel.js` for both `leadWebhook` and
`partialWebhook`.

> **Heads up:** the first webhook URL generated in the GHL UI was **orphaned** — that
> trigger never saved, so its URL pointed nowhere. If you ever rebuild the trigger, the
> URL changes and you must update `funnel.js`.

**Field mappings:**

| GHL field | Webhook value |
|---|---|
| Email | `{{inboundWebhookRequest.email}}` |
| First name / Last name / Phone | `first_name` / `last_name` / `phone` |
| LFO Qualification Summary | `summary` |
| LFO Monthly Revenue | `revenue` |
| LFO Marketing Spend | `spend` |
| LFO Start Timeframe | `start` |
| LFO Business Description | `business` |
| LFO Session ID | `session_id` |
| LFO Funnel Stage | `stage` |
| LFO UTM Source / UTM Campaign | `utm_source` / `utm_campaign` |

**Verified with a live submission.** One contact created, all 9 custom fields populated,
phone normalised to E.164, attribution intact. Critically: the early partial *and* the
completed submission both hit the webhook and produced **one contact, not two** — GHL
matches on email, so dedupe works. Test contact was deleted afterwards.

**How partial capture behaves** (tuned to avoid flooding your CRM):

- Nothing sends until there is a **valid email or phone** — a first-name-only record is
  unusable. Set `partialNeedsContact: false` to capture everything anyway.
- The **first** partial sends immediately, so someone who types an email and vanishes two
  seconds later is still captured.
- Follow-ups throttle to one per `partialThrottleMs` (45s). Without it, one person
  filling eight fields wrote eight records.
- On abandonment a **final** snapshot goes out via `sendBeacon` — the only transport that
  survives the tab closing. Hooked to `pagehide` *and* `visibilitychange`, because iOS
  Safari does not fire `unload` reliably.
- Measured: a lead who fills quickly and submits produces **2 webhook calls**, one
  contact.

**The `stage` field** tells you where they got to: `partial`, `complete`, or `booked`.
Build a smart list on `LFO Funnel Stage = partial` and you have an instant follow-up
queue of people who started and bailed.

### 4. GHL calendar settings — 5 min

The booking widget is **Luke's Calendar**
(`KjdM4H052HH3RCIGuB1M`), embedded on step 2 and prefilled from step 1. Verified
against the live widget: `first_name`, `last_name`, `email` and `phone` all prefill, so
the lead never retypes what they just gave you. (`calendar_notes` does *not* accept a
query param — the business description reaches you through the lead webhook instead.)

**You must set the confirmation redirect.** In GHL: Calendars → Luke's Calendar
→ Confirmation / Thank-you page → redirect to:

```
https://go.lighthouseforothers.com/get-started/thanks/?event_start_time={{appointment.start_time}}&event_end_time={{appointment.end_time}}
```

Two things depend on it:

- **`Schedule` fires on step 3.** That's the conversion event your campaigns optimise
  for. Unlike Calendly, GHL's widget has no "booking complete" postMessage to hook — I
  checked `form_embed.js` and the only relevant message is `modify-parent-url`, which is
  what the redirect setting triggers. No redirect configured means no `Schedule` event.
- **The dated add-to-calendar buttons** on step 3 need those two merge fields. Without
  them the Google button still works (undated, invitee places it) and the iCal button
  hides itself, because an `.ics` with no `DTSTART` is invalid.

There's a safety net in `initCalendar()`: it listens for `modify-parent-url` and, if the
redirect points somewhere other than the thanks page, forwards there anyway so the
conversion still records. Configure the redirect properly regardless.

> **One test I could not run for you.** Completing a booking would have put a real
> appointment in Anthony's calendar, so I stopped short of that. Everything up to the
> contact form is verified. **Do one live test booking yourself** once the redirect is
> set — confirm you land on step 3, then delete the test appointment. That's the only
> unverified link in the chain.

### 5. Legal pages — needs your attorney

`/privacy/` and `/terms/` are written and on-brand, and the data-practices section is
factually accurate to how this funnel actually behaves. **The legal framing has not been
reviewed by counsel.** Both pages carry a visible amber notice saying so — get them
signed off and delete the notice.

Two things worth flagging:

- Your live site's footer "Terms" and "Privacy" buttons are inert `<button>` elements
  with no content behind them. Meta requires a reachable privacy policy URL for lead
  campaigns, and this funnel collects name, email, phone and business detail — so this
  is a real blocker, not housekeeping.
- The **3,000,000-view guarantee** is a commercial promise. Its binding conditions
  belong in your signed client agreement, not on the website. Make sure that agreement
  exists and matches what the funnel claims.

---

## How the copy maps to the source funnel

Structure, layout, type treatment and section order are matched to the reference. The
content is all LFO's, pulled from lighthouseforothers.com.

| Source section | This funnel |
|---|---|
| "1 Million Views *Guaranteed*." | "3 Million Views in 3 Months *Guaranteed*." |
| Hero VSL, muted loop + "Tap for Sound" | Vimeo `1223439033` (LFO VSL V2), same behaviour |
| GHL embed, 8 qualification fields | Native form, same 8 fields, same options |
| Clutch/Trustpilot/G2 review badges | "As featured in" — Yahoo · Daily Mail · BuzzFeed |
| 18-logo client marquee (above the form) | Bumble · Goya · Meta · Toyota — moved *below* the form |
| 4 stat cards | 1.8B views · 2.6M followers · 2M founder · 5 platforms |
| 4-step process, alternating spine | The 6-step **Remix Strategy**, same spine treatment |
| "Rated Excellent ★★★★★ / 1,000+ Reviews" | The Guarantee card — 3,000,000 views / 90 days |
| 12 case-study video cards | 5 real LFO case studies |
| Pull quote — "Everyone has an opinion…" | "Virality isn't luck…" — Anthony Bertoncin |
| Testimonial carousel | "What we handle" + founder card |
| 6-question FAQ | Same 6 questions, answered with LFO's material |
| Closer, giant "1M" watermark | Closer, giant "3M" watermark |

### Where I deliberately didn't copy

Three sections in the reference make claims LFO can't currently substantiate. Rather
than invent numbers, I filled those slots with real LFO proof of equivalent visual
weight:

1. **"Rated Excellent ★★★★★ — Based on 1,000+ Reviews"** → replaced with the guarantee
   card. LFO has no public review corpus; inventing a rating would be a straightforward
   misrepresentation.
2. **The written-testimonial carousel** → replaced with "What we handle for you" plus
   the founder card. Your site carries no written client testimonials to draw from. When
   you have real ones, that's the slot for them.
3. **Case-study bullets.** The reference uses hard metrics ("500k new followers", "21x
   ROAS"). Your site describes these clients qualitatively, so the bullets are
   qualitative too. **Swap in real numbers as soon as you have them** — this is the
   single highest-leverage copy change available on the page.

One section is *added* rather than cloned: **"Your content isn't bad. It's just
unstructured."** (the four pain points). It's core LFO positioning and bridges the stats
into the Remix Strategy. It's a self-contained `<section>` in
`get-started/about-you/index.html` — delete it if you want a stricter clone.

**Section order deviates in one place.** The reference puts its logo marquee between the
hero CTA and the form. At 390px that bar cost 112px and pushed the form down to 677px —
only ~167px of it visible without scrolling. The marquee now runs after the press strip,
below the form, which lifts the form to 566px and puts all four contact fields on screen
at load. On mobile that trade is worth more than the placement fidelity.

Also note: I used your real active-client count where the reference claimed "3,000+
Business Owners." Your site says 15 active clients, which is honest but reads small next
to the other figures, so the fourth stat card uses platform coverage instead. If you
have a cumulative all-time client number, that's a stronger stat — drop it in.

---

## Brand tokens

Taken from lighthouseforothers.com; all in `:root` at the top of `assets/css/funnel.css`.

```
--bg          #0e0e0e    page black
--accent      #99d9f5    lighthouse beam blue  (CTAs use black text on this)
--accent-deep #4fb6e8    glows, focus rings
--accent-soft #cdebfa    serif labels
--serif       Poly       display headlines (matches the reference's face)
--sans        -apple-system → real SF Pro on iOS, where most traffic lands
```

The reference's orange maps to your blue throughout. Source brand logos are
black-on-transparent and get flipped white with `filter: brightness(0) invert(1)`.

---

## Local preview

```bash
cd lfo-funnel
python3 -m http.server 8848
# → http://localhost:8848/
```

## Deploy

Pure static. Drag the folder into Netlify, or:

```bash
npx vercel --prod          # or
npx netlify deploy --prod --dir .
```

Directory-style URLs (`/get-started/about-you/`) resolve from `index.html` on Netlify,
Vercel, Cloudflare Pages and S3+CloudFront with no extra config. On bare nginx, make
sure `index index.html;` is set.

Recommended: host at `go.lighthouseforothers.com` or
`lighthouseforothers.com/get-started/…` so the ad-to-page domain matches your brand.

## A note on `data-step`

Each page carries `<body data-step="apply|book|thanks">`, and `funnel.js` gates its
initialisers on it. **Don't remove those attributes.** Without the marker the step-3
initialiser runs everywhere and fires `Schedule` on the landing page — which would
report every visitor as a booked call and destroy campaign optimisation. If you add a
new page, either give it a `data-step` or leave it off entirely (no funnel logic runs).
