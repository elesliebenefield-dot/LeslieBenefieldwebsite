import visaIcon from '../assets/payment-icons/visa.svg'
import mastercardIcon from '../assets/payment-icons/mastercard.svg'
import amexIcon from '../assets/payment-icons/amex.svg'
import discoverIcon from '../assets/payment-icons/discover.svg'
import applePayIcon from '../assets/payment-icons/apple-pay.svg'
import googlePayIcon from '../assets/payment-icons/google-pay.svg'

const FacebookIcon = () => (
  <svg
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    style={{ width: 18, height: 18, flexShrink: 0 }}
  >
    <rect width="24" height="24" rx="5" fill="#1877F2" />
    <path
      d="M16.5 8H14V6.5C14 5.95 14.45 5.5 15 5.5h1.5V3h-2C11.91 3 10.5 4.41 10.5 6.5V8H8.5v2.5H10.5V21h3V10.5h2L16.5 8z"
      fill="#fff"
    />
  </svg>
)

const PAYMENT_METHODS = [
  { src: visaIcon, alt: 'Visa' },
  { src: mastercardIcon, alt: 'Mastercard' },
  { src: amexIcon, alt: 'American Express' },
  { src: discoverIcon, alt: 'Discover' },
  { src: applePayIcon, alt: 'Apple Pay' },
  { src: googlePayIcon, alt: 'Google Pay' },
]

export default function Footer() {
  return (
    <footer className="footer">
      <p className="footer-text">
        Designed & Developed by Leslie © 2026
      </p>
      <p className="footer-faith">Jesus loves you. — John 3:16</p>
      <div className="footer-links">
        <a href="/privacy-policy" className="footer-link">Privacy Policy</a>
        <a href="/business-tools" className="footer-link">Business Tools</a>
        <a
          href="https://www.facebook.com/share/1EB3v8j1Fz/"
          className="footer-link footer-link-icon"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Websites by Leslie on Facebook"
        >
          <FacebookIcon />
        </a>
      </div>
      <p className="footer-contact">
        <a href="tel:8505659114" className="footer-phone">850-565-9114</a>
        {' · '}
        <a href="mailto:websitesbyleslie01@gmail.com" className="footer-phone">websitesbyleslie01@gmail.com</a>
      </p>
      <p className="footer-contact footer-location">
        Based in Pensacola, Florida. Working with small businesses wherever you’re located.
      </p>

      <div className="footer-payments">
        <p className="footer-payments-label">Secure online payments accepted</p>
        <div className="footer-payment-icons">
          {PAYMENT_METHODS.map((method) => (
            <span className="pay-icon" key={method.alt}>
              <img src={method.src} alt={method.alt} loading="lazy" />
            </span>
          ))}
        </div>
        <p className="footer-payments-note">Other payment arrangements available upon request.</p>
      </div>
    </footer>
  )
}
