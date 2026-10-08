const LANGUAGES = {
  en: 'English',
  fr: 'French',
  rw: 'Kinyarwanda',
  sw: 'Kiswahili',
};

const ROLES = {
  en: {
    TEACHER: 'Teacher',
    SCHOOL_MANAGER: 'School Manager',
    SCHOOL_ADMIN: 'School Admin',
    SECRETARY: 'Secretary',
    HEAD_OF_STUDIES: 'Head of Studies',
    HEAD_OF_DISCIPLINE: 'Head of Discipline',
    ACCOUNTANT: 'Accountant',
    ACTIVITIES_MANAGER: 'Activities Manager',
    LIBRARIAN: 'Librarian',
    default: 'staff member',
  },
  fr: {
    TEACHER: 'enseignant',
    SCHOOL_MANAGER: 'directeur de l’école',
    SCHOOL_ADMIN: 'administrateur',
    SECRETARY: 'secrétaire',
    HEAD_OF_STUDIES: 'préfet des études',
    HEAD_OF_DISCIPLINE: 'préfet de discipline',
    ACCOUNTANT: 'comptable',
    ACTIVITIES_MANAGER: 'responsable des activités',
    LIBRARIAN: 'bibliothécaire',
    default: 'membre du personnel',
  },
  rw: {
    TEACHER: 'umwarimu',
    SCHOOL_MANAGER: 'umuyobozi w’ishuri',
    SCHOOL_ADMIN: 'umuyobozi mushinzwe ubuyobozi',
    SECRETARY: 'umunyamabanga',
    HEAD_OF_STUDIES: 'umuyobozi w’amasomo',
    HEAD_OF_DISCIPLINE: 'umuyobozi w’imyitwarire',
    ACCOUNTANT: 'umucungamari',
    ACTIVITIES_MANAGER: 'umuyobozi w’ibikorwa',
    LIBRARIAN: 'umukozi w’isomero',
    default: 'umukozi',
  },
  sw: {
    TEACHER: 'mwalimu',
    SCHOOL_MANAGER: 'meneja wa shule',
    SCHOOL_ADMIN: 'msimamizi wa shule',
    SECRETARY: 'katibu',
    HEAD_OF_STUDIES: 'mkuu wa masomo',
    HEAD_OF_DISCIPLINE: 'mkuu wa nidhamu',
    ACCOUNTANT: 'muhasibu',
    ACTIVITIES_MANAGER: 'mkuu wa shughuli',
    LIBRARIAN: 'mkutubi',
    default: 'mfanyakazi',
  },
};

const FALLBACK = {
  en: {
    explain: (role, task) => `As a ${role}, here is how to complete “${task}”. Follow each step in order. The link after the steps opens the page where you do the work.`,
    open: (role) => `As a ${role}, I can guide you through the portal tasks for your role. Ask about one task, such as attendance, marks, homework, or fees, and I will explain it step by step before the link.`,
  },
  fr: {
    explain: (role, task) => `Dans votre rôle (${role}), voici comment réaliser « ${task} ». Suivez chaque étape dans l’ordre. Le lien après les étapes ouvre la page où vous faites le travail.`,
    open: (role) => `Dans votre rôle (${role}), je peux vous guider dans les tâches du portail. Posez une question sur une tâche, comme les présences, les notes, les devoirs ou les frais, et j’expliquerai les étapes avant le lien.`,
  },
  rw: {
    explain: (role, task) => `Mu ruhare rwawe (${role}), uko ukora « ${task} ». Kurikiza buri ntambwe uko zikurikirana. Umurongo unyuma y’intambwe ufungura page ukorera.`,
    open: (role) => `Mu ruhare rwawe (${role}), nshobora kukuyobora mu mirimo y’uru rubuga. Baza ku gikorwa kimwe, nk’ukwandika abaje, amanota, imirimo, cyangwa amafaranga, kandi nzagusobanurira intambwe mbere y’umurongo.`,
  },
  sw: {
    explain: (role, task) => `Katika wajibu wako wa ${role}, hivi ndivyo unafanya « ${task} ». Fuata kila hatua kwa mpangilio. Kiungo baada ya hatua kinafungua ukurasa wa kufanya kazi.`,
    open: (role) => `Katika wajibu wako wa ${role}, naweza kukuongoza kwenye kazi za portal. Uliza kuhusu kazi moja, kama mahudhurio, alama, kazi za nyumbani, au ada, nami nitaeleza hatua kabla ya kiungo.`,
  },
};

/** Link names and step-by-step help for French, Kinyarwanda, and Kiswahili. English stays on each action. */
const COPY = {
  fr: {
    attendance: ['Marquer les présences', 'Ouvrez Présences. Choisissez la date et votre classe, indiquez pour chaque élève présent, absent, en retard ou excusé, puis enregistrez.'],
    marks: ['Saisir les notes', 'Ouvrez Saisir les notes. Choisissez la classe, le cours et l’évaluation, écrivez la note de chaque élève, puis enregistrez.'],
    homework: ['Donner un devoir', 'Ouvrez Devoirs. Créez le travail pour votre classe, ajoutez les consignes, puis enregistrez pour que les élèves le voient.'],
    classes: ['Classes', 'Ouvrez Classes pour voir les niveaux et les sections, puis ouvrez une classe pour voir ses élèves.'],
    students: ['Élèves', 'Ouvrez Élèves pour trouver un apprenant, ouvrir son dossier et voir sa classe.'],
    'register-student': ['Inscrire un élève', 'Ouvrez Inscrire un élève, remplissez ses informations et sa classe, puis enregistrez l’inscription.'],
    courses: ['Cours', 'Ouvrez Cours pour voir les matières que vous enseignez et la classe de chaque cours.'],
    timetable: ['Emploi du temps', 'Ouvrez Emploi du temps pour voir la classe et la matière de chaque jour.'],
    'live-class': ['Lancer un cours en direct', 'Ouvrez Cours en direct. Créez la séance pour votre classe, ajoutez le lien de la réunion, puis démarrez au début du cours.'],
    messages: ['Envoyer un message', 'Ouvrez Messages. Choisissez les destinataires, écrivez le message, puis envoyez.'],
    elearning: ['E-Apprentissage', 'Ouvrez E-Apprentissage pour ajouter ou ouvrir un cours, puis ajoutez la leçon que les élèves doivent étudier.'],
    elibrary: ['E-Bibliothèque', 'Ouvrez E-Bibliothèque pour trouver un livre numérique et l’ouvrir.'],
    activities: ['Activités', 'Ouvrez Activités. Ajoutez l’activité, inscrivez les élèves et désignez l’encadrant.'],
    transport: ['Transport', 'Ouvrez Transport pour voir les lignes de bus et les élèves de chaque ligne.'],
    fees: ['Frais scolaires', 'Ouvrez Frais. Trouvez l’élève, puis enregistrez le paiement ou mettez à jour le statut.'],
    finance: ['Bureau finance', 'Ouvrez Bureau finance pour voir les encaissements. Utilisez Importer Excel quand le fichier des frais est prêt.'],
    tuition: ['Registre des frais', 'Ouvrez Registre des frais pour voir ce qui a été facturé à chaque élève et ce qui reste impayé.'],
    reports: ['Rapports', 'Ouvrez Rapports et choisissez le rapport du campus et de l’année scolaire affichés.'],
    teachers: ['Enseignants', 'Ouvrez Enseignants pour ajouter un membre du personnel ou ouvrir un dossier existant.'],
    users: ['Comptes utilisateurs', 'Ouvrez Utilisateurs pour créer un accès, choisir le rôle ou réinitialiser l’accès.'],
    'academic-year': ['Année scolaire', 'Ouvrez Année scolaire pour ouvrir ou clôturer l’année en cours du campus.'],
    school: ['Profil de l’école', 'Ouvrez Profil de l’école pour mettre à jour les contacts du campus et les informations bancaires.'],
    website: ['Site web', 'Ouvrez le site web pour modifier ce que les familles voient sur le site public.'],
    library: ['Bibliothèque', 'Ouvrez Bibliothèque pour ajouter un livre ou enregistrer un emprunt et un retour.'],
    'id-cards': ['Cartes d’identité', 'Ouvrez Cartes d’identité, choisissez les élèves, puis imprimez leurs cartes.'],
    bulletin: ['Bulletin', 'Ouvrez Bulletin, choisissez la classe et la période, puis vérifiez ou imprimez les bulletins.'],
    midterms: ['Périodes', 'Ouvrez Périodes pour voir les périodes d’évaluation utilisées pour les notes.'],
  },
  rw: {
    attendance: ['Kwandika abaje', 'Fungura Kuzaza. Hitamo itariki na klasse yawe, shyiraho buri munyeshuri yaje, utaje, yatindiye cyangwa yemerewe, hanyuma ubike.'],
    marks: ['Kwinjiza amanota', 'Fungura Kwinjiza amanota. Hitamo klasse, isomo n’ikizamini, andika amanota ya buri munyeshuri, hanyuma ubike.'],
    homework: ['Guha imirimo', 'Fungura Imirimo. Kora umukoro wa klasse yawe, andika amabwiriza, hanyuma ubike kugira ngo abanyeshuri abubone.'],
    classes: ['Amasomo', 'Fungura Amasomo urebe ibyiciro n’amatsinda, hanyuma ufungure klasse urebe abanyeshuri bayo.'],
    students: ['Abanyeshuri', 'Fungura Abanyeshuri ushake umunyeshuri, ufungure dosiye ye, urebe klasse ye.'],
    'register-student': ['Kwandikisha umunyeshuri', 'Fungura Kwandikisha umunyeshuri, uzuza amakuru ye na klasse, hanyuma ubike iyandikwa.'],
    courses: ['Amasomo y’inyigisho', 'Fungura Amasomo y’inyigisho urebe amasomo wigisha na klasse ya buri somo.'],
    timetable: ['Gahunda y’amasomo', 'Fungura Gahunda y’amasomo urebe klasse n’isomo rya buri munsi.'],
    'live-class': ['Gutangira isomo kuri interineti', 'Fungura Amasomo kuri interineti. Kora isomo rya klasse yawe, ongeraho umurongo w’inama, hanyuma uritangire igihe isomo ritangiye.'],
    messages: ['Kohereza ubutumwa', 'Fungura Ubutumwa. Hitamo ababubona, andika ubutumwa, hanyuma ubwohereze.'],
    elearning: ['Kwiga kuri interineti', 'Fungura Kwiga kuri interineti wongere cyangwa ufungure isomo, hanyuma wongereho icyigwa abanyeshuri bagomba kwiga.'],
    elibrary: ['Isomero rya elegitoronike', 'Fungura Isomero rya elegitoronike ushake igitabo cya elegitoronike ukigafungura.'],
    activities: ['Ibikorwa', 'Fungura Ibikorwa. Ongeraho igikorwa, wandikishe abanyeshuri, ushyireho umutoza.'],
    transport: ['Ubwikorezi', 'Fungura Ubwikorezi urebe inzira za bisi n’abanyeshuri bo kuri buri nzira.'],
    fees: ['Amafaranga y’ishuri', 'Fungura Amafaranga. Shaka umunyeshuri, hanyuma wandike ubwishyu cyangwa uhindure uko byifashe.'],
    finance: ['Ibiro by’imari', 'Fungura Ibiro by’imari urebe amafaranga yakiriwe. Koresha Kwinjiza Excel igihe dosiye y’amafaranga yiteguye.'],
    tuition: ['Icyegeranyo cy’amafaranga', 'Fungura Icyegeranyo cy’amafaranga urebe ibyishyuwe na buri munyeshuri n’ibitarishyurwa.'],
    reports: ['Raporo', 'Fungura Raporo uhitemo raporo y’ishuri n’umwaka w’amashuri uri kureba.'],
    teachers: ['Abarimu', 'Fungura Abarimu wongere umukozi cyangwa ufungure dosiye isanzwe.'],
    users: ['Konti z’abakoresha', 'Fungura Abakoresha uhe umuntu kwinjira, uhitemo uruhare, cyangwa usubize uburenganzira.'],
    'academic-year': ['Umwaka w’amashuri', 'Fungura Umwaka w’amashuri utangire cyangwa ufunge umwaka ishuri rikoresha.'],
    school: ['Umwirondoro w’ishuri', 'Fungura Umwirondoro w’ishuri uhindure aho babariza n’amakuru ya banki.'],
    website: ['Urubuga', 'Fungura Urubuga uhindure ibyo imiryango ibona ku rubuga rusanzwe.'],
    library: ['Isomero', 'Fungura Isomero wongere igitabo cyangwa wandike ingurano n’isubizwa.'],
    'id-cards': ['Indangamuntu', 'Fungura Indangamuntu, hitamo abanyeshuri, hanyuma ucape amakarita yabo.'],
    bulletin: ['Buletine', 'Fungura Buletine, hitamo klasse n’igihe, hanyuma usuzume cyangwa ucape buletine.'],
    midterms: ['Ibihe by’ibizamini', 'Fungura Ibihe by’ibizamini urebe ibihe bikoreshwa mu kwinjiza amanota.'],
  },
  sw: {
    attendance: ['Andika mahudhurio', 'Fungua Mahudhurio. Chagua tarehe na darasa lako, weka kila mwanafunzi aliyepo, aliyekosa, aliyechelewa, au mwenye ruhusa, kisha hifadhi.'],
    marks: ['Ingiza alama', 'Fungua Ingiza alama. Chagua darasa, somo, na tathmini, andika alama ya kila mwanafunzi, kisha hifadhi.'],
    homework: ['Toa kazi za nyumbani', 'Fungua Kazi za nyumbani. Tengeneza kazi ya darasa lako, weka maelekezo, kisha hifadhi ili wanafunzi waione.'],
    classes: ['Madarasa', 'Fungua Madarasa uone ngazi na sehemu, kisha fungua darasa uone wanafunzi wake.'],
    students: ['Wanafunzi', 'Fungua Wanafunzi umtafute mwanafunzi, ufungue wasifu wake, na uone darasa lake.'],
    'register-student': ['Sajili mwanafunzi', 'Fungua Sajili mwanafunzi, jaza taarifa zake na darasa, kisha hifadhi usajili.'],
    courses: ['Masomo', 'Fungua Masomo uone masomo unayofundisha na darasa la kila somo.'],
    timetable: ['Ratiba', 'Fungua Ratiba uone darasa na somo la kila siku.'],
    'live-class': ['Anza darasa la moja kwa moja', 'Fungua Madarasa ya moja kwa moja. Tengeneza kipindi cha darasa lako, weka kiungo cha mkutano, kisha anza somo linapoanza.'],
    messages: ['Tuma ujumbe', 'Fungua Ujumbe. Chagua wanaopokea, andika ujumbe, kisha tuma.'],
    elearning: ['Kujifunza kwa mtandao', 'Fungua Kujifunza kwa mtandao uongeze au ufungue kozi, kisha ongeza somo wanafunzi wanapaswa kujifunza.'],
    elibrary: ['Maktaba ya kidijitali', 'Fungua Maktaba ya kidijitali utafute kitabu cha kidijitali ukifungue.'],
    activities: ['Shughuli', 'Fungua Shughuli. Ongeza shughuli, sajili wanafunzi, na mpe kocha.'],
    transport: ['Usafiri', 'Fungua Usafiri uone njia za basi na wanafunzi wa kila njia.'],
    fees: ['Ada za shule', 'Fungua Ada. Mtafute mwanafunzi, kisha andika malipo au sasisha hali ya ada.'],
    finance: ['Dawati la fedha', 'Fungua Dawati la fedha uone makusanyo. Tumia Ingiza Excel faili ya ada ikiwa tayari.'],
    tuition: ['Daftari la ada', 'Fungua Daftari la ada uone kilichotozwa kila mwanafunzi na kilichobaki kulipwa.'],
    reports: ['Ripoti', 'Fungua Ripoti uchague ripoti ya kituo na mwaka wa masomo unaoangalia.'],
    teachers: ['Walimu', 'Fungua Walimu uongeze mfanyakazi au ufungue wasifu uliopo.'],
    users: ['Akaunti za watumiaji', 'Fungua Watumiaji umpe mtu akaunti, uchague wajibu, au usasishe ufikiaji.'],
    'academic-year': ['Mwaka wa masomo', 'Fungua Mwaka wa masomo uanze au ufunge mwaka kituo kinatumia.'],
    school: ['Wasifu wa shule', 'Fungua Wasifu wa shule usasishe mawasiliano ya kituo na taarifa za benki.'],
    website: ['Tovuti', 'Fungua Tovuti ubadilishe wanachokiona familia kwenye tovuti ya umma.'],
    library: ['Maktaba', 'Fungua Maktaba uongeze kitabu au uandike mkopo na marejesho.'],
    'id-cards': ['Vitambulisho', 'Fungua Vitambulisho, chagua wanafunzi, kisha chapisha kadi zao.'],
    bulletin: ['Ripoti ya matokeo', 'Fungua Ripoti ya matokeo, chagua darasa na kipindi, kisha kagua au chapisha ripoti.'],
    midterms: ['Vipindi vya tathmini', 'Fungua Vipindi vya tathmini uone vipindi vinavyotumika kuingiza alama.'],
  },
};

export function normalizeGuideLanguage(code) {
  const key = String(code || 'en').trim().toLowerCase();
  return LANGUAGES[key] ? key : 'en';
}

export function guideLanguageName(code) {
  return LANGUAGES[normalizeGuideLanguage(code)];
}

export function roleLabel(role, language) {
  const lang = normalizeGuideLanguage(language);
  const names = ROLES[lang] || ROLES.en;
  return names[role] || names.default;
}

export function guideCopy(action, language) {
  const lang = normalizeGuideLanguage(language);
  const pair = COPY[lang]?.[action.id];
  if (!pair) return { label: action.label, steps: action.steps };
  return { label: pair[0], steps: pair[1] };
}

export function splitGuideSteps(text) {
  const parts = String(text || '')
    .replace(/\b(?:then|puis|hanyuma|kisha)\b/gi, '.')
    .split(/\s*(?:\n+|(?<=[.!?;])\s+)/)
    .map((part) => {
      const clean = part.replace(/^[\d.)\s-]+/, '').replace(/[.,;]+$/, '').trim();
      if (clean.length < 2) return '';
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    })
    .filter(Boolean);
  return parts;
}

export function guideReply(role, language, action) {
  const lang = normalizeGuideLanguage(language);
  const label = roleLabel(role, lang);
  const text = FALLBACK[lang] || FALLBACK.en;
  if (!action) return { explanation: text.open(label), steps: [] };
  const copy = guideCopy(action, lang);
  return {
    explanation: text.explain(label, copy.label),
    steps: splitGuideSteps(copy.steps),
  };
}

export function guideSentence(kind, role, language, steps) {
  const lang = normalizeGuideLanguage(language);
  const label = roleLabel(role, lang);
  const text = FALLBACK[lang] || FALLBACK.en;
  if (kind === 'open') return text.open(label);
  return text.explain(label, steps);
}
