import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES } from "../index";

// Controlli di coerenza dei file di traduzione: stesse chiavi in tutte le
// lingue, stessi segnaposto {{...}} e nessuna chiave usata nel codice che
// manchi nei file (altrimenti a schermo comparirebbe la chiave grezza).

type Tree = { [key: string]: string | string[] | Tree };

const locales = import.meta.glob<Tree>("../locales/*.json", { eager: true, import: "default" });
const sources = import.meta.glob<string>(["../../**/*.{ts,tsx}", "!../../**/__tests__/**"], {
  eager: true,
  query: "?raw",
  import: "default",
});

const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === "string") out[prefix + k] = v;
    // Elenchi (letti con returnObjects): contano come un'unica voce.
    else if (Array.isArray(v)) out[prefix + k] = v.join("\n");
    else Object.assign(out, flatten(v, `${prefix}${k}.`));
  }
  return out;
}

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
}

const flat = Object.fromEntries(
  Object.entries(locales).map(([path, tree]) => [path.match(/(\w+)\.json$/)![1], flatten(tree)]),
);
const it_ = flat.it;
// Le chiavi plurali variano per lingua (il russo ha _few/_many, l'arabo _zero/_two...).
const baseKeys = (dict: Record<string, string>) => new Set(Object.keys(dict).map((k) => k.replace(PLURAL, "")));

describe("file di traduzione", () => {
  it("ci sono tutte le lingue supportate", () => {
    expect(Object.keys(flat).sort()).toEqual(SUPPORTED_LANGUAGES.map((l) => l.code).sort());
  });

  for (const { code } of SUPPORTED_LANGUAGES.filter((l) => l.code !== "it")) {
    it(`${code}: stesse chiavi e stessi segnaposto dell'italiano`, () => {
      const dict = flat[code];
      const itBase = baseKeys(it_);
      const base = baseKeys(dict);
      expect([...itBase].filter((k) => !base.has(k))).toEqual([]);
      expect([...base].filter((k) => !itBase.has(k))).toEqual([]);
      const wrong = Object.keys(it_)
        .filter((k) => !PLURAL.test(k) && dict[k] !== undefined)
        .filter((k) => placeholders(it_[k]).join() !== placeholders(dict[k]).join());
      expect(wrong).toEqual([]);
    });
  }

  it("ogni chiave usata nel codice esiste in italiano", () => {
    const itBase = baseKeys(it_);
    const used = new Set<string>();
    for (const code of Object.values(sources)) {
      for (const m of code.matchAll(/\bt\(\s*"([\w.]+)"/g)) used.add(m[1]);
    }
    expect([...used].filter((k) => !itBase.has(k)).sort()).toEqual([]);
  });
});
