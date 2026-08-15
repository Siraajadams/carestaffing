"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type ApplicantProfile = {
  first_name?: string | null;
  surname?: string | null;
  profession?: string | null;
  registration_number?: string | null;
  mobile?: string | null;
  email?: string | null;
};

type ApplicantShift = {
  id?: string | null;
  title?: string | null;
  shift_date?: string | null;
  start_date?: string | null;
  location?: string | null;
  city?: string | null;
  hourly_rate?: number | null;
  locum_rate?: number | null;
  currency?: string | null;
};

type Applicant = {
  id: string;
  shift_id?: string | null;
  locum_id?: string | null;
  status: string | null;
  created_at: string | null;
  profiles: ApplicantProfile | null;
  shifts: ApplicantShift | null;
};

export default function EmployerApplicantsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [applications, setApplications] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  const selectedShiftId = searchParams.get("shift");

  useEffect(() => {
    void loadApplicants();
  }, [selectedShiftId]);

  async function loadApplicants() {
    setLoading(true);
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

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (companyError) {
        throw companyError;
      }

      if (!company) {
        setApplications([]);
        return;
      }

      let shiftsQuery = supabase
        .from("shifts")
        .select("id")
        .eq("company_id", company.id);

      if (selectedShiftId) {
        shiftsQuery = shiftsQuery.eq("id", selectedShiftId);
      }

      const {
        data: companyShifts,
        error: shiftsError,
      } = await shiftsQuery;

      if (shiftsError) {
        throw shiftsError;
      }

      const shiftIds = (companyShifts || [])
        .map((shift: any) => shift.id)
        .filter(Boolean);

      if (shiftIds.length === 0) {
        setApplications([]);
        return;
      }

      const { data, error } = await supabase
        .from("shift_applications")
        .select(
          `
          id,
          shift_id,
          locum_id,
          status,
          created_at,
          profiles(
            first_name,
            surname,
            profession,
            registration_number,
            mobile,
            email
          ),
          shifts(
            id,
            title,
            shift_date,
            start_date,
            location,
            city,
            hourly_rate,
            locum_rate,
            currency
          )
        `
        )
        .in("shift_id", shiftIds)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      const formatted = (data || []).map((item: any) => ({
        ...item,

        profiles: Array.isArray(item.profiles)
          ? item.profiles[0] || null
          : item.profiles || null,

        shifts: Array.isArray(item.shifts)
          ? item.shifts[0] || null
          : item.shifts || null,
      }));

      setApplications(formatted as Applicant[]);
    } catch (error: any) {
      console.error(
        "Load applicants error:",
        error
      );

      setApplications([]);
      setMessageType("error");

      setMessage(
        error?.message ||
          "Could not load applicants."
      );
    } finally {
      setLoading(false);
    }
  }

  async function acceptApplicant(id: string) {
    setActionId(id);
    setMessage("");
    setMessageType("");

    try {
      const application = applications.find(
        (item) => item.id === id
      );

      if (!application) {
        throw new Error(
          "Applicant record not found."
        );
      }

      const { error } = await supabase
        .from("shift_applications")
        .update({
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        throw error;
      }

      setMessageType("success");

      setMessage(
        "Applicant accepted. The shift will now appear in the locum's accepted shifts and timesheets."
      );

      await loadApplicants();
    } catch (error: any) {
      console.error(
        "Accept applicant error:",
        error
      );

      setMessageType("error");

      setMessage(
        error?.message ||
          "Could not accept applicant."
      );
    } finally {
      setActionId("");
    }
  }

  async function declineApplicant(id: string) {
    setActionId(id);
    setMessage("");
    setMessageType("");

    try {
      const { error } = await supabase
        .from("shift_applications")
        .update({
          status: "declined",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        throw error;
      }

      setMessageType("success");
      setMessage("Applicant declined.");

      await loadApplicants();
    } catch (error: any) {
      console.error(
        "Decline applicant error:",
        error
      );

      setMessageType("error");

      setMessage(
        error?.message ||
          "Could not decline applicant."
      );
    } finally {
      setActionId("");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function currencySymbol(
    currency?: string | null
  ) {
    if (currency === "GBP") return "£";
    if (currency === "EUR") return "€";
    if (currency === "NZD") return "NZ$";

    return "R";
  }

  function formatDate(
    value?: string | null
  ) {
    if (!value) return "—";

    const date = new Date(
      value.length === 10
        ? `${value}T00:00:00`
        : value
    );

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(
      "en-ZA",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  function applicantName(
    profile?: ApplicantProfile | null
  ) {
    const name = [
      profile?.first_name,
      profile?.surname,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return name || "Unknown Applicant";
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.nav}>
          <Link
            href="/employer"
            style={styles.brand}
          >
            CARESTAFFING
          </Link>

          <div style={styles.links}>
            <Link
              href="/employer"
              style={styles.link}
            >
              Post Shift
            </Link>

            <Link
              href="/employer/shifts"
              style={styles.link}
            >
              My Shifts
            </Link>

            <Link
              href="/employer/profile"
              style={styles.link}
            >
              Organisation Profile
            </Link>

            <button
              type="button"
              onClick={logout}
              style={styles.logout}
            >
              Logout
            </button>
          </div>
        </div>

        <section style={styles.hero}>
          <div>
            <p style={styles.heroLabel}>
              EMPLOYER PORTAL
            </p>

            <h1 style={styles.heroTitle}>
              Shift Applicants
            </h1>

            <p style={styles.heroText}>
              Review healthcare professionals
              who have applied for your posted
              shifts. Accepting a locum makes
              the shift available in their
              timesheet workflow.
            </p>
          </div>

          <div style={styles.heroStat}>
            <strong>
              {applications.length}
            </strong>

            <span>Applicants</span>
          </div>
        </section>

        {selectedShiftId && (
          <div style={styles.filterBar}>
            <span>
              Showing applicants for selected
              shift
            </span>

            <Link
              href="/employer/applicants"
              style={styles.clearFilter}
            >
              Show all applicants
            </Link>
          </div>
        )}

        {message && (
          <div
            style={
              messageType === "error"
                ? styles.errorMessage
                : styles.successMessage
            }
          >
            {message}
          </div>
        )}

        {loading ? (
          <div style={styles.empty}>
            Loading applicants...
          </div>
        ) : applications.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>
              👥
            </div>

            <h2>
              No applications received yet
            </h2>

            <p style={styles.muted}>
              Applications will appear here
              when locums apply for your posted
              shifts.
            </p>

            <Link
              href="/employer/shifts"
              style={styles.primaryLink}
            >
              View My Shifts
            </Link>
          </div>
        ) : (
          <div style={styles.grid}>
            {applications.map((app) => {
              const profile =
                app.profiles;

              const shift =
                app.shifts;

              const status = (
                app.status || "pending"
              ).toLowerCase();

              const rate = Number(
                shift?.locum_rate ??
                  shift?.hourly_rate ??
                  0
              );

              const symbol =
                currencySymbol(
                  shift?.currency
                );

              const canReview = [
                "applied",
                "pending",
              ].includes(status);

              return (
                <article
                  key={app.id}
                  style={styles.card}
                >
                  <div
                    style={
                      styles.cardHeader
                    }
                  >
                    <div>
                      <p
                        style={
                          styles.smallLabel
                        }
                      >
                        APPLICANT
                      </p>

                      <h2
                        style={
                          styles.cardTitle
                        }
                      >
                        {applicantName(
                          profile
                        )}
                      </h2>

                      <p
                        style={
                          styles.profession
                        }
                      >
                        {profile?.profession ||
                          "Healthcare Professional"}
                      </p>
                    </div>

                    <span
                      style={statusStyle(
                        status
                      )}
                    >
                      {statusLabel(
                        status
                      )}
                    </span>
                  </div>

                  <div
                    style={styles.divider}
                  />

                  <section
                    style={styles.section}
                  >
                    <p
                      style={
                        styles.sectionLabel
                      }
                    >
                      SHIFT
                    </p>

                    <h3
                      style={
                        styles.shiftTitle
                      }
                    >
                      {shift?.title ||
                        "Healthcare Shift"}
                    </h3>

                    <div
                      style={
                        styles.detailGrid
                      }
                    >
                      <Detail
                        label="Date"
                        value={formatDate(
                          shift?.shift_date ||
                            shift?.start_date
                        )}
                      />

                      <Detail
                        label="Location"
                        value={
                          shift?.location ||
                          shift?.city ||
                          "—"
                        }
                      />

                      <Detail
                        label="Locum Rate"
                        value={`${symbol}${rate.toFixed(
                          2
                        )}/hour`}
                      />
                    </div>
                  </section>

                  <div
                    style={styles.divider}
                  />

                  <section
                    style={styles.section}
                  >
                    <p
                      style={
                        styles.sectionLabel
                      }
                    >
                      PROFESSIONAL DETAILS
                    </p>

                    <div
                      style={
                        styles.detailGrid
                      }
                    >
                      <Detail
                        label="Registration"
                        value={
                          profile?.registration_number ||
                          "—"
                        }
                      />

                      <Detail
                        label="Email"
                        value={
                          profile?.email ||
                          "—"
                        }
                      />

                      <Detail
                        label="Mobile"
                        value={
                          profile?.mobile ||
                          "—"
                        }
                      />
                    </div>
                  </section>

                  {canReview ? (
                    <div
                      style={
                        styles.actions
                      }
                    >
                      <button
                        type="button"
                        style={
                          styles.declineButton
                        }
                        onClick={() =>
                          declineApplicant(
                            app.id
                          )
                        }
                        disabled={
                          actionId ===
                          app.id
                        }
                      >
                        {actionId ===
                        app.id
                          ? "Saving..."
                          : "✖ Decline"}
                      </button>

                      <button
                        type="button"
                        style={
                          styles.acceptButton
                        }
                        onClick={() =>
                          acceptApplicant(
                            app.id
                          )
                        }
                        disabled={
                          actionId ===
                          app.id
                        }
                      >
                        {actionId ===
                        app.id
                          ? "Saving..."
                          : "✔ Accept Locum"}
                      </button>
                    </div>
                  ) : status ===
                      "accepted" ||
                    status ===
                      "approved" ? (
                    <div
                      style={
                        styles.acceptedBox
                      }
                    >
                      <div>
                        <strong>
                          ✓ Locum Accepted
                        </strong>

                        <p
                          style={
                            styles.acceptedText
                          }
                        >
                          This shift is now
                          available in the
                          locum&apos;s accepted
                          shifts and timesheet
                          workflow.
                        </p>
                      </div>

                      <Link
                        href="/employer/shifts"
                        style={
                          styles.manageLink
                        }
                      >
                        Manage Shift
                      </Link>
                    </div>
                  ) : (
                    <div
                      style={
                        styles.declinedBox
                      }
                    >
                      Applicant declined.
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
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
    <div style={styles.detail}>
      <span
        style={styles.detailLabel}
      >
        {label}
      </span>

      <strong
        style={styles.detailValue}
      >
        {value}
      </strong>
    </div>
  );
}

function statusLabel(
  value: string
) {
  if (
    value === "accepted" ||
    value === "approved"
  ) {
    return "ACCEPTED";
  }

  if (value === "declined") {
    return "DECLINED";
  }

  if (value === "applied") {
    return "APPLIED";
  }

  return "PENDING";
}

function statusStyle(
  value: string
): React.CSSProperties {
  if (
    value === "accepted" ||
    value === "approved"
  ) {
    return {
      background: "#dcfce7",
      color: "#166534",
      padding: "7px 11px",
      borderRadius: 999,
      fontWeight: 900,
      fontSize: 11,
      height: "fit-content",
    };
  }

  if (value === "declined") {
    return {
      background: "#fee2e2",
      color: "#991b1b",
      padding: "7px 11px",
      borderRadius: 999,
      fontWeight: 900,
      fontSize: 11,
      height: "fit-content",
    };
  }

  return {
    background: "#fef3c7",
    color: "#92400e",
    padding: "7px 11px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 11,
    height: "fit-content",
  };
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    background: "#f8fafc",
    minHeight: "100vh",
    padding: "28px 20px 60px",
    fontFamily: "Arial, sans-serif",
  },

  container: {
    maxWidth: 1180,
    margin: "0 auto",
  },

  nav: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 20,
  },

  brand: {
    textDecoration: "none",
    fontWeight: 900,
    color: "#0f766e",
    letterSpacing: 1,
  },

  links: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    flexWrap: "wrap",
  },

  link: {
    color: "#334155",
    textDecoration: "none",
    fontWeight: 700,
  },

  logout: {
    background: "white",
    border:
      "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "9px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  hero: {
    background:
      "linear-gradient(135deg,#0f172a,#0f766e)",
    color: "white",
    padding: 30,
    borderRadius: 24,
    margin: "20px 0",
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  },

  heroLabel: {
    margin: "0 0 8px",
    color: "#99f6e4",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.8,
  },

  heroTitle: {
    margin: 0,
    fontSize: 38,
  },

  heroText: {
    color: "#cbd5e1",
    maxWidth: 700,
    lineHeight: 1.5,
    marginBottom: 0,
  },

  heroStat: {
    background:
      "rgba(255,255,255,.12)",
    border:
      "1px solid rgba(255,255,255,.2)",
    padding: "15px 18px",
    borderRadius: 16,
    display: "grid",
    textAlign: "center",
    gap: 4,
    minWidth: 105,
  },

  filterBar: {
    background: "#eff6ff",
    border:
      "1px solid #bfdbfe",
    color: "#1e3a8a",
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 18,
    display: "flex",
    justifyContent:
      "space-between",
    gap: 12,
    flexWrap: "wrap",
    fontWeight: 700,
  },

  clearFilter: {
    color: "#1d4ed8",
    textDecoration: "none",
    fontWeight: 900,
  },

  successMessage: {
    background: "#dcfce7",
    color: "#166534",
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
    border:
      "1px solid #bbf7d0",
    fontWeight: 700,
  },

  errorMessage: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
    border:
      "1px solid #fecaca",
    fontWeight: 700,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(340px,1fr))",
    gap: 20,
  },

  card: {
    background: "white",
    padding: 24,
    borderRadius: 20,
    boxShadow:
      "0 10px 25px rgba(0,0,0,.06)",
    border:
      "1px solid #e2e8f0",
  },

  cardHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems:
      "flex-start",
    gap: 12,
  },

  smallLabel: {
    margin: "0 0 5px",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.8,
    color: "#64748b",
  },

  cardTitle: {
    margin: 0,
    color: "#0f172a",
  },

  profession: {
    color: "#0f766e",
    fontWeight: 700,
    margin: "6px 0 0",
  },

  divider: {
    height: 1,
    background: "#e2e8f0",
    margin: "20px 0",
  },

  section: {
    display: "grid",
    gap: 12,
  },

  sectionLabel: {
    margin: 0,
    color: "#64748b",
    fontWeight: 900,
    fontSize: 10,
    letterSpacing: 0.8,
  },

  shiftTitle: {
    margin: 0,
    color: "#0f172a",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(140px,1fr))",
    gap: 10,
  },

  detail: {
    background: "#f8fafc",
    borderRadius: 12,
    padding: 13,
    display: "grid",
    gap: 4,
  },

  detailLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
  },

  detailValue: {
    color: "#0f172a",
    fontSize: 14,
    wordBreak:
      "break-word",
  },

  actions: {
    display: "flex",
    gap: 12,
    marginTop: 22,
    flexWrap: "wrap",
  },

  acceptButton: {
    flex: 1,
    minWidth: 150,
    background: "#16a34a",
    color: "white",
    border: "none",
    padding: 14,
    borderRadius: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  declineButton: {
    flex: 1,
    minWidth: 130,
    background: "#fff",
    color: "#991b1b",
    border:
      "1px solid #fecaca",
    padding: 14,
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  acceptedBox: {
    marginTop: 22,
    background: "#ecfdf5",
    border:
      "1px solid #86efac",
    color: "#166534",
    padding: 16,
    borderRadius: 14,
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },

  acceptedText: {
    margin: "5px 0 0",
    fontSize: 13,
    lineHeight: 1.4,
  },

  manageLink: {
    background: "#166534",
    color: "white",
    padding:
      "10px 13px",
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  declinedBox: {
    marginTop: 22,
    background: "#fef2f2",
    border:
      "1px solid #fecaca",
    color: "#991b1b",
    padding: 14,
    borderRadius: 12,
    fontWeight: 700,
  },

  empty: {
    background: "white",
    padding: 40,
    borderRadius: 20,
    textAlign: "center",
    color: "#64748b",
    border:
      "1px solid #e2e8f0",
  },

  emptyIcon: {
    fontSize: 42,
  },

  muted: {
    color: "#64748b",
  },

  primaryLink: {
    display: "inline-block",
    background: "#0f766e",
    color: "white",
    padding: "11px 16px",
    borderRadius: 11,
    textDecoration: "none",
    fontWeight: 800,
    marginTop: 8,
  },
};
