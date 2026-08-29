"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type WorkerRegistrationForm = {
  first_name: string;
  surname: string;
  email: string;
  mobile: string;
  id_number: string;
  country: string;
  dialing_code: string;
  profession: string;
  registration_number: string;
  practice_number: string;
  gender: string;
  date_of_birth: string;
  city: string;
  password: string;
  confirm_password: string;
};

const countryDetails: Record<
  string,
  {
    dialingCode: string;
  }
> = {
  "South Africa": {
    dialingCode: "+27",
  },
  "United Kingdom": {
    dialingCode: "+44",
  },
  "New Zealand": {
    dialingCode: "+64",
  },
  Ireland: {
    dialingCode: "+353",
  },
  "United States": {
    dialingCode: "+1",
  },
};

const professions = [
  "Pharmacist",
  "Pharmacist PIMART Permit",
  "Pharmacist PCDT Permit",
  "Pharmacist PCDT and PIMART Permit",
  "Pharmacy Technician",
  "Nurse",
  "Doctor",
  "Independent Prescriber",
  "Optometrist",
  "Physiotherapist",
  "Biokinetist",
];

const genders = [
  "Female",
  "Male",
  "Non-binary",
  "Prefer not to say",
];

const initialForm: WorkerRegistrationForm = {
  first_name: "",
  surname: "",
  email: "",
  mobile: "",
  id_number: "",
  country: "South Africa",
  dialing_code: "+27",
  profession: "Pharmacist",
  registration_number: "",
  practice_number: "",
  gender: "",
  date_of_birth: "",
  city: "",
  password: "",
  confirm_password: "",
};

function calculateAge(dateOfBirth: string): string {
  if (!dateOfBirth) {
    return "";
  }

  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();

  if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
    return "";
  }

  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
}

export default function WorkerRegisterPage() {
  const router = useRouter();

  const [form, setForm] =
    useState<WorkerRegistrationForm>(initialForm);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const age = useMemo(
    () => calculateAge(form.date_of_birth),
    [form.date_of_birth],
  );

  function updateField<K extends keyof WorkerRegistrationForm>(
    field: K,
    value: WorkerRegistrationForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleCountryChange(country: string) {
    setForm((current) => ({
      ...current,
      country,
      dialing_code:
        countryDetails[country]?.dialingCode || "",
    }));
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    const firstName = form.first_name.trim();
    const surname = form.surname.trim();
    const email = form.email.trim().toLowerCase();
    const mobile = form.mobile.trim();
    const idNumber = form.id_number.trim();
    const registrationNumber =
      form.registration_number.trim();
    const practiceNumber = form.practice_number.trim();
    const city = form.city.trim();

    if (!firstName || !surname) {
      setError("First name and surname are required.");
      return;
    }

    if (!email) {
      setError("Email address is required.");
      return;
    }

    if (!mobile) {
      setError("Mobile number is required.");
      return;
    }

    if (!idNumber) {
      setError("ID or passport number is required.");
      return;
    }

    if (!form.date_of_birth || !age) {
      setError("Please enter a valid date of birth.");
      return;
    }

    if (!form.gender) {
      setError("Please select your gender.");
      return;
    }

    if (!form.profession) {
      setError("Please select your profession.");
      return;
    }

    if (!registrationNumber) {
      setError(
        "Professional registration number is required.",
      );
      return;
    }

    if (form.password.length < 8) {
      setError(
        "Password must contain at least 8 characters.",
      );
      return;
    }

    if (form.password !== form.confirm_password) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/register-worker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password: form.password,
          first_name: firstName,
          surname,
          mobile,
          id_number: idNumber,
          country: form.country,
          dialing_code: form.dialing_code,
          profession: form.profession,
          registration_number: registrationNumber,
          practice_number: practiceNumber,
          gender: form.gender,
          date_of_birth: form.date_of_birth,
          city,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setLoading(false);

        const rawMessage =
          String(result?.error || "").toLowerCase();

        if (
          rawMessage.includes("already registered") ||
          rawMessage.includes("already exists") ||
          rawMessage.includes("duplicate")
        ) {
          setError(
            "An account already exists for this email address. Please use Login instead.",
          );
          return;
        }

        setError(
          result?.error ||
            "We could not create your CareStaffing account. Please try again.",
        );
        return;
      }

      /*
       * The server creates the Supabase Auth user as already confirmed.
       * This prevents Supabase from sending its confirmation email and
       * therefore avoids the Supabase opt-out/report-spam screen.
       *
       * We then sign the worker in normally from the browser.
       */
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password: form.password,
        });

      if (loginError) {
        setLoading(false);
        setMessage(
          "Your CareStaffing account was created successfully. Please log in with your email and password.",
        );

        setTimeout(() => {
          router.push("/login");
        }, 1800);

        return;
      }

      setLoading(false);
      router.push("/profile");
    } catch (registrationError) {
      console.error("Worker registration error:", registrationError);
      setLoading(false);
      setError(
        "We could not create your CareStaffing account. Please check your connection and try again.",
      );
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/register" style={styles.back}>
          ← Back
        </Link>

        <p style={styles.eyebrow}>CareStaffing</p>

        <h1 style={styles.title}>
          Healthcare Worker Registration
        </h1>

        <p style={styles.sub}>
          Create your locum account. These details will
          automatically populate your Professional Profile and can
          be updated later.
        </p>

        {error && <div style={styles.error}>{error}</div>}

        {message && (
          <div style={styles.success}>{message}</div>
        )}

        <form onSubmit={register} style={styles.form}>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              Personal Details
            </h2>

            <div style={styles.grid}>
              <Input
                label="First Name *"
                value={form.first_name}
                autoComplete="given-name"
                onChange={(value) =>
                  updateField("first_name", value)
                }
              />

              <Input
                label="Surname *"
                value={form.surname}
                autoComplete="family-name"
                onChange={(value) =>
                  updateField("surname", value)
                }
              />

              <Input
                label="Email *"
                type="email"
                value={form.email}
                autoComplete="email"
                onChange={(value) =>
                  updateField("email", value)
                }
              />

              <Select
                label="Gender *"
                value={form.gender}
                placeholder="Select gender"
                options={genders}
                onChange={(value) =>
                  updateField("gender", value)
                }
              />

              <Input
                label="ID / Passport Number *"
                value={form.id_number}
                autoComplete="off"
                onChange={(value) =>
                  updateField("id_number", value)
                }
              />

              <Input
                label="Date of Birth *"
                type="date"
                value={form.date_of_birth}
                max={new Date().toISOString().split("T")[0]}
                onChange={(value) =>
                  updateField("date_of_birth", value)
                }
              />

              <Input
                label="Age"
                value={age}
                disabled
                placeholder="Calculated automatically"
                onChange={() => undefined}
              />

              <Select
                label="Country *"
                value={form.country}
                options={Object.keys(countryDetails)}
                onChange={handleCountryChange}
              />

              <Input
                label="Dialling Code"
                value={form.dialing_code}
                disabled
                onChange={() => undefined}
              />

              <Input
                label="Mobile Number *"
                type="tel"
                value={form.mobile}
                autoComplete="tel"
                placeholder="Enter number without country code"
                onChange={(value) =>
                  updateField("mobile", value)
                }
              />

              <Input
                label="City"
                value={form.city}
                autoComplete="address-level2"
                onChange={(value) =>
                  updateField("city", value)
                }
              />
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              Professional Details
            </h2>

            <div style={styles.grid}>
              <Select
                label="Profession *"
                value={form.profession}
                options={professions}
                onChange={(value) =>
                  updateField("profession", value)
                }
              />

              <Input
                label="Registration Number *"
                value={form.registration_number}
                onChange={(value) =>
                  updateField(
                    "registration_number",
                    value,
                  )
                }
              />

              <Input
                label="Practice Number"
                value={form.practice_number}
                onChange={(value) =>
                  updateField("practice_number", value)
                }
              />
            </div>

            <p style={styles.helpText}>
              Your professional headshot, CV, address, compliance
              documents and banking details can be completed once
              inside your Professional Profile.
            </p>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              Account Security
            </h2>

            <div style={styles.grid}>
              <PasswordInput
                label="Password *"
                value={form.password}
                visible={showPassword}
                onToggle={() =>
                  setShowPassword((current) => !current)
                }
                onChange={(value) =>
                  updateField("password", value)
                }
              />

              <PasswordInput
                label="Confirm Password *"
                value={form.confirm_password}
                visible={showConfirmPassword}
                onToggle={() =>
                  setShowConfirmPassword(
                    (current) => !current,
                  )
                }
                onChange={(value) =>
                  updateField("confirm_password", value)
                }
              />
            </div>
          </section>

          <p style={styles.registrationNote}>
            By creating an account you will be registered as a CareStaffing
            healthcare worker. Please click the button once and wait while your
            account is created.
          </p>

          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
            disabled={loading}
          >
            {loading
              ? "Creating Worker Account..."
              : "Create Worker Account"}
          </button>
        </form>

        <p style={styles.loginText}>
          Already registered?{" "}
          <Link href="/login" style={styles.loginLink}>
            Login here
          </Link>
        </p>
      </div>
    </main>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  max?: string;
};

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  disabled = false,
  max,
}: InputProps) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>

      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        max={max}
        onChange={(event) =>
          onChange(event.target.value)
        }
        style={{
          ...styles.input,
          background: disabled ? "#f1f5f9" : "#ffffff",
          color: disabled ? "#64748b" : "#0f172a",
        }}
      />
    </label>
  );
}

type SelectProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
};

function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
}: SelectProps) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        style={styles.input}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

type PasswordInputProps = {
  label: string;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
};

function PasswordInput({
  label,
  value,
  visible,
  onToggle,
  onChange,
}: PasswordInputProps) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>

      <div style={styles.passwordWrap}>
        <input
          type={visible ? "text" : "password"}
          value={value}
          autoComplete="new-password"
          onChange={(event) =>
            onChange(event.target.value)
          }
          style={styles.passwordInput}
        />

        <button
          type="button"
          onClick={onToggle}
          style={styles.eyeButton}
          aria-label={
            visible ? "Hide password" : "Show password"
          }
        >
          {visible ? "🙈" : "👁️"}
        </button>
      </div>
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "28px 20px 60px",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "980px",
    margin: "0 auto",
    background: "#ffffff",
    padding: "30px",
    borderRadius: "26px",
    boxShadow: "0 20px 45px rgba(15,23,42,0.1)",
    boxSizing: "border-box",
  },
  back: {
    color: "#0f766e",
    fontWeight: 800,
    textDecoration: "none",
  },
  eyebrow: {
    margin: "26px 0 8px",
    color: "#0f766e",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "38px",
    lineHeight: 1.15,
  },
  sub: {
    color: "#64748b",
    fontSize: "17px",
    lineHeight: 1.6,
    marginBottom: "24px",
  },
  form: {
    display: "grid",
    gap: "20px",
  },
  section: {
    padding: "24px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
  },
  sectionTitle: {
    margin: "0 0 18px",
    color: "#0f172a",
    fontSize: "22px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  field: {
    display: "grid",
    gap: "7px",
  },
  label: {
    fontWeight: 800,
    color: "#334155",
    fontSize: "14px",
  },
  input: {
    width: "100%",
    minHeight: "50px",
    padding: "12px 14px",
    borderRadius: "13px",
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    fontSize: "15px",
    outline: "none",
  },
  passwordWrap: {
    position: "relative",
    width: "100%",
  },
  passwordInput: {
    width: "100%",
    minHeight: "50px",
    padding: "12px 52px 12px 14px",
    borderRadius: "13px",
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    fontSize: "15px",
  },
  eyeButton: {
    position: "absolute",
    top: "50%",
    right: "12px",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "18px",
  },
  helpText: {
    margin: "18px 0 0",
    padding: "13px 15px",
    background: "#ecfeff",
    color: "#155e75",
    borderRadius: "12px",
    lineHeight: 1.5,
  },
  registrationNote: {
    margin: 0,
    padding: "12px 14px",
    background: "#eff6ff",
    color: "#1e3a8a",
    borderRadius: "12px",
    lineHeight: 1.5,
    fontSize: "14px",
  },
  button: {
    width: "100%",
    padding: "16px",
    borderRadius: "14px",
    border: "none",
    background: "#0f766e",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 900,
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "13px 15px",
    borderRadius: "12px",
    marginBottom: "16px",
    fontWeight: 700,
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: "13px 15px",
    borderRadius: "12px",
    marginBottom: "16px",
    fontWeight: 700,
  },
  loginText: {
    marginTop: "22px",
    textAlign: "center",
    color: "#64748b",
  },
  loginLink: {
    color: "#0f766e",
    fontWeight: 800,
    textDecoration: "none",
  },
};
