const ANONYMOUS_ID_KEY = "rationaltrade.analytics.anonymousId";
const ADTAG_KEY = "rationaltrade.analytics.adtag.v1";

export function getAnalyticsAnonymousId() {
  try {
    let anonymousId = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    if (!anonymousId) {
      anonymousId = crypto.randomUUID();
      window.localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
    }
    return anonymousId;
  } catch {
    return undefined;
  }
}

export function captureAnalyticsAdtag(search: string) {
  const current = normalizeAdtag(new URLSearchParams(search).get("adtag"));
  try {
    if (current) {
      window.localStorage.setItem(ADTAG_KEY, current);
      return current;
    }
    return normalizeAdtag(window.localStorage.getItem(ADTAG_KEY));
  } catch {
    return current;
  }
}

export function getAnalyticsAdtag() {
  try {
    return normalizeAdtag(window.localStorage.getItem(ADTAG_KEY));
  } catch {
    return undefined;
  }
}

function normalizeAdtag(value: string | null) {
  const normalized = value?.trim().normalize("NFKC");
  return normalized && normalized.length <= 64 && /^[\p{L}\p{N}._-]+$/u.test(normalized) ? normalized : undefined;
}
