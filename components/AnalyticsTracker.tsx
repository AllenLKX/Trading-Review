"use client";

import { useEffect } from "react";

const ANONYMOUS_ID_KEY = "rationaltrade.analytics.anonymousId";

export function AnalyticsTracker() {
  useEffect(() => {
    let anonymousId = window.localStorage.getItem(ANONYMOUS_ID_KEY);
    if (!anonymousId) {
      anonymousId = crypto.randomUUID();
      window.localStorage.setItem(ANONYMOUS_ID_KEY, anonymousId);
    }

    const referrerHost = readReferrerHost(document.referrer);
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName: "page_view", anonymousId, path: window.location.pathname, referrerHost }),
      keepalive: true
    }).catch(() => undefined);
  }, []);

  return null;
}

function readReferrerHost(referrer: string) {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).host;
  } catch {
    return undefined;
  }
}
