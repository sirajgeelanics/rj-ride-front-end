/**
 * Shared option search: every typed word must match (any order), results are ranked so the most
 * likely hit comes first, accents and punctuation are ignored, and a near-miss typo still finds
 * something instead of an empty list.
 */

/** lower-case, strip accents, turn punctuation into spaces, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]+/g, " ")
    .trim();
}

export function tokens(query: string): string[] {
  const n = normalize(query);
  return n ? n.split(" ") : [];
}

/** Is `needle` an in-order (not necessarily adjacent) subsequence of `hay`? "sdn" ⊂ "sedan". */
function isSubsequence(needle: string, hay: string): boolean {
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) if (hay[j] === needle[i]) i++;
  return i === needle.length;
}

/** Score of one token against the label (strong) and description/keywords (weak); 0 = no match. */
function scoreToken(tok: string, label: string, extra: string): number {
  if (label === tok) return 100;
  if (label.startsWith(tok)) return 80;
  if (label.split(" ").some((w) => w.startsWith(tok))) return 60;
  if (label.includes(tok)) return 40;
  if (extra) {
    if (extra.split(" ").some((w) => w.startsWith(tok))) return 15;
    if (extra.includes(tok)) return 10;
  }
  return 0;
}

export interface Searchable {
  label: string;
  description?: string;
  keywords?: string;
}

/**
 * Filter + rank. Empty query returns the list untouched. Falls back to a looser in-order
 * letter match when nothing matches exactly, so "sdn" or a dropped letter still lands.
 */
export function searchOptions<T extends Searchable>(options: T[], query: string): T[] {
  const toks = tokens(query);
  if (!toks.length) return options;

  const prepared = options.map((o, index) => ({
    o,
    index,
    label: normalize(o.label),
    extra: normalize(`${o.description ?? ""} ${o.keywords ?? ""}`),
  }));

  const ranked = prepared
    .map((p) => {
      let total = 0;
      for (const t of toks) {
        const s = scoreToken(t, p.label, p.extra);
        if (!s) return { ...p, score: 0 };
        total += s;
      }
      // Slightly prefer shorter labels (a closer match), then the caller's own order.
      return { ...p, score: total - Math.min(p.label.length, 40) / 100 };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  if (ranked.length) return ranked.map((p) => p.o);

  // Typo / abbreviation fallback — only for a single compact word so it stays meaningful.
  const joined = toks.join("");
  if (joined.length >= 3) {
    return prepared.filter((p) => isSubsequence(joined, p.label.replace(/ /g, ""))).map((p) => p.o);
  }
  return [];
}

/** Split `text` into [{text, hit}] so matched parts can be emphasised. */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const toks = tokens(query);
  if (!toks.length) return [{ text, hit: false }];
  const pattern = toks
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const re = new RegExp(`(${pattern})`, "ig");
  // split() with a capture group alternates [other, match, other, match, …] — decide "hit" by that
  // position BEFORE dropping empty pieces, or a leading match shifts every flag by one.
  return text
    .split(re)
    .map((piece, i) => ({ text: piece, hit: i % 2 === 1 }))
    .filter((part) => part.text !== "");
}

/** Does `text` contain every typed word (any order, accents/case/punctuation ignored)? */
export function matchesWords(text: string, query: string): boolean {
  const toks = tokens(query);
  if (!toks.length) return true;
  const hay = normalize(text);
  return toks.every((t) => hay.includes(t));
}

/** For codes such as plates: compares with ALL spaces/dashes removed, so "ka01 ab-1234"
 * finds "KA 01 AB 1234" and a partial like "ab12" finds it too. */
export function matchesCompact(text: string, query: string): boolean {
  const q = normalize(query).replace(/ /g, "");
  if (!q) return true;
  return normalize(text).replace(/ /g, "").includes(q);
}
