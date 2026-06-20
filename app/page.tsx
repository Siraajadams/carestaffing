import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f766e, #083344)",
      color: "white",
      fontFamily: "Arial, sans-serif",
      padding: "40px"
    }}>
      <section style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <nav style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "70px"
        }}>
          <h2 style={{ fontSize: "26px", fontWeight: 800 }}>CareStaffing</h2>

          <div style={{ display: "flex", gap: "14px" }}>
            <Link href="/login" style={styles.navButton}>Login</Link>
            <Link href="/register" style={styles.navButtonPrimary}>Get Started</Link>
          </div>
        </nav>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "40px",
          alignItems: "center"
        }}>
          <div>
            <p style={{
              color: "#99f6e4",
              fontWeight: 800,
              textTransform: "uppercase"
            }}>
              Healthcare workforce platform
            </p>

            <h1 style={{
              fontSize: "58px",
              lineHeight: "64px",
              margin: "16px 0",
              fontWeight: 900
            }}>
              Mobilising healthcare workers and organisations.
            </h1>

            <p style={{
              fontSize: "20px",
              lineHeight: "32px",
              color: "#ccfbf1",
              maxWidth: "620px"
            }}>
              CareStaffing helps healthcare workers find flexible shifts and helps
              pharmacies, clinics and care providers manage staffing, timesheets
              and invoices in one place.
            </p>

            <div style={{ display: "flex", gap: "14px", marginTop: "32px", flexWrap: "wrap" }}>
              <Link href="/register" style={styles.ctaPrimary}>
                Register Now
              </Link>

              <Link href="/login" style={styles.ctaSecondary}>
                Login
              </Link>
            </div>
          </div>

          <div style={styles.panel}>
            <h3 style={{ fontSize: "24px", marginBottom: "20px" }}>What CareStaffing does</h3>

            <ul style={{ display: "grid", gap: "16px", paddingLeft: "20px", color: "#134e4a" }}>
              <li>Healthcare worker registration</li>
              <li>Organisation registration</li>
              <li>Find and book shifts</li>
              <li>Manage availability</li>
              <li>Approve timesheets</li>
              <li>Generate invoices</li>
              <li>Track payments</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  navButton: {
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 700,
    padding: "10px 16px",
  },
  navButtonPrimary: {
    background: "#ffffff",
    color: "#0f766e",
    textDecoration: "none",
    fontWeight: 800,
    padding: "10px 18px",
    borderRadius: "999px",
  },
  ctaPrimary: {
    background: "#ffffff",
    color: "#0f766e",
    textDecoration: "none",
    fontWeight: 900,
    padding: "16px 24px",
    borderRadius: "14px",
  },
  ctaSecondary: {
    border: "1px solid #99f6e4",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 800,
    padding: "16px 24px",
    borderRadius: "14px",
  },
  panel: {
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: "28px",
    padding: "30px",
    boxShadow: "0 30px 70px rgba(0,0,0,0.25)",
  },
};
