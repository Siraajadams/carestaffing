"use client";

import Link from "next/link";

const stats = [
  {
    label: "Available Shifts",
    value: "24",
    icon: "🔍",
  },
  {
    label: "Applied",
    value: "3",
    icon: "✅",
  },
  {
    label: "Upcoming",
    value: "2",
    icon: "📅",
  },
  {
    label: "Earnings This Month",
    value: "R 4,850",
    icon: "💰",
  },
];

const menuItems = [
  {
    title: "Find Shifts",
    description: "Browse and apply for available healthcare shifts.",
    href: "/shifts",
    icon: "🔍",
    color: "#0f766e",
  },
  {
    title: "My Diary",
    description: "View applications, upcoming shifts and availability.",
    href: "/my-shifts",
    icon: "📅",
    color: "#2563eb",
  },
  {
    title: "Timesheets",
    description: "Submit hours and review approved timesheets.",
    href: "/timesheets",
    icon: "📝",
    color: "#7c3aed",
  },
  {
    title: "Invoices",
    description: "View generated invoices and billing history.",
    href: "/invoices",
    icon: "🧾",
    color: "#ea580c",
  },
  {
    title"
