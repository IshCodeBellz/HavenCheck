'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LeafletMouseEvent } from 'leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

const UK_CENTER: [number, number] = [54.0, -2.5];
const DEFAULT_ZOOM_WIDE = 6;
const DEFAULT_ZOOM_PIN = 17;
/** Matches backend default when geofence field is empty */
const DEFAULT_GEOFENCE_METERS = 100;

function parseGeofenceMeters(s: string): number {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_GEOFENCE_METERS;
  return n;
}

if (typeof window !== 'undefined') {
  const proto = Icon.Default.prototype as typeof Icon.Default.prototype & {
    _getIconUrl?: () => string;
  };
  delete proto._getIconUrl;
  Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

function parseCoord(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function FlyToPin({
  lat,
  lng,
  tick,
}: {
  lat: number;
  lng: number;
  tick: number;
}) {
  const map = useMap();
  const prevTick = useRef(0);
  useEffect(() => {
    if (tick > 0 && tick !== prevTick.current) {
      prevTick.current = tick;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
    }
  }, [tick, lat, lng, map]);
  return null;
}

function MapClickLayer({ onClick }: { onClick: (e: LeafletMouseEvent) => void }) {
  useMapEvents({
    click: onClick,
  });
  return null;
}

export type ClientLocationFormPatch = Partial<{
  latitude: string;
  longitude: string;
  address: string;
  geofenceRadiusMeters: string;
}>;

export interface ClientLocationPickerProps {
  latitude: string;
  longitude: string;
  address: string;
  /** Form value for geofence radius; empty shows 100 m on the map (same as API default). */
  geofenceRadiusMeters: string;
  onChange: (patch: ClientLocationFormPatch) => void;
}

export default function ClientLocationPicker({
  latitude,
  longitude,
  address,
  geofenceRadiusMeters,
  onChange,
}: ClientLocationPickerProps) {
  const latN = parseCoord(latitude);
  const lngN = parseCoord(longitude);
  const hasCoords = latN !== null && lngN !== null;
  const fenceM = parseGeofenceMeters(geofenceRadiusMeters);
  const fenceIsDefault =
    !geofenceRadiusMeters.trim() || parseInt(geofenceRadiusMeters, 10) < 1;

  const [markerPos, setMarkerPos] = useState<[number, number]>(() =>
    hasCoords ? [latN, lngN] : UK_CENTER
  );
  const [flyTick, setFlyTick] = useState(0);
  const [matchAddressBusy, setMatchAddressBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [suggestedAddress, setSuggestedAddress] = useState<string | null>(null);
  const reverseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fencePatchIfEmpty = useCallback((): Pick<ClientLocationFormPatch, 'geofenceRadiusMeters'> => {
    if (!geofenceRadiusMeters.trim() || parseInt(geofenceRadiusMeters, 10) < 1) {
      return { geofenceRadiusMeters: String(DEFAULT_GEOFENCE_METERS) };
    }
    return {};
  }, [geofenceRadiusMeters]);

  useEffect(() => {
    if (latN !== null && lngN !== null) {
      setMarkerPos([latN, lngN]);
    }
  }, [latitude, longitude, latN, lngN]);

  const applyCoords = useCallback(
    (lat: number, lng: number, options?: { fly?: boolean }) => {
      setMarkerPos([lat, lng]);
      onChange({
        latitude: lat.toFixed(7),
        longitude: lng.toFixed(7),
        ...fencePatchIfEmpty(),
      });
      if (options?.fly) {
        setFlyTick((t) => t + 1);
      }
    },
    [onChange, fencePatchIfEmpty]
  );

  const runReverse = useCallback(
    (lat: number, lng: number) => {
      if (reverseTimer.current) clearTimeout(reverseTimer.current);
      reverseTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`
          );
          if (!res.ok) return;
          const data = (await res.json()) as { displayName?: string | null };
          const name = data.displayName?.trim();
          if (!name) return;
          const addrEmpty = !address.trim();
          if (addrEmpty) {
            onChange({
              latitude: lat.toFixed(7),
              longitude: lng.toFixed(7),
              address: name,
              ...fencePatchIfEmpty(),
            });
            setSuggestedAddress(null);
            setHint(null);
          } else {
            setSuggestedAddress(name);
            setHint(null);
          }
        } catch {
          /* ignore */
        }
      }, 400);
    },
    [address, onChange, fencePatchIfEmpty]
  );

  const onMarkerMoved = useCallback(
    (lat: number, lng: number) => {
      applyCoords(lat, lng);
      runReverse(lat, lng);
    },
    [applyCoords, runReverse]
  );

  const handleMapClick = useCallback(
    (e: LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      onMarkerMoved(lat, lng);
    },
    [onMarkerMoved]
  );

  const handleUseLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setHint('Location is not available in this browser.');
      return;
    }
    setGeoBusy(true);
    setHint(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        applyCoords(lat, lng, { fly: true });
        runReverse(lat, lng);
        setGeoBusy(false);
      },
      () => {
        setHint(
          'Could not read your location. Check permissions, use the address field above, or tap the map.'
        );
        setGeoBusy(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, [applyCoords, runReverse]);

  const geocodeAddressText = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 3) {
        setHint('Use at least three characters in the address field, or pick a suggestion.');
        return;
      }
      setMatchAddressBusy(true);
      setHint(null);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(trimmed)}&limit=1`);
        const data = (await res.json()) as {
          error?: string;
          results?: Array<{ lat: number; lon: number; displayName: string | null }>;
        };
        if (!res.ok) {
          setHint(data.error || 'No matching place found.');
          return;
        }
        const first = data.results?.[0];
        if (!first || !Number.isFinite(first.lat) || !Number.isFinite(first.lon)) {
          setHint('No matching place found.');
          return;
        }
        applyCoords(first.lat, first.lon, { fly: true });
        const name = first.displayName?.trim();
        if (name) {
          onChange({
            latitude: first.lat.toFixed(7),
            longitude: first.lon.toFixed(7),
            address: name,
            ...fencePatchIfEmpty(),
          });
          setSuggestedAddress(null);
        } else {
          runReverse(first.lat, first.lon);
        }
      } catch {
        setHint('Could not look up that address. Try again.');
      } finally {
        setMatchAddressBusy(false);
      }
    },
    [applyCoords, onChange, runReverse, fencePatchIfEmpty]
  );

  const handleMatchAddressField = useCallback(() => {
    void geocodeAddressText(address);
  }, [address, geocodeAddressText]);

  const center = hasCoords ? ([latN, lngN] as [number, number]) : UK_CENTER;
  const zoom = hasCoords ? DEFAULT_ZOOM_PIN : DEFAULT_ZOOM_WIDE;

  return (
    <div className="space-y-3">
      <p className="text-sm text-navy-600">
        Fine-tune the pin from the address you entered above (suggestions already move the map).
        Tap or drag the marker, use your current location at the property, or{' '}
        <span className="font-medium text-navy-800">Match map to address</span> if you pasted text
        without picking a suggestion.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={geoBusy}
          className="px-3 py-2 border border-navy-300 text-navy-800 rounded-md hover:bg-navy-50 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
        >
          {geoBusy ? 'Locating…' : 'Use my current location'}
        </button>
        <button
          type="button"
          onClick={handleMatchAddressField}
          disabled={matchAddressBusy || !address.trim()}
          className="px-3 py-2 bg-navy-100 text-navy-900 rounded-md hover:bg-navy-200 disabled:opacity-50 text-sm font-medium whitespace-nowrap"
        >
          {matchAddressBusy ? 'Looking up…' : 'Match map to address'}
        </button>
      </div>

      {hint && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          {hint}
        </p>
      )}

      {suggestedAddress && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm bg-navy-50 border border-navy-200 rounded-md px-3 py-2">
          <span className="text-navy-800">
            <span className="font-medium text-navy-900">Suggested address: </span>
            {suggestedAddress}
          </span>
          <button
            type="button"
            className="shrink-0 px-3 py-1.5 bg-navy-600 text-white rounded-md hover:bg-navy-700 text-sm font-medium"
            onClick={() => {
              onChange({
                latitude: markerPos[0].toFixed(7),
                longitude: markerPos[1].toFixed(7),
                address: suggestedAddress,
                ...fencePatchIfEmpty(),
              });
              setSuggestedAddress(null);
            }}
          >
            Use for address field
          </button>
        </div>
      )}

      <p className="text-xs text-navy-600">
        {hasCoords ? (
          <>
            Shaded circle: clock-in area ({fenceM} m radius
            {fenceIsDefault ? ` — default; set “Geofence radius” below to change` : ''}).
          </>
        ) : (
          <>Set a pin to see the geofence circle.</>
        )}
      </p>

      <div
        className="border border-navy-200 overflow-hidden rounded-lg"
        style={{ height: '280px', width: '100%' }}
        tabIndex={-1}
      >
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          aria-label="Map to set client location"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyToPin lat={markerPos[0]} lng={markerPos[1]} tick={flyTick} />
          {hasCoords && (
            <Circle
              center={markerPos}
              radius={fenceM}
              interactive={false}
              pathOptions={{
                color: '#2c5282',
                weight: 2,
                opacity: 0.9,
                fillColor: '#2c5282',
                fillOpacity: 0.12,
              }}
            />
          )}
          <MapClickLayer onClick={handleMapClick} />
          <Marker
            position={markerPos}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const m = e.target;
                const p = m.getLatLng();
                onMarkerMoved(p.lat, p.lng);
              },
            }}
          />
        </MapContainer>
      </div>
    </div>
  );
}
