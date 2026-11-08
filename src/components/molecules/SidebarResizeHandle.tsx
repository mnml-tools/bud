import type { useSidebarResize } from '../../hooks/useSidebarResize'

type Props = ReturnType<typeof useSidebarResize> & { label?: string; controls?: string }

export function SidebarResizeHandle({
  width,
  minimum,
  maximum,
  dragging,
  edge,
  handlers,
  label = 'Resize sidebar',
  controls = 'branch-sidebar'
}: Props) {
  return (
    <div
      role="separator"
      aria-label={label}
      aria-controls={controls}
      aria-orientation="vertical"
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels`}
      tabIndex={0}
      className={`sidebar-resizer ${edge === 'left' ? 'left-edge' : ''} ${dragging ? 'dragging' : ''}`}
      {...handlers}
    />
  )
}
