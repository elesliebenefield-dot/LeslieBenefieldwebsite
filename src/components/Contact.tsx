const FacebookIcon = () => (
  <svg
    className="fb-icon"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <rect width="24" height="24" rx="5" fill="#1877F2" />
    <path
      d="M16.5 8H14V6.5C14 5.95 14.45 5.5 15 5.5h1.5V3h-2C11.91 3 10.5 4.41 10.5 6.5V8H8.5v2.5H10.5V21h3V10.5h2L16.5 8z"
      fill="#fff"
    />
  </svg>
)

export default function Contact() {
  return (
    <section id="contact" className="contact">
      <div className="contact-inner" data-reveal>
        <p className="section-label">Get In Touch</p>
        <h2 className="section-title">Let's work together.</h2>
        <p className="section-subtitle">
          Have an idea for a website, refresh, or creative project?
          I'd love to hear about it.
        </p>
        <div className="contact-buttons">
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header"
            className="btn btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get a Free Quote
          </a>
          <a
            href="mailto:websitesbyleslie01@gmail.com"
            className="btn btn-outline"
          >
            Email Me
          </a>
        </div>
        <div className="contact-details">
          <a href="tel:8505659114" className="contact-detail-link">
            📞 850-565-9114
          </a>
          <a
            href="https://www.facebook.com/share/1EB3v8j1Fz/"
            className="fb-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FacebookIcon />
            Websites by Leslie
          </a>
        </div>
      </div>
    </section>
  )
}
