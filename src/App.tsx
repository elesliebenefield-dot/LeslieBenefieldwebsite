import Nav from './components/Nav'
import Hero from './components/Hero'
import Value from './components/Value'
import Services from './components/Services'
import Work from './components/Work'
import About from './components/About'
import Process from './components/Process'
import Contact from './components/Contact'
import Footer from './components/Footer'
import BackToTop from './components/BackToTop'
import { useScrollReveal } from './hooks/useScrollReveal'
import beachBg from './assets/backgrounds/beach-background.jpeg'

export default function App() {
  useScrollReveal()

  return (
    <>
      <div className="site-bg" aria-hidden="true">
        <img src={beachBg} alt="" className="site-bg-img" />
        <div className="site-bg-overlay" />
      </div>
      <Nav />
      <main>
        <Hero />
        <Value />
        <Services />
        <Work />
        <About />
        <Process />
        <Contact />
      </main>
      <Footer />
      <BackToTop />
    </>
  )
}
