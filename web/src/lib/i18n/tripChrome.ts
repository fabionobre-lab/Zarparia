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
import type { CostCategory } from '../trip-engine';

export interface TripChromeMessages {
	maps: string;
	/** Section headings of the per-stop guide sheet. */
	guideBefore: string;
	guideDontMiss: string;
	guideStory: string;
	guideCloser: string;
	dayRoute: string;
	/** Screen-reader label for the numbered timeline dot ("Stop 5"), tying the
	 *  block to its map pin and its place in the Day Route. */
	stop: string;
	openRoute: string;
	addToCalendar: string;
	/** Hero action + print-page button: open the printable, A4-formatted
	 *  whole-trip document (Save as PDF via the browser's print dialog). */
	printPdf: string;
	/** Back link on the standalone print page, returning to the trip. */
	printBack: string;
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
	/** Budget bar (Phase 6 budget): label, the "{spent} of {budget}" joiner,
	 *  and the remaining/over-spend suffixes. */
	budget: string;
	budgetOf: string;
	budgetLeft: string;
	budgetOver: string;
	/** Localized names for the six cost categories, used as the cost chip's
	 *  accessible label/tooltip (the chip itself shows an emoji + amount). */
	costCat: Record<CostCategory, string>;
	/** Accessible names for the in-place editable fields, also shown as the
	 *  greyed placeholder while a field is empty (Phase 2 WYSIWYG editing).
	 *  These follow the trip content language like everything else rendered
	 *  inside the trip shell — you are editing the trip in the language you are
	 *  currently reading it in. */
	edEyebrow: string;
	edSegTitle: string;
	edSegSubtitle: string;
	edDayTitle: string;
	edDayNote: string;
	edBanner: string;
	edBlockTitle: string;
	edBlockDesc: string;
	edWarning: string;
	edNote: string;
	edFooter: string;
	edChecklistTitle: string;
	edChecklistItem: string;
}

export const tripChrome: Record<'en' | 'pt', TripChromeMessages> = {
	en: {
		maps: 'Open in Maps',
		guideBefore: 'Before you go in',
		guideDontMiss: "Don't miss",
		guideStory: 'The story',
		guideCloser: 'Look closer',
		dayRoute: 'Day Route',
		stop: 'Stop',
		openRoute: 'Open route in Google Maps →',
		addToCalendar: 'Add to calendar',
		printPdf: 'Print / Save as PDF',
		printBack: 'Back to trip',
		now: 'Now',
		photos: 'Photos',
		unmatchedPhotos: 'Photos not on the itinerary',
		openPhoto: 'Open photo',
		wxOffline: '(offline)',
		wxOfflineHint: 'Showing weather saved before you went offline.',
		walkSuffix: 'min walk',
		budget: 'Trip budget',
		budgetOf: 'of',
		budgetLeft: 'left',
		budgetOver: 'over',
		costCat: {
			lodging: 'Lodging',
			food: 'Food',
			transport: 'Transport',
			activities: 'Activities',
			shopping: 'Shopping',
			other: 'Other'
		},
		edEyebrow: 'Dates or theme',
		edSegTitle: 'Segment title',
		edSegSubtitle: 'Dates or a short subtitle',
		edDayTitle: 'Untitled day',
		edDayNote: 'Add a note for this day…',
		edBanner: 'Banner',
		edBlockTitle: 'Untitled stop',
		edBlockDesc: 'Add a description…',
		edWarning: 'Warning',
		edNote: 'Note',
		edFooter: 'Footer',
		edChecklistTitle: 'Checklist title',
		edChecklistItem: 'Checklist item'
	},
	pt: {
		maps: 'Abrir no Maps',
		guideBefore: 'Antes de entrar',
		guideDontMiss: 'Não perca',
		guideStory: 'A história',
		guideCloser: 'Olhe de perto',
		dayRoute: 'Rota do Dia',
		stop: 'Parada',
		openRoute: 'Abrir rota no Google Maps →',
		addToCalendar: 'Adicionar ao calendário',
		printPdf: 'Imprimir / Salvar PDF',
		printBack: 'Voltar à viagem',
		now: 'Agora',
		photos: 'Fotos',
		unmatchedPhotos: 'Fotos fora do roteiro',
		openPhoto: 'Abrir foto',
		wxOffline: '(offline)',
		wxOfflineHint: 'Mostrando o clima salvo antes de você ficar offline.',
		walkSuffix: 'min a pé',
		budget: 'Orçamento da viagem',
		budgetOf: 'de',
		budgetLeft: 'restante',
		budgetOver: 'acima',
		costCat: {
			lodging: 'Hospedagem',
			food: 'Alimentação',
			transport: 'Transporte',
			activities: 'Atividades',
			shopping: 'Compras',
			other: 'Outros'
		},
		edEyebrow: 'Datas ou tema',
		edSegTitle: 'Título do trecho',
		edSegSubtitle: 'Datas ou um subtítulo curto',
		edDayTitle: 'Dia sem título',
		edDayNote: 'Adicionar uma nota para o dia…',
		edBanner: 'Faixa',
		edBlockTitle: 'Parada sem título',
		edBlockDesc: 'Adicionar uma descrição…',
		edWarning: 'Aviso',
		edNote: 'Nota',
		edFooter: 'Rodapé',
		edChecklistTitle: 'Título da lista',
		edChecklistItem: 'Item da lista'
	}
};

/** String-valued trip-chrome keys (i.e. every key except the nested `costCat`
 *  record, which callers read directly off the resolved catalog). */
type TripChromeStringKey = {
	[K in keyof TripChromeMessages]: TripChromeMessages[K] extends string ? K : never;
}[keyof TripChromeMessages];

/** Translate a trip-chrome key for the trip content language. Trips can carry
 *  arbitrary language codes; anything that isn't 'pt' falls back to English
 *  (matching TripView's original `lang === 'pt' ? … : …` behavior). */
export function tripT(lang: string, key: TripChromeStringKey): string {
	return tripChrome[lang === 'pt' ? 'pt' : 'en'][key];
}
