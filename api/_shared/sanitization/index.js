import {
  runPatterns
} from "./patterns.ts";
import { findAllowlistMatches, overlapsAllowlist } from "./allowlist.ts";
import { detectNames } from "./detectNames.ts";
function patternToSpan(m) {
  return {
    start: m.start,
    end: m.end,
    category: m.category,
    raw: m.raw,
    label: m.label
  };
}
function nameToSpan(n) {
  return {
    start: n.start,
    end: n.end,
    category: "name",
    raw: n.raw,
    label: n.signal
  };
}
function mergeSpans(spans) {
  if (spans.length <= 1) return [...spans];
  const sorted = [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });
  const out = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (!last || s.start >= last.end) {
      out.push(s);
      continue;
    }
    const lastLen = last.end - last.start;
    const sLen = s.end - s.start;
    if (sLen > lastLen) {
      out[out.length - 1] = s;
    }
  }
  return out;
}
function analyze(text) {
  if (!text || typeof text !== "string") {
    return { spans: [], suppressedByAllowlist: 0 };
  }
  const allowlist = findAllowlistMatches(text);
  const rawPatternSpans = runPatterns(text).map(patternToSpan);
  const rawNameSpans = detectNames(text).map(nameToSpan);
  const all = [...rawPatternSpans, ...rawNameSpans];
  const unsuppressed = all.filter(
    (s) => !overlapsAllowlist(s.start, s.end, allowlist)
  );
  const suppressedByAllowlist = all.length - unsuppressed.length;
  const merged = mergeSpans(unsuppressed);
  return { spans: merged, suppressedByAllowlist };
}
export {
  analyze
};
