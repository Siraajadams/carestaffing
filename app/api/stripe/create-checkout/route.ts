import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = new Stripe(stripeSecretKey || "");

function getAdminSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase server environment variables are not configured.");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) return null;

  const supabase = getAdminSupabase();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

function getBaseUrl(req: NextRequest) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (configured) {
    const clean = configured.replace(/\/+$/, "");

    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      return clean;
    }

    return `https://${clean}`;
  }

  return req.nextUrl.origin;
}

function toCents(value: number) {
  return Math.round(value * 100);
}

function calculateLocumAmount(timesheet: any, shift: any) {
  const storedTotal = Number(timesheet.total_amount || 0);

  if (storedTotal > 0) {
    return storedTotal;
  }

  const agreedRate = Number(timesheet.agreed_rate || 0);
  const hoursWorked = Number(timesheet.hours_worked || 0);

  if (agreedRate > 0 && hoursWorked > 0) {
    return agreedRate * hoursWorked;
  }

  const locumRate = Number(shift.locum_rate || shift.hourly_rate || 0);
  const rateType = String(shift.rate_type || "hourly").toLowerCase();

  if (rateType === "hourly" && hoursWorked > 0) {
    return locumRate * hoursWorked;
  }

  return locumRate;
}

export async function POST(req: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "Stripe is not configured on the server." },
        { status: 500 }
      );
    }

    const user = await getAuthenticatedUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorised." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const timesheetId = String(body.timesheetId || "").trim();

    if (!timesheetId) {
      return NextResponse.json(
        { error: "timesheetId is required." },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();

    const { data: timesheet, error: timesheetError } = await supabase
      .from("timesheets")
      .select("*")
      .eq("id", timesheetId)
      .maybeSingle();

    if (timesheetError) {
      throw timesheetError;
    }

    if (!timesheet) {
      return NextResponse.json(
        { error: "Timesheet not found." },
        { status: 404 }
      );
    }

    if (String(timesheet.status || "").toLowerCase() !== "approved") {
      return NextResponse.json(
        { error: "Only an approved timesheet can be paid." },
        { status: 400 }
      );
    }

    if (!timesheet.shift_id || !timesheet.locum_id) {
      return NextResponse.json(
        { error: "Timesheet is missing its shift or locum link." },
        { status: 400 }
      );
    }

    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", timesheet.shift_id)
      .maybeSingle();

    if (shiftError) {
      throw shiftError;
    }

    if (!shift) {
      return NextResponse.json(
        { error: "Shift not found." },
        { status: 404 }
      );
    }

    /*
     * Security:
     * Only the employer who created the shift, or the owner of the
     * company linked to the shift, may pay this invoice.
     */
    let employerAuthorised = shift.created_by === user.id;

    if (!employerAuthorised && shift.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("id, owner_id")
        .eq("id", shift.company_id)
        .maybeSingle();

      employerAuthorised = company?.owner_id === user.id;
    }

    if (!employerAuthorised) {
      return NextResponse.json(
        { error: "You are not authorised to pay this timesheet." },
        { status: 403 }
      );
    }

    const { data: locumProfile, error: locumProfileError } =
      await supabase
        .from("profiles")
        .select("*")
        .eq("id", timesheet.locum_id)
        .maybeSingle();

    if (locumProfileError) {
      throw locumProfileError;
    }

    if (!locumProfile?.stripe_account_id) {
      return NextResponse.json(
        {
          error:
            "The locum has not completed Stripe payout onboarding yet.",
          code: "LOCUM_STRIPE_NOT_CONNECTED",
        },
        { status: 400 }
      );
    }

    const connectedAccount = await stripe.accounts.retrieve(
      locumProfile.stripe_account_id
    );

    if (connectedAccount.deleted) {
      return NextResponse.json(
        { error: "The locum Stripe account is no longer available." },
        { status: 400 }
      );
    }

    if (!connectedAccount.payouts_enabled) {
      return NextResponse.json(
        {
          error:
            "The locum Stripe account is not ready to receive payouts.",
          code: "LOCUM_PAYOUTS_NOT_ENABLED",
        },
        { status: 400 }
      );
    }

    const locumAmount = Number(
      calculateLocumAmount(timesheet, shift).toFixed(2)
    );

    if (!Number.isFinite(locumAmount) || locumAmount <= 0) {
      return NextResponse.json(
        { error: "The approved timesheet has no payable amount." },
        { status: 400 }
      );
    }

    const platformFee = Number((locumAmount * 0.1).toFixed(2));
    const employerTotal = Number(
      (locumAmount + platformFee).toFixed(2)
    );

    const currency = String(shift.currency || "ZAR").toLowerCase();

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("*")
      .eq("timesheet_id", timesheet.id)
      .maybeSingle();

    if (
      existingPayment &&
      ["paid", "succeeded"].includes(
        String(existingPayment.payment_status || "").toLowerCase()
      )
    ) {
      return NextResponse.json(
        {
          error: "This invoice has already been paid.",
          paymentId: existingPayment.id,
        },
        { status: 409 }
      );
    }

    const baseUrl = getBaseUrl(req);

    const successUrl =
      `${baseUrl}/employer/shifts?payment=success` +
      `&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      `${baseUrl}/employer/shifts?payment=cancelled` +
      `&timesheet_id=${encodeURIComponent(timesheet.id)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      success_url: successUrl,
      cancel_url: cancelUrl,

      customer_email:
        user.email || undefined,

      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: toCents(employerTotal),
            product_data: {
              name:
                shift.title ||
                "CareStaffing locum shift",
              description:
                `Approved locum timesheet • ` +
                `${Number(timesheet.hours_worked || 0).toFixed(2)} hours`,
            },
          },
        },
      ],

      payment_intent_data: {
        application_fee_amount: toCents(platformFee),
        transfer_data: {
          destination: locumProfile.stripe_account_id,
        },
        metadata: {
          caresstaffing: "true",
          timesheet_id: timesheet.id,
          shift_id: timesheet.shift_id,
          locum_id: timesheet.locum_id,
          employer_id: user.id,
        },
      },

      metadata: {
        caresstaffing: "true",
        timesheet_id: timesheet.id,
        shift_id: timesheet.shift_id,
        locum_id: timesheet.locum_id,
        employer_id: user.id,
        locum_amount: locumAmount.toFixed(2),
        platform_fee: platformFee.toFixed(2),
        employer_total: employerTotal.toFixed(2),
      },
    });

    const paymentPayload = {
      timesheet_id: timesheet.id,
      shift_id: timesheet.shift_id,
      employer_id: user.id,
      locum_id: timesheet.locum_id,

      gross_amount: locumAmount,
      locum_amount: locumAmount,
      platform_fee: platformFee,
      employer_total: employerTotal,

      payment_status: "pending",
      payout_status: "pending",

      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,

      updated_at: new Date().toISOString(),
    };

    let paymentId: string | null = null;

    if (existingPayment) {
      const { data: updatedPayment, error: updateError } =
        await supabase
          .from("payments")
          .update(paymentPayload)
          .eq("id", existingPayment.id)
          .select("id")
          .single();

      if (updateError) {
        throw updateError;
      }

      paymentId = updatedPayment.id;
    } else {
      const { data: insertedPayment, error: insertError } =
        await supabase
          .from("payments")
          .insert(paymentPayload)
          .select("id")
          .single();

      if (insertError) {
        throw insertError;
      }

      paymentId = insertedPayment.id;
    }

    return NextResponse.json({
      success: true,
      paymentId,
      checkoutSessionId: session.id,
      url: session.url,
      amounts: {
        locumAmount,
        platformFee,
        employerTotal,
        currency: currency.toUpperCase(),
      },
    });
  } catch (error) {
    console.error("Stripe checkout creation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create Stripe Checkout session.",
      },
      { status: 500 }
    );
  }
}
