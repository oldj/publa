/**
 * @author: oldj
 * @homepage: https://oldj.net
 */

import { Alert } from '@mantine/core'
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconExclamationCircle,
  IconInfoCircle,
} from '@tabler/icons-react'
import React from 'react'

interface IProps {
  type?: 'info' | 'error' | 'success' | 'warning'
  className?: string
  title?: React.ReactNode
  children?: React.ReactNode
}

function Info(props: IProps) {
  const { type = 'info', title, children, className } = props

  let icon: React.ReactNode
  let color: string

  switch (type) {
    case 'error':
      icon = <IconExclamationCircle size={'1.2em'} />
      color = 'red'
      break
    case 'success':
      icon = <IconCircleCheck size={'1.2em'} />
      color = 'green'
      break
    case 'warning':
      icon = <IconAlertTriangle size={'1.2em'} />
      color = 'yellow'
      break
    default:
      icon = <IconInfoCircle size={'1.2em'} />
      color = 'blue'
      break
  }

  return (
    <Alert
      variant="light"
      icon={icon}
      color={color}
      title={title}
      className={className}
      style={{ lineHeight: 1.5 }}
    >
      {children}
    </Alert>
  )
}

export default Info
