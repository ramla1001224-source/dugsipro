import Layout from '../../components/Layout'
import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'

export default function StudentVirtualClasses() {
    const [meetings, setMeetings] = useState([])
    const [loading, setLoading] = useState(true)
    const [subjectFilter, setSubjectFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('live')

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getToken = () => localStorage.getItem('token')

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch all, not just live — so student can see upcoming too
                const res = await axios.get(`${apiUrl}/api/virtual-classes`, {
                    headers: { Authorization: `Bearer ${getToken()}` }
                })
                setMeetings(Array.isArray(res.data) ? res.data : [])
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    // Unique subjects
    const subjects = useMemo(() => {
        const seen = new Set()
        return meetings
            .map(m => m.subject)
            .filter(s => s && !seen.has(s.id) && seen.add(s.id))
    }, [meetings])

    // Filtered meetings
    const filtered = useMemo(() => {
        return meetings.filter(m => {
            const matchSubject = subjectFilter === 'all' || m.subject?.id === subjectFilter
            const matchStatus = statusFilter === 'all' || m.status === statusFilter
            return matchSubject && matchStatus
        })
    }, [meetings, subjectFilter, statusFilter])

    const liveCount = meetings.filter(m => m.status === 'live').length
    const upcomingCount = meetings.filter(m => m.status === 'upcoming' || m.status === 'scheduled').length

    const subjectColors = ['rose', 'violet', 'blue', 'emerald', 'amber', 'cyan', 'fuchsia', 'orange']
    const colorMap = {
        rose:    { active: 'bg-rose-600 text-white border-rose-600 shadow-rose-200',    idle: 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' },
        violet:  { active: 'bg-violet-600 text-white border-violet-600 shadow-violet-200', idle: 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100' },
        blue:    { active: 'bg-blue-600 text-white border-blue-600 shadow-blue-200',    idle: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' },
        emerald: { active: 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-200', idle: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
        amber:   { active: 'bg-amber-500 text-white border-amber-500 shadow-amber-200', idle: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' },
        cyan:    { active: 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-200',    idle: 'bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100' },
        fuchsia: { active: 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-fuchsia-200', idle: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200 hover:bg-fuchsia-100' },
        orange:  { active: 'bg-orange-500 text-white border-orange-500 shadow-orange-200', idle: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' },
    }

    return (
        <Layout title="Fasallada Live-ka ah">
            <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">📹 Fasallada Live-ka ah (Zoom)</h2>
                <p className="text-gray-400 text-sm">Ku biir fasallada hada socda ama soo socda</p>
            </div>

            {/* ── Status Filter ── */}
            <div className="flex gap-3 mb-6">
                {[
                    { key: 'all', label: '🗂️ Dhammaantood', count: meetings.length },
                    { key: 'live', label: '🔴 Live Hadda', count: liveCount },
                    { key: 'upcoming', label: '🕐 Soo Socda', count: upcomingCount },
                ].map(({ key, label, count }) => (
                    <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        className={`flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border ${statusFilter === key
                            ? key === 'live'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-200'
                                : 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200'
                            : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                    >
                        {label} <span className="opacity-60">({count})</span>
                    </button>
                ))}
            </div>

            {/* ── Subject Filter ── */}
            {subjects.length > 0 && (
                <div className="mb-8 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">🎯 Shaandhayn Maadada</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSubjectFilter('all')}
                            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${subjectFilter === 'all'
                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                        >
                            🗂️ Dhammaan ({meetings.length})
                        </button>
                        {subjects.map((s, idx) => {
                            const col = subjectColors[idx % subjectColors.length]
                            const count = meetings.filter(m => m.subject?.id === s.id).length
                            const isActive = subjectFilter === s.id
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setSubjectFilter(isActive ? 'all' : s.id)}
                                    className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${isActive ? `${colorMap[col].active} shadow-lg` : colorMap[col].idle}`}
                                >
                                    {s.name} ({count})
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1,2,3].map(i => <div key={i} className="bg-slate-50 rounded-[2.5rem] h-60 animate-pulse" />)
                ) : filtered.map((m) => {
                    const isLive = m.status === 'live'
                    return (
                        <div key={m.id} className={`bg-white p-8 rounded-[2.5rem] border shadow-sm relative overflow-hidden group transition-all hover:shadow-2xl ${isLive ? 'border-rose-100 hover:border-rose-200' : 'border-slate-100 hover:border-blue-100'}`}>
                            {isLive && (
                                <div className="absolute top-0 right-0 bg-rose-500 text-white px-6 py-2 rounded-bl-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                                    Live Now
                                </div>
                            )}
                            {!isLive && (
                                <div className="absolute top-0 right-0 bg-blue-500 text-white px-6 py-2 rounded-bl-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em]">
                                    Soo Socda
                                </div>
                            )}

                            <div className="mt-4 mb-1">
                                <h3 className="font-black text-slate-800 text-xl">{m.title}</h3>
                            </div>
                            <p className={`text-[10px] font-black uppercase tracking-widest mb-6 ${isLive ? 'text-rose-500' : 'text-blue-500'}`}>
                                {m.subject?.name || 'Maado'}
                            </p>

                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">{m.teacher?.user?.name}</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Macalinka</p>
                                </div>
                            </div>

                            {m.scheduledAt && (
                                <div className="flex items-center gap-2 mb-4 bg-slate-50 p-3 rounded-2xl">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span className="text-[11px] font-bold text-slate-500">{new Date(m.scheduledAt).toLocaleString()}</span>
                                </div>
                            )}

                            {isLive ? (
                                <a href={m.meetingUrl} target="_blank" rel="noreferrer"
                                    className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black text-center text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-200">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                                    Ku Biir (Join Class)
                                </a>
                            ) : (
                                <div className="w-full bg-slate-50 border border-slate-200 text-slate-400 py-4 rounded-2xl font-black text-center text-xs uppercase tracking-widest">
                                    ⏳ Wali ma bilaaban
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {filtered.length === 0 && !loading && (
                <div className="bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem] p-20 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="font-black text-slate-300 text-xl uppercase tracking-tighter">
                        {subjectFilter !== 'all'
                            ? `Ma jiro fasal ${subjects.find(s=>s.id===subjectFilter)?.name || ''} ah`
                            : 'Hada ma jiro Fasal Live ah oo socda.'}
                    </p>
                    {subjectFilter !== 'all' && (
                        <button onClick={() => setSubjectFilter('all')} className="mt-6 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all">
                            Dhammaantood Arag
                        </button>
                    )}
                </div>
            )}
        </Layout>
    )
}
