"use client";

import Link from "next/link";
import {
  ChangeEvent,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type ProfileForm = {
  first_name: string;
  surname: string;
  email: string;
  gender: string;
  date_of_birth: string;
  id_number: string;
  country: string;
  dialing_code: string;
  mobile: string;
  profession: string;
  city: string;
  address: string;
  registration_number: string;
  practice_number: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  branch_code: string;
  profile_photo_url: string;
  cv_url: string;
  cv_file_name: string;
};

type CountryConfiguration = {
  dialingCode: string;
  banks: string[];
};

const initialProfile: ProfileForm = {
  first_name: "",
  surname: "",
  email: "",
  gender: "",
  date_of_birth: "",
  id_number: "",
  country: "South Africa",
  dialing_code: "+27",
  mobile: "",
  profession: "Pharmacist",
  city: "",
  address: "",
  registration_number: "",
  practice_number: "",
  bank_name: "",
  account_holder_name: "",
  account_number: "",
  branch_code: "",
  profile_photo_url: "",
  cv_url: "",
  cv_file_name: "",
};

const countryDetails: Record<string, CountryConfiguration> = {
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
};

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

function calculateAge(dateOfBirth: string): string {
  if (!dateOfBirth) return "";

  const birthDate = new Date(`${dateOfBirth}T00:00:00`);
  const today = new Date();

  if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
    return "";
  }

  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDifference =
    today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
}

function safeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export default function ProfilePage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");

  const [profile, setProfile] =
    useState<ProfileForm>(initialProfile);

  const [savedProfile, setSavedProfile] =
    useState<ProfileForm>(initialProfile);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] =
    useState(false);

  const [uploadingCv, setUploadingCv] =
    useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const age = useMemo(
    () => calculateAge(profile.date_of_birth),
    [profile.date_of_birth]
  );

  const availableBanks =
    countryDetails[profile.country]?.banks || ["Other"];

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        const newProfile: ProfileForm = {
          ...initialProfile,
          email: user.email || "",
        };

        setProfile(newProfile);
        setSavedProfile(newProfile);

        // New profile must be editable.
        setIsEditing(true);

        return;
      }

      const savedCountry =
        data.country || "South Africa";

      const loadedProfile: ProfileForm = {
        first_name: data.first_name || "",
        surname: data.surname || "",
        email: data.email || user.email || "",
        gender: data.gender || "",
        date_of_birth: data.date_of_birth || "",
        id_number: data.id_number || "",

        country: savedCountry,

        dialing_code:
          data.dialing_code ||
          countryDetails[savedCountry]?.dialingCode ||
          "+27",

        mobile: data.mobile || "",
        profession: data.profession || "Pharmacist",
        city: data.city || "",
        address: data.address || "",

        registration_number:
          data.registration_number || "",

        practice_number:
          data.practice_number || "",

        bank_name: data.bank_name || "",

        account_holder_name:
          data.account_holder_name || "",

        account_number:
          data.account_number || "",

        branch_code:
          data.branch_code || "",

        profile_photo_url:
          data.profile_photo_url || "",

        cv_url:
          data.cv_url || "",

        cv_file_name:
          data.cv_file_name || "",
      };

      setProfile(loadedProfile);
      setSavedProfile(loadedProfile);

      // Existing profile starts in view mode.
      setIsEditing(false);
    } catch (error: any) {
      console.error("Load profile error:", error);

      setErrorMessage(
        error?.message ||
          "Professional profile could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setMessage("");
    setErrorMessage("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setProfile(savedProfile);
    setMessage("");
    setErrorMessage("");
    setIsEditing(false);
  }

  function updateField<K extends keyof ProfileForm>(
    field: K,
    value: ProfileForm[K]
  ) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleCountryChange(country: string) {
    const config = countryDetails[country];

    setProfile((current) => ({
      ...current,
      country,
      dialing_code: config?.dialingCode || "",
      bank_name: "",
    }));
  }

  async function uploadProfilePhoto(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file || !userId) return;

    setMessage("");
    setErrorMessage("");

    if (!file.type.startsWith("image/")) {
      setErrorMessage(
        "Please select a JPG, PNG or WebP image."
      );

      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage(
        "The profile photo must be smaller than 5 MB."
      );

      event.target.value = "";
      return;
    }

    setUploadingPhoto(true);

    try {
      const extension =
        file.name.split(".").pop()?.toLowerCase() ||
        "jpg";

      const filePath =
        `${userId}/profile-${Date.now()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from("profile-photos")
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } =
        supabase.storage
          .from("profile-photos")
          .getPublicUrl(filePath);

      setProfile((current) => ({
        ...current,
        profile_photo_url:
          urlData.publicUrl,
      }));

      setMessage(
        "Profile photo uploaded. Save your profile to confirm the change."
      );
    } catch (error: any) {
      console.error(
        "Profile photo upload error:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Profile photo could not be uploaded."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function uploadCv(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file || !userId) return;

    setMessage("");
    setErrorMessage("");

    const extension =
      file.name.split(".").pop()?.toLowerCase();

    const allowed =
      extension === "pdf" ||
      extension === "doc" ||
      extension === "docx";

    if (!allowed) {
      setErrorMessage(
        "Please upload a PDF, DOC or DOCX CV."
      );

      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage(
        "The CV must be smaller than 10 MB."
      );

      event.target.value = "";
      return;
    }

    setUploadingCv(true);

    try {
      const cleanedName =
        safeFileName(file.name) ||
        `locum-cv.${extension || "pdf"}`;

      const filePath =
        `${userId}/cv-${Date.now()}-${cleanedName}`;

      const { error: uploadError } =
        await supabase.storage
          .from("locum-cvs")
          .upload(filePath, file, {
            upsert: true,
            contentType:
              file.type || undefined,
          });

      if (uploadError) {
        throw uploadError;
      }

      setProfile((current) => ({
        ...current,
        cv_url: filePath,
        cv_file_name: file.name,
      }));

      setMessage(
        "CV uploaded. Save your profile to confirm the change."
      );
    } catch (error: any) {
      console.error("CV upload error:", error);

      setErrorMessage(
        error?.message ||
          "Your CV could not be uploaded."
      );
    } finally {
      setUploadingCv(false);
    }
  }

  async function viewUploadedCv() {
    if (!profile.cv_url) return;

    setErrorMessage("");

    const { data, error } =
      await supabase.storage
        .from("locum-cvs")
        .createSignedUrl(
          profile.cv_url,
          60
        );

    if (error || !data?.signedUrl) {
      setErrorMessage(
        error?.message ||
          "The CV could not be opened."
      );

      return;
    }

    window.open(
      data.signedUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function saveProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setMessage("");
    setErrorMessage("");

    if (!userId) {
      setErrorMessage(
        "Your login session could not be found."
      );

      return;
    }

    if (!profile.first_name.trim()) {
      setErrorMessage(
        "First name is required."
      );

      return;
    }

    if (!profile.surname.trim()) {
      setErrorMessage(
        "Surname is required."
      );

      return;
    }

    if (!profile.id_number.trim()) {
      setErrorMessage(
        "ID or passport number is required."
      );

      return;
    }

    if (!profile.date_of_birth) {
      setErrorMessage(
        "Date of birth is required."
      );

      return;
    }

    if (!age) {
      setErrorMessage(
        "Please enter a valid date of birth."
      );

      return;
    }

    if (!profile.profession) {
      setErrorMessage(
        "Please select your profession."
      );

      return;
    }

    setSaving(true);

    try {
      const profilePayload = {
        id: userId,

        first_name:
          profile.first_name.trim(),

        surname:
          profile.surname.trim(),

        email:
          profile.email.trim(),

        gender:
          profile.gender || null,

        date_of_birth:
          profile.date_of_birth,

        id_number:
          profile.id_number.trim(),

        country:
          profile.country,

        dialing_code:
          profile.dialing_code,

        mobile:
          profile.mobile.trim(),

        profession:
          profile.profession,

        city:
          profile.city.trim(),

        address:
          profile.address.trim(),

        registration_number:
          profile.registration_number.trim(),

        practice_number:
          profile.practice_number.trim(),

        bank_name:
          profile.bank_name || null,

        account_holder_name:
          profile.account_holder_name.trim(),

        account_number:
          profile.account_number.trim(),

        branch_code:
          profile.branch_code.trim(),

        profile_photo_url:
          profile.profile_photo_url || null,

        cv_url:
          profile.cv_url || null,

        cv_file_name:
          profile.cv_file_name || null,

        role: "worker",
        account_type: "worker",
        platform: "CareStaffing",

        updated_at:
          new Date().toISOString(),
      };

      console.log(
        "Saving professional profile:",
        profilePayload
      );

      const { data, error } =
        await supabase
          .from("profiles")
          .upsert(profilePayload, {
            onConflict: "id",
          })
          .select()
          .single();

      if (error) {
        throw error;
      }

      console.log(
        "Professional profile saved:",
        data
      );

      const savedCountry =
        data.country || profile.country;

      const updatedProfile: ProfileForm = {
        first_name:
          data.first_name || "",

        surname:
          data.surname || "",

        email:
          data.email || profile.email,

        gender:
          data.gender || "",

        date_of_birth:
          data.date_of_birth || "",

        id_number:
          data.id_number || "",

        country:
          savedCountry,

        dialing_code:
          data.dialing_code ||
          countryDetails[savedCountry]
            ?.dialingCode ||
          "",

        mobile:
          data.mobile || "",

        profession:
          data.profession || "",

        city:
          data.city || "",

        address:
          data.address || "",

        registration_number:
          data.registration_number || "",

        practice_number:
          data.practice_number || "",

        bank_name:
          data.bank_name || "",

        account_holder_name:
          data.account_holder_name || "",

        account_number:
          data.account_number || "",

        branch_code:
          data.branch_code || "",

        profile_photo_url:
          data.profile_photo_url || "",

        cv_url:
          data.cv_url || "",

        cv_file_name:
          data.cv_file_name || "",
      };

      setProfile(updatedProfile);
      setSavedProfile(updatedProfile);

      setIsEditing(false);

      setMessage(
        "Profile updated successfully."
      );
    } catch (error: any) {
      console.error(
        "Professional profile save error:",
        error
      );

      setErrorMessage(
        error?.message ||
          "The profile could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          Loading professional profile...
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

        <section style={styles.header}>
          <div style={{ flex: 1 }}>
            <p style={styles.eyebrow}>
              CareStaffing
            </p>

            <h1 style={styles.title}>
              Professional Profile
            </h1>

            <p style={styles.subtitle}>
              Manage your registration,
              contact, compliance, CV and
              payment details.
            </p>

            {!isEditing && (
              <button
                type="button"
                onClick={startEditing}
                style={
                  styles.headerUpdateButton
                }
              >
                ✏️ Update Profile
              </button>
            )}
          </div>

          {profile.profile_photo_url ? (
            <img
              src={
                profile.profile_photo_url
              }
              alt="Professional profile"
              style={styles.headerPhoto}
            />
          ) : (
            <div
              style={
                styles.photoPlaceholder
              }
            >
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
          <div
            style={styles.successMessage}
          >
            {message}
          </div>
        )}

        {!isEditing && (
          <div style={styles.viewModeNotice}>
            <div>
              <strong>
                Profile saved
              </strong>

              <p
                style={{
                  margin: "5px 0 0",
                }}
              >
                Your details are currently
                locked to prevent accidental
                changes.
              </p>
            </div>

            <button
              type="button"
              onClick={startEditing}
              style={styles.updateButton}
            >
              Update Profile
            </button>
          </div>
        )}

        <form onSubmit={saveProfile}>
          <section style={styles.section}>
            <h2
              style={styles.sectionTitle}
            >
              Profile Photo
            </h2>

            <div style={styles.photoRow}>
              {profile.profile_photo_url ? (
                <img
                  src={
                    profile.profile_photo_url
                  }
                  alt="Professional headshot"
                  style={
                    styles.profilePhoto
                  }
                />
              ) : (
                <div
                  style={
                    styles.largePhotoPlaceholder
                  }
                >
                  👤
                </div>
              )}

              <div
                style={
                  styles.uploadDetails
                }
              >
                <p
                  style={styles.uploadTitle}
                >
                  Professional headshot
                  suggested
                </p>

                <p
                  style={styles.helpText}
                >
                  Upload a clear,
                  front-facing JPG, PNG or
                  WebP image under 5 MB.
                </p>

                {isEditing ? (
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={
                      uploadingPhoto
                    }
                    onChange={
                      uploadProfilePhoto
                    }
                  />
                ) : (
                  <p
                    style={
                      styles.lockedText
                    }
                  >
                    Click Update Profile to
                    change your photograph.
                  </p>
                )}

                {uploadingPhoto && (
                  <p
                    style={
                      styles.statusText
                    }
                  >
                    Uploading profile
                    photo...
                  </p>
                )}
              </div>
            </div>
          </section>

          <section style={styles.section}>
            <h2
              style={styles.sectionTitle}
            >
              Curriculum Vitae
            </h2>

            <p style={styles.helpText}>
              Upload your latest
              professional CV. PDF format is
              recommended.
            </p>

            <div
              style={styles.documentUpload}
            >
              <div
                style={styles.documentIcon}
              >
                📄
              </div>

              <div
                style={
                  styles.documentDetails
                }
              >
                <p
                  style={
                    styles.documentTitle
                  }
                >
                  {profile.cv_file_name ||
                    "No CV uploaded"}
                </p>

                {isEditing && (
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    disabled={uploadingCv}
                    onChange={uploadCv}
                  />
                )}

                <p style={styles.helpText}>
                  Maximum file size:
                  10 MB.
                </p>

                {uploadingCv && (
                  <p
                    style={
                      styles.statusText
                    }
                  >
                    Uploading CV...
                  </p>
                )}

                {profile.cv_url && (
                  <button
                    type="button"
                    style={
                      styles.viewDocumentButton
                    }
                    onClick={
                      viewUploadedCv
                    }
                  >
                    View Uploaded CV
                  </button>
                )}
              </div>
            </div>
          </section>

          <section style={styles.section}>
            <h2
              style={styles.sectionTitle}
            >
              Personal Details
            </h2>

            <div style={styles.gridFour}>
              <Field label="First Name">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={
                    profile.first_name
                  }
                  disabled={!isEditing}
                  onChange={(e) =>
                    updateField(
                      "first_name",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="Surname">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={profile.surname}
                  disabled={!isEditing}
                  onChange={(e) =>
                    updateField(
                      "surname",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="Email">
                <input
                  style={getInputStyle(
                    true
                  )}
                  type="email"
                  value={profile.email}
                  disabled
                />
              </Field>

              <Field label="Gender">
                <select
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={profile.gender}
                  disabled={!isEditing}
                  onChange={(e) =>
                    updateField(
                      "gender",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select gender
                  </option>

                  <option value="Female">
                    Female
                  </option>

                  <option value="Male">
                    Male
                  </option>

                  <option value="Other">
                    Other
                  </option>

                  <option value="Prefer not to say">
                    Prefer not to say
                  </option>
                </select>
              </Field>

              <Field label="ID / Passport Number">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={
                    profile.id_number
                  }
                  disabled={!isEditing}
                  placeholder="ID or passport number"
                  onChange={(e) =>
                    updateField(
                      "id_number",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="Date of Birth">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  type="date"
                  value={
                    profile.date_of_birth
                  }
                  disabled={!isEditing}
                  max={
                    new Date()
                      .toISOString()
                      .split("T")[0]
                  }
                  onChange={(e) =>
                    updateField(
                      "date_of_birth",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="Age">
                <input
                  style={getInputStyle(
                    true
                  )}
                  value={age}
                  disabled
                  placeholder="Calculated automatically"
                />
              </Field>

              <Field label="Profession">
                <select
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={
                    profile.profession
                  }
                  disabled={!isEditing}
                  onChange={(e) =>
                    updateField(
                      "profession",
                      e.target.value
                    )
                  }
                >
                  {professions.map(
                    (profession) => (
                      <option
                        key={profession}
                        value={profession}
                      >
                        {profession}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Country">
                <select
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={profile.country}
                  disabled={!isEditing}
                  onChange={(e) =>
                    handleCountryChange(
                      e.target.value
                    )
                  }
                >
                  {Object.keys(
                    countryDetails
                  ).map((country) => (
                    <option
                      key={country}
                      value={country}
                    >
                      {country}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Dialling Code">
                <input
                  style={getInputStyle(
                    true
                  )}
                  value={
                    profile.dialing_code
                  }
                  disabled
                />
              </Field>

              <Field label="Mobile">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={profile.mobile}
                  disabled={!isEditing}
                  placeholder="Mobile number"
                  onChange={(e) =>
                    updateField(
                      "mobile",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="City">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={profile.city}
                  disabled={!isEditing}
                  placeholder="City"
                  onChange={(e) =>
                    updateField(
                      "city",
                      e.target.value
                    )
                  }
                />
              </Field>
            </div>

            <div
              style={styles.addressField}
            >
              <Field label="Address">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={profile.address}
                  disabled={!isEditing}
                  placeholder="Residential address"
                  onChange={(e) =>
                    updateField(
                      "address",
                      e.target.value
                    )
                  }
                />
              </Field>
            </div>
          </section>

          <section style={styles.section}>
            <h2
              style={styles.sectionTitle}
            >
              Registration &amp;
              Compliance
            </h2>

            <div style={styles.gridTwo}>
              <Field label="Registration Number">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={
                    profile.registration_number
                  }
                  disabled={!isEditing}
                  onChange={(e) =>
                    updateField(
                      "registration_number",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="Practice Number">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={
                    profile.practice_number
                  }
                  disabled={!isEditing}
                  onChange={(e) =>
                    updateField(
                      "practice_number",
                      e.target.value
                    )
                  }
                />
              </Field>
            </div>
          </section>

          <section style={styles.section}>
            <h2
              style={styles.sectionTitle}
            >
              Payment Details
            </h2>

            <p style={styles.helpText}>
              Banking information is used
              for approved locum shift
              payments.
            </p>

            <div style={styles.gridFour}>
              <Field label="Bank Name">
                <select
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={
                    profile.bank_name
                  }
                  disabled={!isEditing}
                  onChange={(e) =>
                    updateField(
                      "bank_name",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select bank
                  </option>

                  {availableBanks.map(
                    (bank) => (
                      <option
                        key={bank}
                        value={bank}
                      >
                        {bank}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Account Holder Name">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={
                    profile.account_holder_name
                  }
                  disabled={!isEditing}
                  onChange={(e) =>
                    updateField(
                      "account_holder_name",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="Account Number">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={
                    profile.account_number
                  }
                  disabled={!isEditing}
                  inputMode="numeric"
                  onChange={(e) =>
                    updateField(
                      "account_number",
                      e.target.value
                    )
                  }
                />
              </Field>

              <Field label="Branch Code">
                <input
                  style={getInputStyle(
                    !isEditing
                  )}
                  value={
                    profile.branch_code
                  }
                  disabled={!isEditing}
                  inputMode="numeric"
                  onChange={(e) =>
                    updateField(
                      "branch_code",
                      e.target.value
                    )
                  }
                />
              </Field>
            </div>
          </section>

          <div style={styles.actions}>
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={cancelEditing}
                  style={
                    styles.cancelButton
                  }
                >
                  Cancel Changes
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    uploadingPhoto ||
                    uploadingCv
                  }
                  style={
                    styles.saveButton
                  }
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>
              </>
            ) : (
              <>
                <div
                  style={
                    styles.savedBadge
                  }
                >
                  ✓ Profile saved
                </div>

                <button
                  type="button"
                  onClick={startEditing}
                  style={
                    styles.updateButton
                  }
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

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.fieldLabel}>
        {label}
      </span>

      {children}
    </label>
  );
}

function getInputStyle(
  disabled: boolean
): React.CSSProperties {
  return {
    ...styles.input,

    background: disabled
      ? "#f1f5f9"
      : "#ffffff",

    color: disabled
      ? "#475569"
      : "#0f172a",

    cursor: disabled
      ? "default"
      : "text",

    opacity: 1,
  };
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "30px 20px 60px",
    fontFamily: "Arial, sans-serif",
  },

  loadingPage: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f1f5f9",
    fontFamily: "Arial, sans-serif",
  },

  loadingCard: {
    background: "#ffffff",
    padding: "24px 30px",
    borderRadius: "18px",
    fontWeight: 800,
  },

  container: {
    width: "100%",
    maxWidth: "1220px",
    margin: "0 auto",
  },

  backLink: {
    color: "#0f766e",
    textDecoration: "none",
    fontWeight: 800,
  },

  header: {
    marginTop: "20px",
    padding: "34px",
    borderRadius: "28px",
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #0f172a, #164e63)",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: "0 0 8px",
    color: "#99f6e4",
    fontWeight: 900,
    letterSpacing: "1px",
    textTransform: "uppercase",
  },

  title: {
    margin: "0",
    fontSize: "42px",
    lineHeight: 1.15,
  },

  subtitle: {
    margin: "12px 0 0",
    color: "#dbeafe",
    fontSize: "17px",
    lineHeight: 1.55,
  },

  headerUpdateButton: {
    marginTop: "20px",
    padding: "12px 18px",
    borderRadius: "12px",
    border:
      "1px solid rgba(255,255,255,0.5)",
    background:
      "rgba(255,255,255,0.14)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  headerPhoto: {
    width: "105px",
    height: "105px",
    objectFit: "cover",
    borderRadius: "50%",
    border:
      "4px solid rgba(255,255,255,0.8)",
  },

  photoPlaceholder: {
    width: "105px",
    height: "105px",
    borderRadius: "50%",
    background:
      "rgba(255,255,255,0.14)",
    display: "grid",
    placeItems: "center",
    fontSize: "48px",
  },

  viewModeNotice: {
    marginTop: "20px",
    padding: "18px 20px",
    borderRadius: "16px",
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    display: "flex",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: "15px",
    flexWrap: "wrap",
    color: "#065f46",
  },

  section: {
    marginTop: "22px",
    padding: "28px",
    borderRadius: "24px",
    background: "#ffffff",
    boxShadow:
      "0 12px 30px rgba(15,23,42,0.06)",
  },

  sectionTitle: {
    margin: "0 0 20px",
    color: "#0f172a",
    fontSize: "25px",
  },

  helpText: {
    color: "#64748b",
    margin: "5px 0 12px",
    lineHeight: 1.5,
  },

  lockedText: {
    color: "#64748b",
    fontWeight: 700,
  },

  statusText: {
    color: "#0f766e",
    fontWeight: 700,
  },

  uploadTitle: {
    margin: "0 0 10px",
    fontSize: "17px",
    color: "#0f172a",
    fontWeight: 900,
  },

  uploadDetails: {
    flex: 1,
    minWidth: "240px",
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

  largePhotoPlaceholder: {
    width: "130px",
    height: "130px",
    borderRadius: "20px",
    background: "#e2e8f0",
    display: "grid",
    placeItems: "center",
    fontSize: "55px",
  },

  documentUpload: {
    display: "flex",
    alignItems: "flex-start",
    gap: "18px",
    padding: "20px",
    border:
      "1px dashed #94a3b8",
    borderRadius: "18px",
    background: "#f8fafc",
    flexWrap: "wrap",
  },

  documentIcon: {
    width: "64px",
    height: "64px",
    borderRadius: "16px",
    background: "#ccfbf1",
    display: "grid",
    placeItems: "center",
    fontSize: "32px",
  },

  documentDetails: {
    flex: 1,
    minWidth: "230px",
  },

  documentTitle: {
    margin: "0 0 12px",
    color: "#0f172a",
    fontWeight: 800,
  },

  viewDocumentButton: {
    marginTop: "10px",
    padding: "10px 16px",
    borderRadius: "11px",
    border: "1px solid #0f766e",
    background: "#ffffff",
    color: "#0f766e",
    fontWeight: 800,
    cursor: "pointer",
  },

  gridFour: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },

  gridTwo: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "16px",
  },

  addressField: {
    marginTop: "16px",
  },

  field: {
    display: "grid",
    gap: "8px",
  },

  fieldLabel: {
    fontWeight: 800,
    color: "#334155",
    fontSize: "14px",
  },

  input: {
    width: "100%",
    minHeight: "50px",
    padding: "12px 14px",
    border:
      "1px solid #cbd5e1",
    borderRadius: "13px",
    fontSize: "15px",
    boxSizing: "border-box",
  },

  successMessage: {
    marginTop: "20px",
    padding: "14px 16px",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "13px",
    fontWeight: 800,
  },

  errorMessage: {
    marginTop: "20px",
    padding: "14px 16px",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "13px",
    fontWeight: 800,
  },

  actions: {
    display: "flex",
    justifyContent:
      "flex-end",
    alignItems: "center",
    gap: "12px",
    marginTop: "24px",
    flexWrap: "wrap",
  },

  cancelButton: {
    padding: "14px 22px",
    borderRadius: "13px",
    border:
      "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    cursor: "pointer",
    fontWeight: 800,
  },

  saveButton: {
    padding: "14px 24px",
    borderRadius: "13px",
    border: "none",
    background: "#0f172a",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 900,
  },

  updateButton: {
    padding: "14px 24px",
    borderRadius: "13px",
    border: "none",
    background: "#0f766e",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 900,
  },

  savedBadge: {
    padding: "13px 18px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 900,
  },
};
