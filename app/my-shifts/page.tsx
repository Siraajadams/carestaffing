import Link from "next/link";

const myShifts = [
  {
    id: 1,
    title: "Pharmacist Locum Shift",
    status: "Applied",
    date: "12 July 2026",
    time: "09:00 - 17:00",
    location: "Cape Town",
  },
];

export default function MyShiftsPage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link href="/dashboard" style={styles.back}>← Back to Dashboard</Link>

        <h1 style={styles.title}>My Diary</h1>
        <p style={styles.subtitle}>View your applied, upcoming and completed shifts.</p>

        <section style={styles.stats}>
          <div style={styles.statCard}>
            <h2>1</h2>
            <p>Applied</p>
          </div>
          <div style={styles.statCard}>
            <h2>0</h2>
            <p>Confirmed Shifts</p>
          </div>
          <div style={styles.statCard}>
            <h2>31</h2>
            <p>Days Available</p>
          </div>
        </section>

        <section style={styles.card}>
          <h2>Upcoming Shifts</h2>

          {myShifts.length === 0 ? (
            <p>No shifts found.</p>
          ) : (
            myShifts.map((shift) => (
              <div key={shift.id} style={styles.shift}>
                <h3>{shift.title}</h3>
                <p><strong>Status:</strong> {shift.status}</p>
                <p><strong>Date:</strong> {shift.date}</p>
                <p><strong>Time:</strong> {shift.time}</p>
                <p><strong>Location:</strong> {shift.location}</p>
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
  container: {
    maxWidth: "1100px",
    margin: "0 auto",
  },
  back: {
    color: "#334155",
    textDecoration: "none",
    fontWeight: 700,
  },
  title: {
    fontSize: "36px",
    marginTop: "24px",
    marginBottom: "8px",
    color: "#0f172a",
  },
  subtitle: {
    color: "#64748b",
    fontSize: "18px",
    marginBottom: "24px",
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "18px",
    marginBottom: "24px",
  },
  statCard: {
    background: "white",
    borderRadius: "22px",
    padding: "24px",
    textAlign: "center",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
  },
  card: {
    background: "white",
    borderRadius: "22px",
    padding: "24px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
  },
  shift: {
    borderTop: "1px solid #e2e8f0",
    paddingTop: "16px",
    marginTop: "16px",
  },
};
