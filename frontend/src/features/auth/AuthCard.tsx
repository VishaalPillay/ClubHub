"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, register } from "@/lib/api/auth";

type Mode = "register" | "login";

/**
 * Combined register/login card. On success the access token is stored in memory
 * (tokenStore) and the refresh cookie is set by the server — nothing in localStorage.
 */
export default function AuthCard({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password);
      router.push("/onboarding/step-1");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/portal");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#FFFFFF] text-[#000000] min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center w-full px-6 py-4 bg-white top-0 border-b-2 border-black">
        <Link
          href="/"
          className="text-black font-display text-[28px] uppercase tracking-tighter font-black no-underline"
        >
          CLUB-HUB
        </Link>
        <div className="flex gap-3">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`font-ui text-[14px] font-bold border-2 border-black px-4 py-2 uppercase transition-colors ${mode === "login" ? "bg-black text-white" : "bg-white text-black hover:bg-black hover:text-white"}`}
          >
            Login
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            className={`font-ui text-[14px] font-bold border-2 border-black px-4 py-2 uppercase transition-colors ${mode === "register" ? "bg-black text-white" : "bg-white text-black hover:bg-black hover:text-white"}`}
          >
            Register
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center w-full max-w-[1600px] mx-auto px-6 py-12">
        <div className="w-full max-w-xl border-2 border-black p-10 bg-white">
          <div className="mb-8 pb-6 border-b-2 border-black">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#757575] mb-3">
              {mode === "register" ? "Create Account" : "Welcome Back"}
            </p>
            <h1 className="font-display text-[48px] leading-[0.93] tracking-[-0.5px] font-bold uppercase">
              {mode === "register" ? "Join the Network." : "Sign In."}
            </h1>
          </div>

          {error && (
            <div className="border-2 border-red-600 bg-red-50 px-4 py-3 mb-6">
              <p className="font-mono text-[11px] text-red-600 uppercase tracking-widest">
                {error}
              </p>
            </div>
          )}

          <form
            onSubmit={mode === "register" ? handleRegister : handleLogin}
            className="flex flex-col gap-5"
          >
            {mode === "register" && (
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Aarav Sharma"
                  className="border-2 border-black bg-white text-black p-3 font-ui text-[15px] focus:outline-none focus:border-[#057DBC]"
                />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@university.edu"
                className="border-2 border-black bg-white text-black p-3 font-ui text-[15px] focus:outline-none focus:border-[#057DBC]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="font-mono text-[11px] uppercase tracking-widest text-[#757575]">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="border-2 border-black bg-white text-black p-3 font-ui text-[15px] focus:outline-none focus:border-[#057DBC]"
              />
            </div>

            <div className="pt-4 border-t border-[#e2e8f0] mt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white border-2 border-black font-ui text-[15px] font-bold p-4 uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-40 flex justify-center items-center gap-2"
              >
                {loading
                  ? "Please wait..."
                  : mode === "register"
                  ? "Create Account & Continue"
                  : "Sign In"}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </form>

          <p className="font-mono text-[11px] text-[#757575] uppercase tracking-wider text-center mt-6">
            {mode === "register" ? (
              <>Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-[#057DBC] underline">
                  Sign in
                </button>
              </>
            ) : (
              <>New to Club-Hub?{" "}
                <button onClick={() => setMode("register")} className="text-[#057DBC] underline">
                  Register
                </button>
              </>
            )}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white text-xs uppercase w-full flex flex-col md:flex-row justify-between items-center gap-4 px-8 py-10 mt-auto">
        <div className="text-white font-black tracking-widest">
          © 2026 CLUB-HUB EDITORIAL. ALL RIGHTS RESERVED.
        </div>
        <div className="flex flex-wrap justify-center gap-6 font-mono tracking-widest">
          <Link href="#" className="text-neutral-400 hover:text-white underline">Privacy</Link>
          <Link href="#" className="text-neutral-400 hover:text-white underline">Terms</Link>
          <Link href="#" className="text-neutral-400 hover:text-white underline">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
