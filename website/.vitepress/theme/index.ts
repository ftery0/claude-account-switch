import DefaultTheme from 'vitepress/theme'
import { useRoute } from 'vitepress'
import { onMounted, watch, nextTick } from 'vue'

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()

    function injectJsonLd() {
      // Remove previous injected JSON-LD
      document.querySelectorAll('script[data-jsonld]').forEach(el => el.remove())

      // Read JSON-LD from page frontmatter (client-side)
      const el = document.querySelector('[data-json-ld]')
      if (el) {
        const script = document.createElement('script')
        script.type = 'application/ld+json'
        script.setAttribute('data-jsonld', '')
        script.textContent = el.getAttribute('data-json-ld') || ''
        document.head.appendChild(script)
      }
    }

    onMounted(() => {
      injectJsonLd()
      watch(() => route.path, () => nextTick(injectJsonLd))
    })
  },
}
