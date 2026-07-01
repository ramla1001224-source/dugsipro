import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminVirtualClasses() {
    const [meetings, setMeetings] = useState([])
    const [loading, setLoading] = useState(true)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getToken = () => localStorage.getItem('token')

    const fetchData = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/virtual-classes`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setMeetings(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const endMeeting = async (id) => {
        try {
            await axios.put(`${apiUrl}/api/virtual-classes/${id}/status`, { status: 'ended' }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            fetchData()
        } catch (e) {
            alert('Error ending meeting')
        }
    }

    const deleteMeeting = async (id) => {
        if (!confirm('Ma hubtaa inaad tirtirto kulankan?')) return
        try {
            await axios.delete(`${apiUrl}/api/virtual-classes/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            fetchData()
        } catch (e) {
            alert('Error deleting meeting')
        }
    }

    return (
        <Layout title="Maamulka Fasallada Online (Admin)">
            <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Dhammaan Fasallada Zoom</h2>
                <p className="text-gray-400 text-sm">Kala soco oo maamul dhammaan fasallada online-ka ah ee dugsiga</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto w-full">
<table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]">
                            <th className="px-6 py-4">Title</th>
                            <th className="px-6 py-4">Fasalka</th>
                            <th className="px-6 py-4">Macalinka</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Time</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {meetings.map((m) => (
                            <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700">{m.title}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{m.class?.class_name}</td>
                                <td className="px-6 py-4 text-sm text-blue-600 font-medium">{m.teacher?.user?.name}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${m.status === 'live' ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {m.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-400">
                                    {new Date(m.startTime).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                    {m.status === 'live' && (
                                        <button onClick={() => endMeeting(m.id)} className="bg-amber-50 text-amber-600 hover:bg-amber-100 px-3 py-1.5 rounded-lg font-bold text-xs">End</button>
                                    )}
                                    <button onClick={() => deleteMeeting(m.id)} className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-bold text-xs">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
</div>
                {meetings.length === 0 && !loading && (
                    <div className="text-center py-12 text-gray-400">Lama helin wax fasallo online ah.</div>
                )}
            </div>
        </Layout>
    )
}
