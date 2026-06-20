"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();

  const [accountType, setAccountType] = useState<"worker" | "organisation">("worker");

  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [profession, setProfession] = useState("Pharmacist");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [country, setCountry] = useState("South Africa");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!email || !mobile || !password || !confirmPassword) {
      setMessage("Please complete all required fields.");
      return;
    }

    if (accountType === "worker" && (!firstName || !surname || !profession)) {
      setMessage("Please complete worker details.");
      return;
    }

    if (accountType === "organisation" && !organisationName) {
      setMessage("Please enter the organisation name.");
      return;
    }

    if (password.trim() !== confirmPassword.trim()) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: {
          first_name: firstName.trim(),
          surname: surname.trim(),
          organisation_name: organisationName.trim(),
          mobile: mobile.trim(),
          profession,
          registration_number: registrationNumber.trim(),
          country,
          city: city.trim(),
          role: accountType,
          platform: "CareStaffing",
        },
      },
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    if (data.user?.id) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        first_name: firstName.trim(),
        surname: surname.trim(),
        organisation_name: organisationName.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        profession,
        registration_number: registrationNumber.trim(),
        country,
        city: city.trim(),
        role: accountType,
        platform: "CareStaffing",
        created_at: new Date().toISOString(),
      });

      if (profileError) {
        setLoading(false);
        setMessage(profileError.message);
        return;
      }
    }

    setLoading(false);
    router.push("/login");
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/" style={styles.backLink}>← Back to CareStaffing</Link>

        <p style={styles.label}>CareStaffing</p>

        <h1 style={styles.title}>Create your account</h1>

        <p style={styles.subtitle}>
          Register as a healthcare worker or healthcare organisation.
        </p>

        <form onSubmit={register} style={styles.form}>
          <div style={styles.toggle}>
            <button
              type="button"
              onClick={() => setAccountType("worker")}
              style={accountType === "worker" ? styles.toggleActive : styles.toggleButton}
            >
              Healthcare Worker
            </button>

            <button
              type="button"
              onClick={() => setAccountType("organisation")}
              style={accountType === "organisation" ? styles.toggleActive : styles.toggleButton}
            >
              Organisation
            </button>
          </div>

          {accountType === "worker" ? (
            <>
              <div style={styles.grid}>
                <input style={styles.input} placeholder="First name *" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input style={styles.input} placeholder="Surname *" value={surname} onChange={(e) => setSurname(e.target.value)} />
              </div>

              <select style={styles.input} value={profession} onChange={(e) => setProfession(e.target.value)}>
                <option>Pharmacist</option>
                <option>Pharmacy Technician</option>
                <option>Dispenser</option>
                <option>Nurse</option>
                <option>Doctor</option>
                <option>Independent Prescriber</option>
                <option>Healthcare Assistant</option>
                <option>Optometrist</option>
                <option>Driver</option>
              </select>

              <input style={styles.input} placeholder="Professional registration number" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            </>
          ) : (
            <input style={styles.input} placeholder="Organisation / pharmacy / clinic name *" value={organisationName} onChange={(e) => setOrganisationName(e.target.value)} />
          )}

          <input style={styles.input} type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} />

          <input style={styles.input} placeholder="Mobile number *" value={mobile} onChange={(e) => setMobile(e.target.value)} />

          <div style={styles.grid}>
            <select style={styles.input} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option>South Africa</option>
              <option>England</option>
              <option>Wales</option>
              <option>Scotland</option>
              <option>New Zealand</option>
            </select>

            <input style={styles.input} placeholder="City / area" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>

          <div style={styles.grid}>
            <div style={styles.passwordWrap}>
              <input
                style={styles.passwordInput}
                type={showPassword ? "text" : "password"}
                placeholder="Password *"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            <div style={styles.passwordWrap}>
              <input
                style={styles.passwordInput}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password *"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {message && <div style={styles.error}>{message}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Creating account..." : "Create CareStaffing Account"}
          </button>
        </form>

        <p style={styles.footer}>
          Already registered? <Link href="/login" style={styles.link}>Login here</Link>
        </p>
      </div>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: "100vh",
    background: "#ecfeff",
    padding: "24px",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "760px",
    background: "#ffffff",
    borderRadius: "24px",
    padding: "28px",
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.14)",
  },
  backLink: {
    color: "#0f766e",
    fontWeight: 700,
    textDecoration: "none",
  },
  label: {
    marginTop: "28px",
    color: "#0f766e",
    fontWeight: 800,
    fontSize: "14px",
    textTransform: "uppercase",
  },
  title: {
    marginTop: "8px",
    fontSize: "36px",
    lineHeight: "42px",
    color: "#0f172a",
  },
  subtitle: {
    color: "#475569",
    fontSize: "17px",
    marginBottom: "24px",
  },
  form: {
    display: "grid",
    gap: "14px",
  },
  toggle: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "8px",
  },
  toggleButton: {
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #99f6e4",
    background: "#f0fdfa",
    color: "#115e59",
    fontWeight: 700,
    cursor: "pointer",
  },
  toggleActive: {
    padding: "14px",
    borderRadius: "14px",
    border: "1px solid #0f766e",
    background: "#0f766e",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    boxSizing: "border-box",
  },
  passwordWrap: {
    position: "relative",
    width: "100%",
  },
  passwordInput: {
    width: "100%",
    padding: "14px 52px 14px 16px",
    borderRadius: "12px",
    border: "1px solid #cbd5e1",
    fontSize: "16px",
    boxSizing: "border-box",
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
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "12px 14px",
    borderRadius: "12px",
    fontWeight: 600,
  },
  button: {
    marginTop: "8px",
    width: "100%",
    padding: "16px",
    borderRadius: "14px",
    border: "none",
    background: "#0f766e",
    color: "#ffffff",
    fontSize: "17px",
    fontWeight: 800,
    cursor: "pointer",
  },
  footer: {
    marginTop: "22px",
    textAlign: "center",
    color: "#475569",
  },
  link: {
    color: "#0f766e",
    fontWeight: 700,
    textDecoration: "none",
  },
};
