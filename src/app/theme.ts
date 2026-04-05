import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'dark',
  components: {
    Badge: {
      styles: {
        label: { textBoxTrim: 'none' },
      },
    },
  },
})
