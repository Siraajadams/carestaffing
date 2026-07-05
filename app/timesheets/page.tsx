"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Application = {
  id: string;
  status: string;
  shifts: {
    id: string;
    title: string;
    company_id: string;
    location: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number;
  };
};

export default function TimesheetsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [hoursWorked, setHoursWorked] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadApprovedShifts();
  }, []);

  async function loadApprovedShifts() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("shift_applications")
      .select("id,status,shifts(*)")
      .eq("locum_id", user.id)
      .eq("status", "approved");

    setApplications((data as Application[]) || []);
  }

  async function submitTimesheet(app: Application) {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const hours = Number(hoursWorked[app.id] || 0);
    const rate = Number(app.shifts.hourly_rate || 0);
    const total = hours * rate;

    const { error } = await supabase.from("timesheets").insert({
      shift_id: app.shifts.id,
      locum_id: user.id,
      company_id: app.shifts.company_id,
      work_date: app.shifts.shift_date,
      rate_type: "hourly",
      agreed_rate: rate,
      hours_worked: hours,
      days_worked: 0,
      total_amount: total,
      status: "submitted",
    });

    setMessage(error ? "Timesheet submission failed." : "Timesheet submitted.");
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard" style={styles.back}>← Back to Dashboard</Link>

        <section style={styles.hero}>
          <h1 style={styles.title}>Timesheets</h1>
          <p style={styles.subtitle}>
            Submit hours worked for approved shifts.
          </p>
        </section>

        {message && <div style={styles.message}>{message}</div>}

        <section style={styles.grid}>
          {applications.length === 0 ? (
            <div style={styles.card}>No approved shifts available for timesheet submission.</div>
          ) : (
            applications.map((app) => (
              <div key={app.id} style={styles.card}>
                <h2>{app.shifts.title}</h2>
                <p><b>Date:</b> {app.shifts.shift_date}</p>
                <p><b>Time:</b> {app.shifts.start_time} - {app.shifts.end_time}</p>
                <p><b>Location:</b> {app.shifts.location}</p>
                <p><b>Agreed Rate:</b> R{app.shifts.hourly_rate}/hour</p>

                <label style={styles.label}>Hours Worked</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={hoursWorked[app.id] || ""}
                  onChange={(e) =>
                    setHoursWorked((prev) => ({
                      ...prev,
                      [app.id]: e.target.value,
                    }))
                  }
                  style={styles.input}
                  placeholder="Example: 8"
                />

                <button onClick={() => submitTimesheet(app)} style={styles.button}>
                  Submit Timesheet
                </button>
              </div>
            ))
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
    background: "linear-gradient(135deg,#0f172a,#7c3aed)",
    color: "white",
    padding: "30px",
    borderRadius: "24px",
    margin: "20px 0",
  },
  title: { fontSize: "36px", margin: 0 },
  subtitle: { color: "#ede9fe" },
  message: {
    background: "white",
    padding: "14px",
    borderRadius: "14px",
    marginBottom: "18px",
    fontWeight: 700,
  },
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
  label: {
    display: "block",
    marginTop: "16px",
    marginBottom: "6px",
    fontWeight: 700,
  },
  input: {
    width: "100%",
    padding: "13px",
    borderRadius: "14px",
    border: "1px solid #cbd5e1",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    marginTop: "16px",
    padding: "14px",
    border: "none",
    borderRadius: "14px",
    background: "#7c3aed",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
};
