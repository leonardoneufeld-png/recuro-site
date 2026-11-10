export const pickLang = (stored, navLangs = []) => {
  if (stored === 'en' || stored === 'de') return stored;
  return navLangs.some((l) => String(l).toLowerCase().startsWith('de')) ? 'de' : 'en';
};

export const t = (strings, key, lang) => {
  const e = strings[key];
  return e ? (lang === 'de' && e.de) || e.en : '';
};

// doc is injectable for tests; defaults to the global document at call time
export const applyLang = (root, strings, lang, doc = globalThis.document) => {
  // a missing key leaves the shipped English in place instead of blanking the element
  const each = (sel, attrName, apply) => root.querySelectorAll(sel).forEach((el) => {
    const v = t(strings, el.getAttribute(attrName), lang);
    if (v) apply(el, v);
  });
  each('[data-i18n]', 'data-i18n', (el, v) => { el.textContent = v; });
  each('[data-i18n-alt]', 'data-i18n-alt', (el, v) => el.setAttribute('alt', v));
  each('[data-i18n-aria]', 'data-i18n-aria', (el, v) => el.setAttribute('aria-label', v));
  if (doc) doc.documentElement.lang = lang;
};

export const createSafeStorage = (storage) => ({
  get(key) {
    try { return storage().getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { storage().setItem(key, value); } catch { /* blocked storage: session-only */ }
  },
});

// lazy lookup: accessing localStorage itself can throw (Safari private mode)
export const safeStorage = createSafeStorage(() => globalThis.localStorage);
