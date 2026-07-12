import { useEffect, useState } from 'react'
import Head from 'next/head'
import axios from 'axios'
import { useRouter } from 'next/router'
import { useLanguage } from '../../context/LanguageContext'
import { getErrorMessage } from '../../utils/errorHelper'

export default function DirectBranchPortal() {
  const router = useRouter()
  const { shortcode, branchId } = router.query
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { t } = useLanguage()

  useEffect(() => {
    if (!router.isReady) return;
    if (!shortcode || !branchId) return;

    const fetchBranchInfo = async () => {
      setLoading(true)
      setError('')
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
        const res = await axios.get(`${baseUrl}/api/schools/by-code/${shortcode.toUpperCase().trim()}`)

        // If it's a super admin returning multiple branches
        if (res.data.type === 'super_admin' && res.data.schools?.length >= 1) {
          
          // Find the specific branch
          const targetBranch = res.data.schools.find(s => 
            s.id === branchId || 
            s.id.startsWith(branchId) || 
            (s.shortCode && s.shortCode.toLowerCase() === branchId.toLowerCase())
          );

          if (!targetBranch) {
            throw new Error("Faracan lagama helin iskuulkan. (Branch not found)");
          }

          const selectedInfo = res.data;
          
          // Construct data for localStorage
          const dataToStore = { ...selectedInfo, ...targetBranch, type: 'school' }
          localStorage.setItem('selectedSchool', JSON.stringify(dataToStore))

          // Redirect to login
          const targetUrl = targetBranch.shortCode 
            ? `/login?school=${targetBranch.shortCode}`
            : `/login?school=${shortcode.toUpperCase().trim()}&schoolId=${targetBranch.id}`;
            
          router.replace(targetUrl)
          return
        }

        // If it was just a single school, not a group
        if (res.data.id === branchId || res.data.id.startsWith(branchId)) {
          localStorage.setItem('selectedSchool', JSON.stringify(res.data))
          const loginUrl = res.data.shortCode 
            ? `/login?school=${res.data.shortCode}` 
            : `/login?school=${shortcode.toUpperCase().trim()}&schoolId=${res.data.id}`
          router.replace(loginUrl)
        } else {
            throw new Error("Faracan lagama helin iskuulkan. (Branch not found)");
        }
      } catch (err) {
        setError(getErrorMessage(err, t) || err.message || 'Wax baa qaldamay')
        setLoading(false)
      }
    }

    fetchBranchInfo()
  }, [router.isReady, shortcode, branchId])

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      <Head>
        <title>{t('portal_title') || 'Dugsi Pro'}</title>
      </Head>

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -mr-64 -mt-64"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full -ml-48 -mb-48"></div>

      <div className="w-full max-w-lg relative z-10 text-center">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[3.5rem] shadow-2xl">
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
              <h2 className="text-2xl font-bold text-white mb-2">Wax baa qaldamay</h2>
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
          ) : null}
        </div>
      </div>
    </div>
  )
}
