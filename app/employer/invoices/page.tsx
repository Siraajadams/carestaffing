"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Shift = {
  id: string;
  title?: string | null;
  location?: string | null;
  city?: string | null;
  shift_date?: string | null;
  company_id?: string | null;
  created_by?: string | null;
};

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

type Profile = {
  id: string;
  first_name?: string | null;
  surname?: string | null;
};

type InvoiceRow = Timesheet & {
  shift?: Shift;
  profile?: Profile;
};

export default function EmployerInvoicesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadInvoices();
  }, []);

  async function loadInvoices() {
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

      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      let shiftQuery = supabase.from("shifts").select(
        "id,title,location,city,shift_date,company_id,created_by"
      );

      if (company?.id) {
        shiftQuery = shiftQuery.or(
          `company_id.eq.${company.id},created_by.eq.${user.id}`
        );
      } else {
        shiftQuery = shiftQuery.eq("created_by", user.id);
      }

      const { data: shifts, error: shiftError } = await shiftQuery;
      if (shiftError) throw shiftError;

      const shiftRows = (shifts || []) as Shift[];
      const shiftIds = shiftRows.map((row) => row.id);

      if (shiftIds.length === 0) {
        setRows([]);
        return;
      }

      const { data: timesheets, error: timesheetError } = await supabase
        .from("timesheets")
        .select(
          "id,shift_id,locum_id,work_date,hours_worked,agreed_rate,total_amount,status"
        )
        .in("shift_id", shiftIds)
        .eq("status", "approved")
        .order("work_date", { ascending: false });

      if (timesheetError) throw timesheetError;

      const ts = (timesheets || []) as Timesheet[];
      const locumIds = Array.from(new Set(ts.map((row) => row.locum_id)));

      let profiles: Profile[] = [];
      if (locumIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id,first_name,surname")
          .in("id", locumIds);
        profiles = (data || []) as Profile[];
      }

      const shiftMap = Object.fromEntries(shiftRows.map((row) => [row.id, row]));
      const profileMap = Object.fromEntries(profiles.map((row) => [row.id, row]));

      setRows(
        ts.map((row) => ({
          ...row,
          shift: shiftMap[row.shift_id],
          profile: profileMap[row.locum_id],
        }))
      );
    } catch (err: any) {
      setError(err?.message || "Could not load invoices.");
    } finally {
      setLoading(false);
    }
  }

  function invoiceAmount(row: Timesheet) {
    if (Number(row.total_amount || 0) > 0) {
      return Number(row.total_amount || 0);
    }
    return Number(row.hours_worked || 0) * Number(row.agreed_rate || 0);
  }

  const totalDue = useMemo(
    () => rows.reduce((sum, row) => sum + invoiceAmount(row), 0),
    [rows]
  );

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
          <Link href="/employer/invoices" style={styles.active}>Invoices</Link>
          <Link href="/employer/payments" style={styles.navLink}>Payments</Link>
          <Link href="/employer/profile" style={styles.navLink}>Organisation Profile</Link>
        </nav>

        <section style={styles.hero}>
          <p style={styles.eyebrow}>EMPLOYER PORTAL</p>
          <h1 style={styles.title}>Invoices</h1>
          <p style={styles.subtitle}>
            Approved timesheets appear here and can be sent securely to Stripe for payment.
          </p>
        </section>

        {error && <div style={styles.error}>{error}</div>}

        <section style={styles.summary}>
          <div>
            <div style={styles.small}>APPROVED INVOICES</div>
            <strong style={styles.big}>{rows.length}</strong>
          </div>
          <div>
            <div style={styles.small}>TOTAL READY TO PAY</div>
            <strong style={styles.big}>R{totalDue.toFixed(2)}</strong>
          </div>
        </section>

        {loading ? (
          <div style={styles.card}>Loading invoices...</div>
        ) : rows.length === 0 ? (
          <div style={styles.card}>
            No approved invoices are ready for payment yet.
          </div>
        ) : (
          <div style={styles.grid}>
            {rows.map((row) => {
              const amount = invoiceAmount(row);
              const fee = amount * 0.1;
              const locum = amount - fee;
              const name =
                [row.profile?.first_name, row.profile?.surname]
                  .filter(Boolean)
                  .join(" ") || "Healthcare Professional";

              return (
                <article key={row.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div>
                      <div style={styles.small}>APPROVED INVOICE</div>
                      <h2 style={{ margin: "6px 0" }}>
                        {row.shift?.title || "Healthcare Shift"}
                      </h2>
                      <div style={styles.muted}>
                        {name} • {row.shift?.location || row.shift?.city || "—"}
                      </div>
                    </div>
                    <span style={styles.badge}>READY TO PAY</span>
                  </div>

                  <div style={styles.moneyGrid}>
                    <Money label="Invoice amount" value={amount} />
                    <Money label="CareStaffing 10%" value={fee} />
                    <Money label="Locum 90%" value={locum} />
                  </div>

                  <p style={styles.muted}>
                    The employer pays <strong>R{amount.toFixed(2)}</strong>. Stripe Connect
                    splits the payment into the CareStaffing fee and locum payout.
                  </p>

                  <Link
                    href={`/employer/payments?timesheet=${encodeURIComponent(row.id)}`}
                    style={styles.pay}
                  >
                    💳 PAY INVOICE R{amount.toFixed(2)}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.money}>
      <span style={styles.small}>{label}</span>
      <strong>R{value.toFixed(2)}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f1f5f9", padding: "28px 20px 60px", fontFamily: "Arial, sans-serif" },
  container: { maxWidth: "1180px", margin: "0 auto" },
  back: { color: "#0f766e", fontWeight: 900, textDecoration: "none" },
  nav: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "18px", padding: "10px", borderRadius: "16px", background: "white" },
  navLink: { padding: "10px 12px", borderRadius: "10px", color: "#475569", fontWeight: 800, textDecoration: "none" },
  active: { padding: "10px 12px", borderRadius: "10px", color: "#0f766e", background: "#ccfbf1", fontWeight: 900, textDecoration: "none" },
  hero: { background: "linear-gradient(135deg,#0f172a,#0f766e)", color: "white", padding: "34px", borderRadius: "28px", margin: "20px 0" },
  eyebrow: { margin: 0, color: "#99f6e4", fontWeight: 900, letterSpacing: "1px" },
  title: { margin: "8px 0", fontSize: "42px" },
  subtitle: { color: "#ccfbf1", lineHeight: 1.5 },
  summary: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "14px", background: "white", padding: "20px", borderRadius: "18px", marginBottom: "18px" },
  small: { fontSize: "12px", color: "#64748b", fontWeight: 800 },
  big: { fontSize: "26px" },
  grid: { display: "grid", gap: "16px" },
  card: { background: "white", padding: "22px", borderRadius: "18px", boxShadow: "0 8px 24px rgba(15,23,42,.05)" },
  cardTop: { display: "flex", justifyContent: "space-between", gap: "15px", flexWrap: "wrap" },
  badge: { background: "#dcfce7", color: "#166534", borderRadius: "999px", padding: "8px 12px", fontSize: "11px", fontWeight: 900 },
  muted: { color: "#64748b" },
  moneyGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "12px", marginTop: "18px" },
  money: { display: "grid", gap: "6px", padding: "14px", borderRadius: "12px", background: "#f8fafc" },
  pay: { display: "inline-block", marginTop: "8px", background: "#39ff14", color: "#052e16", border: "2px solid #22c55e", boxShadow: "0 0 18px rgba(57,255,20,.35)", padding: "14px 18px", borderRadius: "11px", fontWeight: 900, textDecoration: "none" },
  error: { background: "#fee2e2", color: "#991b1b", padding: "14px", borderRadius: "12px", marginBottom: "18px", fontWeight: 800 },
};
