"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type ProfileForm = {
  first_name: string;
  surname: string;
  email: string;
  mobile: string;
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

  function updateField(field: keyof ProfileForm, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
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
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600">Loading profile...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-black mb-5"
        >
          ← Back to Dashboard
        </Link>

        <div className="bg-gradient-to-r from-slate-900 to-slate-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold">
            Professional Profile
          </h1>
          <p className="mt-2 text-slate-200 max-w-2xl">
            Manage your registration, contact, compliance and payment details.
          </p>
        </div>

        {message && (
          <div className="mb-5 rounded-2xl bg-white border border-slate-200 p-4 text-sm font-medium text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <form onSubmit={saveProfile} className="space-y-6">
          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              Personal Details
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              These details pull through from registration and can be updated.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="First Name" value={profile.first_name} onChange={(v) => updateField("first_name", v)} />
              <Field label="Surname" value={profile.surname} onChange={(v) => updateField("surname", v)} />
              <Field label="Email" value={profile.email} onChange={(v) => updateField("email", v)} />
              <Field label="Mobile" value={profile.mobile} onChange={(v) => updateField("mobile", v)} />

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Profession
                </label>
                <select
                  value={profile.profession}
                  onChange={(e) => updateField("profession", e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">Select profession</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Pharmacist">Pharmacist</option>
                  <option value="Nurse">Nurse</option>
                  <option value="Locum Worker">Locum Worker</option>
                </select>
              </div>

              <Field label="Country" value={profile.country} onChange={(v) => updateField("country", v)} />
              <Field label="City" value={profile.city} onChange={(v) => updateField("city", v)} />
              <Field label="Address" value={profile.address} onChange={(v) => updateField("address", v)} />
            </div>
          </section>

          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              Registration & Compliance
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              Add your GPhC, SAPC, HPCSA or relevant professional registration.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Registration Number" value={profile.registration_number} onChange={(v) => updateField("registration_number", v)} />
              <Field label="Practice Number" value={profile.practice_number} onChange={(v) => updateField("practice_number", v)} />
            </div>
          </section>

          <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              Payment Details
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              Used for earnings and payout processing.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Bank Name" value={profile.bank_name} onChange={(v) => updateField("bank_name", v)} />
              <Field label="Account Holder Name" value={profile.bank_account_name} onChange={(v) => updateField("bank_account_name", v)} />
              <Field label="Account Number" value={profile.bank_account_number} onChange={(v) => updateField("bank_account_number", v)} />
              <Field label="Branch Code" value={profile.bank_branch_code} onChange={(v) => updateField("bank_branch_code", v)} />
            </div>
          </section>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Link
              href="/dashboard"
              className="text-center rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-slate-900"
      />
    </div>
  );
}
