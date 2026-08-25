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

function getFullName(locum: Locum) {
  if (clean(locum.full_name)) {
    return clean(locum.full_name);
  }

  return `${clean(locum.first_name)} ${clean(locum.surname)}`.trim();
}

function getProfession(locum: Locum) {
  const value = clean(locum.profession);

  if (!value) {
    return "Healthcare Professional";
  }

  if (value.toLowerCase().includes("pcdt")) {
    return "Pharmacist";
  }

  return value;
}

export default function LocumDirectoryPage() {
  const [locums, setLocums] = useState<Locum[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [professionFilter, setProfessionFilter] = useState("All");
  const [provinceFilter, setProvinceFilter] = useState("All");
  const [permitFilter, setPermitFilter] = useState("All");
  const [availabilityFilter, setAvailabilityFilter] =
    useState("Available");

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
        setMessage("Please log in to view the Locum Directory.");
        setLoading(false);
        return;
      }

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
        console.error("Locum directory error:", error);

        setMessage(
          `Unable to load Locum Directory: ${error.message}`,
        );

        setLoading(false);
        return;
      }

      setLocums((data || []) as Locum[]);
    } catch (error) {
      console.error(error);

      setMessage(
        "An unexpected error occurred while loading the Locum Directory.",
      );
    } finally {
      setLoading(false);
    }
  }

  const professionOptions = useMemo(() => {
    const values = locums
      .map((locum) => getProfession(locum))
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [locums]);

  const provinceOptions = useMemo(() => {
    const values = locums
      .map((locum) => clean(locum.province))
      .filter(Boolean);

    return ["All", ...Array.from(new Set(values)).sort()];
  }, [locums]);

  const filteredLocums = useMemo(() => {
    const term = search.trim().toLowerCase();

    return locums.filter((locum) => {
      const name = getFullName(locum).toLowerCase();
      const profession = getProfession(locum);
      const province = clean(locum.province);

      const searchable = [
        name,
        profession,
        province,
        clean(locum.city),
        clean(locum.suburb),
        clean(locum.registration_number),
        clean(locum.practice_number),
        clean(locum.practice_name),
        clean(locum.practice_full_address),
        clean(locum.email),
        clean(locum.mobile),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        term === "" || searchable.includes(term);

      const matchesProfession =
        professionFilter === "All" ||
        profession.toLowerCase() ===
          professionFilter.toLowerCase();

      const matchesProvince =
        provinceFilter === "All" ||
        province.toLowerCase() ===
          provinceFilter.toLowerCase();

      let matchesPermit = true;

      if (permitFilter === "PIMART") {
        matchesPermit = locum.pimart_permit === true;
      }

      if (permitFilter === "PCDT") {
        matchesPermit = locum.pcdt_permit === true;
      }

      if (permitFilter === "PIMART or PCDT") {
        matchesPermit =
          locum.pimart_permit === true ||
          locum.pcdt_permit === true;
      }

      let matchesAvailability = true;

      if (availabilityFilter === "Available") {
        matchesAvailability =
          locum.available_for_locum !== false;
      }

      if (availabilityFilter === "Unavailable") {
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
    professionFilter,
    provinceFilter,
    permitFilter,
    availabilityFilter,
  ]);

  function clearFilters() {
    setSearch("");
    setProfessionFilter("All");
    setProvinceFilter("All");
    setPermitFilter("All");
    setAvailabilityFilter("Available");
  }

  const pharmacistCount = locums.filter((locum) =>
    getProfession(locum)
      .toLowerCase()
      .includes("pharmacist"),
  ).length;

  const nurseCount = locums.filter((locum) =>
    getProfession(locum)
      .toLowerCase()
      .includes("nurse"),
  ).length;

  if (loading) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <h2 style={{ margin: 0 }}>
            Loading Locum Directory...
          </h2>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* TOP NAVIGATION */}

        <div style={styles.navigation}>
          <div style={styles.brand}>
            CARESTAFFING
          </div>

          <div style={styles.navLinks}>
            <Link
              href="/employer/post-shift"
              style={styles.navLink}
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
              style={styles.activeNavLink}
            >
              Locum Directory
            </Link>

            <Link
              href="/employer/profile"
              style={styles.navLink}
            >
              Organisation Profile
            </Link>
          </div>
        </div>

        {/* HERO */}

        <section style={styles.hero}>
          <div style={styles.heroLabel}>
            EMPLOYER PORTAL
          </div>

          <h1 style={styles.heroTitle}>
            Locum Directory
          </h1>

          <p style={styles.heroText}>
            Search healthcare professionals by profession,
            province, registration number and permit status.
          </p>
        </section>

        {/* STATS */}

        <section style={styles.statsGrid}>
          <div style={styles.statCard}>
            <span style={styles.statLabel}>
              Total Directory
            </span>

            <strong style={styles.statNumber}>
              {locums.length}
            </strong>

            <span style={styles.statText}>
              Healthcare professionals
            </span>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>
              Search Results
            </span>

            <strong style={styles.statNumber}>
              {filteredLocums.length}
            </strong>

            <span style={styles.statText}>
              Matching professionals
            </span>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>
              Pharmacists
            </span>

            <strong style={styles.statNumber}>
              {pharmacistCount}
            </strong>

            <span style={styles.statText}>
              Directory pharmacists
            </span>
          </div>

          <div style={styles.statCard}>
            <span style={styles.statLabel}>
              Nurses
            </span>

            <strong style={styles.statNumber}>
              {nurseCount}
            </strong>

            <span style={styles.statText}>
              Directory nurses
            </span>
          </div>
        </section>

        {/* SEARCH + FILTERS */}

        <section style={styles.filterPanel}>
          <div style={styles.searchRow}>
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name, registration number, practice, city..."
              style={styles.searchInput}
            />

            <button
              type="button"
              onClick={clearFilters}
              style={styles.clearButton}
            >
              Clear Filters
            </button>
          </div>

          <div style={styles.filterGrid}>
            {/* PROFESSION */}

            <label style={styles.filterGroup}>
              <span style={styles.filterLabel}>
                Profession
              </span>

              <select
                value={professionFilter}
                onChange={(event) =>
                  setProfessionFilter(event.target.value)
                }
                style={styles.select}
              >
                {professionOptions.map((profession) => (
                  <option
                    key={profession}
                    value={profession}
                  >
                    {profession}
                  </option>
                ))}
              </select>
            </label>

            {/* PROVINCE */}

            <label style={styles.filterGroup}>
              <span style={styles.filterLabel}>
                Province
              </span>

              <select
                value={provinceFilter}
                onChange={(event) =>
                  setProvinceFilter(event.target.value)
                }
                style={styles.select}
              >
                {provinceOptions.map((province) => (
                  <option
                    key={province}
                    value={province}
                  >
                    {province}
                  </option>
                ))}
              </select>
            </label>

            {/* PERMIT */}

            <label style={styles.filterGroup}>
              <span style={styles.filterLabel}>
                Permit
              </span>

              <select
                value={permitFilter}
                onChange={(event) =>
                  setPermitFilter(event.target.value)
                }
                style={styles.select}
              >
                <option value="All">
                  All Permits
                </option>

                <option value="PIMART">
                  PIMART
                </option>

                <option value="PCDT">
                  PCDT
                </option>

                <option value="PIMART or PCDT">
                  PIMART or PCDT
                </option>
              </select>
            </label>

            {/* AVAILABILITY */}

            <label style={styles.filterGroup}>
              <span style={styles.filterLabel}>
                Availability
              </span>

              <select
                value={availabilityFilter}
                onChange={(event) =>
                  setAvailabilityFilter(
                    event.target.value,
                  )
                }
                style={styles.select}
              >
                <option value="Available">
                  Available
                </option>

                <option value="All">
                  All
                </option>

                <option value="Unavailable">
                  Unavailable
                </option>
              </select>
            </label>
          </div>
        </section>

        {message && (
          <div style={styles.errorBox}>
            {message}
          </div>
        )}

        {/* RESULTS HEADER */}

        <div style={styles.resultsHeader}>
          <div>
            <h2 style={styles.resultsTitle}>
              Healthcare Professionals
            </h2>

            <p style={styles.resultsSubtitle}>
              Showing {filteredLocums.length} of{" "}
              {locums.length} professionals
            </p>
          </div>
        </div>

        {/* LOCUM CARDS */}

        {filteredLocums.length === 0 ? (
          <div style={styles.emptyCard}>
            <h3 style={styles.emptyTitle}>
              No professionals found
            </h3>

            <p style={styles.emptyText}>
              Try changing the profession, province or
              search filters.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              style={styles.primaryButton}
            >
              Show All Locums
            </button>
          </div>
        ) : (
          <div style={styles.cardGrid}>
            {filteredLocums.map((locum) => {
              const fullName =
                getFullName(locum) ||
                "Healthcare Professional";

              const profession =
                getProfession(locum);

              const location = [
                clean(locum.city),
                clean(locum.province),
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <article
                  key={locum.id}
                  style={styles.card}
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.avatar}>
                      {clean(locum.first_name)
                        .charAt(0)
                        .toUpperCase()}

                      {clean(locum.surname)
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div style={{ flex: 1 }}>
                      <h3 style={styles.name}>
                        {fullName}
                      </h3>

                      <div style={styles.badgeRow}>
                        <span
                          style={styles.professionBadge}
                        >
                          {profession}
                        </span>

                        {locum.pimart_permit === true && (
                          <span
                            style={styles.permitBadge}
                          >
                            PIMART
                          </span>
                        )}

                        {locum.pcdt_permit === true && (
                          <span
                            style={styles.permitBadge}
                          >
                            PCDT
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      {locum.available_for_locum !== false ? (
                        <span
                          style={styles.availableBadge}
                        >
                          AVAILABLE
                        </span>
                      ) : (
                        <span
                          style={styles.unavailableBadge}
                        >
                          UNAVAILABLE
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.details}>
                    {clean(
                      locum.registration_number,
                    ) && (
                      <div style={styles.detailRow}>
                        <span
                          style={styles.detailLabel}
                        >
                          Registration
                        </span>

                        <strong
                          style={styles.detailValue}
                        >
                          {
                            locum.registration_number
                          }
                        </strong>
                      </div>
                    )}

                    {clean(locum.province) && (
                      <div style={styles.detailRow}>
                        <span
                          style={styles.detailLabel}
                        >
                          Province
                        </span>

                        <span
                          style={styles.detailValue}
                        >
                          {locum.province}
                        </span>
                      </div>
                    )}

                    {location && (
                      <div style={styles.detailRow}>
                        <span
                          style={styles.detailLabel}
                        >
                          Location
                        </span>

                        <span
                          style={styles.detailValue}
                        >
                          {location}
                        </span>
                      </div>
                    )}

                    {clean(
                      locum.practice_name,
                    ) && (
                      <div style={styles.detailRow}>
                        <span
                          style={styles.detailLabel}
                        >
                          Practice
                        </span>

                        <span
                          style={styles.detailValue}
                        >
                          {locum.practice_name}
                        </span>
                      </div>
                    )}

                    {!location &&
                      clean(
                        locum.practice_full_address,
                      ) && (
                        <div
                          style={styles.detailRow}
                        >
                          <span
                            style={
                              styles.detailLabel
                            }
                          >
                            Address
                          </span>

                          <span
                            style={
                              styles.detailValue
                            }
                          >
                            {
                              locum.practice_full_address
                            }
                          </span>
                        </div>
                      )}

                    {clean(locum.mobile) && (
                      <div style={styles.detailRow}>
                        <span
                          style={styles.detailLabel}
                        >
                          Mobile
                        </span>

                        <span
                          style={styles.detailValue}
                        >
                          {locum.mobile}
                        </span>
                      </div>
                    )}

                    {clean(locum.email) && (
                      <div style={styles.detailRow}>
                        <span
                          style={styles.detailLabel}
                        >
                          Email
                        </span>

                        <span
                          style={{
                            ...styles.detailValue,
                            wordBreak:
                              "break-word",
                          }}
                        >
                          {locum.email}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={styles.actions}>
                    {clean(locum.mobile) ? (
                      <a
                        href={`tel:${locum.mobile}`}
                        style={styles.secondaryAction}
                      >
                        Call
                      </a>
                    ) : (
                      <button
                        disabled
                        style={styles.disabledAction}
                      >
                        Call
                      </button>
                    )}

                    {clean(locum.email) ? (
                      <a
                        href={`mailto:${locum.email}`}
                        style={styles.primaryAction}
                      >
                        Email
                      </a>
                    ) : (
                      <button
                        disabled
                        style={styles.disabledAction}
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
    padding: "30px 24px 60px",
    background: "#f7f9f8",
    color: "#14241f",
    fontFamily:
      "Arial, Helvetica, sans-serif",
  },

  container: {
    maxWidth: "1400px",
    margin: "0 auto",
  },

  navigation: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
    marginBottom: "28px",
  },

  brand: {
    fontSize: "23px",
    fontWeight: 900,
    letterSpacing: "3px",
    color: "#0f6154",
  },

  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    flexWrap: "wrap",
  },

  navLink: {
    color: "#3c4743",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "none",
  },

  activeNavLink: {
    color: "#087f5b",
    fontSize: "14px",
    fontWeight: 900,
    textDecoration: "none",
  },

  hero: {
    padding: "38px 40px",
    borderRadius: "22px",
    marginBottom: "24px",
    background:
      "linear-gradient(110deg, #071624 0%, #07383b 55%, #005642 100%)",
    color: "white",
    boxShadow:
      "0 14px 40px rgba(4, 48, 40, 0.14)",
  },

  heroLabel: {
    color: "#9ee8d4",
    fontSize: "14px",
    fontWeight: 900,
    letterSpacing: "2px",
    marginBottom: "10px",
  },

  heroTitle: {
    fontSize: "46px",
    lineHeight: 1,
    margin: "0 0 16px",
    fontWeight: 900,
  },

  heroText: {
    margin: 0,
    color: "#e2efeb",
    fontSize: "17px",
    lineHeight: 1.6,
    maxWidth: "720px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "20px",
  },

  statCard: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "20px",
    border: "1px solid #e0e8e5",
    boxShadow:
      "0 7px 22px rgba(10, 50, 38, 0.04)",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  statLabel: {
    fontSize: "12px",
    color: "#77837f",
    fontWeight: 800,
    textTransform: "uppercase",
  },

  statNumber: {
    fontSize: "31px",
    color: "#087f5b",
  },

  statText: {
    color: "#7c8984",
    fontSize: "13px",
  },

  filterPanel: {
    background: "#ffffff",
    border: "1px solid #dfe8e5",
    borderRadius: "18px",
    padding: "22px",
    marginBottom: "30px",
    boxShadow:
      "0 8px 25px rgba(14, 54, 42, 0.05)",
  },

  searchRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },

  searchInput: {
    flex: "1 1 500px",
    minHeight: "50px",
    padding: "0 16px",
    borderRadius: "11px",
    border: "1px solid #d4dfdb",
    fontSize: "15px",
    outline: "none",
  },

  clearButton: {
    minHeight: "50px",
    padding: "0 20px",
    borderRadius: "11px",
    border: "1px solid #d4dfdb",
    background: "#ffffff",
    color: "#34433e",
    fontWeight: 800,
    cursor: "pointer",
  },

  filterGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "15px",
  },

  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },

  filterLabel: {
    color: "#596862",
    fontSize: "12px",
    fontWeight: 900,
  },

  select: {
    minHeight: "46px",
    padding: "0 12px",
    borderRadius: "10px",
    border: "1px solid #d4dfdb",
    background: "#ffffff",
    color: "#172a23",
    fontSize: "14px",
  },

  resultsHeader: {
    marginBottom: "16px",
  },

  resultsTitle: {
    margin: 0,
    fontSize: "23px",
    fontWeight: 900,
  },

  resultsSubtitle: {
    margin: "5px 0 0",
    color: "#7a8782",
    fontSize: "14px",
  },

  cardGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fill, minmax(340px, 1fr))",
    gap: "18px",
  },

  card: {
    background: "#ffffff",
    borderRadius: "18px",
    border: "1px solid #dfe7e4",
    padding: "21px",
    boxShadow:
      "0 8px 25px rgba(18, 57, 45, 0.055)",
  },

  cardHeader: {
    display: "flex",
    gap: "13px",
    alignItems: "flex-start",
  },

  avatar: {
    width: "52px",
    height: "52px",
    minWidth: "52px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#dcf6ec",
    border: "1px solid #c0e8da",
    color: "#087f5b",
    fontWeight: 900,
  },

  name: {
    margin: "2px 0 8px",
    fontSize: "19px",
    lineHeight: 1.2,
  },

  badgeRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },

  professionBadge: {
    padding: "5px 9px",
    borderRadius: "999px",
    background: "#edf8f4",
    color: "#087f5b",
    fontSize: "11px",
    fontWeight: 900,
  },

  permitBadge: {
    padding: "5px 9px",
    borderRadius: "999px",
    background: "#f1edff",
    color: "#6741d9",
    fontSize: "11px",
    fontWeight: 900,
  },

  availableBadge: {
    padding: "5px 8px",
    background: "#e9f8ed",
    color: "#2b8a3e",
    borderRadius: "999px",
    fontSize: "9px",
    fontWeight: 900,
  },

  unavailableBadge: {
    padding: "5px 8px",
    background: "#f1f3f5",
    color: "#868e96",
    borderRadius: "999px",
    fontSize: "9px",
    fontWeight: 900,
  },

  divider: {
    height: "1px",
    background: "#edf1ef",
    margin: "17px 0",
  },

  details: {
    display: "flex",
    flexDirection: "column",
    gap: "11px",
    minHeight: "140px",
  },

  detailRow: {
    display: "grid",
    gridTemplateColumns: "105px 1fr",
    gap: "10px",
  },

  detailLabel: {
    color: "#85908c",
    fontSize: "12px",
    fontWeight: 700,
  },

  detailValue: {
    color: "#293b34",
    fontSize: "13px",
    lineHeight: 1.4,
  },

  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginTop: "20px",
  },

  primaryAction: {
    minHeight: "43px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    textDecoration: "none",
    background: "#087f5b",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: "13px",
  },

  secondaryAction: {
    minHeight: "43px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    textDecoration: "none",
    background: "#eef9f5",
    color: "#087f5b",
    border: "1px solid #cae8dd",
    fontWeight: 900,
    fontSize: "13px",
  },

  disabledAction: {
    minHeight: "43px",
    borderRadius: "10px",
    border: "1px solid #e1e5e3",
    background: "#f5f6f6",
    color: "#a2aaa7",
    fontWeight: 800,
  },

  emptyCard: {
    padding: "60px 20px",
    textAlign: "center",
    borderRadius: "18px",
    border: "1px solid #dfe7e4",
    background: "#ffffff",
  },

  emptyTitle: {
    margin: "0 0 8px",
    fontSize: "21px",
  },

  emptyText: {
    margin: "0 0 20px",
    color: "#798681",
  },

  primaryButton: {
    minHeight: "44px",
    padding: "0 20px",
    borderRadius: "10px",
    border: "none",
    background: "#087f5b",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  errorBox: {
    marginBottom: "20px",
    padding: "15px",
    borderRadius: "10px",
    border: "1px solid #ffc9c9",
    background: "#fff5f5",
    color: "#c92a2a",
    fontWeight: 700,
  },

  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f7f9f8",
    fontFamily: "Arial, sans-serif",
  },

  loadingCard: {
    padding: "30px",
    borderRadius: "15px",
    background: "#ffffff",
    border: "1px solid #dfe7e4",
  },
};
