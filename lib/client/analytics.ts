const ANONYMOUS_ID_KEY = "rationaltrade.analytics.anonymousId";

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
