import { useState, useEffect } from 'react'
import Head from 'next/head'
import axios from 'axios'
import { useRouter } from 'next/router'
import { useLanguage } from '../../context/LanguageContext'
import { getImageUrl } from '../../utils/imageHelper'
import { getErrorMessage } from '../../utils/errorHelper'

export default function DirectSchoolPortal() {
  const router = useRouter()
  const { shortcode } = router.query
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { t } = useLanguage()

  const [schools, setSchools] = useState([]) 
  const [selectedInfo, setSelectedInfo] = useState(null)

  useEffect(() => {
    if (!router.isReady) return;
    if (!shortcode) return;

    const fetchSchoolInfo = async () => {
      setLoading(true)
      setError('')
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
        const res = await axios.get(`${baseUrl}/api/schools/by-code/${shortcode.toUpperCase().trim()}`)

        if (res.data.type === 'super_admin' && res.data.schools?.length >= 1) {
          setSchools(res.data.schools)
          setSelectedInfo(res.data)
          setLoading(false)
          return
        }

        // Store school info in session/local storage for the login page
        localStorage.setItem('selectedSchool', JSON.stringify(res.data))

        // Redirect to login with the context
        const loginUrl = res.data.shortCode ? `/login?school=${res.data.shortCode}` : `/login?school=${shortcode.toUpperCase().trim()}&schoolId=${res.data.id}`
        router.push(loginUrl)
      } catch (err) {
        setError(getErrorMessage(err, t) || 'Iskuulka lama helin')
      } finally {
        setLoading(false)
      }
    }

    fetchSchoolInfo()
  }, [router.isReady, shortcode])

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      <Head>
        <title>{selectedInfo?.schoolName || selectedInfo?.name || shortcode || t('portal_title')}</title>
      </Head>

      {/* Background Decorations */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -mr-64 -mt-64"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full -ml-48 -mb-48"></div>

      <div className="w-full max-w-lg relative z-10 text-center">
        <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">
            Dugsi Pro <span className="text-blue-500">System</span>
          </h1>
          <p className="text-slate-400 text-lg font-medium">{t('system_subtitle')}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 duration-500 delay-200">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
               <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
               <p className="text-white/60 font-bold animate-pulse">{t('searching') || 'Raadinayaa...'}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 bg-rose-500/10 rounded-[2rem] flex items-center justify-center mb-6 border border-rose-500/20 text-rose-500 text-4xl">
                 ⚠️
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Iskuul lama helin</h2>
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-bold text-center mb-6 w-full">
                {error}
              </div>
              <button
                onClick={() => router.push('/')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl transition-all uppercase tracking-[0.1em] text-sm"
              >
                Ku noqo bogga hore
              </button>
            </div>
          ) : schools.length > 0 ? (
            <>
              <div className="flex flex-col items-center mb-8">
                {/* School Logo */}
                <div className="w-44 h-44 bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-md rounded-[2.8rem] flex items-center justify-center overflow-hidden mb-6 ring-4 ring-blue-500/40 shadow-[0_0_40px_rgba(59,130,246,0.35)] hover:scale-110 hover:shadow-[0_0_60px_rgba(59,130,246,0.5)] transition-all duration-500 border-2 border-white/25">
                  {selectedInfo?.logo
                    ? <img src={getImageUrl(selectedInfo.logo)} alt="" className="w-full h-full object-contain p-2" />
                    : <span className="text-7xl">🏫</span>
                  }
                </div>
                {/* School Group Name */}
                <h2 className="text-2xl font-black text-white mb-2 tracking-tight">{selectedInfo?.schoolName || selectedInfo?.name || shortcode?.toUpperCase()}</h2>
                <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">Code: {shortcode?.toUpperCase()}</p>
                </div>
                <p className="text-slate-400 text-xs">{t('multiple_branches_found')?.replace('{shortCode}', selectedInfo?.schoolName || selectedInfo?.name || shortcode?.toUpperCase())}</p>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {schools.map(school => {
                  const targetUrl = school.shortCode 
                    ? `/login?school=${school.shortCode}`
                    : `/login?school=${shortcode?.toUpperCase().trim()}&schoolId=${school.id}`;
                  return (
                  <a
                    key={school.id}
                    href={targetUrl}
                    onClick={(e) => {
                      const data = { ...selectedInfo, ...school, type: 'school' };
                      localStorage.setItem('selectedSchool', JSON.stringify(data));
                    }}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 p-6 rounded-3xl flex items-center gap-6 transition-all group text-left block"
                  >
                    <div className="w-20 h-20 bg-gradient-to-br from-white/20 to-white/5 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-all duration-300 overflow-hidden border border-white/20 shadow-lg flex-shrink-0">
                      {school.logo ? <img src={getImageUrl(school.logo)} alt="" className="w-full h-full object-contain p-1" /> : '🏫'}
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-bold text-lg group-hover:text-blue-400 transition-colors">{school.name}</div>
                      <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        {school.shortCode || `ID: ${school.id.split('-')[0]}`}
                      </div>
                    </div>
                    <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </a>
                  )
                })}
                
                <div className="mt-8 pt-6 pb-8 border-t border-white/5 flex flex-col items-center gap-3">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em] text-center">
                    Ma dooneysaa iskuul kale?
                  </p>
                  <button
                    onClick={() => router.push('/')}
                    className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] hover:text-white transition-colors"
                  >
                    ← Ku noqo bogga hore
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <p className="mt-12 text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">© School Systems</p>
      </div>
    </div>
  )
}
