# Prépa EPSO AD5 - Horizon

**Horizon** est une application web interactive d'aide à la préparation du prestigieux concours européen **EPSO AD5**. Conçue pour optimiser et structurer vos révisions, l'application utilise l'Intelligence Artificielle (via l'API Google Gemini) pour transformer vos cours, rapports et documents bruts en supports d'apprentissage interactifs et ciblés.

## 🎯 Objectif et But de l'Application

Le concours EPSO (Office européen de sélection du personnel) exige une connaissance pointue des institutions européennes, de l'histoire, des politiques et du droit de l'UE, ainsi que de solides capacités de raisonnement (numérique, verbal) et de rédaction (EUFTE).

Le but de **Horizon** est de vous faire gagner un temps précieux et d'améliorer votre mémorisation en automatisant la création de vos supports de révision. Au lieu de lire passivement des centaines de pages de PDF, l'application vous permet de :

1. **Extraire intelligemment les connaissances** (RAG - Retrieval-Augmented Generation) de vos documents personnels.
2. **Générer des Fiches de Synthèse et des Flashcards** pour un apprentissage actif.
3. **Vous tester via des QCM sur-mesure** générés à partir des connaissances extraites.
4. **Vous entraîner à l'expression écrite (EUFTE)** avec une correction personnalisée.

## ✨ Fonctionnalités Principales

*   📚 **Bibliothèque Locale Intégrée (File System Access API)**
    *   Fini les limites de stockage du navigateur (LocalStorage). L'application se connecte directement à un dossier de votre tablette ou de votre ordinateur.
    *   Vos documents (PDF, Word, TXT) et vos révisions restent chez vous.
*   🧠 **Analyse IA de Documents**
    *   Importez un document et laissez l'IA l'analyser.
    *   Extraction automatique des **notions clés, chiffres clés, chronologies (dates) et acteurs majeurs**.
*   📝 **Création de Supports de Révision**
    *   Génération de Fiches thématiques (Institutions, Histoire, Politiques).
    *   Génération de listes de Vocabulaire et règles de Grammaire (Anglais).
    *   Génération de paquets de Flashcards pour la mémorisation espacée.
*   🎯 **Générateur de QCM Avancé (RAG)**
    *   Générez des QCM de "Connaissance de l'UE" basés **exclusivement** sur les données préalablement extraites par l'IA lors de l'analyse de vos documents. Fini les hallucinations : l'IA vous interroge sur *vos* cours.
    *   Entraînements aux raisonnements : Verbal, Numérique, et Compétences Numériques (DigComp).
*   ✍️ **Module Expression Écrite (EUFTE)**
    *   Entraînement à la rédaction d'essais dans les conditions de l'EPSO avec correction détaillée de l'IA sur le fond et la forme.

## 🚀 Comment ça marche ? (Workflow Idéal)

1. **Connectez un Dossier Local :** Indiquez à l'application où sauvegarder vos révisions.
2. **Uploadez un Cours :** Ajoutez un PDF (ex: un cours sur la PAC ou le Traité de Lisbonne).
3. **Lancez l'Analyse :** Demandez à l'IA d'analyser le document. L'IA va lire le texte brut et extraire toutes les connaissances importantes (dates, institutions, synthèse).
4. **Testez-vous :** Allez dans l'onglet QCM, sélectionnez "Connaissance de l'UE", et lancez un test. L'IA utilisera les connaissances qu'elle a extraites pour générer les questions.

## 🛠️ Technologies Utilisées

*   **Frontend :** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons.
*   **Intelligence Artificielle :** Google Gemini API (Modèles Gemini 1.5 Flash et Pro).
*   **Stockage :** File System Access API pour un accès direct, transparent et sans limite au système de fichiers local de l'utilisateur.
*   **PWA (Progressive Web App) :** Installable sur tablette (iOS/Android) ou Desktop pour une utilisation en plein écran comme une application native.

## 🔐 Sécurité et Confidentialité

*   **Clé API Locale :** Votre clé API Google AI Studio n'est sauvegardée que sur votre appareil (LocalStorage). Elle n'est jamais transmise à un serveur tiers (autre que Google pour la requête).
*   **Données Locales :** Les documents traités et les analyses générées restent dans le dossier local de votre choix. L'application ne possède pas de backend de base de données distant.

---
*Conçu comme un outil personnel d'excellence pour réussir le concours EPSO AD5.*
