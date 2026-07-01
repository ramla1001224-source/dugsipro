import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useLanguage } from '../../context/LanguageContext'

export default function LibrarianLibrary() {
    const { t } = useLanguage()
    const [books, setBooks] = useState([])
    const [issues, setIssues] = useState([])
    const [students, setStudents] = useState([])
    const [classes, setClasses] = useState([])
    const [sections, setSections] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const [selectedSection, setSelectedSection] = useState('')
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showIssue, setShowIssue] = useState(false)
    const [formData, setFormData] = useState({ title: '', author: '', isbn: '', category: '', quantity: 1 })
    const [issueData, setIssueData] = useState({ bookId: '', studentId: '', dueDate: '' })

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchAll = async () => {
        setLoading(true)
        try {
            const [b, i, s, c, sec] = await Promise.all([
                axios.get(`${apiUrl}/api/library/books`, { headers: headers() }).catch(() => ({ data: [] })),
                axios.get(`${apiUrl}/api/library/issues`, { headers: headers() }).catch(() => ({ data: [] })),
                axios.get(`${apiUrl}/api/students?limit=5000`, { headers: headers() }).catch(() => ({ data: [] })),
                axios.get(`${apiUrl}/api/classes`, { headers: headers() }).catch(() => ({ data: [] })),
                axios.get(`${apiUrl}/api/sections`, { headers: headers() }).catch(() => ({ data: [] }))
            ])
            setBooks(b.data || [])
            setIssues(i.data || [])
            setStudents(s.data?.students || s.data || [])
            setClasses(c.data || [])
            setSections(sec.data || [])
        } catch (e) {
            console.error('Fetch error:', e)
        }
        setLoading(false)
    }

    useEffect(() => { fetchAll() }, [])

    const addBook = async (e) => {
        e.preventDefault()
        try {
            if (formData.id) {
                // Determine new availability based on quantity change
                const oldBook = books.find(b => b.id === formData.id)
                const diff = Number(formData.quantity) - oldBook.quantity
                const newAvailable = Math.max(0, oldBook.available + diff)
                
                await axios.put(`${apiUrl}/api/library/books/${formData.id}`, {
                    ...formData,
                    available: newAvailable
                }, { headers: headers() })
            } else {
                await axios.post(`${apiUrl}/api/library/books`, formData, { headers: headers() })
            }
            setShowModal(false)
            setFormData({ title: '', author: '', isbn: '', category: '', quantity: 1 })
            fetchAll()
        } catch (e) { alert(e.response?.data?.message || 'Error') }
    }

    const issueBook = async (e) => {
        e.preventDefault()
        try {
            await axios.post(`${apiUrl}/api/library/issue`, issueData, { headers: headers() })
            setShowIssue(false)
            setIssueData({ bookId: '', studentId: '', dueDate: '' })
            fetchAll()
        } catch (e) { alert(e.response?.data?.message || 'Error') }
    }

    const deleteBook = async (id) => {
        if (!confirm('Ma hubtaa inaad tirtirto buuggan?')) return
        try {
            await axios.delete(`${apiUrl}/api/library/books/${id}`, { headers: headers() })
            fetchAll()
        } catch (e) { alert('Error deleting book') }
    }

    const returnBook = async (issueId) => {
        try {
            await axios.post(`${apiUrl}/api/library/return/${issueId}`, {}, { headers: headers() })
            fetchAll()
        } catch (e) { alert(e.response?.data?.message || 'Error returning book') }
    }

    const startEdit = (book) => {
        setFormData({ ...book })
        setShowModal(true)
    }

    return (
        <Layout title="Maktabadda">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Maamulka Maktabadda</h2>
                    <p className="text-gray-400 text-sm">Maamul buugaagta iyo amaahdooda</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={() => setShowIssue(true)} 
                        className="bg-amber-100 text-amber-600 hover:bg-amber-200 px-5 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        📖 Amaahinta Buugga
                    </button>
                    <button 
                        onClick={() => { setFormData({ title: '', author: '', isbn: '', category: '', quantity: 1 }); setShowModal(true); }} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
                    >
                        ➕ Ku Dar Buug
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Book Catalog */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        📚 Buugaagta Kaydka ({books.length})
                    </h3>
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[700px]">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]">
                                        <th className="px-4 py-5">Cinwaanka</th>
                                        <th className="px-4 py-5 text-center">Xaaladda</th>
                                        <th className="px-4 py-5 text-right">Lagu Joogo</th>
                                        <th className="px-4 py-5 text-right w-24">FALALKA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {books.map(b => (
                                        <tr key={b.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-4 py-5">
                                                <div className="font-black text-slate-700 group-hover:text-blue-600 transition-colors">{b.title}</div>
                                                <div className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 tracking-wider">
                                                    Author: {b.author || 'N/A'} • ISBN: {b.isbn || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-5 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${b.available > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                    {b.available > 0 ? 'Waa Laxiraa' : 'Waa Ka Maqan Yahay'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-5 text-right font-black text-slate-800">
                                                {b.available} <span className="text-gray-300 font-normal">/ {b.quantity}</span>
                                            </td>
                                            <td className="px-4 py-5 text-right flex justify-end gap-1">
                                                <button onClick={() => startEdit(b)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-all" title="Edit">✎</button>
                                                <button onClick={() => deleteBook(b.id)} className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-all" title="Delete">✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {books.length === 0 && !loading && (
                                        <tr><td colSpan="4" className="px-8 py-20 text-center text-gray-400 italic">Ma jiraan buugaag lagu daray weli.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Active Issues */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        ⏳ Amaahda Maqan ({issues.filter(i => i.status === 'issued').length})
                    </h3>
                    <div className="space-y-4">
                        {issues.filter(i => i.status === 'issued').map(i => (
                            <div key={i.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl">📖</div>
                                    <div className="text-right">
                                        <span className="bg-amber-50 text-amber-600 text-[10px] font-black px-2 py-1 rounded uppercase tracking-tighter block mb-1">
                                            DHACAYO: {new Date(i.dueDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <h4 className="font-black text-slate-800 mb-1">{i.book?.title}</h4>
                                <div className="flex flex-col mb-4">
                                    <p className="text-sm font-black text-indigo-600 uppercase tracking-tight">
                                        {i.student ? `👤 ${i.student.user.name}` : `🤵 ${i.staff?.user.name}`}
                                    </p>
                                    {i.student && (() => {
                                        const studentClass = i.student.clss?.class_name || i.student.Enrollments?.find(e => e.isCurrent)?.clss?.class_name || '';
                                        const studentSection = i.student.section?.name || i.student.Enrollments?.find(e => e.isCurrent)?.section?.name || '';
                                        const details = [studentClass, studentSection].filter(Boolean).join(' - ');
                                        return details ? (
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                                Fasalka: {details}
                                            </p>
                                        ) : null;
                                    })()}
                                </div>
                                <button 
                                    onClick={() => returnBook(i.id)} 
                                    className="w-full py-2.5 bg-emerald-50 text-emerald-600 font-black text-xs rounded-xl hover:bg-emerald-600 hover:text-white transition-all uppercase tracking-widest shadow-sm"
                                >
                                    Soo Celiyay
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modals are simplified for space but use the same premium design */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <h3 className="text-xl font-black tracking-tight">Ku Dar Buug Cusub</h3>
                            <button onClick={() => setShowModal(false)} className="bg-white/10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-all">✕</button>
                        </div>
                        <form onSubmit={addBook} className="p-10 space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Magaca Buugga</label>
                                <input required className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Qoraaga</label><input className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.author} onChange={e => setFormData({ ...formData, author: e.target.value })} /></div>
                                <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Migaalo (Copies)</label><input type="number" className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} /></div>
                            </div>
                            <div><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Nooca (Category)</label><input className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-blue-500 transition-all" placeholder="e.g. Science, Fiction" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} /></div>
                            <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all transform hover:-translate-y-1">Keydi Buugga</button>
                        </form>
                    </div>
                </div>
            )}

            {showIssue && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                            <h3 className="text-xl font-black tracking-tight">Amaahinta Buugga</h3>
                            <button onClick={() => setShowIssue(false)} className="bg-white/10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/20 transition-all">✕</button>
                        </div>
                        <form onSubmit={issueBook} className="p-10 space-y-5">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Dooro Buugga</label>
                                <select required className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-amber-500 outline-none appearance-none" value={issueData.bookId} onChange={e => setIssueData({ ...issueData, bookId: e.target.value })}>
                                    <option value="">Select Book</option>
                                    {books.filter(b => b.available > 0).map(b => (
                                        <option key={b.id} value={b.id}>{b.title} ({b.available} boos ka hadhay)</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Class Filter</label>
                                    <select className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-amber-500 outline-none appearance-none" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); setIssueData({ ...issueData, studentId: '' }); }}>
                                        <option value="">Dhammaan Fasallada</option>
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Section Filter</label>
                                    <select className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-amber-500 outline-none appearance-none" value={selectedSection} onChange={e => { setSelectedSection(e.target.value); setIssueData({ ...issueData, studentId: '' }); }} disabled={!selectedClass}>
                                        <option value="">Dhammaan Sections</option>
                                        {sections.filter(sec => !selectedClass || sec.classId?.toString() === selectedClass.toString()).map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Ardayga Qaadaya</label>
                                <select required className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-amber-500 outline-none appearance-none" value={issueData.studentId} onChange={e => setIssueData({ ...issueData, studentId: e.target.value })}>
                                    <option value="">Select Student</option>
                                    {Array.isArray(students) && students.filter(s => (!selectedClass || s.classId?.toString() === selectedClass.toString()) && (!selectedSection || s.sectionId?.toString() === selectedSection.toString())).map(s => <option key={s.id} value={s.id}>{s.user?.name || 'Unknown Student'}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Xilliga Soo Celinta</label>
                                <input type="date" required className="w-full p-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-amber-500 transition-all" value={issueData.dueDate} onChange={e => setIssueData({ ...issueData, dueDate: e.target.value })} />
                            </div>
                            <button type="submit" className="w-full bg-amber-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-amber-100 hover:bg-amber-700 transition-all transform hover:-translate-y-1">Diiwaan Geli Amaahda</button>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
