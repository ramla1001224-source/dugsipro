import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']

export default function TeacherTimetable() {
    const [entries, setEntries] = useState([])
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        if (!token) { window.location.href = '/'; return }
        // Role Guard
        try {
            const payload = JSON.parse(atob(token.split('.')[1]))
            if (payload.role !== 'teacher') {
                const d = { owner: '/owner/dashboard', super_admin: '/super-admin/dashboard', admin: '/admin/dashboard', student: '/student/dashboard', parent: '/parent/dashboard', accountant: '/accountant/dashboard', staff: '/staff/dashboard', librarian: '/librarian/dashboard' }
                window.location.href = d[payload.role] || '/'; return
            }
        } catch (e) { window.location.href = '/'; return }
        axios.get(`${apiUrl}/api/timetable`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => setEntries(r.data)).catch(console.error)
    }, [])

    const grouped = DAYS.reduce((acc, day) => { acc[day] = entries.filter(e => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)); return acc }, {})

    return (
        <Layout title="My Schedule">
            <div className="mb-8"><h2 className="text-2xl font-black text-slate-800">My Weekly Schedule</h2><p className="text-gray-400 text-sm">Your teaching timetable</p></div>
            <div className="space-y-4">
                {DAYS.map(day => (
                    <div key={day} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 text-sm font-black text-slate-600 uppercase tracking-widest">{day}</div>
                        {grouped[day]?.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {grouped[day].map(e => (
                                    <div key={e.id} className="px-6 py-4 flex items-center gap-4">
                                        <div className="bg-blue-50 text-blue-600 font-mono text-sm font-bold px-3 py-2 rounded-lg">{e.startTime} - {e.endTime}</div>
                                        <div><p className="font-bold text-slate-800">{e.subject?.name}</p><p className="text-xs text-gray-400 font-bold text-teal-600 mb-1 uppercase tracking-wider">{e.section?.class?.class_name} - {e.section?.name}</p><p className="text-xs text-gray-400">{e.room || 'No room'} · <span className="uppercase font-black text-blue-400">{e.shift}</span></p></div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="px-6 py-4 text-gray-300 text-sm italic">Free</p>}
                    </div>
                ))}
            </div>
        </Layout>
    )
}
