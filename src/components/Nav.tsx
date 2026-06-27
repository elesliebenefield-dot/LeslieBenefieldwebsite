import { useState, useCallback } from 'react'

export default function Nav() {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  return (
    <nav className="nav">
      <div className="nav-inner">
        <a href="#hero" className="nav-logo">Websites by Leslie</a>

        <ul className="nav-links">
          <li><a href="#hero">Home</a></li>
          <li><a href="#services">Services</a></li>
          <li><a href="#work">Portfolio</a></li>
          <li><a href="#about">About</a></li>
          <li><a href="#contact">Contact</a></li>
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
        <a href="#hero" onClick={close}>Home</a>
        <a href="#services" onClick={close}>Services</a>
        <a href="#work" onClick={close}>Portfolio</a>
        <a href="#about" onClick={close}>About</a>
        <a href="#process" onClick={close}>Process</a>
        <a href="#contact" onClick={close}>Contact</a>
      </div>
    </nav>
  )
}
