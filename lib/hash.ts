/**
 * Utilitaires de hashage sécurisé pour les mots de passe
 * Utilise bcryptjs (compatible navigateur et Node.js)
 */

// Note: bcryptjs est plus léger et fonctionne côté client aussi
// Pour la production, utilisez bcrypt côté serveur uniquement

const SALT_ROUNDS = 10

/**
 * Hash un mot de passe de manière sécurisée
 * @param password - Mot de passe en clair
 * @returns Mot de passe hashé
 */
export async function hashPassword(password: string): Promise<string> {
  // Import dynamique pour éviter les problèmes côté client
  if (typeof window !== 'undefined') {
    // Côté client: utiliser un hash simple (pour le mode localStorage uniquement)
    // En production avec DB, le hashage se fait côté serveur
    return simpleHash(password)
  }
  
  try {
    const bcrypt = await import('bcryptjs')
    const salt = await bcrypt.genSalt(SALT_ROUNDS)
    return await bcrypt.hash(password, salt)
  } catch {
    // Fallback si bcrypt n'est pas disponible
    console.warn('bcryptjs non disponible, utilisation du hash simple')
    return simpleHash(password)
  }
}

/**
 * Vérifie un mot de passe contre son hash
 * @param password - Mot de passe en clair
 * @param hash - Hash à comparer
 * @returns true si le mot de passe correspond
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Si le hash commence par $2, c'est un hash bcrypt
  if (hash.startsWith('$2')) {
    try {
      const bcrypt = await import('bcryptjs')
      return await bcrypt.compare(password, hash)
    } catch {
      return false
    }
  }
  
  // Sinon, c'est un hash simple ou un mot de passe en clair (migration)
  // Vérifier le hash simple
  if (hash.startsWith('simple:')) {
    return simpleHash(password) === hash
  }
  
  // Compatibilité: mot de passe stocké en clair (ancienne version)
  return password === hash
}

/**
 * Hash simple pour le mode localStorage (côté client)
 * NOTE: Ce n'est PAS sécurisé pour la production avec DB !
 * Utilisé uniquement pour le développement local
 */
function simpleHash(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Ajouter un préfixe pour identifier ce type de hash
  return `simple:${Math.abs(hash).toString(16)}`
}

/**
 * Vérifie si un hash est un hash bcrypt (sécurisé)
 */
export function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2')
}

/**
 * Vérifie si le mot de passe doit être migré vers bcrypt
 */
export function needsMigration(hash: string): boolean {
  // Migrer si ce n'est pas un hash bcrypt
  return !isBcryptHash(hash)
}



