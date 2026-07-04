import AuthCard from "@/features/auth/AuthCard";

export const metadata = { title: "Sign In" };

export default function LoginPage() {
  return <AuthCard initialMode="login" />;
}
