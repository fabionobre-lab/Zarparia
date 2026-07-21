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
	'header.signIn': string; // compact sign-in label (narrow header, <520px)
	'header.language': string; // aria-label for the switcher group
	// ── Theme toggle (aria-label/title reflect the CURRENT mode) ──
	'theme.system': string;
	'theme.dark': string;
	'theme.light': string;

	// ── Mobile bottom app bar + "More" sheet (lib/nav/*) ──
	'nav.trips': string; // primary item → home trip list
	'nav.newTrip': string; // primary item → /trips/new
	'nav.import': string; // primary item → /trips/import
	'nav.share': string; // primary item → toggle Share panel
	'nav.edit': string; // primary item → /trips/[id]/edit
	'nav.more': string; // the 4th item that opens the sheet
	'nav.back': string; // demo primary item → home
	'nav.primaryLabel': string; // aria-label for the bottom <nav>
	'nav.moreLabel': string; // aria-label for the More sheet dialog
	'nav.close': string; // aria-label for the sheet close control
	'nav.loading': string; // aria-label for the layout's client-navigation skeleton overlay

	// ── OAuth consent page (oauth/authorize) — MCP connector authorization ──
	'consent.pageTitle': string;
	'consent.heading': string; // "{client} wants access to your Zarparia trips"
	'consent.account': string; // "Signed in as {account}"
	'consent.scope': string;
	'consent.approve': string;
	'consent.deny': string;
	'consent.genericClient': string; // fallback when a client sends no name

	// ── Signed-out landing (+page.svelte) ──
	'landing.tryDemo': string;
	'landing.tryDemoSub': string;
	// Consent line under the Google sign-in button. Contains the literal tokens
	// %TERMS% and %PRIVACY% — the page splits on them and swaps in <a> links to
	// /terms and /privacy, so translations must keep both tokens verbatim.
	'landing.consentText': string;
	'landing.orDivider': string; // the word "or", between the Google button and the email/password form

	// ── Public demo trip (routes/demo/+page.svelte) ──
	'demo.banner': string;
	'demo.signInCta': string;
	'demo.back': string;
	'demo.about': string;
	'demo.aboutTag': string;
	'demo.aboutTitle': string;
	'demo.aboutIntro': string;
	'demo.aboutInteractive': string;
	'demo.tryHeading': string;
	'demo.tryPlans': string;
	'demo.tryLanguage': string;
	'demo.trySchedule': string;
	'demo.startExploring': string;
	'demo.close': string;

	// ── Public share route (routes/s/[token]/+page.svelte) ──
	'publicShare.banner': string; // read-only-shared-trip notice, family demo-banner anatomy
	'publicShare.cta': string; // "Plan your own trip" → '/'

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
	'share.pending': string;
	'share.invited': string;
	'share.errLoad': string;
	'share.errLoadLink': string;
	'share.errTurnOff': string;
	'share.errUpdateLink': string;
	'share.errNetwork': string;
	'share.errCopy': string;
	'share.errShare': string;
	'share.errRemove': string;
	// Public link (docs/public-share-route-spec.md) — anonymous, read-only,
	// deliberately separate from the collaborator link controls above.
	'share.publicHeading': string;
	'share.publicHint': string;
	'share.publicCreate': string;
	'share.publicShareableLink': string; // aria-label for the readonly URL input
	'share.publicRevoke': string;
	'share.publicRevokeConfirmTitle': string;
	'share.publicRevokeConfirmBody': string;
	'share.publicErrLoad': string;
	'share.publicErrCreate': string;
	'share.publicErrRevoke': string;

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
	'common.undo': string; // toast action label (family convention — same key as Nobria)
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
	'editor.currency': string;
	'editor.budget': string;
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
	'editor.discardTitle': string; // ConfirmDialog title (body reuses editor.discardConfirm)

	// ── Shared toast + confirm-dialog vocabulary (lib/toast, lib/dialog) ──
	'toast.dismiss': string; // aria-label for the toast's close button
	'toast.tripSaved': string;
	'toast.tripImported': string;
	'toast.photoDeleted': string;
	'toast.photoMoved': string;
	'toast.publicLinkCopied': string;
	'toast.publicLinkRevoked': string;
	'dialog.discard': string; // danger confirm-button label for the discard-changes dialog

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
	'block.links': string;
	'block.linkUrlPlaceholder': string;
	'block.linkUrlAria': string;
	'block.linkLabelPlaceholder': string;
	'block.linkLabelAria': string;
	'block.planDiff': string;
	'block.diffNone': string;
	'block.diffAdded': string;
	'block.diffChanged': string;
	'block.diffKept': string;
	'block.diffReason': string;
	'block.checklist': string;
	'block.checklistTitle': string;
	'block.checklistItem': string;
	'block.checklistAddItem': string;
	'block.checklistRemove': string;
	'block.costAmount': string;
	'block.costCategory': string;
	'block.costCatNone': string;
	'block.cat.lodging': string;
	'block.cat.food': string;
	'block.cat.transport': string;
	'block.cat.activities': string;
	'block.cat.shopping': string;
	'block.cat.other': string;

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
	'join.pageTitle': string;
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

	'tripbar.photos': string;
	'photos.heading': string;
	'photos.loading': string;
	'photos.intro': string;
	'photos.connect': string;
	'photos.choose': string;
	'photos.chooseMore': string;
	'photos.waiting': string;
	'photos.openGoogle': string;
	'photos.importing': string; // {n} = photos imported so far
	'photos.importedDone': string; // {n}
	'photos.unmatchedNote': string; // {n}
	'photos.skippedNote': string; // {n}
	'photos.retry': string;
	'photos.hint': string;
	'photos.errPicker': string;
	'photos.errImport': string;
	'photos.errSessionGone': string;
	'photos.errGeneric': string;
	'photos.lightboxLabel': string;
	'photos.close': string;
	'photos.prev': string;
	'photos.next': string;
	'photos.moveTo': string;
	'photos.unassigned': string;
	'photos.delete': string;
	'photos.confirmDelete': string;
	'photos.deleteTitle': string; // ConfirmDialog title (body reuses photos.confirmDelete)
	'photos.errSave': string;

	// ── Access-gate pending/rejected screen (home '/' when signed in but not
	// approved — routes/+page.svelte) ──
	'pending.heading': string;
	'pending.body': string;
	'pending.rejectedHeading': string;
	'pending.rejectedBody': string;

	// ── Error page (routes/+error.svelte) ──
	'error.pageTitle404': string;
	'error.pageTitleGeneric': string;
	'error.notFoundHeading': string;
	'error.notFoundBody': string;
	'error.genericHeading': string;
	'error.genericBody': string;

	// ── Admin approvals queue (routes/admin/approvals) ──
	'admin.approvals.pageTitle': string;
	'admin.approvals.heading': string;
	'admin.approvals.pendingHeading': string;
	'admin.approvals.pendingEmpty': string;
	'admin.approvals.recentHeading': string;
	'admin.approvals.recentEmpty': string;
	'admin.approvals.approve': string;
	'admin.approvals.reject': string;
	'admin.approvals.undo': string;
	'admin.approvals.statusApproved': string;
	'admin.approvals.statusRejected': string;
	'admin.approvals.requestedLabel': string; // "Requested {date}"
	'admin.approvals.decidedLabel': string; // "Decided {date}"
	'feedback.adminApprovalsLink': string; // nav affordance on the feedback admin view

	// ── Header/nav entry point to the account page (Phase 2) ──
	'header.account': string; // link label, desktop header + mobile More sheet

	// ── Account page (routes/account) — GDPR export + deletion (Phase 2) ──
	'account.pageTitle': string;
	'account.heading': string;
	'account.yourDataHeading': string;
	'account.exportDescription': string;
	'account.exportButton': string;
	'account.dangerHeading': string;
	'account.dangerDescription': string;
	'account.deleteButton': string;
	'account.deleteDialogTitle': string;
	'account.deleteWarning': string;
	'account.deleteConfirmLabel': string;
	'account.deleteConfirmPlaceholder': string;
	'account.deleteCancel': string;
	'account.deleteConfirmButton': string;
	'account.deleting': string;
	'account.deleteError': string;
	// Shown on the signed-out landing after a successful self-deletion.
	'account.deletedNotice': string;
	'account.legalHeading': string; // "Legal" row linking to /privacy and /terms

	// ── Legal pack (routes/privacy, routes/terms — Phase 1) ──
	'legal.back': string; // back link on the legal pages themselves (→ '/')
	'legal.lastUpdated': string; // label prefixed to the formatted policy date
	'legal.privacy': string; // "Privacy" — nav/footer link label + inline link text
	'legal.terms': string; // "Terms" — nav/footer link label + inline link text
	'privacy.pageTitle': string;
	'terms.pageTitle': string;

	// ── Guide & roadmap (routes/guide, routes/roadmap — Phase 4) ──
	'nav.guide': string; // "Guide" — footer/More-sheet/empty-state link label
	'nav.roadmap': string; // "Roadmap" — footer link label + guide footer link
	'guide.pageTitle': string;
	'guide.heading': string;
	'guide.tocLabel': string; // aria-label for the anchor table-of-contents
	'roadmap.pageTitle': string;
	'roadmap.heading': string;
	'roadmap.intro': string;
	'roadmap.statusShipped': string;
	'roadmap.statusBuilding': string;
	'roadmap.statusPlanned': string;
	'home.readGuide': string; // empty-state link → /guide

	// ── Email+password sign-in (AuthEmailForm.svelte, shown only when Firebase
	// is provisioned — see $lib/firebase.ts firebaseEnabled) ──
	'authEmail.email': string;
	'authEmail.password': string;
	'authEmail.passwordHint': string; // shown under the password field in sign-up mode only
	'authEmail.signInSubmit': string;
	'authEmail.signUpSubmit': string;
	'authEmail.resetSubmit': string;
	'authEmail.working': string; // submit button while a request is in flight
	'authEmail.linkCreateAccount': string;
	'authEmail.linkForgotPassword': string;
	'authEmail.linkBackToSignIn': string;
	'authEmail.verifyNotice': string;
	'authEmail.resend': string;
	'authEmail.resendSent': string;
	'authEmail.signupSuccess': string;
	'authEmail.resetSent': string; // neutral message shown for every reset attempt (enumeration-safe)
	'authEmail.errInvalidEmail': string;
	'authEmail.errEmailInUse': string;
	'authEmail.errWeakPassword': string;
	'authEmail.errBadCredentials': string; // wrong-password/user-not-found/invalid-credential/missing-password
	'authEmail.errTooManyRequests': string;
	'authEmail.errGeneric': string;
}

const enGB: Messages = {
	'header.signOut': 'Sign out',
	'header.signInGoogle': 'Continue with Google',
	'header.signIn': 'Sign in',
	'header.language': 'Language',
	'theme.system': 'Theme: system',
	'theme.dark': 'Theme: dark',
	'theme.light': 'Theme: light',

	'nav.trips': 'Trips',
	'nav.newTrip': 'New trip',
	'nav.import': 'Import',
	'nav.share': 'Share',
	'nav.edit': 'Edit',
	'nav.more': 'More',
	'nav.back': 'Back',
	'nav.primaryLabel': 'Main navigation',
	'nav.moreLabel': 'More options',
	'nav.close': 'Close',
	'nav.loading': 'Loading…',

	'consent.pageTitle': 'Authorize — Zarparia',
	'consent.heading': '{client} wants access to your Zarparia trips',
	'consent.account': 'Signed in as {account}',
	'consent.scope': 'This lets it create, read, update and delete your trips on your behalf.',
	'consent.approve': 'Approve',
	'consent.deny': 'Deny',
	'consent.genericClient': 'An application',

	'landing.tryDemo': 'Try the demo',
	'landing.tryDemoSub': 'Explore a sample trip — no account needed.',
	'landing.consentText': 'By signing in you agree to the %TERMS% and %PRIVACY%.',
	'landing.orDivider': 'or',

	'demo.banner': 'Demo — a sample trip, fully interactive. Nothing is saved.',
	'demo.signInCta': 'Continue with Google',
	'demo.back': '← Back',
	'demo.about': 'About',
	'demo.aboutTag': 'Demo',
	'demo.aboutTitle': 'Meet Alex & Sam',
	'demo.aboutIntro':
		"You're looking at the itinerary of Alex and Sam, a fictional couple spending a week in Scotland in April 2026 — a few days in Edinburgh's Old Town, then a road trip through the Highlands. The places are real; the couple and their trip are invented.",
	'demo.aboutInteractive':
		'The demo is fully interactive. Browse anything you like — nothing is saved, and nothing here touches a real account.',
	'demo.tryHeading': 'Things to try',
	'demo.tryPlans': 'Highlands: flip between the Coastal route and the Whisky route to compare two plans for the same days.',
	'demo.tryLanguage': 'Language: the whole trip is bilingual — switch it between English and Portuguese.',
	'demo.trySchedule': 'Days: open any day for the hour-by-hour schedule, map links and travel notes.',
	'demo.startExploring': 'Start exploring',
	'demo.close': 'Close',

	'publicShare.banner': "You're viewing a shared trip — read-only.",
	'publicShare.cta': 'Plan your own trip',

	'home.pageTitle': 'Zarparia',
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
	'share.hint': 'Invite anyone by email — if they don’t have an account yet, they’ll get access the first time they sign in.',
	'share.pending': 'Pending sign-in',
	'share.invited': 'Invited. They’ll get access the first time they sign in.',
	'share.errLoad': 'Could not load sharing info.',
	'share.errLoadLink': 'Could not load link info.',
	'share.errTurnOff': 'Could not turn off the link.',
	'share.errUpdateLink': 'Could not update the link.',
	'share.errNetwork': 'Network error.',
	'share.errCopy': 'Could not copy. Select the link and copy manually.',
	'share.errShare': 'Could not share.',
	'share.errRemove': 'Could not remove this person.',
	'share.publicHeading': 'Public link',
	'share.publicHint':
		'Anyone with this link can view the trip, read-only — no sign-in required. Good for sharing outside Zarparia.',
	'share.publicCreate': 'Create public link',
	'share.publicShareableLink': 'Public shareable link',
	'share.publicRevoke': 'Revoke',
	'share.publicRevokeConfirmTitle': 'Revoke public link?',
	'share.publicRevokeConfirmBody':
		"Anyone who has this link loses access immediately. This can't be undone — creating a new link later gives a different address.",
	'share.publicErrLoad': 'Could not load the public link.',
	'share.publicErrCreate': 'Could not create the public link.',
	'share.publicErrRevoke': 'Could not revoke the public link.',

	'wizard.pageTitle': 'New trip — Zarparia',
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
	'common.undo': 'Undo',
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
	'editor.currency': 'Currency (ISO, e.g. GBP)',
	'editor.budget': 'Budget (total)',
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
	'editor.discardTitle': 'Discard changes?',

	'toast.dismiss': 'Dismiss',
	'toast.tripSaved': 'Trip saved.',
	'toast.tripImported': 'Trip imported.',
	'toast.photoDeleted': 'Photo deleted.',
	'toast.photoMoved': 'Photo moved.',
	'toast.publicLinkCopied': 'Public link copied.',
	'toast.publicLinkRevoked': 'Public link revoked.',
	'dialog.discard': 'Discard',

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
	'block.links': 'Booking links',
	'block.linkUrlPlaceholder': 'https://booking.com/...',
	'block.linkUrlAria': 'Booking link URL',
	'block.linkLabelPlaceholder': 'Label (optional — auto-detected)',
	'block.linkLabelAria': 'Booking link label',
	'block.planDiff': 'Plan diff',
	'block.diffNone': 'none',
	'block.diffAdded': 'added',
	'block.diffChanged': 'changed',
	'block.diffKept': 'kept',
	'block.diffReason': 'Diff reason',
	'block.checklist': 'Checklist',
	'block.checklistTitle': 'Checklist title',
	'block.checklistItem': 'Item',
	'block.checklistAddItem': '+ Add item',
	'block.checklistRemove': 'Remove checklist',
	'block.costAmount': 'Cost',
	'block.costCategory': 'Category',
	'block.costCatNone': '— none —',
	'block.cat.lodging': 'Lodging',
	'block.cat.food': 'Food',
	'block.cat.transport': 'Transport',
	'block.cat.activities': 'Activities',
	'block.cat.shopping': 'Shopping',
	'block.cat.other': 'Other',

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

	'join.pageTitle': 'Join trip — Zarparia',
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
	'feedback.pageTitle': 'Feedback — Zarparia',
	'feedback.heading': 'Your feedback',
	'feedback.adminHeading': 'All feedback',
	'feedback.back': '← Trips',
	'feedback.empty': 'No feedback yet.',
	'feedback.statusLabel': 'Status',
	'feedback.statusNew': 'New',
	'feedback.statusPlanned': 'Planned',
	'feedback.statusDone': 'Done',
	'feedback.statusDismissed': 'Dismissed',

	'tripbar.photos': 'Photos',
	'photos.heading': 'Google Photos',
	'photos.loading': 'Checking your Google Photos connection…',
	'photos.intro':
		'Pick photos from your Google Photos library and they are placed on the itinerary automatically, matched to each day and stop by when they were taken.',
	'photos.connect': 'Connect Google Photos',
	'photos.choose': 'Choose photos',
	'photos.chooseMore': 'Choose more photos',
	'photos.waiting': 'Waiting for your selection in Google Photos… finish there and this page picks it up.',
	'photos.openGoogle': 'Open Google Photos',
	'photos.importing': 'Importing… {n} photos added so far.',
	'photos.importedDone': '{n} photos added to the trip.',
	'photos.unmatchedNote':
		'{n} of them were taken outside the trip dates — find them under “Photos not on the itinerary” at the bottom of the trip.',
	'photos.skippedNote': '{n} items were skipped (already linked, or videos — not supported yet).',
	'photos.retry': 'Try again',
	'photos.hint':
		'Photos are matched by capture time (Google does not share photo locations). You can move any photo to another day from its preview.',
	'photos.errPicker': 'Could not start Google Photos. Please try again.',
	'photos.errImport': 'Importing failed part-way. Choose the photos again to finish — already-imported ones are kept.',
	'photos.errSessionGone': 'The Google Photos session expired. Please choose the photos again.',
	'photos.errGeneric': 'Something went wrong. Please try again.',
	'photos.lightboxLabel': 'Photo viewer',
	'photos.close': 'Close',
	'photos.prev': 'Previous photo',
	'photos.next': 'Next photo',
	'photos.moveTo': 'Day',
	'photos.unassigned': 'Not on the itinerary',
	'photos.delete': 'Remove',
	'photos.confirmDelete': 'Remove this photo from the trip? (It stays in your Google Photos.)',
	'photos.deleteTitle': 'Remove photo?',
	'photos.errSave': 'Could not save. Please try again.',

	'pending.heading': 'Your access request is being reviewed',
	'pending.body':
		"Thanks for signing in. Zarparia is in a small, invite-only beta — an admin needs to approve your account before you can get started. There's nothing else to do; check back soon.",
	'pending.rejectedHeading': 'Access not available',
	'pending.rejectedBody': "This account doesn't have access to Zarparia at the moment.",

	'error.pageTitle404': 'Page not found — Zarparia',
	'error.pageTitleGeneric': 'Something went wrong — Zarparia',
	'error.notFoundHeading': 'Page not found',
	'error.notFoundBody': "The page you're looking for doesn't exist, or may have moved.",
	'error.genericHeading': 'Something went wrong',
	'error.genericBody': 'An unexpected error occurred. Please try again, or head back home.',

	'admin.approvals.pageTitle': 'Approvals — Zarparia',
	'admin.approvals.heading': 'Approvals',
	'admin.approvals.pendingHeading': 'Awaiting approval',
	'admin.approvals.pendingEmpty': 'No sign-ups waiting on a decision.',
	'admin.approvals.recentHeading': 'Recently decided',
	'admin.approvals.recentEmpty': 'No decisions yet.',
	'admin.approvals.approve': 'Approve',
	'admin.approvals.reject': 'Reject',
	'admin.approvals.undo': 'Undo → pending',
	'admin.approvals.statusApproved': 'Approved',
	'admin.approvals.statusRejected': 'Rejected',
	'admin.approvals.requestedLabel': 'Requested {date}',
	'admin.approvals.decidedLabel': 'Decided {date}',
	'feedback.adminApprovalsLink': 'Manage approvals',

	'header.account': 'Account',

	'account.pageTitle': 'Account — Zarparia',
	'account.heading': 'Account',
	'account.yourDataHeading': 'Your data',
	'account.exportDescription':
		'Download everything Zarparia holds about you — your trips, shares, feedback and photo records — as one JSON file.',
	'account.exportButton': 'Export my data',
	'account.dangerHeading': 'Delete account',
	'account.dangerDescription':
		'Permanently erase your account. Trips you own are deleted for everyone they were shared with, and any shares you received elsewhere are revoked. This cannot be undone.',
	'account.deleteButton': 'Delete my account…',
	'account.deleteDialogTitle': 'Delete your account?',
	'account.deleteWarning':
		'This permanently deletes your account and everything in it. Trips you own are deleted, including for anyone you shared them with. Trips shared with you are removed from your access. This cannot be undone.',
	'account.deleteConfirmLabel': 'Type DELETE or your account email to confirm',
	'account.deleteConfirmPlaceholder': 'DELETE',
	'account.deleteCancel': 'Cancel',
	'account.deleteConfirmButton': 'Permanently delete',
	'account.deleting': 'Deleting…',
	'account.deleteError': 'Could not delete your account. Please try again.',
	'account.deletedNotice': 'Your account and its data have been permanently deleted.',
	'account.legalHeading': 'Legal',

	'legal.back': '← Home',
	'legal.lastUpdated': 'Last updated',
	'legal.privacy': 'Privacy',
	'legal.terms': 'Terms',
	'privacy.pageTitle': 'Privacy Policy — Zarparia',
	'terms.pageTitle': 'Terms of Service — Zarparia',

	'nav.guide': 'Guide',
	'nav.roadmap': 'Roadmap',
	'guide.pageTitle': 'Guide — Zarparia',
	'guide.heading': 'Guide',
	'guide.tocLabel': 'On this page',
	'roadmap.pageTitle': 'Roadmap — Zarparia',
	'roadmap.heading': 'Roadmap',
	'roadmap.intro':
		"What's shipped, what's being built, and what's planned next. Use the feedback button in the app if there's something you'd like to see here.",
	'roadmap.statusShipped': 'Shipped',
	'roadmap.statusBuilding': 'In progress',
	'roadmap.statusPlanned': 'Planned',
	'home.readGuide': 'Read the guide',

	'authEmail.email': 'Email',
	'authEmail.password': 'Password',
	'authEmail.passwordHint': 'At least 8 characters',
	'authEmail.signInSubmit': 'Sign in',
	'authEmail.signUpSubmit': 'Create account',
	'authEmail.resetSubmit': 'Send reset link',
	'authEmail.working': 'Working…',
	'authEmail.linkCreateAccount': 'Create account',
	'authEmail.linkForgotPassword': 'Forgot password?',
	'authEmail.linkBackToSignIn': 'Back to sign in',
	'authEmail.verifyNotice':
		"Please verify your email before continuing — we've sent a verification link to your inbox.",
	'authEmail.resend': 'Resend verification email',
	'authEmail.resendSent': 'Verification email sent',
	'authEmail.signupSuccess': 'Check your inbox to verify your email, then sign in.',
	'authEmail.resetSent': 'If an account exists for that email, a reset link is on its way.',
	'authEmail.errInvalidEmail': 'That email address looks invalid.',
	'authEmail.errEmailInUse': 'An account already exists with that email address.',
	'authEmail.errWeakPassword': 'Choose a password with at least 6 characters.',
	'authEmail.errBadCredentials': 'Incorrect email or password.',
	'authEmail.errTooManyRequests': 'Too many attempts. Please wait a moment and try again.',
	'authEmail.errGeneric': 'Something went wrong. Please try again.'
};

const ptBR: Messages = {
	'header.signOut': 'Sair',
	'header.signInGoogle': 'Continuar com o Google',
	'header.signIn': 'Entrar',
	'header.language': 'Idioma',
	'theme.system': 'Tema: sistema',
	'theme.dark': 'Tema: escuro',
	'theme.light': 'Tema: claro',

	'nav.trips': 'Viagens',
	'nav.newTrip': 'Nova viagem',
	'nav.import': 'Importar',
	'nav.share': 'Compartilhar',
	'nav.edit': 'Editar',
	'nav.more': 'Mais',
	'nav.back': 'Voltar',
	'nav.primaryLabel': 'Navegação principal',
	'nav.moreLabel': 'Mais opções',
	'nav.close': 'Fechar',
	'nav.loading': 'Carregando…',

	'consent.pageTitle': 'Autorizar — Zarparia',
	'consent.heading': '{client} quer acesso às suas viagens no Zarparia',
	'consent.account': 'Conectado como {account}',
	'consent.scope': 'Isso permite criar, ler, atualizar e excluir as suas viagens em seu nome.',
	'consent.approve': 'Aprovar',
	'consent.deny': 'Recusar',
	'consent.genericClient': 'Um aplicativo',

	'landing.tryDemo': 'Ver demonstração',
	'landing.tryDemoSub': 'Explore uma viagem de exemplo — sem necessidade de conta.',
	'landing.consentText': 'Ao entrar, você concorda com os %TERMS% e a %PRIVACY%.',
	'landing.orDivider': 'ou',

	'demo.banner': 'Demonstração — uma viagem de exemplo, totalmente interativa. Nada é salvo.',
	'demo.signInCta': 'Continuar com o Google',
	'demo.back': '← Voltar',
	'demo.about': 'Sobre',
	'demo.aboutTag': 'Demonstração',
	'demo.aboutTitle': 'Conheça Alex & Sam',
	'demo.aboutIntro':
		'Você está vendo o roteiro de Alex e Sam, um casal fictício passando uma semana na Escócia em abril de 2026 — alguns dias na Cidade Velha de Edimburgo e depois uma road trip pelas Terras Altas. Os lugares são reais; o casal e a viagem são invenção.',
	'demo.aboutInteractive':
		'A demonstração é totalmente interativa. Explore o que quiser — nada é salvo, e nada aqui toca uma conta real.',
	'demo.tryHeading': 'Coisas para experimentar',
	'demo.tryPlans': 'Terras Altas: alterne entre a Rota costeira e a Rota do whisky para comparar dois planos para os mesmos dias.',
	'demo.tryLanguage': 'Idioma: a viagem inteira é bilíngue — alterne entre inglês e português.',
	'demo.trySchedule': 'Dias: abra qualquer dia para ver a programação hora a hora, links de mapa e notas de transporte.',
	'demo.startExploring': 'Começar a explorar',
	'demo.close': 'Fechar',

	'publicShare.banner': 'Você está vendo uma viagem compartilhada — somente leitura.',
	'publicShare.cta': 'Planeje sua própria viagem',

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
	'share.hint': 'Convide qualquer pessoa por e-mail — se ainda não tiver conta, ela terá acesso assim que entrar pela primeira vez.',
	'share.pending': 'Aguardando entrar',
	'share.invited': 'Convite enviado. A pessoa terá acesso assim que entrar pela primeira vez.',
	'share.errLoad': 'Não foi possível carregar as informações de compartilhamento.',
	'share.errLoadLink': 'Não foi possível carregar as informações do link.',
	'share.errTurnOff': 'Não foi possível desativar o link.',
	'share.errUpdateLink': 'Não foi possível atualizar o link.',
	'share.errNetwork': 'Erro de rede.',
	'share.errCopy': 'Não foi possível copiar. Selecione o link e copie manualmente.',
	'share.errShare': 'Não foi possível compartilhar.',
	'share.errRemove': 'Não foi possível remover esta pessoa.',
	'share.publicHeading': 'Link público',
	'share.publicHint':
		'Qualquer pessoa com este link pode ver a viagem, somente leitura — sem necessidade de entrar. Ótimo para compartilhar fora do Zarparia.',
	'share.publicCreate': 'Criar link público',
	'share.publicShareableLink': 'Link público compartilhável',
	'share.publicRevoke': 'Revogar',
	'share.publicRevokeConfirmTitle': 'Revogar o link público?',
	'share.publicRevokeConfirmBody':
		'Quem tiver este link perde o acesso imediatamente. Isso não pode ser desfeito — criar um novo link depois gera um endereço diferente.',
	'share.publicErrLoad': 'Não foi possível carregar o link público.',
	'share.publicErrCreate': 'Não foi possível criar o link público.',
	'share.publicErrRevoke': 'Não foi possível revogar o link público.',

	'wizard.pageTitle': 'Nova viagem — Zarparia',
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
	'common.undo': 'Desfazer',
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
	'editor.currency': 'Moeda (ISO, ex.: GBP)',
	'editor.budget': 'Orçamento (total)',
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
	'editor.discardTitle': 'Descartar alterações?',

	'toast.dismiss': 'Dispensar',
	'toast.tripSaved': 'Viagem salva.',
	'toast.tripImported': 'Viagem importada.',
	'toast.photoDeleted': 'Foto excluída.',
	'toast.photoMoved': 'Foto movida.',
	'toast.publicLinkCopied': 'Link público copiado.',
	'toast.publicLinkRevoked': 'Link público revogado.',
	'dialog.discard': 'Descartar',

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
	'block.links': 'Links de reserva',
	'block.linkUrlPlaceholder': 'https://booking.com/...',
	'block.linkUrlAria': 'URL do link de reserva',
	'block.linkLabelPlaceholder': 'Rótulo (opcional — detectado automaticamente)',
	'block.linkLabelAria': 'Rótulo do link de reserva',
	'block.planDiff': 'Diferença de plano',
	'block.diffNone': 'nenhuma',
	'block.diffAdded': 'adicionado',
	'block.diffChanged': 'alterado',
	'block.diffKept': 'mantido',
	'block.diffReason': 'Motivo da diferença',
	'block.checklist': 'Lista de itens',
	'block.checklistTitle': 'Título da lista',
	'block.checklistItem': 'Item',
	'block.checklistAddItem': '+ Adicionar item',
	'block.checklistRemove': 'Remover lista',
	'block.costAmount': 'Custo',
	'block.costCategory': 'Categoria',
	'block.costCatNone': '— nenhuma —',
	'block.cat.lodging': 'Hospedagem',
	'block.cat.food': 'Alimentação',
	'block.cat.transport': 'Transporte',
	'block.cat.activities': 'Atividades',
	'block.cat.shopping': 'Compras',
	'block.cat.other': 'Outros',

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

	'join.pageTitle': 'Participar da viagem — Zarparia',
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
	'feedback.pageTitle': 'Feedback — Zarparia',
	'feedback.heading': 'Seu feedback',
	'feedback.adminHeading': 'Todos os feedbacks',
	'feedback.back': '← Viagens',
	'feedback.empty': 'Nenhum feedback ainda.',
	'feedback.statusLabel': 'Status',
	'feedback.statusNew': 'Nova',
	'feedback.statusPlanned': 'Planejada',
	'feedback.statusDone': 'Concluída',
	'feedback.statusDismissed': 'Descartada',

	'tripbar.photos': 'Fotos',
	'photos.heading': 'Google Fotos',
	'photos.loading': 'Verificando sua conexão com o Google Fotos…',
	'photos.intro':
		'Escolha fotos da sua biblioteca do Google Fotos e elas entram no roteiro automaticamente, associadas a cada dia e parada pelo horário em que foram tiradas.',
	'photos.connect': 'Conectar Google Fotos',
	'photos.choose': 'Escolher fotos',
	'photos.chooseMore': 'Escolher mais fotos',
	'photos.waiting': 'Aguardando sua seleção no Google Fotos… conclua lá e esta página continua sozinha.',
	'photos.openGoogle': 'Abrir Google Fotos',
	'photos.importing': 'Importando… {n} fotos adicionadas até agora.',
	'photos.importedDone': '{n} fotos adicionadas à viagem.',
	'photos.unmatchedNote':
		'{n} delas foram tiradas fora das datas da viagem — veja em “Fotos fora do roteiro”, no fim da página da viagem.',
	'photos.skippedNote': '{n} itens foram ignorados (já vinculados, ou vídeos — ainda não suportados).',
	'photos.retry': 'Tentar novamente',
	'photos.hint':
		'As fotos são associadas pelo horário da captura (o Google não compartilha a localização das fotos). Você pode mover qualquer foto para outro dia pela pré-visualização.',
	'photos.errPicker': 'Não foi possível abrir o Google Fotos. Tente novamente.',
	'photos.errImport': 'A importação falhou no meio. Escolha as fotos de novo para concluir — as já importadas são mantidas.',
	'photos.errSessionGone': 'A sessão do Google Fotos expirou. Escolha as fotos novamente.',
	'photos.errGeneric': 'Algo deu errado. Tente novamente.',
	'photos.lightboxLabel': 'Visualizador de fotos',
	'photos.close': 'Fechar',
	'photos.prev': 'Foto anterior',
	'photos.next': 'Próxima foto',
	'photos.moveTo': 'Dia',
	'photos.unassigned': 'Fora do roteiro',
	'photos.delete': 'Remover',
	'photos.confirmDelete': 'Remover esta foto da viagem? (Ela continua no seu Google Fotos.)',
	'photos.deleteTitle': 'Remover foto?',
	'photos.errSave': 'Não foi possível salvar. Tente novamente.',

	'pending.heading': 'Sua solicitação de acesso está em análise',
	'pending.body':
		'Obrigado por entrar. O Zarparia está em um beta fechado, apenas por convite — um administrador precisa aprovar sua conta antes de você começar. Não há mais nada a fazer; volte em breve.',
	'pending.rejectedHeading': 'Acesso não disponível',
	'pending.rejectedBody': 'No momento, esta conta não tem acesso ao Zarparia.',

	'error.pageTitle404': 'Página não encontrada — Zarparia',
	'error.pageTitleGeneric': 'Algo deu errado — Zarparia',
	'error.notFoundHeading': 'Página não encontrada',
	'error.notFoundBody': 'A página que você procura não existe, ou pode ter sido movida.',
	'error.genericHeading': 'Algo deu errado',
	'error.genericBody': 'Ocorreu um erro inesperado. Tente novamente, ou volte para o início.',

	'admin.approvals.pageTitle': 'Aprovações — Zarparia',
	'admin.approvals.heading': 'Aprovações',
	'admin.approvals.pendingHeading': 'Aguardando aprovação',
	'admin.approvals.pendingEmpty': 'Nenhum cadastro aguardando decisão.',
	'admin.approvals.recentHeading': 'Decididos recentemente',
	'admin.approvals.recentEmpty': 'Ainda não há decisões.',
	'admin.approvals.approve': 'Aprovar',
	'admin.approvals.reject': 'Rejeitar',
	'admin.approvals.undo': 'Desfazer → pendente',
	'admin.approvals.statusApproved': 'Aprovado',
	'admin.approvals.statusRejected': 'Rejeitado',
	'admin.approvals.requestedLabel': 'Solicitado {date}',
	'admin.approvals.decidedLabel': 'Decidido {date}',
	'feedback.adminApprovalsLink': 'Gerenciar aprovações',

	'header.account': 'Conta',

	'account.pageTitle': 'Conta — Zarparia',
	'account.heading': 'Conta',
	'account.yourDataHeading': 'Seus dados',
	'account.exportDescription':
		'Baixe tudo o que o Zarparia guarda sobre você — suas viagens, compartilhamentos, feedback e registros de fotos — em um único arquivo JSON.',
	'account.exportButton': 'Exportar meus dados',
	'account.dangerHeading': 'Excluir conta',
	'account.dangerDescription':
		'Apaga sua conta permanentemente. As viagens que você possui são excluídas para todos com quem foram compartilhadas, e qualquer compartilhamento que você recebeu em outras viagens é revogado. Isso não pode ser desfeito.',
	'account.deleteButton': 'Excluir minha conta…',
	'account.deleteDialogTitle': 'Excluir sua conta?',
	'account.deleteWarning':
		'Isso exclui permanentemente sua conta e tudo o que ela contém. As viagens que você possui são excluídas, inclusive para quem você compartilhou. As viagens compartilhadas com você deixam de estar acessíveis. Isso não pode ser desfeito.',
	'account.deleteConfirmLabel': 'Digite DELETE ou o e-mail da sua conta para confirmar',
	'account.deleteConfirmPlaceholder': 'DELETE',
	'account.deleteCancel': 'Cancelar',
	'account.deleteConfirmButton': 'Excluir permanentemente',
	'account.deleting': 'Excluindo…',
	'account.deleteError': 'Não foi possível excluir sua conta. Tente novamente.',
	'account.deletedNotice': 'Sua conta e seus dados foram permanentemente excluídos.',
	'account.legalHeading': 'Informações legais',

	'legal.back': '← Início',
	'legal.lastUpdated': 'Última atualização',
	'legal.privacy': 'Privacidade',
	'legal.terms': 'Termos',
	'privacy.pageTitle': 'Política de Privacidade — Zarparia',
	'terms.pageTitle': 'Termos de Serviço — Zarparia',

	'nav.guide': 'Guia',
	'nav.roadmap': 'Roadmap',
	'guide.pageTitle': 'Guia — Zarparia',
	'guide.heading': 'Guia',
	'guide.tocLabel': 'Nesta página',
	'roadmap.pageTitle': 'Roadmap — Zarparia',
	'roadmap.heading': 'Roadmap',
	'roadmap.intro':
		'O que já foi lançado, o que está sendo construído e o que vem a seguir. Use o botão de feedback dentro do aplicativo se houver algo que você gostaria de ver aqui.',
	'roadmap.statusShipped': 'Lançado',
	'roadmap.statusBuilding': 'Em desenvolvimento',
	'roadmap.statusPlanned': 'Planejado',
	'home.readGuide': 'Ler o guia',

	'authEmail.email': 'E-mail',
	'authEmail.password': 'Senha',
	'authEmail.passwordHint': 'Pelo menos 8 caracteres',
	'authEmail.signInSubmit': 'Entrar',
	'authEmail.signUpSubmit': 'Criar conta',
	'authEmail.resetSubmit': 'Enviar link de redefinição',
	'authEmail.working': 'Processando…',
	'authEmail.linkCreateAccount': 'Criar conta',
	'authEmail.linkForgotPassword': 'Esqueceu a senha?',
	'authEmail.linkBackToSignIn': 'Voltar para o login',
	'authEmail.verifyNotice':
		'Verifique seu e-mail antes de continuar — enviamos um link de verificação para sua caixa de entrada.',
	'authEmail.resend': 'Reenviar e-mail de verificação',
	'authEmail.resendSent': 'E-mail de verificação enviado',
	'authEmail.signupSuccess': 'Verifique seu e-mail para confirmar a conta e depois faça login.',
	'authEmail.resetSent': 'Se existir uma conta com esse e-mail, um link de redefinição está a caminho.',
	'authEmail.errInvalidEmail': 'Esse endereço de e-mail parece inválido.',
	'authEmail.errEmailInUse': 'Já existe uma conta com esse endereço de e-mail.',
	'authEmail.errWeakPassword': 'Escolha uma senha com pelo menos 6 caracteres.',
	'authEmail.errBadCredentials': 'E-mail ou senha incorretos.',
	'authEmail.errTooManyRequests': 'Muitas tentativas. Aguarde um momento e tente novamente.',
	'authEmail.errGeneric': 'Algo deu errado. Tente novamente.'
};

export const catalogs: Record<Locale, Messages> = {
	'en-GB': enGB,
	'pt-BR': ptBR
};
