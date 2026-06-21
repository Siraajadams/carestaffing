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
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("Female");
  const [country, setCountry] = useState("South Africa");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [councilDoc, setCouncilDoc] = useState<File | null>(null);
  const [nationalIdDoc, setNationalIdDoc] = useState<File | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function calculateAge(dob: string) {
    if (!dob) return null;

    const birthDate = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  async function uploadFile(
    bucket: string,
    userId: string,
    file: File | null,
    label: string
  ) {
    if (!file) return "";

    if (!userId) {
      throw new Error("No user ID found for upload.");
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "file";
    const filePath = `${userId}/${label}-${Date.now()}.${fileExt}`;

    console.log("Uploading file:", {
      bucket,
      userId,
      fileName: file.name,
      filePath,
    });

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      throw new Error(error.message);
    }

    if (bucket === "carestaffing-profile-photos") {
      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicData.publicUrl;
    }

    return data.path;
  }

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

    if (accountType === "worker" && !dateOfBirth) {
      setMessage("Please enter date of birth.");
      return;
    }

    if (accountType === "worker" && !councilDoc) {
      setMessage("Please upload council registration document.");
      return;
    }

    if (!nationalIdDoc) {
      setMessage("Please upload national identity document.");
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

    try {
      const age = calculateAge(dateOfBirth);

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
            date_of_birth: dateOfBirth || null,
            age,
            gender,
            country,
            city: city.trim(),
            role: accountType,
            platform: "CareStaffing",
          },
        },
      });

      if (error) throw new Error(error.message);

      const userId = data.user?.id;
      if (!userId) throw new Error("User registration failed. No user ID found.");

      const councilDocUrl = await uploadFile(
        "carestaffing-documents",
        userId,
        councilDoc,
        "council-registration"
      );

      const nationalIdDocUrl = await uploadFile(
        "carestaffing-documents",
        userId,
        nationalIdDoc,
        "national-id"
      );

      const profilePhotoUrl = await uploadFile(
        "carestaffing-profile-photos",
        userId,
        profilePhoto,
        "profile-photo"
      );

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        role_type: accountType,
        first_name: firstName.trim(),
        surname: surname.trim(),
        organisation_name: organisationName.trim(),
        email: email.trim(),
        mobile_number: mobile.trim(),
        profession,
        professional_registration_number: registrationNumber.trim(),
        date_of_birth: dateOfBirth || null,
        age,
        gender,
        country,
        city_area: city.trim(),
        platform: "CareStaffing",
        council_registration_document_url: councilDocUrl,
        national_id_document_url: nationalIdDocUrl,
        profile_photo_url: profilePhotoUrl,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      if (profileError) throw new Error(profileError.message);

      router.push("/login");
    } catch (err: any) {
      setMessage(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
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
            <button type="button" onClick={() => setAccountType("worker")} style={accountType === "worker" ? styles.toggleActive : styles.toggleButton}>
              Healthcare Worker
            </button>

            <button type="button" onClick={() => setAccountType("organisation")} style={accountType === "organisation" ? styles.toggleActive : styles.toggleButton}>
              Organisation
            </button>
          </div>

          {accountType === "worker" ? (
            <>
              <div style={styles.grid}>
                <input style={styles.input} placeholder="First name *" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input style={styles.input} placeholder="Surname *" value={surname} onChange={(e) => setSurname(e.target.value)} />
              </div>

              <div style={styles.grid}>
                <input style={styles.input} type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                <input style={styles.input} value={dateOfBirth ? `${calculateAge(dateOfBirth)} years old` : ""} placeholder="Age" readOnly />
              </div>

              <select style={styles.input} value={gender} onChange={(e) => setGender(e.target.value)}>
                <option>Female</option>
                <option>Male</option>
              </select>

              <select style={styles.input} value={profession} onChange={(e) => setProfession(e.target.value)}>
                <option>Doctor</option>
                <option>Pharmacy Technician</option>
                <option>Nurse</option>
                <option>Pharmacist</option>
                <option>Independent Prescriber</option>
                <option>Optometrist</option>
              </select>

              <input style={styles.input} placeholder="Professional registration number" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />

              <label style={styles.fileLabel}>
                Upload council registration document *
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setCouncilDoc(e.target.files?.[0] || null)} />
              </label>
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

          <label style={styles.fileLabel}>
            Upload national identity document *
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setNationalIdDoc(e.target.files?.[0] || null)} />
          </label>

          <label style={styles.fileLabel}>
            Upload profile photo
            <input type="file" accept="image/*" onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)} />
          </label>

          <div style={styles.grid}>
            <div style={styles.passwordWrap}>
              <input style={styles.passwordInput} type={showPassword ? "text" : "password"} placeholder="Password *" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>

            <div style={styles.passwordWrap}>
              <input style={styles.passwordInput} type={showConfirmPassword ? "text" : "password"} placeholder="Confirm password *" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
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
  page: { minHeight: "100vh", background: "#ecfeff", padding: "24px", display: "flex", justifyContent: "center", alignItems: "flex-start", fontFamily: "Arial, sans-serif" },
  card: { width: "100%", maxWidth: "760px", background: "#ffffff", borderRadius: "24px", padding: "28px", boxShadow: "0 20px 45px rgba(15, 23, 42, 0.14)" },
  backLink: { color: "#0f766e", fontWeight: 700, textDecoration: "none" },
  label: { marginTop: "28px", color: "#0f766e", fontWeight: 800, fontSize: "14px", textTransform: "uppercase" },
  title: { marginTop: "8px", fontSize: "36px", lineHeight: "42px", color: "#0f172a" },
  subtitle: { color: "#475569", fontSize: "17px", marginBottom: "24px" },
  form: { display: "grid", gap: "14px" },
  toggle: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "8px" },
  toggleButton: { padding: "14px", borderRadius: "14px", border: "1px solid #99f6e4", background: "#f0fdfa", color: "#115e59", fontWeight: 700, cursor: "pointer" },
  toggleActive: { padding: "14px", borderRadius: "14px", border: "1px solid #0f766e", background: "#0f766e", color: "#ffffff", fontWeight: 800, cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" },
  input: { width: "100%", padding: "14px 16px", borderRadius: "12px", border: "1px solid #cbd5e1", fontSize: "16px", boxSizing: "border-box" },
  fileLabel: { display: "grid", gap: "8px", padding: "14px 16px", borderRadius: "12px", border: "1px dashed #14b8a6", background: "#f0fdfa", color: "#115e59", fontWeight: 700 },
  passwordWrap: { position: "relative", width: "100%" },
  passwordInput: { width: "100%", padding: "14px 52px 14px 16px", borderRadius: "12px", border: "1px solid #cbd5e1", fontSize: "16px", boxSizing: "border-box" },
  eyeButton: { position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", fontSize: "18px", zIndex: 10 },
  error: { background: "#fee2e2", color: "#991b1b", padding: "12px 14px", borderRadius: "12px", fontWeight: 600 },
  button: { marginTop: "8px", width: "100%", padding: "16px", borderRadius: "14px", border: "none", background: "#0f766e", color: "#ffffff", fontSize: "17px", fontWeight: 800, cursor: "pointer" },
  footer: { marginTop: "22px", textAlign: "center", color: "#475569" },
  link: { color: "#0f766e", fontWeight: 700, textDecoration: "none" },
};
