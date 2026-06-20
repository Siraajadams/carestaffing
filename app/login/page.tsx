"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#ecfeff",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: "24px",
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "440px",
        background: "white",
        borderRadius: "24px",
        padding: "28px",
        boxShadow: "0 20px 40px rgba(15, 23, 42, 0.12)",
      }}>
        <Link href="/" style={{ color: "#0f766e", fontWeight: 700 }}>
          ← Back to CareStaffing
        </Link>

        <h1>Login</h1>
        <p style={{ color: "#64748b" }}>Access your CareStaffing account.</p>

        <form onSubmit={login} style={{ display: "grid", gap: "14px" }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={input}
          />

          {message && (
            <div style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "12px",
              borderRadius: "12px",
            }}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "15px",
              borderRadius: "14px",
              border: "none",
              background: "#0f766e",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "20px" }}>
          No account?{" "}
          <Link href="/register" style={{ color: "#0f766e", fontWeight: 700 }}>
            Register here
          </Link>
        </p>
      </div>
    </main>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  fontSize: "16px",
};
