import { heroui } from '@heroui/react'

export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    screens: {
      sm: '480px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    fontFamily: {
      sans: ['var(--font-sans)'],
      serif: ['var(--font-serif)'],
    },
    extend: {
      fontSize: {
        icon: '120%',
        '5xl': '2.75rem',
      },
      colors: {
        dark: '#0a0a0ad4',
        light: '#ffffffb3',
      },
      width: {
        sm: '8rem',
        md: '16rem',
        lg: '32rem',
        xl: '64rem',
        '1/8': '12.5%',
      },
      maxWidth: {
        '1/2': '50%',
        '1/3': '33.3333%',
        '1/4': '25%',
        '2/3': '66.6666%',
        '3/4': '75%',
        sm: '8rem',
        md: '16rem',
        lg: '32rem',
        xl: '64rem',
      },
      height: {
        cover: 'calc(100vh - 4rem)',
      },
      maxHeight: {
        modal: '40rem',
        sm: '8rem',
        md: '16rem',
        lg: '32rem',
        xl: '64rem',
        inherit: 'inherit',
        cover: 'calc(100vh - 4rem)',
      },
      minHeight: {
        '100': '25rem',
        '120': '30rem',
        cover: 'calc(100vh - 4rem)',
        sm: '8rem',
        md: '16rem',
        lg: '32rem',
        xl: '64rem',
        '2/3': 'calc(66vh - 4rem)',
        '3/4': 'calc(75vh - 4rem)',
        inherit: 'inherit',
      },
      lineHeight: {
        tight: '1.125',
        compact: '.9',
      },
      aspectRatio: {
        '9/4': '9 / 4',
        '4/3': '4 / 3',
        '3/4': '3 / 4',
        '4/9': '4 / 9',
      },
      boxShadow: {
        aside: [
          '0 0.125rem 0.5rem rgba(0, 0, 0, 0.2)',
          '0 0.75rem 1.25rem rgba(0, 0, 0, 0.15)',
          '0 0 2rem rgba(0, 0, 0, 0.05)',
        ],
      },
      dropShadow: {
        light: [
          '0 0.125rem 0.5rem rgba(256, 256, 256, 0.5)',
          '0 0.75rem 1.25rem rgba(256, 256, 256, 0.25)',
          '0 1.5rem 2rem rgba(256, 256, 256, 0.125)',
        ],
        dark: [
          '0 0.125rem 0.5rem rgba(0, 0, 0, 0.4)',
          '0 0.75rem 1.25rem rgba(0, 0, 0, 0.2)',
          '0 1.5rem 2rem rgba(0, 0, 0, 0.1)',
        ],
      },
    },
  },
  darkMode: 'class',
  plugins: [
    heroui({
      defaultTheme: 'light',
      addCommonColors: true,
      themes: {
        light: {
          colors: {
            foreground: {
              DEFAULT: '#232325',
            },
            primary: {
              DEFAULT: '#008a45',
            },
            secondary: {
              DEFAULT: '#d12934',
            },
          },
        },
        dark: {
          colors: {
            background: {
              DEFAULT: '#232325',
            },
            primary: {
              DEFAULT: '#008a45',
            },
            secondary: {
              DEFAULT: '#d12934',
            },
          },
        },
      },
    }) as any,
  ],
}
