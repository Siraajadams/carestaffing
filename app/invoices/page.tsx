"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Timesheet = {
  id: string;
  work_date: string;
  agreed_rate: number;
  hours_worked: number;
  days_worked: number;
  total_amount: number;
  status: string;
  shifts: {
    title: string;
    location: string;
  };
};

export default function InvoicesPage() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("timesheets")
      .select("*,shifts(title,location)")
      .eq("locum_id", user.id)
      .order("created_at", { ascending: false });

    setTimesheets((data as Timesheet[]) || []);
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard" style={styles.back}>← Back to Dashboard</Link>

        <section style={styles.hero}>
          <h1 style={styles.title}>Invoices</h1>
          <p style={styles.subtitle}>
            Invoice totals are calculated from approved rates and hours worked.
          </p>
        </section>

        <section style={styles.grid}>
          {timesheets.length === 0 ? (
            <div style={styles.card}>No invoices or timesheets found.</div>
          ) : (
            timesheets.map((item) => {
              const platformFee = Number(item.total_amount || 0) * 0.1;
              const locumAmount = Number(item.total_amount || 0) - platformFee;

              return (
                <div key={item.id} style={styles.card}>
                  <h2>{item.shifts?.title || "Shift Invoice"}</h2>

                  <p><b>Date:</b> {item.work_date}</p>
                  <p><b>Location:</b> {item.shifts?.location}</p>
                  <p><b>Rate:</b> R{item.agreed_rate}</p>
                  <p><b>Hours:</b> {item.hours_worked}</p>

                  <hr style={styles.hr} />

                  <p><b>Gross Total:</b> R{Number(item.total_amount || 0).toFixed(2)}</p>
                  <p><b>Platform Fee 10%:</b> R{platformFee.toFixed(2)}</p>
                  <p><b>Locum Payout:</b> R{locumAmount.toFixed(2)}</p>
                  <p><b>Status:</b> {item.status}</p>
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "24px",
    fontFamily: "Arial, sans-serif",
  },
  container: { maxWidth: "1100px", margin: "0 auto" },
  back: { color: "#0f766e", fontWeight: 800, textDecoration: "none" },
  hero: {
    background: "linear-gradient(135deg,#0f172a,#ea580c)",
    color: "white",
    padding: "30px",
    borderRadius: "24px",
    margin: "20px 0",
  },
  title: { fontSize: "36px", margin: 0 },
  subtitle: { color: "#ffedd5" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
    gap: "18px",
  },
  card: {
    background: "white",
    padding: "22px",
    borderRadius: "22px",
    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #e2e8f0",
    margin: "16px 0",
  },
};
