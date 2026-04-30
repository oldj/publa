export interface FloatingToolbarTopInput {
  containerTop: number
  targetTop: number
  targetBottom: number
  scrollTop: number
  toolbarHeight?: number
  gap?: number
  minSpaceAbove?: number
}

export function getFloatingToolbarTop({
  containerTop,
  targetTop,
  targetBottom,
  scrollTop,
  toolbarHeight = 36,
  gap = 4,
  minSpaceAbove = toolbarHeight + 8,
}: FloatingToolbarTopInput) {
  const targetTopInContainer = targetTop - containerTop
  const targetBottomInContainer = targetBottom - containerTop

  return targetTopInContainer >= minSpaceAbove
    ? targetTopInContainer + scrollTop - toolbarHeight - gap
    : targetBottomInContainer + scrollTop + gap
}
