import type { SavedRepository } from '../types/git.ts'

export const repositoryColors = [
  { name: 'Pink', value: '#db4aa6' },
  { name: 'Blue', value: '#1d8dba' },
  { name: 'Orange', value: '#f2571d' },
  { name: 'Green', value: '#0d8a4b' },
  { name: 'Purple', value: '#986dc4' },
  { name: 'Red', value: '#dc4b50' },
  { name: 'Yellow', value: '#d6ab23' },
  { name: 'Emerald', value: '#16a085' },
  { name: 'Indigo', value: '#6065c9' },
  { name: 'Cyan', value: '#10b9cc' },
  { name: 'Lettuce', value: '#8bbd35' }
] as const

export function repositoryColor(repository: Pick<SavedRepository, 'path' | 'avatarColor'>): string {
  if (repositoryColors.some((color) => color.value === repository.avatarColor)) return repository.avatarColor!

  let hash = 0
  for (const char of repository.path) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0

  return repositoryColors[hash % repositoryColors.length].value
}

export function nextRepositoryColor(repositories: SavedRepository[]): string {
  const counts = new Map<string, number>(repositoryColors.map((color) => [color.value, 0]))
  repositories.forEach((repository) => {
    const color = repositoryColor(repository)
    counts.set(color, (counts.get(color) ?? 0) + 1)
  })

  return repositoryColors.reduce(
    (best, color) => (counts.get(color.value)! < counts.get(best.value)! ? color : best),
    repositoryColors[3]
  ).value
}
