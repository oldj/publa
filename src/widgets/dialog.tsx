/**
 */

import Swal from 'sweetalert2'

interface IAlertOptions {
  title?: string
  message?: string
  icon?: 'success' | 'error' | 'warning' | 'info' | 'question'
  buttons_text?: string
  onConfirm?: () => void
}

export async function Alert(options: IAlertOptions) {
  let r = await Swal.fire({
    title: options.title || '',
    text: options.message || '',
    icon: options.icon ?? 'info',
    confirmButtonText: options.buttons_text || '好的',
    customClass: {
      confirmButton: 'w-dialog-btn-primary',
      popup: 'w-dialog-popup',
    },
    buttonsStyling: false,
    showClass: {
      popup: 'animate__animated animate__fadeIn',
    },
    hideClass: {
      popup: 'animate__animated animate__fadeOut',
    },
  })

  if (r.isConfirmed) {
    if (options.onConfirm) {
      options.onConfirm()
    }
  }
}

export default { Alert }
