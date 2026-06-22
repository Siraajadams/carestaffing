"use client";

import Link from "next/link";

const menuItems = [
  {
    title: "Find Shifts",
    description: "Browse and apply for available shifts.",
    href: "/shifts",
    icon: "🔍",
  },
  {
    title: "My Shifts",
    description: "View upcoming and completed shifts.",
    href: "/my-shifts",
    icon: "📅",
  },
  {
    title: "Timesheets",
    description: "Submit and review timesheets.",
    href: "/timesheets",
    icon: "📝",
  },
  {
    title: "Invoices",
    description: "View and manage invoices.",
    href: "/invoices",
    icon: "💰",
  },
  {
    title: "Payments",
    description: "Track payments and earnings.",
    href: "/payments",
    icon: "🏦",
  },
  {
    title: "Profile",
    description: "Update your professional profile.",
    href: "/profile",
    icon: "👤",
  },
];

export default function DashboardPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "32px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: "40px",
            fontWeight: "bold",
            color: "#0f172a",
            marginBottom: "10px",
          }}
        >
          CareStaffing Dashboard
        </h1>

        <p
          style={{
            color: "#475569",
            fontSize: "18px",
            marginBottom: "30px",
          }}
        >
          Manage shifts, workers, timesheets, invoices and payments.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
          }}
        >
          {menuItems.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              style={{
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  background: "white",
                  padding: "24px",
                  borderRadius: "20px",
                  boxShadow: "0 10px 25px rgba(15,23,42,0.08)",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  height: "100%",
                }}
              >
                <div
                  style={{
                    fontSize: "42px",
                    marginBottom: "12px",
                  }}
                >
                  {item.icon}
                </div>

                <h3
                  style={{
                    color: "#0f172a",
                    marginBottom: "10px",
                    fontSize: "22px",
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    color: "#64748b",
                    lineHeight: 1.5,
                  }}
                >
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <div
          style={{
            marginTop: "40px",
          }}
        >
          <Link
            href="/"
            style={{
              color: "#0f766e",
              fontWeight: "bold",
              textDecoration: "none",
            }}
          >
            ← Back Home
          </Link>
        </div>
      </div>
    </main>
  );
}
