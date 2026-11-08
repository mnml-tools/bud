import type { ReactNode } from 'react'
import { useSidebarResize } from '../../hooks/useSidebarResize'
import { SidebarResizeHandle } from '../molecules/SidebarResizeHandle'

export function ResizableSidebar({ children }: { children: ReactNode }) {
  const resize = useSidebarResize()

  return (
    <aside id="branch-sidebar" className="resizable-sidebar" style={{ width: resize.width }}>
      {children}
      <SidebarResizeHandle {...resize} />
    </aside>
  )
}
