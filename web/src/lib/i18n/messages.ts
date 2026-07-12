// Application-UI language catalog (chrome only). This is the app's own UI
// language and is a DIFFERENT concern from a trip's CONTENT language (handled
// inside TripView.svelte / trip-engine). Two locales are supported: 'en-GB'
// (default) and 'pt-BR'.
//
// A single `Messages` type describes every key; both catalogs are typed as
// `Messages`, so a missing or misspelled key in either language is a compile
// error. Values may contain {placeholder} tokens interpolated by `t()`.

export type Locale = 'en-GB' | 'pt-BR';

export const LOCALES: Locale[] = ['en-GB', 'pt-BR'];
export const DEFAULT_LOCALE: Locale = 'en-GB';

/** Short label shown in the EN | PT switcher. */
export const LOCALE_SHORT: Record<Locale, string> = {
	'en-GB': 'EN',
	'pt-BR': 'PT'
};

export interface Messages {
	// ── Header (+layout.svelte) ──
	'header.signOut': string;
	'header.signInGoogle': string;
	'header.language': string; // aria-label for the switcher group
	// ── Theme toggle (aria-label/title reflect the CURRENT mode) ──
	'theme.system': string;
	'theme.dark': string;
	'theme.light': string;

	// ── Signed-out landing (+page.svelte) ──
	'landing.tagline': string;
	'landing.toGetStarted': string;

	// ── Home / trip list (+page.svelte) ──
	'home.pageTitle': string;
	'home.yourTrips': string;
	'home.importItinerary': string;
	'home.newTrip': string;
	'home.noTrips': string;
	'home.createFirst': string;
	'home.sharedWithYou': string;
	'home.statusPast': string;
	'home.statusNow': string;
	'home.statusUpcoming': string;
	'home.activeEyebrow': string;
	'home.dayOfTotal': string; // "Day {day} of {total}"
	'home.nextLabel': string; // "Next" (prefixes "Next: <title> · HH:MM")

	// ── Role labels (home cards + trip bar) ──
	'role.canEdit': string;
	'role.viewOnly': string;

	// ── Trip view top bar (trips/[id]/+page.svelte) ──
	'tripbar.allTrips': string;
	'tripbar.share': string;
	'tripbar.close': string;
	'tripbar.edit': string;
	'tripbar.shared': string;

	// ── Share panel (SharePanel.svelte) ──
	'share.heading': string;
	'share.linkSharing': string;
	'share.linkOff': string;
	'share.linkCanView': string;
	'share.linkCanEdit': string;
	'share.shareableLink': string;
	'share.copy': string;
	'share.copied': string;
	'share.copiedAnnounce': string;
	'share.emailPlaceholder': string;
	'share.optionCanView': string;
	'share.optionCanEdit': string;
	'share.shareButton': string;
	'share.loading': string;
	'share.notSharedYet': string;
	'share.remove': string;
	'share.hint': string;
	'share.errLoad': string;
	'share.errLoadLink': string;
	'share.errTurnOff': string;
	'share.errUpdateLink': string;
	'share.errNetwork': string;
	'share.errCopy': string;
	'share.errShare': string;
	'share.errRemove': string;

	// ── Creation wizard (CreationWizard.svelte) ──
	'wizard.pageTitle': string;
	'wizard.newTrip': string;
	'wizard.startBlank': string;
	'wizard.step1': string;
	'wizard.step2': string;
	'wizard.tripTitle': string;
	'wizard.tripTitlePlaceholder': string;
	'wizard.startDate': string;
	'wizard.languages': string;
	'wizard.addLanguage': string;
	'wizard.langCodePlaceholder': string;
	'wizard.newLangCodeAria': string;
	'wizard.default': string;
	'wizard.timezone': string;
	'wizard.appliedAllStops': string;
	'wizard.homeBase': string;
	'wizard.optional': string;
	'wizard.homePlaceholder': string;
	'wizard.nextStops': string;
	'wizard.stops': string;
	'wizard.addStop': string;
	'wizard.stopNamePlaceholder': string;
	'wizard.stopNameAria': string;
	'wizard.nights': string;
	'wizard.moveStopUp': string;
	'wizard.moveStopDown': string;
	'wizard.removeStop': string;
	'wizard.nightsWord': string;
	'wizard.daysWord': string;
	'wizard.addStopHint': string;
	'wizard.back': string;
	'wizard.createTrip': string;
	'wizard.creating': string;
	'wizard.lookingUpCoords': string;
	'wizard.errTitle': string;
	'wizard.errStartDate': string;
	'wizard.errAddStop': string;
	'wizard.errLangCode': string;
	'wizard.errLangDup': string;

	// ── Shared editor button/label vocabulary ──
	'common.add': string;
	'common.cancel': string;
	'common.daily': string;
	'common.hourly': string;

	// ── Trip editor (TripEditor.svelte) ──
	'editor.cancel': string;
	'editor.saveTrip': string;
	'editor.saving': string;
	'editor.editLabel': string;
	'editor.pleaseFix': string;
	'editor.tripSettings': string;
	'editor.tripTitle': string;
	'editor.eyebrow': string;
	'editor.languages': string;
	'editor.addLanguage': string;
	'editor.langCodePlaceholder': string;
	'editor.newLangCodeAria': string;
	'editor.default': string;
	'editor.locale': string;
	'editor.homeBase': string;
	'editor.findPlace': string;
	'editor.name': string;
	'editor.postcode': string;
	'editor.lat': string;
	'editor.lon': string;
	'editor.tagVocabulary': string;
	'editor.addTag': string;
	'editor.label': string;
	'editor.tagLabelPlaceholder': string;
	'editor.newTagLabelAria': string;
	'editor.key': string;
	'editor.auto': string;
	'editor.newTagKeyAria': string;
	'editor.tagStyleAria': string;
	'editor.segments': string;
	'editor.addSegment': string;
	'editor.livePreview': string;
	'editor.previewPlaceholder': string;
	'editor.errLangCode': string;
	'editor.errLangDup': string;
	'editor.errTagLabel': string;
	'editor.errTagKey': string;
	'editor.errTagKeyDup': string;
	'editor.errTripEmpty': string;
	'editor.errGiveTitle': string;
	'editor.errSaveFailed': string;
	'editor.errNetworkSave': string;
	'editor.discardConfirm': string;

	// ── Segment editor (SegmentEditor.svelte) ──
	'seg.dragReorder': string;
	'seg.moveUp': string;
	'seg.moveDown': string;
	'seg.remove': string;
	'seg.placeholder': string;
	'seg.segmentId': string;
	'seg.autoPlaceholder': string;
	'seg.internalKey': string;
	'seg.theme': string;
	'seg.segmentTitle': string;
	'seg.subtitle': string;
	'seg.footer': string;
	'seg.customColors': string;
	'seg.headerBg': string;
	'seg.accent': string;
	'seg.eyebrow': string;
	'seg.liveWeather': string;
	'seg.findPlaceLatLon': string;
	'seg.granularity': string;
	'seg.timezone': string;
	'seg.plans': string;
	'seg.plansAsTabs': string;
	'seg.addPlan': string;
	'seg.defaultPlan': string;

	// ── Plan editor (PlanEditor.svelte) ──
	'plan.moveUp': string;
	'plan.moveDown': string;
	'plan.remove': string;
	'plan.idAria': string;
	'plan.label': string;
	'plan.diffAnnotations': string;
	'plan.addedPrefix': string;
	'plan.changedPrefix': string;
	'plan.keptPrefix': string;
	'plan.days': string;
	'plan.addDay': string;

	// ── Day editor (DayEditor.svelte) ──
	'day.dragReorder': string;
	'day.noDate': string;
	'day.untitled': string;
	'day.moveUp': string;
	'day.moveDown': string;
	'day.duplicate': string;
	'day.duplicateAria': string;
	'day.removeAria': string;
	'day.dateIso': string;
	'day.routeMode': string;
	'day.routeNone': string;
	'day.walking': string;
	'day.driving': string;
	'day.transit': string;
	'day.bicycling': string;
	'day.dayTitle': string;
	'day.dayNote': string;
	'day.banner': string;
	'day.kmOverride': string;
	'day.storedWeather': string;
	'day.highC': string;
	'day.lowC': string;
	'day.emoji': string;
	'day.blocks': string;
	'day.addBlock': string;

	// ── Block editor (BlockEditor.svelte) ──
	'block.dragReorder': string;
	'block.untitled': string;
	'block.moveUp': string;
	'block.moveDown': string;
	'block.duplicateAria': string;
	'block.removeAria': string;
	'block.time': string;
	'block.timePlaceholder': string;
	'block.dotColor': string;
	'block.title': string;
	'block.tags': string;
	'block.description': string;
	'block.findPlace': string;
	'block.mapsUrl': string;
	'block.walkKm': string;
	'block.lat': string;
	'block.lon': string;
	'block.warning': string;
	'block.note': string;
	'block.waypoints': string;
	'block.waypointQueryAria': string;
	'block.name': string;
	'block.photoSpots': string;
	'block.captionPlaceholder': string;
	'block.photoCaptionAria': string;
	'block.photoMapsPlaceholder': string;
	'block.photoMapsAria': string;
	'block.wikiPlaceholder': string;
	'block.wikiAria': string;
	'block.fallbackImgPlaceholder': string;
	'block.fallbackImgAria': string;
	'block.planDiff': string;
	'block.diffNone': string;
	'block.diffAdded': string;
	'block.diffChanged': string;
	'block.diffKept': string;
	'block.diffReason': string;

	// ── Place search (PlaceSearch.svelte) ──
	'place.findPlace': string;
	'place.searchPlaceholder': string;
	'place.noResults': string;
	'place.searching': string;

	// ── Import page (trips/import/+page.svelte) ──
	'import.pageTitle': string;
	'import.back': string;
	'import.heading': string;
	'import.lede': string;
	'import.textareaAria': string;
	'import.importBtn': string;
	'import.reading': string;
	'import.readingLong': string;
	'import.errFailed': string;
	'import.errNetwork': string;
	'import.hint422': string;
	'import.errNotConfigured': string;
	'import.errTooLong': string;
	'import.errEmpty': string;
	'import.err422': string;

	// ── Join / invite pages (join/[token]/+page.svelte) ──
	'join.signInHeading': string;
	'join.signInBody': string;
	'join.signInDev': string;
	'join.invalidHeading': string;
	'join.invalidBody': string;
	'join.goToTrips': string;

	// ── Feedback (header button, FeedbackDialog, feedback/+page.svelte) ──
	'feedback.button': string;
	'feedback.title': string;
	'feedback.typeLabel': string; // aria-label for the Bug/Idea/Other group
	'feedback.typeBug': string;
	'feedback.typeIdea': string;
	'feedback.typeOther': string;
	'feedback.messageLabel': string; // textarea aria-label
	'feedback.messagePlaceholder': string;
	'feedback.submit': string;
	'feedback.sending': string;
	'feedback.close': string; // aria-label for the dialog ✕
	'feedback.successTitle': string;
	'feedback.viewYours': string;
	'feedback.errEmpty': string;
	'feedback.errTooLong': string;
	'feedback.errFailed': string;
	'feedback.errNetwork': string;
	'feedback.pageTitle': string;
	'feedback.heading': string;
	'feedback.adminHeading': string;
	'feedback.back': string;
	'feedback.empty': string;
	'feedback.statusLabel': string; // aria-label for the admin status <select>
	'feedback.statusNew': string;
	'feedback.statusPlanned': string;
	'feedback.statusDone': string;
	'feedback.statusDismissed': string;
}

const enGB: Messages = {
	'header.signOut': 'Sign out',
	'header.signInGoogle': 'Sign in with Google',
	'header.language': 'Language',
	'theme.system': 'Theme: system',
	'theme.dark': 'Theme: dark',
	'theme.light': 'Theme: light',

	'landing.tagline': 'A place for your travel itineraries.',
	'landing.toGetStarted': 'to get started.',

	'home.pageTitle': 'geornada',
	'home.yourTrips': 'Your trips',
	'home.importItinerary': 'Import itinerary',
	'home.newTrip': '+ New trip',
	'home.noTrips': 'No trips yet.',
	'home.createFirst': 'Create your first one.',
	'home.sharedWithYou': 'Shared with you',
	'home.statusPast': 'Past',
	'home.statusNow': 'Now',
	'home.statusUpcoming': 'Upcoming',
	'home.activeEyebrow': 'Happening now',
	'home.dayOfTotal': 'Day {day} of {total}',
	'home.nextLabel': 'Next',

	'role.canEdit': 'can edit',
	'role.viewOnly': 'view only',

	'tripbar.allTrips': '← All trips',
	'tripbar.share': 'Share',
	'tripbar.close': 'Close',
	'tripbar.edit': 'Edit',
	'tripbar.shared': 'Shared',

	'share.heading': 'Share this trip',
	'share.linkSharing': 'Link sharing',
	'share.linkOff': 'Off',
	'share.linkCanView': 'Anyone with the link can view',
	'share.linkCanEdit': 'Anyone with the link can edit',
	'share.shareableLink': 'Shareable link',
	'share.copy': 'Copy',
	'share.copied': 'Copied',
	'share.copiedAnnounce': 'Link copied to clipboard',
	'share.emailPlaceholder': 'person@email.com',
	'share.optionCanView': 'can view',
	'share.optionCanEdit': 'can edit',
	'share.shareButton': 'Share',
	'share.loading': 'Loading…',
	'share.notSharedYet': 'Not shared with anyone yet.',
	'share.remove': 'Remove',
	'share.hint': 'People must sign in once before you can share with them.',
	'share.errLoad': 'Could not load sharing info.',
	'share.errLoadLink': 'Could not load link info.',
	'share.errTurnOff': 'Could not turn off the link.',
	'share.errUpdateLink': 'Could not update the link.',
	'share.errNetwork': 'Network error.',
	'share.errCopy': 'Could not copy. Select the link and copy manually.',
	'share.errShare': 'Could not share.',
	'share.errRemove': 'Could not remove this person.',

	'wizard.pageTitle': 'New trip — geornada',
	'wizard.newTrip': 'New trip',
	'wizard.startBlank': 'Start from a blank trip →',
	'wizard.step1': '1 · Trip',
	'wizard.step2': '2 · Stops',
	'wizard.tripTitle': 'Trip title',
	'wizard.tripTitlePlaceholder': 'e.g. Italy — September 2026',
	'wizard.startDate': 'Start date',
	'wizard.languages': 'Languages',
	'wizard.addLanguage': '+ Language',
	'wizard.langCodePlaceholder': 'Code, e.g. it',
	'wizard.newLangCodeAria': 'New language code',
	'wizard.default': 'Default',
	'wizard.timezone': 'Timezone',
	'wizard.appliedAllStops': 'applied to all stops',
	'wizard.homeBase': 'Home base',
	'wizard.optional': 'optional',
	'wizard.homePlaceholder': 'e.g. Home (South Hampstead)',
	'wizard.nextStops': 'Next: Stops →',
	'wizard.stops': 'Stops',
	'wizard.addStop': '+ Add stop',
	'wizard.stopNamePlaceholder': 'Place name, e.g. Rome',
	'wizard.stopNameAria': 'Stop name',
	'wizard.nights': 'Nights',
	'wizard.moveStopUp': 'Move stop up',
	'wizard.moveStopDown': 'Move stop down',
	'wizard.removeStop': 'Remove stop',
	'wizard.nightsWord': 'nights',
	'wizard.daysWord': 'days',
	'wizard.addStopHint': 'Add a stop with nights to see the end date.',
	'wizard.back': '← Back',
	'wizard.createTrip': 'Create trip',
	'wizard.creating': 'Creating…',
	'wizard.lookingUpCoords': 'Looking up coordinates for each stop…',
	'wizard.errTitle': 'Give the trip a title.',
	'wizard.errStartDate': 'Pick a start date.',
	'wizard.errAddStop': 'Add at least one stop.',
	'wizard.errLangCode': 'Use a 2+ letter code, e.g. "it".',
	'wizard.errLangDup': '"{code}" is already added.',

	'common.add': 'Add',
	'common.cancel': 'Cancel',
	'common.daily': 'daily',
	'common.hourly': 'hourly',

	'editor.cancel': '← Cancel',
	'editor.saveTrip': 'Save trip',
	'editor.saving': 'Saving…',
	'editor.editLabel': 'Edit',
	'editor.pleaseFix': 'Please fix:',
	'editor.tripSettings': 'Trip settings',
	'editor.tripTitle': 'Trip title',
	'editor.eyebrow': 'Eyebrow (e.g. April 2026)',
	'editor.languages': 'Languages',
	'editor.addLanguage': '+ Language',
	'editor.langCodePlaceholder': 'Code, e.g. es',
	'editor.newLangCodeAria': 'New language code',
	'editor.default': 'Default',
	'editor.locale': 'Locale (date format, e.g. en-GB)',
	'editor.homeBase': 'Home base',
	'editor.findPlace': 'Find place',
	'editor.name': 'Name',
	'editor.postcode': 'Postcode',
	'editor.lat': 'Lat',
	'editor.lon': 'Lon',
	'editor.tagVocabulary': 'Tag vocabulary',
	'editor.addTag': '+ Tag',
	'editor.label': 'Label',
	'editor.tagLabelPlaceholder': 'e.g. Museum',
	'editor.newTagLabelAria': 'New tag label',
	'editor.key': 'Key',
	'editor.auto': 'auto',
	'editor.newTagKeyAria': 'New tag key',
	'editor.tagStyleAria': 'Tag style',
	'editor.segments': 'Segments',
	'editor.addSegment': '+ Add segment',
	'editor.livePreview': 'Live preview',
	'editor.previewPlaceholder': 'Preview appears as you add trip details',
	'editor.errLangCode': 'Use a 2+ letter code, e.g. "es".',
	'editor.errLangDup': '"{code}" is already added.',
	'editor.errTagLabel': 'Give the tag a label.',
	'editor.errTagKey': 'Key must be lowercase letters/numbers.',
	'editor.errTagKeyDup': 'Key "{key}" already exists.',
	'editor.errTripEmpty': 'Trip is empty.',
	'editor.errGiveTitle': 'Give the trip a title',
	'editor.errSaveFailed': 'Save failed ({status})',
	'editor.errNetworkSave': 'Network error while saving.',
	'editor.discardConfirm': 'Discard unsaved changes?',

	'seg.dragReorder': 'Drag to reorder segment',
	'seg.moveUp': 'Move segment up',
	'seg.moveDown': 'Move segment down',
	'seg.remove': 'Remove segment',
	'seg.placeholder': '(segment)',
	'seg.segmentId': 'Segment id',
	'seg.autoPlaceholder': 'auto',
	'seg.internalKey': 'internal key, auto-generated',
	'seg.theme': 'Theme',
	'seg.segmentTitle': 'Segment title',
	'seg.subtitle': 'Subtitle',
	'seg.footer': 'Footer',
	'seg.customColors': 'Custom colors (override theme)',
	'seg.headerBg': 'Header bg',
	'seg.accent': 'Accent',
	'seg.eyebrow': 'Eyebrow',
	'seg.liveWeather': 'Live weather',
	'seg.findPlaceLatLon': 'Find place (sets lat/lon)',
	'seg.granularity': 'Granularity',
	'seg.timezone': 'Timezone',
	'seg.plans': 'Plans',
	'seg.plansAsTabs': '(shown as tabs)',
	'seg.addPlan': '+ Add plan variant',
	'seg.defaultPlan': 'Default plan',

	'plan.moveUp': 'Move plan up',
	'plan.moveDown': 'Move plan down',
	'plan.remove': 'Remove plan',
	'plan.idAria': 'Plan id',
	'plan.label': 'Plan label (tab)',
	'plan.diffAnnotations': 'Diff annotations (prefix labels)',
	'plan.addedPrefix': 'Added prefix',
	'plan.changedPrefix': 'Changed prefix',
	'plan.keptPrefix': 'Kept prefix',
	'plan.days': 'Days',
	'plan.addDay': '+ Add day',

	'day.dragReorder': 'Drag to reorder day',
	'day.noDate': 'no date',
	'day.untitled': '(untitled day)',
	'day.moveUp': 'Move day up',
	'day.moveDown': 'Move day down',
	'day.duplicate': 'Duplicate',
	'day.duplicateAria': 'Duplicate day',
	'day.removeAria': 'Remove day',
	'day.dateIso': 'Date (ISO)',
	'day.routeMode': 'Route mode',
	'day.routeNone': '(none)',
	'day.walking': 'walking',
	'day.driving': 'driving',
	'day.transit': 'transit',
	'day.bicycling': 'bicycling',
	'day.dayTitle': 'Day title',
	'day.dayNote': 'Day note',
	'day.banner': 'Banner (celebration strip)',
	'day.kmOverride': 'Total km override (optional)',
	'day.storedWeather': 'Stored weather (for past trips)',
	'day.highC': 'High °C',
	'day.lowC': 'Low °C',
	'day.emoji': 'Emoji',
	'day.blocks': 'Blocks',
	'day.addBlock': '+ Add block',

	'block.dragReorder': 'Drag to reorder block',
	'block.untitled': '(untitled block)',
	'block.moveUp': 'Move block up',
	'block.moveDown': 'Move block down',
	'block.duplicateAria': 'Duplicate block',
	'block.removeAria': 'Remove block',
	'block.time': 'Time',
	'block.timePlaceholder': '09:30 or ~14:00',
	'block.dotColor': 'Dot color',
	'block.title': 'Title',
	'block.tags': 'Tags',
	'block.description': 'Description',
	'block.findPlace': 'Find place',
	'block.mapsUrl': 'Maps URL',
	'block.walkKm': 'Walk (km)',
	'block.lat': 'Lat',
	'block.lon': 'Lon',
	'block.warning': 'Warning',
	'block.note': 'Note',
	'block.waypoints': 'Waypoints',
	'block.waypointQueryAria': 'Waypoint maps query',
	'block.name': 'Name',
	'block.photoSpots': 'Photo spots',
	'block.captionPlaceholder': 'Caption',
	'block.photoCaptionAria': 'Photo spot caption',
	'block.photoMapsPlaceholder': 'Maps URL',
	'block.photoMapsAria': 'Photo spot maps URL',
	'block.wikiPlaceholder': 'Wikipedia page title (optional)',
	'block.wikiAria': 'Photo spot Wikipedia page title',
	'block.fallbackImgPlaceholder': 'Fallback image URL (optional)',
	'block.fallbackImgAria': 'Photo spot fallback image URL',
	'block.planDiff': 'Plan diff',
	'block.diffNone': 'none',
	'block.diffAdded': 'added',
	'block.diffChanged': 'changed',
	'block.diffKept': 'kept',
	'block.diffReason': 'Diff reason',

	'place.findPlace': 'Find place',
	'place.searchPlaceholder': 'Search for a place…',
	'place.noResults': 'No results',
	'place.searching': 'Searching…',

	'import.pageTitle': 'Import an itinerary',
	'import.back': '← Trips',
	'import.heading': 'Import an itinerary',
	'import.lede':
		"Paste a rough itinerary in any form and we'll turn it into a draft trip you can refine in the editor.",
	'import.textareaAria': 'Itinerary text',
	'import.importBtn': 'Import',
	'import.reading': 'Reading your itinerary…',
	'import.readingLong': 'Reading your itinerary… this takes ~30–60s.',
	'import.errFailed': 'Import failed ({status}).',
	'import.errNetwork': 'Network error. Please check your connection and try again.',
	'import.hint422': 'Try adding explicit dates (e.g. "arriving 5 September 2026") and importing again.',
	'import.errNotConfigured': "Import isn't set up on this server yet.",
	'import.errTooLong': 'That itinerary is too long. Please shorten it and try again.',
	'import.errEmpty': 'Paste an itinerary to import.',
	'import.err422': "We couldn't turn that into a trip.",

	'join.signInHeading': 'Sign in to open this invite',
	'join.signInBody': 'You need to sign in before you can join this trip.',
	'join.signInDev': 'Sign in (dev)',
	'join.invalidHeading': 'This invite link is no longer valid',
	'join.invalidBody': 'The link may have been revoked or the trip removed.',
	'join.goToTrips': 'Go to my trips',

	'feedback.button': 'Feedback',
	'feedback.title': 'Send feedback',
	'feedback.typeLabel': 'Type of feedback',
	'feedback.typeBug': 'Bug',
	'feedback.typeIdea': 'Idea',
	'feedback.typeOther': 'Other',
	'feedback.messageLabel': 'Your feedback',
	'feedback.messagePlaceholder': "Tell us what's on your mind — a bug, an idea, anything.",
	'feedback.submit': 'Send',
	'feedback.sending': 'Sending…',
	'feedback.close': 'Close',
	'feedback.successTitle': 'Thanks — feedback sent',
	'feedback.viewYours': 'View your feedback',
	'feedback.errEmpty': 'Please enter a message.',
	'feedback.errTooLong': 'Message is too long (max 2000 characters).',
	'feedback.errFailed': 'Could not send feedback.',
	'feedback.errNetwork': 'Network error. Please try again.',
	'feedback.pageTitle': 'Feedback — geornada',
	'feedback.heading': 'Your feedback',
	'feedback.adminHeading': 'All feedback',
	'feedback.back': '← Trips',
	'feedback.empty': 'No feedback yet.',
	'feedback.statusLabel': 'Status',
	'feedback.statusNew': 'New',
	'feedback.statusPlanned': 'Planned',
	'feedback.statusDone': 'Done',
	'feedback.statusDismissed': 'Dismissed'
};

const ptBR: Messages = {
	'header.signOut': 'Sair',
	'header.signInGoogle': 'Entrar com Google',
	'header.language': 'Idioma',
	'theme.system': 'Tema: sistema',
	'theme.dark': 'Tema: escuro',
	'theme.light': 'Tema: claro',

	'landing.tagline': 'Um lugar para os seus roteiros de viagem.',
	'landing.toGetStarted': 'para começar.',

	'home.pageTitle': 'Viagens',
	'home.yourTrips': 'Suas viagens',
	'home.importItinerary': 'Importar roteiro',
	'home.newTrip': '+ Nova viagem',
	'home.noTrips': 'Nenhuma viagem ainda.',
	'home.createFirst': 'Crie a sua primeira.',
	'home.sharedWithYou': 'Compartilhadas com você',
	'home.statusPast': 'Passada',
	'home.statusNow': 'Agora',
	'home.statusUpcoming': 'Futura',
	'home.activeEyebrow': 'Acontecendo agora',
	'home.dayOfTotal': 'Dia {day} de {total}',
	'home.nextLabel': 'Próximo',

	'role.canEdit': 'pode editar',
	'role.viewOnly': 'somente leitura',

	'tripbar.allTrips': '← Todas as viagens',
	'tripbar.share': 'Compartilhar',
	'tripbar.close': 'Fechar',
	'tripbar.edit': 'Editar',
	'tripbar.shared': 'Compartilhada',

	'share.heading': 'Compartilhar esta viagem',
	'share.linkSharing': 'Compartilhar por link',
	'share.linkOff': 'Desativado',
	'share.linkCanView': 'Qualquer pessoa com o link pode ver',
	'share.linkCanEdit': 'Qualquer pessoa com o link pode editar',
	'share.shareableLink': 'Link compartilhável',
	'share.copy': 'Copiar',
	'share.copied': 'Copiado',
	'share.copiedAnnounce': 'Link copiado para a área de transferência',
	'share.emailPlaceholder': 'pessoa@email.com',
	'share.optionCanView': 'pode ver',
	'share.optionCanEdit': 'pode editar',
	'share.shareButton': 'Compartilhar',
	'share.loading': 'Carregando…',
	'share.notSharedYet': 'Ainda não compartilhada com ninguém.',
	'share.remove': 'Remover',
	'share.hint': 'As pessoas precisam entrar uma vez antes de você poder compartilhar com elas.',
	'share.errLoad': 'Não foi possível carregar as informações de compartilhamento.',
	'share.errLoadLink': 'Não foi possível carregar as informações do link.',
	'share.errTurnOff': 'Não foi possível desativar o link.',
	'share.errUpdateLink': 'Não foi possível atualizar o link.',
	'share.errNetwork': 'Erro de rede.',
	'share.errCopy': 'Não foi possível copiar. Selecione o link e copie manualmente.',
	'share.errShare': 'Não foi possível compartilhar.',
	'share.errRemove': 'Não foi possível remover esta pessoa.',

	'wizard.pageTitle': 'Nova viagem — geornada',
	'wizard.newTrip': 'Nova viagem',
	'wizard.startBlank': 'Começar com uma viagem em branco →',
	'wizard.step1': '1 · Viagem',
	'wizard.step2': '2 · Paradas',
	'wizard.tripTitle': 'Título da viagem',
	'wizard.tripTitlePlaceholder': 'ex.: Itália — setembro de 2026',
	'wizard.startDate': 'Data de início',
	'wizard.languages': 'Idiomas',
	'wizard.addLanguage': '+ Idioma',
	'wizard.langCodePlaceholder': 'Código, ex.: it',
	'wizard.newLangCodeAria': 'Novo código de idioma',
	'wizard.default': 'Padrão',
	'wizard.timezone': 'Fuso horário',
	'wizard.appliedAllStops': 'aplicado a todas as paradas',
	'wizard.homeBase': 'Base de origem',
	'wizard.optional': 'opcional',
	'wizard.homePlaceholder': 'ex.: Casa (South Hampstead)',
	'wizard.nextStops': 'Próximo: Paradas →',
	'wizard.stops': 'Paradas',
	'wizard.addStop': '+ Adicionar parada',
	'wizard.stopNamePlaceholder': 'Nome do lugar, ex.: Roma',
	'wizard.stopNameAria': 'Nome da parada',
	'wizard.nights': 'Noites',
	'wizard.moveStopUp': 'Mover parada para cima',
	'wizard.moveStopDown': 'Mover parada para baixo',
	'wizard.removeStop': 'Remover parada',
	'wizard.nightsWord': 'noites',
	'wizard.daysWord': 'dias',
	'wizard.addStopHint': 'Adicione uma parada com noites para ver a data final.',
	'wizard.back': '← Voltar',
	'wizard.createTrip': 'Criar viagem',
	'wizard.creating': 'Criando…',
	'wizard.lookingUpCoords': 'Buscando as coordenadas de cada parada…',
	'wizard.errTitle': 'Dê um título à viagem.',
	'wizard.errStartDate': 'Escolha uma data de início.',
	'wizard.errAddStop': 'Adicione pelo menos uma parada.',
	'wizard.errLangCode': 'Use um código de 2 letras ou mais, ex.: "it".',
	'wizard.errLangDup': '"{code}" já foi adicionado.',

	'common.add': 'Adicionar',
	'common.cancel': 'Cancelar',
	'common.daily': 'diário',
	'common.hourly': 'por hora',

	'editor.cancel': '← Cancelar',
	'editor.saveTrip': 'Salvar viagem',
	'editor.saving': 'Salvando…',
	'editor.editLabel': 'Editar',
	'editor.pleaseFix': 'Corrija:',
	'editor.tripSettings': 'Configurações da viagem',
	'editor.tripTitle': 'Título da viagem',
	'editor.eyebrow': 'Sobrelinha (ex.: abril de 2026)',
	'editor.languages': 'Idiomas',
	'editor.addLanguage': '+ Idioma',
	'editor.langCodePlaceholder': 'Código, ex.: es',
	'editor.newLangCodeAria': 'Novo código de idioma',
	'editor.default': 'Padrão',
	'editor.locale': 'Localidade (formato de data, ex.: en-GB)',
	'editor.homeBase': 'Base de origem',
	'editor.findPlace': 'Buscar lugar',
	'editor.name': 'Nome',
	'editor.postcode': 'Código postal',
	'editor.lat': 'Lat',
	'editor.lon': 'Lon',
	'editor.tagVocabulary': 'Vocabulário de tags',
	'editor.addTag': '+ Tag',
	'editor.label': 'Rótulo',
	'editor.tagLabelPlaceholder': 'ex.: Museu',
	'editor.newTagLabelAria': 'Novo rótulo de tag',
	'editor.key': 'Chave',
	'editor.auto': 'auto',
	'editor.newTagKeyAria': 'Nova chave de tag',
	'editor.tagStyleAria': 'Estilo da tag',
	'editor.segments': 'Trechos',
	'editor.addSegment': '+ Adicionar trecho',
	'editor.livePreview': 'Pré-visualização',
	'editor.previewPlaceholder': 'A pré-visualização aparece conforme você adiciona detalhes',
	'editor.errLangCode': 'Use um código de 2 letras ou mais, ex.: "es".',
	'editor.errLangDup': '"{code}" já foi adicionado.',
	'editor.errTagLabel': 'Dê um rótulo à tag.',
	'editor.errTagKey': 'A chave deve conter apenas letras minúsculas e números.',
	'editor.errTagKeyDup': 'A chave "{key}" já existe.',
	'editor.errTripEmpty': 'A viagem está vazia.',
	'editor.errGiveTitle': 'Dê um título à viagem',
	'editor.errSaveFailed': 'Falha ao salvar ({status})',
	'editor.errNetworkSave': 'Erro de rede ao salvar.',
	'editor.discardConfirm': 'Descartar as alterações não salvas?',

	'seg.dragReorder': 'Arraste para reordenar o trecho',
	'seg.moveUp': 'Mover trecho para cima',
	'seg.moveDown': 'Mover trecho para baixo',
	'seg.remove': 'Remover trecho',
	'seg.placeholder': '(trecho)',
	'seg.segmentId': 'ID do trecho',
	'seg.autoPlaceholder': 'auto',
	'seg.internalKey': 'chave interna, gerada automaticamente',
	'seg.theme': 'Tema',
	'seg.segmentTitle': 'Título do trecho',
	'seg.subtitle': 'Subtítulo',
	'seg.footer': 'Rodapé',
	'seg.customColors': 'Cores personalizadas (substituem o tema)',
	'seg.headerBg': 'Fundo do cabeçalho',
	'seg.accent': 'Destaque',
	'seg.eyebrow': 'Sobrelinha',
	'seg.liveWeather': 'Clima ao vivo',
	'seg.findPlaceLatLon': 'Buscar lugar (define lat/lon)',
	'seg.granularity': 'Granularidade',
	'seg.timezone': 'Fuso horário',
	'seg.plans': 'Planos',
	'seg.plansAsTabs': '(exibidos como abas)',
	'seg.addPlan': '+ Adicionar variação de plano',
	'seg.defaultPlan': 'Plano padrão',

	'plan.moveUp': 'Mover plano para cima',
	'plan.moveDown': 'Mover plano para baixo',
	'plan.remove': 'Remover plano',
	'plan.idAria': 'ID do plano',
	'plan.label': 'Rótulo do plano (aba)',
	'plan.diffAnnotations': 'Anotações de diferença (rótulos de prefixo)',
	'plan.addedPrefix': 'Prefixo de adicionado',
	'plan.changedPrefix': 'Prefixo de alterado',
	'plan.keptPrefix': 'Prefixo de mantido',
	'plan.days': 'Dias',
	'plan.addDay': '+ Adicionar dia',

	'day.dragReorder': 'Arraste para reordenar o dia',
	'day.noDate': 'sem data',
	'day.untitled': '(dia sem título)',
	'day.moveUp': 'Mover dia para cima',
	'day.moveDown': 'Mover dia para baixo',
	'day.duplicate': 'Duplicar',
	'day.duplicateAria': 'Duplicar dia',
	'day.removeAria': 'Remover dia',
	'day.dateIso': 'Data (ISO)',
	'day.routeMode': 'Modo de rota',
	'day.routeNone': '(nenhum)',
	'day.walking': 'a pé',
	'day.driving': 'de carro',
	'day.transit': 'transporte público',
	'day.bicycling': 'de bicicleta',
	'day.dayTitle': 'Título do dia',
	'day.dayNote': 'Nota do dia',
	'day.banner': 'Faixa (destaque comemorativo)',
	'day.kmOverride': 'Total de km (opcional)',
	'day.storedWeather': 'Clima salvo (para viagens passadas)',
	'day.highC': 'Máx. °C',
	'day.lowC': 'Mín. °C',
	'day.emoji': 'Emoji',
	'day.blocks': 'Blocos',
	'day.addBlock': '+ Adicionar bloco',

	'block.dragReorder': 'Arraste para reordenar o bloco',
	'block.untitled': '(bloco sem título)',
	'block.moveUp': 'Mover bloco para cima',
	'block.moveDown': 'Mover bloco para baixo',
	'block.duplicateAria': 'Duplicar bloco',
	'block.removeAria': 'Remover bloco',
	'block.time': 'Horário',
	'block.timePlaceholder': '09:30 ou ~14:00',
	'block.dotColor': 'Cor do ponto',
	'block.title': 'Título',
	'block.tags': 'Tags',
	'block.description': 'Descrição',
	'block.findPlace': 'Buscar lugar',
	'block.mapsUrl': 'URL do mapa',
	'block.walkKm': 'Caminhada (km)',
	'block.lat': 'Lat',
	'block.lon': 'Lon',
	'block.warning': 'Aviso',
	'block.note': 'Nota',
	'block.waypoints': 'Pontos de passagem',
	'block.waypointQueryAria': 'Consulta de mapa do ponto de passagem',
	'block.name': 'Nome',
	'block.photoSpots': 'Pontos de foto',
	'block.captionPlaceholder': 'Legenda',
	'block.photoCaptionAria': 'Legenda do ponto de foto',
	'block.photoMapsPlaceholder': 'URL do mapa',
	'block.photoMapsAria': 'URL do mapa do ponto de foto',
	'block.wikiPlaceholder': 'Título da página da Wikipédia (opcional)',
	'block.wikiAria': 'Título da página da Wikipédia do ponto de foto',
	'block.fallbackImgPlaceholder': 'URL de imagem alternativa (opcional)',
	'block.fallbackImgAria': 'URL de imagem alternativa do ponto de foto',
	'block.planDiff': 'Diferença de plano',
	'block.diffNone': 'nenhuma',
	'block.diffAdded': 'adicionado',
	'block.diffChanged': 'alterado',
	'block.diffKept': 'mantido',
	'block.diffReason': 'Motivo da diferença',

	'place.findPlace': 'Buscar lugar',
	'place.searchPlaceholder': 'Buscar um lugar…',
	'place.noResults': 'Nenhum resultado',
	'place.searching': 'Buscando…',

	'import.pageTitle': 'Importar um roteiro',
	'import.back': '← Viagens',
	'import.heading': 'Importar um roteiro',
	'import.lede':
		'Cole um roteiro aproximado em qualquer formato e nós o transformaremos em um rascunho de viagem que você pode refinar no editor.',
	'import.textareaAria': 'Texto do roteiro',
	'import.importBtn': 'Importar',
	'import.reading': 'Lendo o seu roteiro…',
	'import.readingLong': 'Lendo o seu roteiro… isso leva ~30–60s.',
	'import.errFailed': 'Falha na importação ({status}).',
	'import.errNetwork': 'Erro de rede. Verifique a sua conexão e tente novamente.',
	'import.hint422':
		'Tente adicionar datas explícitas (ex.: "chegada em 5 de setembro de 2026") e importar novamente.',
	'import.errNotConfigured': 'A importação ainda não está configurada neste servidor.',
	'import.errTooLong': 'Esse roteiro é muito longo. Encurte-o e tente novamente.',
	'import.errEmpty': 'Cole um roteiro para importar.',
	'import.err422': 'Não conseguimos transformar isso em uma viagem.',

	'join.signInHeading': 'Entre para abrir este convite',
	'join.signInBody': 'Você precisa entrar antes de participar desta viagem.',
	'join.signInDev': 'Entrar (dev)',
	'join.invalidHeading': 'Este link de convite não é mais válido',
	'join.invalidBody': 'O link pode ter sido revogado ou a viagem removida.',
	'join.goToTrips': 'Ir para as minhas viagens',

	'feedback.button': 'Feedback',
	'feedback.title': 'Enviar feedback',
	'feedback.typeLabel': 'Tipo de feedback',
	'feedback.typeBug': 'Erro',
	'feedback.typeIdea': 'Ideia',
	'feedback.typeOther': 'Outro',
	'feedback.messageLabel': 'Seu feedback',
	'feedback.messagePlaceholder': 'Conte o que você achou — um erro, uma ideia, o que quiser.',
	'feedback.submit': 'Enviar',
	'feedback.sending': 'Enviando…',
	'feedback.close': 'Fechar',
	'feedback.successTitle': 'Obrigado — feedback enviado',
	'feedback.viewYours': 'Ver seu feedback',
	'feedback.errEmpty': 'Digite uma mensagem.',
	'feedback.errTooLong': 'Mensagem muito longa (máx. 2000 caracteres).',
	'feedback.errFailed': 'Não foi possível enviar o feedback.',
	'feedback.errNetwork': 'Erro de rede. Tente novamente.',
	'feedback.pageTitle': 'Feedback — geornada',
	'feedback.heading': 'Seu feedback',
	'feedback.adminHeading': 'Todos os feedbacks',
	'feedback.back': '← Viagens',
	'feedback.empty': 'Nenhum feedback ainda.',
	'feedback.statusLabel': 'Status',
	'feedback.statusNew': 'Nova',
	'feedback.statusPlanned': 'Planejada',
	'feedback.statusDone': 'Concluída',
	'feedback.statusDismissed': 'Descartada'
};

export const catalogs: Record<Locale, Messages> = {
	'en-GB': enGB,
	'pt-BR': ptBR
};
