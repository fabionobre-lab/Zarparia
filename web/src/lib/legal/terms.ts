// Terms of Service — long-form legal copy, bilingual. DRAFT for owner review
// before real signups (Phase 1 of LAUNCH_PLAN.md). Rendered by
// routes/terms/+page.svelte via lib/legal/LegalPage.svelte.
//
// Section `id`s are asserted (in test/legal.test.ts) to be identical, in the
// same order, across both locales — edit both together.
import type { LegalCatalog } from './types';

export const terms: LegalCatalog = {
	'en-GB': {
		title: 'Terms of Service',
		intro: [
			'These terms cover your use of Zarparia, an early-access travel itinerary app run by one person, referred to here as "the operator" ("we"). By using the app you agree to them, and to the Privacy Policy.'
		],
		sections: [
			{
				id: 'early-access',
				heading: 'Early access',
				paragraphs: [
					"Zarparia is in early access. Features can change, break, or be removed without notice, and the service as a whole may be paused or discontinued at any time. New accounts currently require the operator's approval before they can use the app.",
					'Because this is a beta, keep your own copy of anything critical — booking confirmations, tickets, addresses — rather than relying on Zarparia as your only record of it.'
				]
			},
			{
				id: 'the-service',
				heading: 'The service',
				paragraphs: [
					'Zarparia lets you build, store and share travel itineraries, optionally import photos from Google Photos, and optionally connect AI assistants to your trips through the MCP connector. Sign-in is via Google only.'
				]
			},
			{
				id: 'acceptable-use',
				heading: 'Acceptable use',
				paragraphs: ["When using Zarparia, you agree not to:"],
				bullets: [
					'store or share unlawful, harassing or infringing content;',
					'abuse, scrape, or attempt to overload the service;',
					"try to access another user's account or data without permission."
				]
			},
			{
				id: 'sharing-responsibilities',
				heading: 'Sharing responsibilities',
				paragraphs: [
					"You control who sees or edits each of your trips, through direct invites or shareable links. You're responsible for who you share a trip with and for how sensitive the content you put in it is — treat a shareable link the way you'd treat a shared document: anyone who has it can view (or edit, depending on the permission you set) that trip."
				]
			},
			{
				id: 'not-advice',
				heading: 'Not travel advice',
				paragraphs: [
					'Zarparia is a planning and organisational tool. Nothing in it — including imported itinerary text, place details, or any AI-assisted content — is advice you should rely on. Always verify bookings, opening times, visa or entry requirements, and any other travel-critical detail directly with the airline, venue or official source before you travel.'
				]
			},
			{
				id: 'availability',
				heading: "Availability and 'as is'",
				paragraphs: [
					"The service is provided as-is and as-available, with no uptime guarantee. Backups are kept for up to 35 days as described in the Privacy Policy, but they're a recovery mechanism for the operator, not a promise that your data will always be retrievable."
				]
			},
			{
				id: 'termination',
				heading: 'Suspension and termination',
				paragraphs: [
					'The operator may suspend or terminate an account that breaks the acceptable-use rules above, or discontinue the service entirely, at any time. You can delete your own account at any time from the Account page.'
				]
			},
			{
				id: 'governing-law',
				heading: 'Governing law',
				paragraphs: [
					'These terms are governed by the law of England and Wales, and any dispute arising from them is subject to the exclusive jurisdiction of the courts of England and Wales.'
				]
			},
			{
				id: 'support',
				heading: 'Support',
				paragraphs: [
					"The current support channel is the in-app feedback button. This is early access, so there's no guaranteed response time."
				]
			},
			{
				id: 'changes',
				heading: 'Changes to these terms',
				paragraphs: [
					"If these terms change in a way that matters, we'll update the ‘Last updated’ date at the top of this page. Continuing to use Zarparia after a change means you accept the updated terms."
				]
			}
		]
	},
	'pt-BR': {
		title: 'Termos de Serviço',
		intro: [
			'Estes termos cobrem o seu uso do Zarparia, um aplicativo de roteiros de viagem em acesso antecipado, operado por uma única pessoa, chamada aqui de "o operador" ("nós"). Ao usar o aplicativo, você concorda com eles e com a Política de Privacidade.'
		],
		sections: [
			{
				id: 'early-access',
				heading: 'Acesso antecipado',
				paragraphs: [
					'O Zarparia está em acesso antecipado. Os recursos podem mudar, apresentar falhas ou ser removidos sem aviso prévio, e o serviço como um todo pode ser pausado ou descontinuado a qualquer momento. No momento, novas contas precisam de aprovação do operador antes de poder usar o aplicativo.',
					'Por se tratar de um beta, mantenha sua própria cópia de qualquer coisa essencial — confirmações de reserva, passagens, endereços — em vez de depender do Zarparia como seu único registro delas.'
				]
			},
			{
				id: 'the-service',
				heading: 'O serviço',
				paragraphs: [
					'O Zarparia permite criar, armazenar e compartilhar roteiros de viagem, opcionalmente importar fotos do Google Fotos e, também opcionalmente, conectar assistentes de IA às suas viagens através do conector MCP. O login é feito somente com o Google.'
				]
			},
			{
				id: 'acceptable-use',
				heading: 'Uso aceitável',
				paragraphs: ['Ao usar o Zarparia, você concorda em não:'],
				bullets: [
					'armazenar ou compartilhar conteúdo ilegal, difamatório ou que infrinja direitos de terceiros;',
					'abusar do serviço, fazer scraping ou tentar sobrecarregá-lo;',
					'tentar acessar a conta ou os dados de outro usuário sem permissão.'
				]
			},
			{
				id: 'sharing-responsibilities',
				heading: 'Responsabilidades ao compartilhar',
				paragraphs: [
					'Você controla quem vê ou edita cada uma das suas viagens, seja por convites diretos ou por links compartilháveis. Você é responsável por com quem compartilha uma viagem e pela sensibilidade do conteúdo que coloca nela — trate um link compartilhável como trataria um documento compartilhado: qualquer pessoa que o tenha pode ver (ou editar, dependendo da permissão definida) aquela viagem.'
				]
			},
			{
				id: 'not-advice',
				heading: 'Não é aconselhamento de viagem',
				paragraphs: [
					'O Zarparia é uma ferramenta de planejamento e organização. Nada nele — incluindo texto de roteiro importado, detalhes de lugares ou qualquer conteúdo gerado com ajuda de IA — é um conselho em que você deva confiar. Sempre verifique reservas, horários de funcionamento, requisitos de visto ou entrada, e qualquer outro detalhe essencial diretamente com a companhia aérea, o local ou a fonte oficial antes de viajar.'
				]
			},
			{
				id: 'availability',
				heading: 'Disponibilidade e "como está"',
				paragraphs: [
					'O serviço é fornecido "como está" e "conforme disponível", sem garantia de disponibilidade contínua. Os backups são mantidos por até 35 dias, conforme descrito na Política de Privacidade, mas são um mecanismo de recuperação do operador, não uma promessa de que seus dados sempre poderão ser recuperados.'
				]
			},
			{
				id: 'termination',
				heading: 'Suspensão e encerramento',
				paragraphs: [
					'O operador pode suspender ou encerrar uma conta que descumpra as regras de uso aceitável acima, ou descontinuar o serviço por completo, a qualquer momento. Você pode excluir sua própria conta a qualquer momento pela página Conta.'
				]
			},
			{
				id: 'governing-law',
				heading: 'Legislação aplicável',
				paragraphs: [
					'Estes termos são regidos pela legislação da Inglaterra e do País de Gales, e qualquer disputa decorrente deles está sujeita à jurisdição exclusiva dos tribunais da Inglaterra e do País de Gales.'
				]
			},
			{
				id: 'support',
				heading: 'Suporte',
				paragraphs: [
					'O canal de suporte atual é o botão de feedback do aplicativo. Por se tratar de acesso antecipado, não há prazo de resposta garantido.'
				]
			},
			{
				id: 'changes',
				heading: 'Alterações a estes termos',
				paragraphs: [
					'Se estes termos mudarem de forma relevante, atualizaremos a data de "Última atualização" no topo desta página. Continuar usando o Zarparia depois de uma mudança significa que você aceita os termos atualizados.'
				]
			}
		]
	}
};
