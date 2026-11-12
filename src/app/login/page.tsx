"use client";
import { useState } from "react";
import { Icon } from "@/components/Icon";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ password }) });
    if (res.ok) window.location.href = "/";
    else {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm text-center">
        <span className="inline-flex text-accent"><Icon name="spark" size={30} /></span>
        <h1 className="mt-3 font-serif text-[30px] tracking-tight">Command Center</h1>
        <p className="mt-1 text-[14px] text-muted">Enter your password to continue.</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          className="input mt-6 !py-2.5 text-center"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="mt-2 text-[13px] text-bad">That password didn&apos;t match.</p>}
        <button disabled={busy || !password} className="btn btn-primary mt-4 w-full justify-center !py-2.5 disabled:opacity-50">
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
