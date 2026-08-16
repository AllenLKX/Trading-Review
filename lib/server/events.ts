import { getDatabasePool, isDatabaseConfigured } from "@/lib/server/db";

export type AppEventInput = {
  eventName: string;
  userId?: string;
  anonymousId?: string;
  sessionId?: string;
  path?: string;
  metadata?: Record<string, unknown>;
};

export async function recordAppEvent(event: AppEventInput) {
  if (!isDatabaseConfigured()) return;

  try {
    await getDatabasePool().query(
      `insert into app_events (user_id, anonymous_id, session_id, event_name, path, metadata)
       values ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        event.userId ?? null,
        cleanIdentifier(event.anonymousId),
        cleanIdentifier(event.sessionId),
        event.eventName.slice(0, 80),
        event.path?.slice(0, 300) ?? null,
        JSON.stringify(event.metadata ?? {})
      ]
    );
  } catch (error) {
    console.error("Failed to record app event", error);
  }
}

function cleanIdentifier(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.slice(0, 120) : null;
}
