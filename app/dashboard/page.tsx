import Link from "next/link";

export default function DashboardPage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#f8fafc",
      padding: "32px",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "36px", color: "#0f172a" }}>
          CareStaffing Dashboard
        </h1>

        <p style={{ color: "#475569", fontSize: "18px" }}>
          Manage shifts, workers, timesheets, invoices and payments.
        </p>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
          marginTop: "28px"
        }}>
          {["Find Shifts", "My Shifts", "Timesheets", "Invoices", "Payments", "Profile"].map((item) => (
            <div key={item} style={{
              background: "white",
              padding: "24px",
              borderRadius: "18px",
              boxShadow: "0 12px 30px rgba(15,23,42,0.08)"
            }}>
              <h3>{item}</h3>
              <p style={{ color: "#64748b" }}>Coming soon</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "30px" }}>
          <Link href="/" style={{ color: "#0f766e", fontWeight: 700 }}>
            ← Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
