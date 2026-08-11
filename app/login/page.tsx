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

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError || !loginData.user) {
        setMessage(loginError?.message || "Login failed.");
        return;
      }

      const userId = loginData.user.id;

      /*
       * Look up the user's main CareStaffing profile.
       */
      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            `
            id,
            role,
            account_type,
            organisation_name,
            company_id
          `,
          )
          .eq("id", userId)
          .maybeSingle();

      if (profileError) {
        console.error(
          "CareStaffing profile lookup error:",
          profileError,
        );
      }

      /*
       * Employer accounts may also have a company record.
       * This provides a second way of identifying an employer,
       * even where an older profile does not yet have the correct
       * role/account_type value.
       */
      const { data: company, error: companyError } =
        await supabase
          .from("companies")
          .select("id, owner_id")
          .eq("owner_id", userId)
          .maybeSingle();

      if (companyError) {
        console.error(
          "CareStaffing company lookup error:",
          companyError,
        );
      }

      const role = profile?.role
        ?.toString()
        .trim()
        .toLowerCase();

      const accountType = profile?.account_type
        ?.toString()
        .trim()
        .toLowerCase();

      const employerRoles = [
        "employer",
        "organisation",
        "organization",
        "company",
      ];

      const workerRoles = [
        "worker",
        "locum",
        "healthcare_worker",
        "healthcare worker",
      ];

      const isEmployer =
        employerRoles.includes(role || "") ||
        employerRoles.includes(accountType || "") ||
        Boolean(profile?.company_id) ||
        Boolean(profile?.organisation_name) ||
        Boolean(company?.id);

      const isWorker =
        workerRoles.includes(role || "") ||
        workerRoles.includes(accountType || "");

      /*
       * EMPLOYER / ORGANISATION
       */
      if (isEmployer) {
        router.replace("/employer");
        router.refresh();
        return;
      }

      /*
       * HEALTHCARE WORKER / LOCUM
       */
      if (isWorker) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      /*
       * Older worker records may not contain role/account_type.
       * If there is no company associated with the user, default
       * the account to the healthcare-worker dashboard.
       */
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Unexpected CareStaffing login error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "An unexpected login error occurred.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/" style={styles.backLink}>
          ← Back to CareStaffing
        </Link>

        <div style={styles.brandBlock}>
          <p style={styles.brand}>CareStaffing</p>

          <h1 style={styles.title}>Login</h1>

          <p style={styles.subtitle}>
            Access your healthcare professional or employer account.
          </p>
        </div>

        <div style={styles.accountInfo}>
          <div style={styles.accountItem}>
            <span style={styles.accountIcon}>👩‍⚕️</span>

            <div>
              <strong style={styles.accountTitle}>
                Healthcare Professionals
              </strong>

              <p style={styles.accountDescription}>
                Find shifts, manage your diary, timesheets,
                invoices and payments.
              </p>
            </div>
          </div>

          <div style={styles.divider} />

          <div style={styles.accountItem}>
            <span style={styles.accountIcon}>🏢</span>

            <div>
              <strong style={styles.accountTitle}>
                Employers & Organisations
              </strong>

              <p style={styles.accountDescription}>
                Post shifts, manage applicants, workers,
                timesheets and payments.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={login} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>Email address</span>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              autoComplete="email"
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Password</span>

            <div style={styles.passwordWrap}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.passwordInput}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                style={styles.eyeButton}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          {message && (
            <div style={styles.errorBox}>{message}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1,
              cursor: loading
                ? "not-allowed"
                : "pointer",
            }}
          >
            {loading
              ? "Checking your account..."
              : "Login to CareStaffing"}
          </button>
        </form>

        <div style={styles.registerArea}>
          <p style={styles.registerText}>
            New to CareStaffing?
          </p>

          <Link href="/register" style={styles.registerButton}>
            Create an Account
          </Link>

          <p style={styles.registerHelp}>
            Register as a healthcare professional or employer.
          </p>
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #ecfeff 0%, #f8fafc 55%, #f0fdfa 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "28px 20px",
    fontFamily: "Arial, sans-serif",
  },

  card: {
    width: "100%",
    maxWidth: "520px",
    background: "#ffffff",
    borderRadius: "28px",
    padding: "32px",
    boxShadow:
      "0 24px 60px rgba(15, 23, 42, 0.13)",
    boxSizing: "border-box",
  },

  backLink: {
    color: "#0f766e",
    fontWeight: 800,
    textDecoration: "none",
  },

  brandBlock: {
    marginTop: "26px",
  },

  brand: {
    color: "#0f766e",
    fontSize: "14px",
    fontWeight: 900,
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    margin: "0 0 8px",
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "38px",
    lineHeight: 1.15,
  },

  subtitle: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: "16px",
    lineHeight: 1.55,
  },

  accountInfo: {
    marginTop: "24px",
    padding: "18px",
    borderRadius: "18px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  accountItem: {
    display: "flex",
    gap: "13px",
    alignItems: "flex-start",
  },

  accountIcon: {
    fontSize: "27px",
  },

  accountTitle: {
    color: "#0f172a",
    fontSize: "15px",
  },

  accountDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.45,
  },

  divider: {
    height: "1px",
    background: "#e2e8f0",
    margin: "15px 0",
  },

  form: {
    display: "grid",
    gap: "16px",
    marginTop: "24px",
  },

  field: {
    display: "grid",
    gap: "7px",
  },

  label: {
    color: "#334155",
    fontSize: "14px",
    fontWeight: 800,
  },

  input: {
    width: "100%",
    minHeight: "52px",
    padding: "13px 15px",
    borderRadius: "13px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    boxSizing: "border-box",
    outline: "none",
  },

  passwordWrap: {
    position: "relative",
    width: "100%",
  },

  passwordInput: {
    width: "100%",
    minHeight: "52px",
    padding: "13px 54px 13px 15px",
    borderRadius: "13px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    boxSizing: "border-box",
    outline: "none",
  },

  eyeButton: {
    position: "absolute",
    right: "14px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "18px",
    zIndex: 10,
  },

  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "13px 14px",
    borderRadius: "12px",
    fontWeight: 700,
  },

  submitButton: {
    minHeight: "54px",
    borderRadius: "14px",
    border: "none",
    background:
      "linear-gradient(135deg, #0f766e, #0891b2)",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 900,
  },

  registerArea: {
    marginTop: "26px",
    paddingTop: "22px",
    borderTop: "1px solid #e2e8f0",
    textAlign: "center",
  },

  registerText: {
    margin: "0 0 12px",
    color: "#475569",
    fontWeight: 700,
  },

  registerButton: {
    display: "block",
    width: "100%",
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #0f766e",
    color: "#0f766e",
    fontWeight: 900,
    textDecoration: "none",
    boxSizing: "border-box",
  },

  registerHelp: {
    margin: "10px 0 0",
    color: "#94a3b8",
    fontSize: "13px",
  },
};
