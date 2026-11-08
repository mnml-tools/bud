import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileCog,
  FileImage,
  FileJson2,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType2,
  FileVideo
} from 'lucide-react'

export function ChangedFileIcon({ path }: { path: string }) {
  const name = path.split('/').pop()!.toLowerCase()
  const extension = name.split('.').pop()!
  const Icon = /^(json|jsonc|json5)$/.test(extension)
    ? FileJson2
    : /^(ts|tsx|js|jsx|mjs|cjs|rs|py|go|rb|java|c|cpp|h|swift|html|css|scss|vue|svelte|sql)$/.test(extension)
      ? FileCode2
      : /^(png|jpg|jpeg|gif|webp|svg|ico|avif|heic)$/.test(extension)
        ? FileImage
        : /^(md|mdx|txt|rst|pdf)$/.test(extension)
          ? FileText
          : /^(yaml|yml|toml|ini|conf|config|env|lock)$/.test(extension) || name.startsWith('.env')
            ? FileCog
            : /^(sh|bash|zsh|fish|bat|ps1)$/.test(extension) || name === 'dockerfile'
              ? FileTerminal
              : /^(csv|tsv|xlsx|xls)$/.test(extension)
                ? FileSpreadsheet
                : /^(zip|gz|tar|7z|rar)$/.test(extension)
                  ? FileArchive
                  : /^(mp3|wav|ogg|flac)$/.test(extension)
                    ? FileAudio
                    : /^(mp4|mov|webm)$/.test(extension)
                      ? FileVideo
                      : /^(woff|woff2|ttf|otf)$/.test(extension)
                        ? FileType2
                        : File

  return <Icon size={14} aria-hidden="true" />
}
