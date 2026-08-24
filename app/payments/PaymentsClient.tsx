"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { supabase } from "../../lib/supabaseClient";

/*
 * ============================================================
 * TYPES
 * ============================================================
 */

type Payment = {
  id: string;

  timesheet_id?: string | null;
  shift_id?: string | null;
  employer_id?: string | null;
  locum_id?: string | null;

  locum_amount: number;
  platform_fee: number;
  employer_total: number;

  payment_status: string;
  payout_status: string;

  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_charge_id?: string | null;
  stripe_transfer_id?: string | null;

  paid_at?: string | null;
  payout_at?: string | null;

  created_at: string;

  shifts?: {
    title?: string | null;
    location?: string | null;
    business_name?: string | null;
    shift_date?: string | null;
  } | null;
};

type StripeProfile = {
  id: string;

  stripe_account_id?: string | null;

  stripe_onboarding_complete?: boolean | null;

  stripe_charges_enabled?: boolean | null;

  stripe_payouts_enabled?: boolean | null;
};

/*
 * ============================================================
 * PAGE
 * ============================================================
 */

export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const stripeReturn =
    searchParams.get("stripe") || "";

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [stripeProfile, setStripeProfile] =
    useState<StripeProfile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [stripeLoading, setStripeLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  /*
   * ============================================================
   * INITIAL LOAD
   * ============================================================
   */

  useEffect(() => {
    void initialise();
  }, []);

  /*
   * Stripe sends the user back here after onboarding.
   */
  useEffect(() => {
    if (
      stripeReturn === "connected"
    ) {
      setMessage(
        "Stripe onboarding returned successfully. Checking your payout account status..."
      );

      void refreshStripeStatus();
    }

    if (
      stripeReturn === "refresh"
    ) {
      setMessage(
        "Your Stripe onboarding session expired or needs more information. Select Complete Stripe Setup to continue."
      );

      void refreshStripeStatus();
    }
  }, [stripeReturn]);

  async function initialise() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        router.replace(
          "/login"
        );

        return;
      }

      await Promise.all([
        loadPayments(
          user.id
        ),

        loadStripeProfile(
          user.id
        ),
      ]);
    } catch (err: any) {
      console.error(
        "Payments page initialise error:",
        err
      );

      setError(
        err?.message ||
          "Could not load your CareStaffing payments."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ============================================================
   * LOAD PAYMENT HISTORY
   * ============================================================
   */

  async function loadPayments(
    userId: string
  ) {
    const {
      data,
      error: paymentError,
    } =
      await supabase
        .from("payments")
        .select(
          `
            *,
            shifts (
              title,
              location,
              business_name,
              shift_date
            )
          `
        )
        .eq(
          "locum_id",
          userId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (paymentError) {
      throw paymentError;
    }

    setPayments(
      (data as Payment[]) ||
        []
    );
  }

  /*
   * ============================================================
   * LOAD STRIPE STATUS FROM PROFILE
   * ============================================================
   */

  async function loadStripeProfile(
    userId: string
  ) {
    const {
      data,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          `
          id,
          stripe_account_id,
          stripe_onboarding_complete,
          stripe_charges_enabled,
          stripe_payouts_enabled
        `
        )
        .eq(
          "id",
          userId
        )
        .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    setStripeProfile(
      (data as StripeProfile) ||
        null
    );
  }

  /*
   * ============================================================
   * GET CURRENT SUPABASE ACCESS TOKEN
   * ============================================================
   */

  async function getAccessToken() {
    const {
      data: { session },
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (sessionError) {
      console.error(
        "Stripe session error:",
        sessionError
      );

      return null;
    }

    return (
      session?.access_token ||
      null
    );
  }

  /*
   * ============================================================
   * START / CONTINUE STRIPE CONNECT
   * ============================================================
   */

  async function connectStripe() {
    setStripeLoading(true);
    setError("");
    setMessage("");

    try {
      const accessToken =
        await getAccessToken();

      if (!accessToken) {
        throw new Error(
          "Your login session could not be verified. Please log in again."
        );
      }

      const origin =
        window.location.origin;

      const response =
        await fetch(
          "/api/stripe/connect",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${accessToken}`,
            },

            body:
              JSON.stringify({
                returnUrl:
                  `${origin}/payments?stripe=connected`,

                refreshUrl:
                  `${origin}/payments?stripe=refresh`,
              }),
          }
        );

      let result: any = {};

      try {
        result =
          await response.json();
      } catch {
        // Ignore JSON parsing failure.
      }

      console.log(
        "Stripe Connect response:",
        response.status,
        result
      );

      if (
        !response.ok
      ) {
        if (
          response.status ===
          401
        ) {
          throw new Error(
            result?.detail
              ? `Authentication failed: ${result.detail}`
              : "The server could not verify your CareStaffing login."
          );
        }

        throw new Error(
          result?.error ||
            result?.message ||
            "Could not start Stripe payout setup."
        );
      }

      /*
       * Already fully connected.
       */
      if (
        result?.alreadyConnected
      ) {
        setMessage(
          "Your Stripe payout account is already connected and ready."
        );

        await refreshStripeStatus();

        setStripeLoading(
          false
        );

        return;
      }

      /*
       * Stripe onboarding URL.
       */
      if (
        result?.url
      ) {
        setMessage(
          "Opening secure Stripe payout setup..."
        );

        window.location.assign(
          result.url
        );

        return;
      }

      throw new Error(
        "Stripe did not return an onboarding link."
      );
    } catch (err: any) {
      console.error(
        "Stripe Connect error:",
        err
      );

      setError(
        err?.message ||
          "Could not connect Stripe."
      );

      setStripeLoading(
        false
      );
    }
  }

  /*
   * ============================================================
   * REFRESH STRIPE STATUS
   * ============================================================
   *
   * Calling /api/stripe/connect again retrieves the account
   * from Stripe and synchronises its status into Supabase.
   */

  async function refreshStripeStatus() {
    setStripeLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        throw new Error(
          "Your login session could not be verified."
        );
      }

      const accessToken =
        await getAccessToken();

      if (!accessToken) {
        throw new Error(
          "Your login session could not be verified."
        );
      }

      const response =
        await fetch(
          "/api/stripe/connect",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${accessToken}`,
            },

            body:
              JSON.stringify({
                returnUrl:
                  `${window.location.origin}/payments?stripe=connected`,

                refreshUrl:
                  `${window.location.origin}/payments?stripe=refresh`,
              }),
          }
        );

      const result =
        await response
          .json()
          .catch(
            () => ({})
          );

      console.log(
        "Stripe status response:",
        response.status,
        result
      );

      if (
        !response.ok
      ) {
        throw new Error(
          result?.error ||
            result?.detail ||
            "Could not check Stripe payout status."
        );
      }

      /*
       * Reload persisted status.
       */
      await loadStripeProfile(
        user.id
      );

      if (
        result?.alreadyConnected ||
        result?.payoutsEnabled
      ) {
        setMessage(
          "Stripe payouts are connected and ready to receive employer payments."
        );
      } else {
        setMessage(
          "Stripe account found. Additional onboarding information may still be required."
        );
      }
    } catch (err: any) {
      console.error(
        "Stripe status refresh error:",
        err
      );

      setError(
        err?.message ||
          "Could not refresh Stripe status."
      );
    } finally {
      setStripeLoading(
        false
      );
    }
  }

  /*
   * ============================================================
   * TOTALS
   * ============================================================
   */

  const totals =
    useMemo(() => {
      const grossEarned =
        payments.reduce(
          (
            sum,
            payment
          ) =>
            sum +
            Number(
              payment.locum_amount ||
                0
            ),
          0
        );

      const platformFees =
        payments.reduce(
          (
            sum,
            payment
          ) =>
            sum +
            Number(
              payment.platform_fee ||
                0
            ),
          0
        );

      const paidOut =
        payments
          .filter(
            (
              payment
            ) =>
              payment.payout_status ===
                "paid" ||
              payment.payout_status ===
                "paid_out"
          )
          .reduce(
            (
              sum,
              payment
            ) =>
              sum +
              Number(
                payment.locum_amount ||
                  0
              ),
            0
          );

      const pendingPayout =
        payments
          .filter(
            (
              payment
            ) =>
              payment.payment_status ===
                "paid" &&
              payment.payout_status !==
                "paid" &&
              payment.payout_status !==
                "paid_out"
          )
          .reduce(
            (
              sum,
              payment
            ) =>
              sum +
              Number(
                payment.locum_amount ||
                  0
              ),
            0
          );

      return {
        grossEarned,
        platformFees,
        paidOut,
        pendingPayout,
      };
    }, [payments]);

  /*
   * ============================================================
   * STRIPE STATE
   * ============================================================
   */

  const hasStripeAccount =
    Boolean(
      stripeProfile
        ?.stripe_account_id
    );

  const onboardingComplete =
    Boolean(
      stripeProfile
        ?.stripe_onboarding_complete
    );

  const payoutsEnabled =
    Boolean(
      stripeProfile
        ?.stripe_payouts_enabled
    );

  const chargesEnabled =
    Boolean(
      stripeProfile
        ?.stripe_charges_enabled
    );

  const stripeReady =
    hasStripeAccount &&
    payoutsEnabled;

  /*
   * ============================================================
   * HELPERS
   * ============================================================
   */

  function money(
    value:
      | number
      | null
      | undefined
  ) {
    return `R${Number(
      value || 0
    ).toLocaleString(
      "en-ZA",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  }

  function formatDate(
    value?: string | null
  ) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleDateString(
      "en-ZA",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  /*
   * ============================================================
   * PAGE
   * ============================================================
   */

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Link
          href="/dashboard"
          style={styles.back}
        >
          ← Back to Dashboard
        </Link>

        <section style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>
              CARESTAFFING
            </p>

            <h1 style={styles.title}>
              Payments & Payouts
            </h1>

            <p style={styles.subtitle}>
              Track employer payments and connect your Stripe payout account.
            </p>
          </div>

          <div
            style={{
              ...styles.stripeBadge,

              ...(stripeReady
                ? styles.stripeBadgeReady
                : {}),
            }}
          >
            {stripeReady
              ? "✓ STRIPE READY"
              : "STRIPE CONNECT"}
          </div>
        </section>

        {message && (
          <div
            style={
              styles.successBox
            }
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={
              styles.errorBox
            }
          >
            {error}
          </div>
        )}

        {/* ====================================================
            STRIPE PAYOUT ACCOUNT
            ==================================================== */}

        <section
          style={
            stripeReady
              ? styles.stripeReadyCard
              : styles.stripeSetupCard
          }
        >
          <div
            style={
              styles.stripeCardTop
            }
          >
            <div>
              <p
                style={
                  styles.smallLabel
                }
              >
                PAYOUT ACCOUNT
              </p>

              <h2
                style={
                  styles.stripeTitle
                }
              >
                Stripe Connect
              </h2>

              <p
                style={
                  styles.muted
                }
              >
                Connect your payout account so CareStaffing can transfer your share of employer payments directly to you.
              </p>
            </div>

            <StripeConnectionBadge
              ready={
                stripeReady
              }
              account={
                hasStripeAccount
              }
            />
          </div>

          <div
            style={
              styles.stripeStatusGrid
            }
          >
            <StripeStatus
              label="Stripe account"
              ready={
                hasStripeAccount
              }
              text={
                hasStripeAccount
                  ? "Created"
                  : "Not connected"
              }
            />

            <StripeStatus
              label="Onboarding"
              ready={
                onboardingComplete
              }
              text={
                onboardingComplete
                  ? "Complete"
                  : "Incomplete"
              }
            />

            <StripeStatus
              label="Payouts"
              ready={
                payoutsEnabled
              }
              text={
                payoutsEnabled
                  ? "Enabled"
                  : "Not enabled"
              }
            />

            <StripeStatus
              label="Charges"
              ready={
                chargesEnabled
              }
              text={
                chargesEnabled
                  ? "Enabled"
                  : "Pending"
              }
            />
          </div>

          {stripeReady ? (
            <div
              style={
                styles.connectedBox
              }
            >
              <div>
                <strong>
                  ✓ Payout account ready
                </strong>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                  }}
                >
                  Employer payments can now be split and your payout share can be transferred through Stripe.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void refreshStripeStatus()
                }
                disabled={
                  stripeLoading
                }
                style={
                  styles.secondaryButton
                }
              >
                {stripeLoading
                  ? "Checking..."
                  : "↻ Check Stripe Status"}
              </button>
            </div>
          ) : (
            <div
              style={
                styles.setupActionBox
              }
            >
              <div>
                <strong>
                  {hasStripeAccount
                    ? "Stripe setup needs to be completed"
                    : "Set up your payout account"}
                </strong>

                <p
                  style={
                    styles.muted
                  }
                >
                  Stripe will securely collect the required identity, business and bank-account information.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void connectStripe()
                }
                disabled={
                  stripeLoading
                }
                style={{
                  ...styles.connectButton,

                  opacity:
                    stripeLoading
                      ? 0.6
                      : 1,
                }}
              >
                {stripeLoading
                  ? "Opening Stripe..."
                  : hasStripeAccount
                  ? "💳 COMPLETE STRIPE SETUP"
                  : "💳 SET UP STRIPE PAYOUTS"}
              </button>
            </div>
          )}
        </section>

        {/* ====================================================
            PAYMENT STATS
            ==================================================== */}

        {loading ? (
          <div
            style={
              styles.card
            }
          >
            Loading payments...
          </div>
        ) : (
          <>
            <section
              style={
                styles.statsGrid
              }
            >
              <StatCard
                label="Your Earnings"
                value={money(
                  totals.grossEarned
                )}
                helper="Your payout share"
              />

              <StatCard
                label="CareStaffing Fees"
                value={money(
                  totals.platformFees
                )}
                helper="Platform fees"
              />

              <StatCard
                label="Paid to You"
                value={money(
                  totals.paidOut
                )}
                helper="Completed payouts"
              />

              <StatCard
                label="Pending Payout"
                value={money(
                  totals.pendingPayout
                )}
                helper="Employer paid, awaiting bank payout"
              />
            </section>

            {/* =================================================
                PAYMENT HISTORY
                ================================================= */}

            <section
              style={
                styles.card
              }
            >
              <div
                style={
                  styles.sectionHeader
                }
              >
                <div>
                  <h2
                    style={
                      styles.cardTitle
                    }
                  >
                    Payment History
                  </h2>

                  <p
                    style={
                      styles.muted
                    }
                  >
                    Payments appear after an employer pays an approved CareStaffing invoice.
                  </p>
                </div>
              </div>

              {payments.length ===
              0 ? (
                <div
                  style={
                    styles.emptyBox
                  }
                >
                  <div
                    style={
                      styles.emptyIcon
                    }
                  >
                    💳
                  </div>

                  <h3>
                    No payments yet
                  </h3>

                  <p
                    style={
                      styles.muted
                    }
                  >
                    Once your timesheet is approved and the employer completes payment, the transaction will appear here.
                  </p>

                  <Link
                    href="/invoices"
                    style={
                      styles.primaryLink
                    }
                  >
                    View Invoices
                  </Link>
                </div>
              ) : (
                <div
                  style={
                    styles.list
                  }
                >
                  {payments.map(
                    (
                      payment
                    ) => {
                      const shift =
                        payment.shifts;

                      return (
                        <article
                          key={
                            payment.id
                          }
                          style={
                            styles.paymentRow
                          }
                        >
                          <div
                            style={
                              styles.paymentMain
                            }
                          >
                            <div
                              style={
                                styles.amountRow
                              }
                            >
                              <div>
                                <p
                                  style={
                                    styles.smallLabel
                                  }
                                >
                                  YOUR EARNINGS
                                </p>

                                <h3
                                  style={
                                    styles.rowTitle
                                  }
                                >
                                  {money(
                                    payment.locum_amount
                                  )}
                                </h3>
                              </div>

                              <PaymentStatusBadge
                                value={
                                  payment.payment_status ||
                                  "pending"
                                }
                              />
                            </div>

                            <div
                              style={
                                styles.shiftDetails
                              }
                            >
                              <strong>
                                {shift?.title ||
                                  "Healthcare Shift"}
                              </strong>

                              <span>
                                {shift?.business_name ||
                                  "CareStaffing Employer"}
                              </span>

                              <span>
                                {shift?.location ||
                                  ""}

                                {shift?.shift_date
                                  ? ` • ${formatDate(
                                      shift.shift_date
                                    )}`
                                  : ""}
                              </span>
                            </div>

                            <div
                              style={
                                styles.amountBreakdown
                              }
                            >
                              <div>
                                <span
                                  style={
                                    styles.breakdownLabel
                                  }
                                >
                                  Your payout
                                </span>

                                <strong>
                                  {money(
                                    payment.locum_amount
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span
                                  style={
                                    styles.breakdownLabel
                                  }
                                >
                                  CareStaffing fee
                                </span>

                                <strong>
                                  {money(
                                    payment.platform_fee
                                  )}
                                </strong>
                              </div>

                              <div>
                                <span
                                  style={
                                    styles.breakdownLabel
                                  }
                                >
                                  Employer paid
                                </span>

                                <strong>
                                  {money(
                                    payment.employer_total
                                  )}
                                </strong>
                              </div>
                            </div>

                            {payment.stripe_payment_intent_id && (
                              <p
                                style={
                                  styles.reference
                                }
                              >
                                Stripe payment:{" "}
                                {
                                  payment.stripe_payment_intent_id
                                }
                              </p>
                            )}
                          </div>

                          <div
                            style={
                              styles.payoutColumn
                            }
                          >
                            <span
                              style={
                                styles.smallLabel
                              }
                            >
                              PAYOUT STATUS
                            </span>

                            <PayoutStatusBadge
                              value={
                                payment.payout_status ||
                                "pending"
                              }
                            />

                            {payment.payout_at && (
                              <span
                                style={
                                  styles.payoutDate
                                }
                              >
                                {formatDate(
                                  payment.payout_at
                                )}
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

/*
 * ============================================================
 * STRIPE STATUS COMPONENT
 * ============================================================
 */

function StripeStatus({
  label,
  ready,
  text,
}: {
  label: string;
  ready: boolean;
  text: string;
}) {
  return (
    <div
      style={
        styles.statusItem
      }
    >
      <span
        style={
          styles.breakdownLabel
        }
      >
        {label}
      </span>

      <strong
        style={{
          color:
            ready
              ? "#166534"
              : "#92400e",
        }}
      >
        {ready
          ? "✓ "
          : "○ "}
        {text}
      </strong>
    </div>
  );
}

function StripeConnectionBadge({
  ready,
  account,
}: {
  ready: boolean;
  account: boolean;
}) {
  return (
    <span
      style={{
        ...styles.connectionBadge,

        ...(ready
          ? styles.connectionReady
          : account
          ? styles.connectionPending
          : styles.connectionMissing),
      }}
    >
      {ready
        ? "PAYOUTS READY"
        : account
        ? "SETUP INCOMPLETE"
        : "NOT CONNECTED"}
    </span>
  );
}

/*
 * ============================================================
 * STAT CARD
 * ============================================================
 */

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div
      style={
        styles.statCard
      }
    >
      <p
        style={
          styles.statLabel
        }
      >
        {label}
      </p>

      <h2
        style={
          styles.statValue
        }
      >
        {value}
      </h2>

      <p
        style={
          styles.statHelper
        }
      >
        {helper}
      </p>
    </div>
  );
}

/*
 * ============================================================
 * PAYMENT STATUS
 * ============================================================
 */

function PaymentStatusBadge({
  value,
}: {
  value: string;
}) {
  const clean =
    (
      value ||
      "pending"
    ).toLowerCase();

  const paid =
    clean === "paid" ||
    clean === "succeeded";

  const failed =
    clean === "failed" ||
    clean === "cancelled";

  return (
    <span
      style={{
        ...styles.badge,

        ...(paid
          ? styles.badgePaid
          : failed
          ? styles.badgeFailed
          : styles.badgePending),
      }}
    >
      {paid
        ? "Employer Paid"
        : failed
        ? "Payment Failed"
        : "Awaiting Payment"}
    </span>
  );
}

/*
 * ============================================================
 * PAYOUT STATUS
 * ============================================================
 */

function PayoutStatusBadge({
  value,
}: {
  value: string;
}) {
  const clean =
    (
      value ||
      "pending"
    ).toLowerCase();

  const paid =
    clean === "paid" ||
    clean === "paid_out";

  const processing =
    clean ===
      "processing" ||
    clean ===
      "in_transit";

  const failed =
    clean === "failed";

  return (
    <span
      style={{
        ...styles.badge,

        ...(paid
          ? styles.badgePaid
          : failed
          ? styles.badgeFailed
          : processing
          ? styles.badgeProcessing
          : styles.badgePending),
      }}
    >
      {paid
        ? "Paid to Bank"
        : failed
        ? "Payout Failed"
        : processing
        ? "Processing"
        : "Pending"}
    </span>
  );
}

/*
 * ============================================================
 * STYLES
 * ============================================================
 */

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight:
      "100vh",

    background:
      "#f1f5f9",

    padding:
      "30px 20px 60px",

    fontFamily:
      "Arial, sans-serif",
  },

  container: {
    maxWidth:
      "1180px",

    margin:
      "0 auto",
  },

  back: {
    color:
      "#0f766e",

    fontWeight: 800,

    textDecoration:
      "none",
  },

  hero: {
    margin:
      "20px 0",

    background:
      "linear-gradient(135deg,#0f172a,#16a34a)",

    color:
      "white",

    padding:
      "32px",

    borderRadius:
      "26px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "20px",

    flexWrap:
      "wrap",
  },

  eyebrow: {
    margin:
      "0 0 7px",

    color:
      "#bbf7d0",

    fontWeight:
      900,

    letterSpacing:
      "1px",

    fontSize:
      "12px",
  },

  title: {
    fontSize:
      "38px",

    margin: 0,
  },

  subtitle: {
    color:
      "#dcfce7",

    maxWidth:
      "650px",

    lineHeight:
      1.5,
  },

  stripeBadge: {
    background:
      "rgba(255,255,255,0.14)",

    border:
      "1px solid rgba(255,255,255,0.25)",

    padding:
      "12px 16px",

    borderRadius:
      "14px",

    fontSize:
      "12px",

    fontWeight:
      900,

    letterSpacing:
      "1px",
  },

  stripeBadgeReady: {
    background:
      "#39ff14",

    color:
      "#052e16",

    border:
      "1px solid #22c55e",
  },

  stripeSetupCard: {
    background:
      "white",

    border:
      "2px solid #f59e0b",

    padding:
      "24px",

    borderRadius:
      "24px",

    marginBottom:
      "22px",

    boxShadow:
      "0 8px 24px rgba(15,23,42,0.08)",
  },

  stripeReadyCard: {
    background:
      "#f0fdf4",

    border:
      "2px solid #22c55e",

    padding:
      "24px",

    borderRadius:
      "24px",

    marginBottom:
      "22px",

    boxShadow:
      "0 8px 24px rgba(15,23,42,0.08)",
  },

  stripeCardTop: {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "flex-start",

    flexWrap:
      "wrap",

    gap:
      "20px",
  },

  stripeTitle: {
    margin:
      "5px 0",

    fontSize:
      "27px",

    color:
      "#0f172a",
  },

  stripeStatusGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(160px,1fr))",

    gap:
      "12px",

    marginTop:
      "20px",
  },

  statusItem: {
    background:
      "#f8fafc",

    padding:
      "14px",

    borderRadius:
      "12px",

    display:
      "grid",

    gap:
      "5px",
  },

  connectionBadge: {
    padding:
      "8px 12px",

    borderRadius:
      "999px",

    fontSize:
      "11px",

    fontWeight:
      900,
  },

  connectionReady: {
    background:
      "#dcfce7",

    color:
      "#166534",
  },

  connectionPending: {
    background:
      "#fef3c7",

    color:
      "#92400e",
  },

  connectionMissing: {
    background:
      "#fee2e2",

    color:
      "#991b1b",
  },

  setupActionBox: {
    marginTop:
      "20px",

    padding:
      "18px",

    background:
      "#fffbeb",

    borderRadius:
      "14px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    flexWrap:
      "wrap",

    gap:
      "15px",
  },

  connectedBox: {
    marginTop:
      "20px",

    padding:
      "18px",

    background:
      "#dcfce7",

    color:
      "#166534",

    borderRadius:
      "14px",

    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    flexWrap:
      "wrap",

    gap:
      "15px",
  },

  connectButton: {
    background:
      "#39ff14",

    color:
      "#052e16",

    border:
      "2px solid #22c55e",

    boxShadow:
      "0 0 18px rgba(57,255,20,.35)",

    padding:
      "14px 20px",

    borderRadius:
      "12px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },

  secondaryButton: {
    background:
      "white",

    color:
      "#166534",

    border:
      "1px solid #86efac",

    padding:
      "12px 16px",

    borderRadius:
      "10px",

    fontWeight:
      900,

    cursor:
      "pointer",
  },

  successBox: {
    marginBottom:
      "20px",

    background:
      "#dcfce7",

    color:
      "#166534",

    padding:
      "14px 16px",

    borderRadius:
      "12px",

    fontWeight:
      800,
  },

  errorBox: {
    marginBottom:
      "20px",

    background:
      "#fee2e2",

    color:
      "#991b1b",

    padding:
      "14px 16px",

    borderRadius:
      "12px",

    fontWeight:
      800,
  },

  statsGrid: {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",

    gap:
      "18px",

    marginBottom:
      "22px",
  },

  statCard: {
    background:
      "white",

    padding:
      "22px",

    borderRadius:
      "22px",

    boxShadow:
      "0 8px 24px rgba(15,23,42,0.08)",

    border:
      "1px solid #e2e8f0",
  },

  statLabel: {
    margin: 0,

    color:
      "#64748b",

    fontWeight:
      700,
  },

  statValue: {
    margin:
      "10px 0 4px",

    color:
      "#0f172a",

    fontSize:
      "28px",
  },

  statHelper: {
    margin: 0,

    color:
      "#94a3b8",

    fontSize:
      "12px",
  },

  card: {
    background:
      "white",

    padding:
      "24px",

    borderRadius:
      "24px",

    boxShadow:
      "0 8px 24px rgba(15,23,42,0.08)",

    border:
      "1px solid #e2e8f0",
  },

  sectionHeader: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "20px",

    marginBottom:
      "20px",
  },

  cardTitle: {
    margin: 0,

    color:
      "#0f172a",
  },

  muted: {
    color:
      "#64748b",

    lineHeight:
      1.5,
  },

  list: {
    display:
      "grid",

    gap:
      "14px",
  },

  paymentRow: {
    border:
      "1px solid #e2e8f0",

    borderRadius:
      "18px",

    padding:
      "20px",

    display:
      "grid",

    gridTemplateColumns:
      "1fr auto",

    gap:
      "24px",
  },

  paymentMain: {
    minWidth: 0,
  },

  amountRow: {
    display:
      "flex",

    justifyContent:
      "space-between",

    gap:
      "15px",

    alignItems:
      "flex-start",
  },

  smallLabel: {
    margin:
      "0 0 5px",

    color:
      "#64748b",

    fontSize:
      "11px",

    fontWeight:
      900,

    letterSpacing:
      "0.8px",
  },

  rowTitle: {
    margin: 0,

    color:
      "#0f172a",

    fontSize:
      "27px",
  },

  shiftDetails: {
    display:
      "grid",

    gap:
      "5px",

    marginTop:
      "13px",

    color:
      "#475569",

    fontSize:
      "14px",
  },

  amountBreakdown: {
    marginTop:
      "18px",

    display:
      "grid",

    gridTemplateColumns:
      "repeat(auto-fit,minmax(150px,1fr))",

    gap:
      "12px",

    background:
      "#f8fafc",

    padding:
      "14px",

    borderRadius:
      "13px",
  },

  breakdownLabel: {
    display:
      "block",

    color:
      "#64748b",

    fontSize:
      "11px",

    marginBottom:
      "4px",
  },

  reference: {
    color:
      "#94a3b8",

    fontSize:
      "11px",

    wordBreak:
      "break-all",

    marginBottom: 0,
  },

  payoutColumn: {
    minWidth:
      "145px",

    display:
      "flex",

    flexDirection:
      "column",

    alignItems:
      "flex-end",

    gap:
      "8px",
  },

  payoutDate: {
    color:
      "#64748b",

    fontSize:
      "12px",
  },

  badge: {
    padding:
      "8px 11px",

    borderRadius:
      "999px",

    fontWeight:
      900,

    fontSize:
      "11px",

    whiteSpace:
      "nowrap",
  },

  badgePaid: {
    background:
      "#dcfce7",

    color:
      "#166534",
  },

  badgePending: {
    background:
      "#e0f2fe",

    color:
      "#075985",
  },

  badgeProcessing: {
    background:
      "#fef3c7",

    color:
      "#92400e",
  },

  badgeFailed: {
    background:
      "#fee2e2",

    color:
      "#991b1b",
  },

  emptyBox: {
    textAlign:
      "center",

    padding:
      "45px 20px",
  },

  emptyIcon: {
    fontSize:
      "40px",
  },

  primaryLink: {
    display:
      "inline-block",

    marginTop:
      "10px",

    background:
      "#0f766e",

    color:
      "white",

    padding:
      "12px 18px",

    borderRadius:
      "12px",

    textDecoration:
      "none",

    fontWeight:
      800,
  },
};
