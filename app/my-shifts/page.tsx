"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function MyShiftsPage() {
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    loadMyShifts();
  }, []);

  async function loadMyShifts() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("shift_applications")
      .select("id,status,created_at,shifts(*)")
      .eq("locum_id", user.id)
      .order("created_at", { ascending: false });

    setApplications(data || []);
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard" style={styles.back}>← Back to Dashboard</Link>

        <section style={styles.hero}>
          <h1 style={styles.title}>My Diary</h1>
          <p style={styles.subtitle}>
            View your applied, approved and completed shifts.
          </p>
        </section>

        <div style={styles.grid}>
          {applications.length === 0 ? (
            <div style={styles.card}>No shift applications yet.</div>
          ) : (
            applications.map((item) => (
              <div key={item.id} style={styles.card}>
                <h2>{item.shifts?.title}</h2>
                <p><b>Status:</b> {item.status}</p>
                <p><b>Date:</b> {item.shifts?.shift_date}</p>
                <p><b>Time:</b> {item.shifts?.start_time} - {item.shifts?.end_time}</p>
                <p><b>Location:</b> {item.shifts?.location}</p>
                <p><b>Rate:</b> R{item.shifts?.hourly_rate}/hour</p>
              </div>
            ))
          )}
        </div>
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
    background: "linear-gradient(135deg,#0f172a,#2563eb)",
    color: "white",
    padding: "30px",
    borderRadius: "24px",
    margin: "20px 0",
  },
  title: { fontSize: "36px", margin: 0 },
  subtitle: { color: "#dbeafe" },
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
};
