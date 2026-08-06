"use client";

import Link from "next/link";

const menuItems = [
  {
    title: "Find Shifts",
    description: "Browse and apply for available healthcare shifts.",
    href: "/shifts",
    icon: "🔍",
  },
  {
    title: "My Shifts",
    description: "View your upcoming and completed shifts.",
    href: "/my-shifts",
    icon: "📅",
  },
  {
    title: "Timesheets",
    description: "Submit and review your worked hours.",
    href: "/timesheets",
    icon: "📝",
  },
  {
    title: "Invoices",
    description: "Create and manage your invoices.",
    href: "/invoices",
    icon: "🧾",
  },
  {
    title: "Payments",
    description: "Track shift payments and earnings.",
    href: "/payments",
    icon: "💳",
  },
  {
    title: "Professional Profile",
    description: "Update your personal, compliance and banking details.",
    href: "/profile",
    icon: "👤",
  },
];

export default function DashboardPage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.header}>
          <div>
            <p style={styles.label}>CareStaffing</p>

            <h1 style={styles.title}>Healthcare Worker Dashboard</h1>

            <p style={styles.subtitle}>
              Manage your shifts, timesheets, invoices, payments and
              professional profile.
            </p>
          </div>
        </section>

        <div style={styles.grid}>
          {menuItems.map((item) => (
            <Link key={item.title} href={item.href} style={styles.cardLink}>
              <article style={styles.card}>
                <div style={styles.icon}>{item.icon}</div>

                <h2 style={styles.cardTitle}>{item.title}</h2>

                <p style={styles.cardDescription}>{item.description}</p>

                <span style={styles.openLink}>Open →</span>
              </article>
            </Link>
          ))}
        </div>

        <div style={styles.footer}>
          <Link href="/" style={styles.backLink}>
            ← Back to CareStaffing
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
    padding: "30px 20px 60px",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: "1180px",
    margin: "0 auto",
  },
  header: {
    padding: "34px",
    borderRadius: "28px",
    background: "linear-gradient(135deg, #0f172a, #155e75)",
    color: "#ffffff",
    boxShadow: "0 20px 45px rgba(15, 23, 42, 0.16)",
  },
  label: {
    margin: "0 0 10px",
    color: "#99f6e4",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  title: {
    margin: 0,
    fontSize: "42px",
    lineHeight: 1.15,
  },
  subtitle: {
    margin: "14px 0 0",
    maxWidth: "720px",
    color: "#dbeafe",
    fontSize: "18px",
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "20px",
    marginTop: "26px",
  },
  cardLink: {
    textDecoration: "none",
  },
  card: {
    height: "100%",
    minHeight: "205px",
    padding: "25px",
    borderRadius: "22px",
    background: "#ffffff",
    boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
    border: "1px solid #e2e8f0",
    boxSizing: "border-box",
  },
  icon: {
    fontSize: "40px",
    marginBottom: "14px",
  },
  cardTitle: {
    margin: "0 0 10px",
    color: "#0f172a",
    fontSize: "22px",
  },
  cardDescription: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.55,
  },
  openLink: {
    display: "inline-block",
    marginTop: "20px",
    color: "#0f766e",
    fontWeight: 900,
  },
  footer: {
    marginTop: "34px",
  },
  backLink: {
    color: "#0f766e",
    fontWeight: 800,
    textDecoration: "none",
  },
};
