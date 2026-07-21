// User guide — long-form, bilingual content (Phase 4 of LAUNCH_PLAN.md).
// Rendered by routes/guide/+page.svelte via lib/guide/GuidePage.svelte.
//
// Deliberately NOT: a first-run tour, search, an external docs site, or a
// PDF — see LAUNCH_PLAN.md 4.1 for the reasoning. Written from what the UI
// actually does; verify against the relevant route/component before editing.
//
// Group and entry `id`s are asserted (in test/guide.test.ts) to be identical,
// in the same order, across both locales, and unique across the whole
// document — entry ids double as #anchors other pages can deep-link to
// (e.g. /guide#share-trip), so change them with care.
import type { GuideCatalog } from './types';

export const guide: GuideCatalog = {
	'en-GB': {
		intro:
			'How Zarparia works, in plain language — what each screen does and how to do the everyday things. Nothing here is a substitute for exploring the app yourself.',
		groups: [
			{
				id: 'getting-started',
				heading: 'Getting started',
				entries: [
					{
						id: 'sign-in-google',
						title: 'Sign in with Google',
						body: [
							"Zarparia only supports signing in with a Google account — there's no separate password to create or remember. Your name, email and avatar come from Google; nothing else about your Google account is touched unless you separately connect Google Photos."
						]
					},
					{
						id: 'sign-in-email',
						title: 'Sign in with email and password',
						body: [
							'Where available, you can also create an account with just an email address and a password instead of using Google. Create an account from the sign-in card, then check your inbox for a verification link — you need to verify your email before you can sign in.',
							"Forgot your password? Use the \"Forgot password?\" link on the sign-in card to get a reset email. If you sign in with Google using the same email address you used for email+password, both reach the same account — Zarparia treats a verified email as one identity no matter which way you sign in with it."
						]
					},
					{
						id: 'approval-wait',
						title: 'Why do I have to wait for approval?',
						body: [
							"Zarparia is a small, invite-only beta. The first time you sign in, your account is created but marked pending until the operator approves it — you'll see a review screen instead of your trips until then. There's nothing to do but check back; approval doesn't require you to sign in again."
						]
					},
					{
						id: 'first-trip',
						title: 'Create your first trip',
						body: [
							'Once approved, use "New trip" to open a short wizard: give the trip a title and start date, then list the places you\'re going with how many nights at each. It builds a draft itinerary you can then refine in the editor — or start from a blank trip if you\'d rather build it up yourself.'
						]
					},
					{
						id: 'try-demo',
						title: 'Try the demo',
						body: [
							"You don't need an account to see what Zarparia looks like with a real trip in it. The demo is a fully interactive sample itinerary — everything responds, nothing is saved, and it never touches a real account."
						]
					}
				]
			},
			{
				id: 'screens',
				heading: 'The screens',
				entries: [
					{
						id: 'trips-list',
						title: 'Trips list (home)',
						body: [
							"Your home screen once you're signed in and approved. It lists trips you own and trips others have shared with you, with the currently-happening trip (if any) pulled out into a highlighted card at the top."
						]
					},
					{
						id: 'trip-view',
						title: 'Trip view',
						body: [
							'The read-through view of a trip: a day-by-day itinerary with times, places, notes and a map, organised into stops. This is what you see when you open a trip, and what anyone you share it with sees too.',
							"Each day also shows a weather forecast, when the trip is close enough in time for one to be available. For trips that have already happened, the editor can instead record the weather that actually happened, so the day still shows something useful."
						]
					},
					{
						id: 'editor',
						title: 'Trip editor',
						body: [
							"Where you build and change a trip: settings (title, languages, home base), stops (\"segments\" in the editor's own labels), days and the individual blocks of a day's schedule, each with a live preview alongside. Reached from a trip's Edit button — only people with edit access (owners and editors) can get to it.",
							"A stop can hold more than one plan — alternate versions of the same days, for example a rainy-day option alongside the usual one. Anyone viewing the trip can switch between a stop's plans using the plan tabs in the trip view."
						]
					},
					{
						id: 'import',
						title: 'Import',
						body: [
							"Paste a rough itinerary — an email thread, a list of notes, even a loose sentence describing the trip — and Zarparia turns it into a draft trip you can refine afterwards in the editor. It's a starting point, not a finished result; expect to tidy it up."
						]
					},
					{
						id: 'account',
						title: 'Account',
						body: [
							'Your account page: export everything Zarparia holds about you as one file, or permanently delete your account. Reached from the sidebar (desktop) or the More sheet (mobile).'
						]
					}
				]
			},
			{
				id: 'how-do-i',
				heading: 'How do I…',
				entries: [
					{
						id: 'share-trip',
						title: 'Share a trip',
						body: [
							"Open the trip and use Share. You can invite someone by email as a viewer or editor — if they don't have a Zarparia account yet, the invite is held as “Pending sign-in” and turns into real access the first time they sign in with that email — or turn on a shareable link that grants view or edit access to anyone who has it, no sign-in required for viewing.",
							"Each person in the list has an Email button that opens a ready-to-send message in your own mail app, worded for their case: someone still pending is told to sign in with that email to get access, while someone who already has access just gets a link to open the trip. Pick the email's language with the selector (it defaults to your app language). Nothing is sent automatically — you send it yourself, from your own address."
						]
					},
					{
						id: 'share-link',
						title: 'Use a share link',
						body: [
							"Opening a shareable link someone sent you shows the trip straight away if it's set to view access. If it grants edit access, or the link owner turned it off, you'll be asked to sign in first so Zarparia can check the invite is still valid."
						]
					},
					{
						id: 'photos',
						title: 'Add photos from Google Photos',
						body: [
							"From a trip's Photos panel, connect Google Photos and pick photos with Google's own picker — Zarparia only ever sees the exact photos you select, never your whole library. Picked photos are matched automatically to the right day by when they were taken; any that fall outside the trip dates land in an \"unmatched\" section you can move by hand."
						]
					},
					{
						id: 'offline',
						title: 'Use Zarparia offline',
						body: [
							'Install Zarparia as an app (from your browser\'s "install" or "add to home screen" option) and it keeps a copy of your trips available without a connection. Visit a trip once while online to make sure it\'s cached; changes made offline sync once you\'re back online.'
						]
					},
					{
						id: 'export-data',
						title: 'Export my data',
						body: [
							'From the Account page, "Export my data" downloads a single JSON file with everything Zarparia holds about you: your profile, your trips, sharing records, feedback you\'ve sent, and your photo records.'
						]
					},
					{
						id: 'add-to-calendar',
						title: 'Add a trip to your calendar',
						body: [
							'Open a trip and use the "Add to calendar" button, always visible near the top — it downloads a single .ics file for the whole trip. Import that file into Google Calendar, Apple Calendar, Outlook or any other calendar app that accepts .ics files, and each event carries the trip\'s local times.'
						]
					},
					{
						id: 'print-itinerary',
						title: 'Print or save the itinerary as a PDF',
						body: [
							'Open a trip and use the "Print / Save as PDF" button near the top. It opens a clean, A4-formatted document with the whole trip — every day and every stop laid out flat — and your browser\'s print dialog appears automatically. Choose your printer to print it, or pick "Save as PDF" as the destination to keep a file. Shared trips can be printed the same way from their public link.'
						]
					},
					{
						id: 'trip-budget',
						title: 'Set a budget and track costs',
						body: [
							'Give a trip a currency and a total budget in Trip settings, then add an estimated cost — with an optional category (lodging, food, transport, activities, shopping or other) — to any stop in the block editor. Zarparia sums those into a per-day subtotal and a whole-trip total, shown against your budget as a colour-coded bar at the top of the trip: green while you have room, amber as you approach the limit, red once the estimate goes over.',
							"Because each alternative plan has its own stops, the total re-calculates when you switch plans — so you can compare what two versions of the same days would cost. If you set no budget but still add costs, the bar just shows the running total."
						]
					},
					{
						id: 'booking-links',
						title: 'Link to a hotel or reservation confirmation',
						body: [
							'In the block editor, any stop can carry one or more booking links — paste the URL of a hotel confirmation (Booking.com, Expedia, Airbnb, Hotels.com and others), a restaurant reservation, or a ticket. Leave the label blank and Zarparia names the pill from the link itself (for example a booking.com URL shows as "Booking.com"); set a label to override it.',
							'The links show up as tappable pills on the stop in the trip view, and are listed in full — label and URL — on the printed/PDF itinerary. They travel with the trip, so anyone you share it with sees them too; only add links you\'re happy for those people to open.'
						]
					},
					{
						id: 'delete-account',
						title: 'Delete my account',
						body: [
							'Also from the Account page — this is permanent and cannot be undone. Trips you own are deleted, including for everyone they were shared with; trips shared with you are simply removed from your access, not deleted. You\'ll be asked to type a confirmation before it happens.'
						]
					},
					{
						id: 'language-theme',
						title: 'Switch language or theme',
						body: [
							'The EN | PT switcher changes the app\'s own language (a trip\'s content can be in different languages again, independently). The theme control cycles light, dark and system. Both live in the sidebar on desktop and in the More sheet on mobile, and are remembered for next time.'
						]
					},
					{
						id: 'mcp',
						title: 'Connect an AI assistant',
						body: [
							'Advanced/optional: Zarparia has an MCP connector that lets an AI assistant (for example, Claude) read and edit your trips on your behalf, once you approve the connection through a standard OAuth screen. Access tokens are stored hashed, and a pending account cannot use this even with a valid connection.',
							'Trips the assistant creates come fully built out — maps links, a live weather strip, photo spots, per-stop costs and booking links — not a bare skeleton. One thing to know: the connector acts as whichever account you approved it with, so sign in to Zarparia with that same account to see those trips in your list.'
						]
					},
					{
						id: 'send-feedback',
						title: 'Send feedback',
						body: [
							'Use the feedback button — a speech-bubble icon in the sidebar (desktop) or the "More" sheet (mobile) — to send a bug report, an idea, or anything else. Your submissions are listed on the Feedback page (/feedback); deleting your account deletes them along with the rest of your data.'
						]
					}
				]
			},
			{
				id: 'glossary',
				heading: 'Glossary',
				entries: [
					{
						id: 'glossary-trip',
						title: 'Trip',
						body: ['A single itinerary — one or more stops, each with its own days and schedule.']
					},
					{
						id: 'glossary-itinerary-day',
						title: 'Itinerary day',
						body: [
							"One day within a trip's schedule: a date, an optional title and note, and a list of timed blocks (places, activities, travel)."
						]
					},
					{
						id: 'glossary-share-link',
						title: 'Share link',
						body: [
							'A single URL that grants access to a trip to anyone who has it, without naming individual people. Can be turned off, or switched between view and edit access, at any time by the trip owner.'
						]
					},
					{
						id: 'glossary-viewer-editor',
						title: 'Viewer / editor',
						body: [
							"The two roles a trip can be shared with: a viewer can read a trip but not change it; an editor can also add, edit and reorder its content. Only the owner can delete a trip or change who it's shared with."
						]
					},
					{
						id: 'glossary-pending-approval',
						title: 'Pending approval',
						body: [
							"A signed-in account that hasn't yet been approved by the operator. It can't read or create any trip, photo or feedback data until approved."
						]
					},
					{
						id: 'glossary-demo-mode',
						title: 'Demo mode',
						body: [
							'The public sample trip at /demo — fully interactive, requires no account, and never saves anything or touches real data.'
						]
					}
				]
			}
		]
	},
	'pt-BR': {
		intro:
			'Como o Zarparia funciona, em linguagem simples — o que cada tela faz e como fazer as tarefas do dia a dia. Nada aqui substitui explorar o aplicativo você mesmo.',
		groups: [
			{
				id: 'getting-started',
				heading: 'Primeiros passos',
				entries: [
					{
						id: 'sign-in-google',
						title: 'Entrar com o Google',
						body: [
							'O Zarparia só permite entrar com uma conta do Google — não há senha separada para criar ou lembrar. Seu nome, e-mail e avatar vêm do Google; nada mais na sua conta do Google é acessado, a menos que você conecte o Google Fotos separadamente.'
						]
					},
					{
						id: 'sign-in-email',
						title: 'Entrar com e-mail e senha',
						body: [
							'Quando disponível, você também pode criar uma conta usando apenas um e-mail e uma senha, em vez do Google. Crie uma conta a partir do cartão de login e depois verifique sua caixa de entrada para um link de confirmação — é preciso confirmar o e-mail antes de conseguir entrar.',
							'Esqueceu a senha? Use o link "Esqueceu a senha?" no cartão de login para receber um e-mail de redefinição. Se você entrar com o Google usando o mesmo e-mail que usou no cadastro por e-mail e senha, os dois caminhos chegam à mesma conta — o Zarparia trata um e-mail verificado como uma única identidade, não importa por qual caminho você entra com ele.'
						]
					},
					{
						id: 'approval-wait',
						title: 'Por que preciso esperar aprovação?',
						body: [
							'O Zarparia está em um beta pequeno, só por convite. Na primeira vez que você entra, sua conta é criada mas fica marcada como pendente até que o operador a aprove — você verá uma tela de análise em vez das suas viagens até lá. Não há nada a fazer além de voltar a checar; a aprovação não exige que você entre novamente.'
						]
					},
					{
						id: 'first-trip',
						title: 'Crie sua primeira viagem',
						body: [
							'Depois de aprovado, use "Nova viagem" para abrir um assistente rápido: dê um título e uma data de início à viagem, depois liste os lugares que vai visitar com o número de noites em cada um. Isso monta um roteiro em rascunho que você pode refinar depois no editor — ou comece com uma viagem em branco se preferir montá-la você mesmo.'
						]
					},
					{
						id: 'try-demo',
						title: 'Veja a demonstração',
						body: [
							'Você não precisa de conta para ver como é o Zarparia com uma viagem real dentro dele. A demonstração é um roteiro de exemplo totalmente interativo — tudo responde, nada é salvo, e nunca toca em uma conta real.'
						]
					}
				]
			},
			{
				id: 'screens',
				heading: 'As telas',
				entries: [
					{
						id: 'trips-list',
						title: 'Lista de viagens (início)',
						body: [
							'Sua tela inicial depois de entrar e ser aprovado. Lista as viagens que você possui e as que outras pessoas compartilharam com você, com a viagem em andamento no momento (se houver) destacada em um cartão no topo.'
						]
					},
					{
						id: 'trip-view',
						title: 'Visualização da viagem',
						body: [
							'A visão de leitura de uma viagem: um roteiro dia a dia com horários, lugares, notas e um mapa, organizado em paradas. É o que você vê ao abrir uma viagem, e o que qualquer pessoa com quem você a compartilha também vê.',
							'Cada dia também mostra uma previsão do tempo, quando a viagem está próxima o suficiente para haver uma previsão disponível. Para viagens que já aconteceram, o editor pode registrar o tempo que realmente fez, para que o dia continue mostrando algo útil.'
						]
					},
					{
						id: 'editor',
						title: 'Editor de viagem',
						body: [
							'Onde você monta e altera uma viagem: configurações (título, idiomas, base de origem), paradas ("trechos" nos próprios rótulos do editor), dias e os blocos individuais da programação de um dia, cada um com uma pré-visualização ao vivo ao lado. Acessado pelo botão Editar de uma viagem — só quem tem acesso de edição (donos e editores) consegue chegar até lá.',
							'Uma parada pode ter mais de um plano — versões alternativas dos mesmos dias, por exemplo uma opção para dia de chuva ao lado da opção normal. Quem visualiza a viagem pode alternar entre os planos de uma parada usando as abas de plano na visualização da viagem.'
						]
					},
					{
						id: 'import',
						title: 'Importar',
						body: [
							'Cole um roteiro solto — uma troca de e-mails, uma lista de notas, até uma frase descrevendo a viagem — e o Zarparia transforma isso em uma viagem em rascunho que você refina depois no editor. É um ponto de partida, não um resultado pronto; espere ter que ajustar.'
						]
					},
					{
						id: 'account',
						title: 'Conta',
						body: [
							'Sua página de conta: exporte tudo o que o Zarparia guarda sobre você em um único arquivo, ou exclua sua conta permanentemente. Acessada pela barra lateral (computador) ou pela bandeja "Mais" (celular).'
						]
					}
				]
			},
			{
				id: 'how-do-i',
				heading: 'Como faço para…',
				entries: [
					{
						id: 'share-trip',
						title: 'Compartilhar uma viagem',
						body: [
							'Abra a viagem e use Compartilhar. Você pode convidar alguém por e-mail como visualizador ou editor — se a pessoa ainda não tiver conta no Zarparia, o convite fica como “Aguardando entrar” e vira acesso de verdade assim que ela entrar com esse e-mail — ou ativar um link compartilhável que dá acesso de visualização ou edição a qualquer pessoa que o tenha, sem exigir login para visualizar.',
							'Cada pessoa na lista tem um botão de e-mail que abre uma mensagem pronta para enviar no seu próprio aplicativo de e-mail, com o texto certo para cada caso: quem ainda está aguardando é orientado a entrar com aquele e-mail para ter acesso, enquanto quem já tem acesso recebe apenas um link para abrir a viagem. Escolha o idioma do e-mail no seletor (o padrão é o idioma do app). Nada é enviado automaticamente — você mesmo envia, do seu endereço.'
						]
					},
					{
						id: 'share-link',
						title: 'Usar um link de compartilhamento',
						body: [
							'Abrir um link compartilhável que alguém te enviou mostra a viagem na hora se ele estiver configurado como acesso de visualização. Se der acesso de edição, ou se quem criou o link o desativou, você será solicitado a entrar antes, para que o Zarparia confirme que o convite ainda é válido.'
						]
					},
					{
						id: 'photos',
						title: 'Adicionar fotos do Google Fotos',
						body: [
							'No painel de Fotos de uma viagem, conecte o Google Fotos e escolha fotos usando o seletor do próprio Google — o Zarparia só vê exatamente as fotos que você seleciona, nunca a sua biblioteca inteira. As fotos escolhidas são associadas automaticamente ao dia certo pela data em que foram tiradas; as que caem fora das datas da viagem ficam em uma seção "não associadas" que você pode mover manualmente.'
						]
					},
					{
						id: 'offline',
						title: 'Usar o Zarparia offline',
						body: [
							'Instale o Zarparia como aplicativo (pela opção "instalar" ou "adicionar à tela inicial" do seu navegador) e ele mantém uma cópia das suas viagens disponível sem conexão. Visite uma viagem uma vez estando online para garantir que ela fique salva; alterações feitas offline são sincronizadas assim que a conexão voltar.'
						]
					},
					{
						id: 'export-data',
						title: 'Exportar meus dados',
						body: [
							'Na página de Conta, "Exportar meus dados" baixa um único arquivo JSON com tudo o que o Zarparia guarda sobre você: seu perfil, suas viagens, registros de compartilhamento, feedback enviado e seus registros de fotos.'
						]
					},
					{
						id: 'add-to-calendar',
						title: 'Adicionar uma viagem ao seu calendário',
						body: [
							'Abra a viagem e use o botão "Adicionar ao calendário", sempre visível perto do topo — ele baixa um único arquivo .ics com a viagem inteira. Importe esse arquivo no Google Agenda, no Calendário da Apple, no Outlook ou em qualquer outro aplicativo de calendário que aceite arquivos .ics, e cada evento leva os horários locais da viagem.'
						]
					},
					{
						id: 'print-itinerary',
						title: 'Imprimir ou salvar o roteiro em PDF',
						body: [
							'Abra a viagem e use o botão "Imprimir / Salvar PDF" perto do topo. Ele abre um documento limpo, formatado para A4, com a viagem inteira — cada dia e cada parada dispostos de forma corrida — e a janela de impressão do navegador aparece automaticamente. Escolha sua impressora para imprimir, ou selecione "Salvar como PDF" como destino para guardar um arquivo. Viagens compartilhadas podem ser impressas da mesma forma pelo link público.'
						]
					},
					{
						id: 'trip-budget',
						title: 'Definir um orçamento e acompanhar os custos',
						body: [
							'Dê à viagem uma moeda e um orçamento total nas configurações da viagem e, em seguida, adicione um custo estimado — com uma categoria opcional (hospedagem, alimentação, transporte, atividades, compras ou outros) — a qualquer parada no editor de blocos. O Zarparia soma tudo em um subtotal por dia e um total da viagem inteira, mostrados em relação ao seu orçamento como uma barra colorida no topo da viagem: verde enquanto há folga, âmbar ao se aproximar do limite, vermelho quando a estimativa passa.',
							'Como cada plano alternativo tem suas próprias paradas, o total é recalculado ao trocar de plano — assim você compara quanto custariam duas versões dos mesmos dias. Se você não definir um orçamento mas ainda adicionar custos, a barra apenas mostra o total acumulado.'
						]
					},
					{
						id: 'booking-links',
						title: 'Vincular à confirmação de um hotel ou reserva',
						body: [
							'No editor de blocos, qualquer parada pode ter um ou mais links de reserva — cole a URL de uma confirmação de hotel (Booking.com, Expedia, Airbnb, Hotels.com e outros), de uma reserva em restaurante ou de um ingresso. Deixe o rótulo em branco e o Zarparia nomeia a pílula a partir do próprio link (por exemplo, uma URL do booking.com aparece como "Booking.com"); defina um rótulo para substituí-lo.',
							'Os links aparecem como pílulas clicáveis na parada, na visualização da viagem, e são listados por completo — rótulo e URL — no roteiro impresso/PDF. Eles acompanham a viagem, então quem você compartilhá-la também os vê; adicione apenas links que você não se importe que essas pessoas abram.'
						]
					},
					{
						id: 'delete-account',
						title: 'Excluir minha conta',
						body: [
							'Também na página de Conta — isso é permanente e não pode ser desfeito. As viagens que você possui são excluídas, inclusive para todos com quem foram compartilhadas; as viagens compartilhadas com você são apenas removidas do seu acesso, não excluídas. Você precisará digitar uma confirmação antes que isso aconteça.'
						]
					},
					{
						id: 'language-theme',
						title: 'Trocar idioma ou tema',
						body: [
							'O seletor EN | PT muda o idioma do próprio aplicativo (o conteúdo de uma viagem pode estar em idiomas diferentes, de forma independente). O controle de tema alterna entre claro, escuro e sistema. Ambos ficam na barra lateral no computador e na bandeja "Mais" no celular, e são lembrados para a próxima vez.'
						]
					},
					{
						id: 'mcp',
						title: 'Conectar um assistente de IA',
						body: [
							'Avançado/opcional: o Zarparia tem um conector MCP que permite a um assistente de IA (por exemplo, o Claude) ler e editar suas viagens em seu nome, depois que você aprova a conexão em uma tela padrão de OAuth. Os tokens de acesso são armazenados com hash, e uma conta pendente não consegue usar isso mesmo com uma conexão válida.',
							'As viagens que o assistente cria já vêm completas — links de mapas, faixa de previsão do tempo, pontos para fotos, custos por parada e links de reserva — e não um esqueleto vazio. Um detalhe importante: o conector age como a conta com que você o aprovou, então entre no Zarparia com essa mesma conta para ver essas viagens na sua lista.'
						]
					},
					{
						id: 'send-feedback',
						title: 'Enviar feedback',
						body: [
							'Use o botão de feedback — um ícone de balão de fala na barra lateral (computador) ou na bandeja "Mais" (celular) — para enviar um relato de erro, uma ideia, ou qualquer outra coisa. Seus envios ficam listados na página de Feedback (/feedback); excluir sua conta também exclui esses envios junto com o restante dos seus dados.'
						]
					}
				]
			},
			{
				id: 'glossary',
				heading: 'Glossário',
				entries: [
					{
						id: 'glossary-trip',
						title: 'Viagem',
						body: ['Um roteiro único — uma ou mais paradas, cada uma com seus próprios dias e programação.']
					},
					{
						id: 'glossary-itinerary-day',
						title: 'Dia do roteiro',
						body: [
							'Um dia dentro da programação de uma viagem: uma data, um título e uma nota opcionais, e uma lista de blocos com horário (lugares, atividades, deslocamentos).'
						]
					},
					{
						id: 'glossary-share-link',
						title: 'Link de compartilhamento',
						body: [
							'Uma única URL que dá acesso a uma viagem a qualquer pessoa que a tenha, sem identificar pessoas individualmente. Pode ser desativada, ou alternada entre acesso de visualização e edição, a qualquer momento pelo dono da viagem.'
						]
					},
					{
						id: 'glossary-viewer-editor',
						title: 'Visualizador / editor',
						body: [
							'Os dois papéis com que uma viagem pode ser compartilhada: um visualizador pode ler a viagem mas não alterá-la; um editor também pode adicionar, editar e reordenar o conteúdo. Só o dono pode excluir uma viagem ou mudar com quem ela é compartilhada.'
						]
					},
					{
						id: 'glossary-pending-approval',
						title: 'Aprovação pendente',
						body: [
							'Uma conta já conectada que ainda não foi aprovada pelo operador. Ela não consegue ler nem criar dados de viagem, foto ou feedback até ser aprovada.'
						]
					},
					{
						id: 'glossary-demo-mode',
						title: 'Modo demonstração',
						body: [
							'A viagem de exemplo pública em /demo — totalmente interativa, não exige conta, e nunca salva nada nem toca em dados reais.'
						]
					}
				]
			}
		]
	}
};
