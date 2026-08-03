import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useLanguage } from '../../../context/LanguageContext'
import { getSchoolBySubdomain } from '../../../utils/tenantHelper'
import { getImageUrl } from '../../../utils/imageHelper'

/**
 * Tenant Portal — /school/[subdomain]
 *
 * This page is served by Next.js middleware when a request arrives at:
 *   subdomain.dugsipro.so       (production)
 *   subdomain.localhost:3000    (local dev)
 *
 * The browser URL stays as the original subdomain URL — the rewrite is
 * transparent.  `router.query.subdomain` contains the extracted subdomain.
 *
 * Behaviour mirrors pages/[shortcode]/index.js but is driven by subdomain
 * rather than a URL path segment.
 */
export default function SubdomainPortal() {
  const router = useRouter()
  const { subdomain } = router.query
  const { t } = useLanguage()

  const [phase, setPhase] = useState('loading') // 'loading' | 'found' | 'branches' | 'not_found' | 'error'
  const [schoolData, setSchoolData] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // ── Fetch tenant on mount / when subdomain is known ──────────────────────
  useEffect(() => {
    if (!router.isReady || !subdomain) return

    let cancelled = false

    const lookup = async () => {
      setPhase('loading')
      setErrorMsg('')

      const data = await getSchoolBySubdomain(subdomain)

      if (cancelled) return

      if (!data) {
        setPhase('not_found')
        return
      }

      setSchoolData(data)

      // Super admin with multiple branches → show branch picker
      if (data.type === 'super_admin' && data.schools?.length >= 1) {
        setPhase('branches')
        return
      }

      // Single school → store and redirect to login
      localStorage.setItem('selectedSchool', JSON.stringify(data))
      const loginUrl = data.shortCode
        ? `/login?school=${data.shortCode}`
        : `/login?school=${subdomain.toUpperCase()}&schoolId=${data.id}`
      router.push(loginUrl)
      // Keep 'loading' phase during redirect
    }

    lookup().catch((err) => {
      if (!cancelled) {
        setErrorMsg(err?.message || 'Khalad ayaa dhacay')
        setPhase('error')
      }
    })

    return () => { cancelled = true }
  }, [router.isReady, subdomain])

  // ── Branch selection handler ──────────────────────────────────────────────
  function handleBranchSelect(branch) {
    const dataToStore = { ...schoolData, ...branch, type: 'school' }
    localStorage.setItem('selectedSchool', JSON.stringify(dataToStore))
    const loginUrl = branch.shortCode
      ? `/login?school=${branch.shortCode}`
      : `/login?school=${subdomain?.toUpperCase()}&schoolId=${branch.id}`
    router.push(loginUrl)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const displayName =
    schoolData?.schoolName || schoolData?.name || subdomain?.toUpperCase() || 'DugsiPro'

  const pageTitle =
    phase === 'not_found'
      ? 'Iskuul lama helin — DugsiPro'
      : `${displayName} — DugsiPro`

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      <Head>
        <title>{pageTitle}</title>
        <meta name="robots" content="noindex" />
      </Head>

      {/* ── Ambient blobs ─────────────────────────────────────────────── */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600/10 blur-[140px] rounded-full -mr-72 -mt-72 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full -ml-56 -mb-56 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-900/10 blur-[160px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 text-center">

        {/* ── Wordmark ──────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-4xl font-black text-white tracking-tighter">
            Dugsi <span className="text-blue-500">Pro</span>
          </h1>
          <p className="text-slate-500 text-sm font-semibold mt-1 tracking-wide">
            {t('system_subtitle') || 'Nidaamka Maareynta Dugsiga'}
          </p>
        </div>

        {/* ── Card ──────────────────────────────────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] shadow-2xl shadow-black/40 overflow-hidden">

          {/* ─── Loading ──────────────────────────────────────────────── */}
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 px-10">
              <div className="relative mb-6">
                <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">🏫</span>
                </div>
              </div>
              <p className="text-white/70 font-bold text-sm tracking-wide animate-pulse">
                {t('searching') || 'Raadinayaa iskuulka...'}
              </p>
              <p className="text-slate-600 text-xs mt-2 font-mono">
                {subdomain?.toLowerCase()}.dugsipro.so
              </p>
            </div>
          )}

          {/* ─── Not Found / 404 ─────────────────────────────────────── */}
          {phase === 'not_found' && (
            <div className="flex flex-col items-center py-14 px-10">
              {/* Animated 404 graphic */}
              <div className="relative mb-8">
                <div className="w-28 h-28 bg-gradient-to-br from-rose-500/20 to-orange-500/10 rounded-[2.5rem] flex items-center justify-center border border-rose-500/25 shadow-[0_0_40px_rgba(244,63,94,0.15)]">
                  <span className="text-5xl select-none">🔍</span>
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500/90 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-xs font-black">404</span>
                </div>
              </div>

              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
                Iskuul lama helin
              </h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed max-w-xs mx-auto">
                Cinwaanka{' '}
                <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-lg font-mono text-xs">
                  {subdomain?.toLowerCase()}
                </code>{' '}
                looguma xidna wax iskuul ah nidaamka DugsiPro.
              </p>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-8 text-left w-full">
                <p className="text-amber-400 text-xs font-bold mb-1">💡 Tilmaan</p>
                <p className="text-amber-300/80 text-xs leading-relaxed">
                  Hubi in cinwaanka loo qoray si sax ah. Haddii aad leedahay code,
                  geli bogga hore oo isticmaal sanduuqa raadinta.
                </p>
              </div>

              <button
                onClick={() => router.push('/')}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-900/30 transition-all duration-300 uppercase tracking-[0.1em] text-sm hover:scale-[1.02] active:scale-[0.98]"
              >
                ← Ku noqo bogga hore
              </button>
            </div>
          )}

          {/* ─── Error ───────────────────────────────────────────────── */}
          {phase === 'error' && (
            <div className="flex flex-col items-center py-14 px-10">
              <div className="w-24 h-24 bg-rose-500/10 rounded-[2rem] flex items-center justify-center mb-6 border border-rose-500/20 text-4xl">
                ⚠️
              </div>
              <h2 className="text-xl font-black text-white mb-3">Khalad ayaa dhacay</h2>
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-2xl text-xs font-bold text-center mb-6 w-full">
                {errorMsg || 'Fadlan mar labaad isku day.'}
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold py-4 rounded-2xl transition-all text-sm"
                >
                  Isku day
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all text-sm"
                >
                  Bogga hore
                </button>
              </div>
            </div>
          )}

          {/* ─── Branch picker (super admin / multi-school group) ─────── */}
          {phase === 'branches' && schoolData && (
            <div className="py-10 px-8">
              {/* Group header */}
              <div className="flex flex-col items-center mb-8">
                <div className="w-24 h-24 bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-md rounded-[2rem] flex items-center justify-center overflow-hidden mb-4 ring-4 ring-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.25)] border-2 border-white/15">
                  {schoolData.logo
                    ? <img src={getImageUrl(schoolData.logo)} alt="" className="w-full h-full object-contain p-2" />
                    : <span className="text-4xl">🏫</span>
                  }
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  {displayName}
                </h2>
                <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full mt-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">
                    {subdomain?.toUpperCase()}
                  </p>
                </div>
                <p className="text-slate-500 text-xs mt-1">
                  {t('multiple_branches_found')?.replace('{shortCode}', displayName)
                    || 'Dooro iskuulka aad rabtid'}
                </p>
              </div>

              {/* Branch list */}
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                {schoolData.schools.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => handleBranchSelect(branch)}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 p-5 rounded-2xl flex items-center gap-5 transition-all group text-left focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <div className="w-16 h-16 bg-gradient-to-br from-white/20 to-white/5 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300 overflow-hidden border border-white/15 flex-shrink-0">
                      {branch.logo
                        ? <img src={getImageUrl(branch.logo)} alt="" className="w-full h-full object-contain p-1" />
                        : '🏫'
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-base group-hover:text-blue-400 transition-colors truncate">
                        {branch.name}
                      </div>
                      <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-0.5">
                        {branch.shortCode || `ID: ${branch.id.split('-')[0]}`}
                      </div>
                      {!branch.isActive && (
                        <span className="inline-block mt-1 text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-bold">
                          Inactive
                        </span>
                      )}
                    </div>
                    <svg
                      className="w-5 h-5 text-blue-500 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 flex-shrink-0"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <button
                  onClick={() => router.push('/')}
                  className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] hover:text-white transition-colors"
                >
                  ← Ku noqo bogga hore
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <p className="mt-10 text-[10px] text-slate-700 font-black uppercase tracking-[0.3em]">
          © DugsiPro · dugsipro.so
        </p>
      </div>
    </div>
  )
}
