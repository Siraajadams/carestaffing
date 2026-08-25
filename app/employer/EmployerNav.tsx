"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function EmployerNav() {
  const pathname = usePathname();
  const router = useRouter();

  function linkStyle(path: string): React.CSSProperties {
    const active =
      pathname === path ||
      pathname.startsWith(path + "/");

    return {
      textDecoration: "none",
      fontSize: "14px",
      fontWeight: active ? 900 : 700,
      color: active ? "#087f5b" : "#3c4743",
      whiteSpace: "nowrap",
    };
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "22px",
        flexWrap: "wrap",
        marginBottom: "28px",
      }}
    >
      <Link
        href="/employer"
        style={{
          textDecoration: "none",
          fontSize: "23px",
          fontWeight: 900,
          letterSpacing: "3px",
          color: "#0f6154",
        }}
      >
        CARESTAFFING
      </Link>

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: "18px",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/employer/post-shift"
          style={linkStyle("/employer/post-shift")}
        >
          Post Shift
        </Link>

        <Link
          href="/employer/shifts"
          style={linkStyle("/employer/shifts")}
        >
          My Shifts
        </Link>

        <Link
          href="/employer/applicants"
          style={linkStyle("/employer/applicants")}
        >
          Applicants
        </Link>

        <Link
          href="/employer/locum-directory"
          style={linkStyle("/employer/locum-directory")}
        >
          Locum Directory
        </Link>

        <Link
          href="/employer/profile"
          style={linkStyle("/employer/profile")}
        >
          Organisation Profile
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            padding: "9px 14px",
            borderRadius: "9px",
            border: "1px solid #d9e1de",
            background: "#ffffff",
            color: "#384640",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </nav>
    </div>
  );
}
