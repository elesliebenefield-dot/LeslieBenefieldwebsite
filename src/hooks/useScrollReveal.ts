import { useEffect } from 'react'

export function useScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
          } else {
            // Remove when element leaves viewport so it re-animates on re-entry
            entry.target.classList.remove('revealed')
          }
        })
      },
      {
        threshold: 0.10,
        rootMargin: '0px 0px -40px 0px',
      }
    )

    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}
