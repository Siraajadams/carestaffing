"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Shift = {
  id: string;
  title: string;
  profession_required: string;
  country: string;
  city: string;
  location: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  hourly_rate: number;
  status: string;
};

export default function FindShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadShifts();
  }, []);

  async function loadShifts() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("profession,country,city")
      .eq("id", user.id)
      .single();

    let query = supabase.from("shifts").select("*").eq("status", "open");

    if (profile?.profession) {
      query = query.eq("profession_required", profile.profession);
    }

    if (profile?.country) {
      query = query.eq("country", profile.country);
    }

    const { data } = await query.order("shift_date", { ascending: true });

    setShifts(data || []);
  }

  async function applyForShift(shiftId: string) {
    setMessage("");

    const { error } = await supabase.from("shift_applications").insert({
      shift_id: shiftId,
      locum_id: userId,
      status: "applied",
    });

    if (error) {
      setMessage("You may have already applied for this shift.");
    } else {
      setMessage("Application submitted successfully.");
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard" style={styles.back}>← Back to Dashboard</Link>

        <section style={styles.hero}>
          <h1 style={styles.title}>Find Shifts</h1>
          <p style={styles.subtitle}>
            Shifts are matched to your profession, country and profile.
          </p>
        </section>

        {message && <div style={styles.message}>{message}</div>}

        <div style={styles.grid}>
          {shifts.length === 0 ? (
            <div style={styles.empty}>No matching open shifts found.</div>
          ) : (
            shifts.map((shift) => (
              <div key={shift.id} style={styles.card}>
                <h2>{shift.title}</h2>
                <p><b>Profession:</b> {shift.profession_required}</p>
                <p><b>Location:</b> {shift.location || shift.city}</p>
                <p><b>Date:</b> {shift.shift_date}</p>
                <p><b>Time:</b> {shift.start_time} - {shift.end_time}</p>
                <p><b>Rate:</b> R{shift.hourly_rate}/hour</p>

                <button
                  onClick={() => applyForShift(shift.id)}
                  style={styles.button}
                >
                  Apply for Shift
                </button>
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
    background: "linear-gradient(135deg,#0f172a,#0f766e)",
    color: "white",
    padding: "30px",
    borderRadius: "24px",
    margin: "20px 0",
  },
  title: { fontSize: "36px", margin: 0 },
  subtitle: { color: "#dbeafe" },
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
  button: {
    width: "100%",
    padding: "14px",
    border: "none",
    borderRadius: "14px",
    background: "#0f766e",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  empty: {
    background: "white",
    padding: "24px",
    borderRadius: "20px",
  },
};
