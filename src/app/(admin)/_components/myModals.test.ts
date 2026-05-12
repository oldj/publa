import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockOpen, mockClose } = vi.hoisted(() => ({
  mockOpen: vi.fn(),
  mockClose: vi.fn(),
}))

// 仅 stub 弹窗系统，让 modals.open 返回一个 id 但不真的渲染 React，
// 这样 reauth() 的 Promise 会停留在 pending，便于断言并发场景下的单例化行为。
vi.mock('@mantine/modals', () => ({
  modals: {
    open: mockOpen,
    close: mockClose,
    openConfirmModal: vi.fn(),
  },
}))

vi.mock('@/i18n/client-runtime', () => ({
  getClientTranslator: () => (key: string) => key,
}))

const myModalModule = await import('./myModals')
const myModal = myModalModule.default

describe('myModal.reauth 单例化', () => {
  beforeEach(() => {
    mockOpen.mockReset()
    mockClose.mockReset()
    mockOpen.mockReturnValue('modal-id-1')
  })

  it('并发调用时只会打开一个弹窗，且共享同一个 Promise', async () => {
    const a = myModal.reauth()
    const b = myModal.reauth()

    // 都还在等待用户输入；单例保证 modals.open 只调一次
    expect(mockOpen).toHaveBeenCalledTimes(1)
    // 两次调用返回的是同一个 Promise 引用
    expect(a).toBe(b)

    // 触发 onCancel 清理模块单例，避免污染后续用例
    const opts = mockOpen.mock.calls[0][0] as any
    opts.children.props.onCancel()
    await a
  })

  it('第一次结束后再次调用会重新打开弹窗', async () => {
    const first = myModal.reauth()
    const firstOpts = mockOpen.mock.calls[0][0] as any
    firstOpts.children.props.onSuccess()
    await expect(first).resolves.toBe(true)

    const second = myModal.reauth()
    expect(mockOpen).toHaveBeenCalledTimes(2)
    expect(second).not.toBe(first)
  })
})
