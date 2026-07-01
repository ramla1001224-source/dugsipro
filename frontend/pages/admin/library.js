import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminLibrary() {
    const [books, setBooks] = useState([])
    const [issues, setIssues] = useState([])
    const [students, setStudents] = useState([])
    const [classes, setClasses] = useState([])
    const [sections, setSections] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const [selectedSection, setSelectedSection] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [showIssue, setShowIssue] = useState(false)
    const [formData, setFormData] = useState({ title: '', author: '', isbn: '', category: '', copies: 1 })
    const [issueData, setIssueData] = useState({ bookId: '', studentId: '', dueDate: '' })
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchAll = async () => {
        const [b, i, s, c, sec] = await Promise.all([
            axios.get(`${apiUrl}/api/library`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/library/issues`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/students?limit=5000`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/classes`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/sections`, { headers: headers() }).catch(() => ({ data: [] }))
        ])
        setBooks(b.data); setIssues(i.data); setStudents(s.data); setClasses(c.data); setSections(sec.data);
    }
    useEffect(() => { fetchAll() }, [])

    const addBook = async (e) => {
        e.preventDefault()
        try { await axios.post(`${apiUrl}/api/library`, formData, { headers: headers() }); setShowModal(false); fetchAll() }
        catch (e) { alert(e.response?.data?.message || 'Error') }
    }

    const issueBook = async (e) => {
        e.preventDefault()
        try { await axios.post(`${apiUrl}/api/library/issue`, issueData, { headers: headers() }); setShowIssue(false); fetchAll() }
        catch (e) { alert(e.response?.data?.message || 'Error') }
    }

    const returnBook = async (id) => {
        try { await axios.patch(`${apiUrl}/api/library/return/${id}`, {}, { headers: headers() }); fetchAll() }
        catch (e) { alert('Error') }
    }

    return (
        <Layout title="Library">
            <div className="flex justify-between items-center mb-8">
                <div><h2 className="text-2xl font-black text-slate-800">Library Management</h2><p className="text-gray-400 text-sm">Books, issues, and returns</p></div>
                <div className="flex gap-3">
                    <button onClick={() => setShowIssue(true)} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-amber-100 transition-all">Issue Book</button>
                    <button onClick={() => setShowModal(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-cyan-100 transition-all">Add Book</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Book Catalog ({books.length})</h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto w-full">
<table className="w-full text-left">
                            <thead><tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]"><th className="px-6 py-3">Title</th><th className="px-6 py-3">Author</th><th className="px-6 py-3">Category</th><th className="px-6 py-3">Available</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {books.map(b => (
                                    <tr key={b.id} className="hover:bg-gray-50/50"><td className="px-6 py-4 font-bold text-slate-700">{b.title}</td><td className="px-6 py-4 text-sm text-gray-500">{b.author}</td><td className="px-6 py-4"><span className="bg-cyan-50 text-cyan-600 text-[10px] font-bold px-2 py-1 rounded uppercase">{b.category || 'General'}</span></td><td className="px-6 py-4 text-sm font-bold">{b.available}/{b.copies}</td></tr>
                                ))}
                            </tbody>
                        </table>
</div>
                    </div>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Active Issues ({issues.filter(i => i.status === 'issued').length})</h3>
                    <div className="space-y-3">
                        {issues.filter(i => i.status === 'issued').map(i => (
                            <div key={i.id} className="bg-white p-4 rounded-xl border border-gray-100">
                                <p className="font-bold text-slate-700 text-sm">{i.book?.title}</p>
                                <p className="text-xs text-gray-400">{i.student?.user?.name} · Due: {new Date(i.dueDate).toLocaleDateString()}</p>
                                <button onClick={() => returnBook(i.id)} className="mt-2 text-xs bg-green-50 text-green-600 font-bold px-3 py-1 rounded-lg hover:bg-green-100">Return</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between"><h3 className="text-xl font-bold">Add Book</h3><button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button></div>
                        <form onSubmit={addBook} className="p-8 space-y-4">
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Title</label><input required className="w-full p-3 rounded-xl border" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Author</label><input className="w-full p-3 rounded-xl border" value={formData.author} onChange={e => setFormData({ ...formData, author: e.target.value })} /></div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Copies</label><input type="number" className="w-full p-3 rounded-xl border" value={formData.copies} onChange={e => setFormData({ ...formData, copies: e.target.value })} /></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Category</label><input className="w-full p-3 rounded-xl border" placeholder="e.g. Science, Fiction" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} /></div>
                            <button type="submit" className="w-full bg-cyan-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-cyan-700 transition-all">Add Book</button>
                        </form>
                    </div>
                </div>
            )}

            {showIssue && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between"><h3 className="text-xl font-bold">Issue Book</h3><button onClick={() => setShowIssue(false)} className="text-slate-400 hover:text-white">✕</button></div>
                        <form onSubmit={issueBook} className="p-8 space-y-4">
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Book</label><select required className="w-full p-3 rounded-xl border appearance-none bg-white" value={issueData.bookId} onChange={e => setIssueData({ ...issueData, bookId: e.target.value })}><option value="">Select Book</option>{books.filter(b => b.available > 0).map(b => <option key={b.id} value={b.id}>{b.title} ({b.available} avail.)</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Class Filter</label><select className="w-full p-3 rounded-xl border appearance-none bg-white" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); setIssueData({ ...issueData, studentId: '' }); }}><option value="">Dhammaan</option>{classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}</select></div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Section Filter</label><select className="w-full p-3 rounded-xl border appearance-none bg-white" value={selectedSection} onChange={e => { setSelectedSection(e.target.value); setIssueData({ ...issueData, studentId: '' }); }} disabled={!selectedClass}><option value="">Dhammaan</option>{sections.filter(sec => !selectedClass || sec.classId?.toString() === selectedClass.toString()).map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}</select></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Student</label><select required className="w-full p-3 rounded-xl border appearance-none bg-white" value={issueData.studentId} onChange={e => setIssueData({ ...issueData, studentId: e.target.value })}><option value="">Select Student</option>{students.filter(s => (!selectedClass || s.classId?.toString() === selectedClass.toString()) && (!selectedSection || s.sectionId?.toString() === selectedSection.toString())).map(s => <option key={s.id} value={s.id}>{s.user.name}</option>)}</select></div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Due Date</label><input type="date" required className="w-full p-3 rounded-xl border" value={issueData.dueDate} onChange={e => setIssueData({ ...issueData, dueDate: e.target.value })} /></div>
                            <button type="submit" className="w-full bg-amber-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-amber-700 transition-all">Issue Book</button>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
