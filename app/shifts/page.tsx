"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Shift = {
  id: string;
  title: string;
  profession_required: string;
  country: string;
  city: string;
  location: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  status: string;
};

type Application = {
  id: string;
  shift_id: string;
  locum_id: string;
  status: string;
};

export default function FindShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<"success" | "error" | "">("");
  const [loading, setLoading] = useState(true);
  const [applyingShiftId, setApplyingShiftId] = useState<string | null>(null);

  useEffect(() => {
    void loadShifts();
  }, []);

  async function loadShifts() {
    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessageType("error");
        setMessage("Please sign in to view available shifts.");
        return;
      }

      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Profile error:", profileError);
      }

      const profession =
        profile?.profession || null;

      const country =
        profile?.country || null;

      let query = supabase
        .from("shifts")
        .select("*")
        .eq("status", "open");

      if (profession) {
        query = query.eq(
          "profession_required",
          profession,
        );
      }

      if (country) {
        query = query.eq(
          "country",
          country,
        );
      }

      const {
        data: shiftRows,
        error: shiftError,
      } = await query.order(
        "shift_date",
        { ascending: true },
      );

      if (shiftError) {
        throw shiftError;
      }

      setShifts(
        (shiftRows as Shift[]) || [],
      );

      const {
        data: applicationRows,
        error: applicationError,
      } = await supabase
        .from("shift_applications")
        .select(`
          id,
          shift_id,
          locum_id,
          status
        `)
        .eq("locum_id", user.id);

      if (applicationError) {
        console.error(
          "Applications error:",
          applicationError,
        );
      }

      setApplications(
        (applicationRows as Application[]) || [],
      );
    } catch (error: any) {
      console.error(
        "Load shifts error:",
        error,
      );

      setMessageType("error");
      setMessage(
        error?.message ||
          "Could not load available shifts.",
      );
    } finally {
      setLoading(false);
    }
  }

  function getApplicationForShift(
    shiftId: string,
  ) {
    return applications.find(
      (application) =>
        application.shift_id === shiftId,
    );
  }

  async function applyForShift(
    shiftId: string,
  ) {
    if (!userId) {
      setMessageType("error");
      setMessage(
        "Please sign in before applying for a shift.",
      );
      return;
    }

    const existingApplication =
      getApplicationForShift(shiftId);

    if (existingApplication) {
      setMessageType("error");
      setMessage(
        `You have already applied for this shift. Current status: ${existingApplication.status.toUpperCase()}.`,
      );
      return;
    }

    setMessage("");
    setMessageType("");
    setApplyingShiftId(shiftId);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("shift_applications")
        .insert({
          shift_id: shiftId,
          locum_id: userId,
          applicant_id: userId,
          status: "pending",
        })
        .select(`
          id,
          shift_id,
          locum_id,
          status
        `)
        .single();

      if (error) {
        if (
          error.code === "23505"
        ) {
          setMessageType("error");
          setMessage(
            "You have already applied for this shift.",
          );
          return;
        }

        throw error;
      }

      if (data) {
        setApplications((current) => [
          ...current,
          data as Application,
        ]);
      }

      setMessageType("success");
      setMessage(
        "Application submitted successfully. Your application is now pending employer review.",
      );
    } catch (error: any) {
      console.error(
        "Apply for shift error:",
        error,
      );

      setMessageType("error");
      setMessage(
        error?.message ||
          "Could not submit your application.",
      );
    } finally {
      setApplyingShiftId(null);
    }
  }

  function formatDate(
    value?: string | null,
  ) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(
      "en-ZA",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    );
  }

  function formatRate(
    value?: number | null,
  ) {
    const rate = Number(value || 0);

    return rate.toLocaleString(
      "en-ZA",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.empty}>
            Loading available shifts...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link
          href="/dashboard"
          style={styles.back}
        >
          ← Back to Dashboard
        </Link>

        <section style={styles.hero}>
          <h1 style={styles.title}>
            Find Shifts
          </h1>

          <p style={styles.subtitle}>
            Shifts are matched to your
            profession, country and profile.
          </p>
        </section>

        {message && (
          <div
            style={{
              ...styles.message,
              ...(messageType === "success"
                ? styles.successMessage
                : styles.errorMessage),
            }}
          >
            {message}
          </div>
        )}

        <div style={styles.grid}>
          {shifts.length === 0 ? (
            <div style={styles.empty}>
              No matching open shifts found.
            </div>
          ) : (
            shifts.map((shift) => {
              const application =
                getApplicationForShift(
                  shift.id,
                );

              const applicationStatus =
                application?.status?.toLowerCase();

              const isApplying =
                applyingShiftId === shift.id;

              return (
                <div
                  key={shift.id}
                  style={styles.card}
                >
                  <div
                    style={
                      styles.cardHeader
                    }
                  >
                    <div>
                      <h2
                        style={
                          styles.cardTitle
                        }
                      >
                        {shift.title}
                      </h2>

                      <p
                        style={
                          styles.profession
                        }
                      >
                        {
                          shift.profession_required
                        }
                      </p>
                    </div>

                    {application && (
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...(applicationStatus ===
                          "accepted"
                            ? styles.accepted
                            : applicationStatus ===
                                "declined"
                              ? styles.declined
                              : styles.pending),
                        }}
                      >
                        {applicationStatus ===
                        "accepted"
                          ? "APPROVED"
                          : applicationStatus ===
                              "declined"
                            ? "DECLINED"
                            : "PENDING"}
                      </span>
                    )}
                  </div>

                  <div
                    style={
                      styles.detailsGrid
                    }
                  >
                    <Info
                      label="Profession"
                      value={
                        shift.profession_required ||
                        "—"
                      }
                    />

                    <Info
                      label="Location"
                      value={
                        shift.location ||
                        shift.city ||
                        "—"
                      }
                    />

                    <Info
                      label="Date"
                      value={formatDate(
                        shift.shift_date,
                      )}
                    />

                    <Info
                      label="Time"
                      value={`${shift.start_time || "—"} - ${
                        shift.end_time || "—"
                      }`}
                    />

                    <Info
                      label="Rate"
                      value={`R${formatRate(
                        shift.hourly_rate,
                      )}/hour`}
                    />
                  </div>

                  {!application ? (
                    <button
                      type="button"
                      disabled={isApplying}
                      onClick={() =>
                        applyForShift(
                          shift.id,
                        )
                      }
                      style={{
                        ...styles.button,
                        opacity: isApplying
                          ? 0.65
                          : 1,
                      }}
                    >
                      {isApplying
                        ? "Submitting..."
                        : "Apply for Shift"}
                    </button>
                  ) : (
                    <div
                      style={
                        styles.applicationNotice
                      }
                    >
                      {applicationStatus ===
                      "accepted"
                        ? "✓ Your application has been approved."
                        : applicationStatus ===
                            "declined"
                          ? "Your application was declined."
                          : "Your application is pending employer review."}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>
        {label}
      </span>

      <strong style={styles.infoValue}>
        {value}
      </strong>
    </div>
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

  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },

  back: {
    color: "#0f766e",
    fontWeight: 800,
    textDecoration: "none",
  },

  hero: {
    background:
      "linear-gradient(135deg,#0f172a,#0f766e)",
    color: "white",
    padding: "30px",
    borderRadius: "24px",
    margin: "20px 0",
  },

  title: {
    fontSize: "36px",
    margin: 0,
  },

  subtitle: {
    color: "#dbeafe",
    marginBottom: 0,
  },

  message: {
    padding: "14px",
    borderRadius: "14px",
    marginBottom: "18px",
    fontWeight: 700,
  },

  successMessage: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
  },

  errorMessage: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(280px,1fr))",
    gap: "18px",
  },

  card: {
    background: "white",
    padding: "22px",
    borderRadius: "22px",
    boxShadow:
      "0 8px 24px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "16px",
  },

  cardTitle: {
    margin: 0,
    color: "#0f172a",
  },

  profession: {
    color: "#64748b",
    margin: "5px 0 0",
  },

  detailsGrid: {
    display: "grid",
    gap: "10px",
    marginBottom: "18px",
  },

  infoItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 0",
    borderBottom:
      "1px solid #e2e8f0",
  },

  infoLabel: {
    color: "#64748b",
  },

  infoValue: {
    color: "#334155",
    textAlign: "right",
  },

  button: {
    width: "100%",
    padding: "14px",
    border: "none",
    borderRadius: "14px",
    background: "#0f766e",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },

  empty: {
    background: "white",
    padding: "24px",
    borderRadius: "20px",
  },

  statusBadge: {
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: "11px",
    fontWeight: 900,
  },

  pending: {
    background: "#fef3c7",
    color: "#92400e",
  },

  accepted: {
    background: "#dcfce7",
    color: "#166534",
  },

  declined: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  applicationNotice: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    padding: "13px",
    borderRadius: "12px",
    fontWeight: 700,
    textAlign: "center",
  },
};
