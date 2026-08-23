"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmployerTimesheetsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/employer/shifts");
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "Arial, sans-serif",
        background: "#f1f5f9",
      }}
    >
      <div
        style={{
          background: "white",
          padding: "24px",
          borderRadius: "18px",
          fontWeight: 800,
        }}
      >
        Opening employer timesheets...
      </div>
    </main>
  );
}
