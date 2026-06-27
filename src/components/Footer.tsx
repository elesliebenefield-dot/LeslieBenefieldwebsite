export default function Footer() {
  return (
    <footer className="footer">
      <p className="footer-text">
        Designed & Developed by Leslie © 2026
      </p>
      <div className="footer-links">
        <a href="mailto:websitesbyleslie01@gmail.com" className="footer-link">
          websitesbyleslie01@gmail.com
        </a>
        <a href="tel:8505659114" className="footer-link">
          850-565-9114
        </a>
        <a
          href="https://www.facebook.com/share/1EB3v8j1Fz/"
          className="fb-link fb-link--footer"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="fb-icon" aria-hidden="true">f</span>
          Websites by Leslie
        </a>
      </div>
    </footer>
  )
}
