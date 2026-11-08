export function NoticeToast({ message }: { message: string }) {
  return (
    <div className="git-notice-toast" role="status" aria-live="polite" aria-atomic="true">
      <span>{message}</span>
      <div className="git-notice-countdown" aria-hidden="true" />
    </div>
  )
}
