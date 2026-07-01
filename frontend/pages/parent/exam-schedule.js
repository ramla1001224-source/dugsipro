import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function ParentExamSchedule() {
    const [children, setChildren] = useState([])
    const [selectedChild, setSelectedChild] = useState(null)
    const [exams, setExams] = useState([])
    const [loading, setLoading] = useState(true)
    const [examsLoading, setExamsLoading] = useState(false)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        const fetchChildren = async () => {
            const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
            if (!token) { window.location.href = '/'; return }
            
            try {
                const res = await axios.get(`${apiUrl}/api/parents/my-children`, { headers: headers() })
                const data = res.data?.data || (Array.isArray(res.data) ? res.data : [])
                setChildren(data)
                if (data.length > 0) {
                    setSelectedChild(data[0])
                }
            } catch (err) {
                console.error('Error fetching children:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchChildren()
    }, [])

    useEffect(() => {
        if (!selectedChild) return

        const fetchExams = async () => {
            setExamsLoading(true)
            try {
                const res = await axios.get(`${apiUrl}/api/exams?classId=${selectedChild.classId}${selectedChild.sectionId ? `&sectionId=${selectedChild.sectionId}` : ''}`, { headers: headers() })
                const data = Array.isArray(res.data) ? res.data : (res.data.data || [])
                
                const upcoming = data
                    .filter(ex => ex.date)
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                
                setExams(upcoming)
            } catch (err) {
                console.error('Error fetching exams:', err)
            } finally {
                setExamsLoading(false)
            }
        }
        fetchExams()
    }, [selectedChild])

    if (loading) {
        return (
            <Layout title="Exam Schedule">
                <div className="flex justify-center p-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout title="Exam Schedule">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Jadwalka Imtixaanka</h2>
                    <p className="text-gray-400 font-medium text-sm uppercase tracking-widest">Upcoming examination timetable for your children</p>
                </div>

                {children.length > 1 && (
                    <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
                        {children.map(child => (
                            <button
                                key={child.id}
                                onClick={() => setSelectedChild(child)}
                                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedChild?.id === child.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {child.user?.name.split(' ')[0]}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedChild && (
                <div className="bg-indigo-600 rounded-[2.5rem] p-8 mb-10 text-white shadow-xl shadow-indigo-100 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
                            {selectedChild.user?.name?.[0]}
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{selectedChild.user?.name}</h3>
                            <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">{selectedChild.clss?.class_name} {selectedChild.section?.name ? `- ${selectedChild.section.name}` : ''}</p>
                        </div>
                    </div>
                    <div className="bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Total Exams Scheduled</p>
                        <p className="text-xl font-black">{exams.length}</p>
                    </div>
                </div>
            )}

            {examsLoading ? (
                <div className="flex justify-center p-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            ) : exams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exams.map((ex) => {
                        const examDate = new Date(ex.date)
                        const isToday = new Date().toDateString() === examDate.toDateString()
                        
                        return (
                            <div key={ex.id} className={`bg-white rounded-[2rem] p-8 border-2 ${isToday ? 'border-orange-500 shadow-orange-100 shadow-2xl' : 'border-slate-50 shadow-slate-100 shadow-xl'} transition-all hover:-translate-y-2`}>
                                <div className="flex justify-between items-start mb-6">
                                    <div className={`p-4 rounded-2xl ${isToday ? 'bg-orange-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    {isToday && <span className="bg-orange-100 text-orange-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">Maanta (Today)</span>}
                                </div>
                                
                                <h3 className="text-xl font-black text-slate-800 mb-2 truncate">{ex.subject?.name}</h3>
                                <p className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-widest">{ex.name}</p>
                                
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                                        <div className="text-indigo-600">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waqtiga (Time)</p>
                                            <p className="text-sm font-black text-slate-700">{examDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                                        <div className="text-emerald-600">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Maalinta (Date)</p>
                                            <p className="text-sm font-black text-slate-700">{examDate.toLocaleDateString('so-SO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                        </div>
                                    </div>

                                    {ex.description && (
                                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Fiiro gaar ah (Notes)</p>
                                            <p className="text-xs font-bold text-amber-700 leading-relaxed">{ex.description}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] p-20 text-center border-2 border-dashed border-slate-100">
                    <div className="text-6xl mb-6 grayscale opacity-20">📅</div>
                    <h3 className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">Ma jirto jadwalka imtixaan oo hada yaala</h3>
                    <p className="text-slate-300 text-[10px] mt-2 italic">Exams that have been scheduled will appear here</p>
                </div>
            )}
        </Layout>
    )
}
