"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [userId, setUserId] = useState("");

  const [profile, setProfile] = useState({
    first_name: "",
    surname: "",
    email: "",
    mobile: "",
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

  async function loadProfile() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/login");
      return;
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      setMessage("Could not load profile.");
    } else if (data) {
      setProfile({
        first_name: data.first_name || "",
        surname: data.surname || "",
        email: data.email || user.email || "",
        mobile: data.mobile || "",
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

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      ...profile,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setMessage("Profile update failed.");
    } else {
      setMessage("Profile updated successfully.");
    }

    setSaving(false);
  }

  function updateField(field: string, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return <main className="p-8">Loading profile...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow p-6">
        <Link href="/dashboard" className="text-sm text-blue-600">
          ← Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold mt-4">Professional Profile</h1>
        <p className="text-slate-600 mb-6">
          Update your registration, contact, compliance and payment details.
        </p>

        {message && (
          <div className="mb-4 rounded-xl bg-blue-50 p-3 text-blue-700">
            {message}
          </div>
        )}

        <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input className="border rounded-xl p-3" placeholder="First Name" value={profile.first_name} onChange={(e) => updateField("first_name", e.target.value)} />
          <input className="border rounded-xl p-3" placeholder="Surname" value={profile.surname} onChange={(e) => updateField("surname", e.target.value)} />
          <input className="border rounded-xl p-3" placeholder="Email" value={profile.email} onChange={(e) => updateField("email", e.target.value)} />
          <input className="border rounded-xl p-3" placeholder="Mobile" value={profile.mobile} onChange={(e) => updateField("mobile", e.target.value)} />

          <select className="border rounded-xl p-3" value={profile.profession} onChange={(e) => updateField("profession", e.target.value)}>
            <option value="">Select Profession</option>
            <option>Doctor</option>
            <option>Pharmacist</option>
            <option>Nurse</option>
            <option>Healthcare Assistant</option>
            <option>Locum Worker</option>
          </select>

          <input className="border rounded-xl p-3" placeholder="Registration Number / GPhC / HPCSA / SAPC" value={profile.registration_number} onChange={(e) => updateField("registration_number", e.target.value)} />
          <input className="border rounded-xl p-3" placeholder="Practice Number" value={profile.practice_number} onChange={(e) => updateField("practice_number", e.target.value)} />
          <input className="border rounded-xl p-3" placeholder="Country" value={profile.country} onChange={(e) => updateField("country", e.target.value)} />
          <input className="border rounded-xl p-3" placeholder="City" value={profile.city} onChange={(e) => updateField("city", e.target.value)} />
          <input className="border rounded-xl p-3" placeholder="Address" value={profile.address} onChange={(e) => updateField("address", e.target.value)} />

          <h2 className="md:col-span-2 text-xl font-semibold mt-4">
            Payment Details
          </h2>

          <input className="border rounded-xl p-3" placeholder="Bank Name" value={profile.bank_name} onChange={(e) => updateField("bank_name", e.target.value)} />
          <input className="border rounded-xl p-3" placeholder="Account Holder Name" value={profile.bank_account_name} onChange={(e) => updateField("bank_account_name", e.target.value)} />
          <input className="border rounded-xl p-3" placeholder="Account Number" value={profile.bank_account_number} onChange={(e) => updateField("bank_account_number", e.target.value)} />
          <input className="border rounded-xl p-3" placeholder="Branch Code" value={profile.bank_branch_code} onChange={(e) => updateField("bank_branch_code", e.target.value)} />

          <button
            type="submit"
            disabled={saving}
            className="md:col-span-2 bg-black text-white rounded-xl p-4 font-semibold mt-4"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>
    </main>
  );
}
