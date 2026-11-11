import { RepositoryAvatar } from '../atoms/RepositoryAvatar'
import { useEffect, useRef, useState } from 'react'
import { Search, CloudDownload, FolderOpen } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { SavedRepository } from '../../types/git'

type Props = {
  id: string
  repository: SavedRepository
  repositories: SavedRepository[]
  trigger?: HTMLButtonElement
  onDismiss: () => void
  onSelect: (repository: SavedRepository) => void
  label?: string
  onOpenLocal?: () => void
  onClone?: () => void
  emptyMessage?: string
}

export function RepositorySelectorMenu({
  id,
  repository,
  repositories,
  trigger,
  onDismiss,
  onSelect,
  label = 'Switch repository',
  onOpenLocal,
  onClone,
  emptyMessage = 'No other saved repositories.'
}: Props) {
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const available = repositories.filter(
    (item) =>
      item.path !== repository.path && `${item.name} ${item.path}`.toLowerCase().includes(search.trim().toLowerCase())
  )
  const active = available[activeIndex] ?? available[0]
  const choose = (item: SavedRepository) => {
    onDismiss()
    trigger?.focus()
    onSelect(item)
  }
  const menu = useRef<HTMLDivElement>(null)
  const rect = trigger?.getBoundingClientRect()
  const width = Math.min(400, window.innerWidth - 24)
  const left = Math.max(
    12,
    Math.min((rect ? rect.left + rect.width / 2 : window.innerWidth / 2) - width / 2, window.innerWidth - width - 12)
  )

  useEffect(() => {
    input.current?.focus()

    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger?.contains(event.target as Node)) onDismiss()
    }
    window.addEventListener('pointerdown', outside)
    window.addEventListener('resize', onDismiss)

    return () => {
      window.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', onDismiss)
    }
  }, [trigger, onDismiss])

  useEffect(() => {
    if (active)
      document.getElementById(`${id}-option-${encodeURIComponent(active.path)}`)?.scrollIntoView({ block: 'nearest' })
  }, [active?.path, id])

  return createPortal(
    <div
      ref={menu}
      id={id}
      className="repository-selector-menu"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={{
        left: rect ? left : '50%',
        top: rect ? rect.bottom + 8 : '50%',
        transform: rect ? undefined : 'translate(-50%, -50%)',
        width,
        maxHeight: rect ? Math.max(120, window.innerHeight - rect.bottom - 24) : window.innerHeight - 24
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return
        if (
          event.target instanceof HTMLButtonElement &&
          event.target.dataset.repositoryAction &&
          event.key !== 'Escape'
        )
          return

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          if (available.length) {
            setActiveIndex(
              (index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + available.length) % available.length
            )
          }
        } else if (event.key === 'Enter') {
          event.preventDefault()
          if (active && !event.repeat) choose(active)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          onDismiss()
          trigger?.focus()
        } else if (event.key === 'Tab' && !onOpenLocal && !onClone) {
          onDismiss()
          trigger?.focus()
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) onDismiss()
      }}
    >
      <div className="repository-selector-menu-heading">
        <span>{label}</span>
        <span>{available.length} available</span>
      </div>
      <label className="repository-selector-search">
        <Search size={14} aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-label="Search repositories"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={`${id}-results`}
          aria-activedescendant={active ? `${id}-option-${encodeURIComponent(active.path)}` : undefined}
          placeholder="Search repositories…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setActiveIndex(0)
          }}
        />
      </label>
      <div id={`${id}-results`} role="listbox" aria-label="Available repositories">
        {available.map((item, index) => (
          <button
            key={item.path}
            type="button"
            id={`${id}-option-${encodeURIComponent(item.path)}`}
            role="option"
            aria-selected={active?.path === item.path}
            tabIndex={-1}
            className="repository-selector-option"
            onPointerMove={() => setActiveIndex(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(item)}
          >
            <RepositoryAvatar repository={item} />
            <span className="repository-selector-details">
              <strong>{item.name}</strong>
              <span>{item.path}</span>
            </span>
          </button>
        ))}
      </div>
      {!available.length && (
        <p className="repository-selector-menu-footer" role="status">
          {search ? 'No matching repositories.' : emptyMessage}
        </p>
      )}
      {(onOpenLocal || onClone) && (
        <div className="repository-selector-actions">
          {onOpenLocal && (
            <button
              type="button"
              data-repository-action="open"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onDismiss()
                onOpenLocal()
              }}
            >
              <FolderOpen size={14} /> Open local repository
            </button>
          )}
          {onClone && (
            <button
              type="button"
              data-repository-action="clone"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onDismiss()
                onClone()
              }}
            >
              <CloudDownload size={14} /> Clone from origin
            </button>
          )}
        </div>
      )}
      <div className="repository-selector-menu-footer">Switch repositories without changing files</div>
    </div>,
    document.body
  )
}
