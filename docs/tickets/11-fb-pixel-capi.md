# Ticket 11: Facebook Pixel and CAPI Integration

## Goal
Implement client-side Pixel and server-side Conversions API with deduplication.

## Tasks
1. Frontend Pixel setup:
   - Install Pixel base code in root layout (only if cookie consent given)
   - Create `lib/fb-pixel.ts` with typed event functions:
     - `fbTrackPageView()`
     - `fbTrackViewContent({ contentId, contentType, value? })`
     - `fbTrackAddToCart({ value, currency, contentIds })`
     - `fbTrackInitiateCheckout({ value, currency })`
     - `fbTrackCompleteRegistration({ method })`
   - Each event generates UUID `event_id`, also sent to backend for CAPI dedup
2. Backend CAPI module:
   - `FbCapiService.sendEvent(eventName, eventId, userData, customData)`
   - Hash user PII (email, fbp cookie, fbc cookie, IP, user-agent) per FB spec
   - POST to `https://graph.facebook.com/v18.0/{PIXEL_ID}/events`
   - Use `FB_TEST_EVENT_CODE` in non-production
   - Log every call to `FbEvent` table
3. Integration points:
   - Frontend: PageView, ViewContent, AddToCart, InitiateCheckout (immediately on user action)
   - Backend: CompleteRegistration (in auth service after register), Purchase (in Stripe webhook), Subscribe (in Stripe webhook)
   - Frontend ALSO sends Purchase + Subscribe with same event_id from URL param after Stripe redirect
4. Cookie handling:
   - Capture `_fbp` and `_fbc` cookies, store in user session
   - Pass to CAPI calls for proper attribution
5. fbclid handling:
   - On any page with `?fbclid=...`, generate `_fbc` cookie: `fb.1.{timestamp}.{fbclid}`
6. Cookie consent:
   - Use simple banner (e.g., react-cookie-consent or custom)
   - Pixel + CAPI only fire after consent
   - Persist consent in cookie

## Event Spec

### Purchase (CAPI)
```json
{
  "event_name": "Purchase",
  "event_time": <unix>,
  "event_id": "<same-as-frontend>",
  "action_source": "website",
  "user_data": {
    "em": ["<sha256(email)>"],
    "client_ip_address": "...",
    "client_user_agent": "...",
    "fbp": "...",
    "fbc": "..."
  },
  "custom_data": {
    "currency": "USD",
    "value": 9.99,
    "content_ids": ["pack_120"],
    "content_type": "product"
  }
}
```

## Acceptance Criteria
- FB Events Manager Test Events tab shows all events live
- Browser-sent and server-sent events show as deduplicated
- Cookie consent banner blocks all tracking until accepted
- All event_ids match between frontend and backend in `fb_events` table
- No PII sent unhashed

## Out of Scope
- TikTok / Google tracking (V2)
- Server-side GTM via Stape (use direct CAPI for MVP, can migrate later)
