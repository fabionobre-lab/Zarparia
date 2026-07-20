// Typed catalog for TripView's trip-chrome strings (the "Open in Maps" /
// "Day Route" / photo labels that render INSIDE the trip shell).
//
// This is deliberately NOT part of the main UI catalog (messages.ts): these
// strings follow the TRIP CONTENT language — the per-trip EN|PT hero toggle
// (`lang`, seeded from trip.defaultLanguage) — not the app's UI locale, so
// `t()` (which reads the module-level active UI locale) can't express them.
// The single Messages-style interface below gives them the same compile-time
// safety as the main catalog: a key missing from either language is a type
// error.
export interface TripChromeMessages {
	maps: string;
	dayRoute: string;
	openRoute: string;
	addToCalendar: string;
	now: string;
	photos: string;
	unmatchedPhotos: string;
	openPhoto: string;
	/** Small muted suffix on a weather badge when offline + showing
	 *  cached/static data (Phase 6 item 5, audit weakest-point 10). */
	wxOffline: string;
	/** Tooltip on that same badge, spelling out why. */
	wxOfflineHint: string;
	/** Suffix after the estimated minutes on a walking-time hint, e.g.
	 *  "~15 min {walkSuffix}" (Phase 6 item 3). */
	walkSuffix: string;
}

export const tripChrome: Record<'en' | 'pt', TripChromeMessages> = {
	en: {
		maps: 'Open in Maps',
		dayRoute: 'Day Route',
		openRoute: 'Open route in Google Maps →',
		addToCalendar: 'Add to calendar',
		now: 'Now',
		photos: 'Photos',
		unmatchedPhotos: 'Photos not on the itinerary',
		openPhoto: 'Open photo',
		wxOffline: '(offline)',
		wxOfflineHint: 'Showing weather saved before you went offline.',
		walkSuffix: 'min walk'
	},
	pt: {
		maps: 'Abrir no Maps',
		dayRoute: 'Rota do Dia',
		openRoute: 'Abrir rota no Google Maps →',
		addToCalendar: 'Adicionar ao calendário',
		now: 'Agora',
		photos: 'Fotos',
		unmatchedPhotos: 'Fotos fora do roteiro',
		openPhoto: 'Abrir foto',
		wxOffline: '(offline)',
		wxOfflineHint: 'Mostrando o clima salvo antes de você ficar offline.',
		walkSuffix: 'min a pé'
	}
};

/** Translate a trip-chrome key for the trip content language. Trips can carry
 *  arbitrary language codes; anything that isn't 'pt' falls back to English
 *  (matching TripView's original `lang === 'pt' ? … : …` behavior). */
export function tripT(lang: string, key: keyof TripChromeMessages): string {
	return tripChrome[lang === 'pt' ? 'pt' : 'en'][key];
}
