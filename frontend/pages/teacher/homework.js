import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function TeacherHomework() {
    const [homeworks, setHomeworks] = useState([])
    const [loading, setLoading] = useState(true)
    const [classes, setClasses] = useState([])
    const [subjects, setSubjects] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        dueDate: '',
        classId: '',
        sectionId: '',
        subjectId: '',
        attachmentUrl: ''
    })

    const [file, setFile] = useState(null)
    const [viewSubs, setViewSubs] = useState(null) // homeworkId being viewed
    const [submissions, setSubmissions] = useState([])
    const [grading, setGrading] = useState(null) // submission being graded
    const [gradeData, setGradeData] = useState({ grade: '', feedback: '', status: 'graded' })

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getToken = () => localStorage.getItem('token')

    const fetchData = async () => {
        setLoading(true)
        try {
            const [hwRes, classRes, subRes] = await Promise.all([
                axios.get(`${apiUrl}/api/homework`, { headers: { Authorization: `Bearer ${getToken()}` } }),
                axios.get(`${apiUrl}/api/classes`, { headers: { Authorization: `Bearer ${getToken()}` } }),
                axios.get(`${apiUrl}/api/subjects`, { headers: { Authorization: `Bearer ${getToken()}` } })
            ]);

            setHomeworks(hwRes.data)
            
            // Flatten hierarchical classes for the teacher form
            const flattenedClasses = [];
            classRes.data.forEach(c => {
                c.Sections.forEach(s => {
                    flattenedClasses.push({
                        classId: c.id,
                        class_name: c.class_name,
                        sectionId: s.id,
                        section: s.name,
                        shift: s.shift
                    });
                });
            });

            setClasses(flattenedClasses)
            setSubjects(subRes.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()

        try {
            const data = new FormData()
            data.append('title', formData.title)
            data.append('description', formData.description)
            data.append('dueDate', formData.dueDate)
            data.append('classId', formData.classId)
            data.append('sectionId', formData.sectionId)
            data.append('subjectId', formData.subjectId)
            if (file) data.append('attachment', file)

            await axios.post(`${apiUrl}/api/homework/create`, data, {
                headers: {
                    Authorization: `Bearer ${getToken()}`,
                    'Content-Type': 'multipart/form-data'
                }
            })

            setShowModal(false)
            setFormData({ title: '', description: '', dueDate: '', classId: '', sectionId: '', subjectId: '', attachmentUrl: '' })
            setFile(null)
            fetchData()
        } catch (e) {
            alert(e.response?.data?.message || 'Error creating homework')
        }
    }

    const deleteHomework = async (id) => {
        if (!confirm('Ma hubtaa inaad tirtirto shaqo-gurigan?')) return
        try {
            await axios.delete(`${apiUrl}/api/homework/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            fetchData()
        } catch (e) {
            alert('Error deleting homework')
        }
    }

    const viewSubmissions = async (hwId) => {
        try {
            const res = await axios.get(`${apiUrl}/api/submissions/homework/${hwId}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setSubmissions(res.data)
            setViewSubs(hwId)
        } catch (e) {
            alert('Error loading submissions')
        }
    }

    const gradeSubmission = async (subId) => {
        try {
            await axios.put(`${apiUrl}/api/submissions/${subId}/grade`, gradeData, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setGrading(null)
            viewSubmissions(viewSubs)
        } catch (e) {
            alert('Error grading submission')
        }
    }

    return (
        <Layout title="Shaqo-Guri (Homework)">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Shaqo-Guri (Homework)</h2>
                    <p className="text-gray-400 text-sm">U dir shaqo-guri fasallada aad dhigto</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
                >
                    + Shaqo Cusub
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto w-full">
<table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]">
                            <th className="px-6 py-4">Cinwaanka</th>
                            <th className="px-6 py-4">Fasalka</th>
                            <th className="px-6 py-4">Maaddada</th>
                            <th className="px-6 py-4">Fairiikhda</th>
                            <th className="px-6 py-4">Attachment</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {homeworks.map((hw) => (
                            <tr key={hw.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700">{hw.title}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{hw.section ? `${hw.section.class?.class_name} - ${hw.section.name}` : `${hw.clss?.class_name} - Dhammaan Qaybaha`}</td>
                                <td className="px-6 py-4 text-sm text-blue-600 font-medium">{hw.subject?.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-400">
                                    {new Date(hw.dueDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    {hw.attachmentUrl ? (
                                        <a href={`${apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl}${hw.attachmentUrl.startsWith('/') ? hw.attachmentUrl : `/${hw.attachmentUrl}`}`} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">📄 View</a>
                                    ) : 'No file'}
                                </td>
                                <td className="px-6 py-4 text-right flex items-center gap-3 justify-end">
                                    <button
                                        onClick={() => viewSubmissions(hw.id)}
                                        className="text-indigo-500 hover:text-indigo-700 font-bold text-xs bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        📥 Jawaabaha
                                    </button>
                                    <button
                                        onClick={() => deleteHomework(hw.id)}
                                        className="text-red-400 hover:text-red-600 font-bold transition-colors"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
</div>
                {homeworks.length === 0 && !loading && (
                    <div className="text-center py-12 text-gray-400 font-bold">Lama helin wax shaqo-guri ah.</div>
                )}
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold">Dir Shaqo-Guri</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Cinwaanka (Title)</label>
                                <input required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Sharaxaad (Optional)</label>
                                <textarea className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none" rows="3"
                                    value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}></textarea>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Fasalka (Class)</label>
                                    <select required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold"
                                        value={formData.classId} 
                                        onChange={e => setFormData({ ...formData, classId: e.target.value, sectionId: '', subjectId: '' })}>
                                        <option value="">Dooro Fasal...</option>
                                        {Array.from(new Map(classes.map(c => [c.classId, c.class_name])).entries()).map(([id, name]) => (
                                            <option key={id} value={id}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Qaybta (Section)</label>
                                    <select required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold"
                                        value={formData.sectionId} onChange={e => setFormData({ ...formData, sectionId: e.target.value, subjectId: '' })} disabled={!formData.classId}>
                                        <option value="">Dooro Qayb...</option>
                                        {formData.classId && <option value="all" className="text-blue-600">Dhammaan Qaybaha (All Sections)</option>}
                                        {classes.filter(c => c.classId === formData.classId).map(c => (
                                            <option key={c.sectionId} value={c.sectionId}>{c.section} - {c.shift}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Maaddada (Subject)</label>
                                    <select required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold"
                                        value={formData.subjectId} onChange={e => setFormData({ ...formData, subjectId: e.target.value })}>
                                        <option value="">Dooro Maaddo...</option>
                                        {!formData.sectionId ? (
                                            <option disabled>Qayb marka hore dooro...</option>
                                        ) : subjects
                                            .filter(s => {
                                                if (formData.sectionId === 'all') {
                                                    // If all sections, show subjects assigned to ANY section of this class
                                                    const classSectionIds = classes.filter(c => c.classId === formData.classId).map(c => c.sectionId.toString());
                                                    return s.Assignments?.some(a => classSectionIds.includes(a.sectionId?.toString()));
                                                }
                                                return s.Assignments?.some(a => a.sectionId?.toString() === formData.sectionId?.toString());
                                            })
                                            .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                        }
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Due Date</label>
                                    <input required type="date" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">File (PDF/Image)</label>
                                    <input type="file" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        onChange={e => setFile(e.target.files[0])} />
                                </div>
                            </div>
                            <div className="pt-4">
                                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs">
                                    Dira (Post Homework)
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ====== SUBMISSIONS PANEL ====== */}
            {viewSubs && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-indigo-900 p-6 text-white flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-bold">📥 Jawaabaha Ardayda</h3>
                            <button onClick={() => { setViewSubs(null); setGrading(null) }} className="text-indigo-400 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="overflow-y-auto p-6 space-y-4">
                            {submissions.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 font-bold">Ardaydu weli jawaab ma soo gudbinin.</div>
                            ) : submissions.map(sub => (
                                <div key={sub.id} className="bg-gray-50 rounded-2xl p-4 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-slate-700">{sub.student?.user?.name}</p>
                                            <p className="text-[10px] text-gray-400">{new Date(sub.submittedAt).toLocaleString()}</p>
                                        </div>
                                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${sub.status === 'graded' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-600'}`}>
                                            {sub.status === 'graded' ? `✅ ${sub.grade}` : '⏳ Sugaya'}
                                        </span>
                                    </div>
                                    {sub.content && <p className="text-sm text-gray-600">{sub.content}</p>}
                                    {sub.attachmentUrl && (
                                        <a href={`${apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl}${sub.attachmentUrl.startsWith('/') ? sub.attachmentUrl : `/${sub.attachmentUrl}`}`} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-bold hover:underline">📄 Daabac Xogta</a>
                                    )}
                                    {sub.feedback && (
                                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2">
                                            <p className="text-xs text-emerald-700">{sub.feedback}</p>
                                        </div>
                                    )}

                                    {grading === sub.id ? (
                                        <div className="pt-2 space-y-2 border-t border-gray-200">
                                            <div className="grid grid-cols-2 gap-2">
                                                <input placeholder="Dhibcaha (e.g. 85/100)" className="p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                                                    value={gradeData.grade} onChange={e => setGradeData({ ...gradeData, grade: e.target.value })} />
                                                <select className="p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                                                    value={gradeData.status} onChange={e => setGradeData({ ...gradeData, status: e.target.value })}>
                                                    <option value="graded">✅ Graded</option>
                                                    <option value="returned">↩️ Returned</option>
                                                </select>
                                            </div>
                                            <textarea rows={2} placeholder="Faallo (ikhtiyaari)" className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                                value={gradeData.feedback} onChange={e => setGradeData({ ...gradeData, feedback: e.target.value })} />
                                            <div className="flex gap-2">
                                                <button onClick={() => gradeSubmission(sub.id)} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold text-xs hover:bg-indigo-700 transition">✅ Kaydi Dhibcaha</button>
                                                <button onClick={() => setGrading(null)} className="px-4 bg-gray-100 text-gray-500 py-2 rounded-lg font-bold text-xs">Jooji</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => { setGrading(sub.id); setGradeData({ grade: sub.grade || '', feedback: sub.feedback || '', status: sub.status || 'graded' }) }}
                                            className="text-indigo-600 font-bold text-xs bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
                                            ✏️ Qiimee
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
