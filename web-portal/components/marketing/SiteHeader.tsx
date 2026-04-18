"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LOGO_PATH } from "@/lib/brand";

const navLinks = [
  { href: "#product-pillars", label: "Platform" },
  { href: "#one-platform", label: "Modules" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#outcomes", label: "Outcomes" },
] as const;

const megaMenuContent = {
  Platform: {
    title: "Platform",
    links: [
      {
        href: "#product-pillars",
        title: "Care delivery",
        description: "Visit logs, tasks, and medication workflows in one place.",
      },
      {
        href: "#how-it-works",
        title: "Scheduling and rostering",
        description: "Plan shifts, allocate carers, and rebalance quickly.",
      },
      {
        href: "#outcomes",
        title: "Compliance oversight",
        description: "Track incidents, audits, and inspection-ready evidence.",
      },
      {
        href: "#one-platform",
        title: "Operational reporting",
        description: "Get quality and finance visibility from one dataset.",
      },
    ],
    spotlight: {
      heading: "See HavenCheck in action",
      body: "Explore how teams move from disconnected systems to one operational platform.",
      ctaLabel: "Get started",
      ctaHref: "/signup",
    },
  },
  Modules: {
    title: "Modules",
    links: [
      {
        href: "#product-pillars",
        title: "eMAR",
        description: "Safer medication workflows with audit trail by default.",
      },
      {
        href: "#product-pillars",
        title: "Care plans",
        description: "Structured plans and risk assessments with review cycles.",
      },
      {
        href: "#product-pillars",
        title: "Billing and payroll",
        description: "Connected timesheets, invoicing, and payroll exports.",
      },
      {
        href: "#product-pillars",
        title: "Family portal",
        description: "Share updates without adding admin burden for your team.",
      },
    ],
    spotlight: {
      heading: "Modular, but connected",
      body: "Start with the workflows you need today and expand without data silos.",
      ctaLabel: "Get started",
      ctaHref: "/signup",
    },
  },
  "How it works": {
    title: "How it works",
    links: [
      {
        href: "#how-it-works",
        title: "Plan care",
        description: "Build rotas, define visits, and assign the right people.",
      },
      {
        href: "#how-it-works",
        title: "Deliver care",
        description: "Carers complete tasks and records from the mobile app.",
      },
      {
        href: "#how-it-works",
        title: "Monitor quality",
        description: "Managers track outcomes, incidents, and medication events.",
      },
      {
        href: "#how-it-works",
        title: "Run operations",
        description: "Generate reports, invoices, and payroll from completed care.",
      },
    ],
    spotlight: {
      heading: "Implementation support",
      body: "Roll out in phases with practical onboarding for office and frontline teams.",
      ctaLabel: "Create organisation",
      ctaHref: "/create-organization",
    },
  },
  Outcomes: {
    title: "Outcomes",
    links: [
      {
        href: "#outcomes",
        title: "Safer care delivery",
        description: "Reduce missed actions with clearer workflows and checks.",
      },
      {
        href: "#outcomes",
        title: "Faster inspections",
        description: "Keep evidence ready with continuous audit capture.",
      },
      {
        href: "#outcomes",
        title: "Lower admin overhead",
        description: "Remove duplicate entry across medication, visits, and finance.",
      },
      {
        href: "#outcomes",
        title: "Better family confidence",
        description: "Give appropriate, timely visibility into delivered care.",
      },
    ],
    spotlight: {
      heading: "Results that compound",
      body: "Create better care outcomes while improving team efficiency and control.",
      ctaLabel: "See outcomes",
      ctaHref: "#outcomes",
    },
  },
} as const;

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<keyof typeof megaMenuContent | null>(
    null,
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    const id = requestAnimationFrame(() => onScroll());
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <header
      className={`sticky top-0 z-[60] transition-all duration-300 ${
        scrolled ? "pt-3" : "pt-0"
      }`}
    >
      {openMenu ? (
        <div
          className="fixed inset-0 z-40 bg-navy-900/45 backdrop-blur-[1px]"
          onClick={() => setOpenMenu(null)}
          aria-hidden
        />
      ) : null}

      <div
        className={`relative z-50 h-[4.75rem] w-full transition-[border-radius,box-shadow,background-color,border-color,max-width,margin] duration-300 ${
          scrolled
            ? "mx-auto max-w-[90rem] rounded-full border border-navy-300/35 bg-navy-900 shadow-[0_10px_28px_-14px_rgba(15,23,42,0.55)]"
            : "mx-0 max-w-none border-b border-navy-300/35 bg-navy-900"
        }`}
      >
        <div className="mx-auto flex h-full w-full max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="shrink-0 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
        >
          <Image
            src={LOGO_PATH}
            alt="HavenCheck"
            width={1000}
            height={480}
            priority
            className="h-9 w-auto object-contain sm:h-10"
          />
        </Link>

        <div
          className="relative hidden md:block"
          onMouseLeave={() => setOpenMenu(null)}
        >
          <nav className="flex items-center gap-0.5" aria-label="Primary">
            {navLinks.map((item) => {
              const isOpen = openMenu === item.label;
              return (
                <button
                  key={item.href}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-[15px] font-semibold tracking-[0.01em] text-navy-50 transition-colors hover:bg-navy-800 hover:text-white"
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                  onMouseEnter={() => setOpenMenu(item.label)}
                  onFocus={() => setOpenMenu(item.label)}
                >
                  {item.label}
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    className={`h-3.5 w-3.5 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    aria-hidden
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              );
            })}
          </nav>

          {openMenu ? (
            <div className="absolute left-1/2 top-[calc(100%+2.25rem)] z-[70] w-[min(78rem,calc(100vw-2.5rem))] -translate-x-1/2 rounded-2xl border border-navy-100 bg-white p-7 text-navy-900 shadow-[0_24px_60px_-26px_rgba(2,12,27,0.55)]">
              <div className="grid gap-7 lg:grid-cols-[1.6fr_0.9fr]">
                <div>
                  <h3 className="text-xl font-semibold tracking-tight">
                    {megaMenuContent[openMenu].title}
                  </h3>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    {megaMenuContent[openMenu].links.map((entry) => (
                      <Link
                        key={entry.title}
                        href={entry.href}
                        className="rounded-xl border border-navy-100 bg-navy-50/60 px-5 py-4 transition hover:border-navy-200 hover:bg-white"
                        onClick={() => setOpenMenu(null)}
                      >
                        <p className="text-[0.95rem] font-semibold tracking-[0.005em] text-navy-900">
                          {entry.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-navy-700">
                          {entry.description}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>

                <aside className="rounded-xl border border-accent-200 bg-accent-50/65 p-6">
                  <p className="text-lg font-semibold tracking-tight text-navy-900">
                    {megaMenuContent[openMenu].spotlight.heading}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-navy-700">
                    {megaMenuContent[openMenu].spotlight.body}
                  </p>
                  <Link
                    href={megaMenuContent[openMenu].spotlight.ctaHref}
                    className="mt-4 inline-flex rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800"
                    onClick={() => setOpenMenu(null)}
                  >
                    {megaMenuContent[openMenu].spotlight.ctaLabel}
                  </Link>
                </aside>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden rounded-md px-3 py-2 text-sm font-semibold tracking-[0.01em] text-navy-100 transition-colors hover:bg-navy-800 hover:text-white sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex rounded-md bg-accent-300 px-4 py-2.5 text-sm font-bold tracking-[0.01em] text-navy-900 shadow-sm transition hover:bg-accent-200"
          >
            Get started
          </Link>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-navy-300/45 bg-navy-800 text-navy-50 transition hover:bg-navy-700 md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="sr-only">{mobileOpen ? "Close menu" : "Open menu"}</span>
            {mobileOpen ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-nav"
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-navy-200 bg-white md:hidden ${
            scrolled ? "top-[5.6rem]" : "top-[4.75rem]"
          }`}
        >
          <nav
            className="mx-auto flex max-w-[90rem] flex-col gap-1 px-4 py-4 sm:px-6"
            aria-label="Mobile"
          >
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-4 py-3 text-base font-medium text-navy-800 hover:bg-navy-50"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 border-t border-navy-100" />
            <Link
              href="/login"
              className="rounded-lg px-4 py-3 text-base font-medium text-navy-700 hover:bg-navy-50"
              onClick={() => setMobileOpen(false)}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg px-4 py-3 text-base font-semibold text-navy-900 hover:bg-navy-50"
              onClick={() => setMobileOpen(false)}
            >
              Get started
            </Link>
            <Link
              href="/create-organization"
              className="rounded-lg px-4 py-3 text-base font-medium text-navy-700 hover:bg-navy-50"
              onClick={() => setMobileOpen(false)}
            >
              Create organisation
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
