import { Button, Stack } from '@mantine/core'
import { modals } from '@mantine/modals'

interface ModalOptions {
  title?: string | null
  message?: React.ReactNode
  okText?: string
  cancelText?: string
}

function renderMessage(message: React.ReactNode): React.ReactNode {
  if (typeof message !== 'string') return message
  return message.split('\n').flatMap((part, i) =>
    i === 0 ? [part] : [<br key={i} />, part],
  )
}

function getTitle(title: string | null | undefined): string | undefined {
  if (title === null) return undefined
  return title || '提示'
}

async function alert(options: ModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false
    const id = modals.open({
      title: getTitle(options.title),
      centered: true,
      withCloseButton: false,
      children: (
        <Stack>
          <div>{renderMessage(options.message)}</div>
          <Button
            fullWidth
            onClick={() => {
              resolved = true
              resolve(true)
              modals.close(id)
            }}
          >
            {options.okText || '确定'}
          </Button>
        </Stack>
      ),
      onClose: () => { if (!resolved) resolve(true) },
    })
  })
}

async function confirm(options: ModalOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false
    modals.openConfirmModal({
      title: getTitle(options.title),
      centered: true,
      withCloseButton: options.title !== null,
      children: <div>{renderMessage(options.message)}</div>,
      labels: {
        confirm: options.okText || '确定',
        cancel: options.cancelText || '取消',
      },
      onCancel: () => { resolved = true; resolve(false) },
      onConfirm: () => { resolved = true; resolve(true) },
      onClose: () => { if (!resolved) resolve(false) },
    })
  })
}

const myModal = {
  alert,
  confirm,
}

export default myModal
