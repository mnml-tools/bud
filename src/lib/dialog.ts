import type { MouseEvent } from 'react'

export function isDialogBackdropClick(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget || event.detail === 0) return false

  const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()

  return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom
}
