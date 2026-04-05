import { notifications, type NotificationData } from '@mantine/notifications'
import { IconCheck, IconInfoCircle, IconX } from '@tabler/icons-react'

const iconMap: Record<string, React.ReactNode> = {
  green: <IconCheck size={18} />,
  teal: <IconCheck size={18} />,
  red: <IconX size={18} />,
  orange: <IconInfoCircle size={18} />,
}

export function notify(data: NotificationData) {
  notifications.show({
    ...data,
    icon: data.icon ?? iconMap[data.color as string],
  })
}
