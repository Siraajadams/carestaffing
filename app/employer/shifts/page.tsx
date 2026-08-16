"use client";

import dynamic from "next/dynamic";

const EmployerShiftsClient = dynamic(
  () => import("./EmployerShiftsClient"),
  {
    ssr: false,
    loading: () => (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading shifts...
      </main>
    ),
  }
);

export default function EmployerShiftsPage() {
  return <EmployerShiftsClient />;
}
