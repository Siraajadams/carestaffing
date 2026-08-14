import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
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

async function markCheckoutPaid(session: Stripe.Checkout.Session) {
  const supabase = getAdminSupabase();

  let paymentIntentId: string | null = null;
  let chargeId: string | null = null;
  let transferId: string | null = null;

  if (typeof session.payment_intent === "string") {
    paymentIntentId = session.payment_intent;
  } else if (session.payment_intent?.id) {
    paymentIntentId = session.payment_intent.id;
  }

  if (paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        {
          expand: ["latest_charge"],
        }
      );

      if (typeof paymentIntent.latest_charge === "string") {
        chargeId = paymentIntent.latest_charge;
      } else if (paymentIntent.latest_charge) {
        chargeId = paymentIntent.latest_charge.id;

        const transfer = paymentIntent.latest_charge.transfer;

        if (typeof transfer === "string") {
          transferId = transfer;
        } else if (transfer?.id) {
          transferId = transfer.id;
        }
      }

      if (chargeId && !transferId) {
        const charge = await stripe.charges.retrieve(chargeId);

        if (typeof charge.transfer === "string") {
          transferId = charge.transfer;
        } else if (charge.transfer?.id) {
          transferId = charge.transfer.id;
        }
      }
    } catch (error) {
      /*
       * Payment confirmation should not fail just because one of the
       * optional Stripe reference lookups failed.
       */
      console.error(
        "Could not enrich Stripe payment references:",
        error
      );
    }
  }

  const { error } = await supabase
    .from("payments")
    .update({
      payment_status: "paid",

      /*
       * With destination charges, funds have been routed to the
       * connected Stripe account. This is not the same thing as a
       * bank payout, so keep payout_status pending until you implement
       * connected-account payout reconciliation.
       */
      payout_status: "pending",

      stripe_payment_intent_id: paymentIntentId,
      stripe_charge_id: chargeId,
      stripe_transfer_id: transferId,

      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_checkout_session_id", session.id);

  if (error) {
    throw error;
  }
}

async function markCheckoutFailed(session: Stripe.Checkout.Session) {
  const supabase = getAdminSupabase();

  const { error } = await supabase
    .from("payments")
    .update({
      payment_status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_checkout_session_id", session.id);

  if (error) {
    throw error;
  }
}

async function syncConnectedAccount(account: Stripe.Account) {
  const supabase = getAdminSupabase();

  const requirementsComplete =
    account.details_submitted &&
    (!account.requirements?.currently_due ||
      account.requirements.currently_due.length === 0);

  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_onboarding_complete: Boolean(requirementsComplete),
      stripe_charges_enabled: Boolean(account.charges_enabled),
      stripe_payouts_enabled: Boolean(account.payouts_enabled),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id);

  if (error) {
    throw error;
  }
}

export async function POST(req: NextRequest) {
  if (!stripeSecretKey || !webhookSecret) {
    console.error(
      "STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is missing."
    );

    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe-Signature header." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    /*
     * Stripe signature verification requires the unmodified raw body.
     * Do not call req.json() before constructEvent().
     */
    const rawBody = await req.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Stripe webhook signature error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid Stripe webhook signature.",
      },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === "paid") {
          await markCheckoutPaid(session);
        }

        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        await markCheckoutPaid(session);
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;

        await markCheckoutFailed(session);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;

        await syncConnectedAccount(account);
        break;
      }

      default:
        console.log(
          `Stripe webhook ignored event: ${event.type}`
        );
    }

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    /*
     * Returning a non-2xx response tells Stripe the event was not
     * processed successfully, so Stripe can retry delivery.
     */
    console.error(
      `Stripe webhook processing error for ${event.type}:`,
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}
