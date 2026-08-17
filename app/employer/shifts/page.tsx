"use client";

import dynamic from "next/dynamic";

const EmployerShiftsClient = dynamic(
  () => import("./EmployerShiftsClient"),
  {
    ssr: false,
    loading: () => (
      <main
        style={{
          minHeight: "100vh",
          background: "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "#ffffff",
            borderRadius: "22px",
            padding: "28px",
            textAlign: "center",
            boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 900,
              letterSpacing: "1px",
              color: "#0f766e",
              marginBottom: "10px",
            }}
          >
            CARESTAFFING
          </div>

          <h2
            style={{
              margin: "0 0 8px",
              color: "#0f172a",
            }}
          >
            Loading My Shifts
          </h2>

          <p
            style={{
              margin: 0,
              color: "#64748b",
            }}
          >
            Loading shifts, timesheets and payment information...
          </p>
        </div>
      </main>
    ),
  }
);

export default function EmployerShiftsPage() {
  return <EmployerShiftsClient />;
}
