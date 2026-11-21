import copy from "./launch-copy.json";
import extra from "./ui-copy.json";

export const launchLanguages = ["ru", "en", "es", "tr", "pt-BR"] as const;
export type Language = keyof typeof copy.languageNames;
export const languageNames = copy.languageNames;
export type LanguageChoice = "auto" | Language;
type Source = "manual" | "portal" | "device" | "fallback";
type Params = Record<string, string | number>;
type Message = Record<string, string>;
type Plural = Record<string, Message | string> & { selector: string };
const messages: Record<string, Message> = {...copy.messages, ...extra};
const plurals: Record<string, Plural> = copy.plurals;
export const languages: readonly Language[] = launchLanguages;
const supported = new Set<Language>(languages);
export function choice(value: unknown): LanguageChoice {
  return typeof value === "string" && supported.has(value as Language) ? value as Language : "auto";
}
export function localeTag(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,3}$/i.test(value)) return;
  try { return new Intl.Locale(value).baseName; }
  catch { return undefined; }
}
function lookup(tag: string): Language | undefined {
  const base = tag.split("-")[0];
  const candidate = base === "pt" ? "pt-BR" : base;
  return supported.has(candidate as Language) ? candidate as Language : undefined;
}
export function resolveLocale(selected: LanguageChoice, portal: string | undefined,
  devices: readonly string[], portalKind?: "yandex_games" | "crazygames", unavailable = false) {
  const fromPortal = localeTag(portal);
  const fromDevice = devices.flatMap(x => localeTag(x) ?? []);
  const requested = fromPortal ?? fromDevice[0] ?? "unknown";
  let ui: Language = "en", source: Source = "fallback";
  let reason = requested === "unknown" ? "no_signal" : "unsupported";
  if (selected !== "auto") return { requested, ui: selected, source: "manual" as const, reason: "none" };
  if (fromPortal) {
    const match = lookup(fromPortal);
    if (match) { ui = match; source = "portal"; reason = "none"; }
    else if (portalKind === "yandex_games" && /^(be|kk|uk|uz)(-|$)/.test(fromPortal)) ui = "ru";
  } else {
    const match = fromDevice.map(lookup).find(Boolean);
    if (match) { ui = match; source = "device"; reason = "none"; }
  }
  return { requested, ui, source, reason: unavailable ? "sdk_unavailable" : reason };
}

export let activeLanguage: Language = "ru";
export function useLanguage(locale: Language) {
  activeLanguage = locale;
  document.documentElement.lang = locale;
}
function fill(value: string, params: Params) {
  return value.replace(/\{([\w-]+)\}/g, (part, key: string) => Object.hasOwn(params,key) ? String(params[key]) : part);
}
export function t(key: string, params: Params = {}) {
  const entry = messages[key];
  return fill(entry?.[activeLanguage] ?? entry?.en ?? entry?.ru ?? key, params);
}
export function plural(key: string, params: Params) {
  const item = plurals[key];
  const selected = new Intl.PluralRules(activeLanguage).select(Number(params[item.selector]));
  const forms = (item[activeLanguage] ?? item.en) as Message;
  return fill(forms[selected] ?? forms.other, params);
}

// Static shell labels retain their original DOM nodes and handlers on language changes.
export function staticCopy(root: HTMLElement) {
  const map = new Map<string,string>();
  for (const [key, value] of Object.entries(messages)) if (value.ru && !value.ru.includes("{")) map.set(value.ru, key);
  const work: (()=>void)[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const key = map.get(node.textContent!.trim());
    if (key) work.push(() => { if (node.isConnected) node.textContent = t(key); });
  }
  for (const node of root.querySelectorAll("[aria-label],[title],[placeholder],[alt]")) {
    for (const name of ["aria-label","title","placeholder","alt"]) {
      let previous = node.getAttribute(name);
      const key = previous && map.get(previous);
      if (key) work.push(() => {
        if (node.getAttribute(name) === previous) {
          previous = t(key);
          node.setAttribute(name, previous);
        }
      });
    }
  }
  return () => work.forEach(update=>update());
}

const staticKeys = new Map(Object.entries(messages).flatMap(([id,row])=>
  row.ru && !row.ru.includes("{") ? [[row.ru,id] as const] : [],
));
export function localName(value: string) { return t(staticKeys.get(value) ?? value); }
export function word(count:number, one:string, few:string, many:string) {
  const category=new Intl.PluralRules(activeLanguage).select(count);
  return localName(category==="one"?one:category==="few"?few:many);
}
