import Layout from '../../components/Layout'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'

export default function AdminTeachers() {
    const [teachers, setTeachers] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showExcelModal, setShowExcelModal] = useState(false)
    const [formData, setFormData] = useState({ name: '', username: '', password: '', subjects: [], phone: '', salary: '' })
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingTeacher, setEditingTeacher] = useState(null)
    const [editData, setEditData] = useState({ name: '', username: '', password: '', subjects: [], phone: '', salary: '', gender: '' })
    const [submitting, setSubmitting] = useState(false)

    // Assignment state
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [assignTeacher, setAssignTeacher] = useState(null)
    const [subjects, setSubjects] = useState([])
    const [classes, setClasses] = useState([])
    const [assignments, setAssignments] = useState({}) // { subjectId: [classId, ...] }

    // Excel import state
    const [excelFile, setExcelFile] = useState(null)
    const [previewData, setPreviewData] = useState([])
    const [totalRows, setTotalRows] = useState(0)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState(null)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef(null)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getToken = () => localStorage.getItem('token')

    const fetchTeachers = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/teachers`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setTeachers(res.data)
            setLoading(false)
        } catch (e) { console.error(e); setLoading(false); }
    }

    useEffect(() => { fetchTeachers() }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        try {
            const payload = { ...formData, subject: formData.subjects.join(', ') }
            await axios.post(`${apiUrl}/api/teachers/create`, payload, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setShowModal(false)
            setFormData({ name: '', username: '', password: '', subjects: [], phone: '', salary: '' })
            fetchTeachers()
        } catch (e) { alert(e.response?.data?.message || 'Error creating teacher') }
        finally { setSubmitting(false) }
    }

    const openAddModal = async () => {
        await fetchDropdowns()
        setShowModal(true)
    }

    const deleteTeacher = async (id) => {
        if (!confirm('Are you sure you want to delete this teacher?')) return
        try {
            await axios.delete(`${apiUrl}/api/teachers/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            fetchTeachers()
        } catch (e) { alert('Error deleting teacher') }
    }

    // ==================== ASSIGNMENT FUNCTIONS ====================

    const fetchDropdowns = async () => {
        try {
            const [subjRes, clsRes] = await Promise.all([
                axios.get(`${apiUrl}/api/subjects`, { headers: { Authorization: `Bearer ${getToken()}` } }),
                axios.get(`${apiUrl}/api/classes`, { headers: { Authorization: `Bearer ${getToken()}` } })
            ])
            setSubjects(subjRes.data)
            setClasses(clsRes.data)
        } catch (e) { console.error(e) }
    }

    const openAssign = async (teacher) => {
        setAssignTeacher(teacher)
        setShowAssignModal(true)
        await fetchDropdowns()
        try {
            const res = await axios.get(`${apiUrl}/api/teachers/${teacher.id}/assignments`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            const mapping = {}
            res.data.forEach(a => {
                const classId = a.section?.classId || a.section?.class?.id
                if (classId) {
                    if (!mapping[a.subjectId]) mapping[a.subjectId] = []
                    mapping[a.subjectId].push(classId)
                }
            })
            setAssignments(mapping)
        } catch (e) { console.error(e) }
    }

    const toggleAssignment = (subjectId, classId) => {
        setAssignments(prev => {
            const current = prev[subjectId] || []
            const updated = current.includes(classId)
                ? current.filter(id => id !== classId)
                : [...current, classId]
            return { ...prev, [subjectId]: updated }
        })
    }

    const toggleAll = (subjectId) => {
        setAssignments(prev => {
            const current = prev[subjectId] || []
            const allClassIds = classes.map(c => c.id)
            // If all are selected, deselect all. Otherwise, select all.
            const areAllSelected = allClassIds.every(id => current.includes(id))
            return { ...prev, [subjectId]: areAllSelected ? [] : allClassIds }
        })
    }

    const saveAssignments = async () => {
        if (submitting) return
        setSubmitting(true)
        try {
            const payload = []
            Object.entries(assignments).forEach(([subjId, classIds]) => {
                classIds.forEach(clsId => payload.push({ subjectId: subjId, classId: clsId }))
            })
            console.log('[Save Assignments] payload:', JSON.stringify(payload))
            if (payload.length === 0) {
                alert('Ma dooran fasallo. Fadlan dooro fasallo macalinku ku dhigo.')
                setSubmitting(false)
                return
            }
            const res = await axios.post(`${apiUrl}/api/teachers/${assignTeacher.id}/assignments`, { assignments: payload }, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            console.log('[Save Assignments] response:', res.data)
            await fetchTeachers()
            setShowAssignModal(false)
            setAssignTeacher(null)
            alert('Waa la xiriiriyay fasallada.')
        } catch (e) { 
            console.error('[Save Assignments] error:', e.response?.data)
            alert('Khalad ayaa dhacay markii la xiriirinayay fasallada: ' + (e.response?.data?.message || e.message)) 
        }
        finally { setSubmitting(false) }
    }

    // ==================== EDIT FUNCTIONS ====================

    const openEdit = (teacher) => {
        setEditingTeacher(teacher)
        setEditData({
            name: teacher.user.name || '',
            username: teacher.user.username || '',
            password: '',
            subjects: teacher.subject ? teacher.subject.split(',').map(s => s.trim()).filter(Boolean) : [],
            phone: teacher.phone || '',
            salary: teacher.salary || '',
            gender: teacher.gender || ''
        })
        fetchDropdowns()
        setShowEditModal(true)
    }

    const handleEditSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        try {
            const payload = { ...editData, subject: editData.subjects.join(', ') }
            if (!payload.password) delete payload.password
            await axios.put(`${apiUrl}/api/teachers/${editingTeacher.id}`, payload, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setShowEditModal(false)
            setEditingTeacher(null)
            fetchTeachers()
        } catch (e) { alert(e.response?.data?.message || 'Error updating teacher') }
        finally { setSubmitting(false) }
    }

    // ==================== EXCEL FUNCTIONS ====================

    const downloadTemplate = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/teachers/template`, {
                headers: { Authorization: `Bearer ${getToken()}` },
                responseType: 'blob'
            })
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const a = document.createElement('a')
            a.href = url
            a.download = 'teachers_template.xlsx'
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (e) { alert('Error downloading template') }
    }

    const handleFileSelect = (file) => {
        if (!file) return
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            alert('Please select an Excel file (.xlsx or .xls)')
            return
        }
        setExcelFile(file)
        setImportResult(null)

        const reader = new FileReader()
        reader.onload = (e) => {
            const wb = XLSX.read(e.target.result, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const data = XLSX.utils.sheet_to_json(ws)
            setTotalRows(data.length)
            setPreviewData(data.slice(0, 50))
        }
        reader.readAsArrayBuffer(file)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        handleFileSelect(file)
    }

    const handleImport = async () => {
        if (!excelFile) return
        setImporting(true)
        setImportResult(null)

        const formDataUpload = new FormData()
        formDataUpload.append('file', excelFile)

        try {
            const res = await axios.post(`${apiUrl}/api/teachers/import`, formDataUpload, {
                headers: {
                    Authorization: `Bearer ${getToken()}`,
                    'Content-Type': 'multipart/form-data'
                }
            })
            setImportResult(res.data)
            if (res.data.success > 0) fetchTeachers()
        } catch (e) {
            setImportResult({ message: e.response?.data?.message || 'Import failed', success: 0, errors: [] })
        }
        setImporting(false)
    }

    const resetExcelModal = () => {
        setShowExcelModal(false)
        setExcelFile(null)
        setPreviewData([])
        setTotalRows(0)
        setImportResult(null)
    }

    return (
        <Layout title="Teacher Management">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Faculty Directory</h2>
                    <p className="text-gray-400 text-sm">Manage all teaching staff</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowExcelModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Import Excel
                    </button>
                    <button
                        onClick={openAddModal}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100"
                    >
                        Add New Teacher
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left min-w-max">
                        <thead>
                            <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]">
                                <th className="px-6 py-4 w-12">#</th>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Subject</th>
                                <th className="px-6 py-4">Assigned Classes</th>
                                <th className="px-6 py-4">Phone</th>
                                <th className="px-6 py-4">Salary</th>
                                <th className="px-6 py-4 text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {teachers.map((t, index) => (
                                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 text-xs font-bold text-gray-400">{index + 1}</td>
                                    <td className="px-6 py-4 font-bold text-slate-700">{t.user.name}</td>
                                    <td className="px-6 py-4 text-sm text-indigo-600 font-medium bg-indigo-50/50 rounded inline-block mt-3 mb-3 ml-6 mr-6">{t.subject}</td>
                                    <td className="px-6 py-4 min-w-[200px]">
                                        {(t.SubjectAssignments && t.SubjectAssignments.length > 0) ? (
                                            <div className="flex flex-col gap-1 text-xs">
                                                {Object.entries(t.SubjectAssignments.reduce((acc, curr) => {
                                                    const sName = curr.subject?.name || 'Unknown';
                                                    if (!acc[sName]) acc[sName] = [];
                                                    const className = curr.section?.class?.class_name || 'Unknown';
                                                    const sectionName = curr.section?.name || '';
                                                    acc[sName].push(`${className} ${sectionName}`.trim());
                                                    return acc;
                                                }, {})).map(([subj, classes]) => (
                                                    <div key={subj}>
                                                        <span className="font-bold text-gray-600">{subj}:</span>
                                                        <span className="text-gray-400 ml-1">{classes.join(', ')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <span className="text-gray-300 text-xs italic">Lama xiriirin</span>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{t.phone}</td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-900">${t.salary?.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <div className="flex justify-end gap-2 items-center">
                                            <button onClick={() => openAssign(t)} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all">Assign</button>
                                            <button onClick={() => openEdit(t)} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest transition-all">Edit</button>
                                            <button onClick={() => deleteTeacher(t.id)} className="text-red-400 hover:text-red-700 font-bold px-2 text-xs uppercase tracking-widest">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {teachers.length === 0 && !loading && (
                    <div className="text-center py-12 text-gray-400">
                        <p className="text-lg font-bold mb-1">No teachers yet</p>
                        <p className="text-sm">Add teachers manually or import from Excel</p>
                    </div>
                )}
            </div>

            {/* ==================== MANUAL ADD MODAL ==================== */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold">Register New Teacher</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Full Name</label>
                                <input required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Username</label>
                                <input required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Password</label>
                                <input required type="password" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Subject(s) — select one or more</label>
                                <div className="grid grid-cols-2 gap-2 border rounded-xl p-3 max-h-36 overflow-y-auto">
                                    {subjects.map(s => (
                                        <label key={s.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-indigo-50">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-indigo-600 rounded"
                                                checked={formData.subjects.includes(s.name)}
                                                onChange={() => {
                                                    const updated = formData.subjects.includes(s.name)
                                                        ? formData.subjects.filter(x => x !== s.name)
                                                        : [...formData.subjects, s.name]
                                                    setFormData({ ...formData, subjects: updated })
                                                }}
                                            />
                                            <span className="text-sm font-medium text-gray-700">{s.name}</span>
                                        </label>
                                    ))}
                                    {subjects.length === 0 && <p className="text-gray-400 text-xs col-span-2">No subjects found. Add subjects first.</p>}
                                </div>
                                {formData.subjects.length > 0 && (
                                    <p className="text-xs text-indigo-600 font-bold mt-1">Selected: {formData.subjects.join(', ')}</p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Salary</label>
                                <input type="number" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} />
                            </div>
                            <div className="col-span-2 mt-4 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all`}
                                >
                                    {submitting ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </div>
                                    ) : 'Register Staff'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-400">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== ASSIGNMENT MODAL ==================== */}
            {showAssignModal && assignTeacher && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white flex justify-between items-center flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-bold">Xiriiri Fasallada</h3>
                                <p className="text-emerald-100 text-sm mt-0.5">{assignTeacher.user.name}</p>
                            </div>
                            <button onClick={() => setShowAssignModal(false)} className="text-emerald-200 hover:text-white text-xl">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <p className="text-gray-500 mb-4 text-sm">Dooro maadada, dabadeed calaamadi fasallada uu macalinku dhigo.</p>

                            <div className="space-y-3">
                                {subjects.map(subject => {
                                    const assignedCount = (assignments[subject.id] || []).length
                                    return (
                                        <div key={subject.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                            <details className="group">
                                                <summary className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 group-open:bg-emerald-50 hover:bg-gray-100 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`font-bold ${assignedCount > 0 ? 'text-emerald-700' : 'text-gray-700'}`}>{subject.name}</span>
                                                        <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-200">{subject.code}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); toggleAll(subject.id) }}
                                                            className="text-xs bg-gray-100 hover:bg-emerald-100 text-gray-500 hover:text-emerald-700 font-bold px-2 py-1 rounded transition-colors mr-2"
                                                        >
                                                            {(assignments[subject.id] || []).length === classes.length ? 'Ha dooran' : 'Dhantood Dooro'}
                                                        </button>
                                                        {assignedCount > 0 && <span className="text-xs font-bold bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full">{assignedCount} Fasallada</span>}
                                                        <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </div>
                                                </summary>
                                                <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 border-t border-gray-200 bg-white">
                                                    {classes.map(cls => {
                                                        const sections = cls.Sections || [];
                                                        const hasSections = sections.length > 0;
                                                        return (
                                                            <label key={cls.id} className={`flex flex-col gap-1 p-2 rounded border border-transparent transition-all ${hasSections ? 'hover:bg-gray-50 cursor-pointer hover:border-gray-200' : 'opacity-50 cursor-not-allowed'}`}>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                                                        checked={hasSections && (assignments[subject.id] || []).includes(cls.id)}
                                                                        onChange={() => toggleAssignment(subject.id, cls.id)}
                                                                        disabled={!hasSections}
                                                                    />
                                                                    <span className="text-sm font-medium text-gray-600">{cls.class_name}</span>
                                                                </div>
                                                                <div className="pl-6">
                                                                    {hasSections ? (
                                                                        <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                                                                            {sections.map(s => s.name).join(', ')}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-red-500 font-bold">No sections (Lama xiriiri karo)</span>
                                                                    )}
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                    {classes.length === 0 && <p className="text-gray-400 text-sm col-span-full">Fasallo lama helin.</p>}
                                                </div>
                                            </details>
                                        </div>
                                    )
                                })}
                                {subjects.length === 0 && <p className="text-center text-gray-400 py-8">No subjects found. Please create subjects first.</p>}
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex gap-3 bg-gray-50 flex-shrink-0">
                            <button
                                onClick={saveAssignments}
                                disabled={submitting}
                                className={`flex-1 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'} text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-100 transition-all`}
                            >
                                {submitting ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Keydinaya...
                                    </div>
                                ) : 'Keydi Xiriirinta'}
                            </button>
                            <button onClick={() => setShowAssignModal(false)} className="px-6 py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-400 hover:bg-white hover:text-gray-600 transition-all">Ka noqo</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== EDIT TEACHER MODAL ==================== */}
            {showEditModal && editingTeacher && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">Edit Teacher</h3>
                                <p className="text-indigo-100 text-sm mt-0.5">ID: {editingTeacher.id}</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="text-indigo-200 hover:text-white text-xl">✕</button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-8 grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Full Name</label>
                                <input required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Username</label>
                                <input required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" value={editData.username} onChange={e => setEditData({ ...editData, username: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">New Password <span className="normal-case text-gray-300">(leave blank to keep)</span></label>
                                <input type="password" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••••" value={editData.password} onChange={e => setEditData({ ...editData, password: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Subject(s) — select one or more</label>
                                <div className="grid grid-cols-2 gap-2 border rounded-xl p-3 max-h-36 overflow-y-auto">
                                    {subjects.map(s => (
                                        <label key={s.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-indigo-50">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-indigo-600 rounded"
                                                checked={editData.subjects.includes(s.name)}
                                                onChange={() => {
                                                    const updated = editData.subjects.includes(s.name)
                                                        ? editData.subjects.filter(x => x !== s.name)
                                                        : [...editData.subjects, s.name]
                                                    setEditData({ ...editData, subjects: updated })
                                                }}
                                            />
                                            <span className="text-sm font-medium text-gray-700">{s.name}</span>
                                        </label>
                                    ))}
                                </div>
                                {editData.subjects.length > 0 && (
                                    <p className="text-xs text-indigo-600 font-bold mt-1">Selected: {editData.subjects.join(', ')}</p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Phone</label>
                                <input className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Salary</label>
                                <input type="number" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none" value={editData.salary} onChange={e => setEditData({ ...editData, salary: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Gender</label>
                                <select className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={editData.gender} onChange={e => setEditData({ ...editData, gender: e.target.value })}>
                                    <option value="">Select...</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>
                            <div className="col-span-2 mt-4 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-600'} text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all`}
                                >
                                    {submitting ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving Changes...
                                        </div>
                                    ) : 'Save Changes'}
                                </button>
                                <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-400">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== EXCEL IMPORT MODAL ==================== */}
            {showExcelModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Import Teachers from Excel
                                </h3>
                                <p className="text-emerald-100 text-sm mt-1">Upload an Excel file to bulk-register teachers</p>
                            </div>
                            <button onClick={resetExcelModal} className="text-emerald-200 hover:text-white text-2xl">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Step 1: Download Template */}
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                                    <h4 className="font-bold text-slate-700">Download Template</h4>
                                </div>
                                <button
                                    onClick={downloadTemplate}
                                    className="ml-11 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center gap-2 text-sm border border-emerald-200"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Download teachers_template.xlsx
                                </button>
                            </div>

                            {/* Step 2: Upload File */}
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                                    <h4 className="font-bold text-slate-700">Upload Excel File</h4>
                                </div>
                                <div
                                    className={`ml-11 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/50'}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        className="hidden"
                                        onChange={(e) => handleFileSelect(e.target.files[0])}
                                    />
                                    {excelFile ? (
                                        <div>
                                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                            <p className="font-bold text-slate-700">{excelFile.name}</p>
                                            <p className="text-sm text-gray-400 mt-1">{totalRows} rows found • Click to change file</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                            </div>
                                            <p className="font-bold text-slate-600">Drag & drop Excel file here</p>
                                            <p className="text-sm text-gray-400 mt-1">or click to browse • .xlsx, .xls</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Preview Table */}
                            {previewData.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                                        <h4 className="font-bold text-slate-700">Preview (first {previewData.length} of {totalRows} rows)</h4>
                                    </div>
                                    <div className="ml-11 overflow-x-auto rounded-xl border border-gray-200">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                                    <th className="px-4 py-3 text-left">#</th>
                                                    {Object.keys(previewData[0]).map(key => (
                                                        <th key={key} className="px-4 py-3 text-left">{key}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {previewData.slice(0, 10).map((row, i) => (
                                                    <tr key={i} className="hover:bg-gray-50">
                                                        <td className="px-4 py-2.5 text-gray-400 font-mono">{i + 1}</td>
                                                        {Object.values(row).map((val, j) => (
                                                            <td key={j} className="px-4 py-2.5 text-slate-700">{String(val)}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {previewData.length > 10 && (
                                            <div className="text-center py-2 text-sm text-gray-400 bg-gray-50">
                                                ... and {previewData.length - 10} more rows
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Import Result */}
                            {importResult && (
                                <div className="ml-11 mb-4">
                                    <div className={`rounded-xl p-4 ${importResult.success > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                                        <p className={`font-bold ${importResult.success > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {importResult.message}
                                        </p>
                                        {importResult.errors?.length > 0 && (
                                            <div className="mt-3 space-y-1">
                                                <p className="text-sm font-semibold text-red-600">Errors:</p>
                                                {importResult.errors.map((err, i) => (
                                                    <p key={i} className="text-sm text-red-500">⚠ {err.message}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-100 p-6 flex gap-3 shrink-0">
                            <button
                                onClick={handleImport}
                                disabled={!excelFile || importing}
                                className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${excelFile && !importing ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                                {importing ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        Import {totalRows} Teachers
                                    </>
                                )}
                            </button>
                            <button
                                onClick={resetExcelModal}
                                className="px-6 py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-400 hover:bg-gray-50 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
