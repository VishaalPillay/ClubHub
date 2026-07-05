import AuthShell from "@/features/auth/AuthShell";
import LoginCard from "@/features/auth/LoginCard";

export const metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <AuthShell active="login">
      <LoginCard />
    </AuthShell>
  );
}
