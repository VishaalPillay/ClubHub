import CreateClubWizard from "@/features/onboarding/CreateClubWizard";

/**
 * Club creation. This replaced the `step-1` … `step-5` routes — see
 * `CreateClubWizard` for why the five pages became one.
 */
export default function OnboardingPage() {
  return <CreateClubWizard />;
}
