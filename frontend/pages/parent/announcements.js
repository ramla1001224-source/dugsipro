import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useLanguage } from '../../context/LanguageContext'

export default function AnnouncementsView() {
    const [announcements, setAnnouncements] = useState([])
    const [loading, setLoading] = useState(true)
    const { t } = useLanguage()
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

    useEffect(() => {
        const token = localStorage.getItem('token')
        axios.get(`${apiUrl}/api/announcements`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => {
                setAnnouncements(r.data)
                setLoading(false)
            })
            .catch(e => {
                console.error(e)
                setLoading(false)
            })
    }, [])

    const prioConfig = {
        low:    { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-l-slate-300', dot: 'bg-slate-400',  label: 'Hoose'  },
        normal: { bg: 'bg-blue-50',   text: 'text-blue-600',  border: 'border-l-blue-400',  dot: 'bg-blue-500',   label: 'Caadi'  },
        high:   { bg: 'bg-amber-50',  text: 'text-amber-600', border: 'border-l-amber-400', dot: 'bg-amber-500',  label: 'Muhiim' },
        urgent: { bg: 'bg-red-50',    text: 'text-red-600',   border: 'border-l-red-500',   dot: 'bg-red-500',    label: 'Deg-deg'},
    }

    return (
        <Layout title={t('announcements')}>
            <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">📢 {t('announcements')}</h2>
                <p className="text-gray-400 text-sm mt-1">Wararkii ugu dambeeyay ee dugsiga</p>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="bg-white h-32 rounded-2xl animate-pulse border border-gray-100" />)}
                </div>
            ) : announcements.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 text-center border border-dashed border-gray-200 shadow-sm">
                    <div className="text-5xl mb-4">📢</div>
                    <h3 className="text-xl font-black text-slate-800">Ma jiraan ogeysiisyo</h3>
                    <p className="text-gray-400 mt-2">Wali wax ogeysiis ah lama soo dhigin.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {announcements.map(a => {
                        const pc = prioConfig[a.priority] || prioConfig.normal
                        return (
                            <div key={a.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm border-l-4 ${pc.border} hover:shadow-md transition-all overflow-hidden`}>
                                <div className="p-6">
                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${pc.bg} ${pc.text}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${pc.dot}`}></span>{pc.label}
                                        </span>
                                        <span className="text-gray-300 text-xs ml-auto font-bold uppercase tracking-widest">
                                            {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-800 mb-2">{a.title}</h3>
                                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{a.content}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </Layout>
    )
}
