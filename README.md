# 🏆 SportSlot

**Plateforme de réservation de créneaux sportifs moderne et intuitive.**

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)

---

## 📸 Aperçu

| Client | Admin |
|--------|-------|
| Calendrier de réservation | Gestion des créneaux |
| Filtrage par sport | Mode Vue / Édition |
| Réservation en ligne | Personnalisation complète |

---

## ✨ Fonctionnalités

### 👥 Côté Client
- 📅 **Calendrier interactif** de réservation par semaine
- 🎾 **Filtrage par sport** avec icônes personnalisées
- 📱 **Responsive** - Mobile, tablette et desktop
- 🌍 **Multi-langue** - Français, English, Deutsch
- 📧 **Confirmation par email** (client + équipe)
- ⏰ **Temps réel** - Mise à jour instantanée des disponibilités
- 🔒 **Protection anti-surréservation** - Transactions atomiques

### 🔧 Côté Admin
- 📊 **Vue / Édition** - Consultez ou modifiez l'agenda
- 🗓️ **Glisser-déposer** - Créez, déplacez, redimensionnez les créneaux
- ✏️ **Création par sélection** - Glissez pour définir la durée
- 🏃 **Gestion des sports** - Icônes emoji ou images personnalisées
- 🚫 **Gestion des fermetures** - Jours fériés, vacances, maintenance
- ⏰ **Horaires d'ouverture** - Par jour de la semaine
- 🎨 **Personnalisation** - Logo, couleurs, nom du site, devise
- 📧 **Configuration SMTP** - Emails automatiques
- 🔐 **Authentification sécurisée** - Hashage des mots de passe
- 📋 **Gestion des réservations** - Visualisation et annulation
- 🔔 **Notifications** - Alertes pour nouvelles réservations
- 📤 **Publication** - Contrôlez ce que les clients voient

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
| **Vue** | 👁️ | Consulter l'agenda et les réservations |
| **Édition** | ✏️ | Créer, modifier, supprimer des créneaux |

### Création de Créneaux

1. Passez en mode **Édition**
2. Sélectionnez le mode **Créneau** (📅)
3. **Clic simple** → Créneau avec durée par défaut
4. **Clic + glisser** → Définir la durée manuellement

### Gestion des Créneaux

| Action | Comment |
|--------|---------|
| **Déplacer** | Glissez le créneau vers un autre horaire |
| **Redimensionner** | Tirez le bord haut ou bas du créneau |
| **Modifier** | Cliquez sur le créneau (mode Édition) |
| **Supprimer** | Mode Gomme (🗑️) + clic sur le créneau |

### Publication

Les modifications ne sont **pas visibles** par les clients tant qu'elles ne sont pas publiées :

- 🟠 **Orange** = Non publié (nouveau ou modifié)
- 🟢 **Couleur normale** = Publié et visible
- 🔴 **Rouge** = Hors horaires ou en attente de suppression

Cliquez sur **Publier** pour appliquer les changements.

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
- ✉️ **Équipe** : Notification de nouvelle réservation (en anglais)

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
│   │   ├── page.tsx       # Dashboard
│   │   └── login/         # Connexion
│   └── api/               # API Routes
├── components/            # Composants React
│   └── ui/               # UI (shadcn/ui)
├── lib/                   # Utilitaires
│   ├── config.ts         # Configuration
│   ├── db.ts             # Base de données
│   ├── storage.ts        # LocalStorage
│   └── i18n.ts           # Traductions
├── locales/              # Fichiers de langue
│   ├── fr.json           # 🇫🇷 Français
│   ├── en.json           # 🇬🇧 English
│   └── de.json           # 🇩🇪 Deutsch
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
- ⚠️ **Changez** `HASH_SECRET` en production !

---

## 🌍 Langues

| Langue | Code | Sélection |
|--------|------|-----------|
| 🇫🇷 Français | `fr` | Par défaut ou sélecteur |
| 🇬🇧 English | `en` | Sélecteur haut-droite |
| 🇩🇪 Deutsch | `de` | Sélecteur haut-droite |

La langue admin est configurable dans les paramètres.

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
