import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegisterAccountBody = {
  email?: string;
  password?: string;
  first_name?: string;
  surname?: string;
  organisation_name?: string;
  mobile?: string;
  profession?: string;
  registration_number?: string;
  date_of_birth?: string | null;
  age?: number | null;
  gender?: string;
  country?: string;
  city?: string;
  role?: "worker" | "employer";
  account_type?: "worker" | "employer";
  platform?: string;
  requires_permit_document?: boolean;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/*
 * Simple health check.
 * After deployment, open:
 * https://care-staffing.com/api/register-worker
 *
 * You should receive JSON instead of a 404 page.
 */
export async function GET() {
  return json({
    ok: true,
    service: "CareStaffing register-worker",
    route: "/api/register-worker",
  });
}

export async function POST(request: Request) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "CareStaffing register-worker: missing Supabase server environment variables.",
      );

      return json(
        {
          error:
            "CareStaffing registration is not configured on the server.",
        },
        500,
      );
    }

    let body: RegisterAccountBody;

    try {
      body = (await request.json()) as RegisterAccountBody;
    } catch (parseError) {
      console.error(
        "CareStaffing register-worker invalid JSON:",
        parseError,
      );

      return json(
        {
          error:
            "Invalid registration request. Please refresh the page and try again.",
        },
        400,
      );
    }

    const email = clean(body.email).toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return json(
        {
          error: "Email and password are required.",
        },
        400,
      );
    }

    if (!email.includes("@")) {
      return json(
        {
          error: "Please enter a valid email address.",
        },
        400,
      );
    }

    if (password.length < 8) {
      return json(
        {
          error:
            "Password must contain at least 8 characters.",
        },
        400,
      );
    }

    const role =
      body.role === "employer" ? "employer" : "worker";

    const accountType =
      body.account_type === "employer"
        ? "employer"
        : "worker";

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );

    /*
     * Create the Auth user with email already confirmed.
     * This avoids triggering Supabase's built-in confirmation email.
     */
    const { data, error } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: clean(body.first_name),
          surname: clean(body.surname),
          organisation_name: clean(
            body.organisation_name,
          ),
          mobile: clean(body.mobile),
          profession: clean(body.profession),
          registration_number: clean(
            body.registration_number,
          ),
          date_of_birth:
            body.date_of_birth || null,
          age:
            typeof body.age === "number" &&
            Number.isFinite(body.age)
              ? body.age
              : null,
          gender: clean(body.gender),
          country: clean(body.country),
          city: clean(body.city),
          role,
          account_type: accountType,
          platform:
            clean(body.platform) || "CareStaffing",
          requires_permit_document: Boolean(
            body.requires_permit_document,
          ),
        },
      });

    if (error || !data.user) {
      console.error(
        "CareStaffing create user error:",
        error,
      );

      const message =
        error?.message || "Could not create account.";

      const lower = message.toLowerCase();

      if (
        lower.includes("already") ||
        lower.includes("exists") ||
        lower.includes("registered")
      ) {
        return json(
          {
            error:
              "An account already exists for this email address. Please use Login.",
          },
          409,
        );
      }

      return json(
        {
          error: message,
        },
        400,
      );
    }

    /*
     * Return the Auth UUID expected by app/register/page.tsx.
     * The client then signs in and uploads documents using the
     * authenticated Storage session.
     */
    return json(
      {
        ok: true,
        user_id: data.user.id,
        email: data.user.email,
        role,
        account_type: accountType,
      },
      201,
    );
  } catch (error) {
    console.error(
      "CareStaffing register-worker unexpected error:",
      error,
    );

    return json(
      {
        error:
          "Unexpected registration error. Please try again.",
      },
      500,
    );
  }
}
