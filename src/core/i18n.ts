// Zweisprachig (Deutsch zuerst, Englisch): L('Deutsch', 'English'); Texte aus Workern als 'Deutsch|English'.
export type Lang = 'de' | 'en';

let lang: Lang = (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
let setting: 'auto' | Lang = 'auto';

export function setLanguage(s: 'auto' | Lang) {
  setting = s;
  lang = s === 'auto' ? ((navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en') : s;
  document.documentElement.lang = lang;
}
export const languageSetting = () => setting;
export const isEn = () => lang === 'en';
export const L = (de: string, en: string) => (lang === 'en' ? en : de);
/** 'Deutsch|English' → passende Hälfte (ohne '|' unverändert). */
export const tr = (s: string) => {
  const i = s.indexOf('|');
  if (i < 0) return s;
  // mehrere Paare hintereinander ('a|b' + 'c|d' ergibt 'a|bc|d') kommen nicht vor; nur ein Trennzeichen
  return lang === 'en' ? s.slice(i + 1) : s.slice(0, i);
};

const locale = () => (lang === 'en' ? 'en-US' : 'de-DE');
export const N = (v: number) => Math.round(v).toLocaleString(locale());
export const F = (v: number, d = 1) => v.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
export function time(s: number) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
/** Mio/s lesbar: 1.234 Mio/s → „1,2 Mrd.“ */
export const rate = (mio: number) => (mio >= 1000 ? F(mio / 1000, 1) + L(' Mrd.', ' bn') : F(mio, mio < 10 ? 1 : 0) + L(' Mio.', ' M'));
export const dateStr = (iso: string) => {
  try { return new Date(iso).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso; }
};
