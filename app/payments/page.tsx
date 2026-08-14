"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Payment = {
  id: string;

  timesheet_id?: string | null;
  shift_id?: string | null;
  employer_id?: string | null;
  locum_id?: string | null;

  locum_amount: number;
  platform_fee: number;
  employer_total: number;

  payment_status: string;
  payout_status: string;

  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  stripe_transfer_id?: string | null;

  paid_at?: string | null;
  payout_at?: string | null;
  created_at: string;

  shifts?: {
    title?: string | null;
    location?: string | null;
    business_name?: string | null;
    shift_date?: string | null;
  } | null;
};

export default function PaymentsPage() {
  const router = useRouter();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPayments();
  }, []);

  async function loadPayments() {
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

      const { data, error: paymentError } = await supabase
        .from("payments")
        .select(
          `
            *,
            shifts (
              title,
              location,
              business_name,
              shift_date
            )
          `
        )
        .eq("locum_id", user.id)
        .order("created_at", { ascending: false });

      if (paymentError) {
        throw paymentError;
      }

      setPayments((data as Payment[]) || []);
    } catch (err: any) {
      console.error("Payment loading error:", err);

      setError(
        err?.message ||
          "Could not load your CareStaffing payment history."
      );
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    const grossEarned = payments.reduce(
      (sum, payment) =>
        sum + Number(payment.locum_amount || 0),
      0
    );

    const platformFees = payments.reduce(
      (sum, payment) =>
        sum + Number(payment.platform_fee || 0),
      0
    );

    const paidOut = payments
      .filter(
        (payment) =>
          payment.payout_status === "paid" ||
          payment.payout_status === "paid_out"
      )
      .reduce(
        (sum, payment) =>
          sum + Number(payment.locum_amount || 0),
        0
      );

    const pendingPayout = payments
      .filter(
        (payment) =>
          payment.payment_status === "paid" &&
          payment.payout_status !== "paid" &&
          payment.payout_status !== "paid_out"
      )
      .reduce(
        (sum, payment) =>
          sum + Number(payment.locum_amount || 0),
        0
      );

    return {
      grossEarned,
      platformFees,
      paidOut,
      pendingPayout,
    };
  }, [payments]);

  function money(value: number | null | undefined) {
    return `R${Number(value || 0).toLocaleString("en-ZA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard" style={styles.back}>
          ← Back to Dashboard
        </Link>

        <section style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>CARESTAFFING</p>

            <h1 style={styles.title}>Payments</h1>

            <p style={styles.subtitle}>
              Track your approved earnings, employer payments and
              Stripe payouts.
            </p>
          </div>

          <div style={styles.stripeBadge}>
            STRIPE CONNECT
          </div>
        </section>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={styles.card}>
            Loading payments...
          </div>
        ) : (
          <>
            <section style={styles.statsGrid}>
              <StatCard
                label="Gross Earned"
                value={money(totals.grossEarned)}
                helper="Your locum earnings"
              />

              <StatCard
                label="CareStaffing Fees"
                value={money(totals.platformFees)}
                helper="Paid by employers"
              />

              <StatCard
                label="Paid to You"
                value={money(totals.paidOut)}
                helper="Completed payouts"
              />

              <StatCard
                label="Pending Payout"
                value={money(totals.pendingPayout)}
                helper="Paid by employer, awaiting bank payout"
              />
            </section>

            <section style={styles.card}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.cardTitle}>
                    Payment History
                  </h2>

                  <p style={styles.muted}>
                    Payments appear once an employer pays an
                    approved CareStaffing invoice.
                  </p>
                </div>
              </div>

              {payments.length === 0 ? (
                <div style={styles.emptyBox}>
                  <div style={styles.emptyIcon}>💳</div>

                  <h3>No payments yet</h3>

                  <p style={styles.muted}>
                    Once your timesheet is approved and the employer
                    completes payment, the transaction will appear
                    here.
                  </p>

                  <Link
                    href="/invoices"
                    style={styles.primaryLink}
                  >
                    View Invoices
                  </Link>
                </div>
              ) : (
                <div style={styles.list}>
                  {payments.map((payment) => {
                    const shift = payment.shifts;

                    return (
                      <article
                        key={payment.id}
                        style={styles.paymentRow}
                      >
                        <div style={styles.paymentMain}>
                          <div style={styles.amountRow}>
                            <div>
                              <p style={styles.smallLabel}>
                                LOCUM EARNINGS
                              </p>

                              <h3 style={styles.rowTitle}>
                                {money(payment.locum_amount)}
                              </h3>
                            </div>

                            <PaymentStatusBadge
                              value={
                                payment.payment_status ||
                                "pending"
                              }
                            />
                          </div>

                          <div style={styles.shiftDetails}>
                            <strong>
                              {shift?.title ||
                                "Healthcare Shift"}
                            </strong>

                            <span>
                              {shift?.business_name ||
                                "CareStaffing Employer"}
                            </span>

                            <span>
                              {shift?.location || ""}
                              {shift?.shift_date
                                ? ` • ${formatDate(
                                    shift.shift_date
                                  )}`
                                : ""}
                            </span>
                          </div>

                          <div style={styles.amountBreakdown}>
                            <div>
                              <span style={styles.breakdownLabel}>
                                Locum amount
                              </span>

                              <strong>
                                {money(
                                  payment.locum_amount
                                )}
                              </strong>
                            </div>

                            <div>
                              <span style={styles.breakdownLabel}>
                                Employer platform fee
                              </span>

                              <strong>
                                {money(
                                  payment.platform_fee
                                )}
                              </strong>
                            </div>

                            <div>
                              <span style={styles.breakdownLabel}>
                                Employer paid
                              </span>

                              <strong>
                                {money(
                                  payment.employer_total
                                )}
                              </strong>
                            </div>
                          </div>

                          {payment.stripe_payment_intent_id && (
                            <p style={styles.reference}>
                              Stripe payment:{" "}
                              {payment.stripe_payment_intent_id}
                            </p>
                          )}
                        </div>

                        <div style={styles.payoutColumn}>
                          <span style={styles.smallLabel}>
                            PAYOUT STATUS
                          </span>

                          <PayoutStatusBadge
                            value={
                              payment.payout_status ||
                              "pending"
                            }
                          />

                          {payment.payout_at && (
                            <span style={styles.payoutDate}>
                              {formatDate(
                                payment.payout_at
                              )}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>

      <h2 style={styles.statValue}>{value}</h2>

      <p style={styles.statHelper}>{helper}</p>
    </div>
  );
}

function PaymentStatusBadge({
  value,
}: {
  value: string;
}) {
  const clean = value || "pending";

  const paid =
    clean === "paid" ||
    clean === "succeeded";

  const failed =
    clean === "failed" ||
    clean === "cancelled";

  return (
    <span
      style={{
        ...styles.badge,
        ...(paid
          ? styles.badgePaid
          : failed
          ? styles.badgeFailed
          : styles.badgePending),
      }}
    >
      {paid
        ? "Employer Paid"
        : failed
        ? "Payment Failed"
        : "Awaiting Payment"}
    </span>
  );
}

function PayoutStatusBadge({
  value,
}: {
  value: string;
}) {
  const clean = value || "pending";

  const paid =
    clean === "paid" ||
    clean === "paid_out";

  const processing =
    clean === "processing" ||
    clean === "in_transit";

  const failed = clean === "failed";

  return (
    <span
      style={{
        ...styles.badge,
        ...(paid
          ? styles.badgePaid
          : failed
          ? styles.badgeFailed
          : processing
          ? styles.badgeProcessing
          : styles.badgePending),
      }}
    >
      {paid
        ? "Paid to Bank"
        : failed
        ? "Payout Failed"
        : processing
        ? "Processing"
        : "Pending"}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    margin: "20px 0",
    background:
      "linear-gradient(135deg,#0f172a,#16a34a)",
    color: "white",
    padding: "32px",
    borderRadius: "26px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: "0 0 7px",
    color: "#bbf7d0",
    fontWeight: 900,
    letterSpacing: "1px",
    fontSize: "12px",
  },

  title: {
    fontSize: "38px",
    margin: 0,
  },

  subtitle: {
    color: "#dcfce7",
    maxWidth: "650px",
    lineHeight: 1.5,
  },

  stripeBadge: {
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.25)",
    padding: "12px 16px",
    borderRadius: "14px",
    fontSize: "12px",
    fontWeight: 900,
    letterSpacing: "1px",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",
    gap: "18px",
    marginBottom: "22px",
  },

  statCard: {
    background: "white",
    padding: "22px",
    borderRadius: "22px",
    boxShadow:
      "0 8px 24px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },

  statLabel: {
    margin: 0,
    color: "#64748b",
    fontWeight: 700,
  },

  statValue: {
    margin: "10px 0 4px",
    color: "#0f172a",
    fontSize: "28px",
  },

  statHelper: {
    margin: 0,
    color: "#94a3b8",
    fontSize: "12px",
  },

  card: {
    background: "white",
    padding: "24px",
    borderRadius: "24px",
    boxShadow:
      "0 8px 24px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    marginBottom: "20px",
  },

  cardTitle: {
    margin: 0,
    color: "#0f172a",
  },

  muted: {
    color: "#64748b",
    lineHeight: 1.5,
  },

  list: {
    display: "grid",
    gap: "14px",
  },

  paymentRow: {
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "20px",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "24px",
  },

  paymentMain: {
    minWidth: 0,
  },

  amountRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
    alignItems: "flex-start",
  },

  smallLabel: {
    margin: "0 0 5px",
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 900,
    letterSpacing: "0.8px",
  },

  rowTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "27px",
  },

  shiftDetails: {
    display: "grid",
    gap: "5px",
    marginTop: "13px",
    color: "#475569",
    fontSize: "14px",
  },

  amountBreakdown: {
    marginTop: "18px",
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(150px,1fr))",
    gap: "12px",
    background: "#f8fafc",
    padding: "14px",
    borderRadius: "13px",
  },

  breakdownLabel: {
    display: "block",
    color: "#64748b",
    fontSize: "11px",
    marginBottom: "4px",
  },

  reference: {
    color: "#94a3b8",
    fontSize: "11px",
    wordBreak: "break-all",
    marginBottom: 0,
  },

  payoutColumn: {
    minWidth: "145px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px",
  },

  payoutDate: {
    color: "#64748b",
    fontSize: "12px",
  },

  badge: {
    padding: "8px 11px",
    borderRadius: "999px",
    fontWeight: 900,
    fontSize: "11px",
    whiteSpace: "nowrap",
  },

  badgePaid: {
    background: "#dcfce7",
    color: "#166534",
  },

  badgePending: {
    background: "#e0f2fe",
    color: "#075985",
  },

  badgeProcessing: {
    background: "#fef3c7",
    color: "#92400e",
  },

  badgeFailed: {
    background: "#fee2e2",
    color: "#991b1b",
  },

  emptyBox: {
    textAlign: "center",
    padding: "45px 20px",
  },

  emptyIcon: {
    fontSize: "40px",
  },

  primaryLink: {
    display: "inline-block",
    marginTop: "10px",
    background: "#0f766e",
    color: "white",
    padding: "12px 18px",
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 800,
  },

  errorBox: {
    marginBottom: "20px",
    background: "#fee2e2",
    color: "#991b1b",
    padding: "14px 16px",
    borderRadius: "12px",
    fontWeight: 800,
  },
};
