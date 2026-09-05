"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Shift = {
  id: string;
  title: string | null;
  profession_required: string | null;
  city: string | null;
  location: string | null;
  shift_date: string | null;
  start_time: string | null;
  end_time: string | null;
  hourly_rate?: number | null;
  locum_rate?: number | null;
  platform_fee?: number | null;
  status: string | null;
  company_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

type Timesheet = {
  id: string;
  shift_id: string;
  locum_id: string;
  work_date: string | null;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number | null;
  hours_worked: number | null;
  agreed_rate: number | null;
  total_amount: number | null;
  notes?: string | null;
  employer_notes?: string | null;
  status: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  employer_proposed_start_time?: string | null;
  employer_proposed_end_time?: string | null;
  employer_proposed_break_minutes?: number | null;
  employer_proposed_hours?: number | null;
  employer_amendment_reason?: string | null;
  amendment_requested_at?: string | null;
  amendment_accepted_at?: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  updated_at?: string | null;
};

type Application = {
  id: string;
  shift_id: string;
  locum_id?: string | null;
  applicant_id?: string | null;
  status?: string | null;
};

type Profile = {
  id: string;
  first_name?: string | null;
  surname?: string | null;
  email?: string | null;
  mobile?: string | null;
  profession?: string | null;
  registration_number?: string | null;
};

type AmendmentDraft = {
  startTime: string;
  endTime: string;
  breakMinutes: string;
  reason: string;
};

export default function EmployerShiftsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedShift = searchParams.get("shift") || "";

  const [userId, setUserId] = useState("");
  const [companyId, setCompanyId] = useState("");

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [notifyingShiftId, setNotifyingShiftId] = useState("");
  const [closingShiftId, setClosingShiftId] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [amendmentOpenId, setAmendmentOpenId] = useState("");
  const [rejectOpenId, setRejectOpenId] = useState("");

  const [amendments, setAmendments] = useState<
    Record<string, AmendmentDraft>
  >({});

  const [rejectionReasons, setRejectionReasons] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    let mounted = true;

    void initialise();

    const channel = supabase
      .channel("carestaffing-employer-timesheet-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "timesheets",
        },
        async (payload) => {
          console.log("Employer received timesheet realtime update:", payload);

          if (!mounted) return;

          await refreshEmployerData(false);
        }
      )
      .subscribe((status) => {
        console.log("Employer realtime subscription:", status);
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
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (companyError) {
        console.error("Company lookup error:", companyError);
      }

      const employerCompanyId = company?.id || "";

      setCompanyId(employerCompanyId);

      await loadEverything(user.id, employerCompanyId);
    } catch (err: any) {
      console.error("Employer initialise error:", err);
      setError(err?.message || "Could not load employer shifts.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshEmployerData(showMessage = true) {
    setRefreshing(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) return;

      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      const employerCompanyId = company?.id || "";

      setUserId(user.id);
      setCompanyId(employerCompanyId);

      await loadEverything(user.id, employerCompanyId);

      if (showMessage) {
        setMessage("Timesheets refreshed.");
      }
    } catch (err: any) {
      console.error("Employer refresh error:", err);
      setError(err?.message || "Could not refresh timesheets.");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadEverything(
    employerId: string,
    employerCompanyId: string
  ) {
    setError("");

    let shiftQuery = supabase.from("shifts").select("*");

    if (employerCompanyId) {
      shiftQuery = shiftQuery.or(
        `company_id.eq.${employerCompanyId},created_by.eq.${employerId}`
      );
    } else {
      shiftQuery = shiftQuery.eq("created_by", employerId);
    }

    const { data: shiftRows, error: shiftError } = await shiftQuery.order(
      "shift_date",
      { ascending: false }
    );

    if (shiftError) throw shiftError;

    const employerShifts = (shiftRows || []) as Shift[];
    setShifts(employerShifts);

    const shiftIds = employerShifts.map((shift) => shift.id);

    if (shiftIds.length === 0) {
      setTimesheets([]);
      setApplications([]);
      setProfiles({});
      return;
    }

    const { data: timesheetRows, error: timesheetError } = await supabase
      .from("timesheets")
      .select("*")
      .in("shift_id", shiftIds)
      .order("work_date", { ascending: false });

    if (timesheetError) throw timesheetError;

    const loadedTimesheets = (timesheetRows || []) as Timesheet[];
    setTimesheets(loadedTimesheets);

    const { data: applicationRows, error: applicationError } = await supabase
      .from("shift_applications")
      .select("*")
      .in("shift_id", shiftIds);

    if (applicationError) {
      console.error("Application loading error:", applicationError);
    }

    const loadedApplications = (applicationRows || []) as Application[];
    setApplications(loadedApplications);

    const locumIds = Array.from(
      new Set(
        [
          ...loadedTimesheets.map((row) => row.locum_id),
          ...loadedApplications.map(
            (row) => row.locum_id || row.applicant_id || ""
          ),
        ].filter(Boolean)
      )
    );

    if (locumIds.length === 0) {
      setProfiles({});
      return;
    }

    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id,first_name,surname,email,mobile,profession,registration_number"
      )
      .in("id", locumIds);

    if (profileError) {
      console.warn(
        "Could not load applicant profiles. Check profiles SELECT RLS.",
        profileError
      );
      setProfiles({});
      return;
    }

    const profileMap: Record<string, Profile> = {};

    for (const profile of profileRows || []) {
      profileMap[profile.id] = profile as Profile;
    }

    setProfiles(profileMap);
  }

  function timesheetsForShift(shiftId: string) {
    return timesheets.filter((row) => row.shift_id === shiftId);
  }

  function applicantCount(shiftId: string) {
    return applications.filter((row) => row.shift_id === shiftId).length;
  }

  function profileForTimesheet(row: Timesheet) {
    return profiles[row.locum_id];
  }

  function grossAmount(row: Timesheet) {
    if (Number(row.total_amount || 0) > 0) {
      return Number(row.total_amount || 0);
    }

    return Number(row.hours_worked || 0) * Number(row.agreed_rate || 0);
  }

  function careStaffingFee(row: Timesheet) {
    return grossAmount(row) * 0.1;
  }

  function employerPays(row: Timesheet) {
    return grossAmount(row) + careStaffingFee(row);
  }

  function calculateHours(
    startTime: string,
    endTime: string,
    breakMinutes: number
  ) {
    if (!startTime || !endTime) return 0;

    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = endTime.split(":").map(Number);

    let start = startHour * 60 + startMinute;
    let end = endHour * 60 + endMinute;

    if (end < start) end += 1440;

    const minutes = Math.max(
      0,
      end - start - Math.max(0, breakMinutes)
    );

    return Number((minutes / 60).toFixed(2));
  }

  function openAmendment(row: Timesheet) {
    setRejectOpenId("");
    setAmendmentOpenId(row.id);

    setAmendments((current) => ({
      ...current,
      [row.id]: {
        startTime: row.start_time?.slice(0, 5) || "",
        endTime: row.end_time?.slice(0, 5) || "",
        breakMinutes: String(row.break_minutes || 0),
        reason: "",
      },
    }));
  }

  function openReject(row: Timesheet) {
    setAmendmentOpenId("");
    setRejectOpenId(row.id);

    setRejectionReasons((current) => ({
      ...current,
      [row.id]: current[row.id] || "",
    }));
  }

  async function approveTimesheet(row: Timesheet) {
    const confirmed = window.confirm(
      `Approve ${Number(row.hours_worked || 0).toFixed(
        2
      )} hours for payment?\n\nOnce approved, this timesheet will be treated as final.`
    );

    if (!confirmed) return;

    setSavingId(row.id);
    setMessage("");
    setError("");

    try {
      const { data: updated, error: updateError } = await supabase
        .from("timesheets")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      console.log("Approved timesheet:", updated);

      setMessage(
        "Timesheet approved. The invoice is now eligible for payment."
      );

      await refreshEmployerData(false);
    } catch (err: any) {
      console.error("Approve timesheet error:", err);
      setError(err?.message || "Could not approve timesheet.");
    } finally {
      setSavingId("");
    }
  }

  async function requestAmendment(row: Timesheet) {
    const draft = amendments[row.id];

    if (!draft) return;

    if (!draft.startTime || !draft.endTime) {
      setError("Enter the employer proposed start and end times.");
      return;
    }

    if (!draft.reason.trim()) {
      setError("Please give the locum a reason for the amendment.");
      return;
    }

    const proposedBreak = Math.max(
      0,
      Number(draft.breakMinutes) || 0
    );

    const proposedHours = calculateHours(
      draft.startTime,
      draft.endTime,
      proposedBreak
    );

    if (proposedHours <= 0) {
      setError("The proposed hours must be greater than zero.");
      return;
    }

    setSavingId(row.id);
    setError("");
    setMessage("");

    try {
      const { data: updated, error: updateError } = await supabase
        .from("timesheets")
        .update({
          status: "amendment_requested",
          employer_proposed_start_time: draft.startTime,
          employer_proposed_end_time: draft.endTime,
          employer_proposed_break_minutes: proposedBreak,
          employer_proposed_hours: proposedHours,
          employer_amendment_reason: draft.reason.trim(),
          amendment_requested_at: new Date().toISOString(),
          amendment_accepted_at: null,
          approved_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      console.log("Amendment requested:", updated);

      setAmendmentOpenId("");
      setMessage(
        "Amendment sent to the locum. Payment remains locked until final approval."
      );

      await refreshEmployerData(false);
    } catch (err: any) {
      console.error("Request amendment error:", err);
      setError(err?.message || "Could not request amendment.");
    } finally {
      setSavingId("");
    }
  }

  async function rejectTimesheet(row: Timesheet) {
    const reason = rejectionReasons[row.id]?.trim();

    if (!reason) {
      setError("Enter a reason before rejecting the timesheet.");
      return;
    }

    const confirmed = window.confirm(
      "Reject this timesheet? Use Request Amendment instead if you only disagree with the hours."
    );

    if (!confirmed) return;

    setSavingId(row.id);
    setError("");
    setMessage("");

    try {
      const { data: updated, error: updateError } = await supabase
        .from("timesheets")
        .update({
          status: "rejected",
          rejection_reason: reason,
          rejected_at: new Date().toISOString(),
          approved_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      console.log("Rejected timesheet:", updated);

      setRejectOpenId("");
      setMessage("Timesheet rejected and returned to the locum.");

      await refreshEmployerData(false);
    } catch (err: any) {
      console.error("Reject timesheet error:", err);
      setError(err?.message || "Could not reject timesheet.");
    } finally {
      setSavingId("");
    }
  }

  function shiftCanBeEmailed(shift: Shift) {
    const status = (shift.status || "open").trim().toLowerCase();

    return ![
      "filled",
      "closed",
      "completed",
      "cancelled",
      "canceled",
    ].includes(status);
  }

  async function notifyLocumsAboutShift(shift: Shift) {
    if (!shiftCanBeEmailed(shift)) {
      setError(
        "This shift is no longer available, so locum notifications cannot be sent."
      );
      return;
    }

    const profession =
      shift.profession_required?.trim() || "matching healthcare";

    const confirmed = window.confirm(
      `Send this available shift to all matching ${profession} locums?\n\nEach locum will receive a separate private email.`
    );

    if (!confirmed) return;

    setNotifyingShiftId(shift.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/shifts/notify-locums", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shiftId: shift.id,
          source: "admin-resend",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error ||
            result?.message ||
            "Could not send locum notifications."
        );
      }

      const sent = Number(result.sent || 0);
      const failed = Number(result.failed || 0);
      const matched = Number(result.matched || 0);

      if (matched === 0) {
        setMessage(
          `No matching ${profession} locums with email addresses were found.`
        );
      } else if (failed > 0) {
        setMessage(
          `Shift notification completed: ${sent} sent individually, ${failed} failed.`
        );
      } else {
        setMessage(
          `✓ ${sent} ${profession} locum email${
            sent === 1 ? "" : "s"
          } sent individually.`
        );
      }

      console.log("Locum notification result:", result);
    } catch (err: any) {
      console.error("Notify locums error:", err);
      setError(
        err?.message ||
          "Could not send the available shift to matching locums."
      );
    } finally {
      setNotifyingShiftId("");
    }
  }

  async function completeAndCloseShift(shift: Shift) {
    const status = (shift.status || "open").trim().toLowerCase();

    if (["completed", "closed", "cancelled", "canceled"].includes(status)) {
      setError("This post is already closed.");
      return;
    }

    const confirmed = window.confirm(
      `Complete and close "${shift.title || "this shift"}"?\n\n` +
        "The post will no longer be treated as available and locum notification emails will be disabled. " +
        "Existing applicants and timesheet history will remain available."
    );

    if (!confirmed) return;

    setClosingShiftId(shift.id);
    setError("");
    setMessage("");

    try {
      const { data: updated, error: updateError } = await supabase
        .from("shifts")
        .update({
          status: "completed",
        })
        .eq("id", shift.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      console.log("Shift completed and closed:", updated);

      setMessage(
        `✓ ${shift.title || "Shift"} has been completed and closed.`
      );

      await refreshEmployerData(false);
    } catch (err: any) {
      console.error("Complete shift error:", err);
      setError(err?.message || "Could not complete and close this post.");
    } finally {
      setClosingShiftId("");
    }
  }

  function goToStripePayment(row?: Timesheet) {
    if (row && row.status?.toLowerCase() !== "approved") {
      setError(
        "The employer can only pay an invoice after the timesheet has been approved."
      );
      return;
    }

    if (row) {
      router.push(
        `/employer/payments?timesheet=${encodeURIComponent(row.id)}`
      );
      return;
    }

    router.push("/employer/payments");
  }

  const filteredShifts = useMemo(() => {
    if (!requestedShift) return shifts;

    const exact = shifts.filter((shift) => shift.id === requestedShift);
    return exact.length > 0 ? exact : shifts;
  }, [requestedShift, shifts]);

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.card}>Loading employer shifts...</div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/employer" style={styles.back}>
          ← Back to Employer Portal
        </Link>

        <section style={styles.hero}>
          <p style={styles.eyebrow}>EMPLOYER PORTAL</p>

          <h1 style={styles.title}>My Shifts & Payments</h1>

          <p style={styles.subtitle}>
            Review locum timesheets, request amendments, approve completed
            work and pay approved invoices.
          </p>

          <div style={styles.heroActions}>
            <button
              type="button"
              onClick={() => void refreshEmployerData(true)}
              style={styles.refreshButton}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "↻ Refresh Timesheets"}
            </button>

            <button
              type="button"
              onClick={() => goToStripePayment()}
              style={styles.stripeButton}
            >
              💳 STRIPE PAYMENTS
            </button>
          </div>
        </section>

        {message && <div style={styles.success}>{message}</div>}
        {error && <div style={styles.error}>{error}</div>}

        {filteredShifts.length === 0 ? (
          <section style={styles.card}>
            <h2>No shifts found</h2>
            <Link href="/employer" style={styles.primaryLink}>
              Post New Shift
            </Link>
          </section>
        ) : (
          filteredShifts.map((shift) => {
            const shiftTimesheets = timesheetsForShift(shift.id);
            const applicants = applicantCount(shift.id);

            return (
              <section key={shift.id} style={styles.shiftCard}>
                <div style={styles.shiftTop}>
                  <div>
                    <h2 style={styles.shiftTitle}>
                      {shift.title || "Healthcare Shift"}
                    </h2>

                    <p style={styles.location}>
                      {shift.location || shift.city || "Location not specified"}
                    </p>
                  </div>

                  <span style={styles.shiftStatus}>
                    {(shift.status || "open").toUpperCase()}
                  </span>
                </div>

                <div style={styles.shiftDetails}>
                  <Detail
                    label="Profession"
                    value={shift.profession_required || "—"}
                  />
                  <Detail label="City" value={shift.city || "—"} />
                  <Detail
                    label="Posted"
                    value={formatDateTime(shift.created_at)}
                  />
                  <Detail
                    label="Shift Date"
                    value={formatDate(shift.shift_date)}
                  />
                  <Detail label="Applicants" value={String(applicants)} />
                  <Detail
                    label="Locum Rate"
                    value={`R${Number(
                      shift.locum_rate || shift.hourly_rate || 0
                    ).toFixed(2)}`}
                  />
                  <Detail
                    label="CareStaffing 10%"
                    value={`R${(
                      Number(
                        shift.locum_rate || shift.hourly_rate || 0
                      ) * 0.1
                    ).toFixed(2)}`}
                  />
                </div>

                <div style={styles.shiftActions}>
                  <Link
                    href={`/employer/applicants?shift=${shift.id}`}
                    style={styles.applicantLink}
                  >
                    View Applicants →
                  </Link>

                  {shiftCanBeEmailed(shift) && (
                    <button
                      type="button"
                      onClick={() => void notifyLocumsAboutShift(shift)}
                      disabled={notifyingShiftId === shift.id}
                      style={{
                        ...styles.notifyLocumsButton,
                        ...(notifyingShiftId === shift.id
                          ? styles.disabledButton
                          : {}),
                      }}
                    >
                      {notifyingShiftId === shift.id
                        ? "Sending emails..."
                        : `✉ Email ${
                            shift.profession_required || "Matching"
                          } Locums`}
                    </button>
                  )}

                  {shiftCanBeEmailed(shift) && (
                    <button
                      type="button"
                      onClick={() => void completeAndCloseShift(shift)}
                      disabled={closingShiftId === shift.id}
                      style={{
                        ...styles.completeShiftButton,
                        ...(closingShiftId === shift.id
                          ? styles.disabledButton
                          : {}),
                      }}
                    >
                      {closingShiftId === shift.id
                        ? "Closing..."
                        : "✓ Complete & Close Post"}
                    </button>
                  )}
                </div>

                <hr style={styles.hr} />

                <div style={styles.sectionHeading}>
                  <div>
                    <h3 style={{ margin: 0 }}>Timesheets & Invoices</h3>
                    <p style={styles.muted}>
                      Review submitted work before making payment.
                    </p>
                  </div>

                  <span style={styles.countBadge}>
                    {shiftTimesheets.length}
                  </span>
                </div>

                {shiftTimesheets.length === 0 ? (
                  <div style={styles.emptyTimesheet}>
                    No timesheets submitted for this shift yet.
                  </div>
                ) : (
                  <div style={styles.timesheetList}>
                    {shiftTimesheets.map((row) => {
                      const profile = profileForTimesheet(row);
                      const status =
                        row.status?.toLowerCase() || "submitted";

                      const gross = grossAmount(row);
                      const fee = careStaffingFee(row);
                      const employerTotal = employerPays(row);
                      const amendment = amendments[row.id];

                      const proposedHours = amendment
                        ? calculateHours(
                            amendment.startTime,
                            amendment.endTime,
                            Number(amendment.breakMinutes) || 0
                          )
                        : 0;

                      const proposedPay =
                        proposedHours * Number(row.agreed_rate || 0);

                      const fullName =
                        [profile?.first_name, profile?.surname]
                          .filter(Boolean)
                          .join(" ") || "Healthcare Professional";

                      return (
                        <article key={row.id} style={styles.timesheetCard}>
                          <div style={styles.timesheetHeader}>
                            <div>
                              <p style={styles.workedLabel}>WORKED</p>

                              <h3 style={{ margin: "4px 0" }}>
                                {formatDate(row.work_date)}
                              </h3>

                              <p style={styles.muted}>
                                {Number(row.hours_worked || 0).toFixed(2)} hours
                                {" • "}
                                {formatTime(row.start_time)}–
                                {formatTime(row.end_time)}
                              </p>

                              <p style={styles.workerName}>{fullName}</p>
                            </div>

                            <StatusBadge status={status} />
                          </div>

                          <div style={styles.moneyGrid}>
                            <MoneyBox
                              label="Locum Earnings"
                              value={`R${gross.toFixed(2)}`}
                            />
                            <MoneyBox
                              label="CareStaffing 10%"
                              value={`R${fee.toFixed(2)}`}
                            />
                            <MoneyBox
                              label="Employer Pays"
                              value={`R${employerTotal.toFixed(2)}`}
                              highlight
                            />
                          </div>

                          {status === "resubmitted" && (
                            <div style={styles.resubmittedBox}>
                              <strong>✓ Locum responded to amendment</strong>

                              <p style={{ margin: "8px 0 0" }}>
                                Final submitted time:{" "}
                                <strong>
                                  {formatTime(row.start_time)} –{" "}
                                  {formatTime(row.end_time)}
                                </strong>
                              </p>

                              <p style={{ margin: "6px 0 0" }}>
                                Final hours:{" "}
                                <strong>
                                  {Number(row.hours_worked || 0).toFixed(2)}
                                </strong>
                              </p>

                              {row.amendment_accepted_at && (
                                <p style={{ margin: "6px 0 0" }}>
                                  Employer amendment accepted by locum.
                                </p>
                              )}

                              <p style={{ margin: "6px 0 0" }}>
                                Please complete final employer approval.
                              </p>
                            </div>
                          )}

                          {row.notes && (
                            <div style={styles.locumNote}>
                              <strong>Locum note:</strong> {row.notes}
                            </div>
                          )}

                          {status === "amendment_requested" && (
                            <div style={styles.amendmentExisting}>
                              <strong>Amendment requested</strong>

                              <p>
                                Proposed:{" "}
                                {formatTime(
                                  row.employer_proposed_start_time
                                )}{" "}
                                –{" "}
                                {formatTime(
                                  row.employer_proposed_end_time
                                )}
                              </p>

                              <p>
                                Break:{" "}
                                {row.employer_proposed_break_minutes || 0} min
                              </p>

                              <p>
                                Proposed hours:{" "}
                                {Number(
                                  row.employer_proposed_hours || 0
                                ).toFixed(2)}
                              </p>

                              <p>
                                Reason:{" "}
                                {row.employer_amendment_reason || "—"}
                              </p>

                              <strong>
                                Waiting for locum response / resubmission.
                              </strong>
                            </div>
                          )}

                          {status === "rejected" && (
                            <div style={styles.rejectedBox}>
                              <strong>Timesheet rejected</strong>
                              <p>
                                {row.rejection_reason ||
                                  "No reason supplied."}
                              </p>
                            </div>
                          )}

                          {status === "approved" && (
                            <div style={styles.approvedBox}>
                              <div>
                                <strong>✓ Timesheet Approved</strong>
                                <p style={{ margin: "4px 0 0" }}>
                                  Invoice is ready for payment.
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => goToStripePayment(row)}
                                style={styles.payButton}
                              >
                                💳 PAY R{employerTotal.toFixed(2)}
                              </button>
                            </div>
                          )}

                          {(status === "submitted" ||
                            status === "resubmitted") && (
                            <div style={styles.reviewBox}>
                              <div>
                                <strong>
                                  {status === "resubmitted"
                                    ? "Final review required"
                                    : "Review submitted timesheet"}
                                </strong>

                                <p style={styles.muted}>
                                  {status === "resubmitted"
                                    ? "The locum has responded to the amendment. Approve, request another amendment or reject."
                                    : "Confirm the hours, request a correction or reject the timesheet."}
                                </p>
                              </div>

                              <div style={styles.reviewButtons}>
                                <button
                                  type="button"
                                  onClick={() => openAmendment(row)}
                                  style={styles.amendButton}
                                >
                                  ✏️ Request Amendment
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openReject(row)}
                                  style={styles.rejectButton}
                                >
                                  Reject
                                </button>

                                <button
                                  type="button"
                                  disabled={savingId === row.id}
                                  onClick={() => approveTimesheet(row)}
                                  style={styles.approveButton}
                                >
                                  {savingId === row.id
                                    ? "Saving..."
                                    : "✓ Approve Timesheet"}
                                </button>
                              </div>
                            </div>
                          )}

                          {amendmentOpenId === row.id && amendment && (
                            <div style={styles.amendmentPanel}>
                              <h3 style={{ marginTop: 0 }}>
                                Request Timesheet Amendment
                              </h3>

                              <div style={styles.originalBox}>
                                <strong>Current submitted timesheet</strong>
                                <p>
                                  {formatTime(row.start_time)} –{" "}
                                  {formatTime(row.end_time)}
                                </p>
                                <p>Break: {row.break_minutes || 0} min</p>
                                <p>
                                  Hours:{" "}
                                  {Number(row.hours_worked || 0).toFixed(2)}
                                </p>
                              </div>

                              <div style={styles.amendGrid}>
                                <Field label="Proposed Start">
                                  <input
                                    type="time"
                                    value={amendment.startTime}
                                    onChange={(e) =>
                                      setAmendments((current) => ({
                                        ...current,
                                        [row.id]: {
                                          ...current[row.id],
                                          startTime: e.target.value,
                                        },
                                      }))
                                    }
                                    style={styles.input}
                                  />
                                </Field>

                                <Field label="Proposed End">
                                  <input
                                    type="time"
                                    value={amendment.endTime}
                                    onChange={(e) =>
                                      setAmendments((current) => ({
                                        ...current,
                                        [row.id]: {
                                          ...current[row.id],
                                          endTime: e.target.value,
                                        },
                                      }))
                                    }
                                    style={styles.input}
                                  />
                                </Field>

                                <Field label="Break Minutes">
                                  <input
                                    type="number"
                                    min="0"
                                    value={amendment.breakMinutes}
                                    onChange={(e) =>
                                      setAmendments((current) => ({
                                        ...current,
                                        [row.id]: {
                                          ...current[row.id],
                                          breakMinutes: e.target.value,
                                        },
                                      }))
                                    }
                                    style={styles.input}
                                  />
                                </Field>

                                <Field label="Proposed Hours">
                                  <input
                                    readOnly
                                    value={proposedHours.toFixed(2)}
                                    style={{
                                      ...styles.input,
                                      background: "#f1f5f9",
                                    }}
                                  />
                                </Field>
                              </div>

                              <div style={styles.proposedPay}>
                                Proposed locum earnings:{" "}
                                <strong>R{proposedPay.toFixed(2)}</strong>
                              </div>

                              <Field label="Reason for amendment">
                                <textarea
                                  rows={3}
                                  value={amendment.reason}
                                  onChange={(e) =>
                                    setAmendments((current) => ({
                                      ...current,
                                      [row.id]: {
                                        ...current[row.id],
                                        reason: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Example: Locum signed in at 10:15 according to the pharmacy attendance record."
                                  style={{
                                    ...styles.input,
                                    resize: "vertical",
                                  }}
                                />
                              </Field>

                              <div style={styles.panelButtons}>
                                <button
                                  type="button"
                                  onClick={() => setAmendmentOpenId("")}
                                  style={styles.cancelButton}
                                >
                                  Cancel
                                </button>

                                <button
                                  type="button"
                                  disabled={savingId === row.id}
                                  onClick={() => requestAmendment(row)}
                                  style={styles.sendAmendmentButton}
                                >
                                  Send Amendment to Locum
                                </button>
                              </div>
                            </div>
                          )}

                          {rejectOpenId === row.id && (
                            <div style={styles.rejectPanel}>
                              <h3 style={{ marginTop: 0 }}>
                                Reject Timesheet
                              </h3>

                              <p style={styles.muted}>
                                Use this only where the timesheet itself should
                                not be accepted. For disagreements about hours,
                                use Request Amendment.
                              </p>

                              <Field label="Reason for rejection">
                                <textarea
                                  rows={3}
                                  value={rejectionReasons[row.id] || ""}
                                  onChange={(e) =>
                                    setRejectionReasons((current) => ({
                                      ...current,
                                      [row.id]: e.target.value,
                                    }))
                                  }
                                  style={{
                                    ...styles.input,
                                    resize: "vertical",
                                  }}
                                />
                              </Field>

                              <div style={styles.panelButtons}>
                                <button
                                  type="button"
                                  onClick={() => setRejectOpenId("")}
                                  style={styles.cancelButton}
                                >
                                  Cancel
                                </button>

                                <button
                                  type="button"
                                  onClick={() => rejectTimesheet(row)}
                                  style={styles.rejectConfirmButton}
                                >
                                  Confirm Rejection
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
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
    <div>
      <div style={styles.smallLabel}>{label}</div>
      <strong>{value}</strong>
    </div>
  );
}

function MoneyBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.moneyBox,
        ...(highlight ? styles.moneyHighlight : {}),
      }}
    >
      <span style={styles.smallLabel}>{label}</span>
      <strong style={{ fontSize: "18px" }}>{value}</strong>
    </div>
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
      <span style={styles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  let style: React.CSSProperties = styles.statusSubmitted;

  if (status === "approved") style = styles.statusApproved;
  if (status === "amendment_requested") style = styles.statusAmendment;
  if (status === "rejected") style = styles.statusRejected;
  if (status === "resubmitted") style = styles.statusResubmitted;

  return (
    <span
      style={{
        ...styles.statusBase,
        ...style,
      }}
    >
      {status.replaceAll("_", " ").toUpperCase()}
    </span>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  return value.slice(0, 5);
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "28px 20px 60px",
    fontFamily: "Arial, sans-serif",
  },
  container: { maxWidth: "1180px", margin: "0 auto" },
  back: {
    color: "#0f766e",
    fontWeight: 900,
    textDecoration: "none",
  },
  hero: {
    background: "linear-gradient(135deg,#0f172a,#0f766e)",
    color: "white",
    padding: "34px",
    borderRadius: "28px",
    margin: "20px 0",
  },
  eyebrow: {
    margin: 0,
    color: "#99f6e4",
    fontWeight: 900,
    letterSpacing: "1px",
  },
  title: { margin: "8px 0", fontSize: "42px" },
  subtitle: {
    maxWidth: "760px",
    color: "#ccfbf1",
    lineHeight: 1.5,
  },
  heroActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "18px",
  },
  refreshButton: {
    background: "white",
    color: "#0f766e",
    border: "2px solid #99f6e4",
    padding: "14px 20px",
    borderRadius: "14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  stripeButton: {
    background: "#39ff14",
    color: "#052e16",
    border: "2px solid #22c55e",
    boxShadow: "0 0 20px rgba(57,255,20,0.45)",
    padding: "14px 20px",
    borderRadius: "14px",
    fontWeight: 900,
    cursor: "pointer",
  },
  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "18px",
    fontWeight: 800,
  },
  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "18px",
    fontWeight: 800,
  },
  card: {
    background: "white",
    padding: "24px",
    borderRadius: "20px",
  },
  shiftCard: {
    marginTop: "20px",
    background: "white",
    padding: "26px",
    borderRadius: "22px",
    boxShadow: "0 10px 28px rgba(15,23,42,.06)",
  },
  shiftTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
  },
  shiftTitle: { margin: 0, fontSize: "28px" },
  location: { color: "#64748b" },
  shiftStatus: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "8px 12px",
    fontWeight: 900,
    height: "fit-content",
  },
  shiftDetails: {
    marginTop: "20px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
    gap: "16px",
  },
  shiftActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "20px",
  },
  applicantLink: {
    display: "inline-block",
    color: "#0f766e",
    fontWeight: 900,
  },
  notifyLocumsButton: {
    border: "none",
    borderRadius: "12px",
    background: "#0f766e",
    color: "white",
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
  completeShiftButton: {
    border: "1px solid #dc2626",
    borderRadius: "12px",
    background: "#fff",
    color: "#b91c1c",
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  hr: {
    border: 0,
    borderTop: "1px solid #e2e8f0",
    margin: "24px 0",
  },
  sectionHeading: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
  },
  countBadge: {
    width: "34px",
    height: "34px",
    display: "grid",
    placeItems: "center",
    borderRadius: "999px",
    background: "#ccfbf1",
    color: "#0f766e",
    fontWeight: 900,
  },
  emptyTimesheet: {
    marginTop: "18px",
    background: "#f8fafc",
    padding: "18px",
    borderRadius: "14px",
    color: "#64748b",
  },
  timesheetList: {
    display: "grid",
    gap: "18px",
    marginTop: "18px",
  },
  timesheetCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "20px",
  },
  timesheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
  },
  workedLabel: {
    margin: 0,
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "1px",
    color: "#64748b",
  },
  workerName: {
    margin: "10px 0 0",
    fontWeight: 800,
    color: "#334155",
  },
  moneyGrid: {
    marginTop: "18px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
    gap: "12px",
  },
  moneyBox: {
    padding: "15px",
    borderRadius: "12px",
    background: "#f8fafc",
    display: "grid",
    gap: "5px",
  },
  moneyHighlight: {
    background: "#dcfce7",
    color: "#166534",
  },
  smallLabel: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 700,
  },
  locumNote: {
    marginTop: "15px",
    padding: "12px",
    background: "#f8fafc",
    borderRadius: "10px",
  },
  resubmittedBox: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "14px",
    background: "#e0f2fe",
    color: "#075985",
    border: "1px solid #7dd3fc",
  },
  reviewBox: {
    marginTop: "18px",
    padding: "16px",
    borderRadius: "14px",
    background: "#fffbeb",
  },
  reviewButtons: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "15px",
  },
  amendButton: {
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid #f59e0b",
    background: "#fef3c7",
    color: "#92400e",
    fontWeight: 900,
    cursor: "pointer",
  },
  rejectButton: {
    padding: "12px 16px",
    borderRadius: "10px",
    border: "1px solid #fecaca",
    background: "white",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  approveButton: {
    padding: "12px 18px",
    border: "none",
    borderRadius: "10px",
    background: "#0f766e",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  amendmentPanel: {
    marginTop: "18px",
    padding: "20px",
    border: "2px solid #f59e0b",
    borderRadius: "16px",
    background: "#fffdf5",
  },
  originalBox: {
    background: "#f8fafc",
    borderRadius: "12px",
    padding: "14px",
    marginBottom: "16px",
  },
  amendGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: "14px",
  },
  field: { display: "grid", gap: "6px" },
  fieldLabel: { fontWeight: 800, color: "#334155" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    fontSize: "15px",
  },
  proposedPay: {
    margin: "15px 0",
    padding: "12px",
    borderRadius: "10px",
    background: "#ecfeff",
    color: "#0f766e",
  },
  panelButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "15px",
  },
  cancelButton: {
    padding: "11px 15px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  sendAmendmentButton: {
    padding: "11px 16px",
    border: 0,
    borderRadius: "10px",
    background: "#f59e0b",
    color: "#451a03",
    fontWeight: 900,
    cursor: "pointer",
  },
  rejectPanel: {
    marginTop: "18px",
    padding: "20px",
    borderRadius: "16px",
    border: "2px solid #fecaca",
    background: "#fff7f7",
  },
  rejectConfirmButton: {
    padding: "11px 16px",
    border: 0,
    borderRadius: "10px",
    background: "#dc2626",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },
  amendmentExisting: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "14px",
    background: "#fef3c7",
    color: "#92400e",
  },
  rejectedBox: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "14px",
    background: "#fee2e2",
    color: "#991b1b",
  },
  approvedBox: {
    marginTop: "16px",
    padding: "16px",
    borderRadius: "14px",
    background: "#dcfce7",
    color: "#166534",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "15px",
  },
  payButton: {
    background: "#39ff14",
    color: "#052e16",
    border: "2px solid #22c55e",
    boxShadow: "0 0 18px rgba(57,255,20,.40)",
    padding: "13px 18px",
    borderRadius: "11px",
    fontWeight: 900,
    cursor: "pointer",
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
  statusAmendment: {
    background: "#ffedd5",
    color: "#9a3412",
  },
  statusRejected: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  statusResubmitted: {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  muted: { color: "#64748b", margin: "5px 0" },
  primaryLink: { color: "#0f766e", fontWeight: 900 },
};
