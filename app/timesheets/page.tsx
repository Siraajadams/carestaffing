"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Shift = {
  id: string;
  title: string | null;
  profession: string | null;
  location: string | null;
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
  notes: string | null;
  status: string;
  submitted_at: string | null;
};

export default function TimesheetsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);

  const [selectedShiftId, setSelectedShiftId] =
    useState("");

  const [workDate, setWorkDate] =
    useState("");

  const [startTime, setStartTime] =
    useState("");

  const [endTime, setEndTime] =
    useState("");

  const [breakMinutes, setBreakMinutes] =
    useState("0");

  const [notes, setNotes] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    initialise();
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
      console.error(err);

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
    const {
      data: applications,
      error: applicationError,
    } = await supabase
      .from("shift_applications")
      .select("shift_id")
      .eq("locum_id", locumId)
      .eq("status", "accepted");

    if (applicationError) {
      throw applicationError;
    }

    const shiftIds = (
      applications || []
    )
      .map((row) => row.shift_id)
      .filter(Boolean);

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
          profession,
          location,
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
      throw shiftError;
    }

    setShifts(
      (shiftData || []) as Shift[]
    );
  }

  async function loadTimesheets(
    locumId: string
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("timesheets")
      .select("*")
      .eq("locum_id", locumId)
      .order("work_date", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    setTimesheets(
      (data || []) as Timesheet[]
    );
  }

  const calculatedHours =
    useMemo(() => {
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

      let start =
        startHour * 60 + startMinute;

      let end =
        endHour * 60 + endMinute;

      // Handles overnight shifts.
      if (end < start) {
        end += 24 * 60;
      }

      const breaks =
        Number(breakMinutes) || 0;

      const workedMinutes =
        Math.max(
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

  const selectedShift =
    shifts.find(
      (shift) =>
        shift.id === selectedShiftId
    );

  const estimatedPay =
    selectedShift?.locum_rate
      ? calculatedHours *
        Number(
          selectedShift.locum_rate
        )
      : 0;

  async function submitTimesheet(
    event: FormEvent
  ) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!selectedShiftId) {
      setError(
        "Please select an accepted shift."
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
        "Please enter both start and end times."
      );
      return;
    }

    if (calculatedHours <= 0) {
      setError(
        "Hours worked must be greater than zero."
      );
      return;
    }

    setSaving(true);

    try {
      const payload = {
        shift_id:
          selectedShiftId,

        locum_id:
          userId,

        work_date:
          workDate,

        start_time:
          startTime,

        end_time:
          endTime,

        break_minutes:
          Number(
            breakMinutes
          ) || 0,

        hours_worked:
          calculatedHours,

        notes:
          notes.trim() || null,

        status:
          "submitted",

        submitted_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      };

      const {
        error: insertError,
      } = await supabase
        .from("timesheets")
        .upsert(payload, {
          onConflict:
            "shift_id,locum_id,work_date",
        });

      if (insertError) {
        throw insertError;
      }

      setMessage(
        "Daily timesheet submitted successfully."
      );

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

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          Loading timesheets...
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
            CareStaffing
          </p>

          <h1 style={styles.title}>
            Timesheets
          </h1>

          <p style={styles.subtitle}>
            Submit your actual start and
            end times for each day worked.
          </p>
        </section>

        {message && (
          <div style={styles.success}>
            {message}
          </div>
        )}

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {shifts.length === 0 ? (
          <section style={styles.card}>
            <h2>
              No accepted shifts
            </h2>

            <p style={styles.help}>
              Once an employer accepts your
              application, the shift will
              appear here for timesheet
              submission.
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
            <h2 style={styles.cardTitle}>
              Add Daily Timesheet
            </h2>

            <div style={styles.grid}>
              <Field label="Accepted Shift">
                <select
                  value={
                    selectedShiftId
                  }
                  onChange={(e) => {
                    const id =
                      e.target.value;

                    setSelectedShiftId(
                      id
                    );

                    const shift =
                      shifts.find(
                        (item) =>
                          item.id === id
                      );

                    if (
                      shift?.shift_date
                    ) {
                      setWorkDate(
                        shift.shift_date
                      );
                    }
                  }}
                  style={styles.input}
                >
                  <option value="">
                    Select shift
                  </option>

                  {shifts.map(
                    (shift) => (
                      <option
                        key={shift.id}
                        value={shift.id}
                      >
                        {shift.title ||
                          shift.profession ||
                          "Healthcare shift"}
                        {" — "}
                        {shift.location ||
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

              <Field label="Started Shift">
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

              <Field label="Ended Shift">
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
                  step="1"
                  value={
                    breakMinutes
                  }
                  onChange={(e) =>
                    setBreakMinutes(
                      e.target.value
                    )
                  }
                  style={styles.input}
                />
              </Field>

              <Field label="Hours Worked">
                <input
                  value={
                    calculatedHours.toFixed(
                      2
                    )
                  }
                  disabled
                  style={{
                    ...styles.input,
                    background:
                      "#f1f5f9",
                  }}
                />
              </Field>
            </div>

            {selectedShift && (
              <div
                style={
                  styles.shiftSummary
                }
              >
                <div>
                  <strong>
                    Scheduled:
                  </strong>{" "}
                  {selectedShift.start_time ||
                    "—"}{" "}
                  –{" "}
                  {selectedShift.end_time ||
                    "—"}
                </div>

                <div>
                  <strong>
                    Locum rate:
                  </strong>{" "}
                  R
                  {Number(
                    selectedShift.locum_rate ||
                      0
                  ).toFixed(2)}
                  /hour
                </div>

                <div>
                  <strong>
                    Estimated daily pay:
                  </strong>{" "}
                  R
                  {estimatedPay.toFixed(
                    2
                  )}
                </div>
              </div>
            )}

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

            <button
              type="submit"
              disabled={saving}
              style={styles.submit}
            >
              {saving
                ? "Submitting..."
                : "Submit Day"}
            </button>
          </form>
        )}

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>
            Submitted Timesheets
          </h2>

          {timesheets.length === 0 ? (
            <p style={styles.help}>
              No timesheets submitted yet.
            </p>
          ) : (
            <div
              style={
                styles.timesheetList
              }
            >
              {timesheets.map(
                (entry) => (
                  <article
                    key={entry.id}
                    style={
                      styles.timesheetRow
                    }
                  >
                    <div>
                      <strong>
                        {formatDate(
                          entry.work_date
                        )}
                      </strong>

                      <div
                        style={
                          styles.smallText
                        }
                      >
                        {entry.start_time} –{" "}
                        {entry.end_time}
                      </div>
                    </div>

                    <div>
                      <strong>
                        {Number(
                          entry.hours_worked ||
                            0
                        ).toFixed(2)}{" "}
                        hours
                      </strong>

                      <div
                        style={
                          styles.smallText
                        }
                      >
                        Break:{" "}
                        {
                          entry.break_minutes
                        }{" "}
                        min
                      </div>
                    </div>

                    <StatusBadge
                      status={
                        entry.status
                      }
                    />
                  </article>
                )
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
  children: React.ReactNode;
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span style={styles.badge}>
      {status.toUpperCase()}
    </span>
  );
}

function formatDate(
  value: string | null
) {
  if (!value) return "No date";

  const date =
    new Date(`${value}T00:00:00`);

  return date.toLocaleDateString(
    "en-ZA",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
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
      "linear-gradient(135deg, #0f172a, #312e81)",
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

  card: {
    marginTop: "22px",
    background: "white",
    borderRadius: "22px",
    padding: "26px",
    boxShadow:
      "0 12px 30px rgba(15,23,42,0.06)",
  },

  cardTitle: {
    marginTop: 0,
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
    margin: "20px 0",
    padding: "18px",
    borderRadius: "14px",
    background: "#ecfeff",
    display: "grid",
    gap: "8px",
    color: "#164e63",
  },

  submit: {
    marginTop: "20px",
    width: "100%",
    padding: "15px",
    border: "none",
    borderRadius: "13px",
    background: "#0f766e",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
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
      "2fr 1fr auto",
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
    background: "#fef3c7",
    color: "#92400e",
    fontWeight: 800,
    fontSize: "12px",
  },
};
