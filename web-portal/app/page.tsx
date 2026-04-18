import Link from "next/link";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import {
  getMobileAppStoreUrls,
  MOBILE_BETA_MAILTO,
} from "@/lib/mobileAppLinks";

const trustBullets = [
  "eMAR with full audit trail",
  "CQC-ready compliance workflows",
  "Built-in invoicing and payroll",
  "Family portal included",
];

const trustedBy = [
  "Domiciliary care agencies",
  "Supported living teams",
  "Complex care providers",
  "Multi-branch organisations",
];

const pillars = [
  {
    title: "Care Delivery and Medication",
    description: "eMAR, MAR charts, PRN flows, visit logs, and clinical notes.",
  },
  {
    title: "Care Plans and Risk Management",
    description:
      "Structured plans, assessments, risk scoring, and review workflows.",
  },
  {
    title: "Compliance and CQC Readiness",
    description:
      "Audit trails, incident evidence, governance checks, and inspection packs.",
  },
  {
    title: "Finance and Payroll",
    description:
      "Timesheets, mileage, invoicing, payroll exports, and cleaner reconciliation.",
  },
  {
    title: "Family and Team Visibility",
    description:
      "Family portal updates, team coordination, and one shared source of truth.",
  },
];

const teamImpact = [
  {
    title: "Designed for frontline teams",
    description:
      "Carers record faster with clear mobile workflows, reducing missed details and duplicated admin.",
  },
  {
    title: "Live operational oversight",
    description:
      "Managers monitor care delivery, medication, and incidents across client, branch, and organisation level.",
  },
  {
    title: "Reporting that drives outcomes",
    description:
      "Track quality, compliance, and operational trends with evidence-ready reporting.",
  },
];

const howItWorks = [
  {
    title: "Plan care",
    description: "Create schedules, allocate carers, and balance availability.",
  },
  {
    title: "Deliver care",
    description: "Carers complete visits and tasks through the mobile app.",
  },
  {
    title: "Record everything",
    description: "Capture eMAR, notes, incidents, and outcomes in real time.",
  },
  {
    title: "Stay compliant",
    description: "Maintain audit trails, risk logs, and inspection readiness.",
  },
  {
    title: "Run your business",
    description: "Generate reports, invoices, and payroll from one dataset.",
  },
];

const faqs = [
  {
    question: "What care services is HavenCheck built for?",
    answer:
      "HavenCheck is designed for homecare, supported living, and complex care teams that need one operational system.",
  },
  {
    question: "Can we run eMAR, compliance, and finance together?",
    answer:
      "Yes. Medication, care records, compliance evidence, billing, and payroll are connected in one workflow.",
  },
  {
    question: "Does HavenCheck include a family portal?",
    answer:
      "Yes. Families receive appropriate updates without adding admin burden to your office team.",
  },
  {
    question: "How quickly can we onboard?",
    answer:
      "Most teams start with core scheduling and care delivery first, then phase in compliance and finance modules.",
  },
];

const footerColumns = [
  {
    heading: "Product",
    links: [
      { label: "Care management", href: "#product-pillars" },
      { label: "Rostering", href: "#how-it-works" },
      { label: "eMAR", href: "#product-pillars" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Mobile app", href: "#mobile-app" },
      { label: "Pricing", href: "/signup" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", href: "/" },
      { label: "Careers", href: "/" },
      { label: "Partners", href: "/" },
      { label: "Refer-a-friend", href: "/" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "/" },
      { label: "Newsletter", href: "/" },
      { label: "Resource hub", href: "/" },
      { label: "Help centre", href: "/" },
    ],
  },
  {
    heading: "Contact",
    links: [
      { label: "Contact us", href: "/" },
      { label: "hello@havencheck.co.uk", href: "mailto:hello@havencheck.co.uk" },
    ],
  },
];

export default function Page() {
  const {
    ios: iosAppUrl,
    android: androidAppUrl,
    hasBothStoreLinks,
  } = getMobileAppStoreUrls();
  const hasAnyStoreLink = Boolean(iosAppUrl || androidAppUrl);

  return (
    <main className="relative min-h-screen overflow-x-clip bg-navy-50 text-navy-900">
      <SiteHeader />
      <section className="relative border-b border-navy-200 bg-gradient-to-b from-navy-100/70 to-navy-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-14 pt-14 sm:px-8 sm:pb-16 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-10">
          <div>
            <p className="inline-flex rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-navy-800">
              Home care operations platform
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
              Run your entire care operation in one system - from visits to
              medication, compliance, and payroll.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-navy-700 sm:text-lg">
              HavenCheck connects scheduling, care delivery, eMAR, compliance,
              and billing into one platform so your team can deliver safer care
              with less admin.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-navy-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-900"
              >
                Get started
              </Link>
              <Link
                href="/create-organization"
                className="rounded-lg border border-navy-300 bg-white px-5 py-3 text-sm font-semibold text-navy-800 transition hover:bg-navy-100"
              >
                Create organisation
              </Link>
            </div>
            <ul className="mt-7 grid gap-2 text-sm text-navy-700 sm:grid-cols-2">
              {trustBullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent-500" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-navy-200 bg-white p-6 shadow-sm sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">
              Live operations snapshot
            </p>
            <h2 className="mt-2 text-xl font-semibold text-navy-900">
              One platform. Everything connected.
            </h2>
            <div className="mt-5 space-y-3">
              {pillars.map((item) => (
                <article
                  key={item.title}
                  className="rounded-xl border border-navy-100 bg-navy-50/70 px-4 py-3"
                >
                  <h3 className="text-sm font-semibold text-navy-900">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-navy-700">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-navy-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-7 sm:px-8 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-600">
            Trusted by care teams modernising operations
          </p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-navy-700">
            {trustedBy.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-navy-900 sm:text-4xl">
            Time to replace disconnected care software?
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-navy-700">
            HavenCheck is built as one system, so scheduling, care delivery,
            compliance, and finance all work from one shared record.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-navy-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">
              With legacy tools
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-navy-700">
              <li>Data entered multiple times across systems.</li>
              <li>Medication, visits, and incidents tracked separately.</li>
              <li>Compliance evidence assembled manually under pressure.</li>
              <li>Billing and payroll delayed by reconciliation work.</li>
            </ul>
          </article>
          <article className="rounded-2xl border border-accent-200 bg-accent-50/40 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">
              With HavenCheck
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-navy-800">
              <li>One record from first schedule through final invoice.</li>
              <li>eMAR, care notes, and incidents connected by default.</li>
              <li>Inspection-ready audit trails available at any time.</li>
              <li>Cleaner finance outputs from completed care delivery.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="border-y border-navy-200 bg-white/80 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
          <h2 className="text-3xl font-semibold text-navy-900 sm:text-4xl">
            Everything starts with your team
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-navy-700">
            Better delivery comes from clearer workflows, stronger oversight,
            and faster reporting.
          </p>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {teamImpact.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-navy-100 bg-white p-6"
              >
                <h3 className="text-base font-semibold text-navy-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-navy-700">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="product-pillars"
        className="mx-auto max-w-6xl scroll-mt-28 px-6 py-16 sm:px-8 sm:py-20 lg:px-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="one-platform"
              className="scroll-mt-28 text-3xl font-semibold text-navy-900 sm:text-4xl"
            >
              Do more on one system
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-navy-700">
              Manage care delivery, compliance, and operations together, not as
              separate projects.
            </p>
          </div>
          <Link
            href="/signup"
            className="rounded-lg border border-navy-300 bg-white px-4 py-2 text-sm font-semibold text-navy-800 transition hover:bg-navy-50"
          >
            Explore modules
          </Link>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {pillars.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-navy-100 bg-white p-5"
            >
              <h3 className="text-sm font-semibold text-navy-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-navy-700">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-28 border-y border-navy-200 bg-white/80 py-16 sm:py-20"
      >
        <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
          <h2 className="text-3xl font-semibold text-navy-900 sm:text-4xl">
            How HavenCheck works
          </h2>
          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {howItWorks.map((step, index) => (
              <article
                key={step.title}
                className="rounded-2xl border border-navy-100 bg-white p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
                  Step {index + 1}
                </p>
                <h3 className="mt-2 text-base font-semibold text-navy-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-navy-700">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="outcomes"
        className="mx-auto max-w-6xl scroll-mt-28 px-6 py-16 sm:px-8 sm:py-20 lg:px-10"
      >
        <h2 className="text-3xl font-semibold text-navy-900 sm:text-4xl">
          Built for real care operations
        </h2>
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-navy-100 bg-white p-6">
            <h3 className="text-base font-semibold text-navy-900">
              Stay inspection-ready every day
            </h3>
            <p className="mt-2 text-sm leading-6 text-navy-700">
              Structured records and audit trails support CQC standards without
              last-minute evidence gathering.
            </p>
          </article>
          <article className="rounded-2xl border border-navy-100 bg-white p-6">
            <h3 className="text-base font-semibold text-navy-900">
              Reduce medication errors and incidents
            </h3>
            <p className="mt-2 text-sm leading-6 text-navy-700">
              Real-time alerts and connected records help teams act quickly and
              safely.
            </p>
          </article>
          <article className="rounded-2xl border border-navy-100 bg-white p-6">
            <h3 className="text-base font-semibold text-navy-900">
              Eliminate manual admin
            </h3>
            <p className="mt-2 text-sm leading-6 text-navy-700">
              Automated finance and reporting reduce repetitive tasks across
              office and field teams.
            </p>
          </article>
          <article className="rounded-2xl border border-navy-100 bg-white p-6">
            <h3 className="text-base font-semibold text-navy-900">
              Give families real-time visibility
            </h3>
            <p className="mt-2 text-sm leading-6 text-navy-700">
              Keep relatives informed with secure updates that build trust and
              reduce inbound calls.
            </p>
          </article>
        </div>
      </section>

      <section
        id="mobile-app"
        className="mx-auto max-w-6xl scroll-mt-28 px-6 py-16 sm:px-8 sm:py-20 lg:px-10"
      >
        <div className="rounded-2xl border border-navy-200 bg-white p-8 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-600">
            Carers and field teams
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-navy-900 sm:text-4xl">
            HavenCheck mobile app
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-navy-700">
            The carer app is in beta with partner organisations. Request access
            and we will share install links when your team is onboarded.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {hasAnyStoreLink ? (
              <>
                {iosAppUrl ? (
                  <a
                    href={iosAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-lg border border-navy-300 bg-navy-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-800"
                  >
                    Download on the App Store
                  </a>
                ) : null}
                {androidAppUrl ? (
                  <a
                    href={androidAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-lg border border-navy-300 bg-white px-5 py-3 text-sm font-semibold text-navy-800 transition hover:bg-navy-50"
                  >
                    Get it on Google Play
                  </a>
                ) : null}
                {!hasBothStoreLinks ? (
                  <a
                    href={MOBILE_BETA_MAILTO}
                    className="inline-flex rounded-lg border border-dashed border-navy-300 bg-navy-50 px-5 py-3 text-sm font-semibold text-navy-800 transition hover:bg-navy-100"
                  >
                    Request the other platform
                  </a>
                ) : null}
              </>
            ) : (
              <>
                <a
                  href={MOBILE_BETA_MAILTO}
                  className="inline-flex rounded-lg bg-navy-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-900"
                >
                  Join the mobile beta waitlist
                </a>
                <Link
                  href="/signup"
                  className="inline-flex rounded-lg border border-navy-300 bg-white px-5 py-3 text-sm font-semibold text-navy-800 transition hover:bg-navy-50"
                >
                  Get started on the web
                </Link>
              </>
            )}
          </div>
          {!hasAnyStoreLink ? (
            <p className="mt-4 text-sm text-navy-600">
              Prefer email without a mail client? Write to{" "}
              <a
                href="mailto:hello@havencheck.co.uk"
                className="font-semibold text-navy-800 underline decoration-navy-300 underline-offset-2 hover:decoration-navy-500"
              >
                hello@havencheck.co.uk
              </a>{" "}
              with subject &quot;Mobile beta&quot;.
            </p>
          ) : null}
        </div>
      </section>

      <section className="border-y border-navy-200 bg-white/80 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
          <h2 className="text-3xl font-semibold text-navy-900 sm:text-4xl">
            Frequently asked questions
          </h2>
          <div className="mt-8 space-y-3">
            {faqs.map((item) => (
              <details
                key={item.question}
                className="rounded-xl border border-navy-200 bg-white px-5 py-4"
              >
                <summary className="cursor-pointer text-sm font-semibold text-navy-900">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-navy-700">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="rounded-2xl border border-accent-200 bg-gradient-to-r from-white to-accent-50 p-8 sm:p-10">
          <h2 className="text-3xl font-semibold text-navy-900 sm:text-4xl">
            Ready to run a fully compliant, end-to-end care operation?
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-navy-700">
            From scheduling to medication, compliance, and payroll - everything
            in one system.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-navy-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-900"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-navy-300 bg-white px-5 py-3 text-sm font-semibold text-navy-800 transition hover:bg-navy-100"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <footer className="pb-10 pt-2 sm:pb-14">
        <div className="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] bg-navy-900 px-7 py-10 text-navy-50 sm:px-10 sm:py-12">
            <div className="flex flex-col gap-6 border-b border-navy-300/30 pb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight sm:text-4xl">
                  HavenCheck
                </p>
                <h2 className="mt-3 max-w-xl text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                  Technology that helps homecare teams work smarter.
                </h2>
              </div>
              <Link
                href="/signup"
                className="inline-flex w-fit rounded-full bg-accent-300 px-5 py-2.5 text-sm font-bold tracking-[0.01em] text-navy-900 transition hover:bg-accent-200"
              >
                Get started
              </Link>
            </div>

            <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_0.95fr]">
              {footerColumns.slice(0, 3).map((column) => (
                <div key={column.heading}>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-navy-200">
                    {column.heading}
                  </h3>
                  <ul className="mt-3 space-y-2.5 text-[0.95rem] font-medium text-navy-100">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        <Link href={link.href} className="transition hover:text-navy-50">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-navy-200">
                  Get the app
                </h3>
                <div className="mt-3 space-y-2.5">
                  {hasAnyStoreLink ? (
                    <>
                      {iosAppUrl ? (
                        <a
                          href={iosAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-fit rounded-lg border border-navy-300/40 bg-navy-800 px-3 py-2 text-xs font-medium text-navy-50 transition hover:bg-navy-700"
                        >
                          Download on the App Store
                        </a>
                      ) : null}
                      {androidAppUrl ? (
                        <a
                          href={androidAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-fit rounded-lg border border-navy-300/40 bg-navy-800 px-3 py-2 text-xs font-medium text-navy-50 transition hover:bg-navy-700"
                        >
                          Get it on Google Play
                        </a>
                      ) : null}
                      {!hasBothStoreLinks ? (
                        <a
                          href={MOBILE_BETA_MAILTO}
                          className="block w-fit rounded-lg border border-navy-300/40 bg-navy-800 px-3 py-2 text-xs font-medium text-navy-50 transition hover:bg-navy-700"
                        >
                          Join the waitlist
                        </a>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <Link
                        href="/#mobile-app"
                        className="block w-fit rounded-lg border border-navy-300/40 bg-navy-800 px-3 py-2 text-xs font-medium text-navy-50 transition hover:bg-navy-700"
                      >
                        Mobile app (beta)
                      </Link>
                      <a
                        href={MOBILE_BETA_MAILTO}
                        className="block w-fit rounded-lg border border-navy-300/40 bg-navy-800 px-3 py-2 text-xs font-medium text-navy-50 transition hover:bg-navy-700"
                      >
                        Join the waitlist
                      </a>
                    </>
                  )}
                </div>

                <div className="mt-5 space-y-2 text-[0.95rem] font-medium text-navy-100">
                  <Link href="/" className="block transition hover:text-navy-50">
                    Terms & conditions
                  </Link>
                  <Link href="/" className="block transition hover:text-navy-50">
                    Privacy notice
                  </Link>
                  <Link href="/" className="block transition hover:text-navy-50">
                    Cookie notice
                  </Link>
                  <Link href="/" className="block transition hover:text-navy-50">
                    hello@havencheck.co.uk
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-navy-300/25 pt-5 text-xs text-navy-200">
              © {new Date().getFullYear()} HavenCheck Ltd. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
