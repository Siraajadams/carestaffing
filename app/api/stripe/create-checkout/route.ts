import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function cleanEnv(value?: string) {
  return (value || "")
    .trim()
    .replace(/[\r\n\t]/g, "");
}

/*
 * ============================================================
 * ENVIRONMENT
 * ============================================================
 */

const stripeSecretKey =
  cleanEnv(
    process.env.STRIPE_SECRET_KEY
  );

const supabaseUrl =
  cleanEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );

const supabaseServiceRoleKey =
  cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

/*
 * ============================================================
 * STRIPE
 * ============================================================
 */

function getStripe() {
  if (!stripeSecretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is missing."
    );
  }

  return new Stripe(
    stripeSecretKey
  );
}

/*
 * ============================================================
 * SUPABASE ADMIN
 * ============================================================
 */

function getAdminSupabase() {
  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing."
    );
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing."
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
    req.headers.get(
      "authorization"
    );

  if (
    !authorization?.startsWith(
      "Bearer "
    )
  ) {
    throw new Error(
      "AUTH_HEADER_MISSING"
    );
  }

  const accessToken =
    authorization
      .slice(
        "Bearer ".length
      )
      .trim();

  if (!accessToken) {
    throw new Error(
      "AUTH_TOKEN_MISSING"
    );
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

  if (error) {
    console.error(
      "Supabase authentication error:",
      error
    );

    throw new Error(
      `AUTH_FAILED: ${error.message}`
    );
  }

  if (!user) {
    throw new Error(
      "AUTH_FAILED: User not found."
    );
  }

  return user;
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
      configured
        .trim()
        .replace(
          /\/+$/,
          ""
        );

    if (
      clean.startsWith(
        "https://"
      ) ||
      clean.startsWith(
        "http://"
      )
    ) {
      return clean;
    }

    return `https://${clean}`;
  }

  return req.nextUrl.origin;
}

/*
 * ============================================================
 * CURRENCY
 * ============================================================
 */

function getCurrency(
  shift: any
) {
  const value =
    String(
      shift?.currency ||
        "ZAR"
    )
      .trim()
      .toLowerCase();

  if (value === "zar") {
    return "zar";
  }

  if (value === "gbp") {
    return "gbp";
  }

  if (value === "nzd") {
    return "nzd";
  }

  if (value === "eur") {
    return "eur";
  }

  return "zar";
}

/*
 * ============================================================
 * INVOICE AMOUNT
 * ============================================================
 */

function calculateInvoiceAmount(
  timesheet: any,
  shift: any
) {
  /*
   * Prefer stored approved amount.
   */
  const storedTotal =
    Number(
      timesheet?.total_amount ||
        0
    );

  if (storedTotal > 0) {
    return storedTotal;
  }

  /*
   * Otherwise use:
   * approved hours × agreed rate.
   */
  const hours =
    Number(
      timesheet?.hours_worked ||
        0
    );

  const agreedRate =
    Number(
      timesheet?.agreed_rate ||
        0
    );

  if (
    hours > 0 &&
    agreedRate > 0
  ) {
    return (
      hours *
      agreedRate
    );
  }

  /*
   * Fallback to shift hourly rate.
   */
  const hourlyRate =
    Number(
      shift?.hourly_rate ||
        0
    );

  if (
    hours > 0 &&
    hourlyRate > 0
  ) {
    return (
      hours *
      hourlyRate
    );
  }

  /*
   * Final fallback.
   */
  const shiftRate =
    Number(
      shift?.locum_rate ||
        shift?.rate ||
        0
    );

  return shiftRate;
}

/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(
  req: NextRequest
) {
  let stage =
    "starting";

  try {
    console.log(
      "===================================="
    );

    console.log(
      "CARESTAFFING STRIPE CHECKOUT"
    );

    console.log(
      "===================================="
    );

    /*
     * --------------------------------------------------------
     * 1. ENVIRONMENT
     * --------------------------------------------------------
     */

    stage =
      "environment";

    if (!stripeSecretKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is not configured."
      );
    }

    if (!supabaseUrl) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL is not configured."
      );
    }

    if (
      !supabaseServiceRoleKey
    ) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY is not configured."
      );
    }

    /*
     * --------------------------------------------------------
     * 2. AUTHENTICATION
     * --------------------------------------------------------
     */

    stage =
      "authentication";

    const user =
      await getAuthenticatedUser(
        req
      );

    console.log(
      "Employer authenticated:",
      user.id
    );

    /*
     * --------------------------------------------------------
     * 3. REQUEST
     * --------------------------------------------------------
     */

    stage =
      "request_body";

    const body =
      await req
        .json()
        .catch(
          () => ({})
        );

    const timesheetId =
      String(
        body?.timesheetId ||
          body?.timesheet_id ||
          ""
      ).trim();

    if (!timesheetId) {
      throw new Error(
        "timesheetId is required."
      );
    }

    const supabase =
      getAdminSupabase();

    /*
     * --------------------------------------------------------
     * 4. LOAD TIMESHEET
     * --------------------------------------------------------
     */

    stage =
      "load_timesheet";

    const {
      data: timesheet,
      error:
        timesheetError,
    } =
      await supabase
        .from("timesheets")
        .select("*")
        .eq(
          "id",
          timesheetId
        )
        .maybeSingle();

    if (
      timesheetError
    ) {
      throw new Error(
        `TIMESHEET_QUERY_FAILED: ${timesheetError.message}`
      );
    }

    if (!timesheet) {
      throw new Error(
        "TIMESHEET_NOT_FOUND"
      );
    }

    /*
     * --------------------------------------------------------
     * 5. APPROVAL CHECK
     * --------------------------------------------------------
     */

    stage =
      "check_timesheet_status";

    const status =
      String(
        timesheet.status ||
          ""
      )
        .trim()
        .toLowerCase();

    if (
      status !==
      "approved"
    ) {
      throw new Error(
        `TIMESHEET_NOT_APPROVED: ${status}`
      );
    }

    if (
      !timesheet.shift_id
    ) {
      throw new Error(
        "TIMESHEET_HAS_NO_SHIFT_ID"
      );
    }

    /*
     * --------------------------------------------------------
     * 6. LOAD SHIFT
     * --------------------------------------------------------
     */

    stage =
      "load_shift";

    const {
      data: shift,
      error:
        shiftError,
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
      throw new Error(
        `SHIFT_QUERY_FAILED: ${shiftError.message}`
      );
    }

    if (!shift) {
      throw new Error(
        "SHIFT_NOT_FOUND"
      );
    }

    /*
     * --------------------------------------------------------
     * 7. EMPLOYER AUTHORIZATION
     * --------------------------------------------------------
     */

    stage =
      "employer_authorization";

    let employerAuthorised =
      shift.created_by ===
      user.id;

    if (
      !employerAuthorised &&
      shift.company_id
    ) {
      const {
        data: company,
        error:
          companyError,
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

      if (
        companyError
      ) {
        throw new Error(
          `COMPANY_QUERY_FAILED: ${companyError.message}`
        );
      }

      if (
        company?.owner_id ===
        user.id
      ) {
        employerAuthorised =
          true;
      }
    }

    if (
      !employerAuthorised
    ) {
      throw new Error(
        "EMPLOYER_NOT_AUTHORISED_FOR_SHIFT"
      );
    }

    /*
     * --------------------------------------------------------
     * 8. AMOUNT
     * --------------------------------------------------------
     */

    stage =
      "calculate_amount";

    const amount =
      Number(
        calculateInvoiceAmount(
          timesheet,
          shift
        ).toFixed(2)
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      throw new Error(
        `INVALID_PAYMENT_AMOUNT: ${amount}`
      );
    }

    const amountCents =
      Math.round(
        amount *
        100
      );

    /*
     * Internal accounting only.
     */
    const platformFee =
      Number(
        (
          amount *
          0.1
        ).toFixed(2)
      );

    const professionalAmount =
      Number(
        (
          amount -
          platformFee
        ).toFixed(2)
      );

    const currency =
      getCurrency(
        shift
      );

    /*
     * --------------------------------------------------------
     * 9. STRIPE CHECKOUT
     * --------------------------------------------------------
     */

    stage =
      "stripe_checkout";

    const stripe =
      getStripe();

    const baseUrl =
      getBaseUrl(req);

    /*
     * ========================================================
     * NORMAL SINGLE PAYMENT
     * ========================================================
     *
     * Employer pays CareStaffing.
     *
     * No Stripe Connect.
     * No transfer_data.
     * No application_fee_amount.
     *
     * Promotion codes ARE enabled.
     */

    const session =
      await stripe
        .checkout
        .sessions
        .create({
          mode:
            "payment",

          /*
           * IMPORTANT:
           *
           * This makes the
           * "Add promotion code"
           * option appear in Checkout.
           */
          allow_promotion_codes:
            true,

          payment_method_types:
            [
              "card",
            ],

          line_items:
            [
              {
                quantity:
                  1,

                price_data:
                  {
                    currency,

                    unit_amount:
                      amountCents,

                    product_data:
                      {
                        name:
                          shift.title ||
                          "CareStaffing Shift Payment",

                        description:
                          "Approved CareStaffing invoice",
                      },
                  },
              },
            ],

          customer_email:
            user.email ||
            undefined,

          metadata:
            {
              platform:
                "carestaffing",

              payment_model:
                "single_payment",

              timesheet_id:
                String(
                  timesheet.id
                ),

              shift_id:
                String(
                  timesheet.shift_id
                ),

              employer_id:
                String(
                  user.id
                ),

              professional_id:
                String(
                  timesheet.locum_id ||
                    ""
                ),

              gross_amount:
                amount.toFixed(
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

          payment_intent_data:
            {
              metadata:
                {
                  platform:
                    "carestaffing",

                  payment_model:
                    "single_payment",

                  timesheet_id:
                    String(
                      timesheet.id
                    ),

                  shift_id:
                    String(
                      timesheet.shift_id
                    ),

                  employer_id:
                    String(
                      user.id
                    ),

                  professional_id:
                    String(
                      timesheet.locum_id ||
                        ""
                    ),
                },
            },

          success_url:
            `${baseUrl}/employer/payments` +
            `?timesheet=${encodeURIComponent(
              timesheet.id
            )}` +
            `&payment=success` +
            `&session_id={CHECKOUT_SESSION_ID}`,

          cancel_url:
            `${baseUrl}/employer/payments` +
            `?timesheet=${encodeURIComponent(
              timesheet.id
            )}` +
            `&payment=cancelled`,
        });

    if (!session.url) {
      throw new Error(
        "Stripe created the session but returned no checkout URL."
      );
    }

    /*
     * --------------------------------------------------------
     * SUCCESS
     * --------------------------------------------------------
     */

    return NextResponse.json(
      {
        success:
          true,

        paymentModel:
          "single_payment",

        checkoutSessionId:
          session.id,

        url:
          session.url,

        promotionCodesEnabled:
          true,

        amounts:
          {
            employerPays:
              amount,

            platformFee,

            professionalAmount,

            currency:
              currency.toUpperCase(),
          },
      }
    );
  } catch (
    error: any
  ) {
    console.error(
      "===================================="
    );

    console.error(
      "STRIPE CHECKOUT FAILURE"
    );

    console.error(
      "Stage:",
      stage
    );

    console.error(
      "Error:",
      error
    );

    console.error(
      "===================================="
    );

    const message =
      error?.message ||
      "Could not create Stripe Checkout session.";

    return NextResponse.json(
      {
        success:
          false,

        error:
          message,

        stage,

        stripe:
          {
            type:
              error?.type ||
              null,

            code:
              error?.code ||
              null,

            param:
              error?.param ||
              null,
          },
      },
      {
        status:
          message.includes(
            "AUTH_"
          )
            ? 401
            : 500,
      }
    );
  }
}
