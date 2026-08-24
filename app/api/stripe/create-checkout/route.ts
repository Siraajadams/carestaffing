import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * ============================================================
 * ENVIRONMENT
 * ============================================================
 */

const stripeSecretKey =
  (process.env.STRIPE_SECRET_KEY || "")
    .trim()
    .replace(/[\r\n]/g, "");

const supabaseUrl =
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
    .trim();

const supabaseServiceRoleKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "")
    .trim()
    .replace(/[\r\n]/g, "");

const stripe = new Stripe(stripeSecretKey);

/*
 * ============================================================
 * SUPABASE ADMIN
 * ============================================================
 */

function getAdminSupabase() {
  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured."
    );
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

/*
 * ============================================================
 * AUTHENTICATE EMPLOYER
 * ============================================================
 */

async function getAuthenticatedUser(
  req: NextRequest
) {
  const authorization =
    req.headers.get("authorization");

  if (!authorization) {
    return {
      user: null,
      error:
        "Authorization header was not received.",
    };
  }

  if (
    !authorization.startsWith("Bearer ")
  ) {
    return {
      user: null,
      error:
        "Authorization header is invalid.",
    };
  }

  const accessToken =
    authorization
      .slice("Bearer ".length)
      .trim();

  if (!accessToken) {
    return {
      user: null,
      error:
        "Authentication token was empty.",
    };
  }

  const supabase =
    getAdminSupabase();

  const {
    data: { user },
    error,
  } =
    await supabase.auth.getUser(
      accessToken
    );

  if (error || !user) {
    console.error(
      "Employer authentication failed:",
      error
    );

    return {
      user: null,
      error:
        error?.message ||
        "Supabase rejected the login token.",
    };
  }

  return {
    user,
    error: null,
  };
}

/*
 * ============================================================
 * BASE URL
 * ============================================================
 */

function getBaseUrl(
  req: NextRequest
) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env
      .VERCEL_PROJECT_PRODUCTION_URL;

  if (configured) {
    const clean =
      configured
        .trim()
        .replace(/\/+$/, "");

    if (
      clean.startsWith("http://") ||
      clean.startsWith("https://")
    ) {
      return clean;
    }

    return `https://${clean}`;
  }

  return req.nextUrl.origin;
}

/*
 * ============================================================
 * MONEY
 * ============================================================
 */

function toCents(value: number) {
  return Math.round(
    value * 100
  );
}

/*
 * ============================================================
 * INVOICE TOTAL
 * ============================================================
 */

function calculateInvoiceTotal(
  timesheet: any,
  shift: any
) {
  /*
   * Prefer stored approved total.
   */
  const storedTotal =
    Number(
      timesheet.total_amount ||
        0
    );

  if (storedTotal > 0) {
    return storedTotal;
  }

  /*
   * Otherwise:
   * approved hours × agreed rate.
   */
  const agreedRate =
    Number(
      timesheet.agreed_rate ||
        0
    );

  const hoursWorked =
    Number(
      timesheet.hours_worked ||
        0
    );

  if (
    agreedRate > 0 &&
    hoursWorked > 0
  ) {
    return (
      agreedRate *
      hoursWorked
    );
  }

  /*
   * Fallback to shift rate.
   */
  const rate =
    Number(
      shift.locum_rate ||
        shift.hourly_rate ||
        0
    );

  const rateType =
    String(
      shift.rate_type ||
        "hourly"
    ).toLowerCase();

  if (
    rateType === "hourly" &&
    hoursWorked > 0
  ) {
    return (
      rate *
      hoursWorked
    );
  }

  return rate;
}

/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  req: NextRequest
) {
  try {
    /*
     * --------------------------------------------------------
     * ENV CHECK
     * --------------------------------------------------------
     */

    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error:
            "STRIPE_SECRET_KEY is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey
    ) {
      return NextResponse.json(
        {
          error:
            "Supabase server environment variables are not configured.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * AUTHENTICATE EMPLOYER
     * --------------------------------------------------------
     */

    const auth =
      await getAuthenticatedUser(
        req
      );

    if (!auth.user) {
      return NextResponse.json(
        {
          error:
            "Unauthorised.",
          detail:
            auth.error,
        },
        {
          status: 401,
        }
      );
    }

    const user =
      auth.user;

    /*
     * --------------------------------------------------------
     * REQUEST BODY
     * --------------------------------------------------------
     */

    const body =
      await req
        .json()
        .catch(() => ({}));

    const timesheetId =
      String(
        body?.timesheetId ||
          body?.timesheet_id ||
          ""
      ).trim();

    if (!timesheetId) {
      return NextResponse.json(
        {
          error:
            "timesheetId is required.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase =
      getAdminSupabase();

    /*
     * --------------------------------------------------------
     * LOAD TIMESHEET
     * --------------------------------------------------------
     */

    const {
      data: timesheet,
      error: timesheetError,
    } =
      await supabase
        .from("timesheets")
        .select("*")
        .eq(
          "id",
          timesheetId
        )
        .maybeSingle();

    if (timesheetError) {
      throw timesheetError;
    }

    if (!timesheet) {
      return NextResponse.json(
        {
          error:
            "Timesheet not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * APPROVED ONLY
     * --------------------------------------------------------
     */

    if (
      String(
        timesheet.status ||
          ""
      ).toLowerCase() !==
      "approved"
    ) {
      return NextResponse.json(
        {
          error:
            "Only an approved timesheet can be paid.",
        },
        {
          status: 400,
        }
      );
    }

    if (!timesheet.shift_id) {
      return NextResponse.json(
        {
          error:
            "Timesheet has no shift linked to it.",
        },
        {
          status: 400,
        }
      );
    }

    if (!timesheet.locum_id) {
      return NextResponse.json(
        {
          error:
            "Timesheet has no healthcare professional linked to it.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * LOAD SHIFT
     * --------------------------------------------------------
     */

    const {
      data: shift,
      error: shiftError,
    } =
      await supabase
        .from("shifts")
        .select("*")
        .eq(
          "id",
          timesheet.shift_id
        )
        .maybeSingle();

    if (shiftError) {
      throw shiftError;
    }

    if (!shift) {
      return NextResponse.json(
        {
          error:
            "Shift not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * EMPLOYER AUTHORISATION
     * --------------------------------------------------------
     */

    let employerAuthorised =
      shift.created_by ===
      user.id;

    if (
      !employerAuthorised &&
      shift.company_id
    ) {
      const {
        data: company,
        error: companyError,
      } =
        await supabase
          .from("companies")
          .select(
            "id,owner_id"
          )
          .eq(
            "id",
            shift.company_id
          )
          .maybeSingle();

      if (companyError) {
        throw companyError;
      }

      employerAuthorised =
        company?.owner_id ===
        user.id;
    }

    if (!employerAuthorised) {
      return NextResponse.json(
        {
          error:
            "You are not authorised to pay this invoice.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ========================================================
     * SINGLE PAYMENT MODEL
     * ========================================================
     *
     * NO Stripe Connect.
     * NO recipient Stripe account.
     * NO payout onboarding.
     * NO transfer_data.
     * NO application_fee_amount.
     *
     * Employer pays 100% into
     * CareStaffing Stripe account.
     */

    /*
     * --------------------------------------------------------
     * CALCULATE AMOUNT
     * --------------------------------------------------------
     */

    const invoiceTotal =
      Number(
        calculateInvoiceTotal(
          timesheet,
          shift
        ).toFixed(2)
      );

    if (
      !Number.isFinite(
        invoiceTotal
      ) ||
      invoiceTotal <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "The approved timesheet has no payable amount.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * INTERNAL ACCOUNTING
     * --------------------------------------------------------
     *
     * Stripe receives full payment.
     *
     * 10 / 90 split is now only
     * recorded internally.
     */

    const employerTotalCents =
      toCents(
        invoiceTotal
      );

    const platformFeeCents =
      Math.round(
        employerTotalCents *
          0.1
      );

    const professionalAmountCents =
      employerTotalCents -
      platformFeeCents;

    const employerTotal =
      employerTotalCents /
      100;

    const platformFee =
      platformFeeCents /
      100;

    const professionalAmount =
      professionalAmountCents /
      100;

    const currency =
      String(
        shift.currency ||
          "ZAR"
      ).toLowerCase();

    /*
     * --------------------------------------------------------
     * EXISTING PAYMENT
     * --------------------------------------------------------
     */

    const {
      data: existingPayment,
      error:
        existingPaymentError,
    } =
      await supabase
        .from("payments")
        .select("*")
        .eq(
          "timesheet_id",
          timesheet.id
        )
        .maybeSingle();

    if (
      existingPaymentError
    ) {
      throw existingPaymentError;
    }

    if (
      existingPayment &&
      [
        "paid",
        "succeeded",
      ].includes(
        String(
          existingPayment
            .payment_status ||
            ""
        ).toLowerCase()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This invoice has already been paid.",
          paymentId:
            existingPayment.id,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * CHECKOUT URLS
     * --------------------------------------------------------
     */

    const baseUrl =
      getBaseUrl(req);

    const successUrl =
      `${baseUrl}/employer/shifts` +
      `?payment=success` +
      `&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      `${baseUrl}/employer/payments` +
      `?timesheet=${encodeURIComponent(
        timesheet.id
      )}` +
      `&payment=cancelled`;

    /*
     * --------------------------------------------------------
     * STANDARD STRIPE CHECKOUT
     * --------------------------------------------------------
     */

    const session =
      await stripe
        .checkout
        .sessions
        .create({
          mode:
            "payment",

          success_url:
            successUrl,

          cancel_url:
            cancelUrl,

          customer_email:
            user.email ||
            undefined,

          line_items: [
            {
              quantity: 1,

              price_data: {
                currency,

                unit_amount:
                  employerTotalCents,

                product_data: {
                  name:
                    shift.title ||
                    "CareStaffing healthcare shift",

                  description:
                    `Approved CareStaffing timesheet • ` +
                    `${Number(
                      timesheet.hours_worked ||
                        0
                    ).toFixed(
                      2
                    )} hours`,
                },
              },
            },
          ],

          /*
           * Standard PaymentIntent.
           * Metadata only.
           */
          payment_intent_data:
            {
              metadata: {
                carestaffing:
                  "true",

                payment_model:
                  "single_platform_payment",

                timesheet_id:
                  timesheet.id,

                shift_id:
                  timesheet.shift_id,

                professional_id:
                  timesheet.locum_id,

                employer_id:
                  user.id,
              },
            },

          metadata: {
            carestaffing:
              "true",

            payment_model:
              "single_platform_payment",

            timesheet_id:
              timesheet.id,

            shift_id:
              timesheet.shift_id,

            professional_id:
              timesheet.locum_id,

            employer_id:
              user.id,

            employer_total:
              employerTotal.toFixed(
                2
              ),

            platform_fee:
              platformFee.toFixed(
                2
              ),

            professional_amount:
              professionalAmount.toFixed(
                2
              ),
          },
        });

    /*
     * --------------------------------------------------------
     * SAVE PAYMENT RECORD
     * --------------------------------------------------------
     */

    const paymentPayload =
      {
        timesheet_id:
          timesheet.id,

        shift_id:
          timesheet.shift_id,

        employer_id:
          user.id,

        /*
         * Keep this column name because
         * your current database uses it.
         */
        locum_id:
          timesheet.locum_id,

        gross_amount:
          employerTotal,

        employer_total:
          employerTotal,

        platform_fee:
          platformFee,

        locum_amount:
          professionalAmount,

        /*
         * Stripe payment not completed yet.
         */
        payment_status:
          "pending",

        /*
         * Professional settlement
         * happens separately.
         */
        payout_status:
          "pending",

        stripe_checkout_session_id:
          session.id,

        stripe_payment_intent_id:
          typeof session.payment_intent ===
          "string"
            ? session.payment_intent
            : null,

        updated_at:
          new Date().toISOString(),
      };

    let paymentId:
      | string
      | null = null;

    /*
     * --------------------------------------------------------
     * UPDATE EXISTING ATTEMPT
     * --------------------------------------------------------
     */

    if (existingPayment) {
      const {
        data:
          updatedPayment,
        error:
          updatePaymentError,
      } =
        await supabase
          .from("payments")
          .update(
            paymentPayload
          )
          .eq(
            "id",
            existingPayment.id
          )
          .select("id")
          .single();

      if (
        updatePaymentError
      ) {
        throw updatePaymentError;
      }

      paymentId =
        updatedPayment.id;
    } else {
      /*
       * ------------------------------------------------------
       * INSERT NEW PAYMENT
       * ------------------------------------------------------
       */

      const {
        data:
          insertedPayment,
        error:
          insertPaymentError,
      } =
        await supabase
          .from("payments")
          .insert(
            paymentPayload
          )
          .select("id")
          .single();

      if (
        insertPaymentError
      ) {
        throw insertPaymentError;
      }

      paymentId =
        insertedPayment.id;
    }

    /*
     * --------------------------------------------------------
     * RETURN CHECKOUT URL
     * --------------------------------------------------------
     */

    return NextResponse.json(
      {
        success: true,

        paymentModel:
          "single_platform_payment",

        paymentId,

        checkoutSessionId:
          session.id,

        url:
          session.url,

        amounts: {
          employerTotal,
          platformFee,
          professionalAmount,
          currency:
            currency.toUpperCase(),
        },
      }
    );
  } catch (error) {
    console.error(
      "CareStaffing Stripe Checkout error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create Stripe Checkout session.",
      },
      {
        status: 500,
      }
    );
  }
}
