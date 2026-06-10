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
        <a
          href="mailto:mosaichealthapp@gmail.com"
          className="btn btn-primary contact-btn"
        >
          Email Me
        </a>
        <a
          href="https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header"
          className="btn btn-primary contact-btn"
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginLeft: '1rem' }}
        >
          Get a Quote
        </a>
      </div>
    </section>
  )
}
