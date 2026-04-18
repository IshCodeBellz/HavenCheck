/** Set in `.env.local` when store listings are live; otherwise marketing uses the beta / waitlist path. */
export function getMobileAppStoreUrls(): {
  ios: string;
  android: string;
  hasBothStoreLinks: boolean;
} {
  const ios = process.env.NEXT_PUBLIC_IOS_APP_URL?.trim() ?? "";
  const android = process.env.NEXT_PUBLIC_ANDROID_APP_URL?.trim() ?? "";
  return {
    ios,
    android,
    hasBothStoreLinks: Boolean(ios && android),
  };
}

export const MOBILE_BETA_MAILTO =
  "mailto:hello@havencheck.co.uk?subject=HavenCheck%20mobile%20beta%20waitlist&body=Please%20add%20me%20to%20the%20mobile%20beta%20waitlist.%0A%0AName%3A%0AOrganisation%3A%0AEmail%3A%0A";
