"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type ApplicantProfile = {
  id: string;
  first_name: string | null;
  surname: string | null;
  email: string | null;
  mobile: string | null;
  profession: string | null;
  registration_number: string | null;
  city: string | null;
  country: string | null;
  profile_photo_url: string | null;
  cv_url: string | null;
};

type Shift = {
  id: string;
  title: string | null;
  profession_required: string | null;
  business_name: string | null;
  start_date: string | null;
  city: string | null;
};

type Application = {
  id: string;
  shift_id: string;

  // Your table currently contains BOTH.
  applicant_id: string | null;
  locum_id: string | null;

  status: string | null;
  message: string | null;
  created_at: string | null;
  updated_at?: string | null;

  shift?: Shift | null;
  applicant?: ApplicantProfile | null;
};

export default function EmployerApplicantsPage() {
  return (
    <Suspense
      fallback={
        <main style={styles.loadingPage}>
          <div style={styles.loadingCard}>
            <h2>Loading Applicants</h2>
          </div>
        </main>
      }
    >
      <ApplicantsContent />
    </Suspense>
  );
}

function ApplicantsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const shiftFilter = searchParams.get("shift") || "";

  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<Application[]>([]);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<"success" | "error" | "">("");

  useEffect(() => {
    void loadApplications();
  }, [shiftFilter]);

  function getApplicantId(
    application: Pick<Application, "applicant_id" | "locum_id">,
  ) {
    return application.applicant_id || application.locum_id || null;
  }

  async function loadApplications() {
    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      // ---------------------------------------------------------
      // 1. Confirm logged-in employer
      // ---------------------------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      // ---------------------------------------------------------
      // 2. Get employer's shifts
      // ---------------------------------------------------------
      //
      // Your current shift-posting workflow uses created_by.
      // We keep this here so applicants only appear to the employer
      // who owns the shift.
      // ---------------------------------------------------------

      let shiftsQuery = supabase
        .from("shifts")
        .select(`
          id,
          title,
          profession_required,
          business_name,
          start_date,
          city
        `)
        .eq("created_by", user.id);

      if (shiftFilter) {
        shiftsQuery = shiftsQuery.eq("id", shiftFilter);
      }

      const {
        data: employerShifts,
        error: shiftsError,
      } = await shiftsQuery;

      if (shiftsError) {
        console.error("Employer shifts error:", shiftsError);

        throw new Error(
          shiftsError.message || "Could not load employer shifts.",
        );
      }

      const shifts: Shift[] = employerShifts || [];

      const shiftIds = shifts.map((shift) => shift.id);

      console.log("Employer:", user.id);
      console.log("Employer shifts:", shifts);
      console.log("Shift IDs:", shiftIds);

      if (shiftIds.length === 0) {
        setApplications([]);
        return;
      }

      // ---------------------------------------------------------
      // 3. Fetch applications
      // ---------------------------------------------------------
      //
      // IMPORTANT:
      // Your actual Supabase table contains:
      //
      // applicant_id
      // locum_id
      //
      // therefore BOTH are selected.
      // ---------------------------------------------------------

      const {
        data: applicationRows,
        error: applicationsError,
      } = await supabase
        .from("shift_applications")
        .select(`
          id,
          shift_id,
          applicant_id,
          locum_id,
          status,
          message,
          created_at,
          updated_at
        `)
        .in("shift_id", shiftIds)
        .order("created_at", {
          ascending: false,
        });

      if (applicationsError) {
        console.error(
          "Shift applications error:",
          applicationsError,
        );

        throw new Error(
          applicationsError.message ||
            "Could not load shift applications.",
        );
      }

      console.log(
        "Applications returned:",
        applicationRows,
      );

      // ---------------------------------------------------------
      // 4. Get all applicant IDs
      // ---------------------------------------------------------

      const applicantIds = [
        ...new Set(
          (applicationRows || [])
            .map((application) => {
              return (
                application.applicant_id ||
                application.locum_id ||
                null
              );
            })
            .filter(Boolean),
        ),
      ] as string[];

      console.log(
        "Applicant profile IDs:",
        applicantIds,
      );

      // ---------------------------------------------------------
      // 5. Fetch applicant profiles
      // ---------------------------------------------------------

      let profiles: ApplicantProfile[] = [];

      if (applicantIds.length > 0) {
        const {
          data: profileRows,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(`
            id,
            first_name,
            surname,
            email,
            mobile,
            profession,
            registration_number,
            city,
            country,
            profile_photo_url,
            cv_url
          `)
          .in("id", applicantIds);

        if (profileError) {
          console.error(
            "Applicant profiles error:",
            profileError,
          );

          // We do not stop loading the applications here.
          // Applications can still be displayed even if a profile
          // has incomplete details.
        } else {
          profiles = profileRows || [];
        }
      }

      console.log(
        "Applicant profiles returned:",
        profiles,
      );

      // ---------------------------------------------------------
      // 6. Combine application + shift + applicant
      // ---------------------------------------------------------

      const combined: Application[] = (
        applicationRows || []
      ).map((application) => {
        const applicantId =
          application.applicant_id ||
          application.locum_id ||
          null;

        return {
          ...application,

          shift:
            shifts.find(
              (shift) =>
                shift.id === application.shift_id,
            ) || null,

          applicant: applicantId
            ? profiles.find(
                (profile) =>
                  profile.id === applicantId,
              ) || null
            : null,
        };
      });

      console.log(
        "Combined applicant records:",
        combined,
      );

      setApplications(combined);
    } catch (error: any) {
      console.error(
        "Load applicants error:",
        error,
      );

      setMessageType("error");

      setMessage(
        error?.message ||
          "Could not load applicants.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateApplication(
    applicationId: string,
    status: string,
  ) {
    setMessage("");
    setMessageType("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { error } = await supabase
        .from("shift_applications")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);

      if (error) {
        console.error(
          "Update applicant status error:",
          error,
        );

        throw error;
      }

      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId
            ? {
                ...application,
                status,
                updated_at:
                  new Date().toISOString(),
              }
            : application,
        ),
      );

      setMessageType("success");

      if (status === "accepted") {
        setMessage(
          "Applicant accepted successfully.",
        );
      } else if (status === "declined") {
        setMessage("Applicant declined.");
      } else {
        setMessage(
          "Applicant returned to pending.",
        );
      }
    } catch (error: any) {
      console.error(
        "Update applicant error:",
        error,
      );

      setMessageType("error");

      setMessage(
        error?.message ||
          "Could not update applicant.",
      );
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function initials(
    first?: string | null,
    surname?: string | null,
  ) {
    return `${first?.[0] || ""}${
      surname?.[0] || ""
    }`.toUpperCase();
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

  function cleanPhone(
    value?: string | null,
  ) {
    return (value || "").replace(
      /[^0-9+]/g,
      "",
    );
  }

  if (loading) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <div style={{ fontSize: 30 }}>
            ⏳
          </div>

          <h2>
            Loading Applicants
          </h2>

          <p style={styles.muted}>
            Loading healthcare
            professionals who applied for
            your shifts...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {/* TOP NAV */}

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
              style={styles.activeNavLink}
            >
              Applicants
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

        <section style={styles.hero}>
          <div>
            <p style={styles.heroLabel}>
              Employer Portal
            </p>

            <h1 style={styles.heroTitle}>
              Applicants
            </h1>

            <p style={styles.heroText}>
              Review healthcare
              professionals who have
              applied for your shifts.
            </p>
          </div>

          {shiftFilter && (
            <Link
              href="/employer/applicants"
              style={styles.clearFilter}
            >
              Show All Applicants
            </Link>
          )}
        </section>

        {/* MESSAGE */}

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

        {/* EMPTY */}

        {applications.length === 0 ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyIcon}>
              👩‍⚕️
            </div>

            <h2>No applicants yet</h2>

            <p style={styles.muted}>
              Applications from
              healthcare professionals
              will appear here.
            </p>

            <Link
              href="/employer/shifts"
              style={styles.primaryButton}
            >
              View My Shifts
            </Link>
          </section>
        ) : (
          /* APPLICATIONS */

          <div style={styles.applicationList}>
            {applications.map(
              (application) => {
                const applicant =
                  application.applicant;

                const shift =
                  application.shift;

                const status = (
                  application.status ||
                  "pending"
                ).toLowerCase();

                const applicantId =
                  getApplicantId(
                    application,
                  );

                return (
                  <article
                    key={application.id}
                    style={
                      styles.applicationCard
                    }
                  >
                    <div
                      style={
                        styles.applicationHeader
                      }
                    >
                      <div
                        style={
                          styles.personSection
                        }
                      >
                        {applicant?.profile_photo_url ? (
                          <img
                            src={
                              applicant.profile_photo_url
                            }
                            alt="Applicant profile"
                            style={
                              styles.avatar
                            }
                          />
                        ) : (
                          <div
                            style={
                              styles.avatarFallback
                            }
                          >
                            {initials(
                              applicant?.first_name,
                              applicant?.surname,
                            ) || "HC"}
                          </div>
                        )}

                        <div>
                          <h2
                            style={
                              styles.applicantName
                            }
                          >
                            {[
                              applicant?.first_name,
                              applicant?.surname,
                            ]
                              .filter(Boolean)
                              .join(" ") ||
                              "Healthcare Professional"}
                          </h2>

                          <p
                            style={
                              styles.applicantProfession
                            }
                          >
                            {applicant?.profession ||
                              shift?.profession_required ||
                              "Healthcare Professional"}
                          </p>

                          {!applicant && (
                            <p
                              style={
                                styles.profileWarning
                              }
                            >
                              Applicant ID:{" "}
                              {applicantId ||
                                "Not available"}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        style={{
                          ...styles.statusBadge,

                          ...(status ===
                          "accepted"
                            ? styles.accepted
                            : status ===
                                "declined"
                              ? styles.declined
                              : styles.pending),
                        }}
                      >
                        {status.toUpperCase()}
                      </span>
                    </div>

                    <div
                      style={styles.infoGrid}
                    >
                      <Info
                        label="Applied For"
                        value={
                          shift?.title ||
                          "Shift"
                        }
                      />

                      <Info
                        label="Profession"
                        value={
                          applicant?.profession ||
                          shift?.profession_required ||
                          "—"
                        }
                      />

                      <Info
                        label="Shift Date"
                        value={
                          shift?.start_date
                            ? formatDate(
                                shift.start_date,
                              )
                            : "—"
                        }
                      />

                      <Info
                        label="Location"
                        value={
                          shift?.city ||
                          applicant?.city ||
                          "—"
                        }
                      />

                      <Info
                        label="Registration"
                        value={
                          applicant?.registration_number ||
                          "—"
                        }
                      />

                      <Info
                        label="Email"
                        value={
                          applicant?.email ||
                          "—"
                        }
                      />

                      <Info
                        label="Mobile"
                        value={
                          applicant?.mobile ||
                          "—"
                        }
                      />

                      <Info
                        label="Country"
                        value={
                          applicant?.country ||
                          "—"
                        }
                      />

                      <Info
                        label="Applied"
                        value={
                          application.created_at
                            ? formatDate(
                                application.created_at,
                              )
                            : "—"
                        }
                      />
                    </div>

                    {application.message && (
                      <div
                        style={
                          styles.messageBox
                        }
                      >
                        <strong>
                          Applicant Message
                        </strong>

                        <p
                          style={{
                            marginBottom: 0,
                          }}
                        >
                          {
                            application.message
                          }
                        </p>
                      </div>
                    )}

                    <div
                      style={styles.actions}
                    >
                      {applicant?.cv_url && (
                        <a
                          href={
                            applicant.cv_url
                          }
                          target="_blank"
                          rel="noreferrer"
                          style={
                            styles.secondaryButton
                          }
                        >
                          📄 View CV
                        </a>
                      )}

                      {applicant?.email && (
                        <a
                          href={`mailto:${applicant.email}`}
                          style={
                            styles.secondaryButton
                          }
                        >
                          ✉️ Email Applicant
                        </a>
                      )}

                      {applicant?.mobile && (
                        <a
                          href={`tel:${cleanPhone(
                            applicant.mobile,
                          )}`}
                          style={
                            styles.secondaryButton
                          }
                        >
                          📞 Call Applicant
                        </a>
                      )}

                      {applicant?.mobile && (
                        <a
                          href={`https://wa.me/${cleanPhone(
                            applicant.mobile,
                          ).replace(
                            /^\+/,
                            "",
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          style={
                            styles.secondaryButton
                          }
                        >
                          WhatsApp
                        </a>
                      )}

                      {status ===
                        "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              updateApplication(
                                application.id,
                                "accepted",
                              )
                            }
                            style={
                              styles.acceptButton
                            }
                          >
                            ✓ Accept
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateApplication(
                                application.id,
                                "declined",
                              )
                            }
                            style={
                              styles.declineButton
                            }
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {status !==
                        "pending" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateApplication(
                              application.id,
                              "pending",
                            )
                          }
                          style={
                            styles.secondaryButton
                          }
                        >
                          Return to Pending
                        </button>
                      )}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
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
    padding: 24,
    fontFamily:
      "Arial, sans-serif",
  },

  loadingPage: {
    minHeight: "100vh",
    background: "#f1f5f9",
    display: "grid",
    placeItems: "center",
    padding: 24,
  },

  loadingCard: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 30,
    textAlign: "center",
  },

  muted: {
    color: "#64748b",
  },

  container: {
    width: "100%",
    maxWidth: 1100,
    margin: "0 auto",
  },

  topBar: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
    marginBottom: 20,
  },

  brand: {
    color: "#0f766e",
    textDecoration: "none",
    fontWeight: 900,
    letterSpacing: 1,
  },

  topActions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },

  navLink: {
    color: "#475569",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 14,
  },

  activeNavLink: {
    color: "#0f766e",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },

  logoutButton: {
    border:
      "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    padding: "9px 13px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
  },

  hero: {
    background:
      "linear-gradient(135deg,#0f172a,#0f766e)",
    color: "#ffffff",
    padding: 30,
    borderRadius: 24,
    marginBottom: 20,
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  },

  heroLabel: {
    margin: "0 0 7px",
    color: "#99f6e4",
    fontWeight: 900,
    letterSpacing: 1,
    fontSize: 13,
    textTransform:
      "uppercase",
  },

  heroTitle: {
    margin: 0,
    fontSize: 38,
  },

  heroText: {
    color: "#cbd5e1",
    marginBottom: 0,
  },

  clearFilter: {
    background: "#ffffff",
    color: "#0f766e",
    padding: "11px 15px",
    borderRadius: 11,
    textDecoration: "none",
    fontWeight: 800,
  },

  applicationList: {
    display: "grid",
    gap: 18,
  },

  applicationCard: {
    background: "#ffffff",
    borderRadius: 20,
    padding: 24,
    border:
      "1px solid #e2e8f0",
  },

  applicationHeader: {
    display: "flex",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
  },

  personSection: {
    display: "flex",
    gap: 14,
    alignItems: "center",
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 999,
    objectFit: "cover",
    border:
      "2px solid #ccfbf1",
  },

  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 999,
    background: "#ccfbf1",
    color: "#0f766e",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 20,
  },

  applicantName: {
    margin: 0,
    color: "#0f172a",
  },

  applicantProfession: {
    color: "#64748b",
    margin: "5px 0 0",
  },

  profileWarning: {
    color: "#b45309",
    fontSize: 12,
    marginTop: 5,
  },

  statusBadge: {
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 11,
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

  infoGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(170px,1fr))",
    gap: 12,
    marginTop: 20,
  },

  infoItem: {
    padding: 13,
    background: "#f8fafc",
    borderRadius: 12,
    display: "grid",
    gap: 4,
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 12,
  },

  infoValue: {
    color: "#334155",
    wordBreak: "break-word",
  },

  messageBox: {
    marginTop: 16,
    padding: 15,
    background: "#f8fafc",
    borderRadius: 12,
    color: "#475569",
  },

  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },

  primaryButton: {
    background: "#0f766e",
    color: "#ffffff",
    padding: "11px 15px",
    borderRadius: 10,
    border: "none",
    textDecoration: "none",
    fontWeight: 800,
    cursor: "pointer",
  },

  secondaryButton: {
    background: "#ffffff",
    color: "#334155",
    padding: "11px 15px",
    borderRadius: 10,
    border:
      "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
    cursor: "pointer",
  },

  acceptButton: {
    background: "#0f766e",
    color: "#ffffff",
    padding: "11px 15px",
    borderRadius: 10,
    border: "none",
    fontWeight: 800,
    cursor: "pointer",
  },

  declineButton: {
    background: "#fff1f2",
    color: "#b91c1c",
    padding: "11px 15px",
    borderRadius: 10,
    border:
      "1px solid #fecaca",
    fontWeight: 800,
    cursor: "pointer",
  },

  emptyCard: {
    background: "#ffffff",
    padding: 40,
    borderRadius: 20,
    textAlign: "center",
    border:
      "1px solid #e2e8f0",
  },

  emptyIcon: {
    fontSize: 42,
  },

  successMessage: {
    background: "#dcfce7",
    color: "#166534",
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
  },

  errorMessage: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
  },
};
