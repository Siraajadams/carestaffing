"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

    if (loginError || !loginData.user) {
      setLoading(false);
      setMessage(loginError?.message || "Login failed.");
      return;
    }

    const userId = loginData.user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, account_type")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup error:", profileError);
    }

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    setLoading(false);

    const role = profile?.role?.toLowerCase();
    const accountType = profile?.account_type?.toLowerCase();

    const isEmployer =
      role === "employer" ||
      role === "organisation" ||
      role === "organization" ||
      accountType === "employer" ||
      accountType === "organisation" ||
      accountType === "organization" ||
      !!company?.id;

    if (isEmployer) {
      router.push("/employer");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#ecfeff",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "white",
          borderRadius: "24px",
          padding: "28px",
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.12)",
        }}
      >
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
            required
          />

          <div style={passwordWrap}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={passwordInput}
              required
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={eyeButton}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {message && <div style={errorBox}>{message}</div>}

          <button type="submit" disabled={loading} style={submitButton}>
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
  boxSizing: "border-box",
};

const passwordWrap: React.CSSProperties = {
  position: "relative",
  width: "100%",
};

const passwordInput: React.CSSProperties = {
  width: "100%",
  padding: "14px 52px 14px 14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  fontSize: "16px",
  boxSizing: "border-box",
};

const eyeButton: React.CSSProperties = {
  position: "absolute",
  right: "14px",
  top: "50%",
  transform: "translateY(-50%)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: "18px",
  zIndex: 10,
};

const errorBox: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: "12px",
  borderRadius: "12px",
};

const submitButton: React.CSSProperties = {
  padding: "15px",
  borderRadius: "14px",
  border: "none",
  background: "#0f766e",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};
