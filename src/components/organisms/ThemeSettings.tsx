import { Button } from '../atoms/Button'
import { useTheme } from '../../hooks/useTheme'
import { Check } from 'lucide-react'
import { accents, modes } from '../../services/theme'

export function ThemeSettings() {
  const { theme: mode, accent, setTheme, setAccent } = useTheme()

  return (
    <section className="settings-section" aria-labelledby="theme-settings-title">
      <div>
        <h2 id="theme-settings-title">Themes</h2>
        <p>Choose how Bud looks. Changes apply immediately.</p>
      </div>
      <div className="settings-option">
        <h3 id="theme-mode-label">Colour mode</h3>
        <div className="settings-theme-modes" role="group" aria-labelledby="theme-mode-label">
          {modes.map((item) => (
            <Button
              key={item}
              className="settings-theme-card"
              aria-pressed={item === mode}
              onClick={() => setTheme(item)}
            >
              <span className="settings-theme-preview" data-preview-mode={item} aria-hidden="true">
                <span className="settings-preview-sidebar">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="settings-preview-table">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </span>
              <span className="settings-theme-caption">
                {item}
                <Check size={14} aria-hidden="true" />
              </span>
            </Button>
          ))}
        </div>
      </div>
      <div className="settings-option">
        <h3 id="theme-accent-label">Accent colour</h3>
        <div className="settings-theme-accents" role="group" aria-labelledby="theme-accent-label">
          {accents.map((colour) => (
            <Button
              key={colour}
              className="settings-accent-option"
              data-swatch={colour}
              aria-pressed={colour === accent}
              onClick={() => setAccent(colour)}
            >
              <span className="settings-accent-swatch" aria-hidden="true">
                <Check size={16} />
              </span>
              {colour}
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}
