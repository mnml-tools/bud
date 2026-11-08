import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { repositoryColors } from '../../lib/repositoryAvatar'
import { RepositoryAvatar } from '../atoms/RepositoryAvatar'

export function RepositoryAvatarPicker({
  name,
  value,
  onChange
}: {
  name: string
  value: string
  onChange: (color: string) => void
}) {
  return (
    <fieldset className="avatar-picker full">
      <legend>Avatar colour</legend>
      <div className="avatar-picker-content">
        <RepositoryAvatar repository={{ name, path: '', avatarColor: value }} />
        <div className="avatar-swatches" role="group" aria-label="Avatar colour">
          {repositoryColors.map((color) => (
            <button
              key={color.value}
              type="button"
              title={color.name}
              aria-label={color.name}
              aria-pressed={value === color.value}
              style={{ '--swatch-color': color.value } as CSSProperties}
              onClick={() => onChange(color.value)}
            >
              {value === color.value && <Check size={13} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  )
}
