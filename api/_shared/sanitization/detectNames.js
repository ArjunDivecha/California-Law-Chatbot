const NAME_WORD = `[A-Z][a-zA-Z'\\-]*`;
const NAME_PHRASE = `${NAME_WORD}(?:\\s+${NAME_WORD}){0,3}`;
const TITLE_WORD = `(?:Mr|Mrs|Ms|Miss|Dr|Prof|Hon|Justice|Sen|Rep|Gov|Sheriff|Officer|Deputy|Attorney|Judge)`;
function scanTitlePrefix(text) {
  const re = new RegExp(`\\b${TITLE_WORD}\\.?\\s+(${NAME_PHRASE})`, "g");
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[0].indexOf(m[1]);
    out.push({
      start,
      end: start + m[1].length,
      raw: m[1],
      signal: "title_prefix"
    });
  }
  return out;
}
function scanPossessive(text) {
  const re = new RegExp(`\\b(${NAME_PHRASE})(?:'s|'s)\\b`, "g");
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    out.push({
      start,
      end: start + m[1].length,
      raw: m[1],
      signal: "possessive"
    });
  }
  return out;
}
function scanRelational(text) {
  const relationWord = `(?:client|ward|decedent|deceased|testator|testatrix|trustor|settlor|trustee|beneficiary|guardian|conservator|conservatee|personal\\s+representative|executor|executrix|administrator|administratrix|petitioner|respondent|plaintiff|defendant|debtor|creditor|assignor|assignee|opposing\\s+party|husband|wife|spouse|son|daughter|child|children|sibling|brother|sister|mother|father|parent|partner|fiance|fiancee|niece|nephew|cousin|aunt|uncle)`;
  const cueRe = new RegExp(
    `\\b(?:[Mm]y\\s+|[Oo]ur\\s+|[Tt]he\\s+|[Aa]\\s+|[Hh]is\\s+|[Hh]er\\s+)?${relationWord}(?:\\s+named)?\\s+`,
    "gi"
  );
  const nameRe = new RegExp(`^(${NAME_PHRASE})`);
  const out = [];
  let cueMatch;
  while ((cueMatch = cueRe.exec(text)) !== null) {
    const nameStart = cueMatch.index + cueMatch[0].length;
    const tail = text.slice(nameStart);
    const nameMatch = nameRe.exec(tail);
    if (!nameMatch) continue;
    const raw = nameMatch[1];
    if (/^(He|She|They|It|We|You|I)$/.test(raw)) continue;
    out.push({
      start: nameStart,
      end: nameStart + raw.length,
      raw,
      signal: "relational"
    });
  }
  return out;
}
function scanAddressCue(text) {
  const re = new RegExp(`\\b(${NAME_PHRASE})(?=\\s*(?:,\\s*age\\s+\\d+|,?\\s*residing\\s+at|,?\\s*of\\s+[A-Z]))`, "g");
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      start: m.index,
      end: m.index + m[1].length,
      raw: m[1],
      signal: "address_cue"
    });
  }
  return out;
}
function scanCapitalizedBigram(text) {
  const re = new RegExp(`(?<!^)(?<![.!?]\\s)\\b(${NAME_WORD}\\s+${NAME_WORD}(?:\\s+${NAME_WORD})?)\\b`, "g");
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const raw = m[1];
    const firstWord = raw.split(/\s+/)[0];
    if (COMMON_NON_NAME_STARTS.has(firstWord)) continue;
    out.push({
      start: m.index,
      end: m.index + raw.length,
      raw,
      signal: "capitalized_bigram"
    });
  }
  return out;
}
const COMMON_NON_NAME_STARTS = /* @__PURE__ */ new Set([
  "The",
  "A",
  "An",
  "My",
  "Our",
  "Their",
  "His",
  "Her",
  "This",
  "That",
  "These",
  "Those",
  "No",
  "Yes",
  "First",
  "Second",
  "Third",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
]);
function detectNames(text) {
  return [
    ...scanTitlePrefix(text),
    ...scanPossessive(text),
    ...scanRelational(text),
    ...scanAddressCue(text),
    ...scanCapitalizedBigram(text)
  ];
}
export {
  detectNames
};
