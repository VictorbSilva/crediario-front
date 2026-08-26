import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const BRAND = '#004AAD'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  images: ['public/favicon.svg'],
  preset: {
    ...minimal2023Preset,
    transparent: {
      ...minimal2023Preset.transparent,
      padding: 0,
    },
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { fit: 'contain', background: BRAND },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0.1,
      resizeOptions: { fit: 'contain', background: BRAND },
    },
  },
})
