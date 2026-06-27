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
          <FacebookIcon />
          Websites by Leslie
        </a>
      </div>
    </footer>
  )
}
