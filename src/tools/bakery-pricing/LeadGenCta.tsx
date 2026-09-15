// Attribution + lead-generation CTA (M7-4/M7-5), shown only once pricing
// results are visible — never inside ingredient entry, cost input, or any
// other step of the calculation workflow. Reuses the site's existing
// `tool-sales-cta` pattern and its real contact address (no invented URL
// or offer); themed to the calculator's own bakery-ledger palette via a
// scoped override in bakeryPricing.css, since the unscoped default uses
// the site's generic teal accent, which would clash here.
export function LeadGenCta() {
  return (
    <>
      <p className="bp-cross-link-note">
        Running a bakery that takes custom orders? The{' '}
        <a href="/tools-custom-bakery-order">Custom Bakery Order Planner</a> helps your customers describe
        exactly what they want to order — separate from this calculator, which is for figuring out your own
        costs and pricing.
      </p>

      <div className="tool-sales-cta no-print" aria-label="For bakery businesses">
        <p className="tool-sales-cta-eyebrow">For bakery businesses</p>
        <h2 className="tool-sales-cta-heading">Need a website or order form for your bakery?</h2>
        <p className="tool-sales-cta-body">
          I build affordable websites, online order forms, and custom small-business tools — like this
          calculator — for home bakers turning their hobby into a business.
        </p>
        <ul className="tool-sales-cta-features" aria-label="What can be built">
          <li>A simple, professional bakery website</li>
          <li>An online order form your customers can fill out</li>
          <li>Custom tools built around how you actually work</li>
          <li>Hosted and ready to share — no technical setup on your end</li>
        </ul>
        <a
          href="mailto:websitesbyleslie01@gmail.com?subject=Bakery%20Website%20Inquiry"
          className="tool-sales-cta-link"
          title="Opens your email application to contact Websites by Leslie"
        >
          Get in Touch →
        </a>
      </div>
    </>
  )
}
