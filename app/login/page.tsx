"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type LoginType = "worker" | "employer";

export default function LoginPage() {
  const router = useRouter();

  const [loginType, setLoginType] =
    useState<LoginType>("worker");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);

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
        setMessage(
          loginError?.message || "Login failed.",
        );
        setLoading(false);
        return;
      }

      const userId = loginData.user.id;

      /*
       * Get the CareStaffing profile.
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
          "Profile lookup error:",
          profileError,
        );
      }

      /*
       * Check whether this person owns an employer /
       * organisation account.
       */
      const { data: company, error: companyError } =
        await supabase
          .from("companies")
          .select("id, owner_id")
          .eq("owner_id", userId)
          .maybeSingle();

      if (companyError) {
        console.error(
          "Company lookup error:",
          companyError,
        );
      }

      const role =
        profile?.role?.toString().trim().toLowerCase() ||
        "";

      const accountType =
        profile?.account_type
          ?.toString()
          .trim()
          .toLowerCase() || "";

      const employerValues = [
        "employer",
        "organisation",
        "organization",
        "company",
      ];

      const workerValues = [
        "worker",
        "locum",
        "healthcare_worker",
        "healthcare worker",
      ];

      const isEmployer =
        employerValues.includes(role) ||
        employerValues.includes(accountType) ||
        Boolean(profile?.organisation_name) ||
        Boolean(profile?.company_id) ||
        Boolean(company?.id);

      const isWorker =
        workerValues.includes(role) ||
        workerValues.includes(accountType);

      /*
       * Employer login selected
       */
      if (loginType === "employer") {
        if (!isEmployer) {
          await supabase.auth.signOut();

          setMessage(
            "This account is not registered as an employer or organisation. Please select Healthcare Professional instead.",
          );

          setLoading(false);
          return;
        }

        router.replace("/employer");
        router.refresh();
        return;
      }

      /*
       * Worker login selected
       */
      if (loginType === "worker") {
        if (isEmployer && !isWorker) {
          await supabase.auth.signOut();

          setMessage(
            "This account is registered as an employer or organisation. Please select Employers & Organisations.",
          );

          setLoading(false);
          return;
        }

        router.replace("/dashboard");
        router.refresh();
        return;
      }
    } catch (error) {
      console.error(
        "Unexpected CareStaffing login error:",
        error,
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "An unexpected login error occurred.",
      );

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
            Choose your account type, then enter your
            CareStaffing login details.
          </p>
        </div>

        {/* ACCOUNT TYPE SELECTION */}
        <div style={styles.accountSelection}>
          <button
            type="button"
            onClick={() => {
              setLoginType("worker");
              setMessage("");
            }}
            style={{
              ...styles.accountButton,
              ...(loginType === "worker"
                ? styles.accountButtonSelected
                : {}),
            }}
          >
            <div style={styles.iconBox}>👩‍⚕️</div>

            <div style={styles.accountText}>
              <div style={styles.accountHeadingRow}>
                <strong style={styles.accountTitle}>
                  Healthcare Professionals
                </strong>

                {loginType === "worker" && (
                  <span style={styles.selectedBadge}>
                    ✓ Selected
                  </span>
                )}
              </div>

              <p style={styles.accountDescription}>
                Find shifts, manage your diary,
                timesheets, invoices and payments.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginType("employer");
              setMessage("");
            }}
            style={{
              ...styles.accountButton,
              ...(loginType === "employer"
                ? styles.accountButtonSelected
                : {}),
            }}
          >
            <div style={styles.iconBox}>🏢</div>

            <div style={styles.accountText}>
              <div style={styles.accountHeadingRow}>
                <strong style={styles.accountTitle}>
                  Employers & Organisations
                </strong>

                {loginType === "employer" && (
                  <span style={styles.selectedBadge}>
                    ✓ Selected
                  </span>
                )}
              </div>

              <p style={styles.accountDescription}>
                Post shifts, manage applicants, workers,
                timesheets and payments.
              </p>
            </div>
          </button>
        </div>

        {/* SELECTED LOGIN HEADING */}
        <div style={styles.selectedLoginBox}>
          <span style={styles.selectedLoginLabel}>
            Logging in as
          </span>

          <strong style={styles.selectedLoginValue}>
            {loginType === "worker"
              ? "Healthcare Professional"
              : "Employer / Organisation"}
          </strong>
        </div>

        <form onSubmit={login} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>
              Email address
            </span>

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              style={styles.input}
              autoComplete="email"
              required
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Password</span>

            <div style={styles.passwordWrap}>
              <input
                type={
                  showPassword ? "text" : "password"
                }
                placeholder="Enter your password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                style={styles.passwordInput}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
                  )
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
            <div style={styles.errorBox}>
              {message}
            </div>
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
              : loginType === "worker"
                ? "Login as Healthcare Professional"
                : "Login as Employer"}
          </button>
        </form>

        <div style={styles.registerArea}>
          <p style={styles.registerText}>
            New to CareStaffing?
          </p>

          <Link
            href="/register"
            style={styles.registerButton}
          >
            Create an Account
          </Link>

          <p style={styles.registerHelp}>
            Register as a healthcare professional or
            employer / organisation.
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
    maxWidth: "560px",
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
    marginTop: "24px",
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

  accountSelection: {
    display: "grid",
    gap: "12px",
    marginTop: "24px",
  },

  accountButton: {
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    padding: "17px",
    borderRadius: "17px",
    border: "2px solid #e2e8f0",
    background: "#f8fafc",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s ease",
    boxSizing: "border-box",
  },

  accountButtonSelected: {
    border: "2px solid #0f766e",
    background: "#ecfdf5",
    boxShadow:
      "0 6px 18px rgba(15,118,110,0.12)",
  },

  iconBox: {
    width: "44px",
    height: "44px",
    flexShrink: 0,
    borderRadius: "12px",
    display: "grid",
    placeItems: "center",
    background: "#ffffff",
    fontSize: "24px",
  },

  accountText: {
    flex: 1,
    minWidth: 0,
  },

  accountHeadingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },

  accountTitle: {
    color: "#0f172a",
    fontSize: "15px",
  },

  selectedBadge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: "999px",
    background: "#0f766e",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: 800,
  },

  accountDescription: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: "13px",
    lineHeight: 1.45,
  },

  selectedLoginBox: {
    marginTop: "18px",
    padding: "11px 14px",
    borderRadius: "12px",
    background: "#f0fdfa",
    border: "1px solid #99f6e4",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },

  selectedLoginLabel: {
    color: "#64748b",
    fontSize: "13px",
  },

  selectedLoginValue: {
    color: "#0f766e",
    fontSize: "14px",
  },

  form: {
    display: "grid",
    gap: "16px",
    marginTop: "20px",
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
    lineHeight: 1.45,
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
