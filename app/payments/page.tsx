"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Payment = {
  id: string;
  gross_amount: number;
  platform_fee: number;
  locum_amount: number;
  payment_status: string;
  payout_status: string;
  paystack_reference: string | null;
  paid_at: string | null;
  payout_at: string | null;
  created_at: string;
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("locum_id", user.id)
      .order("created_at", { ascending: false });

    setPayments((data as Payment[]) || []);
    setLoading(false);
  }

  const grossTotal = payments.reduce(
    (sum, p) => sum + Number(p.gross_amount || 0),
    0
  );

  const platformFeeTotal = payments.reduce(
    (sum, p) => sum + Number(p.platform_fee || 0),
    0
  );

  const payoutTotal = payments.reduce(
    (sum, p) => sum + Number(p.locum_amount || 0),
    0
  );

  const pendingPayout = payments
    .filter((p) => p.payout_status !== "paid_out")
    .reduce((sum, p) => sum + Number(p.locum_amount || 0), 0);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard" style={styles.back}>
          ← Back to Dashboard
        </Link>

        <section style={styles.hero}>
          <h1 style={styles.title}>Payments</h1>
          <p style={styles.subtitle}>
            Track earnings, platform fees, CarePay status and Paystack payouts.
          </p>
        </section>

        {loading ? (
          <div style={styles.card}>Loading payments...</div>
        ) : (
          <>
            <section style={styles.statsGrid}>
              <StatCard label="Gross Earned" value={`R${grossTotal.toFixed(2)}`} />
              <StatCard label="Platform Fees" value={`R${platformFeeTotal.toFixed(2)}`} />
              <StatCard label="Net Payout" value={`R${payoutTotal.toFixed(2)}`} />
              <StatCard label="Pending Payout" value={`R${pendingPayout.toFixed(2)}`} />
            </section>

            <section style={styles.card}>
              <h2 style={styles.cardTitle}>Payment History</h2>

              {payments.length === 0 ? (
                <p style={styles.empty}>
                  No payment records yet. Payments will appear after an approved
                  timesheet is invoiced and paid.
                </p>
              ) : (
                <div style={styles.list}>
                  {payments.map((payment) => (
                    <div key={payment.id} style={styles.paymentRow}>
                      <div>
                        <h3 style={styles.rowTitle}>
                          R{Number(payment.locum_amount || 0).toFixed(2)} payout
                        </h3>
                        <p style={styles.rowText}>
                          Gross: R{Number(payment.gross_amount || 0).toFixed(2)} | 
                          Fee: R{Number(payment.platform_fee || 0).toFixed(2)}
                        </p>
                        <p style={styles.rowText}>
                          Paystack Ref: {payment.paystack_reference || "Not linked yet"}
                        </p>
                      </div>

                      <div style={styles.statusBox}>
                        <StatusBadge label="Payment" value={payment.payment_status} />
                        <StatusBadge label="Payout" value={payment.payout_status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <h2 style={styles.statValue}>{value}</h2>
    </div>
  );
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  const clean = value || "pending";

  const bg =
    clean === "paid" || clean === "paid_out"
      ? "#dcfce7"
      : clean === "processing"
      ? "#fef9c3"
      : clean === "failed"
      ? "#fee2e2"
      : "#e0f2fe";

  const color =
    clean === "paid" || clean === "paid_out"
      ? "#166534"
      : clean === "processing"
      ? "#854d0e"
      : clean === "failed"
      ? "#991b1b"
      : "#075985";

  return (
    <div style={{ ...styles.badge, background: bg, color }}>
      <span style={styles.badgeLabel}>{label}</span>
      <strong>{clean.replace("_", " ")}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    background: "linear-gradient(135deg,#0f172a,#16a34a)",
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
    color: "#dcfce7",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: "18px",
    marginBottom: "22px",
  },
  statCard: {
    background: "white",
    padding: "22px",
    borderRadius: "22px",
    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  statLabel: {
    margin: 0,
    color: "#64748b",
    fontWeight: 700,
  },
  statValue: {
    margin: "10px 0 0",
    color: "#0f172a",
    fontSize: "28px",
  },
  card: {
    background: "white",
    padding: "24px",
    borderRadius: "24px",
    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
    border: "1px solid #e2e8f0",
  },
  cardTitle: {
    marginTop: 0,
    color: "#0f172a",
  },
  empty: {
    color: "#64748b",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  paymentRow: {
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    padding: "18px",
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  rowTitle: {
    margin: "0 0 6px",
    color: "#0f172a",
  },
  rowText: {
    margin: "4px 0",
    color: "#64748b",
  },
  statusBox: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  badge: {
    borderRadius: "14px",
    padding: "10px 12px",
    minWidth: "120px",
    textTransform: "capitalize",
  },
  badgeLabel: {
    display: "block",
    fontSize: "12px",
    opacity: 0.8,
    marginBottom: "3px",
  },
};
