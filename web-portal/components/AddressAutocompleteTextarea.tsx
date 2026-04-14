'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 450;
const MIN_CHARS = 3;
const LIMIT = 6;

export type GeocodeHit = { lat: number; lon: number; displayName: string };

export interface AddressAutocompleteTextareaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when the user picks a suggestion; use to sync map coordinates (and geofence if needed). */
  onPickResult: (hit: GeocodeHit) => void;
  rows?: number;
  required?: boolean;
  'aria-required'?: boolean | 'true' | 'false';
  className?: string;
  placeholder?: string;
}

export default function AddressAutocompleteTextarea({
  id,
  value,
  onChange,
  onPickResult,
  rows = 3,
  required,
  'aria-required': ariaRequired,
  className = '',
  placeholder,
}: AddressAutocompleteTextareaProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodeHit[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `/api/geocode/search?q=${encodeURIComponent(q)}&limit=${LIMIT}`
          );
          if (!res.ok) {
            setSuggestions([]);
            setOpen(false);
            return;
          }
          const data = (await res.json()) as {
            results?: Array<{ lat: number; lon: number; displayName: string | null }>;
          };
          const hits: GeocodeHit[] = (data.results || [])
            .filter(
              (r) =>
                r.displayName &&
                typeof r.lat === 'number' &&
                typeof r.lon === 'number' &&
                Number.isFinite(r.lat) &&
                Number.isFinite(r.lon)
            )
            .map((r) => ({
              lat: r.lat,
              lon: r.lon,
              displayName: r.displayName as string,
            }));
          setSuggestions(hits);
          setOpen(hits.length > 0);
        } catch {
          setSuggestions([]);
          setOpen(false);
        } finally {
          setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value]);

  const pick = useCallback(
    (hit: GeocodeHit) => {
      skipNextSearchRef.current = true;
      onPickResult(hit);
      setOpen(false);
      setSuggestions([]);
    },
    [onPickResult]
  );

  return (
    <div ref={wrapRef} className="relative">
      <textarea
        id={id}
        required={required}
        aria-required={ariaRequired}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        autoComplete="street-address"
        className={className}
      />
      {loading && value.trim().length >= MIN_CHARS && (
        <span className="absolute right-3 top-2 text-xs text-navy-500 pointer-events-none">
          Searching…
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Address suggestions from map search"
          className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-auto rounded-md border border-navy-200 bg-white shadow-lg"
        >
          {suggestions.map((hit, i) => (
            <li
              key={`${hit.lat}-${hit.lon}-${i}`}
              role="option"
              className="px-3 py-2 text-sm text-navy-900 cursor-pointer hover:bg-navy-50 border-b border-navy-100 last:border-0"
              onMouseDown={(e) => {
                e.preventDefault();
                pick(hit);
              }}
            >
              {hit.displayName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
