import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * ============================================================
 * ENVIRONMENT VARIABLES
 * ============================================================
 */

const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY || "";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const supabaseSecretKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const stripe = new Stripe(stripeSecretKey);

/*
 * ============================================================
 * SUPABASE ADMIN CLIENT
 * ============================================================
 */

function getAdminSupabase() {
  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not configured."
    );
  }

  if (!supabaseSecretKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseSecretKey,
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

  console.log(
    "Stripe checkout auth header present:",
    Boolean(authorization)
  );

  if (!authorization) {
    console.error(
      "Stripe checkout: Authorization header missing."
    );

    return {
      user: null,
      error:
        "Authorization header was not received.",
    };
  }

  if (
    !authorization.startsWith("Bearer ")
  ) {
    console.error(
      "Stripe checkout: Authorization header is not Bearer."
    );

    return {
      user: null,
      error:
        "Invalid Authorization header.",
    };
  }

  const accessToken =
    authorization
      .substring(7)
      .trim();

  if (!accessToken) {
    console.error(
      "Stripe checkout: Bearer token is empty."
    );

    return {
      user: null,
      error:
        "Authentication token was empty.",
    };
  }

  console.log(
    "Stripe checkout token received:",
    accessToken.length,
    "characters"
  );

  const supabase =
    getAdminSupabase();

  /*
   * IMPORTANT
   *
   * getUser(accessToken) asks Supabase Auth to
   * validate the logged-in user's JWT.
   */
  const {
    data,
    error,
  } =
    await supabase.auth.getUser(
      accessToken
    );

  if (error) {
    console.error(
      "Supabase getUser failed:",
      error.message,
      error.status
    );

    return {
      user: null,
      error:
        error.message ||
        "Supabase rejected the login token.",
    };
  }

  if (!data?.user) {
    console.error(
      "Supabase returned no authenticated user."
    );

    return {
      user: null,
      error:
        "Supabase returned no authenticated user.",
    };
  }

  console.log(
    "Stripe employer authenticated:",
    data.user.id,
    data.user.email
  );

  return {
    user: data.user,
    error: null,
  };
}

/*
 * ============================================================
 * APP URL
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
      configured.replace(
        /\/+$/,
        ""
      );

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

function toCents(
  value: number
) {
  return Math.round(
    value * 100
  );
}

function calculateInvoiceTotal(
  timesheet: any,
  shift: any
) {
  /*
   * Prefer final approved timesheet total.
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
   * Otherwise calculate from approved
   * hours × agreed rate.
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
  const locumRate =
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
      locumRate *
      hoursWorked
    );
  }

  return locumRate;
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
     * CHECK ENVIRONMENT
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
      !supabaseSecretKey
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
      console.error(
        "Employer authentication rejected:",
        auth.error
      );

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
      await req.json();

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

    console.log(
      "Stripe checkout timesheet:",
      timesheetId
    );

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
      console.error(
        "Timesheet lookup error:",
        timesheetError
      );

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
     * MUST BE APPROVED
     * --------------------------------------------------------
     */

    const timesheetStatus =
      String(
        timesheet.status ||
          ""
      ).toLowerCase();

    if (
      timesheetStatus !==
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

    if (
      !timesheet.shift_id
    ) {
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

    if (
      !timesheet.locum_id
    ) {
      return NextResponse.json(
        {
          error:
            "Timesheet has no locum linked to it.",
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
      console.error(
        "Shift lookup error:",
        shiftError
      );

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
     * EMPLOYER SECURITY CHECK
     * --------------------------------------------------------
     *
     * The authenticated employer must either:
     *
     * 1. have created the shift; OR
     * 2. own the company attached to the shift.
     */

    let employerAuthorised =
      shift.created_by ===
      user.id;

    console.log(
      "Shift creator:",
      shift.created_by
    );

    console.log(
      "Logged employer:",
      user.id
    );

    console.log(
      "Company ID:",
      shift.company_id
    );

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
        console.error(
          "Company lookup error:",
          companyError
        );

        throw companyError;
      }

      console.log(
        "Company owner:",
        company?.owner_id
      );

      employerAuthorised =
        company?.owner_id ===
        user.id;
    }

    if (
      !employerAuthorised
    ) {
      return NextResponse.json(
        {
          error:
            "You are not authorised to pay this timesheet.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * LOCUM PROFILE
     * --------------------------------------------------------
     */

    const {
      data: locumProfile,
      error:
        locumProfileError,
    } =
      await supabase
        .from("profiles")
        .select("*")
        .eq(
          "id",
          timesheet.locum_id
        )
        .maybeSingle();

    if (
      locumProfileError
    ) {
      console.error(
        "Locum profile error:",
        locumProfileError
      );

      throw locumProfileError;
    }

    if (!locumProfile) {
      return NextResponse.json(
        {
          error:
            "Locum profile could not be found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * STRIPE CONNECT
     * --------------------------------------------------------
     */

    if (
      !locumProfile
        .stripe_account_id
    ) {
      return NextResponse.json(
        {
          error:
            "The locum has not completed Stripe payout onboarding yet.",

          code:
            "LOCUM_STRIPE_NOT_CONNECTED",
        },
        {
          status: 400,
        }
      );
    }

    let connectedAccount:
      Stripe.Account;

    try {
      connectedAccount =
        await stripe.accounts.retrieve(
          locumProfile
            .stripe_account_id
        );
    } catch (stripeAccountError) {
      console.error(
        "Stripe Connect account lookup error:",
        stripeAccountError
      );

      return NextResponse.json(
        {
          error:
            "The locum Stripe Connect account could not be verified.",

          code:
            "LOCUM_STRIPE_ACCOUNT_INVALID",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Stripe normally requires both
     * charges and payouts capability.
     */

    if (
      !connectedAccount
        .payouts_enabled
    ) {
      return NextResponse.json(
        {
          error:
            "The locum Stripe account is not ready to receive payouts.",

          code:
            "LOCUM_PAYOUTS_NOT_ENABLED",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * INVOICE AMOUNT
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
     * CARESTAFFING 10 / 90 SPLIT
     * --------------------------------------------------------
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

    const locumAmountCents =
      employerTotalCents -
      platformFeeCents;

    const employerTotal =
      employerTotalCents /
      100;

    const platformFee =
      platformFeeCents /
      100;

    const locumAmount =
      locumAmountCents /
      100;

    /*
     * --------------------------------------------------------
     * CURRENCY
     * --------------------------------------------------------
     */

    const currency =
      String(
        shift.currency ||
          "ZAR"
      ).toLowerCase();

    /*
     * --------------------------------------------------------
     * CHECK EXISTING PAYMENT
     * --------------------------------------------------------
     */

    const {
      data:
        existingPayment,
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
     * URLS
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
     * CREATE STRIPE CHECKOUT
     * --------------------------------------------------------
     */

    const session =
      await stripe
        .checkout
        .sessions
        .create({
          mode: "payment",

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

                product_data:
                  {
                    name:
                      shift.title ||
                      "CareStaffing locum shift",

                    description:
                      `Approved locum timesheet • ` +
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
           * Stripe Connect destination charge
           *
           * Employer pays full amount.
           * CareStaffing keeps 10%.
           * Remaining 90% transfers to locum.
           */
          payment_intent_data:
            {
              application_fee_amount:
                platformFeeCents,

              transfer_data:
                {
                  destination:
                    locumProfile
                      .stripe_account_id,
                },

              metadata: {
                carestaffing:
                  "true",

                timesheet_id:
                  timesheet.id,

                shift_id:
                  timesheet.shift_id,

                locum_id:
                  timesheet.locum_id,

                employer_id:
                  user.id,
              },
            },

          metadata: {
            carestaffing:
              "true",

            timesheet_id:
              timesheet.id,

            shift_id:
              timesheet.shift_id,

            locum_id:
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

            locum_amount:
              locumAmount.toFixed(
                2
              ),
          },
        });

    /*
     * --------------------------------------------------------
     * SAVE PENDING PAYMENT
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

        locum_id:
          timesheet.locum_id,

        gross_amount:
          employerTotal,

        employer_total:
          employerTotal,

        platform_fee:
          platformFee,

        locum_amount:
          locumAmount,

        payment_status:
          "pending",

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
     * Existing pending attempt:
     * update rather than duplicate.
     */
    if (
      existingPayment
    ) {
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
     * SUCCESS
     * --------------------------------------------------------
     */

    console.log(
      "Stripe checkout created:",
      session.id
    );

    console.log(
      "Employer total:",
      employerTotal
    );

    console.log(
      "CareStaffing fee:",
      platformFee
    );

    console.log(
      "Locum amount:",
      locumAmount
    );

    return NextResponse.json(
      {
        success: true,

        paymentId,

        checkoutSessionId:
          session.id,

        url:
          session.url,

        amounts: {
          employerTotal,
          platformFee,
          locumAmount,
          currency:
            currency.toUpperCase(),
        },
      }
    );
  } catch (error) {
    console.error(
      "CREATE CHECKOUT ERROR:",
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
