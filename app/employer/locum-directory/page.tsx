"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../../lib/supabaseClient";

type LocumRow = {
  id: string | number;

  first_name?: string | null;
  surname?: string | null;
  full_name?: string | null;

  email?: string | null;
  mobile?: string | number | null;

  profession?: string | null;

  // Support both old + new import column names
  registration_number?: string | null;
  professional_registration_number?: string | null;

  practice_number?: string | number | null;
  practice_name?: string | null;
  practice_full_address?: string | null;
  practice_address?: string | null;

  suburb?: string | null;
  city?: string | null;
  city_area?: string | null;
  province?: string | null;
  country?: string | null;

  available_for_locum?: boolean | string | null;

  registration_status?: string | null;
  invitation_status?: string | null;

  profile_photo_url?: string | null;
  avatar_url?: string | null;

  source?: string | null;
};

function clean(value: unknown) {
  if (value === null || value === undefined) return "";

  return String(value).trim();
}

function fullName(locum: LocumRow) {
  const suppliedName = clean(locum.full_name);

  if (suppliedName) return suppliedName;

  const builtName = `${clean(locum.first_name)} ${clean(
    locum.surname,
  )}`.trim();

  return builtName || "Healthcare Professional";
}

function initials(locum: LocumRow) {
  const first = clean(locum.first_name).charAt(0);
  const last = clean(locum.surname).charAt(0);

  return `${first}${last}`.toUpperCase() || "HP";
}

function registrationNumber(locum: LocumRow) {
  return (
    clean(locum.registration_number) ||
    clean(locum.professional_registration_number) ||
    "-"
  );
}

function displayLocation(locum: LocumRow) {
  return (
    clean(locum.city) ||
    clean(locum.city_area) ||
    clean(locum.suburb) ||
    clean(locum.province) ||
    "-"
  );
}

function displayPractice(locum: LocumRow) {
  return clean(locum.practice_name) || "-";
}

function isAvailable(locum: LocumRow) {
  if (locum.available_for_locum === true) {
    return true;
  }

  const value = clean(
    locum.available_for_locum,
  ).toLowerCase();

  return (
    value === "true" ||
    value === "yes" ||
    value === "available" ||
    value === "1"
  );
}

/*
 * Fix numbers imported from CSV/Excel where possible.
 *
 * Example:
 * 2.70737E+11
 *
 * This does not invent digits. It simply stops the browser
 * from displaying scientific notation where JS can parse it.
 */
function displayPhone(value: unknown) {
  const raw = clean(value);

  if (!raw) return "-";

  if (/e\+/i.test(raw)) {
    const numberValue = Number(raw);

    if (Number.isFinite(numberValue)) {
      return numberValue.toFixed(0);
    }
  }

  return raw;
}

function normalizePhone(value: unknown) {
  let phone = displayPhone(value);

  if (phone === "-") return "";

  phone = phone.replace(/[^\d+]/g, "");

  /*
   * South African local cellphone format.
   * Only convert when it actually begins with 0.
   */
  if (phone.startsWith("0") && phone.length >= 10) {
    phone = `+27${phone.substring(1)}`;
  }

  return phone;
}

export default function LocumDirectoryPage() {
  const [locums, setLocums] = useState<LocumRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");

  const [professionFilter, setProfessionFilter] =
    useState("All");

  const [provinceFilter, setProvinceFilter] =
    useState("All");

  const [availabilityFilter, setAvailabilityFilter] =
    useState("All");

  /*
   * Email modal state
   */
  const [selectedLocum, setSelectedLocum] =
    useState<LocumRow | null>(null);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [employerName, setEmployerName] =
    useState("CareStaffing Employer");

  const [employerEmail, setEmployerEmail] =
    useState("");

  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");

  useEffect(() => {
    loadDirectory();
  }, []);

  async function loadDirectory() {
    try {
      setLoading(true);
      setLoadError("");

      /*
       * -----------------------------------------------------
       * GET LOGGED-IN EMPLOYER
       * -----------------------------------------------------
       */
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error(
          "CareStaffing auth error:",
          authError,
        );
      }

      if (!user) {
        setLoadError(
          "Please sign in to view the locum directory.",
        );

        setLocums([]);
        return;
      }

      setEmployerEmail(user.email || "");

      /*
       * -----------------------------------------------------
       * EMPLOYER DETAILS
       * -----------------------------------------------------
       *
       * The employer may exist in profiles and/or companies.
       * Failure here must NOT stop the directory loading.
       */
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (profile) {
          const name =
            clean(profile.company_name) ||
            clean(profile.organisation_name) ||
            `${clean(profile.first_name)} ${clean(
              profile.surname,
            )}`.trim();

          if (name) {
            setEmployerName(name);
          }

          if (clean(profile.email)) {
            setEmployerEmail(clean(profile.email));
          }
        }
      } catch (profileError) {
        console.warn(
          "Employer profile could not be loaded:",
          profileError,
        );
      }

      try {
        const { data: company } = await supabase
          .from("companies")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (company) {
          const companyName =
            clean(company.business_name) ||
            clean(company.company_name) ||
            clean(company.organisation_name);

          if (companyName) {
            setEmployerName(companyName);
          }

          if (clean(company.email)) {
            setEmployerEmail(clean(company.email));
          }
        }
      } catch (companyError) {
        console.warn(
          "Company details could not be loaded:",
          companyError,
        );
      }

      /*
       * =====================================================
       * IMPORTANT FIX
       * =====================================================
       *
       * Do NOT query profiles for the directory.
       *
       * The bulk-imported healthcare professionals are stored
       * in public.locum_directory.
       */
      const { data, error } = await supabase
        .from("locum_directory")
        .select("*")
        .order("surname", {
          ascending: true,
        });

      if (error) {
        console.error(
          "locum_directory Supabase error:",
          error,
        );

        throw new Error(
          `Could not load locum_directory: ${error.message}`,
        );
      }

      const rows = (data || []) as LocumRow[];

      /*
       * Remove completely empty rows if any were accidentally
       * created during CSV import.
       *
       * Do NOT filter by role/account type because imported
       * locums do not use those profile fields.
       */
      const validRows = rows.filter((row) => {
        return Boolean(
          clean(row.first_name) ||
            clean(row.surname) ||
            clean(row.full_name) ||
            clean(row.email) ||
            clean(row.registration_number) ||
            clean(
              row.professional_registration_number,
            ),
        );
      });

      console.log(
        "CareStaffing locum_directory rows:",
        rows.length,
      );

      console.log(
        "CareStaffing valid directory rows:",
        validRows.length,
      );

      setLocums(validRows);
    } catch (error: any) {
      console.error(
        "CareStaffing Locum Directory error:",
        error,
      );

      setLocums([]);

      setLoadError(
        error?.message ||
          "Could not load healthcare professionals.",
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =====================================================
   * FILTER OPTIONS
   * =====================================================
   */

  const professions = useMemo(() => {
    const values = locums
      .map((locum) => clean(locum.profession))
      .filter(Boolean);

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [locums]);

  const provinces = useMemo(() => {
    const values = locums
      .map((locum) => clean(locum.province))
      .filter(Boolean);

    return Array.from(new Set(values)).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [locums]);

  /*
   * =====================================================
   * FILTER DIRECTORY
   * =====================================================
   */

  const filteredLocums = useMemo(() => {
    const searchText = search
      .trim()
      .toLowerCase();

    return locums.filter((locum) => {
      const professionMatches =
        professionFilter === "All" ||
        clean(locum.profession) ===
          professionFilter;

      const provinceMatches =
        provinceFilter === "All" ||
        clean(locum.province) === provinceFilter;

      const available = isAvailable(locum);

      const availabilityMatches =
        availabilityFilter === "All" ||
        (availabilityFilter === "Available" &&
          available) ||
        (availabilityFilter === "Unavailable" &&
          !available);

      const searchable = [
        fullName(locum),
        locum.first_name,
        locum.surname,
        locum.profession,
        registrationNumber(locum),
        locum.practice_number,
        locum.practice_name,
        locum.practice_full_address,
        locum.practice_address,
        locum.suburb,
        locum.city,
        locum.city_area,
        locum.province,
        locum.country,
        locum.email,
        displayPhone(locum.mobile),
      ]
        .map(clean)
        .join(" ")
        .toLowerCase();

      const searchMatches =
        !searchText ||
        searchable.includes(searchText);

      return (
        professionMatches &&
        provinceMatches &&
        availabilityMatches &&
        searchMatches
      );
    });
  }, [
    locums,
    search,
    professionFilter,
    provinceFilter,
    availabilityFilter,
  ]);

  /*
   * =====================================================
   * OPEN EMAIL MODAL
   * =====================================================
   */

  function openEmail(locum: LocumRow) {
    const email = clean(locum.email);

    if (!email) {
      alert(
        "This healthcare professional does not have an email address.",
      );

      return;
    }

    setSelectedLocum(locum);

    setSubject(
      `CareStaffing locum opportunity – ${fullName(
        locum,
      )}`,
    );

    setMessage(
      `Dear ${
        clean(locum.first_name) ||
        "Healthcare Professional"
      },\n\n` +
        `We are contacting you through the CareStaffing healthcare professional directory regarding a potential locum opportunity.\n\n` +
        `Please reply to this email if you are interested or would like further information.\n\n` +
        `Kind regards,\n` +
        `${employerName || "CareStaffing Employer"}`,
    );

    setSendStatus("");
  }

  function closeEmail() {
    if (sending) return;

    setSelectedLocum(null);
    setSubject("");
    setMessage("");
    setSendStatus("");
  }

  /*
   * =====================================================
   * SEND THROUGH /api/locum-email
   * =====================================================
   */

  async function sendEmail(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedLocum) return;

    const to = clean(selectedLocum.email);

    if (!to) {
      setSendStatus(
        "The healthcare professional has no email address.",
      );

      return;
    }

    if (!subject.trim()) {
      setSendStatus(
        "Please enter an email subject.",
      );

      return;
    }

    if (!message.trim()) {
      setSendStatus(
        "Please enter an email message.",
      );

      return;
    }

    try {
      setSending(true);
      setSendStatus("");

      const response = await fetch(
        "/api/locum-email",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            to,
            locumName: fullName(selectedLocum),

            subject: subject.trim(),

            message: message.trim(),

            employerName:
              employerName.trim() ||
              "CareStaffing Employer",

            employerEmail:
              employerEmail.trim(),
          }),
        },
      );

      const result = await response
        .json()
        .catch(() => ({
          success: false,
          error:
            "The server returned an invalid response.",
        }));

      if (!response.ok || !result.success) {
        throw new Error(
          result?.error ||
            `Unable to send email. HTTP ${response.status}`,
        );
      }

      setSendStatus(
        `Email successfully sent to ${fullName(
          selectedLocum,
        )}.`,
      );

      setTimeout(() => {
        setSelectedLocum(null);
        setSubject("");
        setMessage("");
        setSendStatus("");
      }, 1800);
    } catch (error: any) {
      console.error(
        "CareStaffing email error:",
        error,
      );

      setSendStatus(
        error?.message ||
          "Unable to send the email.",
      );
    } finally {
      setSending(false);
    }
  }

  /*
   * =====================================================
   * PAGE
   * =====================================================
   */

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topRow}>
          <div>
            <div style={styles.eyebrow}>
              CARESTAFFING
            </div>

            <h1 style={styles.title}>
              Locum Directory
            </h1>

            <p style={styles.subtitle}>
              Search and contact registered
              healthcare professionals.
            </p>
          </div>

          <button
            type="button"
            onClick={loadDirectory}
            disabled={loading}
            style={{
              ...styles.refreshButton,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* FILTERS */}

        <div style={styles.filters}>
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search name, registration, practice..."
            style={styles.searchInput}
          />

          <select
            value={professionFilter}
            onChange={(event) =>
              setProfessionFilter(
                event.target.value,
              )
            }
            style={styles.select}
          >
            <option value="All">
              All professions
            </option>

            {professions.map((profession) => (
              <option
                key={profession}
                value={profession}
              >
                {profession}
              </option>
            ))}
          </select>

          <select
            value={provinceFilter}
            onChange={(event) =>
              setProvinceFilter(
                event.target.value,
              )
            }
            style={styles.select}
          >
            <option value="All">
              All provinces
            </option>

            {provinces.map((province) => (
              <option
                key={province}
                value={province}
              >
                {province}
              </option>
            ))}
          </select>

          <select
            value={availabilityFilter}
            onChange={(event) =>
              setAvailabilityFilter(
                event.target.value,
              )
            }
            style={styles.select}
          >
            <option value="All">
              All availability
            </option>

            <option value="Available">
              Available
            </option>

            <option value="Unavailable">
              Unavailable
            </option>
          </select>
        </div>

        {/* DIRECTORY */}

        {loading ? (
          <div style={styles.messageBox}>
            Loading healthcare professionals...
          </div>
        ) : loadError ? (
          <div style={styles.errorBox}>
            <strong>
              Locum Directory could not load.
            </strong>

            <div style={{ marginTop: 8 }}>
              {loadError}
            </div>

            <button
              type="button"
              onClick={loadDirectory}
              style={{
                ...styles.refreshButton,
                marginTop: 16,
              }}
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div style={styles.headingRow}>
              <h2 style={styles.sectionTitle}>
                Healthcare Professionals
              </h2>

              <p style={styles.resultCount}>
                Showing {filteredLocums.length} of{" "}
                {locums.length} professionals
              </p>
            </div>

            {filteredLocums.length === 0 ? (
              <div style={styles.messageBox}>
                No healthcare professionals match
                your filters.
              </div>
            ) : (
              <div style={styles.grid}>
                {filteredLocums.map(
                  (locum, index) => {
                    const available =
                      isAvailable(locum);

                    const photo =
                      clean(
                        locum.profile_photo_url,
                      ) ||
                      clean(locum.avatar_url);

                    return (
                      <article
                        key={`${locum.id}-${index}`}
                        style={styles.card}
                      >
                        <div
                          style={
                            styles.profileTop
                          }
                        >
                          {photo ? (
                            <img
                              src={photo}
                              alt={fullName(
                                locum,
                              )}
                              style={
                                styles.avatarImage
                              }
                            />
                          ) : (
                            <div
                              style={
                                styles.avatar
                              }
                            >
                              {initials(locum)}
                            </div>
                          )}

                          <div
                            style={
                              styles.nameArea
                            }
                          >
                            <div
                              style={
                                styles.nameRow
                              }
                            >
                              <h3
                                style={
                                  styles.name
                                }
                              >
                                {fullName(
                                  locum,
                                )}
                              </h3>

                              <span
                                style={{
                                  ...styles.statusBadge,

                                  ...(available
                                    ? styles.availableBadge
                                    : styles.unavailableBadge),
                                }}
                              >
                                {available
                                  ? "AVAILABLE"
                                  : "UNAVAILABLE"}
                              </span>
                            </div>

                            <div
                              style={
                                styles.profession
                              }
                            >
                              {clean(
                                locum.profession,
                              ) ||
                                "Healthcare Professional"}
                            </div>
                          </div>
                        </div>

                        <div
                          style={styles.details}
                        >
                          <Detail
                            label="Registration"
                            value={registrationNumber(
                              locum,
                            )}
                          />

                          <Detail
                            label="Province"
                            value={
                              clean(
                                locum.province,
                              ) || "-"
                            }
                          />

                          <Detail
                            label="Location"
                            value={displayLocation(
                              locum,
                            )}
                          />

                          <Detail
                            label="Practice"
                            value={displayPractice(
                              locum,
                            )}
                          />

                          <Detail
                            label="Mobile"
                            value={displayPhone(
                              locum.mobile,
                            )}
                          />

                          <Detail
                            label="Email"
                            value={
                              clean(
                                locum.email,
                              ) || "-"
                            }
                          />
                        </div>

                        <div
                          style={styles.actions}
                        >
                          <button
                            type="button"
                            disabled={
                              !clean(
                                locum.mobile,
                              )
                            }
                            onClick={() => {
                              const phone =
                                normalizePhone(
                                  locum.mobile,
                                );

                              if (!phone) return;

                              window.location.href =
                                `tel:${phone}`;
                            }}
                            style={{
                              ...styles.callButton,

                              opacity: clean(
                                locum.mobile,
                              )
                                ? 1
                                : 0.45,
                            }}
                          >
                            Call
                          </button>

                          <button
                            type="button"
                            disabled={
                              !clean(locum.email)
                            }
                            onClick={() =>
                              openEmail(locum)
                            }
                            style={{
                              ...styles.emailButton,

                              opacity: clean(
                                locum.email,
                              )
                                ? 1
                                : 0.45,
                            }}
                          >
                            Email
                          </button>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* EMAIL MODAL */}

      {selectedLocum && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <div
                  style={styles.modalEyebrow}
                >
                  CONTACT LOCUM
                </div>

                <h2 style={styles.modalTitle}>
                  Email{" "}
                  {fullName(selectedLocum)}
                </h2>

                <p style={styles.modalEmail}>
                  {clean(selectedLocum.email)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEmail}
                disabled={sending}
                style={styles.closeButton}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={sendEmail}>
              <label style={styles.label}>
                From
              </label>

              <div
                style={styles.readOnlyField}
              >
                CareStaffing
                &lt;info@care-staffing.com&gt;
              </div>

              <label style={styles.label}>
                Reply-to
              </label>

              <input
                type="email"
                value={employerEmail}
                onChange={(event) =>
                  setEmployerEmail(
                    event.target.value,
                  )
                }
                placeholder="Employer email address"
                style={styles.modalInput}
              />

              <label style={styles.label}>
                Subject
              </label>

              <input
                value={subject}
                onChange={(event) =>
                  setSubject(
                    event.target.value,
                  )
                }
                style={styles.modalInput}
                required
              />

              <label style={styles.label}>
                Message
              </label>

              <textarea
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value,
                  )
                }
                rows={10}
                style={styles.textarea}
                required
              />

              {sendStatus && (
                <div
                  style={
                    sendStatus
                      .toLowerCase()
                      .includes(
                        "successfully",
                      )
                      ? styles.successMessage
                      : styles.modalError
                  }
                >
                  {sendStatus}
                </div>
              )}

              <div
                style={styles.modalActions}
              >
                <button
                  type="button"
                  onClick={closeEmail}
                  disabled={sending}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    ...styles.sendButton,
                    opacity: sending
                      ? 0.65
                      : 1,
                  }}
                >
                  {sending
                    ? "Sending..."
                    : "Send Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailLabel}>
        {label}
      </span>

      <span style={styles.detailValue}>
        {value}
      </span>
    </div>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f7faf8",
    padding: "34px 18px 60px",
    fontFamily:
      "Inter, Arial, Helvetica, sans-serif",
    color: "#17251e",
  },

  container: {
    maxWidth: 1450,
    margin: "0 auto",
  },

  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "center",
    marginBottom: 28,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.5,
    color: "#057a55",
    marginBottom: 5,
  },

  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 800,
  },

  subtitle: {
    color: "#67746d",
    marginTop: 8,
    marginBottom: 0,
  },

  refreshButton: {
    border: "1px solid #d5dfd9",
    background: "#fff",
    borderRadius: 10,
    padding: "11px 18px",
    cursor: "pointer",
    fontWeight: 700,
  },

  filters: {
    display: "grid",
    gridTemplateColumns:
      "minmax(260px, 1.6fr) repeat(3, minmax(170px, 1fr))",
    gap: 14,
    marginBottom: 34,
  },

  searchInput: {
    width: "100%",
    height: 48,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #d8e0dc",
    fontSize: 15,
    background: "#fff",
    boxSizing: "border-box",
  },

  select: {
    height: 48,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #d8e0dc",
    background: "#fff",
    fontSize: 15,
  },

  headingRow: {
    marginBottom: 22,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 27,
    fontWeight: 800,
  },

  resultCount: {
    margin: "5px 0 0",
    color: "#69756f",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(370px, 1fr))",
    gap: 18,
  },

  card: {
    background: "#fff",
    border: "1px solid #e1e8e4",
    borderRadius: 16,
    padding: 24,
    boxShadow:
      "0 5px 18px rgba(0,0,0,0.035)",
  },

  profileTop: {
    display: "flex",
    gap: 16,
    marginBottom: 22,
    alignItems: "flex-start",
  },

  avatar: {
    width: 62,
    height: 62,
    borderRadius: "50%",
    background: "#dff1e8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 18,
    color: "#075c40",
    flexShrink: 0,
  },

  avatarImage: {
    width: 62,
    height: 62,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
  },

  nameArea: {
    flex: 1,
    minWidth: 0,
  },

  nameRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },

  name: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
  },

  profession: {
    marginTop: 6,
    color: "#087351",
    fontWeight: 700,
  },

  statusBadge: {
    padding: "5px 9px",
    borderRadius: 100,
    fontSize: 10,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  availableBadge: {
    background: "#e5f8ed",
    color: "#18864c",
  },

  unavailableBadge: {
    background: "#f1f1f1",
    color: "#777",
  },

  details: {
    display: "flex",
    flexDirection: "column",
    gap: 11,
    marginBottom: 24,
  },

  detailRow: {
    display: "grid",
    gridTemplateColumns: "128px 1fr",
    gap: 12,
    fontSize: 14,
  },

  detailLabel: {
    fontWeight: 700,
    color: "#69746f",
  },

  detailValue: {
    color: "#28342e",
    overflowWrap: "anywhere",
  },

  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  callButton: {
    minHeight: 46,
    borderRadius: 9,
    border: "1px solid #d8e0dc",
    background: "#fff",
    color: "#075c40",
    fontWeight: 800,
    cursor: "pointer",
  },

  emailButton: {
    minHeight: 46,
    borderRadius: 9,
    border: "none",
    background: "#087153",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },

  messageBox: {
    padding: 30,
    background: "#fff",
    border: "1px solid #e0e7e3",
    borderRadius: 14,
    textAlign: "center",
  },

  errorBox: {
    padding: 18,
    borderRadius: 10,
    background: "#fff2f2",
    border: "1px solid #f3caca",
    color: "#a22e2e",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(10,20,15,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 9999,
  },

  modal: {
    background: "#fff",
    width: "100%",
    maxWidth: 650,
    maxHeight: "92vh",
    overflowY: "auto",
    borderRadius: 18,
    padding: 28,
    boxShadow:
      "0 30px 70px rgba(0,0,0,0.25)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    marginBottom: 24,
  },

  modalEyebrow: {
    color: "#087153",
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 1.4,
  },

  modalTitle: {
    margin: "6px 0 4px",
    fontSize: 24,
  },

  modalEmail: {
    margin: 0,
    color: "#69756f",
    fontSize: 14,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: "1px solid #ddd",
    background: "#fff",
    fontSize: 25,
    cursor: "pointer",
  },

  label: {
    display: "block",
    marginBottom: 7,
    marginTop: 16,
    fontSize: 13,
    fontWeight: 800,
  },

  readOnlyField: {
    border: "1px solid #dce4e0",
    background: "#f5f8f6",
    padding: "13px 14px",
    borderRadius: 9,
    color: "#526159",
  },

  modalInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d6dfda",
    borderRadius: 9,
    padding: "13px 14px",
    fontSize: 15,
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 190,
    border: "1px solid #d6dfda",
    borderRadius: 9,
    padding: 14,
    fontSize: 15,
    fontFamily: "inherit",
    lineHeight: 1.5,
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },

  cancelButton: {
    padding: "12px 18px",
    borderRadius: 9,
    border: "1px solid #d3ddd7",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },

  sendButton: {
    padding: "12px 22px",
    borderRadius: 9,
    border: "none",
    background: "#087153",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },

  successMessage: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    background: "#e9f8ee",
    color: "#167844",
    fontWeight: 700,
  },

  modalError: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    background: "#fff0f0",
    color: "#a22e2e",
    fontWeight: 700,
  },
};
