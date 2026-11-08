import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function createManifest(directory, repository, tag, version) {
  if (tag !== `v${version}`) throw new Error(`Tag ${tag} does not match app version ${version}`)

  const files = readdirSync(directory)
  const platforms = {}
  const add = (suffix, targets) => {
    const matches = files.filter((file) => file.endsWith(suffix))
    if (matches.length !== 1) throw new Error(`Expected one ${suffix} artifact, found ${matches.length}`)

    const file = matches[0]
    const signature = readFileSync(join(directory, `${file}.sig`), 'utf8').trim()
    if (!signature) throw new Error(`Empty signature for ${file}`)

    for (const target of targets) {
      platforms[target] = {
        url: `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(file)}`,
        signature
      }
    }
  }

  add('.AppImage', ['linux-x86_64'])
  add('.app.tar.gz', ['darwin-aarch64', 'darwin-x86_64'])

  return { version, platforms }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const [directory, repository, tag] = process.argv.slice(2)
  const { version } = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
  writeFileSync(join(directory, 'latest.json'), JSON.stringify(createManifest(directory, repository, tag, version), null, 2) + '\n')
}
