import {normalizeReferralCode,referralLanguage,invitationDestinations,captureReferral} from "./referrals.mjs?v=20261103-1";

const copy = {
  en: ["A LITTLE INVITATION. A NEW CONNECTION.", "Your kind of people could be one hello away.", "Join Kindred and meet adults who share your interests, your friendship style and your pace.", "A friend has invited you to Kindred.", "Join on the website", "Get it on Google Play", "Already installed? Open Kindred", "For adults aged 18 and over. You choose who to connect with.", "Join", "Create your own account.", "Be yourself", "Share your interests and friendship style.", "Say hello", "Find people who fit your rhythm.", "Privacy", "Safety", "Contact", "Language"],
  ru: ["ОДНО ПРИГЛАШЕНИЕ. НОВОЕ ЗНАКОМСТВО.", "Твои люди могут быть ближе, чем кажется.", "Присоединяйся к Kindred и знакомься с людьми, которым близки твои интересы, стиль дружбы и ритм общения.", "Друг приглашает тебя в Kindred.", "Зарегистрироваться на сайте", "Скачать в Google Play", "Уже установлено? Открыть Kindred", "Для взрослых от 18 лет. Ты выбираешь, с кем общаться.", "Присоединяйся", "Создай свой аккаунт.", "Будь собой", "Расскажи о своих интересах и стиле дружбы.", "Скажи «привет»", "Найди тех, кто подходит твоему ритму.", "Конфиденциальность", "Безопасность", "Контакты", "Язык"],
  uk: ["ОДНЕ ЗАПРОШЕННЯ. НОВЕ ЗНАЙОМСТВО.", "Твої люди можуть бути ближче, ніж здається.", "Приєднуйся до Kindred і знайомся з людьми, яким близькі твої інтереси, стиль дружби та ритм спілкування.", "Друг запрошує тебе до Kindred.", "Зареєструватися на сайті", "Завантажити в Google Play", "Вже встановлено? Відкрити Kindred", "Для дорослих від 18 років. Ти обираєш, з ким спілкуватися.", "Приєднуйся", "Створи власний акаунт.", "Будь собою", "Розкажи про свої інтереси та стиль дружби.", "Скажи «привіт»", "Знайди тих, хто підходить твоєму ритму.", "Конфіденційність", "Безпека", "Контакти", "Мова"],
  de: ["EINE KLEINE EINLADUNG. EINE NEUE VERBINDUNG.", "Deine Menschen sind vielleicht nur ein Hallo entfernt.", "Komm zu Kindred und lerne Erwachsene kennen, die deine Interessen, deinen Freundschaftsstil und deinen Rhythmus teilen.", "Jemand lädt dich zu Kindred ein.", "Auf der Website registrieren", "Bei Google Play herunterladen", "Schon installiert? Kindred öffnen", "Für Erwachsene ab 18 Jahren. Du entscheidest, mit wem du dich verbindest.", "Mitmachen", "Erstelle dein eigenes Konto.", "Du selbst sein", "Teile deine Interessen und deinen Freundschaftsstil.", "Hallo sagen", "Finde Menschen, die zu deinem Rhythmus passen.", "Datenschutz", "Sicherheit", "Kontakt", "Sprache"],
  ar: ["دعوة صغيرة. معرفة جديدة.", "قد تفصلك كلمة مرحبًا واحدة عن أشخاص يشبهونك.", "انضم إلى Kindred وتعرّف على بالغين يشاركونك اهتماماتك وأسلوب صداقتك وإيقاعك.", "يدعوك صديق إلى Kindred.", "التسجيل على الموقع", "التنزيل من Google Play", "مثبّت بالفعل؟ افتح Kindred", "للبالغين من عمر 18 عامًا. أنت تختار من تتواصل معه.", "انضم", "أنشئ حسابك الخاص.", "كن على طبيعتك", "شارك اهتماماتك وأسلوب صداقتك.", "قل مرحبًا", "اعثر على أشخاص يناسبون إيقاعك.", "الخصوصية", "السلامة", "اتصل بنا", "اللغة"],
  es: ["UNA PEQUEÑA INVITACIÓN. UNA NUEVA CONEXIÓN.", "Quizá solo un hola te separe de tu gente.", "Únete a Kindred y conoce a adultos que comparten tus intereses, tu estilo de amistad y tu ritmo.", "Alguien te invita a Kindred.", "Registrarse en la web", "Descargar en Google Play", "¿Ya lo tienes? Abrir Kindred", "Para mayores de 18 años. Tú eliges con quién conectar.", "Únete", "Crea tu propia cuenta.", "Sé tú", "Comparte tus intereses y tu estilo de amistad.", "Di hola", "Encuentra personas que encajen con tu ritmo.", "Privacidad", "Seguridad", "Contacto", "Idioma"],
  fr: ["UNE PETITE INVITATION. UNE NOUVELLE RENCONTRE.", "Un simple bonjour peut te rapprocher des tiens.", "Rejoins Kindred et rencontre des adultes qui partagent tes centres d’intérêt, ton style d’amitié et ton rythme.", "Quelqu’un t’invite sur Kindred.", "S’inscrire sur le site", "Télécharger sur Google Play", "Déjà installé ? Ouvrir Kindred", "Pour les adultes de 18 ans et plus. Tu choisis avec qui échanger.", "Rejoins-nous", "Crée ton propre compte.", "Sois toi-même", "Partage tes centres d’intérêt et ton style d’amitié.", "Dis bonjour", "Trouve des personnes qui partagent ton rythme.", "Confidentialité", "Sécurité", "Contact", "Langue"],
  tr: ["KÜÇÜK BİR DAVET. YENİ BİR BAĞ.", "Sana yakın insanlar belki bir merhaba uzağında.", "Kindred’a katıl; ilgi alanlarını, arkadaşlık tarzını ve ritmini paylaşan yetişkinlerle tanış.", "Bir arkadaşın seni Kindred’a davet ediyor.", "Web sitesinde kayıt ol", "Google Play’den indir", "Zaten yüklü mü? Kindred’ı aç", "18 yaş ve üzeri yetişkinler için. Kiminle iletişim kuracağını sen seçersin.", "Katıl", "Kendi hesabını oluştur.", "Kendin ol", "İlgi alanlarını ve arkadaşlık tarzını paylaş.", "Merhaba de", "Ritmine uygun insanları bul.", "Gizlilik", "Güvenlik", "İletişim", "Dil"]
};

const ids = ["inviteEyebrow", "inviteHeading", "inviteDescription", "invitedNote", "joinKindred", "downloadKindred", "openKindred", "adultNotice", "stepOneTitle", "stepOneText", "stepTwoTitle", "stepTwoText", "stepThreeTitle", "stepThreeText", "privacyLink", "safetyLink", "contactLink", "languageLabel"];
const params = new URLSearchParams(location.search);
const incomingCode = params.getAll("ref").length === 1 ? normalizeReferralCode(params.get("ref")) : "";
let storage; try { storage = window.sessionStorage; } catch {}
const invitation = captureReferral(location.search, storage);
const code = invitation?.code || incomingCode;
const initialLanguage = params.get("lang") || navigator.language?.split("-")[0] || "en";

function render(language) {
  const lang = referralLanguage(language), text = copy[lang], links = invitationDestinations(code, lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.title = `${text[3]} · Kindred`;
  ids.forEach((id, index) => document.getElementById(id).textContent = text[index]);
  document.getElementById("inviteLanguage").value = lang;
  document.getElementById("invitedNote").hidden = !code;
  document.getElementById("joinKindred").href = links.web;
  document.getElementById("downloadKindred").href = links.play;
  const open = document.getElementById("openKindred");
  open.hidden = !/Android/i.test(navigator.userAgent);
  open.href = links.android;
}

document.getElementById("inviteLanguage").addEventListener("change", event => render(event.target.value));
render(initialLanguage);
