import visaIcon from '../assets/payment-icons/visa.svg'
import mastercardIcon from '../assets/payment-icons/mastercard.svg'
import amexIcon from '../assets/payment-icons/amex.svg'
import discoverIcon from '../assets/payment-icons/discover.svg'
import applePayIcon from '../assets/payment-icons/apple-pay.svg'
import googlePayIcon from '../assets/payment-icons/google-pay.svg'

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
      <p className="footer-contact">
        <a href="tel:8505659114" className="footer-phone">850-565-9114</a>
        {' · '}
        <a href="mailto:websitesbyleslie01@gmail.com" className="footer-phone">websitesbyleslie01@gmail.com</a>
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
