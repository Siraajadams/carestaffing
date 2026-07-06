"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const countries = ["South Africa", "United Kingdom", "New Zealand", "Ireland"];
const orgTypes = ["Pharmacy", "Hospital", "Clinic", "Medical Practice", "NGO", "Recruitment Agency", "Other"];

export default function OrganisationRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    organisation_name: "",
    trading_name: "",
    organisation_type: "Pharmacy",
    email: "",
    mobile: "",
    country: "South Africa",
    city: "",
    address: "",
    registration_number: "",
    vat_number: "",
    practice_number: "",
    sapc_number: "",
    contact_person: "",
    contact_position: "",
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

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        owner_id: data.user.id,
        name: form.organisation_name,
        country: form.country,
        city: form.city,
      })
      .select()
      .single();

    if (companyError) {
      setError(companyError.message);
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      organisation_name: form.organisation_name,
      trading_name: form.trading_name,
      organisation_type: form.organisation_type,
      email: form.email,
      mobile: form.mobile,
      country: form.country,
      city: form.city,
      address: form.address,
      registration_number: form.registration_number,
      vat_number: form.vat_number,
      practice_number: form.practice_number,
      sapc_number: form.sapc_number,
      contact_person: form.contact_person,
      contact_position: form.contact_position,
      profession: null,
      role: "employer",
      account_type: "organisation",
      company_id: company.id,
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push("/employer-dashboard");
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link href="/register" style={styles.back}>← Back</Link>
        <h1>Organisation Registration</h1>
        <p style={styles.sub}>Create your employer account.</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={register} style={styles.grid}>
          <Input label="Organisation Name" value={form.organisation_name} onChange={(v) => setForm({ ...form, organisation_name: v })} />
          <Input label="Trading Name" value={form.trading_name} onChange={(v) => setForm({ ...form, trading_name: v })} />
          <Select label="Organisation Type" value={form.organisation_type} options={orgTypes} onChange={(v) => setForm({ ...form, organisation_type: v })} />
          <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Input label="Mobile" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} />
          <Select label="Country" value={form.country} options={countries} onChange={(v) => setForm({ ...form, country: v })} />
          <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <Input label="Physical Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Input label="Company Registration Number" value={form.registration_number} onChange={(v) => setForm({ ...form, registration_number: v })} />
          <Input label="VAT Number" value={form.vat_number} onChange={(v) => setForm({ ...form, vat_number: v })} />
          <Input label="Practice Number" value={form.practice_number} onChange={(v) => setForm({ ...form, practice_number: v })} />
          <Input label="SAPC Number" value={form.sapc_number} onChange={(v) => setForm({ ...form, sapc_number: v })} />
          <Input label="Contact Person" value={form.contact_person} onChange={(v) => setForm({ ...form, contact_person: v })} />
          <Input label="Contact Position" value={form.contact_position} onChange={(v) => setForm({ ...form, contact_position: v })} />

          <div style={styles.uploadBox}>Upload Company Registration Document *</div>
          <div style={styles.uploadBox}>Upload Company Logo</div>

          <Input type="password" label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
          <Input type="password" label="Confirm Password" value={form.confirmPassword} onChange={(v) => setForm({ ...form, confirmPassword: v })} />

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Creating..." : "Create Organisation Account"}
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
        {options.map((x: string) => <option key={x}>{x}</option>)}
      </select>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f1f5f9", padding: 24, fontFamily: "Arial" },
  card: { maxWidth: 1000, margin: "0 auto", background: "white", padding: 28, borderRadius: 24 },
  back: { color: "#0f766e", fontWeight: 800, textDecoration: "none" },
  sub: { color: "#64748b" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 },
  label: { display: "block", marginBottom: 6, fontWeight: 700 },
  input: { width: "100%", padding: 13, borderRadius: 14, border: "1px solid #cbd5e1", boxSizing: "border-box" },
  uploadBox: { border: "1px dashed #0f766e", borderRadius: 14, padding: 18, color: "#0f766e", fontWeight: 800 },
  button: { gridColumn: "1 / -1", padding: 15, borderRadius: 14, border: "none", background: "#0f766e", color: "white", fontWeight: 800 },
  error: { background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 12, marginBottom: 14 },
};
