# 🏆 SportSlot

**Plateforme de réservation de créneaux sportifs moderne et intuitive.**

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)

---

## 📸 Aperçu

<table>
  <tr>
    <th>🏠 Accueil Client</th>
    <th>⚙️ Panel Admin</th>
  </tr>
  <tr>
    <td><img src=".github/assets/home.png" alt="Vue client - Calendrier de réservation" width="400"/></td>
    <td><img src=".github/assets/admin.png" alt="Panel admin - Gestion des créneaux" width="400"/></td>
  </tr>
  <tr>
    <td>
      • Calendrier de réservation<br>
      • Filtrage par sport<br>
      • Réservation en ligne<br>
      • Mobile responsive
    </td>
    <td>
      • Gestion des créneaux<br>
      • Mode Vue / Édition<br>
      • Statistiques détaillées<br>
      • Export PDF
    </td>
  </tr>
</table>

---

## ✨ Fonctionnalités

### 👥 Côté Client
- 📅 **Calendrier interactif** de réservation par semaine
- 🎾 **Filtrage par sport** avec icônes personnalisées
- 📱 **Responsive** - Mobile, tablette et desktop
- 👆 **Swipe navigation** - Naviguez entre jours/semaines en glissant
- 👆 **Swipe to close** - Fermez les popups en glissant (mobile)
- 💾 **Formulaire persistant** - Vos infos sont gardées si fermeture accidentelle
- 🌍 **7 langues** - FR, EN, DE, ES, IT, PT, NL
- 📧 **Confirmation par email** (client + équipe)
- ⏰ **Temps réel** - Mise à jour instantanée des disponibilités
- 🔒 **Protection anti-surréservation** - Transactions atomiques
- 🎨 **Popups stylées** - Modals modernes au lieu des alertes navigateur
- 🕐 **Format horaire** - 24h ou 12h AM/PM selon vos préférences

### 🔧 Côté Admin
- 📊 **Vue / Édition** - Consultez (= vue client) ou modifiez l'agenda
- 👁️ **Mode Vue** - Prévisualisez exactement ce que vos clients voient
- 📱 **Vue mobile adaptée** - Vue jour unique avec swipe sur mobile
- 🗓️ **Glisser-déposer** - Créez, déplacez, redimensionnez les créneaux
- ✏️ **Création par sélection** - Glissez pour définir la durée
- 🗑️ **Mode Gomme** - Sélectionnez plusieurs créneaux à supprimer
- 🏃 **Gestion des sports** - Icônes emoji ou images personnalisées
- 🚫 **Gestion des fermetures** - Jours fériés, vacances, maintenance
- ⏰ **Horaires d'ouverture** - Par jour de la semaine
- 🎨 **Personnalisation** - Logo, couleurs, nom du site, devise
- 📧 **Configuration SMTP** - Emails automatiques (textes traduits)
- 🔐 **Authentification sécurisée** - Hashage des mots de passe
- 📋 **Gestion des réservations** - Visualisation et annulation
- 🔔 **Notifications** - Alertes pour nouvelles réservations
- 📤 **Publication** - Messages clairs sur ce qui est publié
- 🎨 **Popups stylées** - Confirmations et alertes modernes
- 📊 **Statistiques complètes** - KPIs, graphiques, tableaux détaillés
- 📄 **Export PDF** - Rapports résumés ou détaillés avec branding
- 🕐 **Format horaire configurable** - 24h ou 12h AM/PM

---

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+
- pnpm (recommandé) ou npm

### Installation

```bash
# Cloner le projet
git clone https://github.com/Aprilox/SportSlot
cd SportSlot

# Installer les dépendances
pnpm install

# Copier la configuration
cp env.example .env

# Lancer en mode développement
pnpm dev
```

Ouvrez http://localhost:3000 🎉

---

## ⚙️ Modes de Stockage

SportSlot supporte **3 modes** configurables via `.env` :

| Mode | Affichage | Persistance | Usage | Identifiants |
|------|-----------|-------------|-------|--------------|
| 🌐 `browser` | Navigateur - DEMO | ❌ LocalStorage | Démonstration | `admin` / `DEMO` |
| 💾 `local` | DB Locale | ✅ Fichier SQLite | Développement | `admin` / `admin` |
| ☁️ `external` | DB Externe | ✅ PostgreSQL/MySQL | Production | `admin` / `admin` |

---

### 🌐 Mode Browser (DEMO)

```env
STORAGE_MODE=browser
```

- Données dans le localStorage du navigateur
- ⚠️ Perdues si cache vidé ou changement de navigateur
- ✅ Aucune configuration requise
- 🎮 Identifiants : `admin` / `DEMO`

---

### 💾 Mode Local (SQLite)

```env
STORAGE_MODE=local
DATABASE_URL="file:./dev.db"
```

```bash
npx prisma generate
npx prisma db push
pnpm dev
```

- Fichier SQLite local (`prisma/dev.db`)
- ✅ Persistant après redémarrage
- ✅ Partagé entre navigateurs
- 🔐 Identifiants par défaut : `admin` / `admin`

---

### ☁️ Mode External (Production)

```env
STORAGE_MODE=external
DATABASE_URL="postgresql://user:password@host:5432/database"
```

⚠️ **Important** : Modifiez `prisma/schema.prisma` :
```prisma
datasource db {
  provider = "postgresql"  // ou "mysql"
  url      = env("DATABASE_URL")
}
```

```bash
npx prisma generate
npx prisma db push
pnpm build && pnpm start
```

**Services gratuits recommandés :**
- [Supabase](https://supabase.com) - PostgreSQL
- [Neon](https://neon.tech) - PostgreSQL  
- [PlanetScale](https://planetscale.com) - MySQL
- [Railway](https://railway.app) - PostgreSQL

---

## 🎯 Guide Admin

### Modes de l'Agenda

| Mode | Icône | Description |
|------|-------|-------------|
| **Vue** | 👁️ | Voir exactement ce que les clients voient (créneaux publiés uniquement) |
| **Édition** | ✏️ | Créer, modifier, supprimer des créneaux (tout visible) |

> 💡 **Astuce** : Utilisez le mode Vue pour prévisualiser votre agenda avant de publier !

### Création de Créneaux

1. Passez en mode **Édition**
2. Sélectionnez le mode **Créneau** (📅)
3. **Clic simple** → Créneau avec durée par défaut
4. **Clic + glisser** → Définir la durée manuellement
5. **Choisissez** les sports, la durée, le prix et la capacité

### Gestion des Créneaux

| Action | Comment |
|--------|---------|
| **Déplacer** | Glissez le créneau vers un autre horaire |
| **Redimensionner** | Tirez le bord haut ou bas du créneau |
| **Modifier** | Cliquez sur le créneau (mode Édition) |
| **Supprimer** | Mode Gomme (🗑️) + clic sur le créneau |

### Publication

Les modifications ne sont **pas visibles** par les clients tant qu'elles ne sont pas publiées :

| Couleur | Signification | Visible client |
|---------|---------------|----------------|
| 🟠 Orange | Non publié (nouveau ou modifié) | ❌ Non |
| 🟢 Couleur normale | Publié | ✅ Oui |
| 🔴 Rouge | Hors horaires ou en attente de suppression | ❌ Non |

Cliquez sur **🚀 Publier** pour appliquer les changements. Un message clair indique :
- Combien de créneaux publiés
- Combien de fermetures publiées
- Si tout était déjà publié

---

## 📊 Statistiques

L'onglet **Statistiques** offre une vue complète de votre activité :

### KPIs
- 💰 Chiffre d'affaires
- 📈 Nombre de réservations
- 👥 Clients uniques
- 📊 Taux d'occupation

### Graphiques
- 📈 Évolution du chiffre d'affaires
- 🏆 Répartition par sport
- ⏰ Heures les plus populaires
- 📅 Jours de la semaine

### Filtres
- Par sport
- Par période (semaine, mois, année, personnalisé)

### Export PDF
- **Résumé** : KPIs et répartition (pour comptabilité)
- **Détaillé** : Avec liste complète des réservations
- Inclut le logo et les informations de votre entreprise

---

## 🎨 Personnalisation

Dans **Admin > Paramètres** :

| Option | Description |
|--------|-------------|
| **Nom du site** | Affiché partout + onglet navigateur |
| **Logo** | URL ou upload avec recadrage |
| **Couleur principale** | Thème de l'interface |
| **Devise** | CHF, EUR, USD... |
| **Langue par défaut** | Langue initiale pour les nouveaux visiteurs |
| **Format horaire** | 24h (14:00) ou 12h (2:00 PM) |
| **Horaires** | Par jour de la semaine |
| **Délai minimum** | Temps avant réservation |

---

## 📧 Configuration Email

1. **Admin > Paramètres > Configuration SMTP**
2. Remplissez :
   - Serveur SMTP (ex: `smtp.gmail.com`)
   - Port (587 TLS ou 465 SSL)
   - Email expéditeur
   - Mot de passe (ou App Password pour Gmail)
3. **Testez** avec le bouton d'envoi de test

### Emails envoyés
- ✉️ **Client** : Confirmation de réservation (dans sa langue)
- ✉️ **Équipe** : Notification de nouvelle réservation (traduit)

---

## 🛠️ Commandes

```bash
# Développement
pnpm dev              # Serveur de développement

# Base de données
pnpm db:generate      # Générer le client Prisma
pnpm db:push          # Synchroniser le schéma
pnpm db:studio        # Interface graphique DB
pnpm db:reset         # Réinitialiser la DB

# Production
pnpm build            # Compiler
pnpm start            # Lancer
```

---

## 📁 Structure

```
sportslot/
├── app/                    # Pages Next.js
│   ├── page.tsx           # Page client (réservations)
│   ├── admin/             # Panel admin
│   │   ├── page.tsx       # Dashboard + Stats
│   │   └── login/         # Connexion
│   └── api/               # API Routes
├── components/            # Composants React
│   └── ui/               # UI (shadcn/ui + custom-dialog)
├── lib/                   # Utilitaires
│   ├── config.ts         # Configuration
│   ├── db.ts             # Base de données
│   ├── storage.ts        # LocalStorage
│   └── i18n.ts           # Traductions (7 langues)
├── locales/              # Fichiers de langue
│   ├── fr.json           # 🇫🇷 Français
│   ├── en.json           # 🇬🇧 English
│   ├── de.json           # 🇩🇪 Deutsch
│   ├── es.json           # 🇪🇸 Español
│   ├── it.json           # 🇮🇹 Italiano
│   ├── pt.json           # 🇵🇹 Português
│   └── nl.json           # 🇳🇱 Nederlands
├── prisma/               # Schéma DB
│   └── schema.prisma
└── public/               # Assets statiques
```

---

## 🔐 Sécurité

- ✅ **Hashage** des mots de passe (bcrypt-like)
- ✅ **Transactions atomiques** pour les réservations
- ✅ **Protection anti-concurrence** (pas de surréservation)
- ✅ **Validation côté serveur** de toutes les données
- ✅ **Nodemailer sécurisé** - v7.0.11+ (vulnérabilités corrigées)
- ✅ **Formulaires accessibles** - Conformes aux standards W3C
- ✅ **Contraintes de déplacement** - Les créneaux ne sortent pas des horaires
- ⚠️ **Changez** `HASH_SECRET` en production !

---

## 🌍 Langues

| Langue | Code | Drapeau |
|--------|------|---------|
| Français | `fr` | 🇫🇷 |
| English | `en` | 🇬🇧 |
| Deutsch | `de` | 🇩🇪 |
| Español | `es` | 🇪🇸 |
| Italiano | `it` | 🇮🇹 |
| Português | `pt` | 🇵🇹 |
| Nederlands | `nl` | 🇳🇱 |

- La langue par défaut est configurable dans les paramètres admin
- Les clients peuvent changer la langue via le sélecteur en haut à droite
- Toutes les traductions incluent : interface, emails, erreurs

---

## 🚀 Déploiement

### Vercel (Recommandé)

1. Connectez votre repo à [Vercel](https://vercel.com)
2. Variables d'environnement :
   ```
   STORAGE_MODE=external
   DATABASE_URL=postgresql://...
   HASH_SECRET=votre-cle-secrete-32-caracteres
   NEXT_PUBLIC_APP_URL=https://votre-domaine.com
   ```
3. Modifiez `prisma/schema.prisma` pour PostgreSQL
4. Déployez !

---

## 📝 Changelog

### v1.3.0 (Actuel)
- 🌍 **7 langues** - Ajout Español, Italiano, Português, Nederlands
- 📊 **Statistiques complètes** - KPIs, graphiques, tableaux
- 📄 **Export PDF** - Rapports résumés et détaillés avec branding
- 🕐 **Format horaire** - Choix 24h ou 12h AM/PM
- 📱 **Admin mobile** - Vue jour unique avec swipe
- 📅 **Vue mois améliorée** - Stats détaillées desktop, badges compacts mobile
- 👆 **Swipe semaines** - Navigation fluide sur mobile
- 🎯 **Contraintes créneaux** - Impossible de déplacer hors horaires
- 🔄 **Redirection mois→semaine** - Clic sur jour en vue mois
- 🐛 **Fix double drapeau** - Correction affichage langue par défaut

### v1.2.0
- ✅ **Popups personnalisées** - Remplace les alert/confirm natifs par des modals stylés
- ✅ **Swipe to close** - Fermez les popups en glissant vers le bas (mobile)
- ✅ **Animation fluide** - Le modal suit le doigt avec retour élastique
- ✅ **Conservation du formulaire** - Les infos client sont gardées si fermeture accidentelle
- ✅ **Mode Vue amélioré** - Affiche exactement ce que le client voit (créneaux publiés uniquement)
- ✅ **Messages de publication** - Messages clairs sans infos techniques
- ✅ **Traductions erreurs** - Toutes les erreurs de réservation traduites
- ✅ **Blocage scroll** - Le contenu derrière les popups ne scroll plus
- ✅ **Fix créneaux non publiés** - Les créneaux en attente ne sont plus visibles côté client
- ✅ **Fix gomme** - Le mode gomme se désactive en passant en mode Vue
- 🔒 **Sécurité nodemailer** - Mise à jour v7.0.11 (fix vulnérabilités DoS + domain)
- ♿ **Accessibilité formulaires** - Champs password conformes aux standards

### v1.1.0
- ✅ Création de créneaux par glisser-déposer
- ✅ Mode Vue / Édition séparé
- ✅ Suppression de réservations par l'admin
- ✅ Synchronisation temps réel multi-appareils
- ✅ Protection anti-surréservation atomique
- ✅ Popup d'erreur personnalisée
- ✅ Logs de debug retirés (console propre)

### v1.0.0
- ✅ Système de réservation complet
- ✅ Panel d'administration
- ✅ Multi-langue (FR, EN, DE)
- ✅ 3 modes de stockage
- ✅ Emails automatiques
- ✅ Personnalisation complète

---

## 📄 Licence

**Licence Propriétaire - Tous droits réservés**

© 2024 Aprilox - SportSlot

Ce logiciel est protégé par le droit d'auteur. Toute utilisation, reproduction, modification, distribution ou commercialisation de ce code, en tout ou en partie, est **strictement interdite** sans l'autorisation écrite préalable de l'auteur.

**Interdictions :**
- ❌ Copier ou redistribuer le code source
- ❌ Modifier ou créer des œuvres dérivées
- ❌ Utiliser à des fins commerciales sans licence
- ❌ Vendre ou sous-licencier le logiciel

**Pour obtenir une licence :**
📧 contact@aprilox.fr

---

<p align="center">
  <strong>Fait avec ❤️ par Aprilox</strong>
</p>
