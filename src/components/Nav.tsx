import { useState, useCallback } from 'react'

interface NavProps {
  /** 'home' (default) keeps the original in-page anchor links, unchanged.
   *  'page' is for standalone pages like /check — section links route back to the homepage. */
  variant?: 'home' | 'page'
}

export default function Nav({ variant = 'home' }: NavProps) {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  const sectionHref = (hash: string) => (variant === 'home' ? hash : `/${hash}`)
  const logoHref = variant === 'home' ? '#hero' : '/'

  return (
    <nav className="nav">
      <div className="nav-inner">
        <a href={logoHref} className="nav-logo">Websites by Leslie</a>

        <ul className="nav-links">
          <li><a href={sectionHref('#hero')}>Home</a></li>
          <li><a href={sectionHref('#services')}>Services</a></li>
          <li><a href={sectionHref('#work')}>Portfolio</a></li>
          <li><a href={sectionHref('#about')}>About</a></li>
          <li><a href="/check">Free Website Review</a></li>
          <li><a href={sectionHref('#contact')}>Contact</a></li>
        </ul>

        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header"
          className="nav-contact-btn"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get a Quote
        </a>

        <button
          className={`nav-hamburger${open ? ' nav-hamburger--open' : ''}`}
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          type="button"
        >
          <span /><span /><span />
        </button>
      </div>

      <div className="nav-mobile" aria-hidden={!open} style={{ display: open ? 'flex' : 'none' }}>
        <a href={sectionHref('#hero')} onClick={close}>Home</a>
        <a href={sectionHref('#services')} onClick={close}>Services</a>
        <a href={sectionHref('#work')} onClick={close}>Portfolio</a>
        <a href={sectionHref('#about')} onClick={close}>About</a>
        <a href={sectionHref('#process')} onClick={close}>Process</a>
        <a href="/check" onClick={close}>Free Website Review</a>
        <a href={sectionHref('#contact')} onClick={close}>Contact</a>
      </div>
    </nav>
  )
}
