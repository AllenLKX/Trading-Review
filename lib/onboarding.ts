export type OnboardingStep = 0 | 1 | 2 | 3 | 4;

export function normalizeOnboardingStep(value: number | undefined): OnboardingStep {
  return Number.isInteger(value) && value !== undefined && value >= 0 && value <= 4 ? (value as OnboardingStep) : 0;
}
