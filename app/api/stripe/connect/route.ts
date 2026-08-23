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
  (process.env.STRIPE_SECRET_KEY || "").trim();

const supabaseUrl =
  (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();

const supabaseServiceRoleKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || "")
    .trim()
    .replace(/[\r\n]/g, "");

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
 * AUTH
 * ============================================================
 */

async function getAuthenticatedUser(
  req: NextRequest
) {
  const authHeader =
    req.headers.get("authorization");

  if (!authHeader) {
    return {
      user: null,
      error:
        "Authorization header was not received.",
    };
  }

  if (
    !authHeader.startsWith("Bearer ")
  ) {
    return {
      user: null,
      error:
        "Authorization header is not a Bearer token.",
    };
  }

  const token =
    authHeader
      .slice("Bearer ".length)
      .trim();

  if (!token) {
    return {
      user: null,
      error:
        "Authentication token is empty.",
    };
  }

  const supabase =
    getAdminSupabase();

  const {
    data: { user },
    error,
  } =
    await supabase.auth.getUser(
      token
    );

  if (error || !user) {
    console.error(
      "Stripe Connect Supabase authentication failed:",
      error
    );

    return {
      user: null,
      error:
        error?.message ||
        "Supabase rejected the authentication token.",
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
 * COUNTRY
 * ============================================================
 *
 * Do NOT use:
 *
 * Stripe.AccountCreateParams.Country
 *
 * Some Stripe SDK versions do not export that type.
 */

function stripeCountry(
  country?: string | null
): "ZA" | "GB" | "NZ" | "IE" {
  switch (
    (country || "")
      .trim()
      .toLowerCase()
  ) {
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

/*
 * ============================================================
 * STRIPE ACCOUNT STATUS
 * ============================================================
 */

function getStripeAccountStatus(
  account: Stripe.Account
) {
  const currentlyDue =
    account.requirements
      ?.currently_due || [];

  const eventuallyDue =
    account.requirements
      ?.eventually_due || [];

  const pastDue =
    account.requirements
      ?.past_due || [];

  const requirementsComplete =
    Boolean(
      account.details_submitted &&
        currentlyDue.length === 0
    );

  const payoutsEnabled =
    Boolean(
      account.payouts_enabled
    );

  const chargesEnabled =
    Boolean(
      account.charges_enabled
    );

  const fullyReady =
    requirementsComplete &&
    payoutsEnabled;

  return {
    requirementsComplete,
    payoutsEnabled,
    chargesEnabled,
    fullyReady,
    currentlyDue,
    eventuallyDue,
    pastDue,
  };
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
     * AUTHENTICATE USER
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

    const supabase =
      getAdminSupabase();

    /*
     * --------------------------------------------------------
     * LOAD PROFILE
     * --------------------------------------------------------
     */

    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select("*")
        .eq(
          "id",
          user.id
        )
        .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json(
        {
          error:
            "Healthcare professional profile not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * ROLE CHECK
     * --------------------------------------------------------
     */

    const role =
      String(
        profile.role ||
          profile.account_type ||
          profile.user_type ||
          ""
      )
        .trim()
        .toLowerCase();

    const payoutRecipientRoles =
      [
        "locum",
        "healthcare professional",
        "healthcare_professional",
        "professional",
        "worker",
        "provider",
        "doctor",
        "pharmacist",
        "nurse",
        "physiotherapist",
        "biokinetist",
      ];

    if (
      role &&
      !payoutRecipientRoles.includes(
        role
      )
    ) {
      return NextResponse.json(
        {
          error:
            "This account type is not configured to receive CareStaffing payouts.",
        },
        {
          status: 403,
        }
      );
    }

    /*
     * --------------------------------------------------------
     * REQUEST BODY
     * --------------------------------------------------------
     */

    const body =
      await req
        .json()
        .catch(() => ({}));

    const baseUrl =
      getBaseUrl(req);

    const refreshUrl =
      typeof body.refreshUrl ===
        "string" &&
      body.refreshUrl.trim()
        ? body.refreshUrl.trim()
        : `${baseUrl}/profile?stripe=refresh`;

    const returnUrl =
      typeof body.returnUrl ===
        "string" &&
      body.returnUrl.trim()
        ? body.returnUrl.trim()
        : `${baseUrl}/profile?stripe=connected`;

    /*
     * --------------------------------------------------------
     * EXISTING STRIPE ACCOUNT ID
     * --------------------------------------------------------
     */

    let accountId =
      profile.stripe_account_id
        ? String(
            profile.stripe_account_id
          ).trim()
        : "";

    let account:
      Stripe.Account;

    /*
     * --------------------------------------------------------
     * CREATE STRIPE EXPRESS ACCOUNT
     * --------------------------------------------------------
     */

    if (!accountId) {
      const fullName =
        [
          profile.first_name,
          profile.surname,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

      account =
        await stripe.accounts.create(
          {
            type: "express",

            country:
              stripeCountry(
                profile.country
              ),

            email:
              profile.email ||
              user.email ||
              undefined,

            business_type:
              "individual",

            capabilities: {
              transfers: {
                requested: true,
              },
            },

            business_profile: {
              product_description:
                "Healthcare professional services provided through CareStaffing.",
            },

            metadata: {
              carestaffing:
                "true",

              carestaffing_user_id:
                user.id,

              profile_id:
                user.id,

              full_name:
                fullName ||
                "Healthcare Professional",
            },
          }
        );

      accountId =
        account.id;

      const status =
        getStripeAccountStatus(
          account
        );

      const {
        error: updateError,
      } =
        await supabase
          .from("profiles")
          .update({
            stripe_account_id:
              account.id,

            stripe_onboarding_complete:
              status.requirementsComplete,

            stripe_charges_enabled:
              status.chargesEnabled,

            stripe_payouts_enabled:
              status.payoutsEnabled,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            user.id
          );

      if (updateError) {
        throw updateError;
      }

      console.log(
        "Stripe Express account created:",
        account.id
      );
    } else {
      /*
       * --------------------------------------------------------
       * RETRIEVE EXISTING ACCOUNT
       * --------------------------------------------------------
       */

      try {
        account =
          await stripe.accounts.retrieve(
            accountId
          );
      } catch (error) {
        console.error(
          "Could not retrieve existing Stripe Connect account:",
          error
        );

        return NextResponse.json(
          {
            error:
              "The saved Stripe Connect account could not be found. The payout account may need to be reconnected.",

            code:
              "STRIPE_ACCOUNT_NOT_FOUND",
          },
          {
            status: 400,
          }
        );
      }

      const status =
        getStripeAccountStatus(
          account
        );

      const {
        error: updateError,
      } =
        await supabase
          .from("profiles")
          .update({
            stripe_onboarding_complete:
              status.requirementsComplete,

            stripe_charges_enabled:
              status.chargesEnabled,

            stripe_payouts_enabled:
              status.payoutsEnabled,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            user.id
          );

      if (updateError) {
        throw updateError;
      }

      /*
       * If already ready for payouts,
       * do not create another onboarding link.
       */
      if (status.fullyReady) {
        return NextResponse.json(
          {
            success: true,

            alreadyConnected:
              true,

            onboardingComplete:
              true,

            accountId:
              account.id,

            payoutsEnabled:
              status.payoutsEnabled,

            chargesEnabled:
              status.chargesEnabled,

            requirements: {
              currentlyDue:
                status.currentlyDue,

              eventuallyDue:
                status.eventuallyDue,

              pastDue:
                status.pastDue,
            },

            message:
              "Stripe payouts are already connected and ready.",
          }
        );
      }
    }

    /*
     * --------------------------------------------------------
     * CREATE ONBOARDING LINK
     * --------------------------------------------------------
     */

    const accountLink =
      await stripe.accountLinks.create(
        {
          account:
            accountId,

          refresh_url:
            refreshUrl,

          return_url:
            returnUrl,

          type:
            "account_onboarding",
        }
      );

    /*
     * --------------------------------------------------------
     * STATUS
     * --------------------------------------------------------
     */

    const latestStatus =
      getStripeAccountStatus(
        account
      );

    /*
     * --------------------------------------------------------
     * RETURN
     * --------------------------------------------------------
     */

    return NextResponse.json(
      {
        success: true,

        alreadyConnected:
          false,

        onboardingComplete:
          latestStatus.requirementsComplete,

        payoutsEnabled:
          latestStatus.payoutsEnabled,

        chargesEnabled:
          latestStatus.chargesEnabled,

        accountId,

        url:
          accountLink.url,

        expiresAt:
          accountLink.expires_at,

        requirements: {
          currentlyDue:
            latestStatus.currentlyDue,

          eventuallyDue:
            latestStatus.eventuallyDue,

          pastDue:
            latestStatus.pastDue,
        },

        message:
          "Stripe onboarding link created.",
      }
    );
  } catch (error) {
    console.error(
      "Stripe Connect onboarding error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create Stripe Connect onboarding link.",
      },
      {
        status: 500,
      }
    );
  }
}
