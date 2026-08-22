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
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
  hours_worked: number | null;
  agreed_rate?: number | null;
  total_amount?: number | null;
  notes: string | null;
  status: string;
  submitted_at: string | null;
  approved_at?: string | null;
  updated_at?: string | null;

  employer_proposed_start_time?: string | null;
  employer_proposed_end_time?: string | null;
  employer_proposed_break_minutes?: number | null;
  employer_proposed_hours?: number | null;
  employer_amendment_reason?: string | null;
  amendment_requested_at?: string | null;
  amendment_accepted_at?: string | null;

  rejection_reason?: string | null;
  rejected_at?: string | null;
};

export default function TimesheetsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);

  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [editingTimesheetId, setEditingTimesheetId] = useState("");

  const [workDate, setWorkDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionSavingId, setActionSavingId] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    void initialise();

    const channel = supabase
      .channel("carestaffing-locum-timesheet-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "timesheets",
        },
        async (payload) => {
          console.log("Locum received timesheet realtime update:", payload);

          if (!mounted) return;

          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) return;

          await loadTimesheets(user.id);
        }
      )
      .subscribe((status) => {
        console.log("Locum realtime subscription:", status);
      });

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
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
      setError(err?.message || "Could not load timesheets.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshTimesheets() {
    if (!userId) return;

    setRefreshing(true);

    try {
      await Promise.all([
        loadAcceptedShifts(userId),
        loadTimesheets(userId),
      ]);
      setMessage("Timesheets refreshed.");
    } catch (err: any) {
      setError(err?.message || "Could not refresh timesheets.");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadAcceptedShifts(locumId: string) {
    const {
      data: applications,
      error: applicationError,
    } = await supabase
      .from("shift_applications")
      .select("id,shift_id,locum_id,applicant_id,status")
      .or(`locum_id.eq.${locumId},applicant_id.eq.${locumId}`)
      .eq("status", "accepted");

    if (applicationError) throw applicationError;

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
        "id,title,profession_required,location,city,shift_date,start_time,end_time,locum_rate,status"
      )
      .in("id", shiftIds)
      .order("shift_date", { ascending: false });

    if (shiftError) throw shiftError;

    setShifts((shiftData || []) as Shift[]);
  }

  async function loadTimesheets(locumId: string) {
    const {
      data,
      error: timesheetError,
    } = await supabase
      .from("timesheets")
      .select("*")
      .eq("locum_id", locumId)
      .order("work_date", { ascending: false });

    if (timesheetError) throw timesheetError;

    console.log("Loaded locum timesheets:", data);

    setTimesheets((data || []) as Timesheet[]);
  }

  function calculateHoursForTimes(
    start: string,
    end: string,
    breaks: number
  ) {
    if (!start || !end) return 0;

    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);

    let startMinutes = startHour * 60 + startMinute;
    let endMinutes = endHour * 60 + endMinute;

    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }

    const workedMinutes = Math.max(
      0,
      endMinutes - startMinutes - Math.max(0, breaks)
    );

    return Number((workedMinutes / 60).toFixed(2));
  }

  const calculatedHours = useMemo(() => {
    return calculateHoursForTimes(
      startTime,
      endTime,
      Math.max(0, Number(breakMinutes) || 0)
    );
  }, [startTime, endTime, breakMinutes]);

  const selectedShift = shifts.find(
    (shift) => shift.id === selectedShiftId
  );

  const agreedRate = Number(
    selectedShift?.locum_rate ||
      timesheets.find((x) => x.id === editingTimesheetId)?.agreed_rate ||
      0
  );

  const estimatedPay = calculatedHours * agreedRate;

  function chooseShift(shiftId: string) {
    setSelectedShiftId(shiftId);
    setEditingTimesheetId("");

    const shift = shifts.find((item) => item.id === shiftId);

    if (!shift) return;

    if (shift.shift_date) setWorkDate(shift.shift_date);
    if (shift.start_time) setStartTime(shift.start_time.slice(0, 5));
    if (shift.end_time) setEndTime(shift.end_time.slice(0, 5));

    setBreakMinutes("0");
    setNotes("");
  }

  function beginAmendAndResubmit(entry: Timesheet) {
    const shift = shifts.find((item) => item.id === entry.shift_id);

    setSelectedShiftId(entry.shift_id);
    setEditingTimesheetId(entry.id);
    setWorkDate(entry.work_date || shift?.shift_date || "");
    setStartTime(entry.start_time?.slice(0, 5) || "");
    setEndTime(entry.end_time?.slice(0, 5) || "");
    setBreakMinutes(String(entry.break_minutes || 0));
    setNotes(entry.notes || "");

    setMessage(
      "Timesheet loaded for amendment. Update the actual times below and resubmit."
    );

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function acceptEmployerAmendment(entry: Timesheet) {
    const proposedStart =
      entry.employer_proposed_start_time?.slice(0, 5) || "";

    const proposedEnd =
      entry.employer_proposed_end_time?.slice(0, 5) || "";

    const proposedBreak = Number(
      entry.employer_proposed_break_minutes || 0
    );

    const proposedHours =
      Number(entry.employer_proposed_hours || 0) ||
      calculateHoursForTimes(
        proposedStart,
        proposedEnd,
        proposedBreak
      );

    if (!proposedStart || !proposedEnd || proposedHours <= 0) {
      setError(
        "The employer amendment is incomplete. Please ask the employer to resend the amendment."
      );
      return;
    }

    if (!userId) {
      setError("Your session could not be confirmed. Please log in again.");
      return;
    }

    const rate = Number(entry.agreed_rate || 0);
    const newTotal = Number((proposedHours * rate).toFixed(2));

    const confirmed = window.confirm(
      `Accept the employer amendment?\n\n${proposedStart} - ${proposedEnd}\nBreak: ${proposedBreak} minutes\nHours: ${proposedHours.toFixed(
        2
      )}\nAmount: R${newTotal.toFixed(
        2
      )}\n\nThe timesheet will be resubmitted to the employer for final approval.`
    );

    if (!confirmed) return;

    setActionSavingId(entry.id);
    setMessage("");
    setError("");

    try {
      const now = new Date().toISOString();

      // IMPORTANT:
      // Do not use .single() directly on the UPDATE response.
      // If RLS blocks the update, PostgREST returns zero rows and .single()
      // turns that into the misleading 406 "Cannot coerce result to a single JSON object".
      const {
        data: updatedRows,
        error: updateError,
      } = await supabase
        .from("timesheets")
        .update({
          start_time: proposedStart,
          end_time: proposedEnd,
          break_minutes: proposedBreak,
          hours_worked: proposedHours,
          total_amount: newTotal,
          status: "resubmitted",
          amendment_accepted_at: now,
          submitted_at: now,
          updated_at: now,
        })
        .eq("id", entry.id)
        .eq("locum_id", userId)
        .select("*");

      if (updateError) {
        console.error("Accept amendment UPDATE error:", updateError);
        throw updateError;
      }

      if (!updatedRows || updatedRows.length === 0) {
        throw new Error(
          "The amendment was not saved. Supabase did not allow this locum to update the timesheet. Run the CareStaffing timesheet RLS SQL fix in Supabase, then try again."
        );
      }

      const updatedTimesheet = updatedRows[0] as Timesheet;

      if (updatedTimesheet.status?.toLowerCase() !== "resubmitted") {
        throw new Error(
          "The timesheet update completed but the status did not change to resubmitted."
        );
      }

      // Re-read the row from Supabase so we know the database really contains
      // the accepted amendment before telling the locum it succeeded.
      const {
        data: verifiedTimesheet,
        error: verifyError,
      } = await supabase
        .from("timesheets")
        .select("*")
        .eq("id", entry.id)
        .eq("locum_id", userId)
        .maybeSingle();

      if (verifyError) {
        console.error("Accept amendment VERIFY error:", verifyError);
        throw verifyError;
      }

      if (
        !verifiedTimesheet ||
        verifiedTimesheet.status?.toLowerCase() !== "resubmitted"
      ) {
        throw new Error(
          "The amendment could not be verified after saving. Please refresh and try again."
        );
      }

      console.log(
        "Employer amendment accepted and verified:",
        verifiedTimesheet
      );

      setTimesheets((current) =>
        current.map((item) =>
          item.id === entry.id
            ? (verifiedTimesheet as Timesheet)
            : item
        )
      );

      setMessage(
        "Employer amendment accepted. The revised timesheet has been resubmitted for final employer approval."
      );

      await loadTimesheets(userId);
    } catch (err: any) {
      console.error("Accept employer amendment error:", err);
      setError(
        err?.message || "Could not accept the employer amendment."
      );
    } finally {
      setActionSavingId("");
    }
  }

  async function submitTimesheet(event: FormEvent) {
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
      setError("Please select an accepted shift.");
      return;
    }

    if (!workDate) {
      setError("Please select the date worked.");
      return;
    }

    if (!startTime || !endTime) {
      setError(
        "Please enter both the actual start time and actual end time."
      );
      return;
    }

    if (calculatedHours <= 0) {
      setError("Hours worked must be greater than zero.");
      return;
    }

    setSaving(true);

    try {
      const existingById = editingTimesheetId
        ? timesheets.find((x) => x.id === editingTimesheetId)
        : undefined;

      let existing = existingById;

      if (!existing) {
        const {
          data: existingRow,
          error: existingError,
        } = await supabase
          .from("timesheets")
          .select("*")
          .eq("shift_id", selectedShiftId)
          .eq("locum_id", userId)
          .eq("work_date", workDate)
          .maybeSingle();

        if (existingError) throw existingError;

        existing = existingRow as Timesheet | undefined;
      }

      if (existing?.status?.toLowerCase() === "approved") {
        setError(
          "This timesheet has already been approved by the employer and can no longer be changed."
        );
        setSaving(false);
        return;
      }

      const rate = Number(
        selectedShift?.locum_rate || existing?.agreed_rate || 0
      );

      const payload = {
        shift_id: selectedShiftId,
        locum_id: userId,
        work_date: workDate,
        start_time: startTime,
        end_time: endTime,
        break_minutes: Number(breakMinutes) || 0,
        hours_worked: calculatedHours,
        agreed_rate: rate,
        total_amount: Number((calculatedHours * rate).toFixed(2)),
        notes: notes.trim() || null,
        status: existing ? "resubmitted" : "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        const {
          data: updated,
          error: updateError,
        } = await supabase
          .from("timesheets")
          .update(payload)
          .eq("id", existing.id)
          .eq("locum_id", userId)
          .select("*")
          .single();

        if (updateError) throw updateError;

        console.log("Timesheet resubmitted:", updated);

        setMessage(
          "Timesheet amended and resubmitted for employer review."
        );
      } else {
        const {
          data: inserted,
          error: insertError,
        } = await supabase
          .from("timesheets")
          .insert(payload)
          .select("*")
          .single();

        if (insertError) throw insertError;

        console.log("Timesheet submitted:", inserted);

        setMessage(
          "Timesheet submitted successfully. It is now awaiting employer approval."
        );
      }

      setSelectedShiftId("");
      setEditingTimesheetId("");
      setWorkDate("");
      setStartTime("");
      setEndTime("");
      setBreakMinutes("0");
      setNotes("");

      await loadTimesheets(userId);
    } catch (err: any) {
      console.error("Timesheet save error:", err);
      setError(err?.message || "Could not submit the timesheet.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.loadingCard}>
            <strong>Loading CareStaffing timesheets...</strong>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <Link href="/dashboard" style={styles.back}>
            ← Back to Dashboard
          </Link>

          <button
            type="button"
            onClick={() => void refreshTimesheets()}
            style={styles.refreshButton}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        <section style={styles.hero}>
          <p style={styles.eyebrow}>CARESTAFFING</p>

          <h1 style={styles.title}>Timesheets</h1>

          <p style={styles.subtitle}>
            Record your actual start and end times for every day worked.
          </p>
        </section>

        {message && <div style={styles.success}>✓ {message}</div>}
        {error && <div style={styles.error}>{error}</div>}

        {shifts.length === 0 ? (
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>No accepted shifts</h2>

            <p style={styles.help}>
              Once an employer accepts your application, the accepted shift
              will appear here for timesheet submission.
            </p>

            <Link href="/shifts" style={styles.primaryLink}>
              Find Shifts
            </Link>
          </section>
        ) : (
          <form onSubmit={submitTimesheet} style={styles.card}>
            <div style={styles.sectionHeader}>
              <div style={styles.stepNumber}>1</div>

              <div>
                <h2 style={styles.cardTitle}>
                  {editingTimesheetId
                    ? "Amend & Resubmit Timesheet"
                    : "Complete Daily Timesheet"}
                </h2>

                <p style={styles.helpNoMargin}>
                  Enter the actual times worked.
                </p>
              </div>
            </div>

            <div style={styles.grid}>
              <Field label="Accepted Shift">
                <select
                  value={selectedShiftId}
                  onChange={(e) => chooseShift(e.target.value)}
                  style={styles.input}
                  required
                >
                  <option value="">Select accepted shift</option>

                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.title ||
                        shift.profession_required ||
                        "Healthcare shift"}
                      {" — "}
                      {shift.location || shift.city || ""}
                      {" — "}
                      {formatDate(shift.shift_date)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Date Worked">
                <input
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  style={styles.input}
                  required
                />
              </Field>

              <Field label="Actual Start Time">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={styles.input}
                  required
                />
              </Field>

              <Field label="Actual End Time">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
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
                  onChange={(e) => setBreakMinutes(e.target.value)}
                  style={styles.input}
                />
              </Field>

              <Field label="Calculated Hours">
                <input
                  value={calculatedHours.toFixed(2)}
                  readOnly
                  style={{
                    ...styles.input,
                    background: "#f1f5f9",
                    fontWeight: 800,
                  }}
                />
              </Field>
            </div>

            <div style={{ marginTop: "18px" }}>
              <Field label="Notes">
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional note."
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
                ? "Submitting..."
                : editingTimesheetId
                ? "Resubmit Timesheet"
                : "Submit Timesheet for Employer Approval"}
            </button>
          </form>
        )}

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div style={styles.stepNumber}>2</div>

            <div>
              <h2 style={styles.cardTitle}>Submitted Timesheets</h2>
              <p style={styles.helpNoMargin}>
                Track employer review and amendments.
              </p>
            </div>
          </div>

          {timesheets.length === 0 ? (
            <p style={styles.help}>No timesheets submitted yet.</p>
          ) : (
            <div style={styles.timesheetList}>
              {timesheets.map((entry) => {
                const shift = shifts.find(
                  (item) => item.id === entry.shift_id
                );

                const rate = Number(
                  entry.agreed_rate || shift?.locum_rate || 0
                );

                const total =
                  Number(entry.total_amount || 0) ||
                  Number(entry.hours_worked || 0) * rate;

                const proposedHours =
                  Number(entry.employer_proposed_hours || 0) ||
                  calculateHoursForTimes(
                    entry.employer_proposed_start_time?.slice(0, 5) ||
                      "",
                    entry.employer_proposed_end_time?.slice(0, 5) || "",
                    Number(
                      entry.employer_proposed_break_minutes || 0
                    )
                  );

                const proposedAmount = proposedHours * rate;

                const status =
                  entry.status?.toLowerCase() || "submitted";

                return (
                  <article key={entry.id} style={styles.timesheetCard}>
                    <div style={styles.timesheetHeader}>
                      <div>
                        <strong style={{ fontSize: "18px" }}>
                          {shift?.title ||
                            shift?.profession_required ||
                            "Healthcare Shift"}
                        </strong>

                        <div style={styles.smallText}>
                          {formatDate(entry.work_date)}
                        </div>
                      </div>

                      <StatusBadge status={status} />
                    </div>

                    <div style={styles.summaryGrid}>
                      <SummaryItem
                        label="Time"
                        value={`${formatTime(
                          entry.start_time
                        )} – ${formatTime(entry.end_time)}`}
                      />
                      <SummaryItem
                        label="Break"
                        value={`${entry.break_minutes || 0} min`}
                      />
                      <SummaryItem
                        label="Hours"
                        value={`${Number(
                          entry.hours_worked || 0
                        ).toFixed(2)} hrs`}
                      />
                      <SummaryItem
                        label="Amount"
                        value={`R${total.toFixed(2)}`}
                        highlight
                      />
                    </div>

                    {status === "amendment_requested" && (
                      <div style={styles.amendmentCard}>
                        <h3 style={{ marginTop: 0 }}>
                          Employer requested an amendment
                        </h3>

                        <p style={styles.helpNoMargin}>
                          Review the proposed changes before accepting or
                          resubmitting.
                        </p>

                        <div style={styles.compareGrid}>
                          <div style={styles.originalBox}>
                            <strong>Original submission</strong>

                            <p>
                              {formatTime(entry.start_time)} –{" "}
                              {formatTime(entry.end_time)}
                            </p>

                            <p>Break: {entry.break_minutes || 0} min</p>

                            <p>
                              Hours:{" "}
                              {Number(
                                entry.hours_worked || 0
                              ).toFixed(2)}
                            </p>

                            <p>Amount: R{total.toFixed(2)}</p>
                          </div>

                          <div style={styles.proposalBox}>
                            <strong>Employer proposal</strong>

                            <p>
                              {formatTime(
                                entry.employer_proposed_start_time
                              )}{" "}
                              –{" "}
                              {formatTime(
                                entry.employer_proposed_end_time
                              )}
                            </p>

                            <p>
                              Break:{" "}
                              {entry.employer_proposed_break_minutes ||
                                0}{" "}
                              min
                            </p>

                            <p>
                              Hours: {proposedHours.toFixed(2)}
                            </p>

                            <p>
                              Amount: R{proposedAmount.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div style={styles.reasonBox}>
                          <strong>Employer reason:</strong>
                          <div style={{ marginTop: "6px" }}>
                            {entry.employer_amendment_reason ||
                              "No reason supplied."}
                          </div>
                        </div>

                        <div style={styles.actionRow}>
                          <button
                            type="button"
                            onClick={() =>
                              beginAmendAndResubmit(entry)
                            }
                            style={styles.amendButton}
                          >
                            ✏️ Amend & Resubmit
                          </button>

                          <button
                            type="button"
                            disabled={actionSavingId === entry.id}
                            onClick={() =>
                              acceptEmployerAmendment(entry)
                            }
                            style={styles.acceptButton}
                          >
                            {actionSavingId === entry.id
                              ? "Saving..."
                              : "✓ Accept Employer Amendment"}
                          </button>
                        </div>
                      </div>
                    )}

                    {status === "resubmitted" && (
                      <div style={styles.resubmittedBox}>
                        <strong>
                          ✓ Revised timesheet sent to employer
                        </strong>

                        <p style={{ margin: "6px 0 0" }}>
                          Waiting for final employer approval.
                        </p>

                        {entry.amendment_accepted_at && (
                          <p style={{ margin: "6px 0 0" }}>
                            Employer amendment accepted.
                          </p>
                        )}
                      </div>
                    )}

                    {status === "approved" && (
                      <div style={styles.approvedBox}>
                        <strong>✓ Employer approved timesheet</strong>
                        <p style={{ margin: "6px 0 0" }}>
                          This timesheet is now final and can proceed to
                          invoicing/payment.
                        </p>
                      </div>
                    )}

                    {status === "rejected" && (
                      <div style={styles.rejectedBox}>
                        <strong>Timesheet rejected</strong>

                        <p>
                          {entry.rejection_reason ||
                            "No reason supplied."}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            beginAmendAndResubmit(entry)
                          }
                          style={styles.amendButton}
                        >
                          Amend & Resubmit
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
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
      <span style={styles.label}>{label}</span>
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
      <span style={styles.summaryLabel}>{label}</span>
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

function StatusBadge({ status }: { status: string }) {
  let badgeStyle: React.CSSProperties = styles.statusSubmitted;

  if (status === "approved") badgeStyle = styles.statusApproved;
  if (status === "rejected") badgeStyle = styles.statusRejected;
  if (status === "amendment_requested")
    badgeStyle = styles.statusAmendment;
  if (status === "resubmitted")
    badgeStyle = styles.statusResubmitted;

  return (
    <span
      style={{
        ...styles.statusBase,
        ...badgeStyle,
      }}
    >
      {status.replaceAll("_", " ").toUpperCase()}
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  return value.slice(0, 5);
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "30px 20px 60px",
    fontFamily: "Arial, sans-serif",
  },
  container: { maxWidth: "1180px", margin: "0 auto" },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  back: {
    color: "#0f766e",
    fontWeight: 800,
    textDecoration: "none",
  },
  refreshButton: {
    border: "1px solid #99f6e4",
    background: "white",
    color: "#0f766e",
    padding: "10px 14px",
    borderRadius: "10px",
    fontWeight: 800,
    cursor: "pointer",
  },
  hero: {
    marginTop: "20px",
    padding: "34px",
    borderRadius: "28px",
    background: "linear-gradient(135deg,#0f172a,#1e3a8a)",
    color: "white",
  },
  eyebrow: {
    margin: 0,
    color: "#c7d2fe",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  title: { margin: "8px 0", fontSize: "42px" },
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
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
  },
  cardTitle: { margin: 0 },
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
    gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
    gap: "16px",
  },
  field: { display: "grid", gap: "7px" },
  label: { fontWeight: 800, color: "#334155" },
  input: {
    width: "100%",
    minHeight: "50px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "12px 14px",
    fontSize: "15px",
    boxSizing: "border-box",
  },
  submit: {
    marginTop: "20px",
    width: "100%",
    padding: "16px",
    border: "none",
    borderRadius: "13px",
    background: "#39ff14",
    color: "#052e16",
    fontWeight: 900,
    fontSize: "15px",
    cursor: "pointer",
    boxShadow: "0 0 16px rgba(57,255,20,0.30)",
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
  help: { color: "#64748b", lineHeight: 1.5 },
  helpNoMargin: { margin: "4px 0 0", color: "#64748b" },
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
  timesheetList: { display: "grid", gap: "16px" },
  timesheetCard: {
    padding: "18px",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
  },
  timesheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    alignItems: "flex-start",
  },
  smallText: {
    marginTop: "5px",
    color: "#64748b",
    fontSize: "14px",
  },
  summaryGrid: {
    marginTop: "16px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))",
    gap: "12px",
  },
  summaryItem: {
    display: "grid",
    gap: "5px",
    padding: "12px",
    background: "#f8fafc",
    borderRadius: "10px",
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
  },
  summaryHighlight: { color: "#0f766e", fontSize: "18px" },
  amendmentCard: {
    marginTop: "18px",
    padding: "18px",
    border: "2px solid #f59e0b",
    borderRadius: "16px",
    background: "#fffdf5",
  },
  compareGrid: {
    marginTop: "16px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
    gap: "14px",
  },
  originalBox: {
    padding: "16px",
    borderRadius: "12px",
    background: "#f8fafc",
  },
  proposalBox: {
    padding: "16px",
    borderRadius: "12px",
    background: "#ffedd5",
    color: "#9a3412",
  },
  reasonBox: {
    marginTop: "14px",
    padding: "14px",
    borderRadius: "12px",
    background: "#fef3c7",
    color: "#92400e",
  },
  actionRow: {
    marginTop: "14px",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap",
  },
  amendButton: {
    padding: "11px 15px",
    border: "1px solid #cbd5e1",
    background: "white",
    borderRadius: "10px",
    fontWeight: 800,
    cursor: "pointer",
  },
  acceptButton: {
    padding: "11px 16px",
    border: "2px solid #22c55e",
    background: "#39ff14",
    color: "#052e16",
    borderRadius: "10px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 0 16px rgba(57,255,20,.25)",
  },
  resubmittedBox: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "14px",
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  approvedBox: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "14px",
    background: "#dcfce7",
    color: "#166534",
  },
  rejectedBox: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "14px",
    background: "#fee2e2",
    color: "#991b1b",
  },
  statusBase: {
    height: "fit-content",
    padding: "7px 11px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
  },
  statusSubmitted: {
    background: "#fef3c7",
    color: "#92400e",
  },
  statusApproved: {
    background: "#dcfce7",
    color: "#166534",
  },
  statusRejected: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  statusAmendment: {
    background: "#ffedd5",
    color: "#9a3412",
  },
  statusResubmitted: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
};
