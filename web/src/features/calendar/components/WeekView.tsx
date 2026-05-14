import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import type { Task } from '../../../types'
import { effectiveStatus, hexToRgb } from '../../../lib/colors'
import { TaskContextMenu } from './TaskContextMenu'

export interface CalendarTask extends Task {
  project_name?: string
}

export interface WeekViewProps {
  currentDate: Date
  tasks: CalendarTask[]
  onTaskMove: (taskId: string, newStart: Date, durationMinutes?: number) => void
  onTaskResize: (taskId: string, newStart: Date, newDuration: number) => void
  onTaskClick: (taskId: string) => void
  onEmptySlotClick: (date: Date) => void
  draggedTaskId: string | null
  onDropTask: (taskId: string, date: Date) => void
  onTaskStatusChange: (taskId: string, status: 'todo' | 'done' | 'postponed') => void
  onDeleteTask: (taskId: string) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)  // 00:00–23:00
const GUTTER_PX = 48
const MOVE_THRESHOLD = 6

// Discrete zoom levels: visible hours [5..24], step = 1h per scroll event
const ZOOM_STEPS_H    = Array.from({ length: 20 }, (_, i) => i + 5)
const DEFAULT_ZOOM_IDX = 7   // 12 hours visible by default
const ZOOM_EASE        = 0.12

type Interaction =
  | {
      kind: 'move'
      task: CalendarTask
      offsetMin: number
      startX: number
      startY: number
      moved: boolean
      previewDayIdx: number
      previewMin: number
    }
  | {
      kind: 'resize'
      task: CalendarTask
      dir: 'top' | 'bottom'
      origStart: Date
      origDuration: number
      moved: boolean
      previewStart: Date
      previewDuration: number
    }

function computeLayout(tasksForDay: CalendarTask[]): Map<string, { leftFrac: number; widthFrac: number }> {
  const result = new Map<string, { leftFrac: number; widthFrac: number }>()
  if (!tasksForDay.length) return result

  const sorted = [...tasksForDay].sort(
    (a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime()
  )

  function overlaps(a: CalendarTask, b: CalendarTask) {
    const aStart = new Date(a.scheduled_date!).getTime()
    const aEnd = aStart + (a.duration_minutes ?? 60) * 60_000
    const bStart = new Date(b.scheduled_date!).getTime()
    const bEnd = bStart + (b.duration_minutes ?? 60) * 60_000
    return aStart < bEnd && bStart < aEnd
  }

  const n = sorted.length
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (overlaps(sorted[i], sorted[j])) {
        adj[i].push(j)
        adj[j].push(i)
      }
    }
  }

  const visited = new Array(n).fill(false)
  for (let start = 0; start < n; start++) {
    if (visited[start]) continue

    const component: number[] = []
    const queue = [start]
    visited[start] = true
    while (queue.length) {
      const node = queue.shift()!
      component.push(node)
      for (const nb of adj[node]) {
        if (!visited[nb]) { visited[nb] = true; queue.push(nb) }
      }
    }

    const componentTasks = component.map(i => sorted[i])
    const laneEnds: number[] = []
    const laneMap = new Map<string, number>()

    for (const task of componentTasks) {
      const startMs = new Date(task.scheduled_date!).getTime()
      const endMs = startMs + (task.duration_minutes ?? 60) * 60_000
      let lane = laneEnds.findIndex(e => e < startMs)
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(endMs) }
      else { laneEnds[lane] = endMs }
      laneMap.set(task.id, lane)
    }

    const totalLanes = laneEnds.length
    for (const task of componentTasks) {
      const lane = laneMap.get(task.id)!
      result.set(task.id, { leftFrac: lane / totalLanes, widthFrac: 1 / totalLanes })
    }
  }

  return result
}

function getDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function WeekView({
  currentDate, tasks, onTaskMove, onTaskResize, onTaskClick,
  onEmptySlotClick, draggedTaskId, onDropTask, onTaskStatusChange, onDeleteTask,
}: WeekViewProps) {
  const startOfWeek = new Date(currentDate)
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
  startOfWeek.setDate(diff)

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      return d
    })
  }, [startOfWeek])

  const getDayName = (date: Date) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(date.getDay() + 6) % 7]
  const isToday = (date: Date) => getDateString(date) === getDateString(new Date())

  const bodyRef = useRef<HTMLDivElement>(null)
  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const interRef = useRef<Interaction | null>(null)
  const justInteractedRef = useRef(false)
  const [rowHeightPx, setRowHeightPx] = useState(() => {
    const vh = window.innerHeight
    return vh / ZOOM_STEPS_H[DEFAULT_ZOOM_IDX]
  })
  const currentRHRef  = useRef(window.innerHeight / ZOOM_STEPS_H[DEFAULT_ZOOM_IDX])
  const targetRHRef   = useRef(window.innerHeight / ZOOM_STEPS_H[DEFAULT_ZOOM_IDX])
  const animFrameRef  = useRef<number | null>(null)
  const scrollLockRef = useRef<{ ratio: number; viewportY: number } | null>(null)
  const zoomIdxRef    = useRef(DEFAULT_ZOOM_IDX)
  const viewportHRef  = useRef(window.innerHeight)
  const scrollRef     = useRef<HTMLDivElement>(null)
  const headerRef     = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(new Date())
  const [contextMenu, setContextMenu] = useState<{
    task: CalendarTask
    x: number
    y: number
  } | null>(null)
  const [slotMenu, setSlotMenu] = useState<{ x: number; y: number; date: Date } | null>(null)
  const slotMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!slotMenu) return
    function handler(e: MouseEvent) {
      if (slotMenuRef.current && !slotMenuRef.current.contains(e.target as Node)) setSlotMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [slotMenu])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  function gridVH(): number {
    const scrollH = scrollRef.current?.getBoundingClientRect().height ?? window.innerHeight
    const headerH = headerRef.current?.offsetHeight ?? 0
    return scrollH - headerH
  }

  // Sync viewport height once after mount using actual available grid area
  useEffect(() => {
    const vh = gridVH()
    if (!vh) return
    viewportHRef.current = vh
    const rh = vh / ZOOM_STEPS_H[DEFAULT_ZOOM_IDX]
    currentRHRef.current = rh
    targetRHRef.current = rh
    applyZoomLayout(rh)
    setRowHeightPx(rh)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update layout on window resize
  useEffect(() => {
    function onResize() {
      const vh = gridVH()
      if (!vh) return
      viewportHRef.current = vh
      const rh = vh / ZOOM_STEPS_H[zoomIdxRef.current]
      currentRHRef.current = rh
      targetRHRef.current = rh
      applyZoomLayout(rh)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      if (interRef.current !== null) return  // don't zoom while dragging/resizing
      e.preventDefault()

      const rect = el!.getBoundingClientRect()
      const viewportY = e.clientY - rect.top
      const ratio = (el!.scrollTop + viewportY) / (HOURS.length * currentRHRef.current)

      scrollLockRef.current = { ratio, viewportY }
      const newIdx = Math.max(0, Math.min(ZOOM_STEPS_H.length - 1,
        e.deltaY < 0 ? zoomIdxRef.current - 1 : zoomIdxRef.current + 1
      ))
      if (newIdx === zoomIdxRef.current) return
      zoomIdxRef.current = newIdx
      targetRHRef.current = viewportHRef.current / ZOOM_STEPS_H[newIdx]
      animFrameRef.current = null
      startAnimate()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])   // empty deps — scrollRef.current is stable after mount

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>()
    for (const task of tasks) {
      if (!task.scheduled_date) continue
      const date = task.scheduled_date.split('T')[0]
      const list = map.get(date) ?? []
      list.push(task)
      map.set(date, list)
    }
    return map
  }, [tasks])

  function pxPerMin(): number {
    if (!bodyRef.current) return viewportHRef.current / ZOOM_STEPS_H[zoomIdxRef.current] / 60
    return bodyRef.current.offsetHeight / (HOURS.length * 60)
  }

  function snap15(min: number) { return Math.round(min / 15) * 15 }

  function getDayIdxFromX(mouseX: number): number {
    if (!bodyRef.current) return 0
    const rect = bodyRef.current.getBoundingClientRect()
    const colWidth = (rect.width - GUTTER_PX) / 7
    return Math.max(0, Math.min(6, Math.floor((mouseX - rect.left - GUTTER_PX) / colWidth)))
  }

  function getMinFromY(mouseY: number): number {
    if (!bodyRef.current) return HOURS[0] * 60
    const rect = bodyRef.current.getBoundingClientRect()
    const raw = HOURS[0] * 60 + (mouseY - rect.top) / pxPerMin()
    return Math.max(HOURS[0] * 60, Math.min(23 * 60, raw))
  }

  function handleMoveStart(e: React.MouseEvent, task: CalendarTask) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const start = new Date(task.scheduled_date!)
    const taskTopMin = start.getHours() * 60 + start.getMinutes()
    const offsetMin = (e.clientY - (bodyRef.current?.getBoundingClientRect().top ?? 0)) / pxPerMin() - (taskTopMin - HOURS[0] * 60)
    const state: Interaction = {
      kind: 'move', task,
      offsetMin: Math.max(0, offsetMin),
      startX: e.clientX, startY: e.clientY,
      moved: false,
      previewDayIdx: getDayIdxFromX(e.clientX),
      previewMin: taskTopMin,
    }
    interRef.current = state
    setInteraction(state)
  }

  function handleResizeStart(e: React.MouseEvent, task: CalendarTask, dir: 'top' | 'bottom') {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const start = new Date(task.scheduled_date!)
    const duration = task.duration_minutes ?? 60
    const state: Interaction = {
      kind: 'resize', task, dir,
      origStart: start, origDuration: duration,
      moved: false, previewStart: start, previewDuration: duration,
    }
    interRef.current = state
    setInteraction(state)
  }

  const handleMouseUp = useCallback(() => {
    const cur = interRef.current
    if (!cur) return

    if (cur.kind === 'move') {
      if (cur.moved && onTaskMove) {
        const newStart = new Date(weekDays[cur.previewDayIdx])
        newStart.setHours(Math.floor(cur.previewMin / 60), cur.previewMin % 60, 0, 0)
        onTaskMove(cur.task.id, newStart, cur.task.duration_minutes)
      } else if (!cur.moved) {
        onTaskClick(cur.task.id)
      }
    } else if (cur.moved && onTaskResize) {
      onTaskResize(cur.task.id, cur.previewStart, cur.previewDuration)
    }

    interRef.current = null
    setInteraction(null)
    justInteractedRef.current = true
    setTimeout(() => { justInteractedRef.current = false }, 0)
  }, [weekDays, onTaskMove, onTaskResize, onTaskClick])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const cur = interRef.current
      if (!cur) return

      if (cur.kind === 'move') {
        const dx = Math.abs(e.clientX - cur.startX)
        const dy = Math.abs(e.clientY - cur.startY)
        const moved = cur.moved || dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD
        const rawMin = getMinFromY(e.clientY) - cur.offsetMin
        const previewMin = snap15(Math.max(HOURS[0] * 60, Math.min(23 * 60 - 15, rawMin)))
        const next: Interaction = { ...cur, moved, previewDayIdx: getDayIdxFromX(e.clientX), previewMin }
        interRef.current = next
        setInteraction(next)
      } else {
        const absoluteMin = getMinFromY(e.clientY)
        let previewStart = cur.origStart
        let previewDuration = cur.origDuration

        if (cur.dir === 'bottom') {
          const origStartMin = cur.origStart.getHours() * 60 + cur.origStart.getMinutes()
          previewDuration = Math.max(15, snap15(absoluteMin) - origStartMin)
        } else {
          const origEndMin = cur.origStart.getHours() * 60 + cur.origStart.getMinutes() + cur.origDuration
          const newStartMin = Math.max(HOURS[0] * 60, snap15(Math.min(origEndMin - 15, absoluteMin)))
          previewDuration = origEndMin - newStartMin
          previewStart = new Date(cur.origStart)
          previewStart.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0)
        }

        const moved = cur.moved || previewDuration !== cur.origDuration || previewStart.getTime() !== cur.origStart.getTime()
        const next: Interaction = { ...cur, moved, previewStart, previewDuration }
        interRef.current = next
        setInteraction(next)
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseUp])

  const rh = rowHeightPx
  const totalH = HOURS.length * rh
  const movePreview = interaction?.kind === 'move' && interaction.moved ? interaction : null
  const moveDateStr = movePreview ? getDateString(weekDays[movePreview.previewDayIdx]) : null
  const isAnyInteraction = interaction !== null

  function applyZoomLayout(rh: number) {
    const body = bodyRef.current
    if (!body) return

    // body total height
    body.style.height = `${HOURS.length * rh}px`

    // hour gutter labels
    body.querySelectorAll<HTMLElement>('[data-hour]').forEach(el => {
      const h = parseInt(el.dataset.hour!, 10)
      el.style.top = `${(h - HOURS[0]) * rh}px`
    })

    // grid lines (all columns)
    body.querySelectorAll<HTMLElement>('[data-gridline]').forEach(el => {
      const h = parseInt(el.dataset.gridline!, 10)
      el.style.top = `${(h - HOURS[0]) * rh}px`
    })

    // current time indicators
    const _now = new Date()
    const nowMin = _now.getHours() * 60 + _now.getMinutes()
    const nowInRange = nowMin >= HOURS[0] * 60 && nowMin <= (HOURS[HOURS.length - 1] + 1) * 60
    body.querySelectorAll<HTMLElement>('[data-timeindicator]').forEach(el => {
      el.style.top = nowInRange ? `${(nowMin - HOURS[0] * 60) / 60 * rh}px` : '-9999px'
    })

    // task cards
    body.querySelectorAll<HTMLElement>('[data-taskcard]').forEach(el => {
      const startMin = parseFloat(el.dataset.taskStartMin!)
      const durMin   = parseFloat(el.dataset.taskDurMin!)
      el.style.top    = `${startMin / 60 * rh}px`
      el.style.height = `${Math.max(durMin / 60 * rh, rh > 20 ? 18 : 8)}px`
    })
  }

  function startAnimate() {
    // Callers that want to restart mid-animation must set animFrameRef.current = null first.
    if (animFrameRef.current !== null) return

    function tick() {
      const diff = targetRHRef.current - currentRHRef.current
      if (Math.abs(diff) < 0.15) {
        currentRHRef.current = targetRHRef.current
        applyZoomLayout(currentRHRef.current)
        maintainAnchor()
        setRowHeightPx(currentRHRef.current)   // sync React state once at end
        scrollLockRef.current = null
        animFrameRef.current = null
        return
      }
      currentRHRef.current += diff * ZOOM_EASE
      applyZoomLayout(currentRHRef.current)
      maintainAnchor()
      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
  }

  function maintainAnchor() {
    const scroll = scrollRef.current
    const lock   = scrollLockRef.current
    if (!scroll || !lock) return
    scroll.scrollTop = Math.max(0, lock.ratio * HOURS.length * currentRHRef.current - lock.viewportY)
  }

  const visibleHours = Math.max(5, Math.min(24, Math.round(viewportHRef.current / rowHeightPx)))
  const zoomBarPct = 1 - (visibleHours - 5) / 19

  function handleBarPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    const track = e.currentTarget
    track.setPointerCapture(e.pointerId)

    function move(ev: PointerEvent) {
      const rect = track.getBoundingClientRect()
      const pct  = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      // left = zoomed out (24h), right = zoomed in (5h)
      const newIdx = Math.round((1 - pct) * (ZOOM_STEPS_H.length - 1))
      if (newIdx === zoomIdxRef.current) return
      zoomIdxRef.current = newIdx
      const vh = viewportHRef.current
      scrollLockRef.current = null
      targetRHRef.current   = vh / ZOOM_STEPS_H[newIdx]
      animFrameRef.current  = null
      startAnimate()
    }

    function up() {
      track.removeEventListener('pointermove', move as EventListener)
      track.removeEventListener('pointerup', up)
      track.removeEventListener('pointercancel', up)
      track.releasePointerCapture(e.pointerId)
    }

    // Seek on initial click (no drag needed)
    move(e.nativeEvent)

    track.addEventListener('pointermove', move as EventListener)
    track.addEventListener('pointerup', up)
    track.addEventListener('pointercancel', up)
  }

  const currentTimeMin = now.getHours() * 60 + now.getMinutes()
  const isWithinRange = currentTimeMin >= HOURS[0] * 60 && currentTimeMin <= (HOURS[HOURS.length - 1] + 1) * 60
  const currentTimeTopPx = isWithinRange ? (currentTimeMin - HOURS[0] * 60) / 60 * rh : -1

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto"
      style={{
        userSelect: isAnyInteraction ? 'none' : undefined,
        background: '#0f0f11',
      }}
    >
      <div className="min-w-[700px]">
        <div ref={headerRef} className="sticky top-0 z-10 flex bg-[#141416] border-b border-[#2b2b2f] shadow-sm">
          <div className="w-12 shrink-0" />
          {weekDays.map(day => {
            const today = isToday(day)
            const dayNum = day.getDate()
            return (
              <div key={getDateString(day)} className="flex-1 p-3 text-center">
                <div className="text-[10px] text-[#6a6660] uppercase tracking-wider font-medium">
                  {getDayName(day)}
                </div>
                <div
                  className="mt-0.5 flex items-center justify-center transition-colors duration-150"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    fontSize: '16px',
                    fontWeight: 600,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    background: today ? 'linear-gradient(135deg, #c4913a, #d4a44e)' : 'transparent',
                    color: today ? '#0c0c0d' : '#edeae2',
                    boxShadow: today ? '0 2px 8px rgba(196,145,58,0.35)' : 'none',
                  }}
                >
                  {dayNum}
                </div>
              </div>
            )
          })}

          {/* Zoom bar */}
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 10px', userSelect: 'none',
          }}>
            <span style={{ fontSize: 9, color: '#57535e' }}>−</span>
            <div
              onPointerDown={handleBarPointerDown}
              style={{
                width: 64, height: 4, background: '#2b2b2f', borderRadius: 2,
                cursor: 'ew-resize', position: 'relative',
              }}
            >
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${zoomBarPct * 100}%`,
                background: '#c4913a', borderRadius: 2, pointerEvents: 'none',
              }} />
            </div>
            <span style={{ fontSize: 9, color: '#57535e' }}>+</span>
            <span style={{ fontSize: 10, color: '#c4913a', fontWeight: 700, minWidth: 28, textAlign: 'right' }}>
              {visibleHours}h
            </span>
          </div>
        </div>

        <div ref={bodyRef} className="flex relative" style={{ height: `${totalH}px` }}>
          <div className="w-12 shrink-0 relative bg-[#141416] border-r border-[#2b2b2f]">
            {HOURS.map(hour => (
              <div
                key={hour}
                data-hour={hour}
                className="absolute w-full text-[10px] text-[#6a6660] font-mono pl-2 select-none"
                style={{ top: `${(hour - HOURS[0]) * rh}px` }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {weekDays.map((day) => {
            const dateStr = getDateString(day)
            const dayTasks = tasksByDay.get(dateStr) ?? []
            const today = isToday(day)
            const layout = computeLayout(dayTasks)

            return (
              <div
                key={dateStr}
                className="flex-1 relative border-l border-[#2b2b2f] transition-colors duration-150"
                style={{ background: today ? 'rgba(196,145,58,0.04)' : 'transparent' }}
                onDragOver={(e) => { e.preventDefault() }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = draggedTaskId ?? e.dataTransfer.getData('taskId')
                  if (id) onDropTask(id, day)
                }}
              >
                {HOURS.map(hour => (
                  <div
                    key={hour}
                    data-gridline={hour}
                    className="absolute w-full border-t border-[#1e1e22]"
                    style={{ top: `${(hour - HOURS[0]) * rh}px` }}
                  />
                ))}

                {today && currentTimeTopPx >= 0 && (
                  <div
                    data-timeindicator="true"
                    className="absolute left-0 right-0 z-30 pointer-events-none"
                    style={{ top: `${currentTimeTopPx}px` }}
                  >
                    <div className="h-0.5 bg-[#f87171]" />
                    <div className="absolute -top-1 left-0 w-2.5 h-2.5 rounded-full bg-[#f87171] shadow-sm shadow-[#f87171]/50" />
                  </div>
                )}

                {moveDateStr === dateStr && movePreview && (
                  <div
                    className="absolute left-1 right-1 z-20 pointer-events-none"
                    style={{ top: `${(movePreview.previewMin - HOURS[0] * 60) / 60 * rh}px` }}
                  >
                    <div className="h-0.5 bg-[#c4913a] w-full rounded-full" />
                    <div className="absolute -top-1 left-0 w-2.5 h-2.5 rounded-full bg-[#c4913a] shadow-sm shadow-[#c4913a]/50" />
                  </div>
                )}

                {dayTasks.map((task) => {
                  if (!task.scheduled_date) return null
                  const taskDate = new Date(task.scheduled_date)
                  const displayStart = interaction?.kind === 'resize' && interaction.task.id === task.id
                    ? interaction.previewStart : taskDate
                  const displayDuration = interaction?.kind === 'resize' && interaction.task.id === task.id
                    ? interaction.previewDuration : (task.duration_minutes ?? 60)

                  const top = ((displayStart.getHours() - HOURS[0]) * 60 + displayStart.getMinutes()) / 60 * rh
                  const height = Math.max(displayDuration / 60 * rh, rh > 20 ? 18 : 8)
                  const titleFontSize = height < 36 ? 9 : height < 56 ? 10 : height < 88 ? 11 : 13
                  const badgeFontSize = height < 44 ? 6 : height < 88 ? 7 : 8
                  const showBadge = height >= 22
                  const showTime = height >= 28
                  const color = task.color ?? '#57535e'
                  const rgb = hexToRgb(color)
                  const { leftFrac, widthFrac } = layout.get(task.id) ?? { leftFrac: 0, widthFrac: 1 }
                  const isMoved = interaction?.kind === 'move' && interaction.task.id === task.id && interaction.moved
                  const status = effectiveStatus(task)

                  // per-status visuals
                  const cardStyle: React.CSSProperties = (() => {
                    switch (status) {
                      case 'overdue':
                        return {
                          background: 'rgba(220,80,64,0.15)',
                          border: '1px solid rgba(224,96,80,0.25)',
                          borderTop: '2.5px solid #e06050',
                        }
                      case 'postponed':
                        return {
                          background: 'rgba(40,40,58,0.52)',
                          borderTop: '2.5px solid #4a4a66',
                          opacity: 0.72,
                        }
                      case 'done':
                        return {
                          background: 'rgba(30,30,40,0.5)',
                          borderTop: '2.5px solid #222230',
                          filter: 'grayscale(1) opacity(0.28)',
                        }
                      default: // todo
                        return {
                          background: `rgba(${rgb},0.18)`,
                          borderTop: `2.5px solid ${color}`,
                        }
                    }
                  })()

                  const titleColor = status === 'overdue' ? '#e06050'
                    : status === 'postponed' ? '#c0b8d8'
                    : status === 'done' ? '#4a4a5a'
                    : '#edeae2'

                  const titleStyle: React.CSSProperties = {
                    textDecoration: status === 'done' ? 'line-through' : 'none',
                    fontStyle: status === 'postponed' ? 'italic' : 'normal',
                  }

                  const badgeText = status === 'overdue' ? 'LATE'
                    : status === 'postponed' ? 'LATER'
                    : status === 'done' ? 'DONE'
                    : 'TODO'

                  const badgeBg = status === 'overdue' ? 'rgba(224,80,64,0.18)'
                    : status === 'postponed' ? 'rgba(50,50,80,0.35)'
                    : status === 'done' ? 'rgba(30,30,50,0.5)'
                    : `rgba(${rgb},0.20)`

                  const badgeColor = status === 'overdue' ? '#e06050'
                    : status === 'postponed' ? '#9090c0'
                    : status === 'done' ? '#3a3a50'
                    : color

                  const watermarkText = status === 'overdue' ? 'LATE'
                    : status === 'postponed' ? 'LATER'
                    : status === 'done' ? '✓'
                    : ''

                  const watermarkCls = status === 'overdue' ? 'task-watermark task-watermark-late'
                    : status === 'postponed' ? 'task-watermark task-watermark-later'
                    : status === 'done' ? 'task-watermark task-watermark-done'
                    : ''

                  // checkbox
                  const isChecked = status === 'done'
                  const checkboxBorder = status === 'overdue' ? 'rgba(224,96,80,0.6)'
                    : status === 'postponed' ? 'rgba(80,80,96,0.4)'
                    : status === 'done' ? '#4ac571'
                    : `rgba(${rgb},0.5)`
                  const checkboxBg = isChecked ? '#4ac571' : 'transparent'

                  return (
                    <div
                      key={task.id}
                      data-taskcard={task.id}
                      data-task-start-min={String((displayStart.getHours() - HOURS[0]) * 60 + displayStart.getMinutes())}
                      data-task-dur-min={String(displayDuration)}
                      onClick={e => e.stopPropagation()}
                      onContextMenu={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        setContextMenu({ task, x: e.clientX, y: e.clientY })
                      }}
                      className={`absolute z-10 select-none rounded-[5px] overflow-hidden ${
                        status === 'overdue' ? 'task-card-overdue' : ''
                      } ${isMoved ? 'opacity-30' : ''} ${isAnyInteraction ? '' : 'hover:brightness-110'}`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(${leftFrac * 100}% + 1px)`,
                        width: `calc(${widthFrac * 100}% - 2px)`,
                        transition: 'brightness 0.1s ease',
                        cursor: isAnyInteraction
                          ? (interaction?.kind === 'resize' ? 'ns-resize' : 'grabbing')
                          : 'grab',
                        ...cardStyle,
                      }}
                    >
                      {/* watermark */}
                      {watermarkText && <span className={watermarkCls}>{watermarkText}</span>}

                      {/* top resize handle */}
                      <div
                        className="absolute top-0 left-0 right-0 h-2.5 z-20 cursor-ns-resize"
                        onMouseDown={(e) => handleResizeStart(e, task, 'top')}
                      />

                      {/* card content */}
                      <div
                        className="absolute inset-0 top-2.5 bottom-2.5 flex items-start gap-1.5 px-1.5 py-1 overflow-hidden z-10"
                        onMouseDown={(e) => handleMoveStart(e, task)}
                      >
                        {/* checkbox */}
                        <button
                          className="flex-shrink-0 mt-[1px] rounded-full flex items-center justify-center"
                          style={{
                            width: 11,
                            height: 11,
                            border: `1.5px solid ${checkboxBorder}`,
                            background: checkboxBg,
                            transition: 'all 0.1s ease',
                            cursor: 'pointer',
                          }}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            // overdue and todo both → done; done → todo; postponed → done
                            const next = status === 'done' ? 'todo' : 'done'
                            onTaskStatusChange(task.id, next)
                          }}
                        >
                          {isChecked && (
                            <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                              <path d="M1 2.5L2.8 4L6 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <div
                              className="font-bold truncate leading-tight"
                              style={{ fontSize: titleFontSize, color: titleColor, ...titleStyle }}
                            >
                              {task.title}
                            </div>
                            {showBadge && (
                              <span
                                className="uppercase tracking-wider flex-shrink-0 px-1 py-px rounded leading-none"
                                style={{ fontSize: badgeFontSize, background: badgeBg, color: badgeColor }}
                              >
                                {badgeText}
                              </span>
                            )}
                          </div>
                          {showTime && (
                            <div className="mt-0.5 truncate" style={{ fontSize: Math.max(7, titleFontSize - 2), color: `rgba(${rgb},0.65)` }}>
                              {displayStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                              {displayDuration ? ` · ${displayDuration}m` : ''}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* bottom resize handle */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-2.5 z-20 cursor-ns-resize"
                        onMouseDown={(e) => handleResizeStart(e, task, 'bottom')}
                      />
                    </div>
                  )
                })}

                <div
                  className="absolute inset-0 w-full h-full"
                  onContextMenu={(e) => {
                    if (justInteractedRef.current || isAnyInteraction) return
                    e.preventDefault()
                    const colRect = e.currentTarget.getBoundingClientRect()
                    const yOffset = e.clientY - colRect.top
                    const totalMin = (yOffset / rh) * 60 + HOURS[0] * 60
                    const hour = Math.max(HOURS[0], Math.min(HOURS[HOURS.length - 1], Math.floor(totalMin / 60)))
                    const minute = Math.floor((totalMin % 60) / 15) * 15
                    const clickDate = new Date(day)
                    clickDate.setHours(hour, minute, 0, 0)
                    setSlotMenu({ x: e.clientX, y: e.clientY, date: clickDate })
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      {contextMenu && (
        <TaskContextMenu
          task={contextMenu.task}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onPostpone={() => {
            const next = contextMenu.task.status === 'postponed' ? 'todo' : 'postponed'
            onTaskStatusChange(contextMenu.task.id, next)
            setContextMenu(null)
          }}
          onMoveToTomorrow={() => {
            const d = new Date(contextMenu.task.scheduled_date!)
            d.setDate(d.getDate() + 1)
            onTaskMove(contextMenu.task.id, d, contextMenu.task.duration_minutes)
            setContextMenu(null)
          }}
          onMoveToNextWeek={() => {
            const d = new Date(contextMenu.task.scheduled_date!)
            d.setDate(d.getDate() + 7)
            onTaskMove(contextMenu.task.id, d, contextMenu.task.duration_minutes)
            setContextMenu(null)
          }}
          onEdit={() => {
            onTaskClick(contextMenu.task.id)
            setContextMenu(null)
          }}
          onDelete={() => {
            if (contextMenu) onDeleteTask(contextMenu.task.id)
            setContextMenu(null)
          }}
        />
      )}

      {slotMenu && (
        <div
          ref={slotMenuRef}
          style={{
            position: 'fixed',
            left: Math.min(slotMenu.x, window.innerWidth - 170),
            top: Math.min(slotMenu.y, window.innerHeight - 60),
            zIndex: 1000,
            background: '#1a1a1e',
            border: '1px solid #2b2b2f',
            borderRadius: 8,
            padding: '4px',
            minWidth: 158,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <button
            onMouseDown={e => {
              e.stopPropagation()
              onEmptySlotClick(slotMenu.date)
              setSlotMenu(null)
            }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '7px 12px', fontSize: 12, fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#c8c4bc', borderRadius: 6,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
          >
            + Create task at {slotMenu.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
          </button>
        </div>
      )}
    </div>
  )
}
