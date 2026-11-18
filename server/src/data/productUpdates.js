/** Product updates shown on the Latest updates page.
 * School managers and school admins see every item.
 * Other roles see an item only when their role is listed.
 * commit is the git revision when the work was committed.
 */
export const PRODUCT_UPDATES = [
  {
    id: 'staff-dossier',
    date: '2026-11-18',
    commit: '8f4462b',
    roles: ['SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'TEACHER', 'ACCOUNTANT', 'LIBRARIAN', 'ACTIVITIES_MANAGER', 'INVENTORY_MANAGER'],
    en: {
      title: 'Staff and teacher profile',
      summary: 'Editing a user, registering staff or a teacher, and a staff profile now use the same dossier.',
      points: [
        'Identity and photo, bank details, contract and hire date, and qualifications and experience.',
        'System access keeps the role, the status (active, inactive, or suspended), and the password.',
        'Student enrollment keeps its own form.',
      ],
    },
    fr: {
      title: 'Profil du personnel et de l’enseignant',
      summary: 'Modifier un utilisateur, inscrire le personnel ou un enseignant, et le profil du personnel utilisent le même dossier.',
      points: [
        'Identité et photo, informations bancaires, contrat et date d’embauche, qualifications et expériences.',
        'L’accès au système garde le rôle, le statut (actif, inactif ou suspendu) et le mot de passe.',
        'L’inscription d’un élève garde son propre formulaire.',
      ],
    },
  },
  {
    id: 'portal-search',
    date: '2026-11-18',
    commit: '8f4462b',
    roles: ['SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'TEACHER', 'PARENT', 'STUDENT', 'ACCOUNTANT', 'LIBRARIAN', 'ACTIVITIES_MANAGER', 'INVENTORY_MANAGER'],
    en: {
      title: 'Search from the top bar',
      summary: 'Search opens in the center of the screen, from the top bar or with ⌘K (Ctrl+K).',
      points: [
        'Find a person, student, parent, menu, or record by name, email, or code.',
        'Results follow what your account is allowed to open.',
      ],
    },
    fr: {
      title: 'Recherche depuis la barre du haut',
      summary: 'La recherche s’ouvre au centre de l’écran, depuis la barre du haut ou avec ⌘K (Ctrl+K).',
      points: [
        'Trouvez une personne, un élève, un parent, un menu ou une fiche par nom, e-mail ou code.',
        'Les résultats suivent ce que votre compte a le droit d’ouvrir.',
      ],
    },
  },
  {
    id: 'sidebar-rail',
    date: '2026-11-18',
    commit: '8f4462b',
    roles: ['SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'TEACHER', 'PARENT', 'STUDENT', 'ACCOUNTANT', 'LIBRARIAN', 'ACTIVITIES_MANAGER', 'INVENTORY_MANAGER'],
    en: {
      title: 'Collapsible sidebar',
      summary: 'The sidebar starts collapsed to icons and opens when the pointer is over it.',
      points: [
        'Choosing a menu collapses it again so the page stays clear.',
        'You can leave it open until the next menu choice.',
      ],
    },
    fr: {
      title: 'Menu latéral repliable',
      summary: 'Le menu latéral commence replié sur les icônes et s’ouvre quand le pointeur est dessus.',
      points: [
        'Choisir un menu le replie à nouveau pour laisser la page visible.',
        'Vous pouvez le laisser ouvert jusqu’au prochain choix de menu.',
      ],
    },
  },
  {
    id: 'role-access',
    date: '2026-11-18',
    commit: '8f4462b',
    roles: ['SCHOOL_MANAGER', 'SCHOOL_ADMIN'],
    en: {
      title: 'Permissions by role',
      summary: 'Each campus can save which rights a role has. Accounts with that role inherit the saved profile.',
      points: [
        'The Access page shows the permission matrix, role profiles, and a change log.',
        'Until a profile is saved, the official rights stay in place.',
        'The school manager profile cannot be emptied.',
      ],
    },
    fr: {
      title: 'Permissions par rôle',
      summary: 'Chaque campus peut enregistrer les droits d’un rôle. Les comptes de ce rôle héritent du profil enregistré.',
      points: [
        'La page Accès montre la matrice des permissions, les profils de rôle et le journal des changements.',
        'Tant qu’un profil n’est pas enregistré, les droits officiels restent en place.',
        'Le profil du directeur ne peut pas être vidé.',
      ],
    },
  },
  {
    id: 'stock-inventory',
    date: '2026-11-18',
    commit: '8f4462b',
    roles: ['SECRETARY', 'HEAD_OF_STUDIES', 'TEACHER', 'INVENTORY_MANAGER'],
    en: {
      title: 'Stock and inventory',
      summary: 'Stock covers articles, stores, purchases, requests, transfers, and a physical count.',
      points: [
        'The inventory manager runs the stock desk. Teachers can send a material request.',
        'The secretary can view the overview and requests. The head of studies can approve a request.',
        'Stock moves when a request is served or a transfer is received, not when it is only approved.',
      ],
    },
    fr: {
      title: 'Stock et inventaire',
      summary: 'Le stock couvre les articles, les magasins, les achats, les demandes, les transferts et l’inventaire physique.',
      points: [
        'Le gestionnaire de stock tient le bureau. Les enseignants peuvent envoyer une demande de matériel.',
        'Le secrétaire peut voir la vue d’ensemble et les demandes. Le responsable des études peut approuver une demande.',
        'Le stock bouge quand une demande est servie ou un transfert reçu, pas seulement quand elle est approuvée.',
      ],
    },
  },
  {
    id: 'fees-expenses',
    date: '2026-11-18',
    commit: '8f4462b',
    roles: ['SECRETARY', 'ACCOUNTANT'],
    en: {
      title: 'Fees and expenses',
      summary: 'Finance has a monthly cash summary for the academic year.',
      points: [
        'Fees collected are filled from paid receipts in Rwandan francs for the open campus and year.',
        'Expenses are entered by hand. The profit is fees collected minus those expenses.',
        'Dollar payments stay out of this column.',
      ],
    },
    fr: {
      title: 'Frais et dépenses',
      summary: 'La finance a un résumé de caisse mensuel pour l’année scolaire.',
      points: [
        'Les frais encaissés viennent des reçus payés en francs rwandais pour le campus et l’année ouverts.',
        'Les dépenses se saisissent à la main. Le résultat est les frais encaissés moins ces dépenses.',
        'Les paiements en dollars restent hors de cette colonne.',
      ],
    },
  },
  {
    id: 'system-status',
    date: '2026-11-18',
    commit: '8f4462b',
    roles: ['SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'TEACHER', 'PARENT', 'STUDENT', 'ACCOUNTANT', 'LIBRARIAN', 'ACTIVITIES_MANAGER', 'INVENTORY_MANAGER'],
    en: {
      title: 'System status',
      summary: 'A public status page shows whether the website, portal, students, fees, library, and database are up.',
      points: [
        'The page is linked from the website footer.',
        'A day is recorded when the status is checked. Days with no check stay unmarked.',
        'Someone can subscribe an email and receive a message when a service changes state.',
      ],
    },
    fr: {
      title: 'État du système',
      summary: 'Une page publique indique si le site, le portail, les élèves, les frais, la bibliothèque et la base de données répondent.',
      points: [
        'La page est liée depuis le pied de page du site.',
        'Un jour est enregistré quand l’état est vérifié. Les jours sans vérification restent sans marque.',
        'Une personne peut inscrire un e-mail et recevoir un message quand un service change d’état.',
      ],
    },
  },
  {
    id: 'updates-page',
    date: '2026-11-18',
    commit: '464981d',
    roles: ['SCHOOL_MANAGER', 'SCHOOL_ADMIN', 'SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'TEACHER', 'PARENT', 'STUDENT', 'ACCOUNTANT', 'LIBRARIAN', 'ACTIVITIES_MANAGER', 'INVENTORY_MANAGER'],
    en: {
      title: 'Latest updates and support requests',
      summary: 'This page lists what was added and when. You can also ask for a new change or contact support.',
      points: [
        'Administrators see every update.',
        'Teachers, parents, students, and other roles see the updates that apply to them.',
        'A request emails support with your name, role, and email so they can reply.',
      ],
    },
    fr: {
      title: 'Dernières mises à jour et demandes',
      summary: 'Cette page indique ce qui a été ajouté et à quelle date. Vous pouvez aussi demander un changement ou contacter le support.',
      points: [
        'Les administrateurs voient toutes les mises à jour.',
        'Les enseignants, parents, élèves et les autres rôles voient celles qui les concernent.',
        'Une demande est envoyée au support avec votre nom, votre rôle et votre e-mail.',
      ],
    },
  },
  {
    id: 'activities-roster',
    date: '2026-11-18',
    commit: '464981d',
    roles: ['TEACHER', 'PARENT', 'SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'ACTIVITIES_MANAGER'],
    en: {
      title: 'Activities roster',
      summary: 'Activities now lists who joined, by activity and by class, with boys and girls.',
      points: [
        'Switch between per activity and per class, and filter one activity or one class.',
        'Each group shows the people, the boys, and the girls.',
        'Export the list to Excel (three sheets) or CSV.',
      ],
    },
    fr: {
      title: 'Liste des activités',
      summary: 'Les activités indiquent qui a rejoint, par activité et par classe, avec les garçons et les filles.',
      points: [
        'Affichez par activité ou par classe, puis filtrez une activité ou une classe.',
        'Chaque groupe montre les personnes, les garçons et les filles.',
        'Exportez la liste en Excel (trois feuilles) ou en CSV.',
      ],
    },
  },
  {
    id: 'campus-statistics',
    date: '2026-11-18',
    commit: '464981d',
    roles: ['SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE', 'TEACHER', 'ACCOUNTANT'],
    en: {
      title: 'Campus statistics by boys and girls',
      summary: 'Campus totals now split students, teachers, and administration into boys and girls.',
      points: [
        'The campus list and the campus dashboard show the split under each total.',
        'Set Gender on a teacher or a staff account so that person is counted.',
        'Student boys and girls come from the gender already saved on the student.',
      ],
    },
    fr: {
      title: 'Statistiques du campus par garçons et filles',
      summary: 'Les totaux du campus séparent les élèves, les enseignants et l’administration en garçons et filles.',
      points: [
        'La liste des campus et le tableau de bord affichent la répartition sous chaque total.',
        'Indiquez le sexe d’un enseignant ou d’un compte du personnel pour qu’il soit compté.',
        'Les garçons et filles élèves viennent du sexe déjà enregistré sur l’élève.',
      ],
    },
  },
  {
    id: 'attendance-desk',
    date: '2026-11-18',
    commit: '464981d',
    roles: ['TEACHER', 'PARENT', 'SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE'],
    en: {
      title: 'Attendance desk',
      summary: 'Attendance uses a status menu for each student, with columns that line up.',
      points: [
        'Choose Present, Absent, Late, or Excused from one dropdown.',
        'Filter by class or status, sort the list, and mark everyone in the search.',
        'Student ID, name, class, and status stay in four aligned columns.',
      ],
    },
    fr: {
      title: 'Présences',
      summary: 'Les présences utilisent un menu de statut par élève, avec des colonnes alignées.',
      points: [
        'Choisissez Présent, Absent, En retard ou Excusé dans un menu.',
        'Filtrez par classe ou statut, triez la liste et marquez tout le monde dans la recherche.',
        'ID élève, nom, classe et statut restent alignés sur quatre colonnes.',
      ],
    },
  },
  {
    id: 'science-quiz',
    date: '2026-11-18',
    commit: '464981d',
    roles: ['TEACHER', 'STUDENT', 'PARENT', 'SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE'],
    en: {
      title: 'Online quiz',
      summary: 'Staff can create and publish an online quiz. Students and parents can play the published quizzes.',
      points: [
        'Add questions, four answers, the correct answer, and a short note.',
        'A quiz stays a draft until it is published.',
        'The built-in Easy, Medium, Hard, and Challenge quizzes stay available.',
      ],
    },
    fr: {
      title: 'Quiz en ligne',
      summary: 'Le personnel peut créer et publier un quiz en ligne. Les élèves et les parents jouent les quiz publiés.',
      points: [
        'Ajoutez des questions, quatre réponses, la bonne réponse et une courte note.',
        'Un quiz reste un brouillon tant qu’il n’est pas publié.',
        'Les quiz intégrés Facile, Moyen, Difficile et Défi restent disponibles.',
      ],
    },
  },
  {
    id: 'library-desk',
    date: '2026-11-18',
    commit: '464981d',
    roles: ['LIBRARIAN', 'SECRETARY', 'HEAD_OF_STUDIES'],
    en: {
      title: 'Library desk',
      summary: 'The library is a catalog with loans, returns, reports, and charts.',
      points: [
        'Add books, import them from Excel, and lend a copy to a student or a teacher.',
        'A return records the condition. A lost copy stays out of stock.',
        'The overview shows copies, loan status, and the most borrowed books.',
      ],
    },
    fr: {
      title: 'Bureau de la bibliothèque',
      summary: 'La bibliothèque est un catalogue avec prêts, retours, rapports et graphiques.',
      points: [
        'Ajoutez des livres, importez-les depuis Excel et prêtez un exemplaire à un élève ou un enseignant.',
        'Un retour note l’état. Un exemplaire perdu ne revient pas en stock.',
        'La vue d’ensemble montre les exemplaires, les prêts et les livres les plus empruntés.',
      ],
    },
  },
  {
    id: 'tuition-template',
    date: '2026-11-18',
    commit: '464981d',
    roles: ['ACCOUNTANT', 'SECRETARY', 'HEAD_OF_STUDIES'],
    en: {
      title: 'School tuition workings',
      summary: 'Nursery and primary use the same tuition sheet, and dollar payments stay in US dollars.',
      points: [
        'The sheet includes dollars, inscription, confirmation, the prior-year balance, and three trimesters.',
        'Record a dollar amount on the Paiement en Dollars line. It is stored and shown as USD.',
        'Sort the ledger A–Z or by class, and filter one class.',
      ],
    },
    fr: {
      title: 'Cahier des frais scolaires',
      summary: 'La maternelle et le primaire utilisent la même feuille, et les paiements en dollars restent en dollars.',
      points: [
        'La feuille comprend les dollars, l’inscription, la confirmation, le solde de l’année précédente et trois trimestres.',
        'Enregistrez un montant en dollars sur la ligne Paiement en Dollars. Il est gardé et affiché en USD.',
        'Triez le registre de A à Z ou par classe, et filtrez une classe.',
      ],
    },
  },
  {
    id: 'message-delete',
    date: '2026-11-18',
    commit: '464981d',
    roles: ['SCHOOL_MANAGER', 'SCHOOL_ADMIN'],
    en: {
      title: 'Delete a sent platform message',
      summary: 'School managers and school admins can delete a message or a whole conversation on the Messages page.',
      points: [
        'Deleting the last message removes the conversation.',
        'An email that was already delivered stays in the recipient’s inbox.',
      ],
    },
    fr: {
      title: 'Supprimer un message envoyé',
      summary: 'Le directeur et l’administrateur peuvent supprimer un message ou toute une conversation.',
      points: [
        'Supprimer le dernier message retire la conversation.',
        'Un e-mail déjà délivré reste dans la boîte du destinataire.',
      ],
    },
  },
  {
    id: 'proclamation',
    date: '2026-11-02',
    commit: '58de4a5',
    roles: ['PARENT', 'TEACHER', 'SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE'],
    en: {
      title: 'Report cards and proclamation',
      summary: 'The proclamation follows the same period as the report card, and it is produced for DRC and Rwanda.',
      points: [
        'Committed on 2 Nov 2026 as the trimester proclamation sheet.',
        'A period sheet has no Tot column. The full trimester and the year stay available.',
        'DRC excludes English and Kinyarwanda from the average. Rwanda includes them. Excel and PDF include both.',
      ],
    },
    fr: {
      title: 'Bulletins et fiche de proclamation',
      summary: 'La fiche suit la même période que le bulletin, et elle est produite pour la RDC et le Rwanda.',
      points: [
        'Validé le 2 nov. 2026 comme fiche de proclamation trimestrielle.',
        'Une feuille de période n’a pas de colonne Tot. Le trimestre complet et l’année restent disponibles.',
        'La RDC exclut English et Kinyarwanda de la moyenne. Le Rwanda les inclut. Excel et PDF contiennent les deux.',
      ],
    },
  },
  {
    id: 'marks-recording',
    date: '2026-10-27',
    commit: '564fa17',
    roles: ['TEACHER', 'SECRETARY', 'HEAD_OF_STUDIES', 'HEAD_OF_DISCIPLINE'],
    en: {
      title: 'Marks recording',
      summary: 'Marks can be recorded and corrected from the marks desk.',
      points: [
        'Committed on 27 Oct 2026.',
        'Teachers enter marks for their classes. Studies staff can review them.',
      ],
    },
    fr: {
      title: 'Saisie des notes',
      summary: 'Les notes se saisissent et se corrigent depuis le bureau des notes.',
      points: [
        'Validé le 27 oct. 2026.',
        'Les enseignants saisissent les notes de leurs classes. Les études peuvent les revoir.',
      ],
    },
  },
  {
    id: 'parent-email',
    date: '2026-10-26',
    commit: '37b8cc1',
    roles: ['PARENT', 'SECRETARY', 'HEAD_OF_STUDIES'],
    en: {
      title: 'Parent email on the student',
      summary: 'A parent email address can be saved with the student and used for school messages.',
      points: [
        'Committed on 26 Oct 2026.',
        'Parents receive messages at the address saved on the child.',
      ],
    },
    fr: {
      title: 'E-mail du parent sur l’élève',
      summary: 'L’e-mail du parent peut être enregistré avec l’élève et servir aux messages de l’école.',
      points: [
        'Validé le 26 oct. 2026.',
        'Les parents reçoivent les messages à l’adresse enregistrée sur l’enfant.',
      ],
    },
  },
  {
    id: 'online-quiz',
    date: '2026-10-09',
    commit: 'f858b21',
    roles: ['STUDENT', 'TEACHER', 'PARENT'],
    en: {
      title: 'Online quiz',
      summary: 'Students can take an online quiz from the learning area.',
      points: [
        'Committed on 9 Oct 2026.',
        'The science quiz arena grew from this first online quiz.',
      ],
    },
    fr: {
      title: 'Quiz en ligne',
      summary: 'Les élèves peuvent passer un quiz en ligne depuis l’espace d’apprentissage.',
      points: [
        'Validé le 9 oct. 2026.',
        'L’arène du quiz de sciences est venue de ce premier quiz en ligne.',
      ],
    },
  },
];

const FULL_ACCESS = new Set(['SCHOOL_MANAGER', 'SCHOOL_ADMIN']);

export function updatesForRole(role) {
  if (FULL_ACCESS.has(role)) return PRODUCT_UPDATES;
  return PRODUCT_UPDATES.filter((item) => item.roles.includes(role));
}
