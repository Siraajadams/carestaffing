"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Shift = {
  id: string;
  title: string | null;
  profession_required: string | null;
  business_name: string | null;
  city: string | null;
  start_date: string | null;
  start_time: string | null;
  end_time: string | null;
  employer_rate: number | null;
  locum_rate: number | null;
  platform_fee: number | null;
  currency: string | null;
  status: string | null;
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
  status: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string | null;
};

type Payment = {
  id: string;
  timesheet_id: string | null;
  payment_status: string | null;
  payout_status: string | null;
  locum_amount: number | null;
  platform_fee: number | null;
  employer_total: number | null;
  stripe_checkout_session_id: string | null;
  paid_at: string | null;
};

export default function EmployerShiftsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadPage();
  }, []);

  useEffect(() => {
    const payment = searchParams.get("payment");

    if (payment === "success") {
      setMessage(
        "Stripe payment completed. CareStaffing is confirming the payment."
      );

      const timer = window.setTimeout(() => {
        void loadPage();
      }, 1500);

      return () => window.clearTimeout(timer);
    }

    if (payment === "cancelled") {
      setError("Stripe payment was cancelled. No payment was taken.");
    }
  }, [searchParams]);

  async function loadPage() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: shiftData, error: shiftError } = await supabase
        .from("shifts")
        .select(
          `
          id,
          title,
          profession_required,
          business_name,
          city,
          start_date,
          start_time,
          end_time,
          employer_rate,
          locum_rate,
          platform_fee,
          currency,
          status
        `
        )
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (shiftError) {
        throw shiftError;
      }

      const employerShifts = (shiftData || []) as Shift[];
      setShifts(employerShifts);

      const shiftIds = employerShifts.map((shift) => shift.id);

      if (shiftIds.length === 0) {
        setTimesheets([]);
        setPayments([]);
        return;
      }

      const { data: timesheetData, error: timesheetError } = await supabase
        .from("timesheets")
        .select(
          `
          id,
          shift_id,
          locum_id,
          work_date,
          start_time,
          end_time,
          break_minutes,
          hours_worked,
          agreed_rate,
          total_amount,
          status,
          submitted_at,
          approved_at,
          created_at
        `
        )
        .in("shift_id", shiftIds)
        .order("created_at", { ascending: false });

      if (timesheetError) {
        throw timesheetError;
      }

      const employerTimesheets = (timesheetData || []) as Timesheet[];
      setTimesheets(employerTimesheets);

      const timesheetIds = employerTimesheets.map((item) => item.id);

      if (timesheetIds.length === 0) {
        setPayments([]);
        return;
      }

      const { data: paymentData, error: paymentError } = await supabase
        .from("payments")
        .select(
          `
          id,
          timesheet_id,
          payment_status,
          payout_status,
          locum_amount,
          platform_fee,
          employer_total,
          stripe_checkout_session_id,
          paid_at
        `
        )
        .in("timesheet_id", timesheetIds)
        .order("created_at", { ascending: false });

      if (paymentError) {
        console.error("Payment loading error:", paymentError);
        setPayments([]);
      } else {
        setPayments((paymentData || []) as Payment[]);
      }
    } catch (err: any) {
      console.error("Employer shifts load error:", err);
      setError(err?.message || "Could not load employer shifts.");
    } finally {
      setLoading(false);
    }
  }

  const timesheetsByShift = useMemo(() => {
    const map = new Map<string, Timesheet[]>();

    for (const timesheet of timesheets) {
      const existing = map.get(timesheet.shift_id) || [];
      existing.push(timesheet);
      map.set(timesheet.shift_id, existing);
    }

    return map;
  }, [timesheets]);

  const paymentByTimesheet = useMemo(() => {
    const map = new Map<string, Payment>();

    for (const payment of payments) {
      if (payment.timesheet_id && !map.has(payment.timesheet_id)) {
        map.set(payment.timesheet_id, payment);
      }
    }

    return map;
  }, [payments]);

  async function approveTimesheet(timesheetId: string) {
    setActionId(timesheetId);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const target = timesheets.find((item) => item.id === timesheetId);

      if (!target) {
        throw new Error("Timesheet not found.");
      }

      const shift = shifts.find((item) => item.id === target.shift_id);

      if (!shift) {
        throw new Error("Shift not found.");
      }

      const hours = Number(target.hours_worked || 0);
      const agreedRate = Number(
        target.agreed_rate || shift.locum_rate || 0
      );

      const totalAmount =
        Number(target.total_amount || 0) > 0
          ? Number(target.total_amount)
          : hours * agreedRate;

      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        throw new Error(
          "The timesheet does not contain a valid payable amount."
        );
      }

      const { error: updateError } = await supabase
        .from("timesheets")
        .update({
          status: "approved",
          agreed_rate: agreedRate,
          total_amount: Number(totalAmount.toFixed(2)),
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", timesheetId);

      if (updateError) {
        throw updateError;
      }

      setMessage(
        "Timesheet approved. The invoice is now ready for Stripe payment."
      );

      await loadPage();
    } catch (err: any) {
      console.error("Approve timesheet error:", err);
      setError(err?.message || "Could not approve the timesheet.");
    } finally {
      setActionId("");
    }
  }

  async function rejectTimesheet(timesheetId: string) {
    setActionId(timesheetId);
    setError("");
    setMessage("");

    try {
      const { error: updateError } = await supabase
        .from("timesheets")
        .update({
          status: "rejected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", timesheetId);

      if (updateError) {
        throw updateError;
      }

      setMessage("Timesheet rejected.");
      await loadPage();
    } catch (err: any) {
      console.error("Reject timesheet error:", err);
      setError(err?.message || "Could not reject the timesheet.");
    } finally {
      setActionId("");
    }
  }

  async function payTimesheet(timesheetId: string) {
    setActionId(timesheetId);
    setError("");
    setMessage("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          timesheetId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Could not create Stripe Checkout session."
        );
      }

      if (!result?.url) {
        throw new Error("Stripe Checkout did not return a payment URL.");
      }

      window.location.href = result.url;
    } catch (err: any) {
      console.error("Stripe payment error:", err);
      setError(err?.message || "Could not start Stripe payment.");
      setActionId("");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function currencySymbol(currency?: string | null) {
    if (currency === "GBP") return "£";
    if (currency === "EUR") return "€";
    if (currency === "NZD") return "NZ$";
    return "R";
  }

  function money(value: number | null | undefined, currency?: string | null) {
    return `${currencySymbol(currency)}${Number(value || 0).toFixed(2)}`;
  }

  function getLocumAmount(timesheet: Timesheet, shift: Shift) {
    const stored = Number(timesheet.total_amount || 0);

    if (stored > 0) {
      return stored;
    }

    const rate = Number(
      timesheet.agreed_rate || shift.locum_rate || 0
    );

    return Number(timesheet.hours_worked || 0) * rate;
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";

    const date = new Date(
      value.length === 10 ? `${value}T00:00:00` : value
    );

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.nav}>
          <Link href="/employer" style={styles.brand}>
            CARESTAFFING
          </Link>

          <div style={styles.links}>
            <Link href="/employer" style={styles.link}>
              Post Shift
            </Link>

            <Link href="/employer/applicants" style={styles.link}>
              Applicants
            </Link>

            <Link href="/employer/profile" style={styles.link}>
              Organisation Profile
            </Link>

            <button onClick={logout} style={styles.logout}>
              Logout
            </button>
          </div>
        </div>

        <section style={styles.hero}>
          <div>
            <p style={styles.label}>EMPLOYER PORTAL</p>

            <h1 style={styles.title}>My Shifts & Payments</h1>

            <p style={styles.subtitle}>
              Review locum timesheets, approve completed work and pay
              approved invoices securely with Stripe.
            </p>
          </div>

          <div style={styles.stripeBadge}>STRIPE PAYMENTS</div>
        </section>

        {message && <div style={styles.success}>{message}</div>}
        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <div style={styles.card}>Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div style={styles.card}>
            <h2>No shifts posted yet</h2>

            <p style={styles.muted}>
              Post your first healthcare shift.
            </p>

            <Link href="/employer" style={styles.primaryLink}>
              + Post New Shift
            </Link>
          </div>
        ) : (
          <div style={styles.grid}>
            {shifts.map((shift) => {
              const shiftTimesheets =
                timesheetsByShift.get(shift.id) || [];

              return (
                <article key={shift.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div>
                      <h2 style={{ margin: 0 }}>
                        {shift.title || "Healthcare Shift"}
                      </h2>

                      <p style={styles.muted}>
                        {shift.business_name || "Organisation"}
                      </p>
                    </div>

                    <span style={styles.status}>
                      {(shift.status || "open").toUpperCase()}
                    </span>
                  </div>

                  <div style={styles.details}>
                    <Info
                      label="Profession"
                      value={shift.profession_required || "—"}
                    />

                    <Info label="City" value={shift.city || "—"} />

                    <Info
                      label="Date"
                      value={formatDate(shift.start_date)}
                    />

                    <Info
                      label="Time"
                      value={
                        shift.start_time && shift.end_time
                          ? `${shift.start_time.slice(
                              0,
                              5
                            )} - ${shift.end_time.slice(0, 5)}`
                          : "—"
                      }
                    />
                  </div>

                  <div style={styles.rates}>
                    <RateBox
                      label="Locum Rate"
                      value={money(
                        shift.locum_rate,
                        shift.currency
                      )}
                    />

                    <RateBox
                      label="CareStaffing Fee"
                      value={money(
                        shift.platform_fee,
                        shift.currency
                      )}
                    />

                    <RateBox
                      label="Organisation Rate"
                      value={money(
                        shift.employer_rate,
                        shift.currency
                      )}
                    />
                  </div>

                  <div style={styles.topActions}>
                    <Link
                      href={`/employer/applicants?shift=${shift.id}`}
                      style={styles.secondaryLink}
                    >
                      View Applicants
                    </Link>
                  </div>

                  <div style={styles.divider} />

                  <div style={styles.timesheetHeader}>
                    <div>
                      <h3 style={styles.timesheetTitle}>
                        Timesheets & Invoices
                      </h3>

                      <p style={styles.mutedSmall}>
                        Approve submitted work before making payment.
                      </p>
                    </div>

                    <span style={styles.countBadge}>
                      {shiftTimesheets.length}
                    </span>
                  </div>

                  {shiftTimesheets.length === 0 ? (
                    <div style={styles.emptyTimesheet}>
                      No timesheet submitted for this shift yet.
                    </div>
                  ) : (
                    <div style={styles.timesheetList}>
                      {shiftTimesheets.map((timesheet) => {
                        const payment =
                          paymentByTimesheet.get(timesheet.id);

                        const status = String(
                          timesheet.status || "submitted"
                        ).toLowerCase();

                        const paymentStatus = String(
                          payment?.payment_status || "unpaid"
                        ).toLowerCase();

                        const paid =
                          paymentStatus === "paid" ||
                          paymentStatus === "succeeded";

                        const locumAmount = getLocumAmount(
                          timesheet,
                          shift
                        );

                        const platformFee = Number(
                          (locumAmount * 0.1).toFixed(2)
                        );

                        const employerTotal = Number(
                          (locumAmount + platformFee).toFixed(2)
                        );

                        return (
                          <div
                            key={timesheet.id}
                            style={styles.timesheetCard}
                          >
                            <div style={styles.timesheetTop}>
                              <div>
                                <p style={styles.smallLabel}>
                                  WORKED
                                </p>

                                <strong>
                                  {formatDate(timesheet.work_date)}
                                </strong>

                                <p style={styles.mutedSmall}>
                                  {Number(
                                    timesheet.hours_worked || 0
                                  ).toFixed(2)}{" "}
                                  hours
                                  {timesheet.start_time &&
                                  timesheet.end_time
                                    ? ` • ${timesheet.start_time.slice(
                                        0,
                                        5
                                      )}–${timesheet.end_time.slice(
                                        0,
                                        5
                                      )}`
                                    : ""}
                                </p>
                              </div>

                              <TimesheetBadge status={status} />
                            </div>

                            <div style={styles.invoiceBreakdown}>
                              <RateBox
                                label="Locum Earnings"
                                value={money(
                                  locumAmount,
                                  shift.currency
                                )}
                              />

                              <RateBox
                                label="CareStaffing 10%"
                                value={money(
                                  platformFee,
                                  shift.currency
                                )}
                              />

                              <RateBox
                                label="Employer Pays"
                                value={money(
                                  employerTotal,
                                  shift.currency
                                )}
                                highlight
                              />
                            </div>

                            {paid ? (
                              <div style={styles.paidBox}>
                                <div>
                                  <strong>
                                    ✓ Employer Payment Confirmed
                                  </strong>

                                  <div style={styles.mutedSmall}>
                                    {payment?.paid_at
                                      ? `Paid ${formatDate(
                                          payment.paid_at
                                        )}`
                                      : "Stripe payment received"}
                                  </div>
                                </div>

                                <span style={styles.paidBadge}>
                                  PAID
                                </span>
                              </div>
                            ) : status === "approved" ? (
                              <div style={styles.paymentArea}>
                                <div>
                                  <strong>
                                    Invoice ready for payment
                                  </strong>

                                  <p style={styles.mutedSmall}>
                                    The locum receives{" "}
                                    {money(
                                      locumAmount,
                                      shift.currency
                                    )}. CareStaffing adds 10% to
                                    the employer total.
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    payTimesheet(timesheet.id)
                                  }
                                  disabled={actionId === timesheet.id}
                                  style={styles.payButton}
                                >
                                  {actionId === timesheet.id
                                    ? "Opening Stripe..."
                                    : `Pay ${money(
                                        employerTotal,
                                        shift.currency
                                      )} with Stripe`}
                                </button>
                              </div>
                            ) : status === "rejected" ? (
                              <div style={styles.rejectedBox}>
                                Timesheet rejected. Ask the locum to
                                correct and resubmit it.
                              </div>
                            ) : (
                              <div style={styles.approvalArea}>
                                <div>
                                  <strong>
                                    Review submitted timesheet
                                  </strong>

                                  <p style={styles.mutedSmall}>
                                    Confirm the hours before approving
                                    this invoice for payment.
                                  </p>
                                </div>

                                <div style={styles.approvalButtons}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      rejectTimesheet(timesheet.id)
                                    }
                                    disabled={
                                      actionId === timesheet.id
                                    }
                                    style={styles.rejectButton}
                                  >
                                    Reject
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      approveTimesheet(timesheet.id)
                                    }
                                    disabled={
                                      actionId === timesheet.id
                                    }
                                    style={styles.approveButton}
                                  >
                                    {actionId === timesheet.id
                                      ? "Saving..."
                                      : "Approve Timesheet"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
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

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.info}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function RateBox({
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
        ...styles.rateBox,
        ...(highlight ? styles.rateBoxHighlight : {}),
      }}
    >
      <small>{label}</small>
      <strong style={highlight ? styles.highlightValue : undefined}>
        {value}
      </strong>
    </div>
  );
}

function TimesheetBadge({ status }: { status: string }) {
  const clean = status || "submitted";

  const style =
    clean === "approved"
      ? styles.badgeApproved
      : clean === "rejected"
      ? styles.badgeRejected
      : styles.badgeSubmitted;

  return (
    <span style={{ ...styles.timesheetBadge, ...style }}>
      {clean.toUpperCase()}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },

  container: {
    maxWidth: 1150,
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
    color: "#0f766e",
    fontWeight: 900,
    textDecoration: "none",
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
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "9px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  hero: {
    background: "linear-gradient(135deg,#0f172a,#0f766e)",
    color: "white",
    borderRadius: 24,
    padding: 30,
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
    flexWrap: "wrap",
  },

  label: {
    color: "#99f6e4",
    fontWeight: 900,
    fontSize: 13,
    margin: 0,
  },

  title: {
    fontSize: 38,
    margin: "8px 0",
  },

  subtitle: {
    color: "#cbd5e1",
    maxWidth: 680,
    lineHeight: 1.5,
  },

  stripeBadge: {
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.22)",
    borderRadius: 14,
    padding: "11px 15px",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.8,
  },

  grid: {
    display: "grid",
    gap: 18,
  },

  card: {
    background: "white",
    borderRadius: 20,
    padding: 24,
    border: "1px solid #e2e8f0",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 15,
    flexWrap: "wrap",
  },

  muted: {
    color: "#64748b",
  },

  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    margin: "5px 0 0",
    lineHeight: 1.4,
  },

  status: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    padding: "7px 11px",
    fontWeight: 900,
    fontSize: 12,
    height: "fit-content",
  },

  details: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(150px,1fr))",
    gap: 12,
    marginTop: 20,
  },

  info: {
    background: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 5,
  },

  rates: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(160px,1fr))",
    gap: 12,
    marginTop: 16,
  },

  rateBox: {
    background: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 5,
    border: "1px solid #e2e8f0",
  },

  rateBoxHighlight: {
    background: "#ecfdf5",
    border: "1px solid #86efac",
  },

  highlightValue: {
    color: "#166534",
    fontSize: 18,
  },

  topActions: {
    marginTop: 18,
  },

  primaryLink: {
    display: "inline-block",
    background: "#0f766e",
    color: "white",
    padding: "11px 16px",
    borderRadius: 11,
    textDecoration: "none",
    fontWeight: 800,
  },

  secondaryLink: {
    display: "inline-block",
    background: "#f1f5f9",
    color: "#0f172a",
    padding: "10px 15px",
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 800,
  },

  divider: {
    height: 1,
    background: "#e2e8f0",
    margin: "24px 0",
  },

  timesheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
  },

  timesheetTitle: {
    margin: 0,
    color: "#0f172a",
  },

  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "#e0f2fe",
    color: "#075985",
    fontWeight: 900,
  },

  emptyTimesheet: {
    marginTop: 15,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 13,
    padding: 18,
    color: "#64748b",
  },

  timesheetList: {
    display: "grid",
    gap: 14,
    marginTop: 16,
  },

  timesheetCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 18,
    background: "#ffffff",
  },

  timesheetTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 15,
    alignItems: "flex-start",
  },

  smallLabel: {
    margin: "0 0 5px",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.8,
    color: "#64748b",
  },

  timesheetBadge: {
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
  },

  badgeApproved: {
    background: "#dcfce7",
    color: "#166534",
  },

  badgeRejected: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  badgeSubmitted: {
    background: "#fef3c7",
    color: "#92400e",
  },

  invoiceBreakdown: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(155px,1fr))",
    gap: 10,
    marginTop: 16,
  },

  approvalArea: {
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
  },

  approvalButtons: {
    display: "flex",
    gap: 9,
    flexWrap: "wrap",
  },

  approveButton: {
    border: "none",
    borderRadius: 11,
    padding: "11px 15px",
    background: "#0f766e",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  },

  rejectButton: {
    border: "1px solid #fecaca",
    borderRadius: 11,
    padding: "11px 15px",
    background: "#fff",
    color: "#991b1b",
    fontWeight: 800,
    cursor: "pointer",
  },

  paymentArea: {
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 15,
    flexWrap: "wrap",
  },

  payButton: {
    border: "none",
    borderRadius: 12,
    padding: "13px 18px",
    background: "#635bff",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 14,
  },

  paidBox: {
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#166534",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 15,
    flexWrap: "wrap",
  },

  paidBadge: {
    background: "#166534",
    color: "white",
    borderRadius: 999,
    padding: "7px 11px",
    fontWeight: 900,
    fontSize: 11,
  },

  rejectedBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fecaca",
  },

  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
    border: "1px solid #bbf7d0",
    fontWeight: 700,
  },

  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
    border: "1px solid #fecaca",
    fontWeight: 700,
  },
};
