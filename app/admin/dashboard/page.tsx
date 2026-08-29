"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
  role_type?: string | null;
  organisation_name?: string | null;
  company_id?: string | null;
};

type Employer = {
  id: string;
  business_name: string | null;
  province: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  owner_id: string | null;
  source?: "company" | "profile";
};

type OpenLocumShift = {
  id: string;
  title: string;
  profession: string;
  employer: string;
  province: string | null;
  city: string | null;
  shift_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  requested: number;
  accepted: number;
  remaining: number;
  is_available: boolean;
};

type DemandByProfession = {
  profession: string;
  shifts: number;
  requested: number;
  accepted: number;
  available: number;
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
  const [openLocumShifts, setOpenLocumShifts] = useState<OpenLocumShift[]>([]);
  const [demandByProfession, setDemandByProfession] = useState<DemandByProfession[]>([]);

  const [province, setProvince] = useState("All Provinces");
  const [profession, setProfession] = useState("All Professions");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sendingShiftId, setSendingShiftId] = useState("");

  const [view, setView] = useState<
    "locums" | "employers" | "profession" | "province" | "openShifts" | "demand"
  >("locums");

  useEffect(() => {
    initialise();
  }, []);

  async function initialise() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/dashboard", {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });

      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Admin dashboard service returned an invalid response (${response.status}).`,
        );
      }

      const result = raw ? JSON.parse(raw) : {};

      if (!response.ok) {
        throw new Error(
          result?.error || `Unable to load admin dashboard (${response.status}).`,
        );
      }

      setLocums((result?.locums || []) as Locum[]);
      setEmployers((result?.employers || []) as Employer[]);
      setOpenLocumShifts(
        (result?.open_locum_shifts || []) as OpenLocumShift[],
      );
      setDemandByProfession(
        (result?.demand_by_profession || []) as DemandByProfession[],
      );
    } catch (err: any) {
      console.error("Admin dashboard load error:", err);
      setError(err?.message || "Unable to load admin dashboard.");
    } finally {
      setLoading(false);
    }
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

  const filteredOpenLocumShifts = useMemo(() => {
    return openLocumShifts.filter((shift) => {
      const provinceMatch =
        province === "All Provinces" || shift.province === province;

      const professionMatch =
        profession === "All Professions" ||
        shift.profession === profession;

      return provinceMatch && professionMatch;
    });
  }, [openLocumShifts, province, profession]);

  const openRequestTotals = useMemo(() => {
    return filteredOpenLocumShifts.reduce(
      (totals, shift) => {
        totals.requested += shift.requested;
        totals.accepted += shift.accepted;
        totals.available += shift.remaining;
        return totals;
      },
      { requested: 0, accepted: 0, available: 0 },
    );
  }, [filteredOpenLocumShifts]);

  const professionSummary = useMemo(() => {
    const counts: Record<string, number> = {};

    filteredLocums.forEach((locum) => {
      const key = locum.profession?.trim() || "Not specified";
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
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

  async function sendShiftReminder(shift: OpenLocumShift) {
    if (!shift.is_available || shift.remaining <= 0) {
      setError("This shift is already filled or closed.");
      return;
    }

    const confirmed = window.confirm(
      `Send a reminder for "${shift.title}" to matching ${shift.profession} locums?\n\nEach locum will receive an individual email. No CC or BCC will be used.`
    );

    if (!confirmed) return;

    setSendingShiftId(shift.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/shifts/notify-locums", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          shiftId: shift.id,
          source: "admin-resend",
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();

      if (!contentType.includes("application/json")) {
        throw new Error(
          `Reminder service returned an invalid response (${response.status}).`
        );
      }

      const result = raw ? JSON.parse(raw) : {};

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error ||
            result?.message ||
            `Unable to send reminder (${response.status}).`
        );
      }

      const sent = Number(result?.sent || 0);
      const failed = Number(result?.failed || 0);
      const matched = Number(result?.matched || 0);

      if (matched === 0) {
        setMessage(
          `No matching ${shift.profession} locums with email addresses were found.`
        );
        return;
      }

      if (failed > 0) {
        setMessage(
          `Reminder completed: ${sent} email${
            sent === 1 ? "" : "s"
          } sent individually and ${failed} failed.`
        );
        return;
      }

      setMessage(
        `✓ Reminder sent individually to ${sent} matching ${
          shift.profession
        } locum${sent === 1 ? "" : "s"}.`
      );
    } catch (err: any) {
      console.error("Admin reminder email error:", err);
      setError(err?.message || "Unable to send reminder emails.");
    } finally {
      setSendingShiftId("");
    }
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
      {message && <div style={styles.success}>{message}</div>}

      {!error && (
        <>
          {/* MAIN KPI CARDS */}

          <section style={styles.statsGrid}>
            <StatCard
              label="Total Available Locums"
              value={filteredLocums.length}
              subtitle="All registered worker accounts"
              onClick={() => {
                setProfession("All Professions");
                setView("locums");
              }}
            />

            <StatCard
              label="Total Employers"
              value={filteredEmployers.length}
              subtitle="Companies + employer profiles"
              onClick={() => setView("employers")}
            />

            <StatCard
              label="Employer Locum Requests"
              value={openRequestTotals.requested}
              subtitle="Total locum positions requested"
              onClick={() => setView("openShifts")}
            />

            <StatCard
              label="Accepted / Filled"
              value={openRequestTotals.accepted}
              subtitle="Locum positions already accepted"
              onClick={() => setView("openShifts")}
            />

            <StatCard
              label="Still Available"
              value={openRequestTotals.available}
              subtitle="Open locum positions remaining"
              onClick={() => setView("openShifts")}
            />

            {professionSummary.map(([professionName, total]) => (
              <StatCard
                key={professionName}
                label={professionName}
                value={total}
                subtitle="Available locums"
                onClick={() => drillProfession(professionName)}
              />
            ))}
          </section>

          <p style={styles.kpiHint}>
            Select any profession card to drill down to individual registered locums.
            Counts are loaded securely from the server so all worker profiles are included
            without exposing the profiles table publicly.
          </p>

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
              active={view === "openShifts"}
              onClick={() => setView("openShifts")}
            >
              Open Locums
            </Tab>

            <Tab
              active={view === "demand"}
              onClick={() => setView("demand")}
            >
              Employer Demand
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
                          No registered worker profiles were returned by the admin dashboard service.
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
                      <th style={styles.th}>Source</th>
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

                        <td style={styles.td}>
                          {employer.source === "company"
                            ? "Company"
                            : "Employer profile"}
                        </td>
                      </tr>
                    ))}

                    {!filteredEmployers.length && (
                      <tr>
                        <td colSpan={6} style={styles.empty}>
                          No registered employers are currently visible.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* OPEN LOCUM REQUESTS */}

          {view === "openShifts" && (
            <section style={styles.panel}>
              <h2 style={styles.panelTitle}>Employer Open Locum Requests</h2>

              <p style={styles.panelSub}>
                {filteredOpenLocumShifts.length} shifts ·{" "}
                {openRequestTotals.requested} positions requested ·{" "}
                {openRequestTotals.accepted} accepted ·{" "}
                {openRequestTotals.available} still available.
              </p>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Employer</th>
                      <th style={styles.th}>Profession</th>
                      <th style={styles.th}>Shift</th>
                      <th style={styles.th}>Province / City</th>
                      <th style={styles.th}>Requested</th>
                      <th style={styles.th}>Accepted</th>
                      <th style={styles.th}>Still Available</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredOpenLocumShifts.map((shift) => (
                      <tr key={shift.id}>
                        <td style={styles.td}>
                          <strong>{shift.employer}</strong>
                        </td>

                        <td style={styles.td}>{shift.profession}</td>

                        <td style={styles.td}>
                          <strong>{shift.title}</strong>
                          <div>
                            {shift.shift_date || "Date not specified"}
                            {shift.start_time ? ` · ${shift.start_time}` : ""}
                            {shift.end_time ? `–${shift.end_time}` : ""}
                          </div>
                        </td>

                        <td style={styles.td}>
                          {[shift.province, shift.city]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>

                        <td style={styles.td}>{shift.requested}</td>
                        <td style={styles.td}>{shift.accepted}</td>

                        <td style={styles.td}>
                          <strong>{shift.remaining}</strong>
                        </td>

                        <td style={styles.td}>
                          <span
                            style={
                              shift.remaining > 0
                                ? styles.availableBadge
                                : styles.filledBadge
                            }
                          >
                            {shift.remaining > 0
                              ? "Available"
                              : "Filled / Closed"}
                          </span>
                        </td>

                        <td style={styles.td}>
                          {shift.is_available && shift.remaining > 0 ? (
                            <button
                              type="button"
                              style={{
                                ...styles.reminderButton,
                                ...(sendingShiftId === shift.id
                                  ? styles.disabledButton
                                  : {}),
                              }}
                              disabled={sendingShiftId === shift.id}
                              onClick={() => void sendShiftReminder(shift)}
                            >
                              {sendingShiftId === shift.id
                                ? "Sending..."
                                : shift.accepted === 0
                                ? "✉ Send Reminder"
                                : "✉ Email Locums Again"}
                            </button>
                          ) : (
                            <span style={styles.noAction}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}

                    {!filteredOpenLocumShifts.length && (
                      <tr>
                        <td colSpan={8} style={styles.empty}>
                          No employer locum requests match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* EMPLOYER DEMAND BY PROFESSION */}

          {view === "demand" && (
            <section style={styles.panel}>
              <h2 style={styles.panelTitle}>Employer Demand by Profession</h2>

              <p style={styles.panelSub}>
                Requested, accepted and still-available locum positions by profession.
              </p>

              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Profession</th>
                      <th style={styles.th}>Open Shifts</th>
                      <th style={styles.th}>Requested</th>
                      <th style={styles.th}>Accepted</th>
                      <th style={styles.th}>Still Available</th>
                      <th style={styles.th}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {demandByProfession.map((item) => (
                      <tr key={item.profession}>
                        <td style={styles.td}>
                          <strong>{item.profession}</strong>
                        </td>
                        <td style={styles.td}>{item.shifts}</td>
                        <td style={styles.td}>{item.requested}</td>
                        <td style={styles.td}>{item.accepted}</td>
                        <td style={styles.td}>
                          <strong>{item.available}</strong>
                        </td>
                        <td style={styles.td}>
                          <button
                            style={styles.smallButton}
                            onClick={() => {
                              setProfession(item.profession);
                              setView("openShifts");
                            }}
                          >
                            View Open Locums
                          </button>
                        </td>
                      </tr>
                    ))}

                    {!demandByProfession.length && (
                      <tr>
                        <td colSpan={6} style={styles.empty}>
                          No employer demand is currently recorded.
                        </td>
                      </tr>
                    )}
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

  kpiHint: {
    maxWidth: "1400px",
    margin: "-8px auto 18px",
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

  availableBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 800,
    fontSize: "12px",
  },

  filledBadge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#e2e8f0",
    color: "#475569",
    fontWeight: 800,
    fontSize: "12px",
  },

  reminderButton: {
    padding: "9px 13px",
    background: "#0f766e",
    color: "#ffffff",
    border: 0,
    borderRadius: "9px",
    cursor: "pointer",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
  },

  noAction: {
    color: "#94a3b8",
  },

  success: {
    maxWidth: "1400px",
    margin: "0 auto 20px",
    padding: "15px",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "12px",
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
