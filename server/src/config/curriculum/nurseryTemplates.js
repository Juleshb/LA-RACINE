/** Nursery competence curricula from La Racine Excel bulletin templates (Petite/Moyenne/Grande). */

function domain(name, order, subjects) {
  return { name, order, subjects };
}

export const N1_COMPETENCE_DOMAINS = [
  domain("Mobiliser le langage dans toutes ses dimensions", 1, [
    { name: "Communiquer avec l'adulte et les autres enfants", code: "N1-D1-S1-I01", subcategory: "LANGAGE ORAL", sortOrder: 1 },
    { name: "Faire des phrases simples", code: "N1-D1-S1-I02", subcategory: "LANGAGE ORAL", sortOrder: 2 },
    { name: "Dire de mémoire des comptines et des chants", code: "N1-D1-S1-I03", subcategory: "LANGAGE ORAL", sortOrder: 3 },
    { name: "Ecouter une histoire courte et la comprendre, répondre à des questions simples, dire ce que l'on voit", code: "N1-D1-S1-I04", subcategory: "LANGAGE ORAL", sortOrder: 4 },
    { name: "Reconnaître quelques sons (phonologie)", code: "N1-D1-S1-I05", subcategory: "LANGAGE ORAL", sortOrder: 5 },
    { name: "Reconnaître son étiquette avec sa photo", code: "N1-D1-S2-I01", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 6 },
    { name: "Ecrire correctement l'initiale de son prénom, nommer certaines lettres de mon prénom", code: "N1-D1-S2-I02", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 7 },
    { name: "Tenir correctement le crayon, avoir une bonne posture pour écrire", code: "N1-D1-S2-I03", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 8 },
    { name: "Savoir ouvrir un livre dans le bon sens, tourner les pages et lire", code: "N1-D1-S2-I04", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 9 },
    { name: "Tracer des lignes horizontales, verticales, des ronds… des vagues, des points", code: "N1-D1-S2-I05", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 10 },
  ]),
  domain("Aquérir les premiers outils mathématiques", 2, [
    { name: "Constituer et dénombrer une collection de 1,2,3,4 ou 5 objets", code: "N1-D2-S1-I01", subcategory: null, sortOrder: 1 },
    { name: "Savoir la comptine des nombres jusqu'à 10", code: "N1-D2-S1-I02", subcategory: null, sortOrder: 2 },
    { name: "Lire et reconnaître les nombres jusqu'à 10, sur les doigts, sur le dé", code: "N1-D2-S1-I03", subcategory: null, sortOrder: 3 },
    { name: "Nommer et reconnaître le carré, le triangle, le rectangle et le cercle", code: "N1-D2-S1-I04", subcategory: null, sortOrder: 4 },
    { name: "Ecrire le 1, 2, 3, 4, 4, 5", code: "N1-D2-S1-I05", subcategory: null, sortOrder: 5 },
    { name: "Comparer des objets selon des critères de grandeur (Petit ou Grand)", code: "N1-D2-S1-I06", subcategory: null, sortOrder: 6 },
    { name: "Continuer un algorithme à 3 termes (De 2 à 3 étapes)", code: "N1-D2-S1-I07", subcategory: null, sortOrder: 7 },
  ]),
  domain("Explorer le monde", 3, [
    { name: "Se repérer dans la journée", code: "N1-D3-S1-I01", subcategory: "ESPACE, TEMPS", sortOrder: 1 },
    { name: "Connaître la comptine des jours de la semaine", code: "N1-D3-S1-I02", subcategory: "ESPACE, TEMPS", sortOrder: 2 },
    { name: "Se repérer dans l'espace familier de la classe", code: "N1-D3-S1-I03", subcategory: "ESPACE, TEMPS", sortOrder: 3 },
    { name: "Utiliser le vocabulaire spatial simple (Sur/Sous, Devant/Derrière, En haut/ En bas)", code: "N1-D3-S1-I04", subcategory: "ESPACE, TEMPS", sortOrder: 4 },
    { name: "Nommer les différentes parties du corps humain, d'un animal", code: "N1-D3-S2-I01", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 5 },
    { name: "Utiliser les ciseaux de façon correcte", code: "N1-D3-S2-I02", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 6 },
    { name: "Manipuler, nommer différentes matières (le papier, la pierre, le sable, le carton…), exprimer la qualité des matières (mou, lisse, rugueux…)", code: "N1-D3-S2-I03", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 7 },
  ]),
  domain("S'exprimer à travers des activités artistiques", 4, [
    { name: "Dessiner librement et expliquer ce que l'on a voulu dessiner", code: "N1-D4-S1-I01", subcategory: "PRODUCTION PLASTIQUES", sortOrder: 1 },
    { name: "Savoir décorer une page avec différents graphismes et couleurs, dessiner un bonhomme, une maison, un arbre…", code: "N1-D4-S1-I02", subcategory: "PRODUCTION PLASTIQUES", sortOrder: 2 },
    { name: "Chanter une mélodie simple, une comptine ou un chant seul ou en groupe", code: "N1-D4-S2-I01", subcategory: "PRODUCTION SONORES", sortOrder: 3 },
    { name: "Explorer des instruments différents, des temps différents (lent, rapide), frapper des rythmes simples", code: "N1-D4-S2-I02", subcategory: "PRODUCTION SONORES", sortOrder: 4 },
    { name: "Ecouter une musique et exprimer sa joie, sa tristesse", code: "N1-D4-S2-I03", subcategory: "PRODUCTION SONORES", sortOrder: 5 },
  ]),
  domain("S'exprimer à travers des activités physiques", 5, [
    { name: "Explorer les différents matériels des jeux de l'école, tenter de nouvelles choses", code: "N1-D5-S1-I01", subcategory: null, sortOrder: 1 },
    { name: "Sauter, lancer, courir, glisser, ramper, faire rouler", code: "N1-D5-S1-I02", subcategory: null, sortOrder: 2 },
    { name: "Participer à des jeux collectifs", code: "N1-D5-S1-I03", subcategory: null, sortOrder: 3 },
  ]),
  domain("En marche vers l'autonomie… et la socialisation", 6, [
    { name: "Sait se déshabiller pour aller aux toilettes, sait se chausser", code: "N1-D6-S1-I01", subcategory: null, sortOrder: 1 },
    { name: "Sait ranger ses affaires et les jeux de l'école", code: "N1-D6-S1-I02", subcategory: null, sortOrder: 2 },
    { name: "Dit bonjour et sait jouer calmement avec les autres", code: "N1-D6-S1-I03", subcategory: null, sortOrder: 3 },
  ]),
];

export const N2_COMPETENCE_DOMAINS = [
  domain("Mobiliser le langage dans toutes ses dimensions", 1, [
    { name: "Communiquer avec l'adulte et les autres enfants, utiliser les formules de politesse, raconter les activités de la journée", code: "N2-D1-S1-I01", subcategory: "LANGAGE ORAL", sortOrder: 1 },
    { name: "Faire des phrases simples correctes et compréhensibles", code: "N2-D1-S1-I02", subcategory: "LANGAGE ORAL", sortOrder: 2 },
    { name: "Poser des questions, comprendre des consignes doubles, reformuler des consignes", code: "N2-D1-S1-I03", subcategory: "LANGAGE ORAL", sortOrder: 3 },
    { name: "Dire de mémoire des comptines, chants", code: "N2-D1-S1-I04", subcategory: "LANGAGE ORAL", sortOrder: 4 },
    { name: "Ecouter une histoire, la comprendre, répondre à des questions simples, dire ce que l'on voit, identifier les personnages, le lieu, et la fin d'une histoire", code: "N2-D1-S1-I05", subcategory: "LANGAGE ORAL", sortOrder: 5 },
    { name: "Reconnaître quelques sons (phonologie), toutes les voyelles et les consonnes, les localiser en début ou fin de mot", code: "N2-D1-S1-I06", subcategory: "LANGAGE ORAL", sortOrder: 6 },
    { name: "Taper les syllabes des mots les plus connus", code: "N2-D1-S1-I07", subcategory: "LANGAGE ORAL", sortOrder: 7 },
    { name: "Reconnaître son étiquette avec sa photo", code: "N2-D1-S2-I01", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 8 },
    { name: "Ecrire en majuscule et épeler les lettres de son prénom", code: "N2-D1-S2-I02", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 9 },
    { name: "Tenir correctement le crayon, avoir une bonne posture pour écrire", code: "N2-D1-S2-I03", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 10 },
    { name: "Tracer les lignes horizontales, verticales, obliques, des points, des boucles, des ronds, des vagues", code: "N2-D1-S2-I04", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 11 },
    { name: "Participer à la production d'un écrit collectif", code: "N2-D1-S2-I05", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 12 },
  ]),
  domain("Aquérir les premiers outils mathématiques", 2, [
    { name: "Constituer et dénombrer une collection de 1à 15 objets", code: "N2-D2-S1-I01", subcategory: null, sortOrder: 1 },
    { name: "Savoir la comptine des nombres jusqu'à 30", code: "N2-D2-S1-I02", subcategory: null, sortOrder: 2 },
    { name: "Lire et reconnaître les nombres jusqu'à 15, sur les doigts, sur le dé", code: "N2-D2-S1-I03", subcategory: null, sortOrder: 3 },
    { name: "Ecrire les nombres jusqu'à 15", code: "N2-D2-S1-I04", subcategory: null, sortOrder: 4 },
    { name: "Comparer des collections d'objets en utilisant les expressions: autant que, plus que, moins que", code: "N2-D2-S1-I05", subcategory: null, sortOrder: 5 },
    { name: "Continuer un algorithme à 3 termes", code: "N2-D2-S1-I06", subcategory: null, sortOrder: 6 },
    { name: "Reconnaître et colorier des figures symétriques et reproduire des quadrillages", code: "N2-D2-S1-I07", subcategory: null, sortOrder: 7 },
  ]),
  domain("Explorer le monde", 3, [
    { name: "Se repérer dans la journée, dans la semaine", code: "N2-D3-S1-I01", subcategory: "ESPACE, TEMPS", sortOrder: 1 },
    { name: "Connaître la comptine des jours de la semaine et des mois de l'année", code: "N2-D3-S1-I02", subcategory: "ESPACE, TEMPS", sortOrder: 2 },
    { name: "Se repérer dans l'espace familier de la classe, de la cour", code: "N2-D3-S1-I03", subcategory: "ESPACE, TEMPS", sortOrder: 3 },
    { name: "Utiliser le vocabulaire spatial simple (Sur/Sous, Devant/Derrière, En haut/ En bas, à côté, entre au milieu)", code: "N2-D3-S1-I04", subcategory: "ESPACE, TEMPS", sortOrder: 4 },
    { name: "Nommer les différentes parties du corps humain, d'un animal et donner quelques informations sur leur vie", code: "N2-D3-S2-I01", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 5 },
    { name: "Utiliser parfaitement les ciseaux, tracer des traits avec une règle", code: "N2-D3-S2-I02", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 6 },
    { name: "Manipuler, nommer différentes matières (le papier, la pierre, le sable, le carton…), exprimer la qualité des matières (mou, lisse, rugueux…)", code: "N2-D3-S2-I03", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 7 },
    { name: "Continuer un algorithme à 3 termes", code: "N2-D3-S2-I04", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 8 },
  ]),
  domain("S'exprimer à travers des activités artistiques", 4, [
    { name: "Dessiner librement et expliquer ce que l'on a voulu dessiner", code: "N2-D4-S1-I01", subcategory: "PRODUCTION PLASTIQUES", sortOrder: 1 },
    { name: "Savoir décorer une page avec différentes graphismes et couleurs, dessiner un bonhomme, une maison, un arbre…", code: "N2-D4-S1-I02", subcategory: "PRODUCTION PLASTIQUES", sortOrder: 2 },
    { name: "Chanter une mélodie simple, une comptine ou un chant seul ou en groupe", code: "N2-D4-S2-I01", subcategory: "PRODUCTION SONORES", sortOrder: 3 },
    { name: "Explorer des instruments, des temps différents (lent, rapide), frapper des rythmes simples", code: "N2-D4-S2-I02", subcategory: "PRODUCTION SONORES", sortOrder: 4 },
    { name: "Ecouter une musique et exprimer sa joie, sa tristesse", code: "N2-D4-S2-I03", subcategory: "PRODUCTION SONORES", sortOrder: 5 },
  ]),
  domain("S'exprimer à travers des activités physiques", 5, [
    { name: "Explorer les différents matériels des jeux de l'école, tenter de nouvelles choses", code: "N2-D5-S1-I01", subcategory: null, sortOrder: 1 },
    { name: "Sauter, lancer, courir, glisser, ramper, faire rouler", code: "N2-D5-S1-I02", subcategory: null, sortOrder: 2 },
    { name: "Participer à des jeux collectifs", code: "N2-D5-S1-I03", subcategory: null, sortOrder: 3 },
  ]),
  domain("En marche vers l'autonomie… et la socialisation", 6, [
    { name: "Sait se déshabiller pour aller aux toilettes, sait se chausser", code: "N2-D6-S1-I01", subcategory: null, sortOrder: 1 },
    { name: "Sait ranger ses affaires et les jeux de l'école", code: "N2-D6-S1-I02", subcategory: null, sortOrder: 2 },
    { name: "Dit bonjour et sait jouer calmement avec les autres", code: "N2-D6-S1-I03", subcategory: null, sortOrder: 3 },
  ]),
  domain("ENGLISH SKILLS", 7, [
    { name: "Ask questions and express curiosity", code: "N2-D7-S1-I01", subcategory: "LANGUAGE SKILLS", sortOrder: 1 },
    { name: "Can recall letter sounds in class", code: "N2-D7-S1-I02", subcategory: "LANGUAGE SKILLS", sortOrder: 2 },
    { name: "Recites some common nursery rhymes and songs", code: "N2-D7-S1-I03", subcategory: "LANGUAGE SKILLS", sortOrder: 3 },
    { name: "Responds appropriately to sounds and environment", code: "N2-D7-S1-I04", subcategory: "LANGUAGE SKILLS", sortOrder: 4 },
    { name: "Responds to general greetings and farewell", code: "N2-D7-S1-I05", subcategory: "LANGUAGE SKILLS", sortOrder: 5 },
    { name: "Read two and three letter words and simple sentences", code: "N2-D7-S2-I01", subcategory: "READING SKILLS", sortOrder: 6 },
    { name: "Recognize some letter sounds", code: "N2-D7-S2-I02", subcategory: "READING SKILLS", sortOrder: 7 },
    { name: "Tries to read in everyday situations (signs, labels, etc)", code: "N2-D7-S2-I03", subcategory: "READING SKILLS", sortOrder: 8 },
    { name: "Attempts to write own name and recognizes own name in print", code: "N2-D7-S3-I01", subcategory: "WRITING SKILLS", sortOrder: 9 },
    { name: "Tries to scribble, draw or write", code: "N2-D7-S3-I02", subcategory: "WRITING SKILLS", sortOrder: 10 },
    { name: "Writes some alphabet letters", code: "N2-D7-S3-I03", subcategory: "WRITING SKILLS", sortOrder: 11 },
    { name: "Arranges objects in size order (big to small, or small to big)", code: "N2-D7-S4-I01", subcategory: "MATHEMATICAL SKILLS", sortOrder: 12 },
    { name: "Compares the size of groups of objects using language such as small, big and short/long", code: "N2-D7-S4-I02", subcategory: "MATHEMATICAL SKILLS", sortOrder: 13 },
    { name: "Identifies similarities and differences in objects", code: "N2-D7-S4-I03", subcategory: "MATHEMATICAL SKILLS", sortOrder: 14 },
    { name: "Recognize some numbers", code: "N2-D7-S4-I04", subcategory: "MATHEMATICAL SKILLS", sortOrder: 15 },
    { name: "Can distinguish numbers frome letters, and understands that numbers relate to quantity", code: "N2-D7-S4-I05", subcategory: "MATHEMATICAL SKILLS", sortOrder: 16 },
  ]),
];

export const N3_COMPETENCE_DOMAINS = [
  domain("Mobiliser le langage dans toutes ses dimensions", 1, [
    { name: "Communiquer avec l'adulte et les autres enfants, utiliser les formules de politesse, raconter les activités de la journée", code: "N3-D1-S1-I01", subcategory: "LANGAGE ORAL", sortOrder: 1 },
    { name: "Faire des phrases simples correctes et compréhensibles", code: "N3-D1-S1-I02", subcategory: "LANGAGE ORAL", sortOrder: 2 },
    { name: "Poser des questions, comprendre des consignes doubles, reformuler des consignes", code: "N3-D1-S1-I03", subcategory: "LANGAGE ORAL", sortOrder: 3 },
    { name: "Ecouter une histoire, la comprendre, répondre à des questions simples, dire ce que l'on voit, identifier les personnages, le lieu, et la fin d'une histoire", code: "N3-D1-S1-I04", subcategory: "LANGAGE ORAL", sortOrder: 4 },
    { name: "Reconnaître quelques sons (phonologie), toutes les voyelles et les consonnes, les localiser en début ou fin de mot", code: "N3-D1-S1-I05", subcategory: "LANGAGE ORAL", sortOrder: 5 },
    { name: "Taper les syllabes des mots les plus connus", code: "N3-D1-S1-I06", subcategory: "LANGAGE ORAL", sortOrder: 6 },
    { name: "Recopier une petite phrase en lettres cursives et taper dans les mains tous les mots de cette phrase, écrire sur la ligne", code: "N3-D1-S2-I01", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 7 },
    { name: "Tenir correctement le crayon, avoir une bonne posture pour écrire", code: "N3-D1-S2-I02", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 8 },
    { name: "Distinguer différentes livres: les albums, les BD, les documentaires, monter le nom de l'auteur", code: "N3-D1-S2-I03", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 9 },
    { name: "Connaître l'alphabet par coeur et nommer les lettres en désordre, réussir des dictées de lettres", code: "N3-D1-S2-I04", subcategory: "LANGAGE, ECRITURE, GRAPHISME", sortOrder: 10 },
  ]),
  domain("Aquérir les premiers outils mathématiques", 2, [
    { name: "Constituer et dénombrer une collection de 1à 20 objets", code: "N3-D2-S1-I01", subcategory: null, sortOrder: 1 },
    { name: "Addition 1 à 20", code: "N3-D2-S1-I02", subcategory: null, sortOrder: 2 },
    { name: "Soustraction 1 à 20", code: "N3-D2-S1-I03", subcategory: null, sortOrder: 3 },
    { name: "Savoir la comptine des nombres jusqu'à 50", code: "N3-D2-S1-I04", subcategory: null, sortOrder: 4 },
    { name: "Lire et reconnaître les nombres jusqu'à 20, sur les doigts, sur le dé", code: "N3-D2-S1-I05", subcategory: null, sortOrder: 5 },
    { name: "Ecrire les nombres jusqu'à 15", code: "N3-D2-S1-I06", subcategory: null, sortOrder: 6 },
    { name: "Comparer des collections d'objets en utilisant les expressions: autant que, plus que, moins que", code: "N3-D2-S1-I07", subcategory: null, sortOrder: 7 },
    { name: "Continuer un algorithme à 6 termes (De 4 à 6 étapes)", code: "N3-D2-S1-I08", subcategory: null, sortOrder: 8 },
    { name: "Reconnaître et colorier des figures symétriques et reproduire des quadrillages", code: "N3-D2-S1-I09", subcategory: null, sortOrder: 9 },
  ]),
  domain("Explorer le monde", 3, [
    { name: "Se repérer dans la journée, dans la semaine", code: "N3-D3-S1-I01", subcategory: "ESPACE, TEMPS", sortOrder: 1 },
    { name: "Connaître la comptine des jours de la semaine et des mois de l'année", code: "N3-D3-S1-I02", subcategory: "ESPACE, TEMPS", sortOrder: 2 },
    { name: "Se repérer dans l'espace familier de la classe, de la cour", code: "N3-D3-S1-I03", subcategory: "ESPACE, TEMPS", sortOrder: 3 },
    { name: "Utiliser le vocabulaire spatial simple (Sur/Sous, Devant/Derrière, En haut/ En bas, à côté, entre au milieu)", code: "N3-D3-S1-I04", subcategory: "ESPACE, TEMPS", sortOrder: 4 },
    { name: "Nommer les différentes parties du corps humain, d'un animal et donner quelques informations sur leur vie", code: "N3-D3-S2-I01", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 5 },
    { name: "Utiliser parfaitement les ciseaux, tracer des traits avec une règle", code: "N3-D3-S2-I02", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 6 },
    { name: "Manipuler, nommer différentes matières (le papier, la pierre, le sable, le carton…), exprimer la qualité des matières (mou, lisse, rugueux…)", code: "N3-D3-S2-I03", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 7 },
    { name: "Continuer un algorithme à 3 termes", code: "N3-D3-S2-I04", subcategory: "LES VIVANTS, LES OBJETS, LES MATERIAUX", sortOrder: 8 },
    { name: "Sur l'ordinateur, je sais déplacer la souris, cliquer et fermer un programme", code: "N3-D3-S3-I01", subcategory: "INFORMATIQUE", sortOrder: 9 },
  ]),
  domain("S'exprimer à travers des activités artistiques", 4, [
    { name: "Dessiner librement et expliquer ce que l'on a voulu dessiner", code: "N3-D4-S1-I01", subcategory: "PRODUCTION PLASTIQUES", sortOrder: 1 },
    { name: "Savoir décorer une page avec différentes graphismes et couleurs, dessiner un bonhomme, une maison, un arbre…", code: "N3-D4-S1-I02", subcategory: "PRODUCTION PLASTIQUES", sortOrder: 2 },
    { name: "Chanter une mélodie simple, une comptine ou un chant seul ou en groupe", code: "N3-D4-S2-I01", subcategory: "PRODUCTION SONORES", sortOrder: 3 },
    { name: "Explorer des instruments différents, des temps différents (lent, rapide), frapper des rythmes simples", code: "N3-D4-S2-I02", subcategory: "PRODUCTION SONORES", sortOrder: 4 },
    { name: "Ecouter une musique et exprimer sa joie, sa tristesse", code: "N3-D4-S2-I03", subcategory: "PRODUCTION SONORES", sortOrder: 5 },
  ]),
  domain("S'exprimer à travers des activités physiques", 5, [
    { name: "Explorer les différents matériels des jeux de l'école, tenter de nouvelles choses", code: "N3-D5-S1-I01", subcategory: null, sortOrder: 1 },
    { name: "Sauter, lancer, courir, glisser, ramper, faire rouler", code: "N3-D5-S1-I02", subcategory: null, sortOrder: 2 },
    { name: "Participer à des jeux collectifs", code: "N3-D5-S1-I03", subcategory: null, sortOrder: 3 },
  ]),
  domain("En marche vers l'autonomie… et la socialisation", 6, [
    { name: "Sait se déshabiller pour aller aux toilettes, sait se chausser", code: "N3-D6-S1-I01", subcategory: null, sortOrder: 1 },
    { name: "Sait ranger ses affaires et les jeux de l'école", code: "N3-D6-S1-I02", subcategory: null, sortOrder: 2 },
    { name: "Dit bonjour et sait jouer calmement avec les autres", code: "N3-D6-S1-I03", subcategory: null, sortOrder: 3 },
  ]),
  domain("ENGLISH SKILLS", 7, [
    { name: "Ask questions and express curiosity", code: "N3-D7-S1-I01", subcategory: "LANGUAGE SKILLS", sortOrder: 1 },
    { name: "Can recall letter sounds in class", code: "N3-D7-S1-I02", subcategory: "LANGUAGE SKILLS", sortOrder: 2 },
    { name: "Makes sentences while speaking", code: "N3-D7-S1-I03", subcategory: "LANGUAGE SKILLS", sortOrder: 3 },
    { name: "Responds appropriately to sounds and environment", code: "N3-D7-S1-I04", subcategory: "LANGUAGE SKILLS", sortOrder: 4 },
    { name: "Responds to general greetings and farewell", code: "N3-D7-S1-I05", subcategory: "LANGUAGE SKILLS", sortOrder: 5 },
    { name: "Read two and three letter words and simple sentences", code: "N3-D7-S2-I01", subcategory: "READING SKILLS", sortOrder: 6 },
    { name: "Recognize some letter sounds", code: "N3-D7-S2-I02", subcategory: "READING SKILLS", sortOrder: 7 },
    { name: "Tries to read in everyday situations (signs, labels, etc)", code: "N3-D7-S2-I03", subcategory: "READING SKILLS", sortOrder: 8 },
    { name: "Attempts to write own name and recognizes own name in print", code: "N3-D7-S3-I01", subcategory: "WRITING SKILLS", sortOrder: 9 },
    { name: "Tries to scribble, draw or write", code: "N3-D7-S3-I02", subcategory: "WRITING SKILLS", sortOrder: 10 },
    { name: "Writes some alphabet letters", code: "N3-D7-S3-I03", subcategory: "WRITING SKILLS", sortOrder: 11 },
    { name: "Arranges objects in size order (big to small, or small to big)", code: "N3-D7-S4-I01", subcategory: "MATHEMATICAL SKILLS", sortOrder: 12 },
    { name: "Compares the size of groups of objects using language such as small, big and short/long", code: "N3-D7-S4-I02", subcategory: "MATHEMATICAL SKILLS", sortOrder: 13 },
    { name: "Identifies similarities and differences in objects", code: "N3-D7-S4-I03", subcategory: "MATHEMATICAL SKILLS", sortOrder: 14 },
    { name: "Recognize some numbers", code: "N3-D7-S4-I04", subcategory: "MATHEMATICAL SKILLS", sortOrder: 15 },
    { name: "Can distinguish numbers frome letters, and understands that numbers relate to quantity", code: "N3-D7-S4-I05", subcategory: "MATHEMATICAL SKILLS", sortOrder: 16 },
  ]),
];

export const NURSERY_TEMPLATE_BY_GRADE = {
  CRECHE: N1_COMPETENCE_DOMAINS,
  N1: N1_COMPETENCE_DOMAINS,
  N2: N2_COMPETENCE_DOMAINS,
  N3: N3_COMPETENCE_DOMAINS,
  TOP: N3_COMPETENCE_DOMAINS,
};

export function getNurseryCompetenceDomains(grade) {
  return NURSERY_TEMPLATE_BY_GRADE[grade] || null;
}

export function isCompetenceNurseryCurriculum(grade) {
  return Boolean(NURSERY_TEMPLATE_BY_GRADE[grade]);
}
