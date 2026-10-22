// Data models shared across shadestop.

export type LatLon = { lat: number; lon: number };

export type StopKind = "origin" | "destination" | "transit" | "walk";

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  gtfsStopId?: string;
  kind?: StopKind;
}

export type TravelMode = "walk" | "bus" | "train" | "tram" | "ferry" | "ride";

// Only walking legs are heat-exposed. Vehicle legs are not scored.
export interface Leg {
  from: string; // stop id
  to: string; // stop id
  mode: TravelMode;
  minutes: number;
}

export interface CommutePlan {
  name?: string;
  date?: string; // YYYY-MM-DD, defaults to today
  origin: Stop;
  destination: Stop;
  stops: Stop[]; // intermediate stops
  legs: Leg[];
}

export interface ForecastHour {
  hour: number; // 0..23 local
  tempC: number;
  rhPct: number;
  solarRadiationWm2: number;
}

export interface ForecastDay {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  hours: ForecastHour[];
  utcOffsetSeconds?: number; // from Open-Meteo: hourUtc = localHour - offset/3600
}

export interface ShadeAssets {
  trees: number;
  shelters: number;
  fountains: number;
}

export interface ShadeInfo {
  assets: ShadeAssets;
  shadeFraction: number; // 0..1
  shelterWithin50m: boolean;
  fountainWithin30m: boolean;
}

export type HeatRisk = "low" | "medium" | "high";

export interface StopScore {
  stopId: string;
  name: string;
  lat: number;
  lon: number;
  shadeFraction: number;
  trees: number;
  shelters: number;
  fountains: number;
  apparentTempC: number;
  heatRisk: HeatRisk;
  exposureScore: number; // 0..100, higher = worse
}

export interface LegScore {
  legIndex: number;
  from: string;
  to: string;
  mode: TravelMode;
  minutes: number;
  exposed: boolean; // walking legs only
  exposureScore: number;
}

export interface CommuteScore {
  date: string;
  total: number; // 0..100
  stops: StopScore[];
  legs: LegScore[];
}

export interface DepartureSuggestion {
  hour: number; // local
  score: number; // commute exposure at that departure
  apparentTempC: number;
}
