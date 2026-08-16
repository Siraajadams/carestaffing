"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

type Applicant = {
  id: string;
  status: string;
  created_at: string;

  shift_id?: string | null;
  locum_id?: string | null;

  profiles?: {
    id?: string;
    first_name?: string | null;
    surname?: string | null;
    email?: string | null;
    mobile?: string | null;
    profession?: string | null;
    registration_number?: string | null;
    practice_number?: string | null;
    country?: string | null;
    profile_photo_url?: string | null;
  } | null;

  shifts?: {
    id?: string;
    title?: string | null;
    location?: string | null;
    work_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    agreed_rate?: number | null;
    profession?: string | null;
  } | null;
};

export default function EmployerApplicantsClient() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadApplicants();
  }, []);

  async function loadApplicants() {
    try {
      setLoading(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setMessage("Please log in to view applicants.");
        setApplicants([]);
        return;
      }

      const { data, error } = await supabase
        .from("shift_applications")
        .select(`
          id,
          status,
          created_at,
          shift_id,
          locum_id,
          profiles:locum_id (
            id,
            first_name,
            surname,
            email,
            mobile,
            profession,
            registration_number,
            practice_number,
            country,
            profile_photo_url
          ),
          shifts:shift_id (
            id,
            title,
            location,
            work_date,
            start_time,
            end_time,
            agreed_rate,
            profession
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setApplicants((data as unknown as Applicant[]) || []);
    } catch (error: any) {
      console.error("Error loading applicants:", error);
      setMessage(
        error?.message || "Could not load applicants. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateApplicationStatus(
    applicationId: string,
    status: "accepted" | "rejected"
  ) {
    try {
      setUpdatingId(applicationId);
      setMessage("");

      const { error } = await supabase
        .from("shift_applications")
        .update({ status })
        .eq("id", applicationId);

      if (error) {
        throw error;
      }

      setApplicants((current) =>
        current.map((applicant) =>
          applicant.id === applicationId
            ? { ...applicant, status }
            : applicant
        )
      );

      setMessage(
        status === "accepted"
          ? "Applicant accepted successfully."
          : "Applicant declined."
      );
    } catch (error: any) {
      console.error("Error updating applicant:", error);
      setMessage(
        error?.message || "Could not update the application."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function formatDate(value?: string | null) {
    if (!value) return "Not specified";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatTime(value?: string | null) {
    if (!value) return "";

    return value.slice(0, 5);
  }

  function fullName(applicant: Applicant) {
    const firstName = applicant.profiles?.first_name || "";
    const surname = applicant.profiles?.surname || "";

    const name = `${firstName} ${surname}`.trim();

    return name || "Applicant";
  }

  function statusStyle(status: string) {
    const normalized = (status || "").toLowerCase();

    if (normalized === "accepted") {
      return {
        background: "#dcfce7",
        color: "#166534",
      };
    }

    if (normalized === "rejected" || normalized === "declined") {
      return {
        background: "#fee2e2",
        color: "#991b1b",
      };
    }

    return {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>CareStaffing Employer Portal</p>
            <h1 style={styles.title}>Shift Applicants</h1>
            <p style={styles.subtitle}>
              Review healthcare professionals who have applied for your shifts.
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link href="/employer-dashboard" style={styles.secondaryButton}>
              Employer Dashboard
            </Link>

            <button
              type="button"
              onClick={loadApplicants}
              style={styles.refreshButton}
            >
              Refresh
            </button>
          </div>
        </header>

        {message && (
          <div style={styles.message}>
            {message}
          </div>
        )}

        {loading ? (
          <div style={styles.emptyCard}>
            <div style={styles.loader} />
            <p style={styles.emptyTitle}>Loading applicants...</p>
          </div>
        ) : applicants.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyIcon}>👥</div>

            <h2 style={styles.emptyTitle}>
              No applicants yet
            </h2>

            <p style={styles.emptyText}>
              Applications for your published shifts will appear here.
            </p>

            <Link href="/employer-shifts" style={styles.primaryLink}>
              View My Shifts
            </Link>
          </div>
        ) : (
          <div style={styles.grid}>
            {applicants.map((applicant) => {
              const profile = applicant.profiles;
              const shift = applicant.shifts;
              const currentStatus =
                applicant.status || "pending";

              return (
                <article key={applicant.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div style={styles.profileSection}>
                      {profile?.profile_photo_url ? (
                        <img
                          src={profile.profile_photo_url}
                          alt={fullName(applicant)}
                          style={styles.avatar}
                        />
                      ) : (
                        <div style={styles.avatarFallback}>
                          {(
                            profile?.first_name?.charAt(0) || "A"
                          ).toUpperCase()}
                        </div>
                      )}

                      <div>
                        <h2 style={styles.name}>
                          {fullName(applicant)}
                        </h2>

                        <p style={styles.profession}>
                          {profile?.profession ||
                            shift?.profession ||
                            "Healthcare Professional"}
                        </p>
                      </div>
                    </div>

                    <span
                      style={{
                        ...styles.statusBadge,
                        ...statusStyle(currentStatus),
                      }}
                    >
                      {currentStatus}
                    </span>
                  </div>

                  <div style={styles.divider} />

                  <section style={styles.section}>
                    <p style={styles.sectionLabel}>Applied for</p>

                    <h3 style={styles.shiftTitle}>
                      {shift?.title || "Shift"}
                    </h3>

                    <div style={styles.detailGrid}>
                      <Detail
                        label="Location"
                        value={shift?.location || "Not specified"}
                      />

                      <Detail
                        label="Date"
                        value={formatDate(shift?.work_date)}
                      />

                      <Detail
                        label="Time"
                        value={
                          shift?.start_time || shift?.end_time
                            ? `${formatTime(
                                shift?.start_time
                              )} - ${formatTime(shift?.end_time)}`
                            : "Not specified"
                        }
                      />

                      <Detail
                        label="Rate"
                        value={
                          shift?.agreed_rate != null
                            ? `R ${Number(
                                shift.agreed_rate
                              ).toLocaleString("en-ZA")}`
                            : "Not specified"
                        }
                      />
                    </div>
                  </section>

                  <section style={styles.section}>
                    <p style={styles.sectionLabel}>
                      Applicant details
                    </p>

                    <div style={styles.detailGrid}>
                      <Detail
                        label="Email"
                        value={profile?.email || "Not provided"}
                      />

                      <Detail
                        label="Mobile"
                        value={profile?.mobile || "Not provided"}
                      />

                      <Detail
                        label="Registration"
                        value={
                          profile?.registration_number ||
                          "Not provided"
                        }
                      />

                      <Detail
                        label="Practice number"
                        value={
                          profile?.practice_number ||
                          "Not provided"
                        }
                      />

                      <Detail
                        label="Country"
                        value={profile?.country || "Not provided"}
                      />

                      <Detail
                        label="Applied"
                        value={formatDate(applicant.created_at)}
                      />
                    </div>
                  </section>

                  <div style={styles.actions}>
                    {currentStatus.toLowerCase() === "pending" ? (
                      <>
                        <button
                          type="button"
                          disabled={updatingId === applicant.id}
                          onClick={() =>
                            updateApplicationStatus(
                              applicant.id,
                              "accepted"
                            )
                          }
                          style={{
                            ...styles.acceptButton,
                            opacity:
                              updatingId === applicant.id ? 0.6 : 1,
                          }}
                        >
                          {updatingId === applicant.id
                            ? "Updating..."
                            : "Accept Applicant"}
                        </button>

                        <button
                          type="button"
                          disabled={updatingId === applicant.id}
                          onClick={() =>
                            updateApplicationStatus(
                              applicant.id,
                              "rejected"
                            )
                          }
                          style={{
                            ...styles.rejectButton,
                            opacity:
                              updatingId === applicant.id ? 0.6 : 1,
                          }}
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          updateApplicationStatus(
                            applicant.id,
                            "accepted"
                          )
                        }
                        style={styles.secondaryAction}
                      >
                        Mark Accepted
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

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
    padding: "32px 18px 60px",
    fontFamily:
      "Inter, Arial, Helvetica, sans-serif",
    color: "#111827",
  },

  container: {
    maxWidth: 1180,
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 26,
  },

  eyebrow: {
    margin: "0 0 8px",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: "#16a34a",
  },

  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.15,
    fontWeight: 800,
  },

  subtitle: {
    margin: "10px 0 0",
    maxWidth: 650,
    color: "#64748b",
    lineHeight: 1.6,
  },

  headerActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 10,
    background: "#ffffff",
    border: "1px solid #d1d5db",
    color: "#111827",
    textDecoration: "none",
    fontWeight: 700,
  },

  refreshButton: {
    minHeight: 44,
    padding: "0 18px",
    border: 0,
    borderRadius: 10,
    cursor: "pointer",
    background: "#111827",
    color: "#ffffff",
    fontWeight: 700,
  },

  message: {
    padding: "13px 16px",
    marginBottom: 20,
    borderRadius: 10,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e40af",
    fontSize: 14,
    fontWeight: 600,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 18,
  },

  card: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    padding: 22,
    boxShadow: "0 8px 28px rgba(15, 23, 42, 0.06)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },

  profileSection: {
    display: "flex",
    alignItems: "center",
    gap: 13,
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid #e5e7eb",
  },

  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    background: "#111827",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 21,
    fontWeight: 800,
  },

  name: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
  },

  profession: {
    margin: "5px 0 0",
    fontSize: 14,
    color: "#64748b",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "capitalize",
  },

  divider: {
    height: 1,
    background: "#e5e7eb",
    margin: "18px 0",
  },

  section: {
    marginBottom: 19,
  },

  sectionLabel: {
    margin: "0 0 8px",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: 800,
    fontSize: 11,
  },

  shiftTitle: {
    margin: "0 0 14px",
    fontSize: 17,
    fontWeight: 800,
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  detailItem: {
    minWidth: 0,
  },

  detailLabel: {
    display: "block",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
  },

  detailValue: {
    display: "block",
    color: "#334155",
    fontSize: 13,
    fontWeight: 600,
    overflowWrap: "anywhere",
  },

  actions: {
    display: "flex",
    gap: 10,
    marginTop: 20,
    flexWrap: "wrap",
  },

  acceptButton: {
    flex: 1,
    minWidth: 150,
    border: 0,
    borderRadius: 10,
    padding: "12px 16px",
    background: "#22c55e",
    color: "#052e16",
    cursor: "pointer",
    fontWeight: 800,
  },

  rejectButton: {
    borderRadius: 10,
    padding: "12px 16px",
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: 800,
  },

  secondaryAction: {
    width: "100%",
    borderRadius: 10,
    padding: "12px 16px",
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#111827",
    cursor: "pointer",
    fontWeight: 700,
  },

  emptyCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: "60px 20px",
    textAlign: "center",
    boxShadow: "0 8px 28px rgba(15, 23, 42, 0.05)",
  },

  emptyIcon: {
    fontSize: 42,
    marginBottom: 12,
  },

  emptyTitle: {
    margin: "0 0 8px",
    fontSize: 20,
    fontWeight: 800,
  },

  emptyText: {
    margin: "0 auto 20px",
    color: "#64748b",
    maxWidth: 440,
    lineHeight: 1.6,
  },

  primaryLink: {
    display: "inline-flex",
    padding: "12px 18px",
    background: "#111827",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: 10,
    fontWeight: 700,
  },

  loader: {
    width: 32,
    height: 32,
    margin: "0 auto 16px",
    border: "4px solid #e5e7eb",
    borderTopColor: "#111827",
    borderRadius: "50%",
  },
};
