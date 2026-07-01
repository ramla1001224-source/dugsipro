import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useLanguage } from '../../context/LanguageContext'

export default function StudentNotifications() {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const { t } = useLanguage()
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

    const fetchNotifications = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/notifications`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
            setNotifications(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem('token')
            await Promise.all(notifications.filter(n => n.status !== 'read').map(n => 
                axios.put(`${apiUrl}/api/notifications/${n.id}/read`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ))
            fetchNotifications()
        } catch (e) { console.error(e) }
    }

    useEffect(() => { fetchNotifications() }, [])

    return (
        <Layout title={t('notifications')}>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('notifications')}</h2>
                    <p className="text-gray-400 text-sm">Ogeysiisyada muhiimka ah ee kugu saabsan</p>
                </div>
                {notifications.some(n => n.status !== 'read') && (
                    <button 
                        onClick={markAllAsRead}
                        className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all"
                    >
                        Mark all as read
                    </button>
                )}
            </div>

            <div className="grid gap-4">
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                ) : notifications.length > 0 ? (
                    notifications.map(n => (
                        <div 
                            key={n.id} 
                            className={`bg-white p-6 rounded-2xl shadow-sm border transition-all ${n.status !== 'read' ? 'border-blue-200 bg-blue-50/10' : 'border-gray-100'}`}
                        >
                            <div className="flex gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                                    {n.type === 'ANNOUNCEMENT' ? '📢' : n.type === 'ATTENDANCE' ? '📅' : n.type === 'EXAM' ? '📝' : '🔔'}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-black text-slate-800 tracking-tight">{n.title}</h3>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            {new Date(n.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-slate-600 mt-2 text-sm leading-relaxed">{n.message}</p>
                                    <div className="mt-4 flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${n.status === 'read' ? 'bg-gray-100 text-gray-400' : 'bg-emerald-100 text-emerald-600'}`}>
                                            {n.status === 'read' ? 'Read' : 'New Alert'}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400">• {n.type}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white p-16 rounded-3xl border border-dashed border-gray-200 text-center">
                        <div className="text-5xl mb-4">🔔</div>
                        <h3 className="text-xl font-black text-slate-800">No Notifications</h3>
                        <p className="text-gray-400 mt-2">You are all caught up!</p>
                    </div>
                )}
            </div>
        </Layout>
    )
}
