"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const countries = [
  "South Africa",
  "United Kingdom",
  "New Zealand",
  "Ireland",
];

const southAfricanProvinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

export default function EmployerProfilePage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  const [saved, setSaved] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [registrationNumber, setRegistrationNumber] =
    useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  const [country, setCountry] = useState("South Africa");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");

  useEffect(() => {
    loadEmployer();
  }, []);

  async function loadEmployer() {
    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Auth user lookup error:", userError);
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      setEmail(user.email || "");

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          `
          first_name,
          surname,
          mobile,
          organisation_name,
          role,
          account_type,
          company_id
        `,
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(
          "Employer profile lookup error:",
          profileError,
        );
      }

      if (profile) {
        const fullName = [
          profile.first_name,
          profile.surname,
        ]
          .filter(Boolean)
          .join(" ");

        setContactPerson(fullName);
        setMobile(profile.mobile || "");

        if (profile.organisation_name) {
          setBusinessName(profile.organisation_name);
        }

        if (profile.company_id) {
          setCompanyId(profile.company_id);
        }
      }

      const {
        data: company,
        error: companyError,
      } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (companyError) {
        console.error(
          "Company profile lookup error:",
          companyError,
        );

        throw companyError;
      }

      if (company) {
        setCompanyId(company.id || "");

        setBusinessName(
          company.business_name || "",
        );

        setRegistrationNumber(
          company.registration_number || "",
        );

        setVatNumber(company.vat_number || "");

        setContactPerson(
          company.contact_person ||
            [
              profile?.first_name,
              profile?.surname,
            ]
              .filter(Boolean)
              .join(" ") ||
            "",
        );

        setEmail(
          company.email ||
            user.email ||
            "",
        );

        setMobile(
          company.mobile ||
            profile?.mobile ||
            "",
        );

        setCountry(
          company.country || "South Africa",
        );

        setProvince(company.province || "");
        setCity(company.city || "");
        setAddress(company.address || "");
        setPostalCode(
          company.postal_code || "",
        );

        setSaved(true);
      }
    } catch (error: any) {
      console.error(
        "Employer profile load error:",
        error,
      );

      setMessageType("error");

      setMessage(
        error?.message ||
          error?.details ||
          error?.hint ||
          "Could not load organisation profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    if (!businessName.trim()) {
      setMessageType("error");
      setMessage("Business name is required.");
      return;
    }

    if (!email.trim()) {
      setMessageType("error");
      setMessage("Email address is required.");
      return;
    }

    if (!country) {
      setMessageType("error");
      setMessage("Country is required.");
      return;
    }

    if (!city.trim()) {
      setMessageType("error");
      setMessage("City is required.");
      return;
    }

    if (!address.trim()) {
      setMessageType("error");
      setMessage("Business address is required.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      /*
       * =====================================================
       * SAVE / UPDATE COMPANY
       * =====================================================
       *
       * owner_id is used as the unique record for each
       * employer.
       *
       * Supabase requires a unique index on owner_id:
       *
       * create unique index if not exists
       * companies_owner_id_unique
       * on public.companies(owner_id);
       */

      const companyPayload = {
  owner_id: user.id,

  // Existing companies table requires "name"
  name: businessName.trim(),

  // Keep business_name because the employer profile uses it
  business_name: businessName.trim(),

  registration_number:
    registrationNumber.trim() || null,

  vat_number:
    vatNumber.trim() || null,

  contact_person:
    contactPerson.trim() || null,

  email:
    email.trim().toLowerCase(),

  mobile:
    mobile.trim() || null,

  country,

  province:
    province.trim() || null,

  city:
    city.trim(),

  address:
    address.trim(),

  postal_code:
    postalCode.trim() || null,

  updated_at:
    new Date().toISOString(),
};,

        registration_number:
          registrationNumber.trim() || null,

        vat_number:
          vatNumber.trim() || null,

        contact_person:
          contactPerson.trim() || null,

        email:
          email.trim().toLowerCase(),

        mobile:
          mobile.trim() || null,

        country,

        province:
          province.trim() || null,

        city:
          city.trim(),

        address:
          address.trim(),

        postal_code:
          postalCode.trim() || null,

        updated_at:
          new Date().toISOString(),
      };

      const {
        data: companyData,
        error: companyError,
      } = await supabase
        .from("companies")
        .upsert(companyPayload, {
          onConflict: "owner_id",
        })
        .select("id")
        .single();

      if (companyError) {
        console.error(
          "Company save error:",
          companyError,
        );

        throw companyError;
      }

      if (!companyData?.id) {
        throw new Error(
          "Company was saved but no company ID was returned.",
        );
      }

      const newCompanyId =
        companyData.id;

      setCompanyId(newCompanyId);

      /*
       * =====================================================
       * UPDATE EMPLOYER PROFILE
       * =====================================================
       */

      const {
        error: profileError,
      } = await supabase
        .from("profiles")
        .update({
          organisation_name:
            businessName.trim(),

          company_id:
            newCompanyId,

          role:
            "employer",

          account_type:
            "organisation",
        })
        .eq("id", user.id);

      if (profileError) {
        console.error(
          "Profile update error:",
          profileError,
        );

        throw profileError;
      }

      setSaved(true);
      setMessageType("success");

      setMessage(
        "Organisation profile saved successfully.",
      );
    } catch (error: any) {
      console.error(
        "Employer profile save error:",
        error,
      );

      setSaved(false);
      setMessageType("error");

      /*
       * Show the actual Supabase error instead of
       * only "Could not save organisation profile".
       */

      const detailedMessage =
        error?.message ||
        error?.details ||
        error?.hint ||
        error?.error_description ||
        (typeof error === "string"
          ? error
          : "");

      setMessage(
        detailedMessage ||
          "Could not save organisation profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <h2>
            Loading Organisation Profile
          </h2>

          <p style={styles.muted}>
            Please wait while CareStaffing
            loads your employer information.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <Link
            href="/employer"
            style={styles.backLink}
          >
            ← Back to Employer Portal
          </Link>
        </div>

        <div style={styles.hero}>
          <p style={styles.heroLabel}>
            CARESTAFFING
          </p>

          <h1 style={styles.heroTitle}>
            Organisation Profile
          </h1>

          <p style={styles.heroText}>
            Complete your employer profile
            before publishing healthcare
            shifts.
          </p>
        </div>

        {message && (
          <div
            style={
              messageType === "success"
                ? styles.successMessage
                : styles.errorMessage
            }
          >
            {message}
          </div>
        )}

        {saved && (
          <div style={styles.profileStatus}>
            <div>
              <strong>
                Organisation profile active
              </strong>

              <p style={styles.statusText}>
                Your organisation details are
                saved. You can update them at
                any time.
              </p>
            </div>

            <span style={styles.activeBadge}>
              ACTIVE
            </span>
          </div>
        )}

        <form
          onSubmit={saveProfile}
          style={styles.form}
        >
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              Organisation Details
            </h2>

            <div style={styles.twoColumn}>
              <Field label="Business / Organisation Name *">
                <input
                  value={businessName}
                  onChange={(e) =>
                    setBusinessName(
                      e.target.value,
                    )
                  }
                  style={styles.input}
                  placeholder="e.g. Palmyra Pharmacy"
                  required
                />
              </Field>

              <Field label="Company Registration Number">
                <input
                  value={registrationNumber}
                  onChange={(e) =>
                    setRegistrationNumber(
                      e.target.value,
                    )
                  }
                  style={styles.input}
                  placeholder="e.g. 2020/411199/07"
                />
              </Field>
            </div>

            <div style={styles.twoColumn}>
              <Field label="VAT Number">
                <input
                  value={vatNumber}
                  onChange={(e) =>
                    setVatNumber(
                      e.target.value,
                    )
                  }
                  style={styles.input}
                  placeholder="VAT number"
                />
              </Field>

              <Field label="Contact Person">
                <input
                  value={contactPerson}
                  onChange={(e) =>
                    setContactPerson(
                      e.target.value,
                    )
                  }
                  style={styles.input}
                  placeholder="Employer contact person"
                />
              </Field>
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              Contact Details
            </h2>

            <div style={styles.twoColumn}>
              <Field label="Email Address *">
                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  style={styles.input}
                  placeholder="employer@example.com"
                  required
                />
              </Field>

              <Field label="Mobile Number">
                <input
                  value={mobile}
                  onChange={(e) =>
                    setMobile(e.target.value)
                  }
                  style={styles.input}
                  placeholder="082 000 0000"
                />
              </Field>
            </div>
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              Business Location
            </h2>

            <div style={styles.twoColumn}>
              <Field label="Country *">
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(
                      e.target.value,
                    );

                    setProvince("");
                  }}
                  style={styles.input}
                  required
                >
                  {countries.map((item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              {country ===
              "South Africa" ? (
                <Field label="Province">
                  <select
                    value={province}
                    onChange={(e) =>
                      setProvince(
                        e.target.value,
                      )
                    }
                    style={styles.input}
                  >
                    <option value="">
                      Select Province
                    </option>

                    {southAfricanProvinces.map(
                      (item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              ) : (
                <Field label="Region / County">
                  <input
                    value={province}
                    onChange={(e) =>
                      setProvince(
                        e.target.value,
                      )
                    }
                    style={styles.input}
                    placeholder="Region / County"
                  />
                </Field>
              )}
            </div>

            <div style={styles.twoColumn}>
              <Field label="City *">
                <input
                  value={city}
                  onChange={(e) =>
                    setCity(e.target.value)
                  }
                  style={styles.input}
                  placeholder="Cape Town"
                  required
                />
              </Field>

              <Field label="Postal Code">
                <input
                  value={postalCode}
                  onChange={(e) =>
                    setPostalCode(
                      e.target.value,
                    )
                  }
                  style={styles.input}
                  placeholder="7708"
                />
              </Field>
            </div>

            <Field label="Full Business Address *">
              <input
                value={address}
                onChange={(e) =>
                  setAddress(
                    e.target.value,
                  )
                }
                style={styles.input}
                placeholder="Full business / branch address"
                required
              />
            </Field>
          </section>

          <div style={styles.actions}>
            <Link
              href="/employer"
              style={styles.cancelButton}
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              style={{
                ...styles.saveButton,

                opacity:
                  saving
                    ? 0.65
                    : 1,

                cursor:
                  saving
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving
                ? "Saving..."
                : saved
                  ? "Update Organisation Profile"
                  : "Save Organisation Profile"}
            </button>
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
  children: React.ReactNode;
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

  loadingPage: {
    minHeight: "100vh",
    background: "#f1f5f9",
    display: "grid",
    placeItems: "center",
    fontFamily: "Arial, sans-serif",
  },

  loadingCard: {
    background: "#ffffff",
    padding: 30,
    borderRadius: 20,
    boxShadow:
      "0 15px 40px rgba(15,23,42,.1)",
  },

  muted: {
    color: "#64748b",
  },

  container: {
    width: "100%",
    maxWidth: 950,
    margin: "0 auto",
  },

  topBar: {
    marginBottom: 18,
  },

  backLink: {
    color: "#0f766e",
    fontWeight: 800,
    textDecoration: "none",
  },

  hero: {
    background:
      "linear-gradient(135deg,#0f172a,#0f766e)",
    color: "#ffffff",
    padding: 30,
    borderRadius: 24,
    marginBottom: 20,
  },

  heroLabel: {
    margin: "0 0 8px",
    color: "#99f6e4",
    fontWeight: 900,
    letterSpacing: 1,
  },

  heroTitle: {
    margin: 0,
    fontSize: 36,
  },

  heroText: {
    color: "#cbd5e1",
    marginBottom: 0,
  },

  form: {
    display: "grid",
    gap: 18,
  },

  section: {
    background: "#ffffff",
    padding: 26,
    borderRadius: 20,
    border: "1px solid #e2e8f0",
  },

  sectionTitle: {
    marginTop: 0,
    color: "#0f172a",
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(240px,1fr))",
    gap: 15,
  },

  field: {
    display: "grid",
    gap: 7,
    marginBottom: 15,
  },

  fieldLabel: {
    color: "#334155",
    fontWeight: 800,
    fontSize: 14,
  },

  input: {
    width: "100%",
    minHeight: 50,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    fontSize: 15,
    background: "#ffffff",
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 40,
  },

  cancelButton: {
    padding: "14px 20px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    color: "#475569",
    background: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
  },

  saveButton: {
    padding: "14px 22px",
    borderRadius: 12,
    border: "none",

    background:
      "linear-gradient(135deg,#0f766e,#0891b2)",

    color: "#ffffff",
    fontWeight: 900,
  },

  successMessage: {
    background: "#dcfce7",
    color: "#166534",
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
    fontWeight: 700,
    border: "1px solid #86efac",
  },

  errorMessage: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
    fontWeight: 700,
    border: "1px solid #fecaca",
  },

  profileStatus: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,

    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    padding: "16px 18px",
    borderRadius: 16,
    marginBottom: 18,
    color: "#065f46",
  },

  statusText: {
    margin: "5px 0 0",
    color: "#047857",
    fontSize: 14,
  },

  activeBadge: {
    background: "#0f766e",
    color: "#ffffff",
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.5,
  },
};
