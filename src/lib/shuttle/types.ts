// Kampüs servis saatleri (data/<okul>/shuttle.json).
// Özyeğin kaynağı: ozyegin.edu.tr/tr/iletisim/servis-saatleri sayfasındaki uygulamanın verisi
// (my.ozyegin.edu.tr/backend-api/shuttle/<hat>). Kaynak yalnızca ilk duraktan kalkış saatlerini verir.

export type ShuttleDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ShuttleTrip {
  /** İlk duraktan kalkış, "HH:MM". Kampüsten dönüşte kampüsten kalkış. */
  departure: string;
  /** Kalkış durağı. */
  stop: string;
  /** Kampüse varış; yalnızca kaynak yayımlıyorsa. */
  arrival?: string;
}

/** Aynı sefer listesinin geçerli olduğu gün grubu ("Hafta içi", "Hafta sonu"). */
export interface ShuttleService {
  id: string;
  label: string;
  days: ShuttleDay[];
  /** Kampüse giden seferler. */
  toCampus: ShuttleTrip[];
  /** Kampüsten ayrılan seferler. */
  fromCampus: ShuttleTrip[];
}

export interface ShuttleRoute {
  id: string;
  name: string;
  campusId: string;
  sourceUrl: string;
  sourceRouteIds: number[];
  toCampusStops: string[];
  fromCampusStops: string[];
  fares: string[];
  services: ShuttleService[];
  /** Durak–kampüs süresi; yalnızca kaynak bir süre belirtiyorsa. */
  travelMinutes?: number;
  notes: string[];
}

export interface ShuttleData {
  schoolId: string;
  fetchedAt: string;
  validFrom?: string;
  periodLabel?: string;
  contactPhones?: string[];
  sources: { label: string; url: string }[];
  campuses: { id: string; name: string }[];
  routes: ShuttleRoute[];
}
