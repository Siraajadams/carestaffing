import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanEnv(value?: string) {
  return (value || "")
    .trim()
    .replace(/[\r\n\t]/g, "");
}

const stripeSecretKey = cleanEnv(process.env.STRIPE_SECRET_KEY);
const supabaseUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseServiceRoleKey = cleanEnv(
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getStripe() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing.");
  }

  return new Stripe(stripeSecretKey);
}

function getAdminSupabase() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getUser(req: NextRequest) {
  const header = req.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    throw new Error("AUTH_HEADER_MISSING");
  }

  const token = header.substring(7).trim();

  if (!token) {
    throw new Error("AUTH_TOKEN_MISSING");
  }

  const supabase = getAdminSupabase();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error) {
    console.error("Supabase auth error:", error);
    throw new Error(`AUTH_FAILED: ${error.message}`);
  }

  if (!user) {
    throw new Error("AUTH_FAILED: User not found.");
  }

  return user;
}

function getBaseUrl(req: NextRequest) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (configured) {
    const clean = configured.trim().replace(/\/+$/, "");

    if (
      clean.startsWith("https://") ||
      clean.startsWith("http://")
    ) {
      return clean;
    }

    return `https://${clean}`;
  }

  return req.nextUrl.origin;
}

function getCurrency(shift: any) {
  const value = String(shift?.currency || "ZAR")
    .trim()
    .toLowerCase();

  if (value === "zar") return "zar";
  if (value === "gbp") return "gbp";
  if (value === "nzd") return "nzd";
  if (value === "eur") return "eur";

  return "zar";
}

function calculateAmount(timesheet: any, shift: any) {
  // First preference: amount already saved on timesheet
  const storedTotal = Number(timesheet?.total_amount || 0);

  if (storedTotal > 0) {
    return storedTotal;
  }

  // Second preference: approved/agreed rate x hours
  const hours = Number(timesheet?.hours_worked || 0);

  const agreedRate = Number(timesheet?.agreed_rate || 0);

  if (hours > 0 && agreedRate > 0) {
    return hours * agreedRate;
  }

  // Third preference: shift hourly rate
  const hourlyRate = Number(shift?.hourly_rate || 0);

  if (hours > 0 && hourlyRate > 0) {
    return hours * hourlyRate;
  }

  // Last fallback: shift/locum rate
  const shiftRate = Number(
    shift?.locum_rate ||
      shift?.rate ||
      0
  );

  if (shiftRate > 0) {
    return shiftRate;
  }

  return 0;
}

export async function POST(req: NextRequest) {
  let stage = "starting";

  try {
    console.log("====================================");
    console.log("CARESTAFFING SINGLE STRIPE CHECKOUT");
    console.log("====================================");

    /*
     * --------------------------------------------------------
     * 1. ENVIRONMENT
     * --------------------------------------------------------
     */

    stage = "environment";

    console.log("Environment:", {
      stripeConfigured: Boolean(stripeSecretKey),
      stripePrefix: stripeSecretKey
        ? stripeSecretKey.substring(0, 7)
        : "missing",
      supabaseUrlConfigured: Boolean(supabaseUrl),
      serviceRoleConfigured: Boolean(supabaseServiceRoleKey),
    });

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }

    /*
     * --------------------------------------------------------
     * 2. AUTHENTICATION
     * --------------------------------------------------------
     */

    stage = "authentication";

    const user = await getUser(req);

    console.log("Authenticated employer:", {
      id: user.id,
      email: user.email,
    });

    /*
     * --------------------------------------------------------
     * 3. REQUEST BODY
     * --------------------------------------------------------
     */

    stage = "request_body";

    const body = await req.json().catch(() => ({}));

    console.log("Checkout request body:", body);

    const timesheetId = String(
      body?.timesheetId ||
        body?.timesheet_id ||
        ""
    ).trim();

    if (!timesheetId) {
      throw new Error("timesheetId was not supplied.");
    }

    console.log("Timesheet:", timesheetId);

    const supabase = getAdminSupabase();

    /*
     * --------------------------------------------------------
     * 4. LOAD TIMESHEET
     * --------------------------------------------------------
     */

    stage = "load_timesheet";

    const {
      data: timesheet,
      error: timesheetError,
    } = await supabase
      .from("timesheets")
      .select("*")
      .eq("id", timesheetId)
      .maybeSingle();

    if (timesheetError) {
      console.error("Timesheet query error:", timesheetError);

      throw new Error(
        `TIMESHEET_QUERY_FAILED: ${timesheetError.message}`
      );
    }

    if (!timesheet) {
      throw new Error("TIMESHEET_NOT_FOUND");
    }

    console.log("Timesheet loaded:", {
      id: timesheet.id,
      shift_id: timesheet.shift_id,
      locum_id: timesheet.locum_id,
      status: timesheet.status,
      hours_worked: timesheet.hours_worked,
      total_amount: timesheet.total_amount,
      agreed_rate: timesheet.agreed_rate,
    });

    /*
     * --------------------------------------------------------
     * 5. CHECK STATUS
     * --------------------------------------------------------
     */

    stage = "check_timesheet_status";

    const status = String(timesheet.status || "")
      .trim()
      .toLowerCase();

    if (status !== "approved") {
      throw new Error(
        `TIMESHEET_NOT_APPROVED: Current status is "${status}".`
      );
    }

    if (!timesheet.shift_id) {
      throw new Error("TIMESHEET_HAS_NO_SHIFT_ID");
    }

    /*
     * --------------------------------------------------------
     * 6. LOAD SHIFT
     * --------------------------------------------------------
     */

    stage = "load_shift";

    const {
      data: shift,
      error: shiftError,
    } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", timesheet.shift_id)
      .maybeSingle();

    if (shiftError) {
      console.error("Shift query error:", shiftError);

      throw new Error(
        `SHIFT_QUERY_FAILED: ${shiftError.message}`
      );
    }

    if (!shift) {
      throw new Error("SHIFT_NOT_FOUND");
    }

    console.log("Shift loaded:", {
      id: shift.id,
      title: shift.title,
      created_by: shift.created_by,
      company_id: shift.company_id,
      hourly_rate: shift.hourly_rate,
      locum_rate: shift.locum_rate,
      currency: shift.currency,
    });

    /*
     * --------------------------------------------------------
     * 7. EMPLOYER AUTHORIZATION
     * --------------------------------------------------------
     */

    stage = "employer_authorization";

    let employerAuthorised =
      shift.created_by === user.id;

    if (!employerAuthorised && shift.company_id) {
      const {
        data: company,
        error: companyError,
      } = await supabase
        .from("companies")
        .select("*")
        .eq("id", shift.company_id)
        .maybeSingle();

      if (companyError) {
        console.error("Company query error:", companyError);

        throw new Error(
          `COMPANY_QUERY_FAILED: ${companyError.message}`
        );
      }

      console.log("Company:", {
        id: company?.id,
        owner_id: company?.owner_id,
      });

      if (company?.owner_id === user.id) {
        employerAuthorised = true;
      }
    }

    if (!employerAuthorised) {
      throw new Error(
        "EMPLOYER_NOT_AUTHORISED_FOR_SHIFT"
      );
    }

    /*
     * --------------------------------------------------------
     * 8. AMOUNT
     * --------------------------------------------------------
     */

    stage = "calculate_amount";

    const amount = Number(
      calculateAmount(timesheet, shift).toFixed(2)
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        `INVALID_PAYMENT_AMOUNT: ${amount}`
      );
    }

    const amountCents = Math.round(amount * 100);

    const platformFee = Number(
      (amount * 0.1).toFixed(2)
    );

    const locumAmount = Number(
      (amount - platformFee).toFixed(2)
    );

    const currency = getCurrency(shift);

    console.log("Payment calculation:", {
      amount,
      amountCents,
      platformFee,
      locumAmount,
      currency,
    });

    /*
     * --------------------------------------------------------
     * 9. CREATE STRIPE CHECKOUT
     * --------------------------------------------------------
     */

    stage = "stripe_checkout";

    const stripe = getStripe();

    const baseUrl = getBaseUrl(req);

    console.log("Creating normal Stripe Checkout...");

    console.log("Base URL:", baseUrl);

    /*
     * IMPORTANT:
     *
     * This is a STANDARD STRIPE PAYMENT.
     *
     * There is:
     * - NO Stripe Connect
     * - NO destination
     * - NO transfer_data
     * - NO application_fee_amount
     * - NO locum Stripe account
     */

    const session = await stripe.checkout.sessions.create({
  mode: "payment",

  payment_method_types: ["card"],

  // Allows employer to enter CAREPON or another promo code
  allow_promotion_codes: true,

  line_items: [
          quantity: 1,

          price_data: {
            currency,

            unit_amount: amountCents,

            product_data: {
              name:
                shift.title ||
                "CareStaffing Shift Payment",

              description:
                "Approved CareStaffing invoice",
            },
          },
        },
      ],

      customer_email: user.email || undefined,

      metadata: {
        platform: "carestaffing",
        payment_model: "single_payment",

        timesheet_id: String(timesheet.id),

        shift_id: String(timesheet.shift_id),

        employer_id: String(user.id),

        locum_id: String(timesheet.locum_id || ""),

        gross_amount: amount.toFixed(2),

        platform_fee: platformFee.toFixed(2),

        locum_amount: locumAmount.toFixed(2),
      },

      success_url:
        `${baseUrl}/employer/payments` +
        `?timesheet=${encodeURIComponent(timesheet.id)}` +
        `&payment=success` +
        `&session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${baseUrl}/employer/payments` +
        `?timesheet=${encodeURIComponent(timesheet.id)}` +
        `&payment=cancelled`,
    });

    console.log("STRIPE CHECKOUT CREATED:", {
      id: session.id,
      urlAvailable: Boolean(session.url),
      paymentStatus: session.payment_status,
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

    return NextResponse.json({
      success: true,

      paymentModel: "single_payment",

      checkoutSessionId: session.id,

      url: session.url,

      amounts: {
        employerPays: amount,
        platformFee,
        locumAmount,
        currency: currency.toUpperCase(),
      },
    });
  } catch (error: any) {
    /*
     * --------------------------------------------------------
     * DETAILED ERROR
     * --------------------------------------------------------
     */

    console.error("====================================");
    console.error("STRIPE CHECKOUT FAILURE");
    console.error("Stage:", stage);
    console.error("Error:", error);
    console.error("====================================");

    const message =
      error?.message ||
      "Could not create Stripe Checkout session.";

    const stripeType =
      error?.type ||
      null;

    const stripeCode =
      error?.code ||
      null;

    const stripeParam =
      error?.param ||
      null;

    return NextResponse.json(
      {
        success: false,

        error: message,

        stage,

        stripe: {
          type: stripeType,
          code: stripeCode,
          param: stripeParam,
        },
      },
      {
        status:
          message.includes("AUTH_")
            ? 401
            : 500,
      }
    );
  }
}
