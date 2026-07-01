import Layout from '../../components/Layout'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { exportToExcel } from '../../utils/reportUtils'

export default function AdminParents() {
    const [parents, setParents] = useState([])
    const [loading, setLoading] = useState(true)
    const [students, setStudents] = useState([])
    const [classes, setClasses] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [currentParentId, setCurrentParentId] = useState(null)
    const [selectedClass, setSelectedClass] = useState('')
    const [selectedSection, setSelectedSection] = useState('')
    const [formData, setFormData] = useState({ name: '', username: '', password: '', phone: '', occupation: '', studentIds: [] })
    const [submitting, setSubmitting] = useState(false)
    const [showExcelModal, setShowExcelModal] = useState(false)
    const [excelFile, setExcelFile] = useState(null)
    const [previewData, setPreviewData] = useState([])
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState(null)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef(null)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const fetchAll = async () => {
        setLoading(true)
        try {
            const schoolId = typeof window !== 'undefined' ? localStorage.getItem('schoolId') : '';
            const config = {
                headers: headers(),
                params: schoolId ? { schoolId } : {}
            };
            const [p, s, c] = await Promise.all([
                axios.get(`${apiUrl}/api/parents`, config).catch(() => ({ data: [] })),
                axios.get(`${apiUrl}/api/students?limit=5000`, config).catch(() => ({ data: [] })),
                axios.get(`${apiUrl}/api/classes`, config).catch(() => ({ data: [] }))
            ])
            setParents(p.data);
            // Handle both paginated and flat responses
            setStudents(Array.isArray(s.data) ? s.data : s.data.students || []);
            setClasses(c.data)
        } catch (error) {
            console.error("Error fetching data:", error)
        }
        setLoading(false)
    }
    useEffect(() => { fetchAll() }, [])

    const openModal = (parent = null) => {
        if (parent) {
            setEditMode(true)
            setCurrentParentId(parent.id)
            setFormData({
                name: parent.user?.name || '',
                username: parent.user?.username || '',
                password: '', // Leave empty for security
                phone: parent.phone || '',
                occupation: parent.occupation || '',
                studentIds: parent.Children?.map(c => c.studentId) || []
            })
        } else {
            setEditMode(false)
            setCurrentParentId(null)
            setFormData({ name: '', username: '', password: '', phone: '', occupation: '', studentIds: [] })
        }
        setShowModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        try {
            const schoolId = typeof window !== 'undefined' ? localStorage.getItem('schoolId') : '';
            const data = { ...formData, schoolId };
            if (editMode) {
                await axios.put(`${apiUrl}/api/parents/${currentParentId}`, data, { headers: headers() });
            } else {
                await axios.post(`${apiUrl}/api/parents`, data, { headers: headers() });
            }
            setShowModal(false);
            setFormData({ name: '', username: '', password: '', phone: '', occupation: '', studentIds: [] });
            setSelectedClass('');
            setSelectedSection('');
            fetchAll()
        }
        catch (e) { alert(e.response?.data?.message || 'Error') }
        finally { setSubmitting(false) }
    }

    const addChild = (studentId) => {
        if (!studentId) return;
        if (!formData.studentIds.includes(studentId)) {
            setFormData({ ...formData, studentIds: [...formData.studentIds, studentId] })
        }
    }

    const removeChild = (studentId) => {
        setFormData({ ...formData, studentIds: formData.studentIds.filter(id => id !== studentId) })
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Ma huba inaad tirtirto waalidkan?')) return;
        try {
            await axios.delete(`${apiUrl}/api/parents/${id}`, { headers: headers() });
            fetchAll();
        } catch (e) {
            alert(e.response?.data?.message || 'Error deleting parent');
        }
    }

    // Excel Export
    const handleExportExcel = () => {
        const data = parents.map(p => ({
            'Name': p.user?.name,
            'Phone': p.phone,
            'Occupation': p.occupation,
            'Children': p.Children?.map(c => `${c.student?.user?.name} (${c.student?.student_id})`).join(', ')
        }))
        exportToExcel(data, `Parents_Report_${new Date().toLocaleDateString()}`)
    }

    // Excel Import Functions
    const downloadTemplate = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/parents/template`, {
                headers: headers(),
                responseType: 'blob'
            })
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const a = document.createElement('a')
            a.href = url
            a.download = 'parents_template.xlsx'
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (e) { alert('Error downloading template') }
    }

    const handleFileSelect = (file) => {
        if (!file) return
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            alert('Fadlan soo dooro file Excel ah (.xlsx ama .xls)')
            return
        }
        setExcelFile(file)
        setImportResult(null)

        const reader = new FileReader()
        reader.onload = (e) => {
            const wb = XLSX.read(e.target.result, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const data = XLSX.utils.sheet_to_json(ws)
            setPreviewData(data.slice(0, 10)) // preview max 10 rows
        }
        reader.readAsArrayBuffer(file)
    }

    const handleImport = async () => {
        if (!excelFile) return
        setImporting(true)
        setImportResult(null)

        const formDataUpload = new FormData()
        formDataUpload.append('file', excelFile)

        try {
            const res = await axios.post(`${apiUrl}/api/parents/import`, formDataUpload, {
                headers: {
                    ...headers(),
                    'Content-Type': 'multipart/form-data'
                }
            })
            setImportResult(res.data)
            if (res.data.success > 0) {
                fetchAll()
                setTimeout(() => {
                    setShowExcelModal(false)
                    resetExcelState()
                }, 3000)
            }
        } catch (e) {
            setImportResult({ message: e.response?.data?.message || 'Import failed', success: 0, errors: [] })
        }
        setImporting(false)
    }

    const resetExcelState = () => {
        setExcelFile(null)
        setPreviewData([])
        setImportResult(null)
    }

    const getStudentName = (id) => students.find(s => s.id === id)?.user?.name || 'Unknown'
    const getStudentId = (id) => students.find(s => s.id === id)?.student_id || ''

    return (
        <Layout title="Parents">
            <div className="flex justify-between items-center mb-8">
                <div><h2 className="text-2xl font-black text-slate-800">Maamulka Waalidiinta</h2><p className="text-gray-400 text-sm">Maareynta akoonnada waalidiinta iyo carruurtooda</p></div>
                <div className="flex gap-3">
                    <button onClick={handleExportExcel} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2">Export Excel</button>
                    <button onClick={() => setShowExcelModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 transition-all">Import Excel</button>
                    <button onClick={() => openModal()} className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-pink-100 transition-all">Ku dar Waalid</button>
                </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left min-w-max">
                    <thead><tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]"><th className="px-6 py-4">Magaca</th><th className="px-6 py-4">Telefoonka</th><th className="px-6 py-4">Shaqada</th><th className="px-6 py-4">Carruurta</th><th className="px-6 py-4">Waxqabad</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-4">
                                        <div className="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Loading data...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : parents.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                                    No parents found
                                </td>
                            </tr>
                        ) : parents.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50/50">
                                <td className="px-6 py-4 font-bold text-slate-700">{p.user?.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{p.phone || '-'}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{p.occupation || '-'}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {p.Children?.map(c => (
                                            <span key={c.id} className="bg-pink-50 text-pink-600 text-[10px] font-bold px-2 py-1 rounded">
                                                {c.student?.user?.name} {c.student?.student_id ? `(${c.student.student_id})` : ''}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        <button onClick={() => openModal(p)} className="p-2 text-slate-400 hover:text-pink-600 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                        <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
</div>
            </div>
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-slate-900 p-6 text-white flex justify-between shrink-0"><h3 className="text-xl font-bold">{editMode ? 'Wax ka bedel Waalidka' : 'Ku dar Waalid Cusub'}</h3><button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button></div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-4 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Magaca oo Buuxa</label><input required className="w-full p-3 rounded-xl border focus:ring-2 ring-pink-500 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Telefoonka</label><input className="w-full p-3 rounded-xl border focus:ring-2 ring-pink-500 outline-none" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Username</label><input required className="w-full p-3 rounded-xl border focus:ring-2 ring-pink-500 outline-none" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} /></div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Password {editMode && '(Sideeda u daa)'}</label><input required={!editMode} type="password" className="w-full p-3 rounded-xl border focus:ring-2 ring-pink-500 outline-none" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} /></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Shaqada</label><input className="w-full p-3 rounded-xl border focus:ring-2 ring-pink-500 outline-none" value={formData.occupation} onChange={e => setFormData({ ...formData, occupation: e.target.value })} /></div>

                            <hr className="my-4 border-gray-100" />

                            <div className="bg-gray-50 p-4 rounded-2xl space-y-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Xiriiri Carruurta</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Fasalka Dooran</label>
                                        <select 
                                            className="w-full p-2 rounded-lg border text-sm" 
                                            value={selectedClass} 
                                            onChange={e => {
                                                setSelectedClass(e.target.value);
                                                setSelectedSection('');
                                            }}
                                        >
                                            <option value="">Dooro Fasal...</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name} ({c.Sections?.[0]?.shift || 'Subax'})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Qaybta (Section)</label>
                                        <select 
                                            className="w-full p-2 rounded-lg border text-sm" 
                                            value={selectedSection} 
                                            onChange={e => setSelectedSection(e.target.value)}
                                            disabled={!selectedClass}
                                        >
                                            <option value="">Dooro Qayb...</option>
                                            {classes.find(c => c.id === selectedClass)?.Sections?.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.shift})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Ardayda</label>
                                    <select
                                        className="w-full p-2 rounded-lg border text-sm"
                                        onChange={e => addChild(e.target.value)}
                                        value=""
                                    >
                                        <option value="">Dooro Arday...</option>
                                        {students.filter(s => {
                                            if (selectedClass) {
                                                if (s.classId !== selectedClass) return false;
                                            }
                                            if (selectedSection) {
                                                if (s.sectionId !== selectedSection) return false;
                                            }
                                            return true;
                                        }).map(s => (
                                            <option key={s.id} value={s.id}>{s.user?.name} {s.student_id ? `(${s.student_id})` : ''}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block">Carruurta la doortay ({formData.studentIds.length})</label>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.studentIds.length === 0 && <p className="text-xs text-gray-400 italic">Ma jiro arday la doortay...</p>}
                                        {formData.studentIds.map(id => (
                                            <div key={id} className="flex items-center bg-white border border-pink-100 text-pink-600 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                                                {getStudentName(id)} {getStudentId(id) ? `(${getStudentId(id)})` : ''}
                                                <button type="button" onClick={() => removeChild(id)} className="ml-2 text-pink-300 hover:text-pink-600 transition-colors">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className={`w-full ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-700'} text-white font-bold py-4 rounded-2xl shadow-lg shadow-pink-100 transition-all mt-4`}
                            >
                                {submitting ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Saving...
                                    </div>
                                ) : (editMode ? 'Cusboonaysii Waalidka' : 'Abuur Akoonka Waalidka')}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            {showExcelModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-emerald-600 p-6 text-white flex justify-between shrink-0">
                            <div>
                                <h3 className="text-xl font-bold">Import Waalidiinta (Excel)</h3>
                                <p className="text-emerald-100 text-sm mt-1">Ku dar waalidiin badan adigoo isticmaalaya file Excel ah</p>
                            </div>
                            <button onClick={() => setShowExcelModal(false)} className="text-emerald-200 hover:text-white text-2xl">✕</button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
                            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-center justify-between">
                                <div>
                                    <h4 className="font-bold text-emerald-800">Soo deji Template-ka</h4>
                                    <p className="text-sm text-emerald-600">Fadlan isticmaal qaabkan (format) si uu nidaamku u aqbalo xogtaada.</p>
                                </div>
                                <button onClick={downloadTemplate} className="bg-white text-emerald-600 px-4 py-2 rounded-xl font-bold shadow-sm hover:shadow-md transition-all flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Template
                                </button>
                            </div>

                            <div
                                className={`border-4 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer ${dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:border-emerald-200 hover:bg-gray-50'}`}
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]) }}
                            >
                                <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileSelect(e.target.files[0])} />
                                {!excelFile ? (
                                    <div className="space-y-3">
                                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        </div>
                                        <p className="font-bold text-slate-700">Guji halkan ama soo jiid file-ka Excel-ka ah</p>
                                        <p className="text-sm text-gray-400">Kaliya .xlsx ama .xls ayaa la oggol yahay</p>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-bold text-slate-800">{excelFile.name}</p>
                                            <p className="text-xs text-gray-400">{(excelFile.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); setExcelFile(null); setPreviewData([]) }} className="ml-4 text-red-400 hover:text-red-600 transition-colors">✕</button>
                                    </div>
                                )}
                            </div>

                            {previewData.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Muqaalka hore (Preview - 10 rows)</h4>
                                    <div className="border rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-gray-50 text-gray-500 font-bold">
                                                <tr><th className="px-4 py-2">Magaca</th><th className="px-4 py-2">Telefoonka</th><th className="px-4 py-2">Shaqada</th></tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {previewData.map((row, i) => (
                                                    <tr key={i}><td className="px-4 py-2">{row.Name || row.Magaca}</td><td className="px-4 py-2">{row.Phone || row.Telefoonka}</td><td className="px-4 py-2">{row.Occupation || row.Shaqada}</td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {importResult && (
                                <div className={`p-4 rounded-2xl border ${importResult.success > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                    <p className="font-bold">{importResult.message}</p>
                                    {importResult.errors?.length > 0 && (
                                        <div className="mt-2 text-xs max-h-32 overflow-y-auto space-y-1">
                                            {importResult.errors.map((err, i) => <p key={i}>• {err.message}</p>)}
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                onClick={handleImport}
                                disabled={!excelFile || importing}
                                className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all ${!excelFile || importing ? 'bg-gray-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100'}`}
                            >
                                {importing ? 'Soo gelinayaa...' : 'Bilow Soo gelinta (Start Import)'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}
