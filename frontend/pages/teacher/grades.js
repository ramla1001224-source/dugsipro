import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function TeacherGrades() {
    const [classes, setClasses] = useState([])
    const [selectedClass, setSelectedClass] = useState('')
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({ studentId: '', subject: '', score: '', grade: '' })
    const [importing, setImporting] = useState(false)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        return { Authorization: `Bearer ${token}` }
    }

    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        axios.get(`${apiUrl}/api/classes`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => setClasses(res.data))
            .catch(console.error)
    }, [])

    useEffect(() => {
        if (!selectedClass) return
        setLoading(true)
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        axios.get(`${apiUrl}/api/students?classId=${selectedClass}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => {
                const studentsList = Array.isArray(res.data) ? res.data : (res.data.students || [])
                setStudents(studentsList)
                setLoading(false)
            })
            .catch(e => {
                console.error(e)
                setLoading(false)
            })
    }, [selectedClass])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!selectedClass || !formData.studentId) return
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : ''
        setSubmitting(true)
        try {
            await axios.post(`${apiUrl}/api/grades/create`, {
                ...formData,
                classId: selectedClass
            }, { headers: { Authorization: `Bearer ${token}` } })
            alert('Grade submitted successfully')
            setFormData({ studentId: '', subject: '', score: '', grade: '' })
        } catch (e) {
            alert(e.response?.data?.message || 'Failed to submit grade')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDownloadExcel = () => {
        if (!selectedClass || !formData.subject) {
            alert('Fadlan dooro Fasalka (Class) oo qor Maaddada (Subject) inta aadan soo dejin Excel-ka.');
            return;
        }
        const url = `${apiUrl}/api/grades/export-template?classId=${selectedClass}&subject=${encodeURIComponent(formData.subject)}`;
        
        axios.get(url, { headers: headers(), responseType: 'blob' }).then(res => {
            const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', `${formData.subject}_Grades_Template.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        }).catch(err => {
            console.error('Download error:', err);
            alert('Khalad ayaa dhacay markii la soo dejinayey Excel-ka.');
        });
    }

    const handleUploadExcel = () => {
        if (!selectedClass || !formData.subject) {
            alert('Fadlan dooro Fasalka (Class) oo qor Maaddada (Subject) inta aadan soo gelin Excel-ka.');
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx, .xls';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const uploadData = new FormData();
            uploadData.append('file', file);
            uploadData.append('classId', selectedClass);
            uploadData.append('subject', formData.subject);
            
            setImporting(true);
            
            axios.post(`${apiUrl}/api/grades/import-marks`, uploadData, { 
                headers: { ...headers(), 'Content-Type': 'multipart/form-data' } 
            }).then(res => {
                alert(res.data.message || 'Waa la keydiyey.');
                if (res.data.errors && res.data.errors.length > 0) {
                    alert('Qaladaad:\n' + res.data.errors.join('\n'));
                }
                // Optional: fetch grades to update the view if we had a table
            }).catch(err => {
                console.error('Upload error:', err);
                alert(err.response?.data?.message || 'Cillad ayaa dhacday markii Excel-ka la akhriyey.');
            }).finally(() => {
                setImporting(false);
            });
        };
        input.click();
    }

    return (
        <Layout title="Student Grading">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
                    <h2 className="text-xl font-bold text-slate-800 mb-6">Submit New Grade</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Class</label>
                            <select
                                className="w-full p-3 rounded-xl border appearance-none bg-white font-medium"
                                value={selectedClass}
                                onChange={e => setSelectedClass(e.target.value)}
                            >
                                <option value="">-- Select Class --</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Student</label>
                            <select
                                required
                                className="w-full p-3 rounded-xl border appearance-none bg-white font-medium disabled:opacity-50"
                                value={formData.studentId}
                                disabled={!selectedClass || loading}
                                onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                            >
                                <option value="">-- Select Student --</option>
                                {students.map(s => <option key={s.id} value={s.id}>{s.user.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Subject</label>
                            <input
                                required
                                className="w-full p-3 rounded-xl border"
                                placeholder="e.g. Mathematics"
                                value={formData.subject}
                                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Score (%)</label>
                                <input
                                    required
                                    type="number"
                                    className="w-full p-3 rounded-xl border"
                                    placeholder="0-100"
                                    value={formData.score}
                                    onChange={e => setFormData({ ...formData, score: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Grade (Optional)</label>
                                <input
                                    className="w-full p-3 rounded-xl border"
                                    placeholder="A, B+, etc."
                                    value={formData.grade}
                                    onChange={e => setFormData({ ...formData, grade: e.target.value })}
                                />
                            </div>
                        </div>
                        <button
                            disabled={submitting || importing}
                            type="submit"
                            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-70"
                        >
                            {submitting ? 'Submitting...' : 'Post Grade'}
                        </button>
                    </form>

                    <div className="mt-8 border-t border-slate-100 pt-6">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Bulk Import (Excel)</h3>
                        <div className="flex gap-2">
                            <button
                                disabled={importing}
                                onClick={handleDownloadExcel}
                                title="Download Excel Template"
                                className="flex-1 bg-emerald-50 hover:bg-emerald-500 text-emerald-700 hover:text-white border border-emerald-200 px-3 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                <span>Excel Daji</span>
                            </button>
                            <button
                                disabled={importing}
                                onClick={handleUploadExcel}
                                title="Upload Excel Marks"
                                className="flex-1 bg-indigo-50 hover:bg-indigo-500 text-indigo-700 hover:text-white border border-indigo-200 px-3 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                <span>{importing ? '...' : 'Excel Geli'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-slate-800">Class Performance Overview</h2>
                    </div>
                    <div className="p-20 text-center text-gray-400 italic">
                        Select a class and student to begin grading or view records.
                    </div>
                </div>
            </div>
        </Layout>
    )
}
