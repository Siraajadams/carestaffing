"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Locum = {
  id: number;
  created_at?: string | null;

  first_name?: string | null;
  surname?: string | null;
  full_name?: string | null;

  profession?: string | null;

  email?: string | null;
  mobile?: string | null;

  registration_number?: string | null;
  practice_number?: string | null;

  practice_name?: string | null;
  practice_address?: string | null;
  practice_full_address?: string | null;

  suburb?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;

  qualifications?: string | null;
  skills?: string | null;

  pimart_permit?: boolean | null;
  pcdt_permit?: boolean | null;

  available_for_locum?: boolean | null;
};

function clean(value?: string | null) {
  return value?.trim() || "";
}

function displayName(locum: Locum) {
  if (clean(locum.full_name)) return clean(locum.full_name);

  return `${clean(locum.first_name)} ${clean(locum.surname)}`.trim();
}

function normaliseProfession(value?: string | null) {
  const profession = clean(value);

  if (!profession) return "Healthcare Professional";

  if (profession.toLowerCase().includes("pcdt")) {
    return "Pharmacist";
  }

  return profession;
}

export default function EmployerLocumDirectoryPage() {
  const [locums, setLocums] = useState<Locum[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [profession, setProfession] = useState("All");
  const [province, setProvince] = useState("All");
  const [permit, setPermit] = useState("All");
  const [availability, setAvailability] = useState("Available");

  useEffect(() => {
    loadLocums();
  }, []);

  async function loadLocums() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please sign in to access the Locum Directory.");
        setLoading(false);
        return;
      }

      /*
        IMPORTANT:
        Your Supabase table currently uses the mixed-case name:
        Locum_Directory

        Therefore keep this exactly as:
        .from("Locum_Directory")
      */
      const { data, error } = await supabase
        .from("Locum_Directory")
        .select(`
          id,
          created_at,
          first_name,
          surname,
          full_name,
          profession,
          email,
          mobile,
          registration_number,
          practice_number,
          practice_name,
          practice_address,
          practice_full_address,
          suburb,
          city,
          province,
          postal_code,
          country,
          qualifications,
          skills,
          pimart_permit,
          pcdt_permit,
          available_for_locum
        `)
        .order("surname", { ascending: true })
        .order("first_name", { ascending: true });

      if (error) {
        console.error("Locum Directory error:", error);
        setMessage(`Could not load Locum Directory: ${error.message}`);
        setLoading(false);
        return;
      }

      setLocums((data || []) as Locum[]);
    } catch (error) {
      console.error(error);
      setMessage("An unexpected error occurred while loading the directory.");
    } finally {
      setLoading(false);
    }
  }

  const professions = useMemo(() => {
    const values = Array.from(
      new Set(
        locums
          .map((locum) => normaliseProfession(locum.profession))
          .filter(Boolean),
      ),
    ).sort();

    return ["All", ...values];
  }, [locums]);

  const provinces = useMemo(() => {
    const values = Array.from(
      new Set(
        locums
          .map((locum) => clean(locum.province))
          .filter(Boolean),
      ),
    ).sort();

    return ["All", ...values];
  }, [locums]);

  const filteredLocums = useMemo(() => {
    const term = search.trim().toLowerCase();

    return locums.filter((locum) => {
      const name = displayName(locum).toLowerCase();
      const professionName = normaliseProfession(
        locum.profession,
      ).toLowerCase();

      const searchableText = [
        name,
        clean(locum.email),
        clean(locum.mobile),
        clean(locum.registration_number),
        clean(locum.practice_number),
        clean(locum.practice_name),
        clean(locum.practice_full_address),
        clean(locum.city),
        clean(locum.province),
        professionName,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || searchableText.includes(term);

      const matchesProfession =
        profession === "All" ||
        professionName === profession.toLowerCase();

      const matchesProvince =
        province === "All" ||
        clean(locum.province) === province;

      let matchesPermit = true;

      if (permit === "PIMART") {
        matchesPermit = locum.pimart_permit === true;
      }

      if (permit === "PCDT") {
        matchesPermit = locum.pcdt_permit === true;
      }

      if (permit === "PIMART or PCDT") {
        matchesPermit =
          locum.pimart_permit === true ||
          locum.pcdt_permit === true;
      }

      let matchesAvailability = true;

      if (availability === "Available") {
        matchesAvailability =
          locum.available_for_locum !== false;
      }

      if (availability === "Unavailable") {
        matchesAvailability =
          locum.available_for_locum === false;
      }

      return (
        matchesSearch &&
        matchesProfession &&
        matchesProvince &&
        matchesPermit &&
        matchesAvailability
      );
    });
  }, [
    locums,
    search,
    profession,
    province,
    permit,
    availability,
  ]);

  function clearFilters() {
    setSearch("");
    setProfession("All");
    setProvince("All");
    setPermit("All");
    setAvailability("Available");
  }

  if (loading) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading Locum Directory...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* HEADER */}
        <div style={styles.topBar}>
          <div>
            <p style={styles.eyebrow}>CARESTAFFING</p>

            <h1 style={styles.heading}>Locum Directory</h1>

            <p style={styles.subheading}>
              Search verified healthcare professionals available for locum
              opportunities.
            </p>
          </div>

          <div style={styles.headerButtons}>
            <Link href="/employer" style={styles.secondaryButton}>
              Employer Dashboard
            </Link>

            <Link
              href="/employer/shifts"
              style={styles.primaryButton}
            >
              My Shifts
            </Link>
          </div>
        </div>

        {/* SUMMARY */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>Directory</span>
            <strong style={styles.statNumber}>{locums.length}</strong>
            <span style={styles.statDescription}>
              Registered professionals
            </span>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>Results</span>
            <strong style={styles.statNumber}>
              {filteredLocums.length}
            </strong>
            <span style={styles.statDescription}>
              Matching your filters
            </span>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>Pharmacists</span>
            <strong style={styles.statNumber}>
              {
                locums.filter((locum) =>
                  normaliseProfession(locum.profession)
                    .toLowerCase()
                    .includes("pharmacist"),
                ).length
              }
            </strong>
            <span style={styles.statDescription}>
              In the directory
            </span>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>Nurses</span>
            <strong style={styles.statNumber}>
              {
                locums.filter((locum) =>
                  normaliseProfession(locum.profession)
                    .toLowerCase()
                    .includes("nurse"),
                ).length
              }
            </strong>
            <span style={styles.statDescription}>
              In the directory
            </span>
          </div>
        </div>

        {/* FILTERS */}
        <section style={styles.filterCard}>
          <div style={styles.searchRow}>
            <div style={styles.searchWrapper}>
              <span style={styles.searchIcon}>⌕</span>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search name, registration number, practice, city..."
                style={styles.searchInput}
              />
            </div>

            <button
              type="button"
              onClick={clearFilters}
              style={styles.clearButton}
            >
              Clear filters
            </button>
          </div>

          <div style={styles.filters}>
            <label style={styles.filterGroup}>
              <span style={styles.filterLabel}>Profession</span>

              <select
                value={profession}
                onChange={(event) =>
                  setProfession(event.target.value)
                }
                style={styles.select}
              >
                {professions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label style={styles.filterGroup}>
              <span style={styles.filterLabel}>Province</span>

              <select
                value={province}
                onChange={(event) =>
                  setProvince(event.target.value)
                }
                style={styles.select}
              >
                {provinces.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label style={styles.filterGroup}>
              <span style={styles.filterLabel}>Permit</span>

              <select
                value={permit}
                onChange={(event) =>
                  setPermit(event.target.value)
                }
                style={styles.select}
              >
                <option>All</option>
                <option>PIMART</option>
                <option>PCDT</option>
                <option>PIMART or PCDT</option>
              </select>
            </label>

            <label style={styles.filterGroup}>
              <span style={styles.filterLabel}>Availability</span>

              <select
                value={availability}
                onChange={(event) =>
                  setAvailability(event.target.value)
                }
                style={styles.select}
              >
                <option>Available</option>
                <option>All</option>
                <option>Unavailable</option>
              </select>
            </label>
          </div>
        </section>

        {message && <div style={styles.errorBox}>{message}</div>}

        {/* RESULTS */}
        <div style={styles.resultsHeader}>
          <div>
            <h2 style={styles.resultsTitle}>
              Healthcare Professionals
            </h2>

            <p style={styles.resultsText}>
              {filteredLocums.length} result
              {filteredLocums.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {filteredLocums.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🔎</div>
            <h3 style={styles.emptyTitle}>No locums found</h3>
            <p style={styles.emptyText}>
              Try changing your search or filters.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              style={styles.primaryButton}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div style={styles.cardsGrid}>
            {filteredLocums.map((locum) => {
              const name =
                displayName(locum) || "Healthcare Professional";

              const professionText =
                normaliseProfession(locum.profession);

              return (
                <article key={locum.id} style={styles.locumCard}>
                  <div style={styles.cardTop}>
                    <div style={styles.avatar}>
                      {clean(locum.first_name)
                        .charAt(0)
                        .toUpperCase()}
                      {clean(locum.surname)
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div style={{ flex: 1 }}>
                      <h3 style={styles.name}>{name}</h3>

                      <div style={styles.badgeRow}>
                        <span style={styles.professionBadge}>
                          {professionText}
                        </span>

                        {locum.pimart_permit && (
                          <span style={styles.permitBadge}>
                            PIMART
                          </span>
                        )}

                        {locum.pcdt_permit && (
                          <span style={styles.permitBadge}>
                            PCDT
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      style={
                        locum.available_for_locum === false
                          ? styles.unavailableDot
                          : styles.availableDot
                      }
                      title={
                        locum.available_for_locum === false
                          ? "Unavailable"
                          : "Available for locum work"
                      }
                    />
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.details}>
                    {clean(locum.registration_number) && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>
                          Registration
                        </span>
                        <span style={styles.detailValue}>
                          {locum.registration_number}
                        </span>
                      </div>
                    )}

                    {clean(locum.practice_name) && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>
                          Practice
                        </span>
                        <span style={styles.detailValue}>
                          {locum.practice_name}
                        </span>
                      </div>
                    )}

                    {(clean(locum.city) ||
                      clean(locum.province)) && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>
                          Location
                        </span>
                        <span style={styles.detailValue}>
                          {[locum.city, locum.province]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    )}

                    {!clean(locum.city) &&
                      !clean(locum.province) &&
                      clean(locum.practice_full_address) && (
                        <div style={styles.detailRow}>
                          <span style={styles.detailLabel}>
                            Location
                          </span>

                          <span style={styles.detailValue}>
                            {locum.practice_full_address}
                          </span>
                        </div>
                      )}

                    {clean(locum.mobile) && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>
                          Mobile
                        </span>
                        <span style={styles.detailValue}>
                          {locum.mobile}
                        </span>
                      </div>
                    )}

                    {clean(locum.email) && (
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>
                          Email
                        </span>
                        <span
                          style={{
                            ...styles.detailValue,
                            wordBreak: "break-word",
                          }}
                        >
                          {locum.email}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={styles.cardActions}>
                    {clean(locum.mobile) ? (
                      <a
                        href={`tel:${locum.mobile}`}
                        style={styles.contactButton}
                      >
                        Call
                      </a>
                    ) : (
                      <button
                        disabled
                        style={styles.disabledButton}
                      >
                        Call
                      </button>
                    )}

                    {clean(locum.email) ? (
                      <a
                        href={`mailto:${locum.email}`}
                        style={styles.contactButton}
                      >
                        Email
                      </a>
                    ) : (
                      <button
                        disabled
                        style={styles.disabledButton}
                      >
                        Email
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f4fbf8 0%, #f7f9fc 40%, #ffffff 100%)",
    padding: "34px 18px 60px",
    fontFamily:
      "Inter, Arial, Helvetica, sans-serif",
    color: "#14221d",
  },

  container: {
    width: "100%",
    maxWidth: 1400,
    margin: "0 auto",
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 22,
    marginBottom: 28,
  },

  eyebrow: {
    margin: "0 0 7px",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 2.2,
    color: "#087f5b",
  },

  heading: {
    margin: 0,
    fontSize: 38,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: -1,
  },

  subheading: {
    margin: "10px 0 0",
    color: "#61706a",
    fontSize: 16,
    maxWidth: 650,
    lineHeight: 1.6,
  },

  headerButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 10,
    border: "1px solid #087f5b",
    background: "#087f5b",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 800,
    textDecoration: "none",
    cursor: "pointer",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "0 18px",
    borderRadius: 10,
    border: "1px solid #d7e1dd",
    background: "#ffffff",
    color: "#21322c",
    fontSize: 14,
    fontWeight: 800,
    textDecoration: "none",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },

  statCard: {
    background: "#ffffff",
    padding: 20,
    borderRadius: 14,
    border: "1px solid #e1e9e6",
    boxShadow: "0 7px 24px rgba(23, 50, 41, 0.05)",
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },

  statLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#78857f",
    fontWeight: 800,
  },

  statNumber: {
    fontSize: 31,
    lineHeight: 1.1,
    color: "#0b664c",
  },

  statDescription: {
    fontSize: 13,
    color: "#75837d",
  },

  filterCard: {
    background: "#ffffff",
    border: "1px solid #e1e9e6",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 7px 24px rgba(23, 50, 41, 0.05)",
    marginBottom: 28,
  },

  searchRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 17,
  },

  searchWrapper: {
    position: "relative",
    flex: "1 1 500px",
  },

  searchIcon: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#75837d",
    fontSize: 21,
  },

  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 48,
    borderRadius: 11,
    border: "1px solid #d8e2de",
    background: "#fbfdfc",
    padding: "0 14px 0 43px",
    outline: "none",
    fontSize: 14,
    color: "#1c2d27",
  },

  clearButton: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #d8e2de",
    background: "#ffffff",
    color: "#4d5d57",
    fontWeight: 800,
    cursor: "pointer",
  },

  filters: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 13,
  },

  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  filterLabel: {
    fontSize: 12,
    fontWeight: 800,
    color: "#66756f",
  },

  select: {
    minHeight: 44,
    border: "1px solid #d8e2de",
    borderRadius: 10,
    padding: "0 11px",
    background: "#ffffff",
    fontSize: 14,
    color: "#20312b",
    outline: "none",
  },

  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    margin: "4px 2px 15px",
  },

  resultsTitle: {
    margin: 0,
    fontSize: 21,
    fontWeight: 900,
  },

  resultsText: {
    margin: "5px 0 0",
    color: "#74817c",
    fontSize: 13,
  },

  cardsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 16,
  },

  locumCard: {
    background: "#ffffff",
    border: "1px solid #e0e9e5",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 8px 28px rgba(18, 55, 42, 0.06)",
  },

  cardTop: {
    display: "flex",
    gap: 13,
    alignItems: "flex-start",
  },

  avatar: {
    width: 50,
    height: 50,
    flex: "0 0 50px",
    borderRadius: "50%",
    background:
      "linear-gradient(135deg, #d9f8ec 0%, #b7ebd7 100%)",
    color: "#087f5b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: 900,
    border: "1px solid #bee8d8",
  },

  name: {
    margin: "2px 0 8px",
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.2,
  },

  badgeRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },

  professionBadge: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "#edf8f4",
    color: "#087f5b",
    fontSize: 11,
    fontWeight: 800,
  },

  permitBadge: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "#f4f0ff",
    color: "#6741d9",
    fontSize: 11,
    fontWeight: 900,
  },

  availableDot: {
    width: 11,
    height: 11,
    borderRadius: "50%",
    background: "#2f9e44",
    boxShadow: "0 0 0 4px #e7f7ea",
    marginTop: 8,
  },

  unavailableDot: {
    width: 11,
    height: 11,
    borderRadius: "50%",
    background: "#adb5bd",
    boxShadow: "0 0 0 4px #f1f3f5",
    marginTop: 8,
  },

  divider: {
    height: 1,
    background: "#eef2f0",
    margin: "17px 0",
  },

  details: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 105,
  },

  detailRow: {
    display: "grid",
    gridTemplateColumns: "105px 1fr",
    gap: 9,
    alignItems: "start",
  },

  detailLabel: {
    fontSize: 12,
    color: "#84908b",
    fontWeight: 700,
  },

  detailValue: {
    fontSize: 13,
    color: "#293a34",
    fontWeight: 650,
    lineHeight: 1.4,
  },

  cardActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
    marginTop: 18,
  },

  contactButton: {
    minHeight: 41,
    borderRadius: 9,
    background: "#f2faf7",
    border: "1px solid #cfe8df",
    color: "#087f5b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
  },

  disabledButton: {
    minHeight: 41,
    borderRadius: 9,
    background: "#f4f5f5",
    border: "1px solid #e2e5e4",
    color: "#a1aaa6",
    fontSize: 13,
    fontWeight: 800,
  },

  emptyState: {
    background: "#ffffff",
    padding: "60px 20px",
    border: "1px solid #e1e9e6",
    borderRadius: 16,
    textAlign: "center",
  },

  emptyIcon: {
    fontSize: 35,
    marginBottom: 12,
  },

  emptyTitle: {
    margin: "0 0 8px",
    fontSize: 20,
  },

  emptyText: {
    margin: "0 0 20px",
    color: "#74817c",
  },

  errorBox: {
    padding: 14,
    borderRadius: 10,
    border: "1px solid #ffc9c9",
    background: "#fff5f5",
    color: "#c92a2a",
    fontWeight: 700,
    marginBottom: 18,
  },

  loadingPage: {
    minHeight: "100vh",
    background: "#f6faf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
  },

  loadingCard: {
    background: "#ffffff",
    border: "1px solid #e3eae7",
    borderRadius: 15,
    padding: "28px 40px",
    textAlign: "center",
  },

  spinner: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "3px solid #dcece6",
    borderTop: "3px solid #087f5b",
    margin: "0 auto 15px",
  },

  loadingText: {
    margin: 0,
    color: "#607069",
    fontWeight: 700,
  },
};
