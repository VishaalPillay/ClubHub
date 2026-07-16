import AuthShell from "@/features/auth/AuthShell";
import RegisterWizard from "@/features/auth/RegisterWizard";

export const metadata = { title: "Register" };

// The wizard restores half-finished registrations itself (silent refresh →
// resume with prefills), so this page needs no step routing.
export default function RegisterPage() {
  return (
    <AuthShell active="register">
      <RegisterWizard />
    </AuthShell>
  );
}
