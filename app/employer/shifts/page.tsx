"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Shift = {
  id: string;
  title: string | null;
  profession_required: string | null;
  business_name: string | null;
  city: string | null;
  start_date: string | null;
  start_time: string | null;
  end_time: string | null;
  employer_rate: number | null;
  locum_rate: number | null;
  platform_fee: number | null;
  currency: string | null;
  status: string | null;
};

export default function EmployerShiftsPage() {
  const router = useRouter();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadShifts();
  }, []);

  async function loadShifts() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("shifts")
        .select(
          `
          id,
          title,
          profession_required,
          business_name,
          city,
          start_date,
          start_time,
          end_time,
          employer_rate,
          locum_rate,
          platform_fee,
          currency,
          status
        `
        )
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setShifts(data || []);
    } catch (err: any) {
      console.error("Load shifts error:", err);
      setError(err?.message || "Could not load shifts.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function currencySymbol(currency?: string | null) {
    if (currency === "GBP") return "£";
    if (currency === "EUR") return "€";
    if (currency === "NZD") return "NZ$";
    return "R";
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.nav}>
          <Link href="/employer" style={styles.brand}>
            CARESTAFFING
          </Link>

          <div style={styles.links}>
            <Link href="/employer" style={styles.link}>
              Post Shift
            </Link>

            <Link href="/employer/applicants" style={styles.link}>
              Applicants
            </Link>

            <Link href="/employer/profile" style={styles.link}>
              Organisation Profile
            </Link>

            <button onClick={logout} style={styles.logout}>
              Logout
            </button>
          </div>
        </div>

        <section style={styles.hero}>
          <p style={styles.label}>EMPLOYER PORTAL</p>

          <h1 style={styles.title}>My Shifts</h1>

          <p style={styles.subtitle}>
            View and manage shifts posted by your organisation.
          </p>
        </section>

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <div style={styles.card}>Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div style={styles.card}>
            <h2>No shifts posted yet</h2>

            <p style={styles.muted}>
              Post your first healthcare shift.
            </p>

            <Link href="/employer" style={styles.button}>
              + Post New Shift
            </Link>
          </div>
        ) : (
          <div style={styles.grid}>
            {shifts.map((shift) => {
              const symbol = currencySymbol(shift.currency);

              return (
                <div key={shift.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div>
                      <h2 style={{ margin: 0 }}>
                        {shift.title || "Healthcare Shift"}
                      </h2>

                      <p style={styles.muted}>
                        {shift.business_name || "Organisation"}
                      </p>
                    </div>

                    <span style={styles.status}>
                      {(shift.status || "open").toUpperCase()}
                    </span>
                  </div>

                  <div style={styles.details}>
                    <Info
                      label="Profession"
                      value={shift.profession_required || "—"}
                    />

                    <Info label="City" value={shift.city || "—"} />

                    <Info
                      label="Date"
                      value={shift.start_date || "—"}
                    />

                    <Info
                      label="Time"
                      value={
                        shift.start_time && shift.end_time
                          ? `${shift.start_time.slice(
                              0,
                              5
                            )} - ${shift.end_time.slice(0, 5)}`
                          : "—"
                      }
                    />
                  </div>

                  <div style={styles.rates}>
                    <div>
                      <small>Organisation Rate</small>

                      <strong>
                        {symbol}
                        {Number(shift.employer_rate || 0).toFixed(2)}
                      </strong>
                    </div>

                    <div>
                      <small>Locum Rate</small>

                      <strong>
                        {symbol}
                        {Number(shift.locum_rate || 0).toFixed(2)}
                      </strong>
                    </div>

                    <div>
                      <small>CareStaffing Fee</small>

                      <strong>
                        {symbol}
                        {Number(shift.platform_fee || 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  <Link
                    href={`/employer/applicants?shift=${shift.id}`}
                    style={styles.button}
                  >
                    View Applicants
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.info}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },

  container: {
    maxWidth: 1100,
    margin: "0 auto",
  },

  nav: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 20,
  },

  brand: {
    color: "#0f766e",
    fontWeight: 900,
    textDecoration: "none",
    letterSpacing: 1,
  },

  links: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    flexWrap: "wrap",
  },

  link: {
    color: "#334155",
    textDecoration: "none",
    fontWeight: 700,
  },

  logout: {
    background: "white",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    padding: "9px 14px",
    cursor: "pointer",
    fontWeight: 700,
  },

  hero: {
    background: "linear-gradient(135deg,#0f172a,#0f766e)",
    color: "white",
    borderRadius: 24,
    padding: 30,
    marginBottom: 20,
  },

  label: {
    color: "#99f6e4",
    fontWeight: 900,
    fontSize: 13,
  },

  title: {
    fontSize: 38,
    margin: "8px 0",
  },

  subtitle: {
    color: "#cbd5e1",
  },

  grid: {
    display: "grid",
    gap: 18,
  },

  card: {
    background: "white",
    borderRadius: 20,
    padding: 24,
    border: "1px solid #e2e8f0",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 15,
    flexWrap: "wrap",
  },

  muted: {
    color: "#64748b",
  },

  status: {
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 999,
    padding: "7px 11px",
    fontWeight: 900,
    fontSize: 12,
    height: "fit-content",
  },

  details: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 12,
    marginTop: 20,
  },

  info: {
    background: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 5,
  },

  rates: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
    gap: 12,
    marginTop: 16,
    marginBottom: 18,
  },

  button: {
    display: "inline-block",
    background: "#0f766e",
    color: "white",
    padding: "11px 16px",
    borderRadius: 11,
    textDecoration: "none",
    fontWeight: 800,
  },

  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
  },
};
