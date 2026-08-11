import type { ClientFingerprint } from "@/lib/analytics-types";

export type TrafficLiveWindow = 5 | 30 | 60;

export type MinuteBucket = {
  minute: string;
  pageviews: number;
  uniques: string[];
  byCountry: Record<string, number>;
};

export type VisitorPin = {
  /** Unique key for this map marker (hit id or visitor id). */
  id: string;
  /** Stable visitor hash — multiple hits share one visitorId. */
  visitorId: string;
  shortId: string;
  country: string;
  region: string;
  city: string;
  path: string;
  lastSeen: string;
  pageviews: number;
  platform: string;
  timezone: string;
  language: string;
  screen: string;
  device: "mobile" | "tablet" | "desktop";
  lng: number;
  lat: number;
  hue: number;
  fingerprint: ClientFingerprint | null;
};

export type TrafficLiveSnapshot = {
  generatedAt: string;
  windowMinutes: TrafficLiveWindow;
  pageviews: number;
  uniques: number;
  series: { minute: string; pageviews: number; uniques: number }[];
  byCountry: { country: string; pageviews: number; uniques: number }[];
  /** One pin per live pageview hit (jittered) for the activity map. */
  pins: VisitorPin[];
  /** One pin per distinct visitor for the uniques map. */
  uniquePins: VisitorPin[];
};
