"use client";

import Link from "next/link";

const stats = [
  { label: "Available Shifts", value: "24", icon: "🔍" },
  { label: "Applied", value: "3", icon: "✅" },
  { label: "Upcoming", value: "2", icon: "📅" },
  { label: "Earnings This Month", value: "R 4,850", icon: "💰" },
];

const menuItems = [
  {
    title: "Find Shifts",
    description: "Browse and apply for available healthcare shifts.",
    href: "/shifts",
    icon: "🔍",
    color: "#0f766e",
  },
  {
    title: "My Diary",
    description: "View applications, upcoming shifts and availability.",
    href: "/my-shifts",
    icon: "📅",
    color: "#2563eb",
  },
  {
    title: "Timesheets",
    description: "Submit hours and review approved timesheets.",
    href: "/timesheets",
    icon: "📝",
    color: "#7c3aed",
  },
  {
    title: "Invoices",
    description: "View generated invoices and billing history.",
    href: "/invoices",
    icon: "🧾",
    color: "#ea580c",
  },
  {
    title: "Payments",
    description: "Track payouts, earnings and payment status.",
    href: "/payments",
    icon: "🏦",
    color: "#16a34a",
  },
  {
    title: "Profile",
    description: "Update your professional and compliance profile.",
    href: "/profile",
    icon: "👤",
    color: "#475569",
  },
];

const activity = [
  "New pharmacy shift available in Cape Town",
  "Your profile was updated successfully",
  "Timesheet submission pending for last shift",
];

export default function DashboardPage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.hero}>
          <div>
            <p style={styles.badge}>CareStaffing Workforce Platform</p>
            <h1 style={styles.title}>Welcome back</h1>
            <p style={styles.subtitle}>
              Manage shifts, diary, timesheets, invoices and payments from one dashboard.
            </p>
          </div>

          <Link href="/shifts" style={styles.heroButton}>
            Find Shifts
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

        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Quick Actions</h2>
          <p style={styles.sectionText}>Select what you want to manage.</p>
        </div>

        <section style={styles.grid}>
          {menuItems.map((item) => (
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
        </section>

        <section style={styles.bottomGrid}>
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Recent Activity</h2>

            {activity.map((item) => (
              <div key={item} style={styles.activityItem}>
                <span style={styles.dot}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Next Steps</h2>
            <p style={styles.panelText}>
              Complete your profile, upload compliance documents and start applying
              for verified healthcare shifts.
            </p>

            <Link href="/profile" style={styles.secondaryButton}>
              Complete Profile
            </Link>
          </div>
        </section>

        <div style={styles.footer}>
          <Link href="/" style={styles.backHome}>
            ← Back Home
          </Link>
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
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  hero: {
    background: "linear-gradient(135deg, #0f172a, #0f766e)",
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
  badge: {
    background: "rgba(255,255,255,0.15)",
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: 700,
    marginBottom: "14px",
  },
  title: {
    fontSize: "42px",
    margin: 0,
    fontWeight: 800,
  },
  subtitle: {
    fontSize: "17px",
    color: "#dbeafe",
    maxWidth: "650px",
    lineHeight: 1.6,
  },
  heroButton: {
    background: "white",
    color: "#0f766e",
    padding: "15px 24px",
    borderRadius: "16px",
    textDecoration: "none",
    fontWeight: 800,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "18px",
    marginBottom: "30px",
  },
  statCard: {
    background: "white",
    borderRadius: "22px",
    padding: "22px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
  },
  statIcon: {
    fontSize: "30px",
  },
  statValue: {
    fontSize: "32px",
    margin: "12px 0 4px",
    color: "#0f172a",
  },
  statLabel: {
    margin: 0,
    color: "#64748b",
    fontWeight: 700,
  },
  sectionHeader: {
    marginBottom: "18px",
  },
  sectionTitle: {
    fontSize: "28px",
    color: "#0f172a",
    margin: 0,
  },
  sectionText: {
    color: "#64748b",
    marginTop: "6px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "20px",
  },
  link: {
    textDecoration: "none",
  },
  card: {
    background: "white",
    padding: "24px",
    borderRadius: "24px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
    minHeight: "190px",
    display: "flex",
    flexDirection: "column",
  },
  iconCircle: {
    width: "56px",
    height: "56px",
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    color: "white",
    marginBottom: "16px",
  },
  cardTitle: {
    color: "#0f172a",
    margin: "0 0 10px",
    fontSize: "22px",
  },
  cardText: {
    color: "#64748b",
    lineHeight: 1.5,
    margin: 0,
    flex: 1,
  },
  cardAction: {
    color: "#0f766e",
    fontWeight: 800,
    marginTop: "18px",
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    marginTop: "28px",
  },
  panel: {
    background: "white",
    borderRadius: "24px",
    padding: "24px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
  },
  panelTitle: {
    marginTop: 0,
    color: "#0f172a",
  },
  panelText: {
    color: "#64748b",
    lineHeight: 1.6,
  },
  activityItem: {
    display: "flex",
    gap: "10px",
    padding: "12px 0",
    borderBottom: "1px solid #e2e8f0",
    color: "#334155",
  },
  dot: {
    color: "#0f766e",
    fontWeight: 900,
  },
  secondaryButton: {
    display: "inline-block",
    marginTop: "12px",
    background: "#0f172a",
    color: "white",
    padding: "13px 18px",
    borderRadius: "14px",
    textDecoration: "none",
    fontWeight: 800,
  },
  footer: {
    marginTop: "34px",
    marginBottom: "20px",
  },
  backHome: {
    color: "#0f766e",
    fontWeight: 800,
    textDecoration: "none",
  },
};
