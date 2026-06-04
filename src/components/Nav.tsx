export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a href="#hero" className="nav-logo">Leslie Benefield</a>
        <ul className="nav-links">
          <li><a href="#about">About</a></li>
          <li><a href="#services">Services</a></li>
          <li><a href="#work">Work</a></li>
          <li><a href="#process">Process</a></li>
        </ul>
        <a
          href="mailto:mosaichealthapp@gmail.com"
          className="nav-contact-btn"
        >
          Contact
        </a>
      </div>
    </nav>
  )
}
