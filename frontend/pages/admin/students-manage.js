import Layout from '../../components/Layout'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { useLanguage } from '../../context/LanguageContext'
import { exportToExcel, exportToPDF } from '../../utils/reportUtils'
import { generateReportCard } from '../../utils/reportCardUtils'
import { TableSkeleton } from '../../components/DashboardSkeleton'

export default function AdminStudents() {
    const router = useRouter()
    const { t } = useLanguage()
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
    const [search, setSearch] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [showExcelModal, setShowExcelModal] = useState(false)
    const [formData, setFormData] = useState({ name: '', password: '', class: '', classId: '', sectionId: '', phone: '', address: '', gender: '', scholarship: 'none' })
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingStudent, setEditingStudent] = useState(null)
    const [editData, setEditData] = useState({ name: '', student_id: '', password: '', class: '', classId: '', sectionId: '', phone: '', address: '', gender: '', dob: '', scholarship: 'none', parentPhone: '' })

    const [classes, setClasses] = useState([])
    const [selectedImportClassId, setSelectedImportClassId] = useState('')
    const [selectedImportSectionId, setSelectedImportSectionId] = useState('')
    const [selectedClassFilter, setSelectedClassFilter] = useState('')
    const [selectedSectionFilter, setSelectedSectionFilter] = useState('')
    const [schoolInfo, setSchoolInfo] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [bulkDeleting, setBulkDeleting] = useState(false)

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

    const fetchStudents = async (page = 1) => {
        setLoading(true)
        try {
            const classParam = selectedClassFilter ? `&classId=${selectedClassFilter}` : ''
            const sectionParam = selectedSectionFilter ? `&sectionId=${selectedSectionFilter}` : ''
            const res = await axios.get(`${apiUrl}/api/students?page=${page}&limit=50&search=${search}${classParam}${sectionParam}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setStudents(res.data.students || [])
            setPagination(res.data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
            setLoading(false)
        } catch (e) {
            console.error(e)
            setLoading(false)
        }
    }

    const fetchClasses = async () => {
        try {
            // Use schoolId from schoolInfo if available (important for Super Admin/Owner impersonation)
            const sId = schoolInfo?.id || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('schoolInfo') || '{}').id : null);
            const res = await axios.get(`${apiUrl}/api/classes${sId ? `?schoolId=${sId}` : ''}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setClasses(res.data)
        } catch (e) { console.error(e) }
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchStudents(1)
        }, 300)
        return () => clearTimeout(timer)
    }, [search, selectedClassFilter, selectedSectionFilter])

    useEffect(() => {
        const info = typeof window !== 'undefined' ? localStorage.getItem('schoolInfo') : ''
        if (info) setSchoolInfo(JSON.parse(info))
    }, [])

    useEffect(() => {
        fetchClasses()
    }, [schoolInfo?.id])

    const fetchAllStudentsForExport = async () => {
        try {
            const classParam = selectedClassFilter ? `&classId=${selectedClassFilter}` : ''
            const sectionParam = selectedSectionFilter ? `&sectionId=${selectedSectionFilter}` : ''
            const searchParam = search ? `&search=${search}` : ''
            const res = await axios.get(`${apiUrl}/api/students?page=1&limit=99999${searchParam}${classParam}${sectionParam}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            return res.data.students || []
        } catch (e) {
            console.error(e)
            return students // fallback to visible students
        }
    }

    const handleExportExcel = async () => {
        const allStudents = await fetchAllStudentsForExport()
        const data = allStudents.map(s => ({
            [t('name')]: s.user.name,
            [t('id')]: s.student_id,
            [t('class')]: s.class_name + (s.section_name !== 'N/A' ? ` - ${s.section_name}` : ''),
            [t('status')]: s.status || 'active'
        }))
        exportToExcel(data, `Students_Report_${new Date().toLocaleDateString()}`)
    }

    const handleExportPDF = async () => {
        const allStudents = await fetchAllStudentsForExport()
        const headers = [t('name'), t('id'), t('class'), t('status')]
        const data = allStudents.map(s => [
            s.user.name, 
            s.student_id, 
            s.class_name + (s.section_name !== 'N/A' ? ` - ${s.section_name}` : ''),
            s.status || 'active'
        ])
        exportToPDF(headers, data, `Students_Report_${new Date().toLocaleDateString()}`, t('students'), schoolInfo)
    }



    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        if (!formData.sectionId) {
            alert('Fadlan dooro Section (Qaybta) ka hor intaadan save-gareyn.');
            setSubmitting(false);
            return;
        }
        try {
            await axios.post(`${apiUrl}/api/students/create`, formData, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            
            setShowModal(false)
            setFormData({ name: '', password: '', class: '', classId: '', sectionId: '', phone: '', address: '', gender: '', scholarship: 'none' })
            fetchStudents()
            alert('Ardayga sir guul ah ayaa loo diwaan geliyey!');
        } catch (e) { 
            alert(e.response?.data?.message || 'Error creating student') 
        } finally { 
            setSubmitting(false) 
        }
    }

    const deleteStudent = async (id) => {
        if (!confirm('Are you sure you want to delete this student?')) return
        try {
            await axios.delete(`${apiUrl}/api/students/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            fetchStudents()
        } catch (e) { alert('Error deleting student') }
    }

    const handleBulkDeleteSection = async () => {
        if (!selectedSectionFilter) {
            alert('Fadlan marka hore dooro Section-ka aad rabto inaad tirtirto.')
            return
        }
        const sectionName = classes
            .flatMap(c => c.Sections || [])
            .find(s => s.id === selectedSectionFilter)?.name || 'this section'
        if (!confirm(`⚠️ DIGNIIN: Tani waxay tirtiraysa DHAMMAAN ardayda ku jira "${sectionName}". Tani ma soo kabanayso! Ma hubtaa?`)) return
        setBulkDeleting(true)
        try {
            const res = await axios.delete(`${apiUrl}/api/students/bulk-delete/section/${selectedSectionFilter}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            alert(`✅ ${res.data.message}`)
            setSelectedSectionFilter('')
            fetchStudents()
        } catch (e) {
            alert(`❌ Khalad: ${e.response?.data?.message || 'Wax khalad ah ayaa dhacay'}`)
        } finally {
            setBulkDeleting(false)
        }
    }

    const handleDownloadReportCard = async (student) => {
        try {
            // Fetch student marks/results from the exams system
            const res = await axios.get(`${apiUrl}/api/exams/student/${student.id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            generateReportCard(student, res.data)
        } catch (e) {
            const msg = e.response?.data?.message || e.message
            alert(`Report Card Error: ${msg}`)
            console.error('Report card fetch failed:', e)
        }
    }

    // ==================== EDIT FUNCTIONS ====================

    const openEdit = (student) => {
        setEditingStudent(student)
        setEditData({
            name: student.user.name || '',
            student_id: student.student_id || '',
            password: '',
            class: student.class || '',
            classId: student.classId || '',
            sectionId: student.sectionId || '',
            phone: student.phone || '',
            address: student.address || '',
            gender: student.gender || '',
            dob: student.dob ? student.dob.substring(0, 10) : '',
            scholarship: student.scholarship || 'none',
            parentPhone: student.parentPhone || ''
        })
        setShowEditModal(true)
    }

    const handleEditSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        if (!editData.sectionId) {
            alert('Fadlan dooro Section (Qaybta) ka hor intaadan save-gareyn.');
            setSubmitting(false);
            return;
        }
        try {
            const updatePayload = { ...editData }
            if (!updatePayload.password) delete updatePayload.password
            await axios.put(`${apiUrl}/api/students/${editingStudent.id}`, updatePayload, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setShowEditModal(false)
            setEditingStudent(null)
            fetchStudents()
        } catch (e) { alert(e.response?.data?.message || 'Error updating student') }
        finally { setSubmitting(false) }
    }

    // ==================== EXCEL FUNCTIONS ====================

    const downloadTemplate = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/students/template`, {
                headers: { Authorization: `Bearer ${getToken()}` },
                responseType: 'blob'
            })
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const a = document.createElement('a')
            a.href = url
            a.download = 'students_template.xlsx'
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

        // Preview the file
        const reader = new FileReader()
        reader.onload = (e) => {
            const wb = XLSX.read(e.target.result, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const data = XLSX.utils.sheet_to_json(ws)
            setTotalRows(data.length)
            setPreviewData(data.slice(0, 50)) // preview max 50 rows
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
        if (!excelFile) return;
        if (!selectedImportSectionId) {
            alert('Fadlan horta dooro Section-ka (Qaybta) aad rabto inay ardaydan galaan.');
            return;
        }
        setImporting(true);
        setImportResult(null);

        const formDataUpload = new FormData()
        formDataUpload.append('file', excelFile)
        formDataUpload.append('classId', selectedImportClassId)
        formDataUpload.append('sectionId', selectedImportSectionId)

        try {
            const res = await axios.post(`${apiUrl}/api/students/import`, formDataUpload, {
                headers: {
                    Authorization: `Bearer ${getToken()}`,
                    'Content-Type': 'multipart/form-data'
                }
            })
            setImportResult(res.data)
            if (res.data.success > 0) {
                fetchStudents()
                alert(`Import Successful! ${res.data.success} students were added.`)
                resetExcelModal() // This closes the modal and resets the state
            }
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
        setSelectedImportClassId('')
        setSelectedImportSectionId('')
    }

    return (
        <Layout title={t('students')}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <button 
                            onClick={() => router.push('/admin/students')}
                            className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 font-bold text-xs uppercase tracking-widest"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Hub
                        </button>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Management</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">{t('manage_students_title')}</h2>
                    <p className="text-gray-400 text-sm">{t('manage_students_desc')}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search students..."
                            className="bg-white border border-gray-100 pl-10 pr-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64 shadow-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div className="relative flex gap-2">
                        <div className="relative">
                            <select
                                className="bg-white border border-gray-100 pl-4 pr-10 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-48 shadow-sm appearance-none"
                                value={selectedClassFilter}
                                onChange={(e) => { setSelectedClassFilter(e.target.value); setSelectedSectionFilter(''); }}
                            >
                                <option value="">All Grades</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.class_name}</option>
                                ))}
                            </select>
                            <svg className="w-4 h-4 text-gray-400 absolute right-3 top-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                        <div className="relative">
                            <select
                                className="bg-white border border-gray-100 pl-4 pr-10 py-3 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none w-48 shadow-sm appearance-none"
                                value={selectedSectionFilter}
                                onChange={(e) => setSelectedSectionFilter(e.target.value)}
                            >
                                <option value="">All Sections</option>
                                {selectedClassFilter ? 
                                    (classes.find(c => c.id === selectedClassFilter)?.Sections || []).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.shift})</option>
                                    ))
                                : 
                                    classes.flatMap(c => (c.Sections || []).map(s => ({...s, class_name: c.class_name}))).map(s => (
                                        <option key={s.id} value={s.id}>{s.class_name} - {s.name} ({s.shift})</option>
                                    ))
                                }
                            </select>
                            <svg className="w-4 h-4 text-gray-400 absolute right-3 top-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>
                    <button
                        onClick={handleExportPDF}
                        className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        📄 {t('export_pdf')}
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                    >
                        📊 {t('export_excel')}
                    </button>
                    <button
                        onClick={() => setShowExcelModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                    >
                        Import Excel
                    </button>
                    {selectedSectionFilter && (
                        <button
                            onClick={handleBulkDeleteSection}
                            disabled={bulkDeleting}
                            className={`${bulkDeleting ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'} text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-100 flex items-center gap-2`}
                        >
                            {bulkDeleting ? (
                                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Deleting...</>
                            ) : (
                                <>🗑️ Delete All in Section</>
                            )}
                        </button>
                    )}
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
                    >
                        Add New Student
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <TableSkeleton />
                ) : (
                    <>
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left min-w-max">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]">
                                        <th className="px-6 py-4 w-12">#</th>
                                        <th className="px-6 py-4">{t('name')}</th>
                                        <th className="px-6 py-4">{t('id')}</th>
                                        <th className="px-6 py-4">{t('class')}</th>
                                        <th className="px-6 py-4 text-right">{t('action')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {students.map((s, index) => (
                                        <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 text-xs font-bold text-gray-400">
                                                {(pagination.page - 1) * pagination.limit + index + 1}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-700">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-black">
                                                        {s.user.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <span translate="no" className="notranslate">{s.user.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-blue-600">{s.student_id}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {s.class_name}
                                                <div className="text-xs font-bold text-gray-400 mt-1">Section: {s.section_name}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <button onClick={() => router.push(`/admin/student-history/${s.id}`)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-bold text-sm transition-all flex items-center gap-1">
                                                    🏛️ History
                                                </button>
                                                <button onClick={() => openEdit(s)} className="bg-amber-50 text-amber-600 hover:bg-amber-100 px-3 py-1.5 rounded-lg font-bold text-sm transition-all">Edit</button>
                                                <button onClick={() => deleteStudent(s.id)} className="text-red-400 hover:text-red-700 font-bold mx-2">Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between bg-slate-50/50">
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                                    Showing {students.length} of {pagination.total} students
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        disabled={pagination.page === 1}
                                        onClick={() => fetchStudents(pagination.page - 1)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${pagination.page === 1 ? 'text-gray-300 cursor-not-allowed' : 'bg-white border border-gray-100 text-slate-600 hover:bg-white shadow-sm'}`}
                                    >
                                        Previous
                                    </button>
                                    <button
                                        disabled={pagination.page === pagination.totalPages}
                                        onClick={() => fetchStudents(pagination.page + 1)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${pagination.page === pagination.totalPages ? 'text-gray-300 cursor-not-allowed' : 'bg-white border border-gray-100 text-slate-600 hover:bg-white shadow-sm'}`}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}

                        {students.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <p className="text-lg font-bold mb-1">No students found</p>
                                <p className="text-sm">Try adjusting your search or add students</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ==================== MANUAL ADD MODAL ==================== */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-bold">Register New Student</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 grid grid-cols-2 gap-4 overflow-y-auto">

                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Full Name *</label>
                                <input required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="col-span-2 bg-blue-50 rounded-xl px-4 py-2">
                                <p className="text-xs font-bold text-blue-600">ℹ️ Student login ID will be auto-generated by the system</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Password *</label>
                                <input required type="password" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Gender *</label>
                                <select required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                                    <option value="">Select...</option>
                                    <option value="Male">👦 Male (Wiil)</option>
                                    <option value="Female">👧 Female (Gabar)</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Scholarship Status</label>
                                <select
                                    className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold"
                                    value={formData.scholarship}
                                    onChange={e => setFormData({ ...formData, scholarship: e.target.value })}
                                >
                                    <option value="none">Non Scholarship</option>
                                    <option value="full">Full Scholarship</option>
                                    <option value="half">Half Scholarship</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Assigned Grade</label>
                                <select
                                    className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    value={formData.classId}
                                    onChange={e => {
                                        const selected = classes.find(c => c.id === e.target.value)
                                        setFormData({ ...formData, classId: e.target.value, class: selected ? selected.class_name : '', sectionId: '' })
                                    }}
                                >
                                    <option value="">Select Grade...</option>
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.class_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Section *</label>
                                <select
                                    className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    value={formData.sectionId}
                                    onChange={e => setFormData({ ...formData, sectionId: e.target.value })}
                                    disabled={!formData.classId}
                                >
                                    <option value="">Select Section...</option>
                                    {(classes.find(c => c.id === formData.classId)?.Sections || []).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.shift})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Phone</label>
                                <input className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Address</label>
                                <input className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                            </div>
                            <div className="col-span-2 mt-2 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-100 transition-all`}
                                >
                                    {submitting ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Saving...
                                        </div>
                                    ) : 'Register Student'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl border-2 border-gray-100 font-bold text-gray-400">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==================== EDIT STUDENT MODAL ==================== */}
            {showEditModal && editingStudent && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl font-bold">Edit Student</h3>
                                <p className="text-amber-100 text-sm mt-0.5">ID: {editingStudent.student_id}</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="text-amber-200 hover:text-white text-xl">✕</button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-8 grid grid-cols-2 gap-4 overflow-y-auto">

                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Full Name</label>
                                <input required className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Student ID <span className="text-blue-500 normal-case">(editable)</span></label>
                                <input className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none" value={editData.student_id} onChange={e => setEditData({ ...editData, student_id: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">New Password <span className="normal-case text-gray-300">(leave blank to keep)</span></label>
                                <input type="password" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none" placeholder="••••••••" value={editData.password} onChange={e => setEditData({ ...editData, password: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Gender</label>
                                <select className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold" value={editData.gender} onChange={e => setEditData({ ...editData, gender: e.target.value })}>
                                    <option value="">Select...</option>
                                    <option value="Male">👦 Male (Wiil)</option>
                                    <option value="Female">👧 Female (Gabar)</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Scholarship Status</label>
                                <select
                                    className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none bg-white font-bold"
                                    value={editData.scholarship}
                                    onChange={e => setEditData({ ...editData, scholarship: e.target.value })}
                                >
                                    <option value="none">Non Scholarship</option>
                                    <option value="full">Full Scholarship</option>
                                    <option value="half">Half Scholarship</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Date of Birth</label>
                                <input type="date" className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none" value={editData.dob} onChange={e => setEditData({ ...editData, dob: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Assigned Grade</label>
                                <select
                                    className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                                    value={editData.classId}
                                    onChange={e => {
                                        const selected = classes.find(c => c.id === e.target.value)
                                        setEditData({ ...editData, classId: e.target.value, class: selected ? selected.class_name : '', sectionId: '' })
                                    }}
                                >
                                    <option value="">Select Grade...</option>
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.class_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Section</label>
                                <select
                                    className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    value={editData.sectionId}
                                    onChange={e => setEditData({ ...editData, sectionId: e.target.value })}
                                    disabled={!editData.classId}
                                >
                                    <option value="">Select Section...</option>
                                    {(classes.find(c => c.id === editData.classId)?.Sections || []).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.shift})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Phone</label>
                                <input className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Address</label>
                                <input className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-amber-500 outline-none" value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-bold text-emerald-600 uppercase mb-1 block flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    Telefoonka Waalidka (Parent Phone)
                                </label>
                                <input
                                    type="tel"
                                    placeholder="Tusaale: 2526XXXXXXX"
                                    className="w-full p-3 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-400 outline-none bg-emerald-50/30"
                                    value={editData.parentPhone}
                                    onChange={e => setEditData({ ...editData, parentPhone: e.target.value })}
                                />
                                <p className="text-[10px] text-emerald-600 mt-1 font-medium">📱 Tani waxay u oggolaanaysaa SMS-ga in toos loogu diro waalidka xitaa haddaan akoon u lahayn</p>
                            </div>
                            <div className="col-span-2 mt-2 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'} text-white font-bold py-3 rounded-xl shadow-lg shadow-amber-100 transition-all`}
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
                                    Import Students from Excel
                                </h3>
                                <p className="text-emerald-100 text-sm mt-1">Upload an Excel file to bulk-register students</p>
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
                                    Download students_template.xlsx
                                </button>
                                <div className="ml-11 mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                                    <p className="text-xs font-bold text-blue-700 mb-1">📋 Sida Excel-ka loo diyaariyaa:</p>
                                    <ul className="text-xs text-blue-600 space-y-1 list-none">
                                        <li>✅ <strong>Student ID (Optional)</strong> — Haddii ardayga ID leeyahay, ku qor; haddii kale, banaan ka daa oo system-ku auto-generate gareenayaa</li>
                                        <li>✅ <strong>Name</strong> — Magaca ardayga (waajib ah)</li>
                                        <li>✅ <strong>Password</strong> — Sirta; haddii banaan, default waa <code className="bg-blue-100 px-1 rounded">123123</code></li>
                                    </ul>
                                </div>
                            </div>

                            {/* Step 2: Select Class (Optional) */}
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                                    <h4 className="font-bold text-slate-700">Select Target Class (Optional)</h4>
                                </div>
                                <div className="ml-11 space-y-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Grade / Class</label>
                                            <select
                                                className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-slate-700"
                                                value={selectedImportClassId}
                                                onChange={e => {
                                                    setSelectedImportClassId(e.target.value)
                                                    setSelectedImportSectionId('')
                                                }}
                                            >
                                                <option value="">-- Use "Class" column from Excel --</option>
                                                {classes.map(c => (
                                                    <option key={c.id} value={c.id}>{c.class_name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {selectedImportClassId && (
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block text-emerald-600">Target Section *</label>
                                                <select
                                                    className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 outline-none bg-white font-medium text-slate-700"
                                                    value={selectedImportSectionId}
                                                    onChange={e => setSelectedImportSectionId(e.target.value)}
                                                >
                                                    <option value="">-- Select Section --</option>
                                                    {(classes.find(c => c.id === selectedImportClassId)?.Sections || []).map(s => (
                                                        <option key={s.id} value={s.id}>{s.name} ({s.shift})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                            If selected, all students in the Excel will be assigned to this class/section.
                                        </p>
                                    </div>
                            </div>

                            {/* Step 3: Upload File */}
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
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
                                        <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">4</span>
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
                                disabled={!excelFile || !selectedImportSectionId || importing}
                                className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${excelFile && selectedImportSectionId && !importing ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                                {importing ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                        Import {totalRows} Students
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



            {/* ==================== STUDENT DETAILS MODAL ==================== */}
        </Layout>
    )
}
