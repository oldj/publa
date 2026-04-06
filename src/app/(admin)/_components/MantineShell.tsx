'use client'

import { theme } from '@/app/theme'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import '@mantine/notifications/styles.css'

export default function MantineShell({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <Notifications position="top-center" />
        {children}
      </ModalsProvider>
    </MantineProvider>
  )
}
