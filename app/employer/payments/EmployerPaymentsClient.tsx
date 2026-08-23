"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Timesheet = {
  id: string;
  shift_id: string;
  locum_id: string;
  work_date?: string | null;
  hours_worked?: number | null;
  agreed_rate?: number | null;
  total_amount?: number | null;
  status?: string | null;
};

export default function EmployerPaymentsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const timesheetId =
    searchParams.get("timesheet") ||
    searchParams.get("timesheet_id") ||
    "";

  const [timesheet, setTimesheet] =
    useState<Timesheet | null>(null);

  const [loading, setLoading] =
    useState(Boolean(timesheetId));

  const [paying, setPaying] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    if (timesheetId) {
      void loadTimesheet(timesheetId);
    } else {
      setLoading(false);
    }
  }, [timesheetId]);

  async function loadTimesheet(id: string) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error: loadError } =
        await supabase
          .from("timesheets")
          .select(
            `
            id,
            shift_id,
            locum_id,
            work_date,
            hours_worked,
            agreed_rate,
            total_amount,
            status
          `
          )
          .eq("id", id)
          .maybeSingle();

      if (loadError) {
        throw loadError;
      }

      if (!data) {
        setTimesheet(null);
        setError("Invoice could not be found.");
        return;
      }

      setTimesheet(data as Timesheet);
    } catch (err: any) {
      console.error(
        "Load employer payment error:",
        err
      );

      setError(
        err?.message ||
          "Could not load the approved invoice."
      );
    } finally {
      setLoading(false);
    }
  }

  function invoiceAmount(row: Timesheet) {
    const storedAmount =
      Number(row.total_amount || 0);

    if (storedAmount > 0) {
      return storedAmount;
    }

    const hours =
      Number(row.hours_worked || 0);

    const rate =
      Number(row.agreed_rate || 0);

    return hours * rate;
  }

  async function payInvoice() {
    if (!timesheet) {
      setError("No invoice selected.");
      return;
    }

    if (
      timesheet.status?.toLowerCase() !==
      "approved"
    ) {
      setError(
        "Only an approved timesheet can be paid."
      );
      return;
    }

    setPaying(true);
    setError("");
    setMessage("");

    try {
      /*
       * Get the current Supabase session.
       * We need the access token because the Stripe
       * server route authenticates the employer.
       */
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(
          "Supabase session error:",
          sessionError
        );

        throw new Error(
          "Could not verify your login session. Please log in again."
        );
      }

      if (!session?.access_token) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      console.log(
        "Creating Stripe checkout:",
        timesheet.id
      );

      const response = await fetch(
        "/api/stripe/create-checkout",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            timesheetId:
              timesheet.id,
          }),
        }
      );

      const payload =
        await response
          .json()
          .catch(() => ({}));

      console.log(
        "Stripe checkout response:",
        response.status,
        payload
      );

      if (!response.ok) {
        /*
         * Authentication problem
         */
        if (response.status === 401) {
          await supabase.auth.signOut();

          router.replace("/login");

          return;
        }

        /*
         * Employer does not own this shift
         */
        if (response.status === 403) {
          throw new Error(
            payload?.error ||
              "You are not authorised to pay this invoice."
          );
        }

        /*
         * Locum has not connected Stripe
         */
        if (
          payload?.code ===
          "LOCUM_STRIPE_NOT_CONNECTED"
        ) {
          throw new Error(
            "The locum has not completed Stripe payout onboarding yet. " +
              "The locum must connect their Stripe account before payment can be processed."
          );
        }

        /*
         * Stripe Connect exists but payout is not ready
         */
        if (
          payload?.code ===
          "LOCUM_PAYOUTS_NOT_ENABLED"
        ) {
          throw new Error(
            "The locum's Stripe account is connected but is not yet enabled to receive payouts."
          );
        }

        /*
         * Invoice already paid
         */
        if (response.status === 409) {
          throw new Error(
            payload?.error ||
              "This invoice has already been paid."
          );
        }

        throw new Error(
          payload?.error ||
            payload?.message ||
            "Stripe checkout could not be created."
        );
      }

      const checkoutUrl =
        payload?.url ||
        payload?.checkoutUrl ||
        payload?.checkout_url ||
        payload?.sessionUrl;

      if (!checkoutUrl) {
        console.error(
          "Stripe returned no checkout URL:",
          payload
        );

        throw new Error(
          "Stripe created the payment but returned no checkout URL."
        );
      }

      setMessage(
        "Payment session created. Opening Stripe..."
      );

      window.location.href =
        checkoutUrl;
    } catch (err: any) {
      console.error(
        "Employer Stripe payment error:",
        err
      );

      setError(
        err?.message ||
          "Could not start Stripe payment."
      );

      setPaying(false);
    }
  }

  const amount =
    timesheet
      ? invoiceAmount(timesheet)
      : 0;

  const careStaffingFee =
    amount * 0.1;

  const locumPayout =
    amount - careStaffingFee;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link
          href="/employer"
          style={styles.back}
        >
          ← Back to Employer Portal
        </Link>

        <nav style={styles.nav}>
          <Link
            href="/employer"
            style={styles.navLink}
          >
            Post Shift
          </Link>

          <Link
            href="/employer/shifts"
            style={styles.navLink}
          >
            My Shifts
          </Link>

          <Link
            href="/employer/applicants"
            style={styles.navLink}
          >
            Applicants
          </Link>

          <Link
            href="/employer/timesheets"
            style={styles.navLink}
          >
            Timesheets
          </Link>

          <Link
            href="/employer/invoices"
            style={styles.navLink}
          >
            Invoices
          </Link>

          <Link
            href="/employer/payments"
            style={styles.active}
          >
            Payments
          </Link>

          <Link
            href="/employer/profile"
            style={styles.navLink}
          >
            Organisation Profile
          </Link>
        </nav>

        <section style={styles.hero}>
          <p style={styles.eyebrow}>
            SECURE PAYMENT
          </p>

          <h1 style={styles.title}>
            Employer Payments
          </h1>

          <p style={styles.subtitle}>
            Pay approved CareStaffing
            invoices securely through
            Stripe.
          </p>
        </section>

        {message && (
          <div style={styles.success}>
            {message}
          </div>
        )}

        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {!timesheetId ? (
          <section style={styles.card}>
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Choose an approved invoice
            </h2>

            <p style={styles.muted}>
              Open the Invoices page and
              select the approved invoice
              you want to pay.
            </p>

            <Link
              href="/employer/invoices"
              style={styles.invoiceButton}
            >
              VIEW INVOICES →
            </Link>
          </section>
        ) : loading ? (
          <section style={styles.card}>
            Loading approved invoice...
          </section>
        ) : !timesheet ? (
          <section style={styles.card}>
            Invoice could not be found.
          </section>
        ) : (
          <section style={styles.card}>
            <div style={styles.topRow}>
              <div>
                <p
                  style={
                    styles.smallLabel
                  }
                >
                  PAYMENT STATUS
                </p>

                <h2
                  style={{
                    margin:
                      "5px 0 0",
                  }}
                >
                  Invoice Payment
                </h2>
              </div>

              <span style={styles.badge}>
                {(
                  timesheet.status ||
                  "unknown"
                ).toUpperCase()}
              </span>
            </div>

            <div style={styles.moneyGrid}>
              <MoneyBox
                label="Employer Pays"
                value={amount}
                highlight
              />

              <MoneyBox
                label="CareStaffing Fee (10%)"
                value={
                  careStaffingFee
                }
              />

              <MoneyBox
                label="Locum Payout (90%)"
                value={locumPayout}
              />
            </div>

            <div
              style={
                styles.paymentExplanation
              }
            >
              <strong>
                How the payment works
              </strong>

              <p
                style={{
                  marginBottom: 0,
                  lineHeight: 1.6,
                }}
              >
                The employer pays{" "}
                <strong>
                  R
                  {amount.toFixed(
                    2
                  )}
                </strong>{" "}
                once. CareStaffing
                retains{" "}
                <strong>
                  R
                  {careStaffingFee.toFixed(
                    2
                  )}
                </strong>{" "}
                and the locum receives{" "}
                <strong>
                  R
                  {locumPayout.toFixed(
                    2
                  )}
                </strong>
                .
              </p>
            </div>

            {timesheet.status?.toLowerCase() !==
            "approved" ? (
              <div
                style={
                  styles.warning
                }
              >
                This timesheet is not
                approved yet. Payment
                remains locked until
                employer approval is
                complete.
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void payInvoice()
                }
                disabled={paying}
                style={{
                  ...styles.payButton,

                  opacity:
                    paying
                      ? 0.6
                      : 1,

                  cursor:
                    paying
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {paying
                  ? "Opening Stripe..."
                  : `💳 PAY R${amount.toFixed(
                      2
                    )} WITH STRIPE`}
              </button>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function MoneyBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.moneyBox,

        ...(highlight
          ? styles.moneyHighlight
          : {}),
      }}
    >
      <span
        style={
          styles.smallLabel
        }
      >
        {label}
      </span>

      <strong
        style={{
          fontSize: "22px",
        }}
      >
        R{value.toFixed(2)}
      </strong>
    </div>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: "28px 20px 60px",
    fontFamily:
      "Arial, sans-serif",
  },

  container: {
    maxWidth: "980px",
    margin: "0 auto",
  },

  back: {
    color: "#0f766e",
    fontWeight: 900,
    textDecoration: "none",
  },

  nav: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "18px",
    padding: "10px",
    borderRadius: "16px",
    background: "white",
    boxShadow:
      "0 8px 24px rgba(15,23,42,.05)",
  },

  navLink: {
    padding: "10px 12px",
    borderRadius: "10px",
    color: "#475569",
    fontWeight: 800,
    textDecoration: "none",
  },

  active: {
    padding: "10px 12px",
    borderRadius: "10px",
    color: "#0f766e",
    background: "#ccfbf1",
    fontWeight: 900,
    textDecoration: "none",
  },

  hero: {
    background:
      "linear-gradient(135deg,#0f172a,#0f766e)",
    color: "white",
    padding: "34px",
    borderRadius: "28px",
    margin: "20px 0",
  },

  eyebrow: {
    margin: 0,
    color: "#99f6e4",
    fontWeight: 900,
    letterSpacing: "1px",
  },

  title: {
    margin: "8px 0",
    fontSize: "42px",
  },

  subtitle: {
    color: "#ccfbf1",
    lineHeight: 1.5,
  },

  card: {
    background: "white",
    padding: "26px",
    borderRadius: "20px",
    boxShadow:
      "0 8px 24px rgba(15,23,42,.06)",
  },

  topRow: {
    display: "flex",
    justifyContent:
      "space-between",
    gap: "15px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  badge: {
    display: "inline-block",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "11px",
    fontWeight: 900,
  },

  moneyGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(180px,1fr))",
    gap: "12px",
    marginTop: "20px",
  },

  moneyBox: {
    display: "grid",
    gap: "7px",
    padding: "16px",
    borderRadius: "14px",
    background: "#f8fafc",
  },

  moneyHighlight: {
    background: "#dcfce7",
    color: "#166534",
  },

  smallLabel: {
    fontSize: "12px",
    color: "#64748b",
    fontWeight: 800,
  },

  paymentExplanation: {
    margin: "20px 0",
    padding: "16px",
    borderRadius: "14px",
    background: "#ecfeff",
    color: "#155e75",
  },

  muted: {
    color: "#64748b",
    lineHeight: 1.6,
  },

  invoiceButton: {
    display: "inline-block",
    marginTop: "10px",
    color: "#0f766e",
    fontWeight: 900,
    textDecoration: "none",
  },

  payButton: {
    width: "100%",
    background: "#39ff14",
    color: "#052e16",
    border:
      "2px solid #22c55e",
    boxShadow:
      "0 0 22px rgba(57,255,20,.40)",
    padding: "17px 20px",
    borderRadius: "12px",
    fontWeight: 900,
    fontSize: "16px",
  },

  warning: {
    marginTop: "18px",
    padding: "15px",
    borderRadius: "12px",
    background: "#fef3c7",
    color: "#92400e",
    fontWeight: 800,
  },

  success: {
    background: "#dcfce7",
    color: "#166534",
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "18px",
    fontWeight: 800,
  },

  error: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "18px",
    fontWeight: 800,
  },
};
