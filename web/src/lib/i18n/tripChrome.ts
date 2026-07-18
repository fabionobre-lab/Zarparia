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
		openPhoto: 'Open photo'
	},
	pt: {
		maps: 'Abrir no Maps',
		dayRoute: 'Rota do Dia',
		openRoute: 'Abrir rota no Google Maps →',
		addToCalendar: 'Adicionar ao calendário',
		now: 'Agora',
		photos: 'Fotos',
		unmatchedPhotos: 'Fotos fora do roteiro',
		openPhoto: 'Abrir foto'
	}
};

/** Translate a trip-chrome key for the trip content language. Trips can carry
 *  arbitrary language codes; anything that isn't 'pt' falls back to English
 *  (matching TripView's original `lang === 'pt' ? … : …` behavior). */
export function tripT(lang: string, key: keyof TripChromeMessages): string {
	return tripChrome[lang === 'pt' ? 'pt' : 'en'][key];
}
