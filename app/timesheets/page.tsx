"use client";

import Link from "next/link";
import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Shift = {
  id: string;
  title: string | null;

  // IMPORTANT:
  // Your shifts table uses profession_required, not profession.
  profession_required: string | null;

  location: string | null;
  city?: string | null;

  shift_date: string | null;
  start_time: string | null;
  end_time: string | null;

  locum_rate: number | null;
  status: string | null;
};

type Timesheet = {
  id: string;
  shift_id: string;
  locum_id: string;

  work_date: string;

  start_time: string;
  end_time: string;

  break_minutes: number;

  hours_worked: number | null;

  agreed_rate?: number | null;
  total_amount?: number | null;

  notes: string | null;

  status: string;

  submitted_at: string | null;
  approved_at?: string | null;
};

export default function TimesheetsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);

  const [selectedShiftId, setSelectedShiftId] =
    useState("");

  const [workDate, setWorkDate] = useState("");

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [breakMinutes, setBreakMinutes] =
    useState("0");

  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void initialise();
  }, []);

  async function initialise() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      await Promise.all([
        loadAcceptedShifts(user.id),
        loadTimesheets(user.id),
      ]);
    } catch (err: any) {
      console.error("Timesheet initialise error:", err);

      setError(
        err?.message ||
          "Could not load timesheets."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAcceptedShifts(
    locumId: string
  ) {
    /*
     * Some of your earlier application records used
     * locum_id and some workflows referenced applicant_id.
     *
     * We allow either so an accepted application is not
     * accidentally hidden from the timesheet page.
     */
    const {
      data: applications,
      error: applicationError,
    } = await supabase
      .from("shift_applications")
      .select(
        `
        id,
        shift_id,
        locum_id,
        applicant_id,
        status
        `
      )
      .or(
        `locum_id.eq.${locumId},applicant_id.eq.${locumId}`
      )
      .eq("status", "accepted");

    if (applicationError) {
      console.error(
        "Accepted applications error:",
        applicationError
      );

      throw applicationError;
    }

    console.log(
      "Accepted applications:",
      applications
    );

    const shiftIds = Array.from(
      new Set(
        (applications || [])
          .map((row: any) => row.shift_id)
          .filter(Boolean)
      )
    );

    if (shiftIds.length === 0) {
      setShifts([]);
      return;
    }

    const {
      data: shiftData,
      error: shiftError,
    } = await supabase
      .from("shifts")
      .select(
        `
        id,
        title,
        profession_required,
        location,
        city,
        shift_date,
        start_time,
        end_time,
        locum_rate,
        status
        `
      )
      .in("id", shiftIds)
      .order("shift_date", {
        ascending: false,
      });

    if (shiftError) {
      console.error(
        "Accepted shift load error:",
        shiftError
      );

      throw shiftError;
    }

    console.log(
      "Accepted shifts:",
      shiftData
    );

    setShifts(
      (shiftData || []) as Shift[]
    );
  }

  async function loadTimesheets(
    locumId: string
  ) {
    const {
      data,
      error: timesheetError,
    } = await supabase
      .from("timesheets")
      .select("*")
      .eq("locum_id", locumId)
      .order("work_date", {
        ascending: false,
      });

    if (timesheetError) {
      console.error(
        "Timesheet load error:",
        timesheetError
      );

      throw timesheetError;
    }

    setTimesheets(
      (data || []) as Timesheet[]
    );
  }

  const calculatedHours = useMemo(() => {
    if (!startTime || !endTime) {
      return 0;
    }

    const [startHour, startMinute] =
      startTime
        .split(":")
        .map(Number);

    const [endHour, endMinute] =
      endTime
        .split(":")
        .map(Number);

    if (
      Number.isNaN(startHour) ||
      Number.isNaN(startMinute) ||
      Number.isNaN(endHour) ||
      Number.isNaN(endMinute)
    ) {
      return 0;
    }

    let start =
      startHour * 60 + startMinute;

    let end =
      endHour * 60 + endMinute;

    // Allow overnight shifts.
    if (end < start) {
      end += 24 * 60;
    }

    const breaks = Math.max(
      0,
      Number(breakMinutes) || 0
    );

    const workedMinutes = Math.max(
      0,
      end - start - breaks
    );

    return Number(
      (workedMinutes / 60).toFixed(2)
    );
  }, [
    startTime,
    endTime,
    breakMinutes,
  ]);

  const selectedShift = shifts.find(
    (shift) =>
      shift.id === selectedShiftId
  );

  const agreedRate = Number(
    selectedShift?.locum_rate || 0
  );

  const estimatedPay =
    calculatedHours * agreedRate;

  async function submitTimesheet(
    event: FormEvent
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!userId) {
      setError(
        "Your login session could not be confirmed. Please log in again."
      );
      return;
    }

    if (!selectedShiftId) {
      setError(
        "Please select an accepted shift."
      );
      return;
    }

    if (!selectedShift) {
      setError(
        "The selected shift could not be found."
      );
      return;
    }

    if (!workDate) {
      setError(
        "Please select the date worked."
      );
      return;
    }

    if (!startTime || !endTime) {
      setError(
        "Please enter both the actual start time and actual end time."
      );
      return;
    }

    if (calculatedHours <= 0) {
      setError(
        "Hours worked must be greater than zero."
      );
      return;
    }

    if (Number(breakMinutes || 0) < 0) {
      setError(
        "Break minutes cannot be negative."
      );
      return;
    }

    setSaving(true);

    try {
      /*
       * First check whether this worker has already
       * submitted a timesheet for this shift/date.
       *
       * This is safer than relying on an upsert constraint
       * that may not yet exist in your database.
       */
      const {
        data: existing,
        error: existingError,
      } = await supabase
        .from("timesheets")
        .select("id,status")
        .eq("shift_id", selectedShiftId)
        .eq("locum_id", userId)
        .eq("work_date", workDate)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      /*
       * Once the employer approves the timesheet,
       * the locum should not overwrite it.
       */
      if (
        existing?.status
          ?.toLowerCase() === "approved"
      ) {
        setError(
          "This timesheet has already been approved by the employer and can no longer be changed."
        );

        setSaving(false);
        return;
      }

      const payload = {
        shift_id: selectedShiftId,
        locum_id: userId,

        work_date: workDate,

        start_time: startTime,
        end_time: endTime,

        break_minutes:
          Number(breakMinutes) || 0,

        hours_worked:
          calculatedHours,

        agreed_rate:
          agreedRate,

        total_amount:
          estimatedPay,

        notes:
          notes.trim() || null,

        status:
          "submitted",

        submitted_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      };

      if (existing?.id) {
        const {
          error: updateError,
        } = await supabase
          .from("timesheets")
          .update(payload)
          .eq("id", existing.id)
          .eq("locum_id", userId);

        if (updateError) {
          throw updateError;
        }

        setMessage(
          "Timesheet updated and resubmitted successfully."
        );
      } else {
        const {
          error: insertError,
        } = await supabase
          .from("timesheets")
          .insert(payload);

        if (insertError) {
          throw insertError;
        }

        setMessage(
          "Timesheet submitted successfully. It is now awaiting employer approval."
        );
      }

      setSelectedShiftId("");
      setWorkDate("");
      setStartTime("");
      setEndTime("");
      setBreakMinutes("0");
      setNotes("");

      await loadTimesheets(userId);
    } catch (err: any) {
      console.error(
        "Timesheet save error:",
        err
      );

      setError(
        err?.message ||
          "Could not submit the timesheet."
      );
    } finally {
      setSaving(false);
    }
  }

  function chooseShift(
    shiftId: string
  ) {
    setSelectedShiftId(shiftId);

    const shift = shifts.find(
      (item) => item.id === shiftId
    );

    if (!shift) {
      return;
    }

    if (shift.shift_date) {
      setWorkDate(shift.shift_date);
    }

    /*
     * Pre-fill the scheduled times.
     * The worker can still change them to actual times worked.
     */
    if (shift.start_time) {
      setStartTime(
        shift.start_time.slice(0, 5)
      );
    }

    if (shift.end_time) {
      setEndTime(
        shift.end_time.slice(0, 5)
      );
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.loadingCard}>
            <strong>
              Loading CareStaffing timesheets...
            </strong>
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
          <p style={styles.eyebrow}>
            CARESTAFFING
          </p>

          <h1 style={styles.title}>
            Timesheets
          </h1>

          <p style={styles.subtitle}>
            Record your actual start and end
            times for every day worked.
          </p>
        </section>

        {message && (
          <div style={styles.success}>
            ✓ {message}
          </div>
        )}

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {shifts.length === 0 ? (
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>
              No accepted shifts
            </h2>

            <p style={styles.help}>
              Once an employer accepts your
              application, the accepted shift will
              appear here and you can submit the
              actual hours that you worked.
            </p>

            <Link
              href="/shifts"
              style={styles.primaryLink}
            >
              Find Shifts
            </Link>
          </section>
        ) : (
          <form
            onSubmit={submitTimesheet}
            style={styles.card}
          >
            <div style={styles.sectionHeader}>
              <div style={styles.stepNumber}>
                1
              </div>

              <div>
                <h2 style={styles.cardTitle}>
                  Complete Daily Timesheet
                </h2>

                <p style={styles.helpNoMargin}>
                  Select your accepted shift and
                  enter the actual times worked.
                </p>
              </div>
            </div>

            <div style={styles.grid}>
              <Field label="Accepted Shift">
                <select
                  value={selectedShiftId}
                  onChange={(e) =>
                    chooseShift(
                      e.target.value
                    )
                  }
                  style={styles.input}
                  required
                >
                  <option value="">
                    Select accepted shift
                  </option>

                  {shifts.map(
                    (shift) => (
                      <option
                        key={shift.id}
                        value={shift.id}
                      >
                        {shift.title ||
                          shift.profession_required ||
                          "Healthcare shift"}

                        {" — "}

                        {shift.location ||
                          shift.city ||
                          ""}

                        {" — "}

                        {formatDate(
                          shift.shift_date
                        )}
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Date Worked">
                <input
                  type="date"
                  value={workDate}
                  onChange={(e) =>
                    setWorkDate(
                      e.target.value
                    )
                  }
                  style={styles.input}
                  required
                />
              </Field>

              <Field label="Actual Start Time">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) =>
                    setStartTime(
                      e.target.value
                    )
                  }
                  style={styles.input}
                  required
                />
              </Field>

              <Field label="Actual End Time">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) =>
                    setEndTime(
                      e.target.value
                    )
                  }
                  style={styles.input}
                  required
                />
              </Field>

              <Field label="Break Minutes">
                <input
                  type="number"
                  min="0"
                  max="1440"
                  step="1"
                  value={breakMinutes}
                  onChange={(e) =>
                    setBreakMinutes(
                      e.target.value
                    )
                  }
                  style={styles.input}
                />
              </Field>

              <Field label="Calculated Hours">
                <input
                  value={calculatedHours.toFixed(
                    2
                  )}
                  readOnly
                  style={{
                    ...styles.input,
                    background: "#f1f5f9",
                    fontWeight: 800,
                  }}
                />
              </Field>
            </div>

            {selectedShift && (
              <>
                <div style={styles.shiftSummary}>
                  <SummaryItem
                    label="Profession"
                    value={
                      selectedShift.profession_required ||
                      "—"
                    }
                  />

                  <SummaryItem
                    label="Scheduled"
                    value={`${formatTime(
                      selectedShift.start_time
                    )} – ${formatTime(
                      selectedShift.end_time
                    )}`}
                  />

                  <SummaryItem
                    label="Locum Rate"
                    value={`R${agreedRate.toFixed(
                      2
                    )}/hour`}
                  />

                  <SummaryItem
                    label="Hours Worked"
                    value={`${calculatedHours.toFixed(
                      2
                    )} hours`}
                  />

                  <SummaryItem
                    label="Estimated Gross"
                    value={`R${estimatedPay.toFixed(
                      2
                    )}`}
                    highlight
                  />
                </div>

                <div style={styles.notice}>
                  Enter your <strong>actual</strong>{" "}
                  time started and ended. The
                  employer will review these hours
                  before approving payment.
                </div>
              </>
            )}

            <div style={{ marginTop: "18px" }}>
              <Field label="Notes">
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) =>
                    setNotes(
                      e.target.value
                    )
                  }
                  placeholder="Optional note, e.g. started 15 minutes late at employer request."
                  style={{
                    ...styles.input,
                    resize: "vertical",
                  }}
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={
                saving ||
                !selectedShiftId ||
                calculatedHours <= 0
              }
              style={{
                ...styles.submit,
                opacity:
                  saving ||
                  !selectedShiftId ||
                  calculatedHours <= 0
                    ? 0.6
                    : 1,
              }}
            >
              {saving
                ? "Submitting Timesheet..."
                : "Submit Timesheet for Employer Approval"}
            </button>
          </form>
        )}

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div style={styles.stepNumber}>
              2
            </div>

            <div>
              <h2 style={styles.cardTitle}>
                Submitted Timesheets
              </h2>

              <p style={styles.helpNoMargin}>
                Track submitted and approved
                hours.
              </p>
            </div>
          </div>

          {timesheets.length === 0 ? (
            <p style={styles.help}>
              No timesheets submitted yet.
            </p>
          ) : (
            <div style={styles.timesheetList}>
              {timesheets.map(
                (entry) => {
                  const shift =
                    shifts.find(
                      (item) =>
                        item.id ===
                        entry.shift_id
                    );

                  const total =
                    Number(
                      entry.total_amount ||
                        0
                    ) ||
                    Number(
                      entry.hours_worked ||
                        0
                    ) *
                      Number(
                        entry.agreed_rate ||
                          shift?.locum_rate ||
                          0
                      );

                  return (
                    <article
                      key={entry.id}
                      style={
                        styles.timesheetRow
                      }
                    >
                      <div>
                        <strong>
                          {shift?.title ||
                            shift?.profession_required ||
                            "Healthcare Shift"}
                        </strong>

                        <div
                          style={
                            styles.smallText
                          }
                        >
                          {formatDate(
                            entry.work_date
                          )}
                        </div>
                      </div>

                      <div>
                        <strong>
                          {formatTime(
                            entry.start_time
                          )}{" "}
                          –{" "}
                          {formatTime(
                            entry.end_time
                          )}
                        </strong>

                        <div
                          style={
                            styles.smallText
                          }
                        >
                          Break:{" "}
                          {entry.break_minutes ||
                            0}{" "}
                          min
                        </div>
                      </div>

                      <div>
                        <strong>
                          {Number(
                            entry.hours_worked ||
                              0
                          ).toFixed(2)}{" "}
                          hrs
                        </strong>

                        <div
                          style={
                            styles.smallText
                          }
                        >
                          R
                          {total.toFixed(2)}
                        </div>
                      </div>

                      <StatusBadge
                        status={
                          entry.status
                        }
                      />
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        {label}
      </span>

      {children}
    </label>
  );
}

function SummaryItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div style={styles.summaryItem}>
      <span style={styles.summaryLabel}>
        {label}
      </span>

      <strong
        style={
          highlight
            ? styles.summaryHighlight
            : undefined
        }
      >
        {value}
      </strong>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    status?.toLowerCase() ||
    "submitted";

  let badgeStyle: React.CSSProperties =
    styles.badge;

  if (normalized === "approved") {
    badgeStyle = {
      ...styles.badge,
      background: "#dcfce7",
      color: "#166534",
    };
  } else if (
    normalized === "rejected" ||
    normalized === "declined"
  ) {
    badgeStyle = {
      ...styles.badge,
      background: "#fee2e2",
      color: "#991b1b",
    };
  } else {
    badgeStyle = {
      ...styles.badge,
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  return (
    <span style={badgeStyle}>
      {normalized.toUpperCase()}
    </span>
  );
}

function formatDate(
  value: string | null
) {
  if (!value) return "No date";

  const date = new Date(
    `${value}T00:00:00`
  );

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
    }
  );
}

function formatTime(
  value: string | null | undefined
) {
  if (!value) return "—";

  return value.slice(0, 5);
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "30px 20px 60px",
    fontFamily: "Arial, sans-serif",
  },

  container: {
    maxWidth: "1180px",
    margin: "0 auto",
  },

  back: {
    color: "#0f766e",
    fontWeight: 800,
    textDecoration: "none",
  },

  hero: {
    marginTop: "20px",
    padding: "34px",
    borderRadius: "28px",
    background:
      "linear-gradient(135deg,#0f172a,#312e81)",
    color: "white",
  },

  eyebrow: {
    margin: 0,
    color: "#c4b5fd",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },

  title: {
    margin: "8px 0",
    fontSize: "42px",
  },

  subtitle: {
    margin: 0,
    color: "#e0e7ff",
    fontSize: "17px",
  },

  loadingCard: {
    marginTop: "30px",
    padding: "25px",
    background: "white",
    borderRadius: "18px",
    textAlign: "center",
  },

  card: {
    marginTop: "22px",
    background: "white",
    borderRadius: "22px",
    padding: "26px",
    boxShadow:
      "0 12px 30px rgba(15,23,42,0.06)",
  },

  cardTitle: {
    margin: 0,
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "22px",
  },

  stepNumber: {
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    display: "grid",
    placeItems: "center",
    background: "#ccfbf1",
    color: "#0f766e",
    fontWeight: 900,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(230px,1fr))",
    gap: "16px",
  },

  field: {
    display: "grid",
    gap: "7px",
  },

  label: {
    fontWeight: 800,
    color: "#334155",
  },

  input: {
    width: "100%",
    minHeight: "50px",
    border:
      "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "15px",
    boxSizing: "border-box",
  },

  shiftSummary: {
    marginTop: "20px",
    padding: "20px",
    borderRadius: "16px",
    background: "#ecfeff",
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(150px,1fr))",
    gap: "15px",
  },

  summaryItem: {
    display: "grid",
    gap: "5px",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
  },

  summaryHighlight: {
    color: "#0f766e",
    fontSize: "18px",
  },

  notice: {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "12px",
    background: "#eff6ff",
    color: "#1e3a8a",
    lineHeight: 1.5,
  },

  submit: {
    marginTop: "20px",
    width: "100%",
    padding: "16px",
    border: "none",
    borderRadius: "13px",

    // Neon green to make submission very obvious.
    background: "#39ff14",
    color: "#052e16",

    fontWeight: 900,
    fontSize: "15px",
    cursor: "pointer",
    boxShadow:
      "0 0 16px rgba(57,255,20,0.30)",
  },

  success: {
    marginTop: "20px",
    padding: "14px 16px",
    borderRadius: "12px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 800,
  },

  error: {
    marginTop: "20px",
    padding: "14px 16px",
    borderRadius: "12px",
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 800,
  },

  help: {
    color: "#64748b",
    lineHeight: 1.5,
  },

  helpNoMargin: {
    margin: "4px 0 0",
    color: "#64748b",
  },

  primaryLink: {
    display: "inline-block",
    marginTop: "10px",
    padding: "12px 18px",
    borderRadius: "12px",
    background: "#0f766e",
    color: "white",
    textDecoration: "none",
    fontWeight: 800,
  },

  timesheetList: {
    display: "grid",
    gap: "12px",
  },

  timesheetRow: {
    padding: "16px",
    border:
      "1px solid #e2e8f0",
    borderRadius: "14px",
    display: "grid",
    gridTemplateColumns:
      "2fr 1.3fr 1fr auto",
    alignItems: "center",
    gap: "15px",
  },

  smallText: {
    marginTop: "5px",
    color: "#64748b",
    fontSize: "14px",
  },

  badge: {
    padding: "8px 12px",
    borderRadius: "999px",
    fontWeight: 800,
    fontSize: "12px",
  },
};
