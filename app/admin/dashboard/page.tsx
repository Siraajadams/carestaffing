"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type Locum = {
  id: string;
  first_name: string | null;
  surname: string | null;
  email: string | null;
  mobile: string | null;
  profession: string | null;
  province: string | null;
  city: string | null;
  registration_number: string | null;
  role: string | null;
  account_type: string | null;
};

type Employer = {
  id: string;
  business_name: string | null;
  province: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  owner_id: string | null;
};

const provinces = [
  "All Provinces",
  "Western Cape",
  "Eastern Cape",
  "Northern Cape",
  "Free State",
  "KwaZulu-Natal",
  "Gauteng",
  "North West",
  "Mpumalanga",
  "Limpopo",
];

const professionOrder = [
  "Pharmacist",
  "Pharmacist PIMART Permit",
  "Pharmacist PCDT Permit",
  "Pharmacist PCDT and PIMART Permit",
  "Doctor",
  "Nurse",
  "Pharmacy Technician",
  "Independent Prescriber",
  "Optometrist",
  "Physiotherapist",
  "Biokinetist",
];

export default function AdminDashboardPage() {
  const [locums, setLocums] = useState<Locum[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);

  const [province, setProvince] = useState("All Provinces");
  const [profession, setProfession] = useState("All Professions");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [view, setView] = useState<
    "locums" | "employers" | "profession" | "province"
  >("locums");

  useEffect(() => {
    initialise();
  }, []);

  async function initialise() {
    setLoading(true);
    setError("");

    try {
      // ADMIN LOGIN CHECK REMOVED
      // Dashboard loads directly without requiring an authenticated admin session.
      await Promise.all([loadLocums(), loadEmployers()]);
    } catch (err: any) {
      setError(err?.message || "Unable to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function loadLocums() {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        first_name,
        surname,
        email,
        mobile,
        profession,
        province,
        city,
        registration_number,
        role,
        account_type
      `,
      )
      .or("role.eq.worker,account_type.eq.worker")
      .order("surname", { ascending: true });

    if (error) throw error;

    setLocums((data || []) as Locum[]);
  }

  async function loadEmployers() {
    const { data, error } = await supabase
      .from("companies")
      .select(
        `
        id,
        business_name,
        province,
        city,
        email,
        phone,
        owner_id
      `,
      )
      .order("business_name", { ascending: true });

    if (error) throw error;

    setEmployers((data || []) as Employer[]);
  }

  const professionOptions = useMemo(() => {
    const discovered = Array.from(
      new Set(
        locums
          .map((locum) => locum.profession)
          .filter(Boolean) as string[],
      ),
    );

    return [
      "All Professions",
      ...professionOrder.filter((item) => discovered.includes(item)),
      ...discovered.filter((item) => !professionOrder.includes(item)),
    ];
  }, [locums]);

  const filteredLocums = useMemo(() => {
    return locums.filter((locum) => {
      const provinceMatch =
        province === "All Provinces" || locum.province === province;

      const professionMatch =
        profession === "All Professions" ||
        locum.profession === profession;

      return provinceMatch && professionMatch;
    });
  }, [locums, province, profession]);

  const filteredEmployers = useMemo(() => {
    return employers.filter((employer) => {
      return (
        province === "All Provinces" ||
        employer.province === province
      );
    });
  }, [employers, province]);

  const professionSummary = useMemo(() => {
    const counts: Record<string, number> = {};

    filteredLocums.forEach((locum) => {
      const key = locum.profession || "Not specified";
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredLocums]);

  const provinceSummary = useMemo(() => {
    const counts: Record<
      string,
      {
        locums: number;
        employers: number;
      }
    > = {};

    locums.forEach((locum) => {
      const key = locum.province || "Not specified";

      if (!counts[key]) {
        counts[key] = {
          locums: 0,
          employers: 0,
        };
      }

      counts[key].locums += 1;
    });

    employers.forEach((employer) => {
      const key = employer.province || "Not specified";

      if (!counts[key]) {
        counts[key] = {
          locums: 0,
          employers: 0,
        };
      }

      counts[key].employers += 1;
    });

    return Object.entries(counts).sort(
      (a, b) =>
        b[1].locums +
        b[1].employers -
        (a[1].locums + a[1].employers),
    );
  }, [locums, employers]);

  function countProfession(name: string) {
    return filteredLocums.filter(
      (locum) =>
        locum.profession
          ?.toLowerCase()
          .includes(name.toLowerCase()),
    ).length;
  }

  function drillProfession(professionName: string) {
    setProfession(professionName);
    setView("locums");
  }

  function drillProvince(provinceName: string) {
    setProvince(provinceName);
    setView("locums");
  }

  if (loading) {
    return (
      <main style={styles.loadingPage}>
        Loading CareStaffing Admin Dashboard...
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>CareStaffing</p>

          <h1 style={styles.title}>Admin Dashboard</h1>

          <p style={styles.subtitle}>
            Marketplace overview, healthcare workforce and employer
            distribution.
          </p>
        </div>

        <div style={styles.headerButtons}>
          <Link href="/dashboard" style={styles.secondaryButton}>
            Main Dashboard
          </Link>

          <button
            style={styles.refreshButton}
            onClick={initialise}
          >
            Refresh
          </button>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {!error && (
        <>
          {/* MAIN KPI CARDS */}

          <section style={styles.statsGrid}>
            <StatCard
              label="Total Locums"
              value={filteredLocums.length}
              subtitle="Healthcare professionals"
              onClick={() => setView("locums")}
            />

            <StatCard
              label="Total Employers"
              value={filteredEmployers.length}
              subtitle="Registered healthcare employers"
              onClick={() => setView("employers")}
            />

            <StatCard
              label="Pharmacists"
              value={countProfession("Pharmacist")}
              subtitle="Including permit categories"
              onClick={() => {
                setProfession("Pharmacist");
                setView("locums");
              }}
            />

            <StatCard
              label="Doctors"
              value={countProfession("Doctor")}
              subtitle="Registered doctors"
              onClick={() => drillProfession("Doctor")}
            />

            <StatCard
              label="Nurses"
              value={countProfession("Nurse")}
              subtitle="Registered nurses"
              onClick={() => drillProfession("Nurse")}
            />
          </section>

          {/* FILTERS */}

          <section style={styles.filterPanel}>
            <div style={styles.filterField}>
              <label style={styles.label}>Province</label>

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
            </div>

            <div style={styles.filterField}>
              <label style={styles.label}>Profession</label>

              <select
                value={profession}
                onChange={(event) =>
                  setProfession(event.target.value)
                }
                style={styles.select}
              >
                {professionOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <button
              style={styles.clearButton}
              onClick={() => {
                setProvince("All Provinces");
                setProfession("All Professions");
              }}
            >
              Clear Filters
            </button>
          </section>

          {/* VIEW SELECTOR */}

          <section style={styles.tabs}>
            <Tab
              active={view === "locums"}
              onClick={() => setView("locums")}
            >
              Locums
            </Tab>

            <Tab
              active={view === "employers"}
              onClick={() => setView("employers")}
            >
              Employers
            </Tab>

            <Tab
              active={view === "profession"}
              onClick={() => setView("profession")}
            >
              By Profession
            </Tab>

            <Tab
              active={view === "province"}
              onClick={() => setView("province")}
            >
              By Province
            </Tab>
          </section>

          {/* LOCUM DIRECTORY */}

          {view === "locums" && (
            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.panelTitle}>
                    Locum Directory
                  </h2>

                  <p style={styles.panelSub}>
                    {filteredLocums.length} healthcare workers
                    match the current filters.
                  </p>
                </div>
              </div>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Name</th>
                      <th style={styles.th}>Profession</th>
                      <th style={styles.th}>Province</th>
                      <th style={styles.th}>City</th>
                      <th style={styles.th}>Registration</th>
                      <th style={styles.th}>Contact</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLocums.map((locum) => (
                      <tr key={locum.id}>
                        <td style={styles.td}>
                          <strong>
                            {locum.first_name || ""}{" "}
                            {locum.surname || ""}
                          </strong>
                        </td>

                        <td style={styles.td}>
                          {locum.profession || "—"}
                        </td>

                        <td style={styles.td}>
                          {locum.province || "—"}
                        </td>

                        <td style={styles.td}>
                          {locum.city || "—"}
                        </td>

                        <td style={styles.td}>
                          {locum.registration_number || "—"}
                        </td>

                        <td style={styles.td}>
                          <div>{locum.email || "—"}</div>
                          <div>{locum.mobile || ""}</div>
                        </td>
                      </tr>
                    ))}

                    {!filteredLocums.length && (
                      <tr>
                        <td
                          colSpan={6}
                          style={styles.empty}
                        >
                          No locums found for these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* EMPLOYERS */}

          {view === "employers" && (
            <section style={styles.panel}>
              <h2 style={styles.panelTitle}>
                Employer Directory
              </h2>

              <p style={styles.panelSub}>
                {filteredEmployers.length} employers match the
                current province filter.
              </p>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Employer</th>
                      <th style={styles.th}>Province</th>
                      <th style={styles.th}>City</th>
                      <th style={styles.th}>Email</th>
                      <th style={styles.th}>Phone</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredEmployers.map((employer) => (
                      <tr key={employer.id}>
                        <td style={styles.td}>
                          <strong>
                            {employer.business_name || "Employer"}
                          </strong>
                        </td>

                        <td style={styles.td}>
                          {employer.province || "—"}
                        </td>

                        <td style={styles.td}>
                          {employer.city || "—"}
                        </td>

                        <td style={styles.td}>
                          {employer.email || "—"}
                        </td>

                        <td style={styles.td}>
                          {employer.phone || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* PROFESSION ANALYSIS */}

          {view === "profession" && (
            <section style={styles.panel}>
              <h2 style={styles.panelTitle}>
                Locums by Profession
              </h2>

              <div style={styles.breakdownGrid}>
                {professionSummary.map(([name, total]) => (
                  <button
                    key={name}
                    style={styles.breakdownCard}
                    onClick={() => drillProfession(name)}
                  >
                    <span style={styles.breakdownName}>
                      {name}
                    </span>

                    <strong style={styles.breakdownNumber}>
                      {total}
                    </strong>

                    <span style={styles.drill}>
                      View locums →
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* PROVINCE ANALYSIS */}

          {view === "province" && (
            <section style={styles.panel}>
              <h2 style={styles.panelTitle}>
                Distribution by Province
              </h2>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Province</th>
                      <th style={styles.th}>Locums</th>
                      <th style={styles.th}>Employers</th>
                      <th style={styles.th}>Total Network</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {provinceSummary.map(
                      ([provinceName, counts]) => (
                        <tr key={provinceName}>
                          <td style={styles.td}>
                            <strong>{provinceName}</strong>
                          </td>

                          <td style={styles.td}>
                            {counts.locums}
                          </td>

                          <td style={styles.td}>
                            {counts.employers}
                          </td>

                          <td style={styles.td}>
                            {counts.locums + counts.employers}
                          </td>

                          <td style={styles.td}>
                            <button
                              style={styles.smallButton}
                              onClick={() =>
                                drillProvince(provinceName)
                              }
                            >
                              Drill Down
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  onClick,
}: {
  label: string;
  value: number;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={styles.statCard}
    >
      <span style={styles.statLabel}>{label}</span>

      <strong style={styles.statNumber}>{value}</strong>

      <span style={styles.statSubtitle}>{subtitle}</span>

      <span style={styles.drill}>View details →</span>
    </button>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tab,
        ...(active ? styles.activeTab : {}),
      }}
    >
      {children}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "28px",
    fontFamily: "Arial, sans-serif",
  },

  loadingPage: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Arial, sans-serif",
    fontWeight: 800,
  },

  header: {
    maxWidth: "1400px",
    margin: "0 auto 24px",
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    flexWrap: "wrap",
  },

  eyebrow: {
    color: "#0f766e",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1px",
    margin: "0 0 6px",
  },

  title: {
    margin: 0,
    fontSize: "40px",
    color: "#0f172a",
  },

  subtitle: {
    marginTop: "8px",
    color: "#64748b",
  },

  headerButtons: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  secondaryButton: {
    padding: "12px 16px",
    background: "#ffffff",
    borderRadius: "10px",
    textDecoration: "none",
    color: "#0f172a",
    fontWeight: 800,
  },

  refreshButton: {
    padding: "12px 16px",
    background: "#0f766e",
    color: "#ffffff",
    border: 0,
    borderRadius: "10px",
    fontWeight: 800,
    cursor: "pointer",
  },

  statsGrid: {
    maxWidth: "1400px",
    margin: "0 auto 22px",
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "20px",
    textAlign: "left",
    cursor: "pointer",
  },

  statLabel: {
    display: "block",
    color: "#64748b",
    fontWeight: 800,
    fontSize: "14px",
  },

  statNumber: {
    display: "block",
    marginTop: "8px",
    color: "#0f172a",
    fontSize: "34px",
  },

  statSubtitle: {
    display: "block",
    marginTop: "5px",
    color: "#64748b",
    fontSize: "13px",
  },

  drill: {
    display: "block",
    marginTop: "12px",
    color: "#0f766e",
    fontWeight: 800,
    fontSize: "13px",
  },

  filterPanel: {
    maxWidth: "1400px",
    margin: "0 auto 18px",
    padding: "18px",
    borderRadius: "16px",
    background: "#ffffff",
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
    alignItems: "end",
  },

  filterField: {
    display: "grid",
    gap: "6px",
    minWidth: "220px",
  },

  label: {
    color: "#334155",
    fontWeight: 800,
  },

  select: {
    minHeight: "46px",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
  },

  clearButton: {
    minHeight: "46px",
    padding: "10px 16px",
    background: "#e2e8f0",
    border: 0,
    borderRadius: "10px",
    fontWeight: 800,
    cursor: "pointer",
  },

  tabs: {
    maxWidth: "1400px",
    margin: "0 auto 18px",
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  tab: {
    padding: "12px 18px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },

  activeTab: {
    background: "#0f766e",
    color: "#ffffff",
    borderColor: "#0f766e",
  },

  panel: {
    maxWidth: "1400px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "22px",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
  },

  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "24px",
  },

  panelSub: {
    color: "#64748b",
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
    marginTop: "16px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "13px",
    background: "#f8fafc",
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "13px",
    borderBottom: "1px solid #e2e8f0",
    color: "#334155",
  },

  empty: {
    padding: "28px",
    textAlign: "center",
    color: "#64748b",
  },

  breakdownGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
    marginTop: "18px",
  },

  breakdownCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "15px",
    padding: "18px",
    textAlign: "left",
    cursor: "pointer",
  },

  breakdownName: {
    display: "block",
    color: "#475569",
    fontWeight: 800,
  },

  breakdownNumber: {
    display: "block",
    marginTop: "10px",
    fontSize: "30px",
    color: "#0f172a",
  },

  smallButton: {
    padding: "8px 12px",
    background: "#0f766e",
    color: "#ffffff",
    border: 0,
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: 800,
  },

  error: {
    maxWidth: "1400px",
    margin: "0 auto 20px",
    padding: "15px",
    background: "#fee2e2",
    color: "#991b1b",
    borderRadius: "12px",
    fontWeight: 800,
  },
};
