import { NextResponse } from "next/server";

import type { OnboardingStep } from "@/lib/onboarding";
import { advanceOnboardingStep, readOnboardingStep } from "@/lib/server/auth-repository";
import { getConfiguredUserId } from "@/lib/server/single-user";

export const runtime = "nodejs";

export async function GET() {
  const user = await getConfiguredUserId();
  if (!user.ok) return onboardingStorageError(user.storage, user.message);

  return NextResponse.json({ ok: true, step: await readOnboardingStep(user.userId) });
}

export async function PATCH(request: Request) {
  const user = await getConfiguredUserId();
  if (!user.ok) return onboardingStorageError(user.storage, user.message);

  const body = await request.json().catch(() => null);
  const step = body && typeof body === "object" && "step" in body ? Number(body.step) : Number.NaN;
  if (!Number.isInteger(step) || step < 0 || step > 4) {
    return NextResponse.json({ ok: false, error: "Invalid onboarding step." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, step: await advanceOnboardingStep(user.userId, step as OnboardingStep) });
}

function onboardingStorageError(storage: "not-configured" | "missing-user", message: string) {
  return NextResponse.json(
    { ok: false, error: message },
    { status: storage === "missing-user" ? 401 : 503 }
  );
}
