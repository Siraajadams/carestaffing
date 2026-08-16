"use client";

import dynamic from "next/dynamic";

const EmployerApplicantsClient = dynamic(
  () => import("./EmployerApplicantsClient"),
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
        Loading applicants...
      </main>
    ),
  }
);

export default function EmployerApplicantsPage() {
  return <EmployerApplicantsClient />;
}
