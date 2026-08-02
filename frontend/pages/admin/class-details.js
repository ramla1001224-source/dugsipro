import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'
import { useLanguage } from '../../context/LanguageContext'
import { LoadingOverlay } from '../../components/DashboardSkeleton'
import Link from 'next/link'

export default function ClassDetails() {
  const router = useRouter()
  const { t } = useLanguage()
  const { className, status, session, shift, isPayment, schoolId } = router.query

  const [details, setDetails] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(true)

  useEffect(() => {
    if (!router.isReady || !className) return
    const fetchDetails = async () => {
      setDetailsLoading(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
      const endpoint = isPayment === 'true' ? 'payment-details' : 'attendance-details'
      
      let query = `status=${status}&shift=${shift}`
      if (isPayment !== 'true' && session) query += `&session=${session}`
      if (schoolId) query += `&schoolId=${schoolId}`

      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'}/api/dashboard/${endpoint}?${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        // Filter by className
        const filtered = (res.data || []).filter(s => (s.class || 'N/A') === className)
        setDetails(filtered)
      } catch (e) {
        console.error('Fetch Details Error:', e?.response?.data || e.message)
      } finally {
        setDetailsLoading(false)
      }
    }
    fetchDetails()
  }, [router.isReady, className, status, session, shift, isPayment, schoolId])

  const selectedStatus = status || ''

  return (
    <Layout title={className ? `${className} Details` : 'Class Details'}>
      {detailsLoading && <LoadingOverlay />}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm border border-slate-100 text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              {className}
            </h1>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">
              {selectedStatus === 'paid' ? t('this_month_paid') : selectedStatus === 'unpaid' ? t('this_month_unpaid') : selectedStatus === 'Pending' ? t('pending_classes_label') : t('today_students').replace('{status}', t(selectedStatus.toLowerCase()))}
              {' • '}
              {t('found_records').replace('{count}', details.length.toString())}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-8 min-h-[50vh]">
          {detailsLoading ? (
            <div className="py-20 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-slate-900 mx-auto"></div></div>
          ) : details.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {details.map((s, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 rounded-3xl bg-slate-50 border border-transparent hover:border-blue-100 hover:shadow-sm transition-all">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xs font-black ${(selectedStatus.toLowerCase().includes('present') || selectedStatus === 'paid') ? 'bg-emerald-100 text-emerald-600' : (selectedStatus.toLowerCase().includes('absent') || selectedStatus === 'unpaid') ? 'bg-rose-100 text-rose-600' : selectedStatus === 'Pending' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-600'}`}>
                    {s.name?.substring(0, 2).toUpperCase() || '??'}
                  </div>
                  <div>
                    <p className="font-black text-slate-800 uppercase tracking-tight text-sm">{s.name}</p>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{s.student_id}</p>
                    {s.parent_name && s.parent_name !== 'N/A' && (
                      <p className="text-[9px] text-blueGrey-500 font-bold uppercase tracking-widest mt-0.5">
                        {t('parent_label')}: {s.parent_name} ({s.parent_phone})
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest">{t('no_records_found')}</div>
          )}
        </div>
      </div>
    </Layout>
  )
}
