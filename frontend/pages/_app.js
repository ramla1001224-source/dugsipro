import '../styles/globals.css'
import dynamic from 'next/dynamic'
import { LanguageProvider } from '../context/LanguageContext'

// Dynamically import OfflineBanner (client-only – uses navigator.onLine)
const OfflineBanner = dynamic(() => import('../components/OfflineBanner'), {
  ssr: false,
})

// AdBanner loaded dynamically (client-only) – mounted ONCE here so page
// navigations don't remount it and the 3-page counter stays accurate.
const AdBanner = dynamic(() => import('../components/AdBanner'), {
  ssr: false,
})

export default function MyApp({ Component, pageProps }) {
  return (
    <LanguageProvider>
      {/* Global offline status bar */}
      <OfflineBanner />
      {/* Ad popup – shows every 3 page navigations, skips admin/owner roles */}
      <AdBanner />
      <Component {...pageProps} />
    </LanguageProvider>
  )
}
