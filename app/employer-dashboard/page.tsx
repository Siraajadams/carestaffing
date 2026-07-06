"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const stats = [
  { label: "Open Shifts", value: "0", icon: "📋" },
  { label: "Applicants", value: "0", icon: "👥" },
  { label: "Timesheets Pending", value: "0", icon: "📝" },
  { label: "Invoices Due", value: "R0", icon: "💰" },
];

const actions = [
  { title: "Post Shift", description: "Create a new healthcare shift.", href: "/employer", icon: "➕", color: "#0f766e" },
  { title: "Manage Shifts", description: "View, edit and close shifts.", href: "/employer", icon: "📋", color: "#2563eb" },
  { title: "Applicants", description: "Review and approve locums.", href: "/employer-applicants", icon: "👥", color: "#7c3aed" },
  { title: "Approve Timesheets", description: "Review hours worked.", href: "/employer-timesheets", icon: "📝", color: "#ea580c" },
  { title: "Invoices", description: "View invoices and payment status.", href: "/employer-invoices", icon: "🧾", color: "#16a34a" },
  { title: "Company Profile", description: "Update business details.", href: "/employer", icon: "🏢", color: "#475569" },
];

export default function EmployerDashboardPage() {
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    checkEmployerRole();
  }, []);

  async function checkEmployerRole() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, account_type")
      .eq("id", user.id)
      .single();

    if (
      profile?.role !== "employer" &&
      profile?.account_type !== "organisation"
    ) {
      router.push("/dashboard");
      return;
    }

    setCheckingRole(false);
  }

  if (checkingRole) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>Checking employer account...</div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.hero}>
          <div>
            <p style={styles.badge}>Employer Portal</p>
            <h1 style={styles.title}>Business Owner Dashboard</h1>
            <p style={styles.subtitle}>
              Post shifts, manage applicants, approve timesheets and track invoices.
            </p>
          </div>

          <Link href="/employer" style={styles.heroButton}>
            Post Shift
          </Link>
        </section>

        <section style={styles.statsGrid}>
          {stats.map((item) => (
            <div key={item.label} style={styles.statCard}>
              <div style={styles.statIcon}>{item.icon}</div>
              <h2 style={styles.statValue}>{item.value}</h2>
              <p style={styles.statLabel}>{item.label}</p>
            </div>
          ))}
        </section>

        <section>
          <h2 style={styles.sectionTitle}>Employer Actions</h2>
          <p style={styles.sectionText}>
            Manage the full shift workflow from vacancy to payment.
          </p>

          <div style={styles.grid}>
            {actions.map((item) => (
              <Link key={item.title} href={item.href} style={styles.link}>
                <div style={styles.card}>
                  <div style={{ ...styles.iconCircle, background: item.color }}>
                    {item.icon}
                  </div>
                  <h3 style={styles.cardTitle}>{item.title}</h3>
                  <p style={styles.cardText}>{item.description}</p>
                  <span style={styles.cardAction}>Open →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>Workflow</h2>
          <div style={styles.workflow}>
            <div style={styles.workflowItem}>1. Post shift</div>
            <div style={styles.workflowItem}>2. Locum applies</div>
            <div style={styles.workflowItem}>3. Approve applicant</div>
            <div style={styles.workflowItem}>4. Approve timesheet</div>
            <div style={styles.workflowItem}>5. Pay invoice</div>
          </div>
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f1f5f9", padding: "24px", fontFamily: "Arial, sans-serif" },
  container: { maxWidth: "1200px", margin: "0 auto" },
  hero: {
    background: "linear-gradient(135deg,#0f172a,#0f766e)",
    color: "white",
    borderRadius: "28px",
    padding: "32px",
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "center",
    boxShadow: "0 18px 40px rgba(15,23,42,0.25)",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  badge: { background: "rgba(255,255,255,0.15)", display: "inline-block", padding: "8px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 700, marginBottom: "14px" },
  title: { fontSize: "42px", margin: 0, fontWeight: 800 },
  subtitle: { fontSize: "17px", color: "#d1fae5", maxWidth: "650px", lineHeight: 1.6 },
  heroButton: { background: "white", color: "#0f766e", padding: "15px 24px", borderRadius: "16px", textDecoration: "none", fontWeight: 800 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "18px", marginBottom: "30px" },
  statCard: { background: "white", borderRadius: "22px", padding: "22px", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)" },
  statIcon: { fontSize: "30px" },
  statValue: { fontSize: "32px", margin: "12px 0 4px", color: "#0f172a" },
  statLabel: { margin: 0, color: "#64748b", fontWeight: 700 },
  sectionTitle: { fontSize: "28px", color: "#0f172a", margin: 0 },
  sectionText: { color: "#64748b", marginTop: "6px", marginBottom: "18px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "20px" },
  link: { textDecoration: "none" },
  card: { background: "white", padding: "24px", borderRadius: "24px", border: "1px solid #e2e8f0", boxShadow: "0 10px 25px rgba(15,23,42,0.08)", minHeight: "190px", display: "flex", flexDirection: "column" },
  iconCircle: { width: "56px", height: "56px", borderRadius: "18px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", color: "white", marginBottom: "16px" },
  cardTitle: { color: "#0f172a", margin: "0 0 10px", fontSize: "22px" },
  cardText: { color: "#64748b", lineHeight: 1.5, margin: 0, flex: 1 },
  cardAction: { color: "#0f766e", fontWeight: 800, marginTop: "18px" },
  panel: { background: "white", borderRadius: "24px", padding: "24px", border: "1px solid #e2e8f0", boxShadow: "0 10px 25px rgba(15,23,42,0.08)", marginTop: "28px" },
  panelTitle: { marginTop: 0, color: "#0f172a" },
  workflow: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "12px" },
  workflowItem: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "14px", fontWeight: 700, color: "#334155" },
};
