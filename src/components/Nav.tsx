import { useState, useCallback } from 'react'

interface NavProps {
  /** 'home' (default) keeps the original in-page anchor links, unchanged.
   *  'page' is for standalone pages like /check — section links route back to the homepage. */
  variant?: 'home' | 'page'
}

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header'

const ChevronIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="nav-mobile-chevron"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

interface MobileNavItem {
  label: string
  href: string
  viewAll?: boolean
}

interface MobileNavGroup {
  label: string
  items: MobileNavItem[]
}

export default function Nav({ variant = 'home' }: NavProps) {
  const [open, setOpen] = useState(false)
  // Independent disclosures, not a single-select accordion — matches the
  // /faq accordion's behavior, so more than one group can be open at once.
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set())

  const close = useCallback(() => setOpen(false), [])

  const toggleGroup = useCallback((index: number) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const sectionHref = (hash: string) => (variant === 'home' ? hash : `/${hash}`)
  const logoHref = variant === 'home' ? '#hero' : '/'

  // Grouped structure for the mobile menu only — the desktop .nav-links
  // list above is unaffected. Every destination here is a confirmed real
  // route (vercel.json) or homepage section id, not invented.
  const mobileGroups: MobileNavGroup[] = [
    {
      label: 'Services',
      items: [
        { label: 'Services & Pricing', href: '/services' },
        { label: 'Process', href: '/services#process' },
      ],
    },
    {
      label: 'Work & About',
      items: [
        { label: 'Portfolio', href: sectionHref('#work') },
        { label: 'About', href: sectionHref('#about') },
      ],
    },
    {
      label: 'Tools & Resources',
      items: [
        { label: 'View all Business Tools →', href: '/business-tools', viewAll: true },
        { label: 'Free Bakery Pricing Calculator', href: '/bakery-pricing-guide' },
        { label: 'Custom Bakery Order Planner', href: '/tools-custom-bakery-order' },
        { label: 'Plumbing Service Visit Planner', href: '/tools-plumbing-visit' },
        { label: 'Food Truck Event Planner', href: '/tools-food-truck-event' },
        { label: 'Real Estate Client Tools', href: '/real-estate-tools' },
        { label: 'Website Checklist', href: '/website-checklist' },
        { label: 'Free Website Review', href: '/check' },
      ],
    },
    {
      label: 'Help & Contact',
      items: [
        { label: 'FAQ', href: '/faq' },
        { label: 'Contact', href: sectionHref('#contact') },
      ],
    },
  ]

  return (
    <nav className="nav">
      <div className="nav-inner">
        <a href={logoHref} className="nav-logo">Websites by Leslie</a>

        <ul className="nav-links">
          <li><a href={sectionHref('#hero')}>Home</a></li>
          <li><a href="/services">Services & Pricing</a></li>
          <li><a href={sectionHref('#work')}>Portfolio</a></li>
          <li><a href="/business-tools">Tools</a></li>
          <li><a href={sectionHref('#about')}>About</a></li>
          <li><a href="/faq">FAQ</a></li>
          <li><a href="/website-checklist">Website Checklist</a></li>
          <li><a href="/check">Free Website Review</a></li>
          <li><a href={sectionHref('#contact')}>Contact</a></li>
        </ul>

        <a
          href={GOOGLE_FORM_URL}
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
        <a href={sectionHref('#hero')} className="nav-mobile-link" onClick={close}>Home</a>

        {mobileGroups.map((group, gi) => {
          const groupOpen = openGroups.has(gi)
          const buttonId = `nav-mobile-group-toggle-${gi}`
          const panelId = `nav-mobile-group-panel-${gi}`
          return (
            <div className="nav-mobile-group" data-open={groupOpen} key={group.label}>
              <button
                type="button"
                id={buttonId}
                className="nav-mobile-group-toggle"
                aria-expanded={groupOpen}
                aria-controls={panelId}
                onClick={() => toggleGroup(gi)}
              >
                <span>{group.label}</span>
                <ChevronIcon />
              </button>
              <div id={panelId} className="nav-mobile-group-panel" aria-labelledby={buttonId}>
                <div className="nav-mobile-group-panel-inner">
                  {group.items.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      className={`nav-mobile-link nav-mobile-sublink${item.viewAll ? ' nav-mobile-view-all' : ''}`}
                      onClick={close}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        <a
          href={GOOGLE_FORM_URL}
          className="nav-mobile-cta"
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          Get a Quote
        </a>
      </div>
    </nav>
  )
}
