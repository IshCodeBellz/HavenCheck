import Link from "next/link";
import Image from "next/image";
import { LOGO_PATH } from "@/lib/brand";

const featureCards = [
  {
    title: "Smart scheduling and visit coordination",
    description:
      "Create, assign, and rebalance visits quickly with clear visibility into availability, continuity, and travel time.",
  },
  {
    title: "Care plans and outcomes in one workspace",
    description:
      "Keep notes, plans, and client updates connected so teams can deliver consistent, person-centred care.",
  },
  {
    title: "Built-in compliance confidence",
    description:
      "Stay ready with structured records, auditable history, and workflows designed to support safer operations.",
  },
  {
    title: "Team communication that reduces admin",
    description:
      "Give office and field teams one source of truth for shifts, tasks, and updates to reduce delays and rework.",
  },
];

const proofPoints = [
  "Purpose-built for home and community care teams",
  "Designed for office coordinators, carers, and managers",
  "Fast onboarding with a familiar, low-friction interface",
];

export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-navy-50 text-navy-900">
      <div
        className="pointer-events-none absolute -left-24 top-0 h-[24rem] w-[24rem] rounded-full bg-accent-300/35 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-28 top-40 h-[30rem] w-[30rem] rounded-full bg-navy-200/50 blur-3xl"
        aria-hidden
      />

      <section className="relative mx-auto max-w-6xl px-6 pb-12 pt-8 sm:px-8 sm:pt-10 lg:px-10">
        <nav className="mb-14 flex items-center justify-between rounded-2xl border border-navy-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
          <Image
            src={LOGO_PATH}
            alt="Haven Check"
            width={1000}
            height={480}
            priority
            className="h-auto w-36 object-contain sm:w-44"
          />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm font-medium text-navy-800 transition hover:border-navy-300 hover:bg-navy-50"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800"
            >
              Get started
            </Link>
          </div>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-navy-800">
              Home care operations platform
            </p>
            <h1 className="text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
              Deliver safer, more reliable care with less administrative load.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-navy-700 sm:text-lg">
              Haven Check helps your agency coordinate visits, support caregivers,
              and track client outcomes from one intuitive workspace so your team
              can focus on people, not paperwork.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-xl bg-navy-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-800"
              >
                Start free
              </Link>
              <Link
                href="/create-organization"
                className="rounded-xl border border-navy-300 bg-white px-5 py-3 text-sm font-semibold text-navy-800 transition hover:bg-navy-100"
              >
                Create organisation
              </Link>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-navy-700">
              {proofPoints.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span
                    className="mt-1 inline-block h-2 w-2 rounded-full bg-accent-500"
                    aria-hidden
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-navy-200 bg-white p-6 shadow-xl shadow-navy-200/40 sm:p-8">
            <h2 className="text-xl font-semibold text-navy-900">
              Why teams choose Haven Check
            </h2>
            <p className="mt-2 text-sm leading-6 text-navy-700">
              Inspired by leading care operations tools, but tailored to be clear,
              human, and practical for growing organisations.
            </p>
            <div className="mt-6 grid gap-4">
              {featureCards.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-navy-100 bg-navy-50/60 p-4"
                >
                  <h3 className="text-sm font-semibold text-navy-900">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-navy-700">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-navy-200 bg-white/70 py-12">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 sm:px-8 lg:grid-cols-3 lg:px-10">
          <article className="rounded-2xl border border-navy-100 bg-white p-6">
            <h3 className="text-base font-semibold text-navy-900">
              Better visibility, fewer surprises
            </h3>
            <p className="mt-2 text-sm leading-6 text-navy-700">
              Live operational context helps teams spot missed visits, staffing
              pressure, and client risks before they escalate.
            </p>
          </article>
          <article className="rounded-2xl border border-navy-100 bg-white p-6">
            <h3 className="text-base font-semibold text-navy-900">
              Improve caregiver and client experience
            </h3>
            <p className="mt-2 text-sm leading-6 text-navy-700">
              Shared schedules, clear notes, and consistent communication support
              continuity for clients and confidence for carers.
            </p>
          </article>
          <article className="rounded-2xl border border-navy-100 bg-white p-6">
            <h3 className="text-base font-semibold text-navy-900">
              Scale with confidence
            </h3>
            <p className="mt-2 text-sm leading-6 text-navy-700">
              Standardised workflows let agencies expand services while keeping
              quality, governance, and service delivery aligned.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14 sm:px-8 lg:px-10">
        <div className="rounded-3xl border border-accent-200 bg-gradient-to-r from-white to-accent-50 p-8 shadow-sm sm:p-10">
          <h2 className="text-2xl font-semibold text-navy-900 sm:text-3xl">
            Ready to run care operations with more clarity?
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-navy-700 sm:text-base">
            Launch Haven Check for your team and centralise scheduling, care
            coordination, and oversight in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-xl bg-navy-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-navy-800"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-navy-300 bg-white px-5 py-3 text-sm font-semibold text-navy-800 transition hover:bg-navy-100"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
