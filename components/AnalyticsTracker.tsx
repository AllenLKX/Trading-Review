"use client";

import { useEffect } from "react";

import { captureAnalyticsAdtag, getAnalyticsAnonymousId } from "@/lib/client/analytics";

export function AnalyticsTracker() {
  useEffect(() => {
    const anonymousId = getAnalyticsAnonymousId();
    const adtag = captureAnalyticsAdtag(window.location.search);

    const referrerHost = readReferrerHost(document.referrer);
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName: "page_view", anonymousId, adtag, path: window.location.pathname, referrerHost }),
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
