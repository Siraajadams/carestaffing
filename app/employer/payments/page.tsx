"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Timesheet = {
  id: string;
  shift_id: string;
  locum_id: string;
  work_date?: string | null;
  hours_worked?: number | null;
  agreed_rate?: number | null;
  total_amount?: number | null;
  status?: string | null;
};

export default function EmployerPaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const timesheetId = searchParams.get("timesheet") || "";

  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(Boolean(timesheetId));
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (timesheetId) void loadTimesheet(timesheetId);
  }, [timesheetId]);

  async function loadTimesheet(id: string) {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error: loadError } = await supabase
      .from("timesheets")
      .select("id,shift_id,locum_id,work_date,hours_worked,agreed_rate,total_amount,status")
      .eq("id", id)
      .maybeSingle();

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    setTimesheet((data || null) as Timesheet | null);
    setLoading(false);
  }

  function invoiceAmount(row: Timesheet) {
    if (Number(row.total_amount || 0) > 0) return Number(row.total_amount || 0);
    return Number(row.hours_worked || 0) * Number(row.agreed_rate || 0);
  }

  async function payInvoice() {
    if (!timesheet) return;

    if (timesheet.status?.toLowerCase() !== "approved") {
      setError("Only an approved timesheet can be paid.");
      return;
    }

    setPaying(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timesheetId: timesheet.id,
          timesheet_id: timesheet.id,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            payload?.message ||
            "Stripe checkout could not be created."
        );
      }

      const checkoutUrl =
        payload?.url ||
        payload?.checkoutUrl ||
        payload?.checkout_url ||
        payload?.sessionUrl;

      if (!checkoutUrl) {
        throw new Error("Stripe returned no checkout URL.");
      }

      window.location.href = checkoutUrl;
    } catch (err: any) {
      setError(err?.message || "Could not start payment.");
      setPaying(false);
    }
  }

  const amount = timesheet ? invoiceAmount(timesheet) : 0;
  const fee = amount * 0.1;
  const locum = amount - fee;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/employer" style={styles.back}>
          ← Back to Employer Portal
        </Link>

        <nav style={styles.nav}>
          <Link href="/employer" style={styles.navLink}>Post Shift</Link>
          <Link href="/employer/shifts" style={styles.navLink}>My Shifts</Link>
          <Link href="/employer/applicants" style={styles.navLink}>Applicants</Link>
          <Link href="/employer/timesheets" style={styles.navLink}>Timesheets</Link>
          <Link href="/employer/invoices" style={styles.navLink}>Invoices</Link>
          <Link href="/employer/payments" style={styles.active}>Payments</Link>
          <Link href="/employer/profile" style={styles.navLink}>Organisation Profile</Link>
        </nav>

        <section style={styles.hero}>
          <p style={styles.eyebrow}>SECURE PAYMENT</p>
          <h1 style={styles.title}>Employer Payments</h1>
          <p style={styles.subtitle}>
            Approved invoices are paid through Stripe. CareStaffing retains 10%
            and Stripe transfers 90% to the locum's connected account.
          </p>
        </section>

        {error && <div style={styles.error}>{error}</div>}

        {!timesheetId ? (
          <section style={styles.card}>
            <h2 style={{ marginTop: 0 }}>Choose an approved invoice</h2>
            <p style={styles.muted}>
              Open the Invoices page to select the approved timesheet you want to pay.
            </p>
            <Link href="/employer/invoices" style={styles.invoiceButton}>
              VIEW INVOICES →
            </Link>
          </section>
        ) : loading ? (
          <section style={styles.card}>Loading approved invoice...</section>
        ) : !timesheet ? (
          <section style={styles.card}>Invoice could not be found.</section>
        ) : (
          <section style={styles.card}>
            <div style={styles.badge}>
              {(timesheet.status || "unknown").toUpperCase()}
            </div>

            <h2>Invoice Payment</h2>

            <div style={styles.moneyGrid}>
              <Money label="Employer pays" value={amount} highlight />
              <Money label="CareStaffing 10%" value={fee} />
              <Money label="Locum payout 90%" value={locum} />
            </div>

            <p style={styles.note}>
              The employer is charged <strong>R{amount.toFixed(2)}</strong> once.
              The 10% CareStaffing fee is deducted from this amount; it is not added
              on top of the invoice.
            </p>

            <button
              type="button"
              onClick={() => void payInvoice()}
              disabled={paying || timesheet.status?.toLowerCase() !== "approved"}
              style={{
                ...styles.payButton,
                opacity:
                  paying || timesheet.status?.toLowerCase() !== "approved"
                    ? 0.55
                    : 1,
              }}
            >
              {paying ? "Opening Stripe..." : `💳 PAY R${amount.toFixed(2)} WITH STRIPE`}
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

function Money({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.money,
        ...(highlight ? styles.moneyHighlight : {}),
      }}
    >
      <span style={styles.small}>{label}</span>
      <strong style={{ fontSize: "22px" }}>R{value.toFixed(2)}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f1f5f9", padding: "28px 20px 60px", fontFamily: "Arial, sans-serif" },
  container: { maxWidth: "980px", margin: "0 auto" },
  back: { color: "#0f766e", fontWeight: 900, textDecoration: "none" },
  nav: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "18px", padding: "10px", borderRadius: "16px", background: "white" },
  navLink: { padding: "10px 12px", borderRadius: "10px", color: "#475569", fontWeight: 800, textDecoration: "none" },
  active: { padding: "10px 12px", borderRadius: "10px", color: "#0f766e", background: "#ccfbf1", fontWeight: 900, textDecoration: "none" },
  hero: { background: "linear-gradient(135deg,#0f172a,#0f766e)", color: "white", padding: "34px", borderRadius: "28px", margin: "20px 0" },
  eyebrow: { margin: 0, color: "#99f6e4", fontWeight: 900, letterSpacing: "1px" },
  title: { margin: "8px 0", fontSize: "42px" },
  subtitle: { color: "#ccfbf1", lineHeight: 1.5 },
  card: { background: "white", padding: "26px", borderRadius: "20px", boxShadow: "0 8px 24px rgba(15,23,42,.06)" },
  badge: { display: "inline-block", background: "#dcfce7", color: "#166534", borderRadius: "999px", padding: "8px 12px", fontSize: "11px", fontWeight: 900 },
  moneyGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "12px", marginTop: "18px" },
  money: { display: "grid", gap: "6px", padding: "16px", borderRadius: "14px", background: "#f8fafc" },
  moneyHighlight: { background: "#dcfce7", color: "#166534" },
  small: { fontSize: "12px", color: "#64748b", fontWeight: 800 },
  note: { margin: "18px 0", padding: "14px", borderRadius: "12px", background: "#ecfeff", color: "#155e75", lineHeight: 1.5 },
  muted: { color: "#64748b" },
  invoiceButton: { display: "inline-block", marginTop: "10px", color: "#0f766e", fontWeight: 900, textDecoration: "none" },
  payButton: { width: "100%", background: "#39ff14", color: "#052e16", border: "2px solid #22c55e", boxShadow: "0 0 22px rgba(57,255,20,.40)", padding: "16px 20px", borderRadius: "12px", fontWeight: 900, cursor: "pointer", fontSize: "16px" },
  error: { background: "#fee2e2", color: "#991b1b", padding: "14px", borderRadius: "12px", marginBottom: "18px", fontWeight: 800 },
};
