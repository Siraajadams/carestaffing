"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const professions = ["Doctor", "Pharmacist", "Nurse", "Physiotherapist", "Biokinetist"];
const countries = ["South Africa", "United Kingdom", "New Zealand", "Ireland"];

export default function WorkerRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    surname: "",
    email: "",
    mobile: "",
    country: "South Africa",
    profession: "Pharmacist",
    registration_number: "",
    practice_number: "",
    gender: "",
    date_of_birth: "",
    password: "",
    confirmPassword: "",
  });

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { data, error: signupError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    });

    if (signupError || !data.user) {
      setError(signupError?.message || "Registration failed.");
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      first_name: form.first_name,
      surname: form.surname,
      email: form.email,
      mobile: form.mobile,
      country: form.country,
      profession: form.profession,
      registration_number: form.registration_number,
      practice_number: form.practice_number,
      gender: form.gender,
      date_of_birth: form.date_of_birth,
      role: "locum",
      account_type: "worker",
      organisation_name: null,
      company_id: null,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/register" style={styles.back}>← Back</Link>
        <h1>Healthcare Worker Registration</h1>
        <p style={styles.sub}>Create your locum profile.</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={register} style={styles.grid}>
          <Input label="First Name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
          <Input label="Surname" value={form.surname} onChange={(v) => setForm({ ...form, surname: v })} />
          <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Input label="Mobile" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} />

          <Select label="Country" value={form.country} options={countries} onChange={(v) => setForm({ ...form, country: v })} />
          <Select label="Profession" value={form.profession} options={professions} onChange={(v) => setForm({ ...form, profession: v })} />
          <Select label="Gender" value={form.gender} options={["Male", "Female", "Other"]} onChange={(v) => setForm({ ...form, gender: v })} />

          <Input type="date" label="Date of Birth" value={form.date_of_birth} onChange={(v) => setForm({ ...form, date_of_birth: v })} />
          <Input label="Registration Number" value={form.registration_number} onChange={(v) => setForm({ ...form, registration_number: v })} />
          <Input label="Practice Number" value={form.practice_number} onChange={(v) => setForm({ ...form, practice_number: v })} />
          <Input type="password" label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <Input type="password" label="Confirm Password" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} />

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Creating..." : "Create Worker Account"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Input({ label, value, onChange, type = "text" }: any) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={styles.input} />
    </div>
  );
}

function Select({ label, value, options, onChange }: any) {
  return (
    <div>
      <label style={styles.label}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.input}>
        <option value="">Select {label}</option>
        {options.map((x: string) => <option key={x}>{x}</option>)}
      </select>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f1f5f9", padding: 24, fontFamily: "Arial" },
  card: { maxWidth: 900, margin: "0 auto", background: "white", padding: 28, borderRadius: 24 },
  back: { color: "#0f766e", fontWeight: 800, textDecoration: "none" },
  sub: { color: "#64748b" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 },
  label: { display: "block", marginBottom: 6, fontWeight: 700 },
  input: { width: "100%", padding: 13, borderRadius: 14, border: "1px solid #cbd5e1", boxSizing: "border-box" },
  button: { gridColumn: "1 / -1", padding: 15, borderRadius: 14, border: "none", background: "#0f766e", color: "white", fontWeight: 800 },
  error: { background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 12, marginBottom: 14 },
};
