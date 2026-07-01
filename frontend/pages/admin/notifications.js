import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function NotificationsLog() {
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
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

    useEffect(() => { fetchNotifications() }, [])

    return (
        <Layout title="System Notifications">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Parent Notifications</h2>
                    <p className="text-gray-400 text-sm">Audit log of SMS and In-App alerts sent to parents</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto w-full">
<table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]">
                            <th className="px-6 py-4">Recipient</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Title</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {notifications.map(n => (
                            <tr key={n.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700">{n.user?.name || 'User'}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider ${n.type === 'SMS' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'}`}>
                                        {n.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-600">{n.title}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${n.status === 'sent' ? 'text-emerald-500' : 'text-orange-500'}`}>
                                        ● {n.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-gray-400">
                                    {new Date(n.created_at).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
</div>
                {notifications.length === 0 && !loading && (
                    <div className="text-center py-12 text-gray-400">
                        <p className="text-lg font-bold">No notifications sent yet</p>
                    </div>
                )}
            </div>
        </Layout>
    )
}
