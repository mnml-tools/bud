import { Button } from '../atoms/Button'
import { GitDialog } from './GitDialog'

export function GitErrorDialog({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <GitDialog title="Git operation failed" onDismiss={onDismiss}>
      <p className="git-error-message" role="alert">
        {message}
      </p>
      <div className="discard-actions">
        <Button type="button" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </GitDialog>
  )
}
