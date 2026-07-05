"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import GoogleButton from "@/features/auth/GoogleButton";

const inputClass =
  "border-2 border-black bg-white text-black p-3 font-ui text-[15px] w-full rounded-none " +
  "focus:outline-none focus:border-[#057DBC]";
const labelClass = "font-mono text-[11px] uppercase tracking-widest text-[#757575]";

/** Sign-in card: Google or email/password → /portal. First-time Google users get the profile step. */
export default function LoginCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/portal");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl border-2 border-black p-8 md:p-10 bg-white">
      <div className="mb-8 pb-6 border-b-2 border-black">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-3">
          Welcome Back
        </p>
        <h1 className="font-display text-[42px] md:text-[48px] leading-[0.93] tracking-[-0.5px] font-bold uppercase">
          Sign In.
        </h1>
      </div>

      {error && (
        <div className="border-2 border-red-600 bg-red-50 px-4 py-3 mb-6">
          <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest">{error}</p>
        </div>
      )}

      <GoogleButton
        text="signin_with"
        onSuccess={({ isNew }) =>
          router.push(isNew ? "/register?step=profile" : "/portal")
        }
        onError={setError}
      />

      <form onSubmit={handleLogin} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className={labelClass}>Email Address</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@university.edu"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="login-password" className={labelClass}>Password</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
        <div className="pt-4 border-t border-[#e2e8f0] mt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white border-2 border-black font-ui text-[15px] font-bold p-4 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40 flex justify-center items-center gap-2"
          >
            {loading ? "Please wait..." : "Sign In"}
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </form>

      <p className="font-mono text-[11px] text-[#757575] uppercase tracking-wider text-center mt-6">
        New to Club-Hub?{" "}
        <Link href="/register" className="text-[#057DBC] underline">Register</Link>
      </p>
    </div>
  );
}
