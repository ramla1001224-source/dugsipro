import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function StudentHomework() {
    const [homeworks, setHomeworks] = useState([])
    const [submissions, setSubmissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(null) // hwId being submitted
    const [file, setFile] = useState(null)
    const [content, setContent] = useState('')

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getToken = () => localStorage.getItem('token')

    const fetchData = async () => {
        try {
            setLoading(true)
            const token = getToken()
            if (!token) { window.location.href = '/'; return }
            // Role Guard
            try {
                const payload = JSON.parse(atob(token.split('.')[1]))
                if (payload.role !== 'student') {
                    const d = { owner: '/owner/dashboard', super_admin: '/super-admin/dashboard', admin: '/admin/dashboard', teacher: '/teacher/dashboard', parent: '/parent/dashboard', accountant: '/accountant/dashboard', staff: '/staff/dashboard', librarian: '/librarian/dashboard' }
                    window.location.href = d[payload.role] || '/'; return
                }
            } catch (e) { window.location.href = '/'; return }
            const hwRes = await axios.get(`${apiUrl}/api/homework`, { headers: { Authorization: `Bearer ${token}` } }).catch(e => { console.error('HW error:', e); return { data: [] } });
            const subRes = await axios.get(`${apiUrl}/api/submissions/my`, { headers: { Authorization: `Bearer ${token}` } }).catch(e => { console.error('Sub error:', e); return { data: [] } });

            setHomeworks(hwRes.data)
            setSubmissions(subRes.data)
        } catch (e) {
            console.error('Fetch error:', e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    const getMySubmission = (hwId) => submissions.find(s => s.homeworkId === hwId)

    const handleSubmit = async (hwId) => {
        const data = new FormData()
        data.append('homeworkId', hwId)
        if (content) data.append('content', content)
        if (file) data.append('attachment', file)
        try {
            await axios.post(`${apiUrl}/api/submissions/submit`, data, {
                headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'multipart/form-data' }
            })
            setSubmitting(null)
            setFile(null)
            setContent('')
            fetchData()
        } catch (e) {
            alert(e.response?.data?.message || 'Error submitting homework')
        }
    }

    const statusBadge = (sub) => {
        if (!sub) return <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Lama gudbinin</span>
        const colors = { pending: 'bg-amber-50 text-amber-600', graded: 'bg-emerald-50 text-emerald-600', returned: 'bg-rose-50 text-rose-500' }
        const labels = { pending: '⏳ Sugaya', graded: `✅ ${sub.grade || 'Graded'}`, returned: '↩️ Returned' }
        return <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${colors[sub.status] || 'bg-gray-50 text-gray-500'}`}>{labels[sub.status]}</span>
    }

    return (
        <Layout title="Shaqo-Guri (Homework)">
            <div className="mb-12">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Shaqo-Gurigaaga</h2>
                <p className="text-slate-400 text-sm font-medium">Halkan kala soco casharada guriga laguugu soo dhigay</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {homeworks.map((hw) => {
                    const mySub = getMySubmission(hw.id)
                    const isSubmitting = submitting === hw.id
                    return (
                        <div key={hw.id} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-2xl hover:border-blue-100 transition-all flex flex-col">
                            <div className="flex justify-between items-start mb-6">
                                <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                                    {hw.subject?.name}
                                </span>
                                {statusBadge(mySub)}
                            </div>

                            <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-blue-600 transition-colors uppercase leading-tight">{hw.title}</h3>
                            <p className="text-slate-500 text-xs mb-6 leading-relaxed line-clamp-2 font-medium">
                                {hw.description || 'Ma jiro sharaxaad faahfaahsan oo la socota casharkaan.'}
                            </p>

                            <div className="flex items-center gap-3 mb-8 bg-slate-50/50 p-4 rounded-2xl border border-slate-50">
                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 font-bold text-sm">
                                    {hw.teacher?.user?.name?.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-black text-slate-800">{hw.teacher?.user?.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Macalinka</p>
                                </div>
                                {hw.attachmentUrl && (
                                    <a href={`${apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl}${hw.attachmentUrl.startsWith('/') ? hw.attachmentUrl : `/${hw.attachmentUrl}`}`} target="_blank" rel="noreferrer"
                                        className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    </a>
                                )}
                            </div>

                            <div className="mt-auto space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waqtiga ugu dambeeya:</span>
                                    <span className="text-[10px] font-black text-rose-500 uppercase">{new Date(hw.dueDate).toLocaleDateString()}</span>
                                </div>

                                {mySub?.feedback && (
                                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase mb-1 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                            Faallo Macalinka
                                        </p>
                                        <p className="text-xs text-emerald-800 font-medium leading-relaxed">{mySub.feedback}</p>
                                    </div>
                                )}

                                {isSubmitting ? (
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-bottom-2">
                                        <textarea
                                            placeholder="Jawaabtaada..."
                                            className="w-full p-4 rounded-xl border-none text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white shadow-inner mb-3"
                                            rows={3}
                                            value={content}
                                            onChange={e => setContent(e.target.value)}
                                        />
                                        <div className="flex flex-col gap-3">
                                            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/10 transition-all">
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                <span className="text-xs font-bold text-slate-500">{file ? file.name : 'Lifaaq (Attachment)'}</span>
                                                <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
                                            </label>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleSubmit(hw.id)}
                                                    className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg shadow-slate-200">
                                                    Dir Jawaabta
                                                </button>
                                                <button onClick={() => setSubmitting(null)}
                                                    className="px-6 bg-slate-200 text-slate-600 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 transition-all">
                                                    Xir
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setSubmitting(hw.id)}
                                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all shadow-lg ${mySub ? 'bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100 shadow-none' : 'bg-slate-900 text-white hover:bg-blue-600 shadow-slate-100'}`}
                                    >
                                        {mySub ? '🔄 Update (Dib u dir)' : '📤 Gudbi Jawaabta'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {homeworks.length === 0 && !loading && (
                <div className="bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[3rem] p-24 text-center">
                    <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm border border-slate-100">
                        <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                    <p className="font-black text-slate-300 text-2xl uppercase tracking-tighter">Hada ma jiro wax shaqo-guri ah</p>
                    <p className="text-slate-400 text-sm mt-2 font-medium">Iska rux oo naso macalimiinta shaqo wali ma soo dhigin</p>
                </div>
            )}
        </Layout>
    )
}
