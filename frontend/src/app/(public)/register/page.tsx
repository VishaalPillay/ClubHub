import AuthShell from "@/features/auth/AuthShell";
import RegisterWizard from "@/features/auth/RegisterWizard";

export const metadata = { title: "Register" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  // ?step=profile lets an already-authenticated first-time Google user (arriving via
  // the login page) start straight at the profile step.
  const { step } = await searchParams;
  return (
    <AuthShell active="register">
      <RegisterWizard initialStep={step === "profile" ? 2 : 1} />
    </AuthShell>
  );
}
