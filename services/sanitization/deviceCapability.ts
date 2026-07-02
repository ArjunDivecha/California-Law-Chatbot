/**
 * =============================================================================
 * Device capability check for the on-device privacy filter
 * services/sanitization/deviceCapability.ts
 * =============================================================================
 * WHAT THIS DOES (plain language):
 *   Answers one question: can THIS device realistically run a PII detector?
 *   The two detector paths both fail on phones/tablets —
 *     - `daemon`: the GLiNER daemon runs on the attorney's Mac (localhost);
 *       a phone has no daemon to talk to, so health polls fail forever.
 *     - `web`: the in-browser detector needs the ~1.15 GB fp32 GLiNER model
 *       held in tab memory; iOS Safari kills tabs around that size and its
 *       CacheStorage rejects >~1 GB blobs, so the download loops forever.
 *   On unsupported devices the app must NOT attempt either path: it shows a
 *   clear "filter unavailable on this device" state, keeps public research
 *   usable (server-side regex backstop still guards raw PII), and refuses
 *   client-confidential / protected sends (fail-closed — detection recall is
 *   safety-critical there, per PRD §5.6a).
 *
 * INPUT FILES:  none (reads navigator at runtime; SSR-safe).
 * OUTPUT FILES: none.
 * =============================================================================
 */

/** True when this device can run one of the PII detector paths. */
export function detectorSupportedOnDevice(): boolean {
  if (typeof navigator === 'undefined') return true; // SSR/tests: assume desktop
  const ua = navigator.userAgent ?? '';
  // iPhone / iPod / Android phones & tablets.
  if (/iPhone|iPod|Android/i.test(ua)) return false;
  // iPad: modern iPadOS masquerades as "Macintosh" but is touch-first.
  if (/iPad/i.test(ua)) return false;
  if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return false;
  return true;
}

/** Memoized module-level answer (the device does not change mid-session). */
export const DETECTOR_UNSUPPORTED_ON_DEVICE = !detectorSupportedOnDevice();
