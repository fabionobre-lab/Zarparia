// Privacy Policy — long-form legal copy, bilingual. DRAFT for owner review
// before real signups (Phase 1 of LAUNCH_PLAN.md). Rendered by
// routes/privacy/+page.svelte via lib/legal/LegalPage.svelte.
//
// Section `id`s are asserted (in test/legal.test.ts) to be identical, in the
// same order, across both locales — edit both together.
import type { LegalCatalog } from './types';

export const privacy: LegalCatalog = {
	'en-GB': {
		title: 'Privacy Policy',
		intro: [
			'Zarparia is an independent, early-access travel itinerary app built and run by one person, referred to here as "the operator" ("we"). This policy explains what the app stores, why, and how you can see or remove it. It covers the whole product, including the optional Google Photos and MCP connector features.'
		],
		sections: [
			{
				id: 'what-we-store',
				heading: 'What we store',
				paragraphs: [
					'When you sign in with Google, we store your email address, name, avatar image URL, your Google account identifier (the "sub" claim), your account status, and account timestamps.',
					'Everything you create in the app is stored too: your trips and itineraries — locations, dates, notes and all other trip content — records of who a trip has been shared with, any share links you create, and any feedback you submit through the in-app feedback button.',
					'If you connect the MCP connector (see below), we store the OAuth grants that let an AI assistant reach your trips. The tokens themselves are kept hashed, never in plain text.'
				]
			},
			{
				id: 'where-it-lives',
				heading: 'Where it lives',
				paragraphs: [
					"Zarparia runs entirely on Cloudflare: the app itself, its database (Cloudflare D1) and any stored files (Cloudflare R2) all sit on Cloudflare's infrastructure. Cloudflare may process data in the EU, UK or US depending on where its network routes a given request; Cloudflare participates in the EU–US Data Privacy Framework for transfers of that kind.",
					"Google processes data when you sign in (Google OAuth), and — only if you choose to connect it — when you pick photos from Google Photos.",
					"We don't use any other third-party processor, and there is no analytics or advertising service reading your data."
				]
			},
			{
				id: 'cookies',
				heading: 'Cookies',
				paragraphs: [
					'Zarparia sets three cookies, all of them essential to running the app. This list is the complete disclosure of every cookie we set — there is nothing else, and none of it is tracking or advertising, so no cookie-consent banner is shown.'
				],
				bullets: [
					'session — keeps you signed in. Set only once you sign in with Google; httpOnly, so no page script can read it.',
					"ui-locale — remembers whether you're using the app in English or Portuguese.",
					'zarparia-theme — remembers your light/dark/system theme preference.'
				]
			},
			{
				id: 'google-photos',
				heading: 'Google Photos',
				paragraphs: [
					"Google Photos is an optional feature. If you connect it, Zarparia only ever sees the specific photos you pick yourself through Google's own Photos Picker — it is never given access to your whole library.",
					'Photos you pick are cached in Cloudflare R2 as two versions each (a thumbnail and a larger display copy), organised per trip, so the app can show them without repeatedly calling back to Google.',
					"Deleting a trip removes its cached photos. Deleting your account (see ‘Your rights’ below) removes every cached photo copy across all of your trips."
				]
			},
			{
				id: 'mcp-connector',
				heading: 'MCP connector',
				paragraphs: [
					'The MCP connector is an optional feature that lets you connect an AI assistant (for example, Claude) to your trips using the OAuth 2.1 standard, so the assistant can read or edit your itineraries on your behalf.',
					'Access tokens issued through this flow are stored hashed, the same way a password would be — we cannot read the token itself, only verify a request that presents it.',
					'Deleting your account immediately revokes every MCP grant tied to it.'
				]
			},
			{
				id: 'sharing',
				heading: 'What sharing a trip reveals',
				paragraphs: [
					'You choose who can see or edit each trip, either by inviting a specific person or by turning on a shareable link. Anyone you share a trip with can see everything on that trip — its locations, dates, notes and any photos attached to it.',
					"They don't see anything about your account itself beyond what the trip shows, and they don't see your other trips."
				]
			},
			{
				id: 'your-rights',
				heading: 'Your rights',
				paragraphs: [
					'You can download a full copy of everything Zarparia holds about you, and permanently delete your account, at any time from the Account page (/account) — no request to us is needed.',
					'Export your data produces a single JSON file containing your profile, your trips, your sharing history, your feedback and your MCP grants.',
					"Delete account is immediate and permanent: it erases your account, your trips, and every cached photo copy straight away. If you own a trip you'd shared with other people, deleting your account deletes that trip for them too — they lose access immediately, not just you. Trips other people shared with you are simply removed from your account; the owner's trip is untouched."
				]
			},
			{
				id: 'approval-gate',
				heading: 'New-account approval',
				paragraphs: [
					"Zarparia is in an early-access beta. New accounts need the operator's manual approval before they can create or view trips — this is an access control to keep the beta small while it's being tested, not a review of what you store."
				]
			},
			{
				id: 'backups',
				heading: 'Backups',
				paragraphs: [
					"We retain backups of the app's data for up to 35 days, after which older backups expire automatically. Backups exist to recover from an operational failure, not as a way to keep data you've deleted: deleting your account removes your data from live storage immediately, and any copy still sitting in an existing backup is purged once that backup expires within the 35-day window."
				]
			},
			{
				id: 'contact',
				heading: 'Contact',
				paragraphs: [
					"Zarparia doesn't have a support email address yet. The way to reach the operator about this policy, or about your data, is the in-app feedback button — the speech-bubble icon in the header, or in the mobile 'More' menu."
				]
			},
			{
				id: 'changes',
				heading: 'Changes to this policy',
				paragraphs: [
					"If this policy changes in a way that matters, we'll update the ‘Last updated’ date at the top of this page. Continuing to use Zarparia after a change means you accept the updated policy."
				]
			}
		]
	},
	'pt-BR': {
		title: 'Política de Privacidade',
		intro: [
			'O Zarparia é um aplicativo independente de roteiros de viagem, em acesso antecipado, criado e operado por uma única pessoa, chamada aqui de "o operador" ("nós"). Esta política explica o que o aplicativo armazena, por quê, e como você pode ver ou remover esses dados. Ela cobre todo o produto, incluindo os recursos opcionais de Google Fotos e do conector MCP.'
		],
		sections: [
			{
				id: 'what-we-store',
				heading: 'O que armazenamos',
				paragraphs: [
					'Ao entrar com o Google, armazenamos seu endereço de e-mail, nome, URL da imagem de avatar, o identificador da sua conta Google (a reivindicação "sub"), o status da sua conta e registros de data/hora da conta.',
					'Tudo o que você cria no aplicativo também é armazenado: suas viagens e roteiros — locais, datas, notas e todo o restante do conteúdo da viagem —, registros de com quem uma viagem foi compartilhada, quaisquer links de compartilhamento que você criar, e qualquer feedback enviado pelo botão de feedback do aplicativo.',
					'Se você conectar o conector MCP (veja abaixo), armazenamos as autorizações OAuth que permitem que um assistente de IA acesse suas viagens. Os tokens em si são armazenados de forma hasheada (com hash), nunca em texto simples.'
				]
			},
			{
				id: 'where-it-lives',
				heading: 'Onde os dados ficam',
				paragraphs: [
					'O Zarparia roda inteiramente na Cloudflare: o próprio aplicativo, seu banco de dados (Cloudflare D1) e quaisquer arquivos armazenados (Cloudflare R2) ficam na infraestrutura da Cloudflare. A Cloudflare pode processar dados na UE, no Reino Unido ou nos EUA, dependendo de para onde sua rede encaminha cada solicitação; a Cloudflare participa do EU–US Data Privacy Framework para transferências desse tipo.',
					'O Google processa dados quando você entra (Google OAuth) e — apenas se você optar por conectá-lo — quando você escolhe fotos do Google Fotos.',
					'Não usamos nenhum outro processador terceirizado, e não há nenhum serviço de analytics ou de publicidade lendo seus dados.'
				]
			},
			{
				id: 'cookies',
				heading: 'Cookies',
				paragraphs: [
					'O Zarparia define três cookies, todos essenciais para o funcionamento do aplicativo. Esta lista é a divulgação completa de cada cookie que definimos — não há mais nenhum, e nenhum deles é de rastreamento ou publicidade, por isso não é exibido nenhum banner de consentimento de cookies.'
				],
				bullets: [
					'session — mantém você conectado. Definido somente depois que você entra com o Google; é httpOnly, então nenhum script da página consegue lê-lo.',
					'ui-locale — lembra se você está usando o aplicativo em inglês ou em português.',
					'zarparia-theme — lembra sua preferência de tema claro/escuro/sistema.'
				]
			},
			{
				id: 'google-photos',
				heading: 'Google Fotos',
				paragraphs: [
					'O Google Fotos é um recurso opcional. Se você o conectar, o Zarparia só enxerga as fotos específicas que você mesmo escolher pelo seletor (Picker) do próprio Google Fotos — ele nunca recebe acesso à sua biblioteca inteira.',
					'As fotos escolhidas são colocadas em cache no Cloudflare R2 em duas versões cada (uma miniatura e uma cópia maior para exibição), organizadas por viagem, para que o aplicativo possa mostrá-las sem chamar o Google repetidamente.',
					'Excluir uma viagem remove suas fotos em cache. Excluir sua conta (veja "Seus direitos" abaixo) remove toda cópia de foto em cache em todas as suas viagens.'
				]
			},
			{
				id: 'mcp-connector',
				heading: 'Conector MCP',
				paragraphs: [
					'O conector MCP é um recurso opcional que permite conectar um assistente de IA (por exemplo, o Claude) às suas viagens usando o padrão OAuth 2.1, para que o assistente possa ler ou editar seus roteiros em seu nome.',
					'Os tokens de acesso emitidos por esse fluxo são armazenados de forma hasheada, da mesma forma que uma senha seria — não conseguimos ler o token em si, apenas verificar uma solicitação que o apresente.',
					'Excluir sua conta revoga imediatamente toda autorização MCP vinculada a ela.'
				]
			},
			{
				id: 'sharing',
				heading: 'O que compartilhar uma viagem revela',
				paragraphs: [
					'Você escolhe quem pode ver ou editar cada viagem, seja convidando uma pessoa específica ou ativando um link compartilhável. Qualquer pessoa com quem você compartilhe uma viagem pode ver tudo naquela viagem — seus locais, datas, notas e quaisquer fotos anexadas a ela.',
					'Essas pessoas não veem nada sobre a sua conta além do que a viagem mostra, e não veem suas outras viagens.'
				]
			},
			{
				id: 'your-rights',
				heading: 'Seus direitos',
				paragraphs: [
					'Você pode baixar uma cópia completa de tudo o que o Zarparia guarda sobre você, e excluir sua conta permanentemente, a qualquer momento, pela página Conta (/account) — não é preciso nos pedir nada.',
					'Exportar seus dados gera um único arquivo JSON contendo seu perfil, suas viagens, seu histórico de compartilhamento, seu feedback e suas autorizações MCP.',
					'Excluir conta é imediato e permanente: apaga sua conta, suas viagens e toda cópia de foto em cache na hora. Se você é dono de uma viagem que compartilhou com outras pessoas, excluir sua conta também exclui essa viagem para elas — elas perdem o acesso imediatamente, não só você. Viagens que outras pessoas compartilharam com você são simplesmente removidas da sua conta; a viagem do dono original permanece intacta.'
				]
			},
			{
				id: 'approval-gate',
				heading: 'Aprovação de novas contas',
				paragraphs: [
					'O Zarparia está em beta de acesso antecipado. Novas contas precisam de aprovação manual do operador antes de poder criar ou ver viagens — isso é um controle de acesso para manter o beta pequeno enquanto está sendo testado, não uma revisão do que você armazena.'
				]
			},
			{
				id: 'backups',
				heading: 'Backups',
				paragraphs: [
					'Mantemos backups dos dados do aplicativo por até 35 dias, após os quais os backups mais antigos expiram automaticamente. Os backups existem para recuperação de uma falha operacional, não como uma forma de manter dados que você excluiu: excluir sua conta remove seus dados do armazenamento ativo imediatamente, e qualquer cópia que ainda esteja em um backup existente é apagada quando esse backup expira, dentro da janela de 35 dias.'
				]
			},
			{
				id: 'contact',
				heading: 'Contato',
				paragraphs: [
					'O Zarparia ainda não tem um e-mail de suporte. A forma de falar com o operador sobre esta política, ou sobre seus dados, é o botão de feedback do aplicativo — o ícone de balão de fala no cabeçalho, ou no menu "Mais" no celular.'
				]
			},
			{
				id: 'changes',
				heading: 'Alterações nesta política',
				paragraphs: [
					'Se esta política mudar de forma relevante, atualizaremos a data de "Última atualização" no topo desta página. Continuar usando o Zarparia depois de uma mudança significa que você aceita a política atualizada.'
				]
			}
		]
	}
};
