import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'dark',
  fontSizes: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
  },
  components: {
    Badge: {
      styles: {
        label: { textBoxTrim: 'none' },
      },
    },
    Combobox: {
      defaultProps: {
        shadow: 'md',
      },
    },
    Select: {
      defaultProps: {
        checkIconPosition: 'right',
      },
    },
    MultiSelect: {
      defaultProps: {
        checkIconPosition: 'right',
      },
    },
    Modal: {
      defaultProps: {
        centered: true,
      },
    },
  },
})
