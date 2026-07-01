import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']

export default function StudentTimetable() {
    const [entries, setEntries] = useState([])
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        if (!token) { window.location.href = '/'; return }
        // Role Guard
        try {
            const payload = JSON.parse(atob(token.split('.')[1]))
            if (payload.role !== 'student') {
                const d = { owner: '/owner/dashboard', super_admin: '/super-admin/dashboard', admin: '/admin/dashboard', teacher: '/teacher/dashboard', parent: '/parent/dashboard', accountant: '/accountant/dashboard', staff: '/staff/dashboard', librarian: '/librarian/dashboard' }
                window.location.href = d[payload.role] || '/'; return
            }
        } catch (e) { window.location.href = '/'; return }
        axios.get(`${apiUrl}/api/timetable`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => setEntries(r.data)).catch(console.error)
    }, [])

    const grouped = DAYS.reduce((acc, day) => { acc[day] = entries.filter(e => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)); return acc }, {})

    return (
        <Layout title="My Timetable">
            <div className="mb-8"><h2 className="text-2xl font-black text-slate-800">My Class Schedule</h2><p className="text-gray-400 text-sm">Weekly class timetable</p></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {DAYS.map(day => (
                    <div key={day} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-indigo-50 px-5 py-3 text-sm font-black text-indigo-600 uppercase tracking-widest">{day}</div>
                        <div className="p-4 space-y-2">
                            {grouped[day]?.length > 0 ? grouped[day].map(e => (
                                <div key={e.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                    <div className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded">{e.startTime}</div>
                                    <div><p className="text-sm font-bold text-slate-800">{e.subject?.name}</p><p className="text-[10px] text-gray-400 font-bold text-indigo-500 uppercase">{e.section?.class?.class_name} - {e.section?.name}</p><p className="text-[10px] text-gray-400">{e.teacher?.user?.name} · {e.room || '-'} · <span className="uppercase font-black text-indigo-400">{e.shift}</span></p></div>
                                </div>
                            )) : <p className="text-gray-300 text-sm italic p-3">No classes</p>}
                        </div>
                    </div>
                ))}
            </div>
        </Layout>
    )
}
