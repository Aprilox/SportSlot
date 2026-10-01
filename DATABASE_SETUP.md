# 🗄️ Guide de Configuration Base de Données

Ce guide explique comment configurer et utiliser les différents modes de stockage de SportSlot.

---

## 📊 Tableau Comparatif des Modes

| Critère | 🌐 Browser | 💾 Local | ☁️ External |
|---------|-----------|----------|-------------|
| **Persistance** | ❌ Non | ✅ Oui | ✅ Oui |
| **Multi-navigateur** | ❌ Non | ✅ Oui | ✅ Oui |
| **Configuration** | Aucune | Facile | Moyenne |
| **Production** | ❌ Non | ❌ Non | ✅ Oui |
| **Usage** | Démo | Dev | Prod |

---

## 🌐 Mode Browser (DEMO)

### Configuration

```env
STORAGE_MODE=browser
```

### Fonctionnement
- Les données sont stockées dans le `localStorage` du navigateur
- Chaque navigateur a ses propres données
- Les données sont perdues si vous videz le cache

### Quand l'utiliser ?
- ✅ Démonstration rapide
- ✅ Tests fonctionnels
- ✅ Découverte de l'application
- ❌ Jamais en production

---

## 💾 Mode Local (SQLite)

### Configuration

```env
STORAGE_MODE=local
DATABASE_URL="file:./dev.db"
```

### Installation

```bash
# 1. Générer le client Prisma
npx prisma generate

# 2. Créer/synchroniser la base de données
npx prisma db push

# 3. (Optionnel) Voir les données
npx prisma studio
```

### Fonctionnement
- Les données sont stockées dans le fichier `dev.db` à la racine du projet
- Toutes les sessions partagent les mêmes données
- Les données persistent après redémarrage

### Quand l'utiliser ?
- ✅ Développement local
- ✅ Tests avec données persistantes
- ❌ Production (fichier local uniquement)

### Commandes utiles

```bash
# Ouvrir l'interface graphique de la DB
pnpm db:studio

# Réinitialiser la base de données
pnpm db:reset

# Voir le contenu de la DB
npx prisma studio
```

---

## ☁️ Mode External (Production)

### Configuration PostgreSQL

```env
STORAGE_MODE=external
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

### Configuration MySQL

```env
STORAGE_MODE=external
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DATABASE"
```

### Installation

```bash
# 1. Générer le client Prisma
npx prisma generate

# 2. Appliquer le schéma à la base distante
npx prisma db push
```

### Services Gratuits Recommandés

#### 🐘 PostgreSQL

| Service | URL | Gratuit |
|---------|-----|---------|
| Supabase | https://supabase.com | ✅ 500 MB |
| Neon | https://neon.tech | ✅ 512 MB |
| Railway | https://railway.app | ✅ 1 GB |
| Render | https://render.com | ✅ 1 GB |

#### 🐬 MySQL

| Service | URL | Gratuit |
|---------|-----|---------|
| PlanetScale | https://planetscale.com | ✅ 5 GB |
| Railway | https://railway.app | ✅ 1 GB |

### Exemple avec Supabase

1. Créez un compte sur https://supabase.com
2. Créez un nouveau projet
3. Allez dans **Settings > Database**
4. Copiez la **Connection string (URI)**
5. Remplacez `[YOUR-PASSWORD]` par votre mot de passe
6. Collez dans votre `.env`

```env
STORAGE_MODE=external
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres"
```

---

## 🔄 Migration entre Modes

### De Browser vers Local/External

Si vous avez des données en mode Browser que vous voulez conserver :

1. Ouvrez la console du navigateur (F12)
2. Exécutez ce script pour exporter les données :

```javascript
// Copier les données du localStorage
const data = {
  settings: localStorage.getItem('sportslot_settings'),
  sports: localStorage.getItem('sportslot_sports'),
  slots: localStorage.getItem('sportslot_slots'),
  bookings: localStorage.getItem('sportslot_bookings'),
  adminCredentials: localStorage.getItem('sportslot_admin_credentials')
};
console.log(JSON.stringify(data, null, 2));
```

3. Configurez le nouveau mode dans `.env`
4. Relancez le serveur
5. Utilisez l'API de migration :

```javascript
// Dans la console du navigateur
fetch('/api/migrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    settings: JSON.parse(localStorage.getItem('sportslot_settings')),
    sports: JSON.parse(localStorage.getItem('sportslot_sports')),
    slots: JSON.parse(localStorage.getItem('sportslot_slots')),
    bookings: JSON.parse(localStorage.getItem('sportslot_bookings')),
    adminCredentials: JSON.parse(localStorage.getItem('sportslot_admin_credentials'))
  })
}).then(r => r.json()).then(console.log);
```

---

## 🔧 Dépannage

### Erreur : "Cannot find module '@prisma/client'"

```bash
npx prisma generate
```

### Erreur : "Database does not exist"

```bash
npx prisma db push
```

### Erreur : "Foreign key constraint violated"

Les données importées référencent des éléments qui n'existent pas. Importez d'abord les sports, puis les créneaux, puis les réservations.

### Réinitialiser complètement la DB

```bash
# Supprimer et recréer
pnpm db:reset

# Ou manuellement (SQLite)
rm prisma/dev.db
npx prisma db push
```

### Voir les données de la DB

```bash
npx prisma studio
```

Ouvre une interface web sur http://localhost:5555

---

## 📁 Structure des Données

### Settings
Configuration générale (branding, horaires, SMTP...)

### Sport
Sports disponibles (nom, icône, couleur, prix par défaut)

### TimeSlot
Créneaux horaires (date, heure, sports associés, capacité, prix)

### Booking
Réservations (client, créneau, nombre de personnes)

### AdminCredentials
Identifiants admin (hashés en mode DB)

### ClosedPeriod
Périodes de fermeture (vacances, jours fériés)

---

## 🔐 Sécurité

### Mode Browser
- ⚠️ Mot de passe admin stocké en clair dans localStorage
- ❌ Ne jamais utiliser en production

### Mode Local/External
- ✅ Mot de passe admin hashé avec bcrypt
- ✅ Authentification côté serveur
- ✅ Prêt pour la production

### Bonnes pratiques
1. Changez le `HASH_SECRET` en production
2. Utilisez des mots de passe forts
3. Activez SSL pour les connexions DB externes
4. Faites des backups réguliers
