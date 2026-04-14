'use client';

interface MapProps {
  latitude: number;
  longitude: number;
  clientName: string;
  /** Full postal address for screen readers (keyboard users rely on text, not the map). */
  address?: string;
  height?: string;
}

export default function Map({
  latitude,
  longitude,
  clientName,
  address,
  height = '300px',
}: MapProps) {
  const label = `Map showing approximate location for ${clientName}`;
  const zoom = 15;
  const iframeUrl = `https://maps.google.com/maps?q=${latitude},${longitude}&z=${zoom}&output=embed`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <section
      aria-label={label}
      className="h-full border border-navy-200 overflow-hidden rounded-lg flex flex-col"
      style={{ height }}
    >
      <p className="sr-only">
        {address
          ? `Address: ${address}. `
          : 'Use the address shown on this page for the exact location. '}
        Coordinates: {latitude.toFixed(5)}, {longitude.toFixed(5)}. This map is supplementary; the
        address text is the primary location information.
      </p>
      <div className="flex-1 min-h-0 w-full">
        <iframe
          title={`${clientName} location map`}
          src={iframeUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <div className="px-3 py-2 border-t border-navy-100 bg-white">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-navy-600 hover:text-navy-800 underline"
        >
          Open in Google Maps
        </a>
      </div>
    </section>
  );
}
