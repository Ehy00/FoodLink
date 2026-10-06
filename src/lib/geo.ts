// Distance maths and the pilot-area ZIP table. No external geocoder is called,
// so a resident's ZIP never leaves FoodLink.

export interface Point {
  lat: number;
  lng: number;
}

/** Approximate centroids for Madison County, AL ZIP codes (pilot area). */
export const PILOT_ZIPS: Record<string, Point & { place: string }> = {
  "35801": { lat: 34.726, lng: -86.567, place: "Huntsville" },
  "35802": { lat: 34.668, lng: -86.56, place: "Huntsville" },
  "35803": { lat: 34.62, lng: -86.551, place: "Huntsville" },
  "35805": { lat: 34.708, lng: -86.616, place: "Huntsville" },
  "35806": { lat: 34.744, lng: -86.676, place: "Huntsville" },
  "35808": { lat: 34.684, lng: -86.654, place: "Redstone Arsenal" },
  "35810": { lat: 34.779, lng: -86.609, place: "Huntsville" },
  "35811": { lat: 34.778, lng: -86.544, place: "Huntsville" },
  "35816": { lat: 34.739, lng: -86.63, place: "Huntsville" },
  "35824": { lat: 34.647, lng: -86.729, place: "Huntsville" },
  "35896": { lat: 34.757, lng: -86.655, place: "Huntsville" },
  "35741": { lat: 34.72, lng: -86.47, place: "Brownsboro" },
  "35748": { lat: 34.71, lng: -86.39, place: "Gurley" },
  "35749": { lat: 34.83, lng: -86.75, place: "Harvest" },
  "35750": { lat: 34.95, lng: -86.59, place: "Hazel Green" },
  "35756": { lat: 34.64, lng: -86.81, place: "Madison" },
  "35757": { lat: 34.78, lng: -86.75, place: "Madison" },
  "35758": { lat: 34.71, lng: -86.75, place: "Madison" },
  "35759": { lat: 34.86, lng: -86.55, place: "Meridianville" },
  "35760": { lat: 34.55, lng: -86.39, place: "New Hope" },
  "35761": { lat: 34.9, lng: -86.44, place: "New Market" },
  "35762": { lat: 34.784, lng: -86.572, place: "Normal" },
  "35763": { lat: 34.6, lng: -86.46, place: "Owens Cross Roads" },
  "35773": { lat: 34.9, lng: -86.7, place: "Toney" },
};

/** Downtown Huntsville: the default map centre when no location is given. */
export const DEFAULT_CENTER: Point = { lat: 34.7304, lng: -86.5861 };

/** Generous box around Madison County used to sanity-check coordinates. */
export const PILOT_BOUNDS = { minLat: 34.45, maxLat: 35.05, minLng: -86.95, maxLng: -86.25 };

export function isInPilotBounds(p: Point): boolean {
  return (
    p.lat >= PILOT_BOUNDS.minLat &&
    p.lat <= PILOT_BOUNDS.maxLat &&
    p.lng >= PILOT_BOUNDS.minLng &&
    p.lng <= PILOT_BOUNDS.maxLng
  );
}

export function zipToPoint(zip: string | null | undefined): Point | null {
  if (!zip) return null;
  const hit = PILOT_ZIPS[zip];
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

/** Alabama ZIP codes run 350xx to 369xx. */
export function isAlabamaZip(zip: string): boolean {
  return /^3[5-6]\d{3}$/.test(zip);
}

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(a: Point, b: Point): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Round a device location to about a city block (3 decimals, roughly 110 m)
 * before it is sent anywhere. Enough to sort by distance, not enough to
 * pinpoint a home.
 */
export function coarsen(p: Point): Point {
  return { lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 };
}
