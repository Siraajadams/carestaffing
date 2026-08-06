"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const countrySettings: Record<
  string,
  {
    dialingCode: string;
    banks: string[];
  }
> = {
  "South Africa": {
    dialingCode: "+27",
    banks: [
      "ABSA",
      "African Bank",
      "Bank Zero",
      "Capitec Bank",
      "Discovery Bank",
      "First National Bank (FNB)",
      "Investec",
      "Nedbank",
      "Standard Bank",
      "TymeBank",
      "Other",
    ],
  },
  "United Kingdom": {
    dialingCode: "+44",
    banks: [
      "Barclays",
      "HSBC",
      "Lloyds Bank",
      "Monzo",
      "NatWest",
      "Revolut",
      "Santander UK",
      "Starling Bank",
      "TSB",
      "Other",
    ],
  },
  "New Zealand": {
    dialingCode: "+64",
    banks: [
      "ANZ New Zealand",
      "ASB Bank",
      "Bank of New Zealand",
      "Kiwibank",
      "Westpac New Zealand",
      "Other",
    ],
  },
  Ireland: {
    dialingCode: "+353",
    banks: [
      "AIB",
      "Bank of Ireland",
      "Permanent TSB",
      "Revolut",
      "Other",
    ],
  },
  "United States": {
    dialingCode: "+1",
    banks: [
      "Bank of America",
      "Capital One",
      "Chase",
      "Citibank",
      "PNC Bank",
      "U.S. Bank",
      "Wells Fargo",
      "Other",
    ],
  },
};

const countries = Object.keys(countrySettings);

const professions = [
  "Doctor",
  "Pharmacist",
  "Nurse",
  "Physiotherapist",
  "Biokinetist",
  "Pharmacy Technician",
  "Independent Prescriber",
  "Optometrist",
];

type ProfileForm = {
  first_name: string;
  surname: string;
  email: string;
  id_number: string;
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
  profile_photo_url: string;
};

const emptyProfile: ProfileForm = {
  first_name: "",
  surname: "",
  email: "",
  id_number: "",
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
  profile_photo_url: "",
};

function calculateAge(dateOfBirth: string) {
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

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [userId, setUserId] = useState("");
  const [isEditing, setIsEditing] = useState(true);
  const [profileExists, setProfileExists] = useState(false);

  const [profile, setProfile] =
    useState<ProfileForm>(emptyProfile);

  const age = useMemo(
    () => calculateAge(profile.date_of_birth),
    [profile.date_of_birth],
  );

  const banks =
    countrySettings[profile.country]?.banks || ["Other"];

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setErrorMessage("");

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
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    if (data) {
      const selectedCountry =
        data.country || "South Africa";

      setProfile({
        first_name: data.first_name || "",
        surname: data.surname || "",
        email: data.email || user.email || "",
        id_number: data.id_number || "",
        mobile: data.mobile || "",
        dialing_code:
          data.dialing_code ||
          countrySettings[selectedCountry]?.dialingCode ||
          "+27",
        gender: data.gender || "",
        date_of_birth: data.date_of_birth || "",
        profession: data.profession || "",
        registration_number:
          data.registration_number || "",
        practice_number: data.practice_number || "",
        country: selectedCountry,
        city: data.city || "",
        address: data.address || "",
        bank_name: data.bank_name || "",
        bank_account_name:
          data.bank_account_name || "",
        bank_account_number:
          data.bank_account_number || "",
        bank_branch_code:
          data.bank_branch_code || "",
        profile_photo_url:
          data.profile_photo_url || "",
      });

      setProfileExists(true);
      setIsEditing(false);
    } else {
      setProfile((current) => ({
        ...current,
        email: user.email || "",
      }));

      setProfileExists(false);
      setIsEditing(true);
    }

    setLoading(false);
  }

  function updateField(
    field: keyof ProfileForm,
    value: string,
  ) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateCountry(country: string) {
    const details = countrySettings[country];

    setProfile((current) => ({
      ...current,
      country,
      dialing_code:
        details?.dialingCode || current.dialing_code,
      bank_name: "",
    }));
  }

  async function uploadProfilePhoto(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file || !userId) {
      return;
    }

    setMessage("");
    setErrorMessage("");

    if (!file.type.startsWith("image/")) {
      setErrorMessage(
        "Please upload a JPG, PNG or WebP image.",
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(
        "The profile photo must be smaller than 5 MB.",
      );
      return;
    }

    setUploadingPhoto(true);

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `${userId}/profile-${Date.now()}.${extension}`;

    const { error: uploadError } =
      await supabase.storage
        .from("profile-photos")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

    if (uploadError) {
      setUploadingPhoto(false);
      setErrorMessage(uploadError.message);
      return;
    }

    const { data: publicUrlData } =
      supabase.storage
        .from("profile-photos")
        .getPublicUrl(filePath);

    updateField(
      "profile_photo_url",
      publicUrlData.publicUrl,
    );

    setUploadingPhoto(false);

    setMessage(
      "Profile photo uploaded. Click Save Profile to save the change.",
    );
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (!userId) {
      setErrorMessage(
        "Your login session could not be found.",
      );
      return;
    }

    if (!profile.first_name.trim()) {
      setErrorMessage("First name is required.");
      return;
    }

    if (!profile.surname.trim()) {
      setErrorMessage("Surname is required.");
      return;
    }

    if (!profile.id_number.trim()) {
      setErrorMessage(
        "ID or passport number is required.",
      );
      return;
    }

    if (!profile.date_of_birth) {
      setErrorMessage("Date of birth is required.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          first_name: profile.first_name.trim(),
          surname: profile.surname.trim(),
          email: profile.email.trim(),
          id_number: profile.id_number.trim(),
          mobile: profile.mobile.trim(),
          dialing_code: profile.dialing_code,
          gender: profile.gender,
          date_of_birth: profile.date_of_birth,
          profession: profile.profession,
          registration_number:
            profile.registration_number.trim(),
          practice_number:
            profile.practice_number.trim(),
          country: profile.country,
          city: profile.city.trim(),
          address: profile.address.trim(),
          bank_name: profile.bank_name,
          bank_account_name:
            profile.bank_account_name.trim(),
          bank_account_number:
            profile.bank_account_number.trim(),
          bank_branch_code:
            profile.bank_branch_code.trim(),
          profile_photo_url:
            profile.profile_photo_url,
          role: "worker",
          platform: "CareStaffing",
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        },
      );

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setProfileExists(true);
    setIsEditing(false);
    setMessage("Profile saved successfully.");
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <p>Loading professional profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link
          href="/dashboard"
          style={styles.backLink}
        >
          ← Back to Dashboard
        </Link>

        <section style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>CareStaffing</p>

            <h1 style={styles.heroTitle}>
              Professional Profile
            </h1>

            <p style={styles.heroText}>
              Manage your registration, contact,
              compliance and payment details.
            </p>
          </div>

          {profile.profile_photo_url ? (
            <img
              src={profile.profile_photo_url}
              alt="Professional profile"
              style={styles.heroPhoto}
            />
          ) : (
            <div style={styles.heroPlaceholder}>
              👤
            </div>
          )}
        </section>

        {errorMessage && (
          <div style={styles.errorMessage}>
            {errorMessage}
          </div>
        )}

        {message && (
          <div style={styles.successMessage}>
            {message}
          </div>
        )}

        <form
          onSubmit={saveProfile}
          style={styles.form}
        >
          <Card title="Profile Photo">
            <div style={styles.photoRow}>
              {profile.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt="Professional headshot"
                  style={styles.profilePhoto}
                />
              ) : (
                <div
                  style={
                    styles.profilePhotoPlaceholder
                  }
                >
                  👤
                </div>
              )}

              <div>
                <p style={styles.photoHeading}>
                  Professional headshot suggested
                </p>

                <p style={styles.helpText}>
                  Upload a clear, front-facing JPG,
                  PNG or WebP image under 5 MB.
                </p>

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={
                    !isEditing || uploadingPhoto
                  }
                  onChange={uploadProfilePhoto}
                />

                {uploadingPhoto && (
                  <p style={styles.uploadText}>
                    Uploading profile photo...
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card title="Personal Details">
            <div style={styles.grid}>
              <Field
                label="First Name"
                value={profile.first_name}
                disabled={!isEditing}
                onChange={(value) =>
                  updateField("first_name", value)
                }
              />

              <Field
                label="Surname"
                value={profile.surname}
                disabled={!isEditing}
                onChange={(value) =>
                  updateField("surname", value)
                }
              />

              <Field
                label="Email"
                type="email"
                value={profile.email}
                disabled
                onChange={() => {}}
              />

              <SelectField
                label="Gender"
                value={profile.gender}
                disabled={!isEditing}
                onChange={(value) =>
                  updateField("gender", value)
                }
                options={[
                  "Male",
                  "Female",
                  "Non-binary",
                  "Prefer not to say",
                ]}
              />

              <Field
                label="ID / Passport Number"
                value={profile.id_number}
                disabled={!isEditing}
                onChange={(value) =>
                  updateField("id_number", value)
                }
              />

              <Field
                type="date"
                label="Date of Birth"
                value={profile.date_of_birth}
                disabled={!isEditing}
                max={
                  new Date()
                    .toISOString()
                    .split("T")[0]
                }
                onChange={(value) =>
                  updateField(
                    "date_of_birth",
                    value,
                  )
                }
              />

              <Field
                label="Age"
                value={age}
                disabled
                onChange={() => {}}
                placeholder="Calculated automatically"
              />

              <SelectField
                label="Profession"
                value={profile.profession}
                disabled={!isEditing}
                onChange={(value) =>
                  updateField("profession", value)
                }
                options={professions}
              />

              <SelectField
                label="Country"
                value={profile.country}
                disabled={!isEditing}
                onChange={updateCountry}
                options={countries}
              />

              <Field
                label="Dialling Code"
                value={profile.dialing_code}
                disabled
                onChange={() => {}}
              />

              <Field
                label="Mobile"
                value={profile.mobile}
                disabled={!isEditing}
                onChange={(value) =>
                  updateField("mobile", value)
                }
              />

              <Field
                label="City"
                value={profile.city}
                disabled={!isEditing}
                onChange={(value) =>
                  updateField("city", value)
                }
              />
            </div>

            <div style={{ marginTop: "16px" }}>
              <Field
                label="Address"
                value={profile.address}
                disabled={!isEditing}
                onChange={(value) =>
                  updateField("address", value)
                }
              />
            </div>
          </Card>

          <Card title="Registration & Compliance">
            <div style={styles.gridTwo}>
              <Field
                label="Registration Number"
                value={
                  profile.registration_number
                }
                disabled={!isEditing}
                onChange={(value) =>
                  updateField(
                    "registration_number",
                    value,
                  )
                }
              />

              <Field
                label="Practice Number"
                value={profile.practice_number}
                disabled={!isEditing}
                onChange={(value) =>
                  updateField(
                    "practice_number",
                    value,
                  )
                }
              />
            </div>
          </Card>

          <Card title="Payment Details">
            <p style={styles.helpText}>
              The available banks change according
              to the country selected above.
            </p>

            <div style={styles.grid}>
              <SelectField
                label="Bank Name"
                value={profile.bank_name}
                disabled={!isEditing}
                onChange={(value) =>
                  updateField("bank_name", value)
                }
                options={banks}
              />

              <Field
                label="Account Holder Name"
                value={
                  profile.bank_account_name
                }
                disabled={!isEditing}
                onChange={(value) =>
                  updateField(
                    "bank_account_name",
                    value,
                  )
                }
              />

              <Field
                label="Account Number"
                value={
                  profile.bank_account_number
                }
                disabled={!isEditing}
                inputMode="numeric"
                onChange={(value) =>
                  updateField(
                    "bank_account_number",
                    value,
                  )
                }
              />

              <Field
                label="Branch Code"
                value={
                  profile.bank_branch_code
                }
                disabled={!isEditing}
                inputMode="numeric"
                onChange={(value) =>
                  updateField(
                    "bank_branch_code",
                    value,
                  )
                }
              />
            </div>
          </Card>

          <div style={styles.actions}>
            {isEditing ? (
              <>
                <Link
                  href="/dashboard"
                  style={styles.cancelBtn}
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={
                    saving || uploadingPhoto
                  }
                  style={styles.saveBtn}
                >
                  {saving
                    ? "Saving Profile..."
                    : "Save Profile"}
                </button>
              </>
            ) : (
              <>
                <div style={styles.savedBadge}>
                  ✓ Profile saved
                </div>

                <button
                  type="button"
                  style={styles.updateBtn}
                  onClick={() => {
                    setMessage("");
                    setErrorMessage("");
                    setIsEditing(true);
                  }}
                >
                  Update Profile
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
  placeholder,
  max,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  max?: string;
  inputMode?:
    | "text"
    | "numeric"
    | "decimal"
    | "email"
    | "tel";
}) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>
        {label}
      </label>

      <input
        type={type}
        value={value}
        disabled={disabled}
        max={max}
        inputMode={inputMode}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder || label}
        style={
          disabled
            ? styles.disabledInput
            : styles.input
        }
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>
        {label}
      </label>

      <select
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(event.target.value)
        }
        style={
          disabled
            ? styles.disabledInput
            : styles.input
        }
      >
        <option value="">
          Select {label}
        </option>

        {options.map((item) => (
          <option
            key={item}
            value={item}
          >
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: "1150px",
    margin: "0 auto",
  },
  backLink: {
    display: "inline-block",
    marginBottom: "18px",
    color: "#0f766e",
    textDecoration: "none",
    fontWeight: 700,
  },
  hero: {
    background:
      "linear-gradient(135deg, #0f172a, #164e63)",
    color: "white",
    borderRadius: "24px",
    padding: "32px",
    marginBottom: "24px",
    boxShadow:
      "0 12px 30px rgba(15,23,42,0.25)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#99f6e4",
    fontSize: "13px",
    fontWeight: 900,
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: "38px",
    margin: 0,
    fontWeight: 800,
  },
  heroText: {
    marginTop: "10px",
    color: "#cbd5e1",
    fontSize: "16px",
  },
  heroPhoto: {
    width: "105px",
    height: "105px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "4px solid white",
  },
  heroPlaceholder: {
    width: "105px",
    height: "105px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    display: "grid",
    placeItems: "center",
    fontSize: "48px",
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
    boxShadow:
      "0 8px 22px rgba(15,23,42,0.08)",
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "23px",
    color: "#0f172a",
  },
  photoRow: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    flexWrap: "wrap",
  },
  profilePhoto: {
    width: "130px",
    height: "130px",
    borderRadius: "20px",
    objectFit: "cover",
    border: "1px solid #cbd5e1",
  },
  profilePhotoPlaceholder: {
    width: "130px",
    height: "130px",
    borderRadius: "20px",
    background: "#e2e8f0",
    display: "grid",
    placeItems: "center",
    fontSize: "55px",
  },
  photoHeading: {
    margin: "0 0 7px",
    fontWeight: 800,
    color: "#0f172a",
  },
  helpText: {
    color: "#64748b",
    lineHeight: 1.5,
  },
  uploadText: {
    color: "#0f766e",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "16px",
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
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
    minHeight: "50px",
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
    minHeight: "50px",
    fontSize: "15px",
    background: "#f8fafc",
    color: "#64748b",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "12px",
    marginBottom: "40px",
    flexWrap: "wrap",
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
  updateBtn: {
    padding: "14px 26px",
    borderRadius: "14px",
    border: "none",
    background: "#0f766e",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  savedBadge: {
    padding: "13px 18px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 800,
  },
  successMessage: {
    background: "#dcfce7",
    color: "#166534",
    padding: "14px 18px",
    borderRadius: "16px",
    marginBottom: "18px",
    fontWeight: 700,
  },
  errorMessage: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "14px 18px",
    borderRadius: "16px",
    marginBottom: "18px",
    fontWeight: 700,
  },
};
