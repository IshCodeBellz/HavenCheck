'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authService, User } from '@/lib/auth';
import { LOGO_PATH } from '@/lib/brand';
import { hasCarerPortalNav, isAdmin, isGuardian } from '@/lib/roles';

type NavItem = { href: string; label: string; matchPrefix?: boolean };

const navLinkClass = (active: boolean) =>
  `inline-flex items-center whitespace-nowrap px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2 rounded-sm ${
    active
      ? 'border-navy-600 text-navy-900'
      : 'border-transparent text-navy-800/80 hover:text-navy-900 hover:border-accent-300'
  }`;

const mobileNavLinkClass = (active: boolean) =>
  `block px-3 py-2 text-base font-medium rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-inset ${
    active ? 'bg-accent-50 text-navy-800' : 'text-navy-800 hover:bg-navy-50'
  }`;

const menuTriggerClass = (active: boolean) =>
  `inline-flex items-center gap-1 whitespace-nowrap border-b-2 px-1 pt-1 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2 rounded-sm cursor-pointer list-none ${
    active
      ? 'border-navy-600 text-navy-900'
      : 'border-transparent text-navy-800/80 hover:text-navy-900 hover:border-accent-300'
  }`;

export default function Layout({ children }: { children: React.ReactNode }) {
  /** Avoid SSR/client mismatch: localStorage is empty on the server. */
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    if (!authService.isAuthenticated()) return;
    const stored = authService.getStoredUser();
    if (stored) setUser(stored);
    authService.getCurrentUser().then((u) => {
      if (u) {
        setUser(u);
      } else {
        authService.logout();
        setUser(null);
      }
    });
  }, []);

  useEffect(() => {
    const onUserUpdated = () => {
      if (!authService.isAuthenticated()) return;
      authService.getCurrentUser().then((u) => {
        if (u) setUser(u);
      });
    };
    window.addEventListener('haven-user-updated', onUserUpdated);
    return () => window.removeEventListener('haven-user-updated', onUserUpdated);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close overlay on in-app or browser navigation
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileNavOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const handleLogout = () => {
    authService.logout();
    router.push('/login');
  };

  useEffect(() => {
    if (!mounted) return;
    if (user) return;
    if (authService.isAuthenticated()) return;
    router.replace('/login');
  }, [user, router, mounted]);

  const buildManagerNav = (u: User): NavItem[] => {
    const items: NavItem[] = [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/manager/overview', label: 'Team overview', matchPrefix: true },
      { href: '/manager/team-rota', label: 'Team rota', matchPrefix: true },
      { href: '/manager/open-shifts', label: 'Open shifts', matchPrefix: true },
      { href: '/manager/compliance', label: 'Compliance', matchPrefix: true },
      { href: '/manager/reports', label: 'Reports', matchPrefix: true },
    ];
    if (isAdmin(u)) {
      items.push({ href: '/admin', label: 'Admin', matchPrefix: true });
    }
    items.push(
      { href: '/clients', label: 'Clients' },
      { href: '/carers', label: 'Carers' },
      { href: '/schedules', label: 'Schedules' },
      { href: '/visits', label: 'Visits' },
      { href: '/checklists', label: 'Checklists' },
      { href: '/availability', label: 'Availability' }
    );
    return items;
  };

  const carerNavItems: NavItem[] = [
    { href: '/dashboard', label: 'My day' },
    { href: '/visits', label: 'My visits' },
    { href: '/schedules', label: 'My roster' },
    { href: '/open-shifts', label: 'Open shifts' },
    { href: '/availability', label: 'Availability' },
  ];

  const guardianNavItems: NavItem[] = [
    { href: '/guardian', label: 'Family feed' },
    { href: '/messages', label: 'Care alerts' },
  ];

  const navItems: NavItem[] = isGuardian(user)
    ? guardianNavItems
    : hasCarerPortalNav(user)
      ? carerNavItems
      : buildManagerNav(user!);

  const navItemActive = (item: NavItem) =>
    item.matchPrefix ? pathname.startsWith(item.href) : pathname === item.href;

  const primaryNavItems = navItems.slice(0, 4);
  const secondaryNavItems = navItems.slice(4);
  const menuHasActiveItem = secondaryNavItems.some((item) => navItemActive(item));
  const orderedSecondaryNavItems = [...secondaryNavItems].sort((a, b) => {
    const aActive = navItemActive(a) ? 1 : 0;
    const bActive = navItemActive(b) ? 1 : 0;
    return bActive - aActive;
  });

  const toggleMobileNav = useCallback(() => {
    setMobileNavOpen((open) => !open);
  }, []);

  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-navy-50 via-white to-accent-50/40 flex flex-col items-center justify-center gap-4 p-4">
        <div
          className="h-10 w-10 rounded-full border-2 border-accent-200 border-t-navy-600 motion-safe:animate-spin"
          aria-hidden
        />
        <p role="status" aria-live="polite" className="text-sm font-medium text-navy-800">
          {!mounted ? 'Loading…' : 'Checking session…'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          const mainEl = document.getElementById('main-content');
          if (mainEl) {
            e.preventDefault();
            mainEl.focus();
            mainEl.scrollIntoView({ block: 'start' });
          }
        }}
      >
        Skip to main content
      </a>
      <header className="relative border-b border-navy-100 bg-white/95 shadow-sm backdrop-blur-sm">
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-navy-600 via-accent-400 to-navy-600"
          aria-hidden
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1">
          <div className="flex justify-between min-h-18 sm:min-h-20 items-center gap-3 py-3 sm:py-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="shrink-0 flex items-center">
                <Link
                  href={isGuardian(user) ? '/guardian' : '/dashboard'}
                  className="flex items-center rounded-xl border border-navy-100 bg-gradient-to-br from-white to-accent-50/50 p-2 shadow-sm transition-shadow duration-200 hover:border-accent-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2 sm:p-2.5"
                  aria-label={isGuardian(user) ? 'Haven Check, go to family feed' : 'Haven Check, go to dashboard'}
                >
                  <Image
                    src={LOGO_PATH}
                    alt=""
                    width={560}
                    height={160}
                    className="h-14 sm:h-16 lg:h-18 w-auto max-w-[min(100%,300px)] sm:max-w-[min(100%,360px)] lg:max-w-[420px] object-contain object-left drop-shadow-sm"
                    aria-hidden="true"
                    unoptimized
                  />
                </Link>
              </div>
              <nav
                aria-label="Main"
                className="hidden lg:ml-4 lg:flex lg:min-w-0 lg:flex-1 lg:items-center lg:gap-x-4 xl:gap-x-5"
              >
                {primaryNavItems.map((item) => (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className={navLinkClass(navItemActive(item))}
                  >
                    {item.label}
                  </Link>
                ))}
                {orderedSecondaryNavItems.length > 0 && (
                  <details className="relative group">
                    <summary className={menuTriggerClass(menuHasActiveItem)}>
                      Menu
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </summary>
                    <div className="absolute left-0 z-20 mt-2 min-w-52 rounded-lg border border-navy-100 bg-white p-2 shadow-lg">
                      {orderedSecondaryNavItems.map((item) => (
                        <Link
                          key={item.href + item.label}
                          href={item.href}
                          className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-inset ${
                            navItemActive(item)
                              ? 'bg-accent-50 text-navy-900'
                              : 'text-navy-800 hover:bg-navy-50 hover:text-navy-900'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </details>
                )}
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-2 border-l border-navy-100 pl-3 sm:gap-4 sm:pl-4">
              <button
                type="button"
                ref={menuButtonRef}
                className="lg:hidden inline-flex items-center justify-center rounded-md p-2 text-navy-800 hover:bg-navy-50 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2"
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-main-nav"
                onClick={toggleMobileNav}
              >
                <span className="sr-only">{mobileNavOpen ? 'Close menu' : 'Open menu'}</span>
                {mobileNavOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                )}
              </button>
              <p className="hidden xl:block text-sm text-navy-800 truncate max-w-48">
                <span className="sr-only">Signed in as </span>
                {user.name}
              </p>
              <Link
                href="/account"
                className="text-sm font-medium text-navy-800 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2 rounded-full border border-transparent px-3 py-1.5 transition-colors hover:border-navy-200 hover:bg-navy-50"
              >
                Account
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm font-medium text-navy-800 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-600 focus-visible:ring-offset-2 rounded-full border border-transparent px-3 py-1.5 transition-colors hover:border-navy-200 hover:bg-navy-50 cursor-pointer"
              >
                Log out
              </button>
            </div>
          </div>
          <div
            id="mobile-main-nav"
            className={`lg:hidden border-t border-navy-100 py-2 ${mobileNavOpen ? 'block' : 'hidden'}`}
            hidden={!mobileNavOpen}
          >
            <nav aria-label="Main mobile">
              <ul className="space-y-1 pb-2">
                {navItems.map((item) => (
                  <li key={item.href + item.label}>
                    <Link
                      href={item.href}
                      className={mobileNavLinkClass(navItemActive(item))}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="px-3 py-2 text-sm text-navy-800/80 border-t border-navy-100 xl:hidden">
                <span className="sr-only">Signed in as </span>
                {user.name}
              </p>
              <Link
                href="/account"
                className="block px-3 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50 rounded-md border-t border-navy-100"
                onClick={() => setMobileNavOpen(false)}
              >
                Account
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-7xl mx-auto px-4 py-6 text-navy-900 sm:px-6 lg:px-8 outline-none"
      >
        {children}
      </main>
    </div>
  );
}
