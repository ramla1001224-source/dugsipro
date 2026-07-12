import { useState, useEffect } from 'react'
import Head from 'next/head'
import axios from 'axios'
import { useRouter } from 'next/router'
import { useLanguage } from '../context/LanguageContext'
import { getImageUrl } from '../utils/imageHelper'
import { getErrorMessage } from '../utils/errorHelper'

export default function Portal() {
  const [shortCode, setShortCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { t } = useLanguage()

  const [schools, setSchools] = useState([]) // For multi-school selection
  const [selectedInfo, setSelectedInfo] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Auto-redirect: haddii token hore loo keydiyay, toos u celi dashboardka
  useEffect(() => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const now = Math.floor(Date.now() / 1000)
        if (payload.exp && payload.exp > now) {
          // Token wali waa saxan yahay — toos u celi
          const dashboards = {
            owner: '/owner/dashboard',
            super_admin: '/super-admin/dashboard',
            admin: '/admin/dashboard',
            teacher: '/teacher/dashboard',
            parent: '/parent/dashboard',
            accountant: '/accountant/dashboard',
            staff: '/staff/dashboard',
            librarian: '/librarian/dashboard',
            student: '/student/dashboard'
          }
          const role = (payload.role || '').toLowerCase()
          window.location.replace(dashboards[role] || '/student/dashboard')
          return
        } else {
          // Token waa dhammaatay — nadiifi
          localStorage.removeItem('token')
          localStorage.removeItem('role')
        }
      }
    } catch (e) {
      // Token khaldan — nadiifi
      localStorage.removeItem('token')
      localStorage.removeItem('role')
    }
    setCheckingAuth(false)
  }, [])

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    )
  }

  const handleEnter = async (e) => {
    if (e) e.preventDefault()
    if (!shortCode) return
    setLoading(true)
    setError('')
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
      const res = await axios.get(`${baseUrl}/api/schools/by-code/${shortCode.toUpperCase().trim()}`)

      if (res.data.type === 'super_admin' && res.data.schools?.length >= 1) {
        setSchools(res.data.schools)
        setSelectedInfo(res.data)
        setLoading(false)
        return
      }

      // Store school info in session/local storage for the login page
      localStorage.setItem('selectedSchool', JSON.stringify(res.data))

      // Redirect to login with the context
      const loginUrl = res.data.shortCode ? `/login?school=${res.data.shortCode}` : `/login?school=${shortCode.toUpperCase().trim()}&schoolId=${res.data.id}`
      router.push(loginUrl)
    } catch (err) {
      setError(getErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSchool = (school) => {
    const data = { ...selectedInfo, ...school, type: 'school' }
    localStorage.setItem('selectedSchool', JSON.stringify(data))
    
    // Instead of relying on Next.js router which might fail here, we force navigation
    const targetUrl = school.shortCode 
      ? `/login?school=${school.shortCode}`
      : `/login?school=${shortCode.toUpperCase().trim()}&schoolId=${school.id}`;
      
    window.location.href = targetUrl;
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      <Head>
        <title>{t('portal_title')}</title>
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
          {schools.length > 0 ? (
            <div className="flex flex-col items-center mb-8">
              {/* School Logo */}
              <div className="w-44 h-44 bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-md rounded-[2.8rem] flex items-center justify-center overflow-hidden mb-6 ring-4 ring-blue-500/40 shadow-[0_0_40px_rgba(59,130,246,0.35)] hover:scale-110 hover:shadow-[0_0_60px_rgba(59,130,246,0.5)] transition-all duration-500 border-2 border-white/25">
                {selectedInfo?.logo
                  ? <img src={getImageUrl(selectedInfo.logo)} alt="" className="w-full h-full object-contain p-2" />
                  : <span className="text-7xl">🏫</span>
                }
              </div>
              {/* School Group Name */}
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">{selectedInfo?.schoolName || selectedInfo?.name || shortCode.toUpperCase()}</h2>
              <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">Code: {shortCode.toUpperCase()}</p>
              </div>
              <p className="text-slate-400 text-xs">{t('multiple_branches_found').replace('{shortCode}', selectedInfo?.schoolName || selectedInfo?.name || shortCode.toUpperCase())}</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">{t('school_portal')}</h2>
              <p className="text-slate-400 text-sm mb-8">{t('enter_shortcode_instruction')}</p>
            </>
          )}

          {schools.length > 0 ? (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {schools.map(school => {
                const targetUrl = school.shortCode 
                  ? `/login?school=${school.shortCode}`
                  : `/login?school=${shortCode.toUpperCase().trim()}&schoolId=${school.id}`;
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
              <button 
                onClick={() => { setSchools([]); setError(''); }}
                className="w-full text-center py-4 text-xs font-black text-slate-500 uppercase tracking-[0.2em] hover:text-white transition-colors mt-4"
              >
                ← {t('use_different_code')}
              </button>
              
              <div className="mt-8 pt-6 pb-8 border-t border-white/5 flex flex-col items-center gap-3">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em] text-center">
                  {t('restricted_master_access')}
                </p>
                <button
                  onClick={() => router.push(`/login?school=${shortCode.toUpperCase().trim()}`)}
                  className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-xs font-bold px-6 py-3 rounded-xl transition-all uppercase tracking-widest"
                >
                  {t('super_admin_login')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleEnter} className="space-y-6 text-left">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">{t('unique_shortcode')}</label>
                <input
                  type="text"
                  value={shortCode}
                  onChange={e => setShortCode(e.target.value)}
                  placeholder="E.g. HAMAR, SOOL, BANADIR"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-xl font-bold text-white uppercase placeholder:normal-case placeholder:text-white/20 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all tracking-widest text-center"
                  autoFocus
                />
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-bold text-center">
                  {error}
                </div>
              )}

              <button
                disabled={loading || !shortCode}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-900/20 transition-all transform active:scale-[0.98] uppercase tracking-[0.1em] text-sm"
              >
                {loading ? t('searching') : t('continue_to_login')}
              </button>
            </form>
          )}


        </div>

        <p className="mt-12 text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">© School Systems</p>
      </div>
    </div>
  )
}
