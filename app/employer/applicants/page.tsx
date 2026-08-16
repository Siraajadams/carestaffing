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

  const [applications, setApplications] =
    useState<Application[]>([]);

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] =
    useState<"success" | "error" | "">("");

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  useEffect(() => {
    void loadApplications();
  }, [shiftFilter]);

  function getApplicantId(
    application: Pick<
      Application,
      "applicant_id" | "locum_id"
    >,
  ) {
    return (
      application.applicant_id ||
      application.locum_id ||
      null
    );
  }

  // =========================================================
  // LOAD APPLICATIONS
  // =========================================================

  async function loadApplications() {
    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      // -------------------------------------------------------
      // 1. Logged-in employer
      // -------------------------------------------------------

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      // -------------------------------------------------------
      // 2. Get employer shifts
      // -------------------------------------------------------

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
        shiftsQuery =
          shiftsQuery.eq("id", shiftFilter);
      }

      const {
        data: employerShifts,
        error: shiftsError,
      } = await shiftsQuery;

      if (shiftsError) {
        console.error(
          "Employer shifts error:",
          shiftsError,
        );

        throw new Error(
          shiftsError.message ||
            "Could not load employer shifts.",
        );
      }

      const shifts: Shift[] =
        employerShifts || [];

      const shiftIds =
        shifts.map((shift) => shift.id);

      console.log(
        "Employer:",
        user.id,
      );

      console.log(
        "Employer shifts:",
        shifts,
      );

      if (shiftIds.length === 0) {
        setApplications([]);
        return;
      }

      // -------------------------------------------------------
      // 3. Load applications
      // -------------------------------------------------------

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
          "Application loading error:",
          applicationsError,
        );

        throw new Error(
          applicationsError.message ||
            "Could not load shift applications.",
        );
      }

      // -------------------------------------------------------
      // 4. Find applicant IDs
      // -------------------------------------------------------

      const applicantIds = [
        ...new Set(
          (applicationRows || [])
            .map(
              (application) =>
                application.applicant_id ||
                application.locum_id ||
                null,
            )
            .filter(Boolean),
        ),
      ] as string[];

      // -------------------------------------------------------
      // 5. Get applicant profiles
      // -------------------------------------------------------

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
        } else {
          profiles =
            profileRows || [];
        }
      }

      // -------------------------------------------------------
      // 6. Combine everything
      // -------------------------------------------------------

      const combined: Application[] =
        (applicationRows || []).map(
          (application) => {
            const applicantId =
              application.applicant_id ||
              application.locum_id ||
              null;

            return {
              ...application,

              shift:
                shifts.find(
                  (shift) =>
                    shift.id ===
                    application.shift_id,
                ) || null,

              applicant: applicantId
                ? profiles.find(
                    (profile) =>
                      profile.id ===
                      applicantId,
                  ) || null
                : null,
            };
          },
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

  // =========================================================
  // ACCEPT / DECLINE
  // =========================================================

  async function updateApplication(
    application: Application,
    nextStatus:
      | "accepted"
      | "declined"
      | "pending",
  ) {
    setMessage("");
    setMessageType("");
    setUpdatingId(application.id);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const applicantId =
        getApplicantId(application);

      if (!applicantId) {
        throw new Error(
          "This application does not contain an applicant/locum ID.",
        );
      }

      // -------------------------------------------------------
      // Security check:
      // ensure this shift belongs to logged-in employer
      // -------------------------------------------------------

      const {
        data: ownedShift,
        error: shiftError,
      } = await supabase
        .from("shifts")
        .select("id")
        .eq("id", application.shift_id)
        .eq("created_by", user.id)
        .maybeSingle();

      if (shiftError) {
        throw shiftError;
      }

      if (!ownedShift) {
        throw new Error(
          "You do not have permission to manage this application.",
        );
      }

      // -------------------------------------------------------
      // Update application
      // -------------------------------------------------------

      const now =
        new Date().toISOString();

      const {
        data: updatedRows,
        error: updateError,
      } = await supabase
        .from("shift_applications")
        .update({
          status: nextStatus,
          updated_at: now,
        })
        .eq("id", application.id)
        .eq(
          "shift_id",
          application.shift_id,
        )
        .select(`
          id,
          status,
          updated_at
        `);

      if (updateError) {
        console.error(
          "Update application error:",
          updateError,
        );

        throw updateError;
      }

      if (
        !updatedRows ||
        updatedRows.length === 0
      ) {
        throw new Error(
          "The application was not updated. Check the shift_applications RLS update policy.",
        );
      }

      // -------------------------------------------------------
      // Update UI immediately
      // -------------------------------------------------------

      setApplications((current) =>
        current.map((item) =>
          item.id === application.id
            ? {
                ...item,
                status: nextStatus,
                updated_at: now,
              }
            : item,
        ),
      );

      setMessageType("success");

      if (
        nextStatus === "accepted"
      ) {
        setMessage(
          "Applicant approved. The shift is now activated for this locum and their timesheet is available.",
        );
      }

      if (
        nextStatus === "declined"
      ) {
        setMessage(
          "Applicant declined. The shift remains available to other healthcare professionals.",
        );
      }

      if (
        nextStatus === "pending"
      ) {
        setMessage(
          "Applicant returned to pending.",
        );
      }
    } catch (error: any) {
      console.error(
        "Applicant status error:",
        error,
      );

      setMessageType("error");

      setMessage(
        error?.message ||
          "Could not update applicant status.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // =========================================================
  // LOGOUT
  // =========================================================

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

    if (
      Number.isNaN(date.getTime())
    ) {
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

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loadingCard}>
          <div
            style={{
              fontSize: 30,
            }}
          >
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

  // =========================================================
  // UI
  // =========================================================

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
              style={
                styles.activeNavLink
              }
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
              style={
                styles.logoutButton
              }
            >
              Logout
            </button>
          </div>
        </div>

        {/* HERO */}

        <section style={styles.hero}>
          <div>
            <p
              style={
                styles.heroLabel
              }
            >
              Employer Portal
            </p>

            <h1
              style={
                styles.heroTitle
              }
            >
              Applicants
            </h1>

            <p
              style={styles.heroText}
            >
              Review and approve
              healthcare professionals
              who have applied for your
              shifts.
            </p>
          </div>

          {shiftFilter && (
            <Link
              href="/employer/applicants"
              style={
                styles.clearFilter
              }
            >
              Show All Applicants
            </Link>
          )}
        </section>

        {/* MESSAGE */}

        {message && (
          <div
            style={
              messageType ===
              "success"
                ? styles.successMessage
                : styles.errorMessage
            }
          >
            {message}
          </div>
        )}

        {/* EMPTY */}

        {applications.length ===
        0 ? (
          <section
            style={styles.emptyCard}
          >
            <div
              style={
                styles.emptyIcon
              }
            >
              👩‍⚕️
            </div>

            <h2>
              No applicants yet
            </h2>

            <p style={styles.muted}>
              Applications from
              healthcare professionals
              will appear here.
            </p>

            <Link
              href="/employer/shifts"
              style={
                styles.primaryButton
              }
            >
              View My Shifts
            </Link>
          </section>
        ) : (
          <div
            style={
              styles.applicationList
            }
          >
            {applications.map(
              (application) => {
                const applicant =
                  application.applicant;

                const shift =
                  application.shift;

                const rawStatus = (
                  application.status ||
                  "pending"
                ).toLowerCase();

                // Existing applications may be stored as "applied".
                // Treat them as pending so the employer can approve/decline them.
                // Also normalize older alternative status names if they exist.
                const status =
                  rawStatus === "applied"
                    ? "pending"
                    : rawStatus === "approved"
                      ? "accepted"
                      : rawStatus === "rejected"
                        ? "declined"
                        : rawStatus;

                const applicantId =
                  getApplicantId(
                    application,
                  );

                const isUpdating =
                  updatingId ===
                  application.id;

                return (
                  <article
                    key={
                      application.id
                    }
                    style={
                      styles.applicationCard
                    }
                  >
                    {/* PERSON */}

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
                            ) ||
                              "HC"}
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
                              .filter(
                                Boolean,
                              )
                              .join(
                                " ",
                              ) ||
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
                              Applicant
                              ID:{" "}
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

                    {/* ACCEPTED NOTICE */}

                    {status ===
                      "accepted" && (
                      <div
                        style={
                          styles.timesheetActive
                        }
                      >
                        <div
                          style={{
                            fontSize: 24,
                          }}
                        >
                          ✓
                        </div>

                        <div>
                          <strong>
                            Applicant
                            Approved
                          </strong>

                          <p
                            style={{
                              margin:
                                "4px 0 0",
                            }}
                          >
                            Timesheet
                            activated for
                            this shift.
                            The locum can
                            now submit
                            their actual
                            daily start
                            and end times.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* DECLINED NOTICE */}

                    {status ===
                      "declined" && (
                      <div
                        style={
                          styles.declinedNotice
                        }
                      >
                        Applicant
                        declined. The
                        posted shift
                        remains
                        available for
                        another
                        healthcare
                        professional.
                      </div>
                    )}

                    {/* DETAILS */}

                    <div
                      style={
                        styles.infoGrid
                      }
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

                    {/* APPLICANT MESSAGE */}

                    {application.message && (
                      <div
                        style={
                          styles.messageBox
                        }
                      >
                        <strong>
                          Applicant
                          Message
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

                    {/* ACTIONS */}

                    <div
                      style={
                        styles.actions
                      }
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
                          ✉️ Email
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
                          📞 Call
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

                      {/* PENDING */}

                      {status ===
                        "pending" && (
                        <>
                          <button
                            type="button"
                            disabled={
                              isUpdating
                            }
                            onClick={() =>
                              updateApplication(
                                application,
                                "accepted",
                              )
                            }
                            style={{
                              ...styles.acceptButton,
                              opacity:
                                isUpdating
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            {isUpdating
                              ? "Updating..."
                              : "✓ Approve Applicant"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              isUpdating
                            }
                            onClick={() =>
                              updateApplication(
                                application,
                                "declined",
                              )
                            }
                            style={{
                              ...styles.declineButton,
                              opacity:
                                isUpdating
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            {isUpdating
                              ? "Updating..."
                              : "✕ Decline Applicant"}
                          </button>
                        </>
                      )}

                      {/* ACCEPTED */}

                      {status ===
                        "accepted" && (
                        <>
                          <Link
                            href={`/employer/shifts?shift=${application.shift_id}`}
                            style={
                              styles.secondaryButton
                            }
                          >
                            View Shift
                          </Link>

                          <button
                            type="button"
                            disabled={
                              isUpdating
                            }
                            onClick={() =>
                              updateApplication(
                                application,
                                "pending",
                              )
                            }
                            style={
                              styles.secondaryButton
                            }
                          >
                            Return to
                            Pending
                          </button>
                        </>
                      )}

                      {/* DECLINED */}

                      {status ===
                        "declined" && (
                        <button
                          type="button"
                          disabled={
                            isUpdating
                          }
                          onClick={() =>
                            updateApplication(
                              application,
                              "pending",
                            )
                          }
                          style={
                            styles.secondaryButton
                          }
                        >
                          Return to
                          Pending
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
      <span
        style={styles.infoLabel}
      >
        {label}
      </span>

      <strong
        style={styles.infoValue}
      >
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

  timesheetActive: {
    marginTop: 18,
    padding: 16,
    borderRadius: 14,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    background: "#dcfce7",
    color: "#166534",
    border:
      "1px solid #bbf7d0",
  },

  declinedNotice: {
    marginTop: 18,
    padding: 15,
    borderRadius: 12,
    background: "#fff7ed",
    color: "#9a3412",
    border:
      "1px solid #fed7aa",
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
    padding: "11px 16px",
    borderRadius: 10,
    border: "none",
    fontWeight: 900,
    cursor: "pointer",
  },

  declineButton: {
    background: "#fff1f2",
    color: "#b91c1c",
    padding: "11px 16px",
    borderRadius: 10,
    border:
      "1px solid #fecaca",
    fontWeight: 900,
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
  
