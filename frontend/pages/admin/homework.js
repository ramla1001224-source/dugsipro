import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminHomework() {
    const [homeworks, setHomeworks] = useState([])
    const [classes, setClasses] = useState([])
    const [subjects, setSubjects] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const [selectedSubject, setSelectedSubject] = useState('')
    const [loading, setLoading] = useState(true)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getToken = () => localStorage.getItem('token')
    const headers = () => ({ Authorization: `Bearer ${getToken()}` })

    const fetchInitial = async () => {
        try {
            const [cRes, sRes] = await Promise.all([
                axios.get(`${apiUrl}/api/classes`, { headers: headers() }),
                axios.get(`${apiUrl}/api/subjects`, { headers: headers() })
            ])
            setClasses(cRes.data)
            setSubjects(sRes.data)
        } catch (e) { console.error(e) }
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/homework?classId=${selectedClass}&subjectId=${selectedSubject}`, {
                headers: headers()
            })
            setHomeworks(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchInitial() }, [])
    useEffect(() => { fetchData() }, [selectedClass, selectedSubject])

    const deleteHomework = async (id) => {
        if (!confirm('Ma hubtaa inaad tirtirto shaqo-gurigan?')) return
        try {
            await axios.delete(`${apiUrl}/api/homework/${id}`, {
                headers: headers()
            })
            fetchData()
        } catch (e) {
            alert('Error deleting homework')
        }
    }

    return (
        <Layout title="Maamulka Shaqo-Guriga">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Homework Management</h2>
                    <p className="text-gray-400 font-medium">Review and manage all assigned homework</p>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Class</label>
                        <select className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                            <option value="">All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black uppercase text-gray-400 mb-1 ml-1 tracking-widest">Subject</label>
                        <select className="bg-gray-50 border-none rounded-2xl px-5 py-3 font-bold text-slate-700 outline-none" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                            <option value="">All Subjects</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
                <div className="overflow-x-auto w-full">
<table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
                            <th className="px-8 py-6">Homework Details</th>
                            <th className="px-8 py-6">Assignee Info</th>
                            <th className="px-8 py-6 text-center">Due Date</th>
                            <th className="px-8 py-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="4" className="text-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                        ) : homeworks.length > 0 ? (
                            homeworks.map((hw) => (
                                <tr key={hw.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="font-black text-slate-800 text-lg group-hover:text-blue-600 transition-colors uppercase">{hw.title}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">{hw.subject?.name}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="font-bold text-slate-700">{hw.teacher?.user?.name}</div>
                                        <div className="text-xs text-blue-600 font-black uppercase tracking-widest">{hw.class?.class_name}</div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="inline-block bg-slate-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600">
                                            {new Date(hw.dueDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end gap-3">
                                            {hw.attachmentUrl && (
                                                <a href={`${apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl}${hw.attachmentUrl.startsWith('/') ? hw.attachmentUrl : `/${hw.attachmentUrl}`}`} target="_blank" rel="noreferrer" className="bg-blue-50 text-blue-600 p-3 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                                </a>
                                            )}
                                            <button onClick={() => deleteHomework(hw.id)} className="bg-rose-50 text-rose-600 p-3 rounded-xl hover:bg-rose-600 hover:text-white transition-all">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="4" className="text-center py-20 text-gray-400 font-medium font-inter uppercase text-[10px] tracking-[0.2em]">No homework assignments found.</td></tr>
                        )}
                    </tbody>
                </table>
</div>
            </div>
        </Layout>
    )
}
