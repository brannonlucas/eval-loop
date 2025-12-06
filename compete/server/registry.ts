/**
 * Challenge Registry
 *
 * Manages external repository challenge references.
 * Stores mappings in compete/challenges/.external.json
 */

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const CHALLENGES_DIR = join(process.cwd(), 'compete/challenges')
const REGISTRY_PATH = join(CHALLENGES_DIR, '.external.json')

export interface ExternalRegistry {
  [challengeName: string]: string // name -> absolute path
}

/**
 * Load the external challenge registry
 */
export async function loadRegistry(): Promise<ExternalRegistry> {
  try {
    const data = await readFile(REGISTRY_PATH, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

/**
 * Save the external challenge registry
 */
export async function saveRegistry(registry: ExternalRegistry): Promise<void> {
  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2))
}

/**
 * Register an external challenge
 */
export async function registerExternal(name: string, path: string): Promise<void> {
  const registry = await loadRegistry()
  registry[name] = path
  await saveRegistry(registry)
}

/**
 * Unregister an external challenge
 */
export async function unregisterExternal(name: string): Promise<boolean> {
  const registry = await loadRegistry()
  if (!(name in registry)) return false
  delete registry[name]
  await saveRegistry(registry)
  return true
}

/**
 * Check if a challenge is external
 */
export async function isExternal(name: string): Promise<boolean> {
  const registry = await loadRegistry()
  return name in registry
}

/**
 * Resolve a challenge name to its path
 * Returns the external path if registered, otherwise the local path
 */
export async function resolveChallengePath(name: string): Promise<string> {
  const registry = await loadRegistry()
  if (name in registry) {
    return registry[name]
  }
  // Check adhoc directory
  const adhocPath = join(CHALLENGES_DIR, '.adhoc', name)
  try {
    const { stat } = await import('fs/promises')
    await stat(adhocPath)
    return adhocPath
  } catch {
    // Not in adhoc, use standard path
  }
  return join(CHALLENGES_DIR, name)
}

/**
 * Get all external challenge entries
 */
export async function getExternalChallenges(): Promise<Array<{ name: string; path: string }>> {
  const registry = await loadRegistry()
  return Object.entries(registry).map(([name, path]) => ({ name, path }))
}
