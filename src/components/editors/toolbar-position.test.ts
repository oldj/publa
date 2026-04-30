import { describe, expect, it } from 'vitest'
import { getFloatingToolbarTop } from './toolbar-position'

describe('getFloatingToolbarTop', () => {
  it('目标上方空间足够时，把工具栏放在目标上方', () => {
    expect(
      getFloatingToolbarTop({
        containerTop: 100,
        targetTop: 200,
        targetBottom: 260,
        scrollTop: 0,
      }),
    ).toBe(60)
  })

  it('目标上方空间不足时，把工具栏放在目标下方', () => {
    expect(
      getFloatingToolbarTop({
        containerTop: 100,
        targetTop: 130,
        targetBottom: 190,
        scrollTop: 0,
      }),
    ).toBe(94)
  })

  it('外层滚动容器滚动后，定位会补偿 scrollTop', () => {
    expect(
      getFloatingToolbarTop({
        containerTop: 0,
        targetTop: 600,
        targetBottom: 700,
        scrollTop: 320,
      }),
    ).toBe(880)
  })

  it('工具栏位于目标下方时，也会补偿 scrollTop', () => {
    expect(
      getFloatingToolbarTop({
        containerTop: 0,
        targetTop: 20,
        targetBottom: 80,
        scrollTop: 320,
      }),
    ).toBe(404)
  })
})
