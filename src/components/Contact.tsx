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

const PhoneIcon = () => (
  <svg
    className="contact-icon"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 13 19.79 19.79 0 0 1 1.27 4.4 2 2 0 0 1 3.24 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
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
            <PhoneIcon />
            850-565-9114
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
