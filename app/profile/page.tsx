"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const countries = [
  { name: "South Africa", code: "+27" },
  { name: "United Kingdom", code: "+44" },
  { name: "New Zealand", code: "+64" },
  { name: "Ireland", code: "+353" },
  { name: "United States", code: "+1" },
];

const professions = [
  "Doctor",
  "Pharmacist",
  "Nurse",
  "Physiotherapist",
  "Biokinetist",
];

type ProfileForm = {
  first_name: string;
  surname: string;
  email: string;
  mobile: string;
  dialing_code: string;
  gender: string;
  date_of_birth: string;
  profession: string;
  registration_number: string;
  practice_number: string;
  country: string;
  city: string;
  address: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch_code: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState("");

  const [profile, setProfile] = useState<ProfileForm>({
    first_name: "",
    surname: "",
    email: "",
    mobile: "",
    dialing_code: "+27",
    gender: "",
    date_of_birth: "",
    profession: "",
    registration_number: "",
    practice_number: "",
    country: "South Africa",
    city: "",
    address: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_branch_code: "",
  });

  useEffect(() => {
    loadProfile();
  }, []);

  function calculateAge(dob: string) {
    if (!dob) return "";
    const birthDate = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthCheck = today.getMonth() - birthDate.getMonth();

    if (
      monthCheck < 0 ||
      (monthCheck === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age >= 0 ? String(age) : "";
  }

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      const selectedCountry =
        countries.find((c) => c.name === data.country) || countries[0];

      setProfile({
        first_name: data.first_name || "",
        surname: data.surname || "",
        email: data.email || user.email || "",
        mobile: data.mobile || "",
        dialing_code: data.dialing_code || selectedCountry.code,
        gender: data.gender || "",
        date_of_birth: data.date_of_birth || "",
        profession: data.profession || "",
        registration_number: data.registration_number || "",
        practice_number: data.practice_number || "",
        country: data.country || "South Africa",
        city: data.city || "",
        address: data.address || "",
        bank_name: data.bank_name || "",
        bank_account_name: data.bank_account_name || "",
        bank_account_number: data.bank_account_number || "",
        bank_branch_code: data.bank_branch_code || "",
      });
    }

    setLoading(false);
  }

  function updateField(field: keyof ProfileForm, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  function updateCountry(value: string) {
    const selected = countries.find((c) => c.name === value);

    setProfile((prev) => ({
      ...prev,
      country: value,
      dialing_code: selected?.code || prev.dialing_code,
    }));
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      ...profile,
      updated_at: new Date().toISOString(),
    });

    setMessage(error ? "Profile update failed." : "Profile updated successfully.");
    setSaving(false);
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <p>Loading profile...</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard" style={styles.backLink}>
          ← Back to Dashboard
        </Link>

        <section style={styles.hero}>
          <h1 style={styles.heroTitle}>Professional Profile</h1>
          <p style={styles.heroText}>
            Manage your registration, contact, compliance and payment details.
          </p>
        </section>

        {message && <div style={styles.message}>{message}</div>}

        <form onSubmit={saveProfile} style={styles.form}>
          <Card title="Personal Details">
            <div style={styles.grid}>
              <Field label="First Name" value={profile.first_name} onChange={(v) => updateField("first_name", v)} />
              <Field label="Surname" value={profile.surname} onChange={(v) => updateField("surname", v)} />
              <Field label="Email" value={profile.email} onChange={(v) => updateField("email", v)} />

              <SelectField label="Gender" value={profile.gender} onChange={(v) => updateField("gender", v)} options={["Male", "Female", "Other"]} />

              <Field type="date" label="Date of Birth" value={profile.date_of_birth} onChange={(v) => updateField("date_of_birth", v)} />

              <Field label="Age" value={calculateAge(profile.date_of_birth)} onChange={() => {}} disabled />

              <SelectField label="Country" value={profile.country} onChange={updateCountry} options={countries.map((c) => c.name)} />

              <Field label="Dialing Code" value={profile.dialing_code} onChange={(v) => updateField("dialing_code", v)} />

              <Field label="Mobile" value={profile.mobile} onChange={(v) => updateField("mobile", v)} />

              <SelectField label="Profession" value={profile.profession} onChange={(v) => updateField("profession", v)} options={professions} />

              <Field label="City" value={profile.city} onChange={(v) => updateField("city", v)} />
              <Field label="Address" value={profile.address} onChange={(v) => updateField("address", v)} />
            </div>
          </Card>

          <Card title="Registration & Compliance">
            <div style={styles.grid}>
              <Field label="Registration Number" value={profile.registration_number} onChange={(v) => updateField("registration_number", v)} />
              <Field label="Practice Number" value={profile.practice_number} onChange={(v) => updateField("practice_number", v)} />
            </div>
          </Card>

          <Card title="Payment Details">
            <div style={styles.grid}>
              <Field label="Bank Name" value={profile.bank_name} onChange={(v) => updateField("bank_name", v)} />
              <Field label="Account Holder Name" value={profile.bank_account_name} onChange={(v) => updateField("bank_account_name", v)} />
              <Field label="Account Number" value={profile.bank_account_number} onChange={(v) => updateField("bank_account_number", v)} />
              <Field label="Branch Code" value={profile.bank_branch_code} onChange={(v) => updateField("bank_branch_code", v)} />
            </div>
          </Card>

          <div style={styles.actions}>
            <Link href="/dashboard" style={styles.cancelBtn}>
              Cancel
            </Link>

            <button type="submit" disabled={saving} style={styles.saveBtn}>
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        style={disabled ? styles.disabledInput : styles.input}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      >
        <option value="">Select {label}</option>
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  backLink: {
    display: "inline-block",
    marginBottom: "18px",
    color: "#334155",
    textDecoration: "none",
    fontWeight: 600,
  },
  hero: {
    background: "linear-gradient(135deg, #0f172a, #334155)",
    color: "white",
    borderRadius: "24px",
    padding: "32px",
    marginBottom: "24px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.25)",
  },
  heroTitle: {
    fontSize: "34px",
    margin: 0,
    fontWeight: 800,
  },
  heroText: {
    marginTop: "10px",
    color: "#cbd5e1",
    fontSize: "16px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  card: {
    background: "white",
    borderRadius: "22px",
    padding: "24px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 22px rgba(15,23,42,0.08)",
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "22px",
    color: "#0f172a",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#334155",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    padding: "13px 14px",
    fontSize: "15px",
    outline: "none",
    background: "white",
    color: "#0f172a",
  },
  disabledInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbd5e1",
    borderRadius: "14px",
    padding: "13px 14px",
    fontSize: "15px",
    background: "#f8fafc",
    color: "#64748b",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    marginBottom: "40px",
  },
  cancelBtn: {
    padding: "14px 22px",
    borderRadius: "14px",
    background: "white",
    color: "#334155",
    textDecoration: "none",
    fontWeight: 700,
    border: "1px solid #cbd5e1",
  },
  saveBtn: {
    padding: "14px 26px",
    borderRadius: "14px",
    border: "none",
    background: "#0f172a",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  message: {
    background: "white",
    padding: "14px 18px",
    borderRadius: "16px",
    marginBottom: "18px",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    fontWeight: 600,
  },
};
