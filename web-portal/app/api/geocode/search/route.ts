import { NextRequest, NextResponse } from 'next/server';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

/**
 * Forward geocode (postcode or address) → up to `limit` matches (default 1, max 8).
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 3) {
    return NextResponse.json({ error: 'q must be at least 3 characters' }, { status: 400 });
  }

  const limitRaw = req.nextUrl.searchParams.get('limit');
  const parsed = parseInt(limitRaw ?? '1', 10);
  const limit = Number.isFinite(parsed) ? Math.min(8, Math.max(1, parsed)) : 1;

  const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HavenCheck/1.0 (staff portal; geocoding)',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Geocoding service unavailable' },
        { status: 502 }
      );
    }
    const rows = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name?: string;
    }>;
    const results = rows
      .map((row) => {
        const lat = Number(row.lat);
        const lon = Number(row.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          lat,
          lon,
          displayName: row.display_name?.trim() || null,
        };
      })
      .filter((r): r is { lat: number; lon: number; displayName: string | null } => r !== null);

    if (results.length === 0) {
      return NextResponse.json({ error: 'No results', results: [] }, { status: 404 });
    }

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'Geocoding request failed' }, { status: 502 });
  }
}
