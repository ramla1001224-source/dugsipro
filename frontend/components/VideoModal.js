import { useEffect, useState } from 'react'

export default function VideoModal({ isOpen, onClose, videoUrl, title }) {
    const [ytId, setYtId] = useState(null)

    useEffect(() => {
        if (!videoUrl) {
            setYtId(null)
            return
        }
        const extractYoutubeId = (url) => {
            const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/
            const match = url.match(regExp)
            return match ? match[1] : null
        }
        setYtId(extractYoutubeId(videoUrl))
    }, [videoUrl])

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown)
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'auto'
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = 'auto'
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-12" style={{ animation: 'fadeIn 0.3s ease-out forwards' }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
            
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/90 backdrop-blur-xl transition-opacity cursor-pointer"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div 
                className="relative w-full mx-auto bg-black rounded-3xl sm:rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col z-10 border border-white/10" 
                style={{ 
                    maxWidth: 'min(1920px, 100%)', 
                    maxHeight: 'min(1080px, 90vh)', 
                    aspectRatio: '16/9',
                    animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                }}
            >
                {/* Header */}
                <div className="absolute top-0 inset-x-0 z-20 flex justify-between items-start p-6 sm:p-8 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none">
                    <h3 className="text-white font-black text-xl sm:text-3xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] truncate pr-16">{title || 'Video Lesson'}</h3>
                </div>
                
                {/* Close button */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 sm:top-8 right-6 sm:right-8 z-30 w-12 h-12 sm:w-14 sm:h-14 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 shadow-2xl pointer-events-auto border border-white/20"
                >
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                {/* Video Player */}
                <div className="flex-1 w-full h-full relative bg-black flex items-center justify-center">
                    {ytId ? (
                        <iframe
                            className="w-full h-full"
                            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&vq=hd1080`}
                            title={title || "YouTube video player"}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        ></iframe>
                    ) : (
                        <div className="text-center p-8 text-white z-20">
                            <div className="text-7xl mb-8 opacity-40 transform hover:scale-110 transition-transform">🔗</div>
                            <h3 className="text-3xl font-black mb-4 text-white drop-shadow-lg">Video-gan ma aha YouTube</h3>
                            <p className="text-slate-400 mb-10 max-w-lg mx-auto text-lg leading-relaxed">
                                Casharkan wuxuu ku jiraa meel ka baxsan YouTube (sida Google Drive ama link toos ah). Waa in aad bannaanka ka daawato.
                            </p>
                            <a 
                                href={videoUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-4 px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all transform hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(37,99,235,0.4)] shadow-xl active:scale-95"
                            >
                                Ka Daawo Dibadda
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
