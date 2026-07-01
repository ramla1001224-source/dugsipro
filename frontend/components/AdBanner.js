import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getImageUrl } from '../utils/imageHelper';

export default function AdBanner() {
  const [ad, setAd] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAndShowAd = async (url) => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Don't show ads for admin/owner/super_admin
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const role = payload.role || '';
          if (['admin', 'super_admin', 'owner'].includes(role)) {
            console.log('[AdBanner] Admin/Owner role, skipping ad');
            return;
          }
        } catch (e) { return; }

        let current = parseInt(localStorage.getItem('ad_page_views') || '0', 10);
        current += 1;
        
        console.log('[AdBanner] Page view:', current, '| URL:', url);

        if (current >= 3) {
          console.log('[AdBanner] Hit 3 pages! Fetching ad...');
          // Reset counter immediately so next views start at 1
          localStorage.setItem('ad_page_views', '0');
          
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
          const res = await fetch(`${apiUrl}/api/ads/custom`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
            const data = await res.json();
            console.log('[AdBanner] Data:', data);
            // Web ONLY shows custom ad. If useGoogle is true, the owner selected Google AdMob (for apps).
            if (data && data.isActive && data.useGoogle !== true) {
              setAd(data);
              setShowAd(true);
            } else {
              console.log('[AdBanner] Ad is inactive or set to Google AdMob.');
            }
          }
        } else {
          // Not yet 3 views, just save new count
          localStorage.setItem('ad_page_views', current.toString());
        }
      } catch (err) {
        console.error('[AdBanner] Error:', err);
      }
    };

    // 1. Check immediately when component mounts (handles full page refreshes)
    checkAndShowAd(window.location.pathname);

    // 2. Check on client-side route changes
    router.events.on('routeChangeComplete', checkAndShowAd);
    return () => {
      router.events.off('routeChangeComplete', checkAndShowAd);
    };
  }, []);

  if (!showAd || !ad) return null;

  const handleDismissAd = () => {
    setShowAd(false);
    setAd(null);
  };

  const handleAction = () => {
    if (ad.linkUrl) {
      window.open(ad.linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const fullImageUrl = ad.imageUrl
    ? (ad.imageUrl.startsWith('http') ? ad.imageUrl : getImageUrl(ad.imageUrl))
    : null;

  return (
    <>
      {/* Main Ad Modal */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-600 shadow-2xl shadow-indigo-500/20 border border-white/20 animate-slide-up">

          {/* Decorative background elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10 flex flex-col p-8 items-center text-center">

            {/* Close Button */}
            <button
              onClick={handleDismissAd}
              className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 backdrop-blur-md transition-colors z-20"
              aria-label="Close Advertisement"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Label */}
            <div className="inline-block px-4 py-1.5 mb-6 text-xs font-black tracking-[0.2em] uppercase bg-white/20 text-white rounded-full backdrop-blur-md border border-white/30 shadow-sm">
              OGAYSIIS MUHIIM AH
            </div>

            {/* Ad Image */}
            {fullImageUrl && (
              <div
                className="relative w-full aspect-video sm:h-56 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/30 bg-white/10 mb-6 cursor-pointer group"
                onClick={() => setIsZoomed(true)}
              >
                <img
                  src={fullImageUrl}
                  alt={ad.title || 'Advertisement'}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* Ad Content */}
            <h3 className="text-2xl sm:text-3xl font-black text-white mb-3 leading-tight drop-shadow-md">
              {ad.title}
            </h3>
            <p className="text-base sm:text-lg font-medium text-white/90 mb-8 max-w-sm">
              {ad.subtitle}
            </p>

            {/* CTA Button */}
            {ad.linkUrl && (
              <button
                onClick={handleAction}
                className="group/btn relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-4 bg-white text-indigo-700 rounded-2xl font-black text-base uppercase tracking-widest shadow-xl hover:shadow-white/25 transition-all hover:-translate-y-1 active:translate-y-0 overflow-hidden"
              >
                <div className="absolute inset-0 w-0 bg-gradient-to-r from-indigo-50 to-blue-50 transition-all duration-300 ease-out group-hover/btn:w-full"></div>
                <span className="relative z-10">{ad.ctaText || 'Booqo Hadda'}</span>
                <svg className="relative z-10 w-5 h-5 transform group-hover/btn:translate-x-1.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Zoom Lightbox */}
      {isZoomed && fullImageUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in p-4"
          onClick={() => setIsZoomed(false)}
        >
          <button
            onClick={() => setIsZoomed(false)}
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-3 backdrop-blur-md transition-colors z-[210]"
            aria-label="Close Image"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={fullImageUrl}
            alt="Zoomed Ad"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-zoom-in"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
