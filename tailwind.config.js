/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Escala construída em torno do azul da logo da loja (#004AAD = brand-600).
        brand: {
          50: '#EEF4FC',
          100: '#D8E6F8',
          200: '#B2CBF0',
          300: '#7FA9E3',
          400: '#4681D2',
          500: '#1560BE',
          600: '#004AAD',
          700: '#003B8B',
          800: '#002E6C',
          900: '#00224F',
          950: '#001533',
          DEFAULT: '#004AAD',
        },
        // SUPOSIÇÃO: semântica neutra apenas. Os estados financeiros
        // (pago / a vencer / atrasado) ainda NÃO estão especificados —
        // mapear estas cores quando as regras de pagamento forem definidas.
        success: { DEFAULT: '#047857', soft: '#ECFDF5' },
        warning: { DEFAULT: '#B45309', soft: '#FFFBEB' },
        danger: { DEFAULT: '#B91C1C', soft: '#FEF2F2' },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
