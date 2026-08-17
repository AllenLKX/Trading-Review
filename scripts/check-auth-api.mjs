import pg from "pg";

const { Pool } = pg;
const baseUrl = process.argv[2] ?? "http://localhost:3000";
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `auth-contract-${runId}@rationaltrade.invalid`;
const password = `Contract-${runId}!`;
const anonymousId = `auth-contract-anon-${runId}`;
const adtag = `auth-share-${runId}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
let userId;

try {
  const taggedEntry = await fetch(`${baseUrl}/?adtag=${encodeURIComponent(adtag)}`, { redirect: "manual" });
  const taggedLocation = new URL(taggedEntry.headers.get("location"), baseUrl);
  assert(taggedEntry.status >= 300 && taggedEntry.status < 400, "Tagged unauthenticated entry did not redirect to login.");
  assert(taggedLocation.pathname === "/login" && taggedLocation.searchParams.get("adtag") === adtag, "Adtag was lost during login redirect.");

  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, anonymousId, adtag })
  });
  const registrationBody = await registration.json();
  assert(registration.status === 201, registrationBody.error ?? "Registration failed.");
  userId = registrationBody.user?.id;
  const firstCookie = readCookie(registration);

  const session = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: firstCookie } });
  const sessionBody = await session.json();
  assert(session.ok && sessionBody.user?.email === email, "Registered session was not returned.");

  const plans = await fetch(`${baseUrl}/api/plans`, { headers: { cookie: firstCookie } });
  const plansBody = await plans.json();
  assert(plans.ok && plansBody.plans?.length === 0, "New account did not receive isolated empty data.");

  const onboarding = await fetch(`${baseUrl}/api/onboarding`, { headers: { cookie: firstCookie } });
  const onboardingBody = await onboarding.json();
  assert(onboarding.ok && onboardingBody.step === 0, "New account did not start at the first onboarding slide.");

  const advancedOnboarding = await updateOnboarding(baseUrl, firstCookie, 2);
  assert(advancedOnboarding.step === 2, "Onboarding progress was not saved.");
  const regressedOnboarding = await updateOnboarding(baseUrl, firstCookie, 1);
  assert(regressedOnboarding.step === 2, "Onboarding progress moved backwards.");
  const completedOnboarding = await updateOnboarding(baseUrl, firstCookie, 4);
  assert(completedOnboarding.step === 4, "Onboarding completion was not saved.");

  const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers: { cookie: firstCookie } });
  assert(logout.ok, "Logout failed.");
  const revoked = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: firstCookie } });
  assert(revoked.status === 401, "Revoked database session remained active.");

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, anonymousId, adtag })
  });
  const loginBody = await login.json();
  assert(login.ok, loginBody.error ?? "Login failed.");
  const secondCookie = readCookie(login);
  const reloggedSession = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie: secondCookie } });
  assert(reloggedSession.ok, "New login session was not active.");
  const persistedOnboarding = await fetch(`${baseUrl}/api/onboarding`, { headers: { cookie: secondCookie } });
  const persistedOnboardingBody = await persistedOnboarding.json();
  assert(persistedOnboarding.ok && persistedOnboardingBody.step === 4, "Onboarding progress did not follow the account after login.");

  const linkedEvents = await pool.query(
    `select event_name, metadata from app_events
     where user_id = $1 and anonymous_id = $2 and event_name in ('auth_registered', 'auth_login_succeeded')`,
    [userId, anonymousId]
  );
  assert(linkedEvents.rowCount === 2, "Authentication events were not linked to the anonymous visitor.");
  assert(linkedEvents.rows.every((event) => event.metadata?.adtag === adtag), "Authentication events lost their adtag attribution.");

  console.log("Registration, login, logout, onboarding persistence, revocation, and account isolation verification passed.");
} finally {
  if (userId) {
    await pool.query("delete from app_events where user_id = $1", [userId]);
    await pool.query("delete from profiles where id = $1", [userId]);
  }
  await pool.end();
}

function readCookie(response) {
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Session cookie was not returned.");
  return cookie;
}

async function updateOnboarding(baseUrl, cookie, step) {
  const response = await fetch(`${baseUrl}/api/onboarding`, {
    method: "PATCH",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ step })
  });
  const body = await response.json();
  assert(response.ok, body.error ?? `Unable to advance onboarding to ${step}.`);
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
