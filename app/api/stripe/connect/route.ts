import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not configured.");
}

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured."
  );
}

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

function stripeCountry(country?: string | null): string {
  switch ((country || "").trim().toLowerCase()) {
    case "south africa":
    case "za":
      return "ZA";
    case "united kingdom":
    case "uk":
    case "gb":
      return "GB";
    case "new zealand":
    case "nz":
      return "NZ";
    case "ireland":
    case "ie":
      return "IE";
    default:
      return "ZA";
  }
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

    const supabase = getAdminSupabase();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Locum profile not found." },
        { status: 404 }
      );
    }

    const role = String(
      profile.role ||
        profile.account_type ||
        profile.user_type ||
        ""
    )
      .trim()
      .toLowerCase();

    const locumRoles = [
      "locum",
      "healthcare professional",
      "healthcare_professional",
      "professional",
      "worker",
    ];

    if (role && !locumRoles.includes(role)) {
      return NextResponse.json(
        {
          error:
            "Only a locum / healthcare professional account can create a payout account.",
        },
        { status: 403 }
      );
    }

    let accountId = profile.stripe_account_id as string | null;

    if (!accountId) {
      const fullName = [
        profile.first_name,
        profile.surname,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const account = await stripe.accounts.create({
        type: "express",
        country: stripeCountry(profile.country),
        email: profile.email || user.email || undefined,
        business_type: "individual",
        capabilities: {
          transfers: {
            requested: true,
          },
        },
        business_profile: {
          product_description:
            "Healthcare locum services provided through CareStaffing.",
        },
        metadata: {
          caresstaffing_user_id: user.id,
          profile_id: user.id,
          full_name: fullName || "Healthcare Professional",
        },
      });

      accountId = account.id;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          stripe_account_id: account.id,
          stripe_onboarding_complete: false,
          stripe_charges_enabled: Boolean(account.charges_enabled),
          stripe_payouts_enabled: Boolean(account.payouts_enabled),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      const account = await stripe.accounts.retrieve(accountId);

      if (!account.deleted) {
        const requirementsComplete =
          account.details_submitted &&
          (!account.requirements?.currently_due ||
            account.requirements.currently_due.length === 0);

        await supabase
          .from("profiles")
          .update({
            stripe_onboarding_complete: Boolean(requirementsComplete),
            stripe_charges_enabled: Boolean(account.charges_enabled),
            stripe_payouts_enabled: Boolean(account.payouts_enabled),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
    }

    const body = await req.json().catch(() => ({}));

    const baseUrl = getBaseUrl(req);

    const refreshUrl =
      typeof body.refreshUrl === "string" && body.refreshUrl
        ? body.refreshUrl
        : `${baseUrl}/profile?stripe=refresh`;

    const returnUrl =
      typeof body.returnUrl === "string" && body.returnUrl
        ? body.returnUrl
        : `${baseUrl}/profile?stripe=connected`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json({
      success: true,
      accountId,
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
    });
  } catch (error) {
    console.error("Stripe Connect onboarding error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create Stripe Connect onboarding link.",
        },
      { status: 500 }
    );
  }
}
