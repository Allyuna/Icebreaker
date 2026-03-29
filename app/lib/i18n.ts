export type Lang = "fr" | "en";

const fr = {
  // ─── Language toggle ──────────────────────────────────────────────────────
  lang_toggle: "🇬🇧 EN",

  // ─── Landing ──────────────────────────────────────────────────────────────
  landing_title: "Trouve ta moitié",
  landing_sub: "Le jeu de brise-glace — retrouve ta moitié !",
  landing_placeholder: "Code de la salle (ex: AB3KP)",
  landing_join: "Rejoindre la partie",
  landing_admin: "Accès maître du jeu",
  landing_err_code: "Entre le code de la salle.",

  // ─── Join ─────────────────────────────────────────────────────────────────
  join_title: "Rejoins le jeu",
  join_sub: "Entre ton prénom pour commencer.",
  join_waiting_banner:
    "⏳ La partie n'a pas encore commencé. Tu peux entrer ton prénom — tu seras inscrit automatiquement au lancement !",
  join_placeholder: "Ton prénom",
  join_btn_loading: "Inscription…",
  join_btn_pending: "⏳ En attente du lancement…",
  join_btn_preinscribe: "Me pré-inscrire",
  join_btn_start: "Commencer",
  join_cancel: "Annuler",
  join_err_notfound: "Partie introuvable. Vérifie le code de salle.",
  join_err_notplaying: "La partie n'a pas encore commencé.",
  join_err_noslots: "Plus de places disponibles. Contacte le maître du jeu.",
  join_err_generic: "Une erreur s'est produite. Réessaie.",
  join_err_network: "Impossible de contacter le serveur. Vérifie ta connexion.",
  join_err_noroom: "Code de salle manquant.",
  join_err_finished: "Cette partie est terminée.",

  // ─── Mission ──────────────────────────────────────────────────────────────
  mission_loading: "Chargement…",
  mission_notfound: "Code introuvable.",
  mission_restart: "Recommencer",
  mission_hello: "Bonjour",
  mission_yourcode: "Ton code",
  mission_qr_hint:
    "Montre ce QR code aux autres joueurs ou donne-leur ton code à 4 chiffres.",
  mission_yourhalf: "Ta moitié",
  mission_find_hint: "Trouve la personne dont la moitié complète la tienne !",
  mission_matched: "🎉 Tu as déjà trouvé ta moitié !",
  mission_waiting_partner: "⏳ En attente d'un partenaire…",
  mission_waiting_partner_sub:
    "Pas encore assez de joueurs pour former ta paire. Cette page se mettra à jour automatiquement dès que quelqu'un complète ta paire.",
  mission_find_btn: "J'ai trouvé ma moitié →",

  // ─── Find ─────────────────────────────────────────────────────────────────
  find_title: "Valider un match",
  find_sub: "Scanne le QR code ou entre le code à 4 chiffres.",
  find_scan: "📷 Scanner un QR code",
  find_stop: "Annuler le scan",
  find_or: "ou",
  find_confirm: "Confirmer →",
  find_back: "← Retour à ma mission",
  find_err_digits: "Le code doit être composé de 4 chiffres.",
  find_err_self: "Tu ne peux pas te matcher avec toi-même !",
  find_err_invalid_qr: "QR code invalide — ce n'est pas un code joueur.",
  find_err_camera: "Scan annulé ou caméra inaccessible.",

  // ─── Confirm ──────────────────────────────────────────────────────────────
  confirm_title: "Est-ce votre moitié ?",
  confirm_you: "Toi",
  confirm_them: "Eux",
  confirm_question: "Ces deux moitiés vont-elles ensemble ?",
  confirm_yes: "✓ Oui !",
  confirm_no: "✗ Non",
  confirm_wrong: "❌ Ce n'est pas la bonne moitié ! Continue à chercher.",
  confirm_back: "← Retour à ma mission",
  confirm_notfound: "Joueur introuvable.",
  confirm_retry: "← Réessayer",
  confirm_loading: "Chargement…",

  // ─── Done ─────────────────────────────────────────────────────────────────
  done_bravo: "Bravo !",
  done_found_prefix: "Tu as trouvé ta moitié : ",
  done_found_suffix: " !",
  done_pair: "Vous êtes une paire parfaite !",
  done_review: "Revoir ma mission",
  done_replay: "Nouvelle partie",
};

const en: typeof fr = {
  lang_toggle: "🇫🇷 FR",

  landing_title: "Find your match",
  landing_sub: "The icebreaker game — find your other half!",
  landing_placeholder: "Room code (e.g. AB3KP)",
  landing_join: "Join the game",
  landing_admin: "Game master access",
  landing_err_code: "Enter the room code.",

  join_title: "Join the game",
  join_sub: "Enter your name to start.",
  join_waiting_banner:
    "⏳ The game hasn't started yet. You can enter your name — you'll be registered automatically when it launches!",
  join_placeholder: "Your name",
  join_btn_loading: "Registering…",
  join_btn_pending: "⏳ Waiting for launch…",
  join_btn_preinscribe: "Pre-register",
  join_btn_start: "Start",
  join_cancel: "Cancel",
  join_err_notfound: "Room not found. Check the room code.",
  join_err_notplaying: "The game hasn't started yet.",
  join_err_noslots: "No slots available. Contact the game master.",
  join_err_generic: "Something went wrong. Try again.",
  join_err_network: "Can't reach the server. Check your connection.",
  join_err_noroom: "Room code missing.",
  join_err_finished: "This game is over.",

  mission_loading: "Loading…",
  mission_notfound: "Code not found.",
  mission_restart: "Restart",
  mission_hello: "Hello",
  mission_yourcode: "Your code",
  mission_qr_hint:
    "Show this QR code to other players or give them your 4-digit code.",
  mission_yourhalf: "Your half",
  mission_find_hint: "Find the person whose half matches yours!",
  mission_matched: "🎉 You already found your match!",
  mission_waiting_partner: "⏳ Waiting for a partner…",
  mission_waiting_partner_sub:
    "Not enough players yet to form your pair. This page will update automatically when someone completes your pair.",
  mission_find_btn: "I found my match →",

  find_title: "Validate a match",
  find_sub: "Scan the QR code or enter the 4-digit code.",
  find_scan: "📷 Scan a QR code",
  find_stop: "Cancel scan",
  find_or: "or",
  find_confirm: "Confirm →",
  find_back: "← Back to my mission",
  find_err_digits: "The code must be 4 digits.",
  find_err_self: "You can't match with yourself!",
  find_err_invalid_qr: "Invalid QR code — not a player code.",
  find_err_camera: "Scan cancelled or camera unavailable.",

  confirm_title: "Is this your match?",
  confirm_you: "You",
  confirm_them: "Them",
  confirm_question: "Do these two halves go together?",
  confirm_yes: "✓ Yes!",
  confirm_no: "✗ No",
  confirm_wrong: "❌ That's not the right match! Keep looking.",
  confirm_back: "← Back to my mission",
  confirm_notfound: "Player not found.",
  confirm_retry: "← Try again",
  confirm_loading: "Loading…",

  done_bravo: "Congrats!",
  done_found_prefix: "You found your match: ",
  done_found_suffix: "!",
  done_pair: "You're a perfect pair!",
  done_review: "View my mission",
  done_replay: "Play again",
};

export const translations: Record<Lang, typeof fr> = { fr, en };
export type Translations = typeof fr;
