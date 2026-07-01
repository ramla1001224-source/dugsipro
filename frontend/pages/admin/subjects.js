import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import SearchingState from '../../components/SearchingState'

export default function AdminSubjects() {
    const [subjects, setSubjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [classes, setClasses] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({ name: '', code: '', description: '', classIds: [] })
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingSubject, setEditingSubject] = useState(null)
    const [editFormData, setEditFormData] = useState({ name: '', code: '', description: '', classIds: [] })

    const openEdit = (sub) => {
        setEditingSubject(sub)
        const assignedClassIds = [...new Set(sub.Assignments?.map(a => a.section?.classId).filter(id => id))]
        setEditFormData({
            name: sub.name,
            code: sub.code,
            description: sub.description || '',
            classIds: assignedClassIds
        })
        setShowEditModal(true)
    }

    const handleEditSubmit = async (e) => {
        e.preventDefault()
        try {
            await axios.put(`${apiUrl}/api/subjects/${editingSubject.id}`, editFormData, { headers: headers() })
            setShowEditModal(false)
            setEditingSubject(null)
            fetch()
        } catch (e) { alert(e.response?.data?.message || 'Error updating subject') }
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetch = async () => {
        try {
            const [subRes, classRes] = await Promise.all([
                axios.get(`${apiUrl}/api/subjects`, { headers: headers() }),
                axios.get(`${apiUrl}/api/classes`, { headers: headers() })
            ])
            setSubjects(subRes.data)
            setClasses(classRes.data)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await axios.post(`${apiUrl}/api/subjects`, formData, { headers: headers() })
            setShowModal(false)
            setFormData({ name: '', code: '', description: '', classIds: [] })
            fetch()
        } catch (e) { alert(e.response?.data?.message || 'Error creating subject') }
    }

    const toggleClass = (id, isEdit = false) => {
        const target = isEdit ? editFormData : formData
        const setter = isEdit ? setEditFormData : setFormData
        const classIds = target.classIds.includes(id)
            ? target.classIds.filter(cid => cid !== id)
            : [...target.classIds, id]
        setter({ ...target, classIds })
    }

    const del = async (id) => {
        if (!confirm('Are you sure?')) return
        try {
            await axios.delete(`${apiUrl}/api/subjects/${id}`, { headers: headers() })
            fetch()
        } catch (e) { alert(e.response?.data?.message || 'Error deleting subject') }
    }

    useEffect(() => { fetch() }, [])

    return (
        <Layout title="Subject Management">
            {/* ... (Header remains same) */}
            <div className="flex justify-between items-center mb-8">
                <div><h2 className="text-2xl font-black text-slate-800">Subject Catalog</h2><p className="text-gray-400 text-sm">Manage academic subjects</p></div>
                <button onClick={() => setShowModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-violet-100 transition-all">Add Subject</button>
            </div>
            
            {loading ? (
                <SearchingState />
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {subjects.map(s => {
                    const assignedClasses = [...new Set(s.Assignments?.map(a => a.section?.class?.class_name).filter(n => n))].sort();
                    return (
                        <div key={s.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-3">
                                <div className="bg-violet-50 text-violet-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{s.code}</div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEdit(s)} className="text-violet-300 hover:text-violet-600">✎</button>
                                    <button onClick={() => del(s.id)} className="text-red-300 hover:text-red-600">✕</button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">{s.name}</h3>
                            <p className="text-gray-400 text-sm mt-1">{s.description || 'No description'}</p>
                            
                            <div className="mt-4 pt-3 border-t border-gray-50">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Assigned Classes</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {assignedClasses.length > 0 ? assignedClasses.map(c => (
                                        <span key={c} className="bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded-lg border border-slate-200">{c}</span>
                                    )) : <span className="text-gray-300 text-[10px] italic">No classes assigned</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            )}

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm shadow-2xl flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">Add New Subject</h3>
                                <p className="text-slate-400 text-xs">Define subject and assign it to classes</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-2xl">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Subject Name</label>
                                            <input required className="w-full p-4 rounded-2xl border-2 border-slate-50 focus:border-violet-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold" placeholder="e.g. Mathematics" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Subject Code</label>
                                            <input required className="w-full p-4 rounded-2xl border-2 border-slate-50 focus:border-violet-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold" placeholder="e.g. MATH101" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Description</label>
                                            <textarea className="w-full p-4 rounded-2xl border-2 border-slate-50 focus:border-violet-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold" rows="3" placeholder="Optional details..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Assign to Classes</label>
                                        <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-50 max-h-[300px] overflow-y-auto space-y-2">
                                            {classes.map(c => (
                                                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.classIds.includes(c.id) ? 'bg-violet-50 border-violet-200' : 'bg-white border-transparent hover:border-slate-100'}`}>
                                                    <input type="checkbox" checked={formData.classIds.includes(c.id)} onChange={() => toggleClass(c.id)} className="w-5 h-5 rounded-lg text-violet-600 focus:ring-violet-500 border-slate-200" />
                                                    <span className={`font-bold text-sm ${formData.classIds.includes(c.id) ? 'text-violet-700' : 'text-slate-600'}`}>{c.class_name}</span>
                                                </label>
                                            ))}
                                            {classes.length === 0 && <p className="text-gray-400 text-xs italic p-4 text-center">No classes found. Create classes first.</p>}
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-50">
                                    <button type="submit" className="w-full bg-violet-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl shadow-violet-200 hover:bg-violet-700 transition-all hover:-translate-y-1">Create Subject & Linked Assignments</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm shadow-2xl flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-violet-900 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">Edit Subject</h3>
                                <p className="text-violet-200 text-xs">Update details and class assignments</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="text-violet-200 hover:text-white text-2xl">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                            <form onSubmit={handleEditSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Subject Name</label>
                                            <input required className="w-full p-4 rounded-2xl border-2 border-slate-50 focus:border-violet-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold" value={editFormData.name} onChange={e => setEditFormData({ ...editFormData, name: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Subject Code</label>
                                            <input required className="w-full p-4 rounded-2xl border-2 border-slate-50 focus:border-violet-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold" value={editFormData.code} onChange={e => setEditFormData({ ...editFormData, code: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Description</label>
                                            <textarea className="w-full p-4 rounded-2xl border-2 border-slate-50 focus:border-violet-500 focus:bg-white bg-slate-50 outline-none transition-all font-bold" rows="3" value={editFormData.description} onChange={e => setEditFormData({ ...editFormData, description: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Manage Assignments</label>
                                        <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-50 max-h-[300px] overflow-y-auto space-y-2">
                                            {classes.map(c => (
                                                <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${editFormData.classIds.includes(c.id) ? 'bg-violet-50 border-violet-200' : 'bg-white border-transparent hover:border-slate-100'}`}>
                                                    <input type="checkbox" checked={editFormData.classIds.includes(c.id)} onChange={() => toggleClass(c.id, true)} className="w-5 h-5 rounded-lg text-violet-600 focus:ring-violet-500 border-slate-200" />
                                                    <span className={`font-bold text-sm ${editFormData.classIds.includes(c.id) ? 'text-violet-700' : 'text-slate-600'}`}>{c.class_name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-50">
                                    <button type="submit" className="w-full bg-violet-600 text-white font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl shadow-violet-200 hover:bg-violet-700 transition-all hover:-translate-y-1">Update Subject & Sync Assignments</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
