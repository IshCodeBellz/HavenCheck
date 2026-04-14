import { NextRequest, NextResponse } from 'next/server';

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Server-side reverse geocoding (keeps a valid User-Agent for Nominatim policy).
 */
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat');
  const lon = req.nextUrl.searchParams.get('lon');
  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon are required' }, { status: 400 });
  }
  const latN = Number(lat);
  const lonN = Number(lon);
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) {
    return NextResponse.json({ error: 'invalid coordinates' }, { status: 400 });
  }

  const url = `${NOMINATIM}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HavenCheck/1.0 (staff portal; geocoding)',
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Geocoding service unavailable' },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { display_name?: string };
    const displayName = data.display_name?.trim() || null;
    return NextResponse.json({ displayName });
  } catch {
    return NextResponse.json({ error: 'Geocoding request failed' }, { status: 502 });
  }
}
