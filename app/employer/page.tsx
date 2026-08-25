

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const professions = [
  "Pharmacist",
  "Doctor",
  "Nurse",
  "Physiotherapist",
  "Biokinetist",
  "Dentist",
  "Psychologist",
  "Independent Prescriber",
  "Optometrist",
];

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

const countrySettings: Record<
  string,
  {
    currency: string;
    symbol: string;
    regionLabel: string;
  }
> = {
  "South Africa": {
    currency: "ZAR",
    symbol: "R",
    regionLabel: "Province",
  },

  "United Kingdom": {
    currency: "GBP",
    symbol: "£",
    regionLabel: "Region / County",
  },

  "New Zealand": {
    currency: "NZD",
    symbol: "NZ$",
    regionLabel: "Region",
  },

  Ireland: {
    currency: "EUR",
    symbol: "€",
    regionLabel: "County",
  },
};

type Company = {
  id: string;
  business_name: string | null;
  city: string | null;
  country: string | null;
  address?: string | null;
};

export default function EmployerPage() {
  const router = useRouter();

  const [companyId, setCompanyId] = useState("");
  const [companyLoaded, setCompanyLoaded] = useState(false);

  const [pageLoading, setPageLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  const [title, setTitle] = useState("");
  const [profession, setProfession] =
    useState("Pharmacist");

  const [positions, setPositions] = useState(1);

  const [businessName, setBusinessName] =
    useState("");

  const [country, setCountry] =
    useState("South Africa");

  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [rateType, setRateType] =
    useState("Hourly");

  const [rate, setRate] = useState("");
  const [notes, setNotes] = useState("");

  const settings =
    countrySettings[country] ||
    countrySettings["South Africa"];

  const employerRate = Number(rate || 0);

  const locumRate = useMemo(
    () => employerRate * 0.9,
    [employerRate],
  );

  const adminFee = useMemo(
    () => employerRate * 0.1,
    [employerRate],
  );

  useEffect(() => {
    initialiseEmployer();
  }, []);

  async function initialiseEmployer() {
    setPageLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      /*
       * Confirm this user is an employer / organisation.
       */
      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            `
            id,
            role,
            account_type,
            organisation_name,
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

      /*
       * Find the company owned by this account.
       */
      const {
        data: company,
        error: companyError,
      } = await supabase
        .from("companies")
        .select(
          `
          id,
          business_name,
          city,
          country,
          address
        `,
        )
        .eq("owner_id", user.id)
        .maybeSingle<Company>();

      if (companyError) {
        console.error(
          "Company lookup error:",
          companyError,
        );
      }

      const role =
        profile?.role
          ?.toString()
          .trim()
          .toLowerCase() || "";

      const accountType =
        profile?.account_type
          ?.toString()
          .trim()
          .toLowerCase() || "";

      const employerValues = [
        "employer",
        "organisation",
        "organization",
        "company",
      ];

      const isEmployer =
        employerValues.includes(role) ||
        employerValues.includes(accountType) ||
        Boolean(profile?.organisation_name) ||
        Boolean(profile?.company_id) ||
        Boolean(company?.id);

      if (!isEmployer) {
        setMessageType("error");

        setMessage(
          "This account is not registered as an employer or organisation.",
        );

        setPageLoading(false);
        return;
      }

      if (company) {
        setCompanyId(company.id);

        setBusinessName(
          company.business_name || "",
        );

        setCity(company.city || "");

        setAddress(company.address || "");

        const companyCountry =
          company.country || "South Africa";

        setCountry(companyCountry);

        setCompanyLoaded(true);
      } else {
        setCompanyLoaded(false);

        setBusinessName(
          profile?.organisation_name || "",
        );

        setMessageType("error");

        setMessage(
          "Your employer account is active, but your organisation profile has not been completed. Please complete the organisation profile before posting shifts.",
        );
      }
    } catch (error) {
      console.error(
        "Employer page setup error:",
        error,
      );

      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load employer account.",
      );
    } finally {
      setPageLoading(false);
    }
  }

  function handleCountryChange(
    selectedCountry: string,
  ) {
    setCountry(selectedCountry);

    /*
     * Reset province/region when country changes.
     */
    setProvince("");
  }

  function validateShift() {
    if (!companyId) {
      return "Please complete your organisation profile before posting a shift.";
    }

    if (!title.trim()) {
      return "Please enter a shift title.";
    }

    if (!profession) {
      return "Please select a profession.";
    }

    if (positions < 1) {
      return "At least one locum position is required.";
    }

    if (!businessName.trim()) {
      return "Business name is required.";
    }

    if (!country) {
      return "Country is required.";
    }

    if (!city.trim()) {
      return "City is required.";
    }

    if (!address.trim()) {
      return "Shift address is required.";
    }

    if (!startDate) {
      return "Start date is required.";
    }

    if (!endDate) {
      return "End date is required.";
    }

    if (endDate < startDate) {
      return "End date cannot be before the start date.";
    }

    if (!startTime) {
      return "Start time is required.";
    }

    if (!endTime) {
      return "End time is required.";
    }

    if (startDate === endDate) {
      if (endTime <= startTime) {
        return "End time must be later than the start time.";
      }
    }

    if (!employerRate || employerRate <= 0) {
      return "Please enter a valid organisation rate.";
    }

    return "";
  }

  async function postShift(
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    const validationError = validateShift();

    if (validationError) {
      setMessageType("error");
      setMessage(validationError);
      return;
    }

    setPosting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { error } = await supabase
        .from("shifts")
        .insert({
          company_id: companyId,

          created_by: user.id,

          title: title.trim(),

          profession_required: profession,

          positions_required: positions,

          business_name: businessName.trim(),

          country,

          province:
            province.trim() || null,

          city: city.trim(),

          address: address.trim(),

          start_date: startDate,

          end_date: endDate,

          start_time: startTime,

          end_time: endTime,

          rate_type: rateType.toLowerCase(),

          currency: settings.currency,

          employer_rate: employerRate,

          /*
           * The healthcare professional sees 90%.
           */
          hourly_rate:
            rateType === "Hourly"
              ? locumRate
              : null,

          locum_rate: locumRate,

          /*
           * CareStaffing retains 10%.
           */
          platform_fee_per_hour:
            rateType === "Hourly"
              ? adminFee
              : null,

          platform_fee: adminFee,

          platform_fee_percentage: 10,

          notes: notes.trim() || null,

          status: "open",
        });

      if (error) {
        throw error;
      }

      setMessageType("success");

      setMessage(
        `Shift successfully posted. Organisation rate ${settings.symbol}${employerRate.toFixed(
          2,
        )}. Locum rate ${settings.symbol}${locumRate.toFixed(
          2,
        )}. CareStaffing fee ${settings.symbol}${adminFee.toFixed(
          2,
        )}.`,
      );

      /*
       * Keep organisation information populated.
       * Reset only shift-specific fields.
       */
      setTitle("");
      setProfession("Pharmacist");
      setPositions(1);
      setProvince("");

      setStartDate("");
      setEndDate("");

      setStartTime("");
      setEndTime("");

      setRateType("Hourly");
      setRate("");
      setNotes("");
    } catch (error) {
      console.error(
        "Post shift error:",
        error,
      );

      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not post shift.",
      );
    } finally {
      setPosting(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();

    router.replace("/login");
  }

  if (pageLoading) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner}>⏳</div>

          <h2>Loading Employer Account</h2>

          <p style={styles.muted}>
            Checking your CareStaffing organisation
            profile...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* TOP NAVIGATION */}

        <div style={styles.topBar}>
          <Link
            href="/employer"
            style={styles.brand}
          >
            CARESTAFFING
          </Link>

          <div style={styles.topActions}>
            <Link
              href="/employer"
              style={{
                ...styles.navLink,
                color: "#0f766e",
                fontWeight: 900,
              }}
            >
              Post Shift
            </Link>

            <Link
              href="/employer/shifts"
              style={styles.navLink}
            >
              My Shifts
            </Link>

            <Link
              href="/employer/applicants"
              style={styles.navLink}
            >
              Applicants
            </Link>

            <Link
              href="/employer/locum-directory"
              style={styles.navLink}
            >
              Locum Directory
            </Link>

            <Link
              href="/employer/profile"
              style={styles.navLink}
            >
              Organisation Profile
            </Link>

            <button
              type="button"
              onClick={logout}
              style={styles.logoutButton}
            >
              Logout
            </button>
          </div>
        </div>

        {/* HERO */}

        <div style={styles.hero}>
          <div>
            <p style={styles.heroLabel}>
              Employer Portal
            </p>

            <h1 style={styles.heroTitle}>
              Post New Shift
            </h1>

            <p style={styles.heroText}>
              Create a healthcare shift and make it
              available to registered CareStaffing
              professionals.
            </p>
          </div>

          <div style={styles.feeBadge}>
            <strong>90%</strong>
            <span>Locum</span>

            <div style={styles.feeDivider} />

            <strong>10%</strong>
            <span>CareStaffing</span>
          </div>
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

        {!companyLoaded && (
          <div style={styles.companyWarning}>
            <div>
              <strong>
                Complete your organisation profile
              </strong>

              <p style={styles.companyWarningText}>
                Your company information is required
                before you can publish shifts.
              </p>
            </div>

            <Link
              href="/employer/profile"
              style={styles.profileButton}
            >
              Complete Profile
            </Link>
          </div>
        )}

        <form
          onSubmit={postShift}
          style={styles.form}
        >
          {/* SHIFT DETAILS */}

          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionNumber}>
                1
              </div>

              <div>
                <h2 style={styles.sectionTitle}>
                  Shift Details
                </h2>

                <p style={styles.sectionSubtitle}>
                  Specify who you need for this shift.
                </p>
              </div>
            </div>

            <div style={styles.twoColumn}>
              <Field label="Shift Title">
                <input
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  style={styles.input}
                  placeholder="e.g. Pharmacist Locum"
                  required
                />
              </Field>

              <Field label="Profession">
                <select
                  value={profession}
                  onChange={(e) =>
                    setProfession(e.target.value)
                  }
                  style={styles.input}
                >
                  {professions.map((item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Number of Locums Required">
              <input
                type="number"
                min={1}
                max={100}
                value={positions}
                onChange={(e) =>
                  setPositions(
                    Math.max(
                      1,
                      Number(e.target.value),
                    ),
                  )
                }
                style={styles.input}
                required
              />
            </Field>
          </section>

          {/* LOCATION */}

          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionNumber}>
                2
              </div>

              <div>
                <h2 style={styles.sectionTitle}>
                  Workplace
                </h2>

                <p style={styles.sectionSubtitle}>
                  Enter the location where the locum
                  will work.
                </p>
              </div>
            </div>

            <Field label="Name of Business">
              <input
                value={businessName}
                onChange={(e) =>
                  setBusinessName(e.target.value)
                }
                style={styles.input}
                placeholder="Business / branch name"
                required
              />
            </Field>

            <div style={styles.twoColumn}>
              <Field label="Country">
                <select
                  value={country}
                  onChange={(e) =>
                    handleCountryChange(
                      e.target.value,
                    )
                  }
                  style={styles.input}
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

              {country === "South Africa" ? (
                <Field label="Province">
                  <select
                    value={province}
                    onChange={(e) =>
                      setProvince(e.target.value)
                    }
                    style={styles.input}
                    required
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
                <Field
                  label={settings.regionLabel}
                >
                  <input
                    value={province}
                    onChange={(e) =>
                      setProvince(e.target.value)
                    }
                    style={styles.input}
                    placeholder={
                      settings.regionLabel
                    }
                  />
                </Field>
              )}
            </div>

            <div style={styles.twoColumn}>
              <Field label="City">
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

              <Field label="Full Address">
                <input
                  value={address}
                  onChange={(e) =>
                    setAddress(e.target.value)
                  }
                  style={styles.input}
                  placeholder="Full branch address"
                  required
                />
              </Field>
            </div>
          </section>

          {/* DATE AND TIME */}

          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionNumber}>
                3
              </div>

              <div>
                <h2 style={styles.sectionTitle}>
                  Date & Time
                </h2>

                <p style={styles.sectionSubtitle}>
                  Specify when the shift starts and
                  ends.
                </p>
              </div>
            </div>

            <div style={styles.twoColumn}>
              <Field label="Start Date">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(e.target.value)
                  }
                  style={styles.input}
                  required
                />
              </Field>

              <Field label="End Date">
                <input
                  type="date"
                  min={startDate || undefined}
                  value={endDate}
                  onChange={(e) =>
                    setEndDate(e.target.value)
                  }
                  style={styles.input}
                  required
                />
              </Field>
            </div>

            <div style={styles.twoColumn}>
              <Field label="Start Time">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) =>
                    setStartTime(e.target.value)
                  }
                  style={styles.input}
                  required
                />
              </Field>

              <Field label="End Time">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) =>
                    setEndTime(e.target.value)
                  }
                  style={styles.input}
                  required
                />
              </Field>
            </div>
          </section>

          {/* RATE */}

          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionNumber}>
                4
              </div>

              <div>
                <h2 style={styles.sectionTitle}>
                  Rate & Payment
                </h2>

                <p style={styles.sectionSubtitle}>
                  Enter the total agreed organisation
                  rate.
                </p>
              </div>
            </div>

            <div style={styles.twoColumn}>
              <Field label="Rate Type">
                <select
                  value={rateType}
                  onChange={(e) =>
                    setRateType(e.target.value)
                  }
                  style={styles.input}
                >
                  <option value="Hourly">
                    Hourly
                  </option>

                  <option value="Daily">
                    Daily
                  </option>

                  <option value="Session">
                    Session
                  </option>
                </select>
              </Field>

              <Field
                label={`Organisation Agreed Rate (${settings.symbol})`}
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rate}
                  onChange={(e) =>
                    setRate(e.target.value)
                  }
                  style={styles.input}
                  placeholder="0.00"
                  required
                />
              </Field>
            </div>

            <div style={styles.breakdown}>
              <h3 style={styles.breakdownTitle}>
                Rate Breakdown
              </h3>

              <div style={styles.rateGrid}>
                <div style={styles.rateItem}>
                  <span style={styles.rateLabel}>
                    Organisation pays
                  </span>

                  <strong style={styles.rateValue}>
                    {settings.symbol}
                    {employerRate.toFixed(2)}
                  </strong>
                </div>

                <div style={styles.rateItem}>
                  <span style={styles.rateLabel}>
                    Locum receives
                  </span>

                  <strong style={styles.locumValue}>
                    {settings.symbol}
                    {locumRate.toFixed(2)}
                  </strong>

                  <small style={styles.rateSmall}>
                    90%
                  </small>
                </div>

                <div style={styles.rateItem}>
                  <span style={styles.rateLabel}>
                    CareStaffing fee
                  </span>

                  <strong style={styles.rateValue}>
                    {settings.symbol}
                    {adminFee.toFixed(2)}
                  </strong>

                  <small style={styles.rateSmall}>
                    10%
                  </small>
                </div>
              </div>
            </div>
          </section>

          {/* NOTES */}

          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <div style={styles.sectionNumber}>
                5
              </div>

              <div>
                <h2 style={styles.sectionTitle}>
                  Additional Requirements
                </h2>

                <p style={styles.sectionSubtitle}>
                  Add any instructions or requirements
                  for applicants.
                </p>
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value)
              }
              style={styles.textarea}
              placeholder="Example: Active professional registration required, dispensing experience preferred, arrive 15 minutes before shift..."
            />
          </section>

          <button
            type="submit"
            disabled={
              posting || !companyLoaded
            }
            style={{
              ...styles.button,
              opacity:
                posting || !companyLoaded
                  ? 0.6
                  : 1,
              cursor:
                posting || !companyLoaded
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {posting
              ? "Posting Shift..."
              : "Post Shift"}
          </button>
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
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },

  loadingCard: {
    background: "#ffffff",
    borderRadius: 22,
    padding: 32,
    textAlign: "center",
    boxShadow:
      "0 20px 45px rgba(15,23,42,.1)",
  },

  spinner: {
    fontSize: 30,
  },

  muted: {
    color: "#64748b",
  },

  container: {
    width: "100%",
    maxWidth: 1000,
    margin: "0 auto",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
    marginBottom: 20,
  },

  brand: {
    color: "#0f766e",
    fontWeight: 900,
    letterSpacing: 1,
    textDecoration: "none",
  },

  topActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },

  navLink: {
    color: "#475569",
    fontWeight: 700,
    textDecoration: "none",
    fontSize: 14,
  },

  logoutButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    padding: "9px 13px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },

  hero: {
    background:
      "linear-gradient(135deg,#0f172a,#0f766e)",
    padding: 30,
    borderRadius: 24,
    color: "#ffffff",
    marginBottom: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 25,
    flexWrap: "wrap",
  },

  heroLabel: {
    margin: "0 0 8px",
    color: "#99f6e4",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 13,
  },

  heroTitle: {
    margin: 0,
    fontSize: 38,
  },

  heroText: {
    color: "#cbd5e1",
    maxWidth: 580,
    lineHeight: 1.55,
    marginBottom: 0,
  },

  feeBadge: {
    background:
      "rgba(255,255,255,.12)",
    border:
      "1px solid rgba(255,255,255,.2)",
    padding: "16px 20px",
    borderRadius: 18,
    display: "grid",
    gridTemplateColumns:
      "auto auto 1px auto auto",
    gap: 8,
    alignItems: "center",
  },

  feeDivider: {
    height: 32,
    width: 1,
    background:
      "rgba(255,255,255,.35)",
    margin: "0 6px",
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
    boxShadow:
      "0 8px 24px rgba(15,23,42,.05)",
  },

  sectionHeader: {
    display: "flex",
    gap: 13,
    alignItems: "center",
    marginBottom: 20,
  },

  sectionNumber: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: "#ccfbf1",
    color: "#0f766e",
    fontWeight: 900,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 21,
    color: "#0f172a",
  },

  sectionSubtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 14,
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(240px,1fr))",
    gap: 15,
    marginBottom: 15,
  },

  field: {
    display: "grid",
    gap: 7,
    marginBottom: 14,
  },

  fieldLabel: {
    fontWeight: 800,
    color: "#334155",
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

  textarea: {
    width: "100%",
    minHeight: 130,
    padding: 14,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
    fontSize: 15,
    resize: "vertical",
  },

  breakdown: {
    background: "#ecfeff",
    border: "1px solid #99f6e4",
    padding: 18,
    borderRadius: 16,
    marginTop: 8,
  },

  breakdownTitle: {
    margin: "0 0 14px",
    color: "#134e4a",
  },

  rateGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(160px,1fr))",
    gap: 12,
  },

  rateItem: {
    background: "#ffffff",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 5,
  },

  rateLabel: {
    color: "#64748b",
    fontSize: 13,
  },

  rateValue: {
    color: "#0f172a",
    fontSize: 20,
  },

  locumValue: {
    color: "#0f766e",
    fontSize: 20,
  },

  rateSmall: {
    color: "#64748b",
  },

  button: {
    width: "100%",
    padding: 17,
    background:
      "linear-gradient(135deg,#0f766e,#0891b2)",
    color: "#ffffff",
    border: "none",
    borderRadius: 14,
    fontWeight: 900,
    fontSize: 16,
  },

  successMessage: {
    padding: 15,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 13,
    marginBottom: 18,
    fontWeight: 700,
  },

  errorMessage: {
    padding: 15,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 13,
    marginBottom: 18,
    fontWeight: 700,
  },

  companyWarning: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    padding: 18,
    borderRadius: 15,
    marginBottom: 18,
    color: "#9a3412",
  },

  companyWarningText: {
    margin: "5px 0 0",
    fontSize: 14,
  },

  profileButton: {
    background: "#0f766e",
    color: "#ffffff",
    padding: "11px 15px",
    borderRadius: 11,
    fontWeight: 800,
    textDecoration: "none",
  },
};
