import { Calendar, Building2, Globe, Clock, ShieldCheck, Hash, Sparkles } from 'lucide-react';

export const FACT_SHEET_TOPICS = [
  { id: 'institutions', label: 'Institutions et organes' },
  { id: 'history', label: 'Histoire et traités' },
  { id: 'policies', label: 'Politiques communes' },
  { id: 'law', label: 'Droit de l\'UE' },
  { id: 'budget', label: 'Budget de l\'UE' },
];

export const EU_SUBTYPES = [
  {
    id: 'all_knowledge',
    title: "QCM Toute Connaissance (Base Globale)",
    description: "Un test complet balayant TOUTES les thématiques (Dates, Institutions, Politiques, Histoire, Traités, Chiffres) extraites de vos documents.",
    icon: Sparkles,
    badge: "Toute Connaissance RAG"
  },
  {
    id: 'dates',
    title: "QCM Dates & Chronologie",
    description: "Dates clés, chronologie des événements, signature, ratification et entrée en vigueur des traités.",
    icon: Calendar,
    badge: "Dates & Chronologie"
  },
  {
    id: 'institutions',
    title: "QCM Institutions & Organes",
    description: "Parlement européen, Conseil européen, Conseil de l'UE, Commission, CJUE, BCE, Cour des comptes et agences.",
    icon: Building2,
    badge: "Institutions & Organes"
  },
  {
    id: 'policies',
    title: "QCM Politiques Européennes",
    description: "Pacte Vert (Green Deal), PAC, Marché Unique, politique de concurrence, numérique, cohésion et PESC.",
    icon: Globe,
    badge: "Politiques Communes"
  },
  {
    id: 'history',
    title: "QCM Histoire & Construction",
    description: "Pères fondateurs, Déclaration Schuman, vagues d'élargissement successives et grandes étapes historiques.",
    icon: Clock,
    badge: "Histoire UE"
  },
  {
    id: 'treaties',
    title: "QCM Traités & Droit de l'UE",
    description: "CECA, Rome, Maastricht, Lisbonne, directives, règlements, primauté, effet direct et jurisprudence.",
    icon: ShieldCheck,
    badge: "Traités & Droit"
  },
  {
    id: 'figures',
    title: "QCM Données & Chiffres Clés",
    description: "Budget de l'UE, Cadre Financier Pluriannuel, pourcentages, démographie et statistiques des 27 États.",
    icon: Hash,
    badge: "Chiffres & Statistiques"
  }
];

export const FACT_SHEET_SKILLS: Record<string, string> = {
  institutions: `
# SKILL / COMPÉTENCE RAG : INSTITUTIONS ET ORGANES DE L'UE
## CONSIGNES DE FILTRAGE STRICT
Tu dois analyser le document et traiter EXCLUSIVEMENT des institutions, organes, agences et organismes de l'UE (ex: Parlement européen, Conseil de l'UE, Conseil européen, Commission, CJUE, BCE, Cour des comptes, SEAE, etc.).
- Pour chaque institution/organe identifié :
  1. Nom de l'institution ou de l'organe (term)
  2. Sa date de création, d'entrée en vigueur ou sa base juridique dans les traités (date)
  3. Ses rôles principaux, buts et objectifs statutaires (explanation)
  4. Un exemple concret tiré du texte concernant ses actions, sa composition ou ses compétences (example)
- Ne traiter AUCUN sujet non lié aux institutions.
`,
  history: `
# SKILL / COMPÉTENCE RAG : HISTOIRE ET TRAITÉS DE L'UE
## CONSIGNES DE FILTRAGE STRICT
Tu dois analyser le document et traiter EXCLUSIVEMENT de l'histoire de la construction européenne, des traités fondateurs et révisés (CECA, Rome, AUE, Maastricht, Amsterdam, Nice, Lisbonne) et des étapes clés.
- Pour chaque traité ou événement historique identifié :
  1. Nom du traité ou de l'étape historique (term)
  2. Date de signature et/ou d'entrée en vigueur (date)
  3. Contexte historique approfondi, motifs politiques et liens explicites avec les traités précédents (explanation)
  4. Un exemple d'innovation majeure ou de modification institutionnelle apportée par ce traité (example)
`,
  policies: `
# SKILL / COMPÉTENCE RAG : POLITIQUES COMMUNES DE L'UE
## CONSIGNES DE FILTRAGE STRICT
Tu dois analyser le document et traiter EXCLUSIVEMENT des politiques publiques de l'Union européenne (ex: PAC, Politique de Cohésion, Concurrence, Marché Unique, Pacte Vert / Green Deal, PACTE Migration, PESC/PSDC).
- Pour chaque politique européenne identifiée :
  1. Nom de la politique ou du cadre d'action (term)
  2. Date d'adoption, de mise en œuvre ou de révision majeure (date)
  3. Buts, objectifs stratégiques, piliers et cadre réglementaire (explanation)
  4. Un exemple concret d'application, de financement ou de projet dans les États membres (example)
`,
  law: `
# SKILL / COMPÉTENCE RAG : DROIT ET PRINCIPES DE L'UE
## CONSIGNES DE FILTRAGE STRICT
Tu dois analyser le document et traiter EXCLUSIVEMENT des sources du droit de l'UE, des principes juridiques cardinaux et de la jurisprudence.
- Pour chaque principe ou acte juridique :
  1. Principe, type d'acte (Règlement, Directive, Décision) ou Arrêt phare (term)
  2. Date d'adoption, d'entrée en vigueur ou de rendu d'arrêt (date)
  3. Explication juridique (portée, primauté, effet direct, subsidiarité, proportionnalité) (explanation)
  4. Exemple concret d'application jurisprudentielle ou transposition en droit national (example)
`,
  budget: `
# SKILL / COMPÉTENCE RAG : BUDGET ET FINANCES DE L'UE
## CONSIGNES DE FILTRAGE STRICT
Tu dois analyser le document et traiter EXCLUSIVEMENT des finances, du budget européen, du Cadre Financier Pluriannuel (CFP), des ressources propres et des contrôles financiers.
- Pour chaque élément budgétaire :
  1. Nom de l'instrument financier, du CFP ou du mécanisme (term)
  2. Période ou date de référence (date)
  3. Explication des règles de financement, de la procédure budgétaire ou des compétences de contrôle (explanation)
  4. Exemple d'allocation de fonds ou de cas d'audit (example)
`,
  concepts: `
# SKILL / COMPÉTENCE RAG : CONCEPTS GÉNÉRAUX ET SYNTHÈSE
## CONSIGNES DE FILTRAGE STRICT
Extrais les concepts, notions et termes clés du document.
- Pour chaque concept :
  1. Intitulé du concept/terme (term)
  2. Date associée si disponible (date)
  3. Explication détaillée (explanation)
  4. Exemple d'illustration concret (example)
`
};

export const QCM_SKILLS: Record<string, string> = {
  numerical: `
# COMPETENCE : RAISONNEMENT NUMÉRIQUE EPSO AD5
## OBJECTIF
Évaluer la capacité du candidat à tirer des conclusions logiques à partir de données numériques (tableaux ou textes).

## CONSIGNES STRICTES DE RÉDACTION
1. **Contexte** : Le tableau de donnees dans le champ context est OBLIGATOIRE. Il doit contenir au minimum 3 lignes et 3 colonnes de donnees numeriques realistes (budgets, demographie, pourcentages).
2. **Types de calculs** : Pourcentages, ratios, règles de trois, interprétation de données.
3. **Explication** : Doit être une démonstration pas-à-pas de la méthode la plus rapide et logique pour arriver au résultat.

## REGLES CRITIQUES POUR LES DISTRACTEURS
4. Les distracteurs doivent provenir d'erreurs de calcul realistes (oubli d'une etape, confusion d'unite, confusion entre taux et valeur absolue).
5. Pas de reponses absurdes. Toutes les options doivent etre plausibles et credibles.
6. Homogeneite : les options doivent etre du meme ordre de grandeur et de meme format.

## CALIBRAGE DE LA DIFFICULTE
- Facile : rappel direct de donnees, calcul simple.
- Moyen : croisement de 2 informations, calcul modere.
- Difficile : analyse multi-etapes, pieges d'exceptions, comparaisons croisees.

## DISTRIBUTION UNIFORME
La position de la bonne réponse (correctAnswerIndex) DOIT varier de manière équilibrée entre 0, 1, 2 et 3 sur l'ensemble du QCM. Ne PAS concentrer les bonnes réponses sur les index 1 et 2.
`,
  verbal: `
# COMPETENCE : RAISONNEMENT VERBAL EPSO AD5
## OBJECTIF
Évaluer la capacité du candidat à analyser des informations complexes dans un texte institutionnel.

## CONSIGNES STRICTES DE RÉDACTION
1. **Contexte** : Le texte dans le champ context doit contenir entre 150 et 200 mots et sembler extrait d'un rapport officiel de l'UE.
2. **Formulation** : Demander "Selon le texte, laquelle de ces affirmations est correcte ?" ou "Que peut-on déduire ?".
3. **Explication** : Justifier la bonne réponse par une citation du texte et expliquer brièvement pourquoi chaque distracteur est invalide.

## REGLES CRITIQUES POUR LES DISTRACTEURS
4. Les distracteurs doivent se baser sur les pieges typiques EPSO : extrapolation injustifiee, inversion de polarite, generalisation abusive, verite partielle.
5. Plausibilite obligatoire : pas de reponses absurdes ou evidemment fausses sans lire le texte.
6. Homogeneite : meme longueur et style pour toutes les options.

## CALIBRAGE DE LA DIFFICULTE
- Facile : rappel direct d'un fait explicite dans le texte.
- Moyen : croisement de 2 informations explicites du texte, deductions moderees.
- Difficile : analyse multi-etapes, pieges d'exceptions, comparaisons croisees.

## DISTRIBUTION UNIFORME
La position de la bonne réponse (correctAnswerIndex) DOIT varier de manière équilibrée entre 0, 1, 2 et 3 sur l'ensemble du QCM. Ne PAS concentrer les bonnes réponses sur les index 1 et 2.
`,
  eu: `
# COMPETENCE : CONNAISSANCE DE L'UNION EUROPÉENNE
## OBJECTIF
Évaluer l'expertise sur les institutions, les politiques, le droit et l'histoire de l'UE.

## CONSIGNES STRICTES DE RÉDACTION
1. **Domaines** : Cadre institutionnel (rôles respectifs), Traités (Maastricht, Lisbonne, etc.), Politiques (PAC, Green Deal), Droit et Chiffres clés.
2. **Précision** : Les questions doivent être sans ambiguïté et cibler des faits précis basés sur les documents sources.
3. **Explication** : Doit être riche et didactique, rappelant le contexte historique, juridique ou textuel exact de la réponse.

## RÈGLES CRITIQUES POUR LES DISTRACTEURS (mauvaises réponses)
4. **Plausibilité obligatoire** : Les 3 mauvaises réponses doivent être PLAUSIBLES et CRÉDIBLES. Elles doivent appartenir au même domaine sémantique que la bonne réponse (ex: si la bonne réponse est "Conseil européen", les distracteurs doivent être d'autres institutions réelles comme "Conseil de l'UE", "Commission européenne", "Comité des régions" et NON des réponses absurdes ou inventées).
5. **Pas de réponses absurdes** : Ne JAMAIS inclure de réponses manifestement fausses, farfelues, anachroniques ou hors-sujet qui permettraient d'éliminer par simple bon sens.
6. **Confusions typiques** : Construire les distracteurs autour de confusions fréquentes chez les candidats (ex: confondre Conseil européen / Conseil de l'UE, majorité qualifiée / unanimité, directive / règlement).
7. **Homogénéité formelle** : Les 4 options doivent avoir une longueur et un niveau de détail similaires. La bonne réponse ne doit PAS être systématiquement la plus longue ou la plus détaillée.

## RÈGLES DE POSITIONNEMENT DE LA BONNE RÉPONSE
8. **Distribution uniforme OBLIGATOIRE** : La position de la bonne réponse (correctAnswerIndex) DOIT varier de manière équilibrée entre 0, 1, 2 et 3 sur l'ensemble du QCM. Ne PAS concentrer les bonnes réponses sur les index 1 et 2.
`,
  digcomp: `
# COMPETENCE : COMPÉTENCES NUMÉRIQUES (DIGCOMP 2.2)
## OBJECTIF
Évaluer la maîtrise des concepts numériques selon le cadre européen DigComp 2.2.

## CONSIGNES STRICTES DE RÉDACTION
1. **Domaines** : Sécurité des données, traitement de l'information, communication en ligne, résolution de problèmes techniques.
2. **Format** : Privilégier des mises en situation de la vie professionnelle ("Vous recevez un email...", "Vous devez sécuriser...").
3. **Explication** : Rappeler les bonnes pratiques professionnelles et de cybersécurité liées à la question.

## REGLES CRITIQUES POUR LES DISTRACTEURS
4. Distracteurs : Pratiques informatiques plausibles mais incorrectes (ex: mauvaises habitudes communes).
5. Pas de reponses absurdes. Toutes les options doivent paraitre credibles.
6. Homogeneite : longueur et detail similaires.

## CALIBRAGE DE LA DIFFICULTE
- Facile : rappel direct de bonnes pratiques, procedures simples.
- Moyen : croisement de 2 informations, situations avec un peu d'ambiguite.
- Difficile : analyse multi-etapes, pieges subtils, resolution de problemes complexes avec exceptions.

## DISTRIBUTION UNIFORME
La position de la bonne réponse (correctAnswerIndex) DOIT varier de manière équilibrée entre 0, 1, 2 et 3 sur l'ensemble du QCM. Ne PAS concentrer les bonnes réponses sur les index 1 et 2.
`,
  english: `
# COMPETENCE : ANGLAIS (EUFTE)
## OBJECTIF
Évaluer l'anglais professionnel, administratif et institutionnel niveau B2/C1.

## CONSIGNES STRICTES DE RÉDACTION
1. **Contexte** : Le texte doit ressembler à des extraits de memos de la Commission europeenne.
2. **Explication** : Rédigée en FRANÇAIS, elle doit expliquer la règle de grammaire précise ou la nuance lexicale testée.

## REGLES CRITIQUES POUR LES DISTRACTEURS
3. Distracteurs : grammaticalement plausibles mais incorrects (faux amis, mauvaise preposition, mauvais temps).
4. Pas de reponses absurdes.
5. Homogeneite de longueur entre les options.

## CALIBRAGE DE LA DIFFICULTE
- Facile : grammaire de base, vocabulaire standard.
- Moyen : conditionnel / subjonctif, phrasal verbs.
- Difficile : collocations nuancees, idiomes administratifs complexes.

## DISTRIBUTION UNIFORME
La position de la bonne réponse (correctAnswerIndex) DOIT varier de manière équilibrée entre 0, 1, 2 et 3 sur l'ensemble du QCM. Ne PAS concentrer les bonnes réponses sur les index 1 et 2.
`
};

export const DOCUMENT_ANALYSIS_SKILL = `
# SKILL / COMPÉTENCE : ANALYSE ET DÉCOUPAGE EN NOTIONS D'UN DOCUMENT (RAG EPSO)
## OBJECTIF
Découper et structurer le document en Notions Clés et Modules d'apprentissage fondamentaux pour alimenter la création de QCMs, Fiches de Révision, Flashcards et Sujets d'Écrit.

## CONSIGNES D'EXTRACTION STRICTES
1. **Modules & Chapitres (modules)** : Découper le document en 2 à 5 modules thématiques logiques.
2. **Notions Clés (notions)** : Pour chaque module, isoler les concepts fondamentaux (notions, procédures, règles, mécanismes). Chaque notion doit contenir un résumé, ses points clés et sa catégorie.
3. **Synthèse globale (summary)** : Rédiger un résumé exécutif fluide, approfondi et structuré.
4. **Données & Chiffres clés (keyFigures)** : Extraire tous les montants, pourcentages, statistiques et dates chiffrées avec leur contexte exact.
5. **Acteurs & Institutions (entities)** : Lister les institutions, organes, agences ou pays mentionnés avec leurs rôles statutaires.
6. **Points clés incontournables (takeaways)** : Lister 5 à 10 enseignements fondamentaux indispensables pour un candidat EPSO.
7. **Vocabulaire & Sigles (vocabulary)** : Lister les termes techniques, juridiques ou acronymes avec leurs définitions exactes.
8. **Chronologie & Traités (timeline)** : Extraire les étapes chronologiques, dates et traités cités.
`;

export const FLASHCARD_SKILL = `
# SKILL / COMPÉTENCE : CRÉATION DE FLASHCARDS DE RÉVISION EPSO
## OBJECTIF
Concevoir des cartes mémoires (flashcards) bilatérales hautement pédagogiques pour une mémorisation rapide des notions clés.

## CONSIGNES STRICTES
1. **Question / Concept (Recto)** : Intitulé précis, concis et direct.
2. **Définition / Explication (Verso)** : Réponse claire, structurée et complète.
`;

export const ESSAY_SKILL = `
# SKILL / COMPÉTENCE : ÉVALUATION ÉPREUVE RÉDACTIONNELLE / ESSAY EPSO
## OBJECTIF
Évaluer une dissertation ou note de synthèse administrative selon les critères d'excellence des concours européens EPSO (Clarté, Structure, Argumentation, Vocabulaire institutionnel, Maîtrise de la langue).
`;
