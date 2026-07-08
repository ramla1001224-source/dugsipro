import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { getImageUrl } from '../../utils/imageHelper'

export default function AdminExams() {
    const [exams, setExams] = useState([])
    const [subjects, setSubjects] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [showResultsModal, setShowResultsModal] = useState(false)
    const [selectedExamResults, setSelectedExamResults] = useState([])
    const [currentExam, setCurrentExam] = useState(null)
    const [classes, setClasses] = useState([])
    const [formData, setFormData] = useState({ name: '', type: '', classId: '', sectionId: '', termId: '', totalMarks: 100, date: '' })
    const [userRole, setUserRole] = useState('')
    const [showGradingModal, setShowGradingModal] = useState(false)
    const [gradingSheet, setGradingSheet] = useState([])
    const [gradingSectionId, setGradingSectionId] = useState('')
    const [saving, setSaving] = useState(false)
    const [loadingExamId, setLoadingExamId] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState('academic')
    const [historyYearId, setHistoryYearId] = useState('')
    const academicSequence = ['monthly_1', 'midterm', 'monthly_2', 'final', 'bile_1', 'bile_2', 'midterm_exam']
    const [academicYears, setAcademicYears] = useState([])
    const [selectedTerm, setSelectedTerm] = useState('')
    const [selectedYearId, setSelectedYearId] = useState('')
    const [loading, setLoading] = useState(true)
    const [selectedClass, setSelectedClass] = useState('')
    const [canManageExams, setCanManageExams] = useState(true)
    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [schedulingExam, setSchedulingExam] = useState(null)
    const [scheduleData, setScheduleData] = useState({ date: '', time: '', endTime: '', description: '' })
    const [schoolInfo, setSchoolInfo] = useState(null)
    
    // Quick Add Results State
    const [quickAddId, setQuickAddId] = useState('')
    const [quickAddResult, setQuickAddResult] = useState(null)
    const [validatingCode, setValidatingCode] = useState(false)

    // New states for per-subject marks
    const [marksMode, setMarksMode] = useState('single')
    const [subjectMarks, setSubjectMarks] = useState({})

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        const role = typeof window !== 'undefined' ? localStorage.getItem('role') : '' || ''
        setUserRole(role)

        const info = typeof window !== 'undefined' ? localStorage.getItem('schoolInfo') : ''
        if (info) setSchoolInfo(JSON.parse(info))

        if (role === 'teacher') {
            axios.get(`${apiUrl}/api/settings/perm_tea_manage_exams`, { headers: headers() })
                .then(res => setCanManageExams(res.data.value === 'true'))
                .catch(() => setCanManageExams(false))
        }
    }, [])

    // fetchAll accepts current term/year as parameter to avoid stale closure bug
    const fetchAll = async (termId, yearId) => {
        setLoading(true);
        const t = termId !== undefined ? termId : selectedTerm;
        let yId = yearId !== undefined ? yearId : selectedYearId;
        
        // Ensure we have academic years to know which is current
        let academicYearsData = academicYears;
        if (academicYearsData.length === 0) {
            try {
                const yRes = await axios.get(`${apiUrl}/api/academic-years`, { headers: headers() });
                academicYearsData = Array.isArray(yRes.data) ? yRes.data : (yRes.data.data || []);
                setAcademicYears(academicYearsData);
            } catch (err) { console.error('Error fetching academic years:', err); }
        }

        // Auto-resolve current year if none selected and not in history mode
        if (!yId && activeTab !== 'history' && academicYearsData.length > 0) {
            const current = academicYearsData.find(yr => yr.isCurrent);
            if (current) {
                yId = current.id;
                setSelectedYearId(yId);
            }
        }
        
        let query = '';
        if (t) query += `?termId=${t}`;
        if (yId) query += (query ? '&' : '?') + `academicYearId=${yId}`;

        const [e, s, c] = await Promise.all([
            axios.get(`${apiUrl}/api/exams${query}`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/subjects`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/classes`, { headers: headers() }).catch(() => ({ data: [] }))
        ])
        const examsData = Array.isArray(e.data) ? e.data : (e.data.data || []);
        const subjectsData = Array.isArray(s.data) ? s.data : (s.data.data || []);
        const classesData = Array.isArray(c.data) ? c.data : (c.data.data || []);

        setExams(examsData); 
        setSubjects(subjectsData); 
        setClasses(classesData); 
        
        // Auto-fill term if missing in formData for current year
        if (academicYearsData.length > 0) {
            const current = academicYearsData.find(yr => yr.isCurrent);
            if (current && current.Terms && current.Terms.length > 0 && !formData.termId) {
                setFormData(prev => ({ ...prev, termId: current.Terms[0].id }));
            }
        }
        
        setFormData(prev => ({
            ...prev,
            classId: classesData.length > 0 ? (prev.classId || classesData[0].id) : ''
        }))
        setLoading(false);
    }
    useEffect(() => { fetchAll(selectedTerm, selectedYearId) }, [selectedTerm, selectedYearId])

    // Filter exams based on class and tab
    const filteredExams = exams.filter(ex => {
        const matchesClass = !selectedClass || ex.classId === selectedClass;
        
        const currentYear = academicYears.find(y => y.isCurrent);
        const examYearId = ex.term?.academicYearId;
        const isPastYearSelected = selectedYearId && (!currentYear || selectedYearId !== currentYear.id);

        let matchesTab = false;
        if (activeTab === 'history') {
            // History tab:
            // 1. If a year is SELECTED: strictly show that year
            // 2. If NO year is selected: show all exams EXCEPT those from the current year
            if (selectedYearId) {
                matchesTab = examYearId === selectedYearId;
            } else {
                // Return true if it follows the "history" rule (not from current year)
                // If currentYear isn't found yet, we might show everything temporarily
                matchesTab = !currentYear || (examYearId && examYearId !== currentYear.id) || !examYearId;
            }
        } else {
            // Academic and Others tabs: ONLY show current year exams
            const isExamFromCurrentYear = currentYear && examYearId === currentYear.id;
            
            // If a past year is explicitly selected via dropdown while on these tabs, 
            // we treat it as 'no match' because these tabs are for the ACTIVE school operation.
            if (isPastYearSelected || (!isExamFromCurrentYear && currentYear && examYearId)) {
                matchesTab = false; 
            } else {
                matchesTab = activeTab === 'academic'
                    ? academicSequence.includes(ex.type)
                    : !academicSequence.includes(ex.type);
            }
        }
        
        return matchesClass && matchesTab;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const openGrading = async (exam) => {
        setLoadingExamId(exam.id)
        setCurrentExam(exam)
        const initialSectionId = exam.sectionId || ''
        setGradingSectionId(initialSectionId)
        try {
            const url = initialSectionId 
                ? `${apiUrl}/api/exams/${exam.id}/results?grading=true&sectionId=${initialSectionId}`
                : `${apiUrl}/api/exams/${exam.id}/results?grading=true`
            const res = await axios.get(url, { headers: headers() })
            setGradingSheet(res.data.data || [])
            setShowGradingModal(true)
        } catch (err) { alert('Error loading students') }
        finally { setLoadingExamId(null) }
    }

    const loadGradingForSection = async (sectionId) => {
        if (!currentExam) return
        setGradingSectionId(sectionId)
        try {
            const url = sectionId
                ? `${apiUrl}/api/exams/${currentExam.id}/results?grading=true&sectionId=${sectionId}`
                : `${apiUrl}/api/exams/${currentExam.id}/results?grading=true`
            const res = await axios.get(url, { headers: headers() })
            setGradingSheet(res.data.data || [])
        } catch (err) { alert('Error loading section students') }
    }

    const validateQuickCode = async (code) => {
        setQuickAddId(code)
        if (!code || code.length < 2) {
            setQuickAddResult(null)
            return
        }
        setValidatingCode(true)
        try {
            const res = await axios.get(`${apiUrl}/api/students/validate-code/${code}`, { headers: headers() })
            if (res.data.success) {
                setQuickAddResult(res.data)
            } else {
                setQuickAddResult(null)
            }
        } catch (err) {
            setQuickAddResult(null)
        } finally {
            setValidatingCode(false)
        }
    }

    const addValidatedStudent = () => {
        if (!quickAddResult) return
        
        // Prevent duplicate
        if (gradingSheet.find(s => s.studentId === quickAddResult.id)) {
            alert('Ardaygan mar hore ayaa lagu daray liiska.')
            return
        }

        const newRow = {
            studentId: quickAddResult.id,
            studentName: quickAddResult.name,
            studentRegId: quickAddResult.student_id,
            sectionName: quickAddResult.sectionName || 'N/A',
            marks: '',
            remarks: '',
            grade: '',
            id: null
        }
        setGradingSheet([newRow, ...gradingSheet])
        setQuickAddId('')
        setQuickAddResult(null)
    }

    const handleDownloadExcel = (exam) => {
        const sectionParam = exam.sectionId ? `&sectionId=${exam.sectionId}` : '';
        const url = `${apiUrl}/api/exams/export-template?examId=${exam.id}&classId=${exam.classId}&subjectId=${exam.subjectId}${sectionParam}`;
        
        axios.get(url, { headers: headers(), responseType: 'blob' }).then(res => {
            const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', `${exam.subject?.name || 'Marks'}_Template.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        }).catch(err => {
            console.error('Download error:', err);
            alert('Khalad ayaa dhacay markii la soo dejinayey Excel-ka.');
        });
    }

    const handleUploadExcel = (exam) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx, .xls';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('examId', exam.id);
            
            setLoadingExamId(exam.id);
            
            axios.post(`${apiUrl}/api/exams/import-marks`, formData, { 
                headers: { ...headers(), 'Content-Type': 'multipart/form-data' } 
            }).then(res => {
                alert(res.data.message || 'Waa la keydiyey.');
                if (res.data.errors && res.data.errors.length > 0) {
                    alert('Qaladaad:\n' + res.data.errors.join('\n'));
                }
                fetchAll();
            }).catch(err => {
                console.error('Upload error:', err);
                alert(err.response?.data?.message || 'Cillad ayaa dhacday markii Excel-ka la akhriyey.');
            }).finally(() => {
                setLoadingExamId(null);
            });
        };
        input.click();
    }

    const submitGrades = async () => {
        setSaving(true)
        try {
            const results = gradingSheet
                .filter(row => row.marks !== '') // Only send those with marks
                .map(row => ({
                    studentId: row.studentId,
                    classId: row.classId || currentExam.classId,
                    sectionId: row.sectionId || gradingSectionId || null,
                    marks: row.marks,
                    remarks: row.remarks,
                    grade: row.grade
                }))

            await axios.post(`${apiUrl}/api/exams/${currentExam.id}/results`, { results }, { headers: headers() })
            alert('Grades saved successfully!')
            setShowGradingModal(false)
            fetchAll()
        } catch (err) {
            alert(err.response?.data?.message || 'Error saving grades')
        } finally { setSaving(false) }
    }

    const typeColors = {
        monthly_1: 'bg-cyan-50 text-cyan-600',
        midterm: 'bg-blue-50 text-blue-600',
        monthly_2: 'bg-indigo-50 text-indigo-600',
        final: 'bg-purple-50 text-purple-600',
        quiz: 'bg-amber-50 text-amber-600',
        assignment: 'bg-green-50 text-green-600'
    }

    const statusConfig = {
        draft: { label: 'Draft', classes: 'bg-gray-100 text-gray-500' },
        published: { label: 'Published', classes: 'bg-green-100 text-green-700' },
        locked: { label: 'Locked 🔒', classes: 'bg-red-100 text-red-700' }
    }

    const typeLabels = {
        monthly_1: 'Bile 1 (Monthly)', 
        midterm: 'Nus-Sannad (Mid-Term)', 
        monthly_2: 'Bile 2 (Monthly)',
        final: 'Sannad-Dhamaad (Final)', 
        quiz: 'Kedis (Quiz)', 
        assignment: 'Shaqo-Guri (Assignment)',
        bile_1: 'Bile 1 (Monthly)', 
        bile_2: 'Bile 2 (Monthly)', 
        midterm_exam: 'Mid-Term'
    }



    const handleViewResults = async (exam) => {
        setCurrentExam(exam)
        try {
            const res = await axios.get(`${apiUrl}/api/exams/${exam.id}/results`, { headers: headers() })
            setSelectedExamResults(res.data.data || [])
            setShowResultsModal(true)
        } catch (err) { alert('Error fetching results') }
    }

    const exportToExcel = () => {
        if (!selectedExamResults || selectedExamResults.length === 0) return;
        
        let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8" />
                <style>
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-family: Arial, sans-serif; }
                    th { background-color: #4F46E5; color: white; font-weight: bold; }
                    .title-row { font-size: 18px; font-weight: bold; text-align: center; }
                    .info-row { font-size: 12px; color: #666; }
                    .pass { color: green; font-weight: bold; }
                    .fail { color: red; font-weight: bold; }
                </style>
            </head>
            <body>
                <table>
                    <tr>
                        <td colspan="6" class="title-row">${currentExam.name} - Assessment Sheet</td>
                    </tr>
                    <tr>
                        <td colspan="6" class="info-row">Subject: ${currentExam.subject?.name || ''} | Class: ${currentExam.class?.class_name || ''} | Max Marks: ${currentExam.totalMarks}</td>
                    </tr>
                    <tr>
                        <th>Rank</th>
                        <th>Student ID</th>
                        <th>Student Name</th>
                        <th>Marks</th>
                        <th>Grade</th>
                        <th>Status</th>
                    </tr>
        `;

        const sortedResults = [...selectedExamResults].sort((a, b) => b.marks - a.marks);
        sortedResults.forEach((res, index) => {
            const percentage = (res.marks / currentExam.totalMarks) * 100;
            const isPass = percentage >= 50;
            
            let grade = 'F';
            if (percentage >= 90) grade = 'A+';
            else if (percentage >= 80) grade = 'A';
            else if (percentage >= 70) grade = 'B';
            else if (percentage >= 60) grade = 'C';
            else if (percentage >= 50) grade = 'D';

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>'${res.student?.student_id || ''}</td>
                    <td>${res.student?.user?.name || ''}</td>
                    <td>${res.marks} / ${currentExam.totalMarks}</td>
                    <td>${grade}</td>
                    <td class="${isPass ? 'pass' : 'fail'}">${isPass ? 'Pass' : 'Fail'}</td>
                </tr>
            `;
        });

        html += `
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentExam.name.replace(/\s+/g, '_')}_Results.xls`;
        a.click();
    };

    const exportToWord = () => {
        if (!selectedExamResults || selectedExamResults.length === 0) return;
        
        let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8" />
                <style>
                    body { font-family: 'Arial', sans-serif; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .title { font-size: 24px; font-weight: bold; color: #333; }
                    .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
                    th { background-color: #f3f4f6; font-weight: bold; }
                    .pass { color: #10B981; font-weight: bold; }
                    .fail { color: #EF4444; font-weight: bold; }
                    .footer { margin-top: 40px; font-size: 10px; color: #999; text-align: center; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">${currentExam.name}</div>
                    <div class="subtitle">Assessment Sheet Report</div>
                    <div class="subtitle">Subject: ${currentExam.subject?.name || ''} | Class: ${currentExam.class?.class_name || ''}</div>
                    <div class="subtitle">Max Marks: ${currentExam.totalMarks} | Total Students: ${selectedExamResults.length}</div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width: 10%">Rank</th>
                            <th style="width: 20%">Student ID</th>
                            <th style="width: 40%">Student Name</th>
                            <th style="width: 15%">Marks</th>
                            <th style="width: 15%">Grade</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        const sortedResults = [...selectedExamResults].sort((a, b) => b.marks - a.marks);
        sortedResults.forEach((res, index) => {
            const percentage = (res.marks / currentExam.totalMarks) * 100;
            
            let grade = 'F';
            if (percentage >= 90) grade = 'A+';
            else if (percentage >= 80) grade = 'A';
            else if (percentage >= 70) grade = 'B';
            else if (percentage >= 60) grade = 'C';
            else if (percentage >= 50) grade = 'D';

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${res.student?.student_id || ''}</td>
                    <td>${res.student?.user?.name || ''}</td>
                    <td>${res.marks} / ${currentExam.totalMarks}</td>
                    <td><b>${grade}</b></td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
                
                <div class="footer">
                    Report generated automatically by Smart School Pro on ${new Date().toLocaleDateString()}
                </div>
            </body>
            </html>
        `;

        const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentExam.name.replace(/\s+/g, '_')}_Results.doc`;
        a.click();
    };

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return

        // Validations
        if (!formData.type) {
            alert('Fadlan dooro Nooca Imtixaanka (Select Category)')
            return
        }

        // Check for duplicates in current list (for safety)
        const isDuplicate = exams.some(ex => 
            ex.type === formData.type && 
            ex.classId === formData.classId && 
            ex.termId === formData.termId
        )

        if (isDuplicate) {
            alert('Imtixaankan (Category-gan) mar hore ayuu fasalkan iyo term-kan ugu jiraa. Fadlan hubi.')
            return
        }

        setSubmitting(true)
        try {
            if (userRole === 'teacher' && !canManageExams) {
                alert('Fasax uma lihid inaad abuurto imtixaan. Fadlan la xiriir Admin-ka.')
                setSubmitting(false)
                return
            }
            
            const payload = {
                ...formData,
                marksMode,
                subjectMarks
            }
            
            // Sending formData without sessions array triggers bulk creation for ALL class subjects in the backend
            const res = await axios.post(`${apiUrl}/api/exams`, payload, { headers: headers() })
            alert(res.data.message || 'Exams created for all subjects!')
            setShowModal(false)
            setFormData({ name: '', type: '', classId: '', sectionId: '', termId: '', totalMarks: 100, date: '' })
            setSubjectMarks({})
            fetchAll()
        }
        catch (e) { alert(e.response?.data?.message || 'Error creating exams') }
        finally { setSubmitting(false) }
    }

    const handleStatusChange = async (examId, status) => {
        if (userRole === 'teacher' && !canManageExams) {
            alert('Fasax uma lihid inaad wax ka beddesho status-ka imtixaanka.')
            return
        }
        try {
            await axios.patch(`${apiUrl}/api/exams/${examId}/status`, { status }, { headers: headers() })
            fetchAll()
        } catch (err) { alert('Error updating status') }
    }

    const handleBulkStatusChange = async (examIds, status) => {
        if (examIds.length === 0) return;
        setSubmitting(true);
        try {
            await axios.patch(`${apiUrl}/api/exams/bulk-status`, { ids: examIds, status }, { headers: headers() });
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.message || 'Error updating batch status');
        } finally {
            setSubmitting(false);
        }
    }
    const handleSendSMS = async () => {
        if (!currentExam) return;
        if (!confirm('Ma hubtaa inaad rabto in SMS loo diro waalidiinta ardaydan? (Are you sure you want to send SMS results to parents?)')) return;
        
        const originalText = document.getElementById('sms-btn-text').innerText;
        document.getElementById('sms-btn-text')?.setAttribute('data-orig', originalText);
        const btnText = document.getElementById('sms-btn-text');
        if (btnText) btnText.innerText = 'Dirayaa...';
        
        try {
            const res = await axios.post(`${apiUrl}/api/exams/${currentExam.id}/send-sms`, {}, { headers: headers() });
            alert(res.data.message || 'SMS dirista waa la dhameeyay');
        } catch (err) {
            alert(err.response?.data?.message || 'Cillad ayaa ku timid diridda SMS-ka');
        } finally {
            const btnTextBack = document.getElementById('sms-btn-text');
            if (btnTextBack) btnTextBack.innerText = originalText;
        }
    }

    const handleOpenSchedule = (exam) => {
        setSchedulingExam(exam)
        const dateObj = exam.date ? new Date(exam.date) : null
        setScheduleData({
            date: dateObj ? dateObj.toISOString().split('T')[0] : '',
            time: dateObj ? dateObj.toISOString().split('T')[1].substring(0, 5) : '',
            description: exam.description || ''
        })
        setShowScheduleModal(true)
    }

    const handleUpdateSchedule = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
            const combinedDate = scheduleData.date && scheduleData.time 
                ? new Date(`${scheduleData.date}T${scheduleData.time}:00Z`)
                : scheduleData.date ? new Date(scheduleData.date) : null
            
            await axios.patch(`${apiUrl}/api/exams/${schedulingExam.id}`, {
                date: combinedDate,
                description: scheduleData.description
            }, { headers: headers() })
            
            alert('Schedule updated successfully!')
            setShowScheduleModal(false)
            fetchAll()
        } catch (err) {
            alert(err.response?.data?.message || 'Error updating schedule')
        } finally {
            setSubmitting(false)
        }
    }


    const classSubjects = formData.classId 
        ? subjects.filter(sub => sub.Assignments && sub.Assignments.some(a => a.section?.classId === formData.classId))
        : [];

    return (
        <Layout title="Exam Management">
            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-section, .print-section * { visibility: visible; }
                    .print-section { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important; 
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    .no-print { display: none !important; }
                    .bg-slate-900 { background-color: #0f172a !important; color: white !important; -webkit-print-color-adjust: exact; }
                    .bg-indigo-600 { background-color: #4f46e5 !important; -webkit-print-color-adjust: exact; }
                    .bg-emerald-500 { background-color: #10b981 !important; -webkit-print-color-adjust: exact; }
                }
            `}</style>

            <div className="flex justify-between items-center mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <button 
                            onClick={() => window.location.href = '/admin/exams'}
                            className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 font-bold text-xs uppercase tracking-widest"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            Hub
                        </button>
                        <span className="text-slate-300">/</span>
                        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Exams</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800">Maamulka Imtixaanada</h2>
                    <p className="text-gray-400 text-sm">Create and manage exams</p>
                </div>
                {(userRole === 'admin' || userRole === 'owner' || (userRole === 'teacher' && canManageExams)) && (
                    <button onClick={() => setShowModal(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-orange-100 transition-all">Create Exam</button>
                )}
            </div>

            {/* Category Tabs */}
            <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] w-full md:w-fit mb-8 border border-slate-200/50">
                <button
                    onClick={() => {
                        setActiveTab('academic');
                        const curYear = academicYears.find(y => y.isCurrent);
                        if (curYear && selectedYearId !== curYear.id) {
                            setSelectedYearId(curYear.id);
                            setSelectedTerm('');
                        }
                    }}
                    className={`flex-1 md:flex-none px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${activeTab === 'academic' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100 border border-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Imtixaannada
                </button>
                <button
                    onClick={() => {
                        setActiveTab('others');
                        const curYear = academicYears.find(y => y.isCurrent);
                        if (curYear && selectedYearId !== curYear.id) {
                            setSelectedYearId(curYear.id);
                            setSelectedTerm('');
                        }
                    }}
                    className={`flex-1 md:flex-none px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${activeTab === 'others' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100 border border-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Kuwa Kale
                </button>
                {userRole !== 'teacher' && (
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 md:flex-none px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${activeTab === 'history' ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100 border border-indigo-50' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Taariikhda (History)
                    </button>
                )}
            </div>

            {/* Filters Row */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-10">
                <div className="flex flex-wrap gap-4 items-center">
                    {/* Academic Year Filter - Hidden for Teachers */}
                    {userRole !== 'teacher' && (
                        <div className={`flex items-center gap-4 bg-white p-2 rounded-2xl border ${activeTab === 'history' ? 'border-indigo-400 border-2 shadow-indigo-50' : 'border-slate-100 shadow-sm'} w-full md:w-fit transition-all`}>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Year:</span>
                            <select
                                value={selectedYearId}
                                onChange={(e) => { 
                                    const newYid = e.target.value;
                                    setSelectedYearId(newYid); 
                                    setSelectedTerm(''); 
                                    
                                    const isCurrent = academicYears.find(y => y.id === newYid)?.isCurrent;
                                    if (!isCurrent && newYid) setActiveTab('history');
                                    else if (isCurrent && activeTab === 'history') setActiveTab('academic');

                                    fetchAll('', newYid); 
                                }}
                                className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-indigo-600 outline-none cursor-pointer min-w-[180px]"
                            >
                                <option value="">{activeTab === 'history' ? 'Doorow Sannadkii Hore' : 'Dooro Sannad Dugsiyeedka'}</option>
                                {academicYears.map(y => (
                                    <option key={y.id} value={y.id} className={y.isCurrent ? "font-black text-indigo-600" : ""}>
                                        {y.name} {y.isCurrent ? '⭐ (Current Year)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Term Filter Dropdown */}
                    <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-full md:w-fit">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Term:</span>
                        <select
                            value={selectedTerm}
                            onChange={(e) => { setSelectedTerm(e.target.value); fetchAll(e.target.value, selectedYearId); }}
                            className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-indigo-600 outline-none cursor-pointer min-w-[220px]"
                        >
                            <option value="">Dhamaan Term-yada</option>
                            {academicYears
                                .filter(y => !selectedYearId || y.id === selectedYearId)
                                .map(year => (
                                <optgroup key={year.id} label={year.name + (year.isCurrent ? " (Current)" : "")}>
                                    {(year.Terms || []).map(term => (
                                        <option key={term.id} value={term.id}>
                                            {year.name} - {term.name}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    {/* Class Filter Dropdown */}
                    <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-full md:w-fit">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4">Class:</span>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-indigo-600 outline-none cursor-pointer min-w-[200px]"
                        >
                            <option value="">Dhamaan Fasallada</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.class_name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="space-y-12">
                {(() => {
                    // Grouping logic
                    const groups = {};
                    filteredExams.forEach(ex => {
                        const baseName = ex.name.includes(' - ') ? ex.name.split(' - ')[0] : ex.name;
                        if (!groups[baseName]) groups[baseName] = [];
                        groups[baseName].push(ex);
                    });

                    const groupNames = Object.keys(groups).sort((a, b) => {
                        // Sort groups by the latest created_at within them
                        const latestA = Math.max(...groups[a].map(e => new Date(e.created_at).getTime()));
                        const latestB = Math.max(...groups[b].map(e => new Date(e.created_at).getTime()));
                        return latestB - latestA;
                    });

                    if (loading) {
                        return (
                            <div className="bg-white rounded-[2rem] p-24 text-center border border-slate-100 shadow-sm flex flex-col items-center justify-center animate-pulse">
                                <svg className="animate-spin h-14 w-14 text-indigo-500 mb-6 drop-shadow-md" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <h3 className="text-slate-800 font-black uppercase tracking-[0.2em] text-lg">Searching...</h3>
                                <p className="text-slate-400 text-[11px] mt-3 font-bold uppercase tracking-widest">Fadlan sug inta xogta la soo baarayo</p>
                            </div>
                        )
                    }

                    if (groupNames.length === 0) {
                        return (
                            <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-gray-100">
                                <span className="text-4xl mb-4 block">{activeTab === 'history' ? '📂' : '📝'}</span>
                                <h3 className="text-gray-400 font-bold uppercase tracking-[0.2em] text-xs">
                                    {activeTab === 'history' ? 'No historical records found for this selection' : 'No exams found in this category'}
                                </h3>
                                <p className="text-gray-300 text-[10px] mt-2 italic">
                                    {activeTab === 'history' ? 'Please select a different academic year or grade' : 'Try creating a new exam batch using the button above'}
                                </p>
                            </div>
                        )
                    }

                    return groupNames.map((groupName, groupIdx) => {
                        const batch = groups[groupName];
                        const totalSubmitted = batch.reduce((acc, curr) => acc + (curr._count?.Results || 0), 0);
                        const isAllLocked = batch.every(ex => ex.status === 'locked');

                        // Group within batch by Class
                        const classGroups = {};
                        batch.forEach(ex => {
                            const cName = ex.section ? `${ex.class?.class_name || 'Generic'} - ${ex.section.name || 'General'}` : (ex.class?.class_name || 'Generic');
                            if (!classGroups[cName]) classGroups[cName] = [];
                            classGroups[cName].push(ex);
                        });

                        const totalMissing = batch.reduce((acc, curr) => acc + (curr.missingCount || 0), 0);

                        return (
                            <div key={groupIdx} className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden group/batch transition-all hover:shadow-indigo-100/50">
                                {/* Batch Header */}
                                <div className="bg-slate-900 p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className="bg-indigo-600/20 p-4 rounded-2xl border border-indigo-400/20 text-indigo-400">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-2xl font-black tracking-tight">{groupName}</h3>
                                                <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full font-black border border-indigo-500/20 uppercase tracking-widest">
                                                    {typeLabels[batch[0].type] || batch[0].type}
                                                </span>
                                                {isAllLocked && <span className="text-[10px] bg-red-500/20 text-red-400 px-3 py-1 rounded-full font-black border border-red-500/20 uppercase tracking-widest">Locked 🔒</span>}
                                            </div>
                                            <div className="flex items-center gap-4 mt-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> {batch.length} Subjects</span>
                                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> {totalSubmitted} Results</span>
                                                {totalMissing > 0 && (
                                                    <span className="flex items-center gap-1.5 text-red-400 animate-pulse">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                        {totalMissing} ARDAY DHIMAN (MISSING)
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span> {batch[0].date ? new Date(batch[0].date).toLocaleDateString() : 'No Date'}</span>
                                            </div>
                                        </div>
                                    </div>
                                        <div className="flex gap-3">
                                            {userRole === 'admin' && (
                                                <>
                                                    <button
                                                        disabled={submitting}
                                                        onClick={() => { 
                                                            const draftIds = batch.filter(ex => ex.status === 'draft').map(ex => ex.id);
                                                            if (draftIds.length === 0) return;
                                                            if (confirm(`Publish all ${draftIds.length} draft exams in this batch?`)) 
                                                                handleBulkStatusChange(draftIds, 'published');
                                                        }}
                                                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                                    >
                                                        {submitting ? 'Processing...' : 'Publish All Batch'}
                                                    </button>
                                                    {!isAllLocked && batch.some(ex => ex.status === 'published' || ex.status === 'draft') && (
                                                        <button
                                                            disabled={submitting}
                                                            onClick={() => { 
                                                                const lockableIds = batch.filter(ex => ex.status === 'published' || ex.status === 'draft').map(ex => ex.id);
                                                                if (lockableIds.length === 0) return;
                                                                if (confirm(`Lock all ${lockableIds.length} exams in this batch?`)) 
                                                                    handleBulkStatusChange(lockableIds, 'locked');
                                                            }}
                                                            className="bg-white/10 hover:bg-white text-white hover:text-slate-900 border border-white/20 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                                                        >
                                                            {submitting ? 'Processing...' : 'Lock All Batch'}
                                                        </button>
                                                    )}
                                                    {batch.some(ex => ex.status === 'locked') && (
                                                        <button
                                                            disabled={submitting}
                                                            onClick={() => { 
                                                                const lockedIds = batch.filter(ex => ex.status === 'locked').map(ex => ex.id);
                                                                if (lockedIds.length === 0) return;
                                                                if (confirm(`Ka fur (Unlock) dhamaan ${lockedIds.length} exam ee xiran?`)) 
                                                                    handleBulkStatusChange(lockedIds, 'published');
                                                            }}
                                                            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                                                        >
                                                            {submitting ? 'Processing...' : 'Unlock All Batch'}
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        {userRole === 'admin' && (
                                            <button
                                                onClick={() => { if (confirm(`Delete an entire batch?`)) Promise.all(batch.map(ex => axios.delete(`${apiUrl}/api/exams/${ex.id}`, { headers: headers() }))).then(fetchAll) }}
                                                className="bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/10 px-4 py-3 rounded-xl transition-all"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Subjects List Grouped by Class */}
                                <div className="p-8 bg-slate-50/50 space-y-10">
                                    {Object.keys(classGroups).sort().map(className => (
                                        <div key={className} className="space-y-4">
                                            <div className="flex items-center gap-4">
                                                <h4 className="bg-indigo-600 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-100">{className}</h4>
                                                <div className="h-px bg-slate-200 flex-1"></div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {classGroups[className].map((ex) => {
                                                    const sc = statusConfig[ex.status] || statusConfig.draft;
                                                    return (
                                                        <div key={ex.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md group/card">
                                                            <div className="flex justify-between items-start mb-4">
                                                                <div>
                                                                    <div className="text-sm font-black text-slate-800 uppercase tracking-tight">{ex.subject?.name}</div>
                                                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Assessment: {typeLabels[ex.type] || ex.type}</div>
                                                                </div>
                                                                <span className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase ${sc.classes} shadow-sm border border-black/5`}>{sc.label}</span>
                                                            </div>

                                                            <div className="mt-8 flex flex-col gap-3">
                                                                <button
                                                                    onClick={() => handleViewResults(ex)}
                                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 group/btn border border-indigo-400/20 active:scale-95"
                                                                >
                                                                    <svg className="w-5 h-5 transition-transform group-hover/btn:scale-125" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                                                    <span>EEG NATIIJADA (View Sheet)</span>
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <div className="bg-white/20 px-2 py-0.5 rounded-lg text-[8px]">{ex._count?.Results || 0} Records</div>
                                                                        {ex.missingCount > 0 && (
                                                                            <div className="bg-red-500 text-white px-2 py-0.5 rounded-lg text-[7px] font-black animate-pulse whitespace-nowrap">
                                                                                ⚠️ {ex.missingCount} ARDAY DHIMAN
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </button>

                                                                <div className="flex gap-2">
                                                                                <button
                                                                                    disabled={loadingExamId === ex.id}
                                                                                    onClick={() => openGrading(ex)}
                                                                                    className="flex-1 bg-white hover:bg-slate-50 text-slate-900 px-6 py-3 rounded-l-2xl font-black text-[9px] uppercase tracking-widest transition-all border-2 border-r-0 border-slate-100 flex items-center justify-center gap-2 shadow-sm hover:border-indigo-100 active:scale-95 disabled:opacity-50"
                                                                                >
                                                                                    {loadingExamId === ex.id ? (
                                                                                        <svg className="animate-spin w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24">
                                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z"></path>
                                                                                        </svg>
                                                                                    ) : (
                                                                                        <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                                                    )}
                                                                                    <span>{loadingExamId === ex.id ? 'Loading...' : 'GELI MARKS'}</span>
                                                                                </button>
                                                                                
                                                                                <div className="flex gap-2">
                                                                                    <button
                                                                                        disabled={loadingExamId === ex.id}
                                                                                        onClick={() => handleDownloadExcel(ex)}
                                                                                        title="Download Excel Template"
                                                                                        className="flex-1 bg-emerald-50 hover:bg-emerald-500 text-emerald-700 hover:text-white border border-emerald-200 px-3 py-2.5 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                                                                    >
                                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                                                        <span>Excel Daji</span>
                                                                                    </button>
                                                                                    <button
                                                                                        disabled={loadingExamId === ex.id}
                                                                                        onClick={() => handleUploadExcel(ex)}
                                                                                        title="Upload Excel Marks"
                                                                                        className="flex-1 bg-indigo-50 hover:bg-indigo-500 text-indigo-700 hover:text-white border border-indigo-200 px-3 py-2.5 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                                                                                    >
                                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                                                        <span>Excel Geli</span>
                                                                                    </button>
                                                                                </div>
                                                                                {(ex.status === 'draft' || userRole === 'admin' || userRole === 'owner') && (
                                                                                    <>
                                                                                        {userRole === 'admin' && ex.status === 'draft' && (
                                                                                            <button
                                                                                                onClick={() => { if (confirm('Ma hubaal inaad rabto inaad daabacdo imtixaankan?')) handleStatusChange(ex.id, 'published') }}
                                                                                                className="bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white px-4 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all border border-emerald-100 active:scale-95"
                                                                                            >
                                                                                                Publish
                                                                                            </button>
                                                                                        )}
                                                                                        {(userRole === 'admin' || userRole === 'owner') && (ex.status === 'published' || ex.status === 'draft') && (
                                                                                            <button
                                                                                                onClick={() => { if (confirm('Ma hubaal inaad rabto inaad xirto (Lock) imtixaankan?')) handleStatusChange(ex.id, 'locked') }}
                                                                                                className="bg-slate-50 hover:bg-slate-900 text-slate-600 hover:text-white px-4 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all border border-slate-100 active:scale-95 flex items-center gap-1.5"
                                                                                            >
                                                                                                <span>Lock</span>
                                                                                                <span>🔒</span>
                                                                                            </button>
                                                                                        )}
                                                                                        {(userRole === 'admin' || userRole === 'owner') && ex.status === 'locked' && (
                                                                                            <button
                                                                                                onClick={() => { if (confirm('Ma hubaal inaad rabto inaad ka furto (Unlock) imtixaankan?')) handleStatusChange(ex.id, 'published') }}
                                                                                                className="bg-amber-50 hover:bg-amber-500 text-amber-600 hover:text-white px-4 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all border border-amber-100 active:scale-95 flex items-center gap-1.5"
                                                                                            >
                                                                                                <span>Unlock</span>
                                                                                                <span>🔓</span>
                                                                                            </button>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            {userRole === 'admin' && (
                                                                                <button
                                                                                    onClick={() => { if (confirm('Kala saar imtixaankan?')) axios.delete(`${apiUrl}/api/exams/${ex.id}`, { headers: headers() }).then(fetchAll) }}
                                                                                    className="bg-red-50 hover:bg-red-500 text-red-500 hover:text-white p-3.5 rounded-2xl transition-all border border-red-100 active:scale-95"
                                                                                >
                                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                                </button>
                                                                            )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    });
                })()}
            </div>

            {/* Results Modal - REDESIGNED */}
            {
                showResultsModal && currentExam && (() => {
                    const totalStudents = selectedExamResults.length;
                    const avgMarks = totalStudents > 0
                        ? (selectedExamResults.reduce((sum, r) => sum + (r.marks || 0), 0) / totalStudents).toFixed(1)
                        : 0;
                    const passCount = selectedExamResults.filter(r => (r.marks || 0) >= (currentExam.totalMarks * 0.5)).length;
                    const passPercentage = totalStudents > 0 ? Math.round((passCount / totalStudents) * 100) : 0;

                    return (
                        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
                            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-7xl lg:w-[90vw] overflow-hidden max-h-[95vh] flex flex-col border border-white/20 animate-in slide-in-from-bottom-8 duration-500 print-section shadow-indigo-900/20">
                                {/* Modal Header */}
                                <div className="bg-slate-900 p-10 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                                        <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                    </div>
                                    <div className="relative z-10 flex justify-between items-start">
                                        <div className="flex gap-6 items-start">
                                            {schoolInfo?.logo && (
                                                <div className="bg-white p-2 rounded-2xl shadow-xl flex-shrink-0">
                                                    <img 
                                                        src={getImageUrl(schoolInfo.logo)} 
                                                        alt="Logo" 
                                                        className="w-20 h-20 object-contain"
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                        Assessment Sheet
                                                    </span>
                                                    <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-700">
                                                        {currentExam.type?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <h3 className="text-4xl font-black tracking-tight">{currentExam.name}</h3>
                                                <p className="text-indigo-400 text-sm font-bold uppercase tracking-widest mt-1">
                                                    {schoolInfo?.name || 'School Management System'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 no-print">
                                            <button
                                                onClick={exportToExcel}
                                                className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-sky-500/20 transition-all border border-sky-400/20"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                Excel
                                            </button>
                                            <button
                                                onClick={exportToWord}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 transition-all border border-blue-400/20"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                Word
                                            </button>
                                            <button
                                                onClick={() => window.print()}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all border border-indigo-400/20"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                                Print Sheet
                                            </button>
                                            <button
                                                onClick={() => setShowResultsModal(false)}
                                                className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 w-12 h-12 rounded-2xl flex items-center justify-center transition-all border border-white/5"
                                            >
                                                <span className="text-2xl">✕</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stats Bar */}
                                    <div className="grid grid-cols-3 gap-6 mt-10">
                                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                                            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Total Students</div>
                                            <div className="text-3xl font-black">{totalStudents}</div>
                                        </div>
                                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                                            <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Average Score</div>
                                            <div className="text-3xl font-black text-indigo-400">{avgMarks}<span className="text-sm font-bold text-slate-600 ml-1">/{currentExam.totalMarks}</span></div>
                                        </div>
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 backdrop-blur-sm">
                                            <div className="text-[10px] text-emerald-500/60 font-black uppercase tracking-widest mb-1">Pass Rate</div>
                                            <div className="text-3xl font-black text-emerald-400">{passPercentage}%</div>
                                        </div>
                                    </div>

                                    {/* Top Achievers Row */}
                                    {selectedExamResults.length > 0 && (
                                        <div className="mt-10 pt-10 border-t border-white/10 no-print">
                                            <div className="flex items-center gap-4 mb-6">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Guusha Ardayda (Top Achievers)</h4>
                                                <div className="h-px bg-white/5 flex-1"></div>
                                            </div>
                                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                                                {selectedExamResults.sort((a, b) => b.marks - a.marks).slice(0, 3).map((res, i) => (
                                                    <div key={res.id} className="flex-none bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 min-w-[240px]">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl border-2 ${i === 0 ? 'bg-amber-500 text-amber-950 border-amber-400' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-sm text-white truncate max-w-[140px] tracking-tight">{res.student?.user?.name}</div>
                                                            <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Dhibcaha: {res.marks}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {selectedExamResults.length > 0 && (
                                                    <div className="flex-none bg-indigo-600/20 border border-indigo-600/20 rounded-2xl p-4 flex items-center justify-center min-w-[200px] border-dashed">
                                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-center leading-normal">
                                                            MashaAllah, <br /> Hambalyo dhammaan!
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Content List */}
                                <div className="flex-1 overflow-y-auto p-4 sm:p-10 bg-slate-50/30">
                                    <div className="overflow-x-auto w-full">
                                        <div className="min-w-[800px] px-2 sm:px-0">
                                    {selectedExamResults.length > 0 ? (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-12 px-8 py-4 bg-slate-100/50 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-200/40">
                                                <div className="col-span-1">#</div>
                                                <div className="col-span-5">Student / Ardayga</div>
                                                <div className="col-span-3 text-center">Marks / Dhibcaha</div>
                                                <div className="col-span-3 text-right">Grade / Darajada</div>
                                            </div>

                                            {selectedExamResults.sort((a, b) => b.marks - a.marks).map((res, index) => {
                                                const percentage = (res.marks / currentExam.totalMarks) * 100;
                                                const isPass = percentage >= 50;

                                                // Dynamic Grade Logic
                                                let grade = 'F';
                                                let gradeColor = 'bg-red-500';
                                                if (percentage >= 90) { grade = 'A+'; gradeColor = 'bg-indigo-600'; }
                                                else if (percentage >= 80) { grade = 'A'; gradeColor = 'bg-indigo-500'; }
                                                else if (percentage >= 70) { grade = 'B'; gradeColor = 'bg-blue-500'; }
                                                else if (percentage >= 60) { grade = 'C'; gradeColor = 'bg-amber-500'; }
                                                else if (percentage >= 50) { grade = 'D'; gradeColor = 'bg-orange-500'; }

                                                return (
                                                    <div key={res.id} className="grid grid-cols-12 items-center px-8 py-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-indigo-100 hover:-translate-y-0.5 group">
                                                        <div className="col-span-1 text-xs font-black text-slate-300">{(index + 1).toString().padStart(2, '0')}</div>
                                                        <div className="col-span-5 flex items-center gap-4">
                                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-lg shadow-inner ${gradeColor} opacity-90`}>
                                                                {res.student?.user?.name?.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-800 text-lg tracking-tight group-hover:text-indigo-600 transition-colors">{res.student?.user?.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">{res.student?.student_id}</div>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-3">
                                                            <div className="flex flex-col items-center">
                                                                <div className="flex items-baseline gap-1">
                                                                    <span className={`text-2xl font-black ${isPass ? 'text-slate-800' : 'text-red-500'}`}>{res.marks}</span>
                                                                    <span className="text-xs font-bold text-slate-300">/ {currentExam.totalMarks}</span>
                                                                </div>
                                                                <div className="w-full max-w-[120px] h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                                                                    <div
                                                                        className={`h-full transition-all duration-1000 ${isPass ? 'bg-indigo-500' : 'bg-red-400'}`}
                                                                        style={{ width: `${percentage}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="col-span-3 flex justify-end items-center gap-4">
                                                            <div className="flex flex-col items-end">
                                                                <span className={`text-[9px] font-black uppercase tracking-widest ${isPass ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                    {isPass ? 'BAAS (Pass)' : 'DHACAY (Fail)'}
                                                                </span>
                                                                <span className="text-[8px] text-slate-300 font-bold italic uppercase">Darajada</span>
                                                            </div>
                                                            <div className={`${gradeColor} text-white px-8 py-3 rounded-2xl font-black text-xl shadow-xl ${isPass ? 'shadow-indigo-500/30' : 'shadow-red-500/20'} border-2 border-white/20 scale-110`}>
                                                                {grade}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                                            <div className="text-6xl mb-6 grayscale opacity-20">📊</div>
                                            <h3 className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No result data available</h3>
                                            <p className="text-slate-300 text-[10px] mt-2 italic font-medium">Please add marks to subjects in this batch first</p>
                                        </div>
                                    )}
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="p-8 bg-white border-t border-slate-50 flex justify-between items-center px-12">
                                    <div className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                                        End of Report • Generatd on {new Date().toLocaleDateString()}
                                    </div>
                                    <button
                                        onClick={() => setShowResultsModal(false)}
                                        className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-100/20"
                                    >
                                        Close Window
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }

            {/* Grading Modal */}
            {
                showGradingModal && currentExam && (
                    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-2xl flex items-center justify-center p-4 z-[110] animate-in fade-in duration-500">
                        <div className="bg-white rounded-[3.5rem] shadow-2xl w-full max-w-6xl overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-500 border border-white/20 shadow-indigo-900/20">
                            {/* Modal Header - Redesigned & Compact */}
                            <div className="bg-slate-950 p-4 sm:p-6 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none rotate-12">
                                    <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
                                </div>
                                <div className="relative z-10 flex justify-between items-center">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <span className="bg-indigo-600 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-[0.2em]">
                                                GRADING
                                            </span>
                                            <span className="text-slate-500 text-[8px] font-black uppercase tracking-[0.2em]">
                                                {currentExam.type?.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-none uppercase italic">
                                            {currentExam.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-4 pt-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{currentExam.subject?.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Class: {currentExam.class?.class_name}</span>
                                            </div>
                                            {(() => {
                                                const gradeClass = classes.find(c => c.id === currentExam.classId)
                                                const sections = gradeClass?.Sections || []
                                                if (sections.length === 0) return null
                                                return (
                                                    <div className="flex items-center gap-2 ml-2">
                                                        <select
                                                            className="bg-white/5 text-white text-[10px] font-bold px-3 py-1 rounded-xl border border-white/10 outline-none cursor-pointer"
                                                            value={gradingSectionId}
                                                            onChange={e => loadGradingForSection(e.target.value)}
                                                        >
                                                            <option value="">All Sections</option>
                                                            {sections.map(s => (
                                                                <option key={s.id} value={s.id} className="text-slate-800">
                                                                    {s.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setShowGradingModal(false)} 
                                        className="group text-slate-500 hover:text-white bg-white/5 hover:bg-red-500 w-10 sm:w-12 h-10 sm:h-12 rounded-2xl flex items-center justify-center transition-all border border-white/5"
                                    >
                                        <span className="text-xl font-light">✕</span>
                                    </button>
                                </div>
                            </div>


                            <div className="flex-1 overflow-y-auto p-4 sm:p-12 bg-slate-50/50">
                                <div className="max-w-5xl mx-auto space-y-8 overflow-x-auto w-full">
                                    <div className="min-w-[800px] px-2 sm:px-0">
                                    {/* Info Panel - Compact */}
                                    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-4 sm:p-6 rounded-[2rem] shadow-xl flex items-center justify-between mb-4 text-white relative overflow-hidden group">
                                        <div className="flex items-center gap-6 relative z-10">
                                            <div className="bg-white/10 p-3 rounded-2xl text-2xl">✍️</div>
                                            <div>
                                                <h3 className="text-lg font-black tracking-tight">Geli Dhibcaha Ardayda</h3>
                                                <p className="text-slate-400 text-[10px] font-medium uppercase tracking-widest mt-1">Hubi dhibco kasta ka hor intadan kaydin.</p>
                                            </div>
                                        </div>
                                        <div className="text-right p-4 bg-white/5 rounded-2xl border border-white/5">
                                            <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-1">Max Marks</p>
                                            <p className="text-2xl font-black">{currentExam.totalMarks}</p>
                                        </div>
                                    </div>


                                    {/* Table Header - Compact */}
                                    <div className="grid grid-cols-12 gap-4 px-8 mb-2 h-10 items-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] sticky top-0 bg-slate-50/95 backdrop-blur-md z-20 border-b border-slate-200/50">
                                        <div className="col-span-1">#</div>
                                        <div className="col-span-4">Student Identity</div>
                                        <div className="col-span-2 text-center">Status</div>
                                        <div className="col-span-2 text-center">Marks</div>
                                        <div className="col-span-3">Feedback</div>
                                    </div>


                                    {(() => {
                                        const groups = {};
                                        gradingSheet.forEach(s => {
                                            const name = s.sectionName || 'N/A';
                                            if (!groups[name]) groups[name] = [];
                                            groups[name].push(s);
                                        });

                                        return Object.entries(groups).map(([sectionName, students], groupIdx) => (
                                            <div key={sectionName} className="mb-16">
                                                <div className="flex items-center gap-6 py-4 px-10 bg-white rounded-[2rem] mb-6 border border-slate-100 shadow-sm">
                                                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.3em]">
                                                        SECTION {sectionName}
                                                    </h3>
                                                    <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{students.length} Arday</span>
                                                </div>

                                                <div className="space-y-4">
                                                    {students.map((student, studentIdx) => {
                                                        const originalIdx = gradingSheet.findIndex(s => s.studentId === student.studentId);
                                                        const isExceeded = Number(student.marks) > currentExam.totalMarks;
                                                        const isEntering = student.marks !== '';
                                                        
                                                        return (
                                                            <div key={student.studentId} className={`grid grid-cols-12 gap-4 px-8 py-3 items-center rounded-2xl transition-all duration-300 border ${isEntering ? 'bg-white border-indigo-100 shadow-lg' : 'bg-white/40 border-transparent hover:bg-white hover:border-slate-200 hover:shadow-md'} group`}>
                                                                <div className="col-span-1 text-xs font-black text-slate-300 group-hover:text-indigo-600">
                                                                    {(studentIdx + 1).toString().padStart(2, '0')}
                                                                </div>
                                                                <div className="col-span-4 flex items-center gap-4">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-all duration-500 ${isEntering ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'} uppercase`}>
                                                                        {student.studentName?.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-black text-slate-800 leading-none">{student.studentName}</div>
                                                                        <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">{student.studentRegId}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="col-span-2 flex justify-center">
                                                                    {isEntering ? (
                                                                        <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Entered</span>
                                                                    ) : (
                                                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-full border border-slate-100">Pending</span>
                                                                    )}
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <div className="relative group/input">
                                                                        <input
                                                                            type="number"
                                                                            step="0.5"
                                                                            max={currentExam.totalMarks}
                                                                            className={`w-full h-12 text-center font-black text-xl rounded-xl border-2 transition-all outline-none ${isExceeded ? 'border-red-500 bg-red-50 text-red-600' : isEntering ? 'border-indigo-600 bg-white text-indigo-600' : 'border-slate-100 focus:border-indigo-600 focus:bg-white bg-slate-50/50 text-slate-700'} ${currentExam.status === 'locked' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                                            value={student.marks}
                                                                            onChange={(e) => {
                                                                                if (currentExam.status === 'locked') return;
                                                                                const newSheet = [...gradingSheet];
                                                                                newSheet[originalIdx].marks = e.target.value;
                                                                                setGradingSheet(newSheet);
                                                                            }}
                                                                            readOnly={currentExam.status === 'locked'}
                                                                            placeholder="--"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="col-span-3">
                                                                    <textarea
                                                                        rows="1"
                                                                        className={`w-full py-3 px-4 rounded-xl border-2 transition-all outline-none text-[11px] font-bold text-slate-600 bg-slate-50/50 focus:bg-white focus:border-indigo-600 placeholder:text-slate-300 resize-none ${currentExam.status === 'locked' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                                                        value={student.remarks}
                                                                        onChange={(e) => {
                                                                            if (currentExam.status === 'locked') return;
                                                                            const newSheet = [...gradingSheet];
                                                                            newSheet[originalIdx].remarks = e.target.value;
                                                                            setGradingSheet(newSheet);
                                                                        }}
                                                                        readOnly={currentExam.status === 'locked'}
                                                                        placeholder="Faallo..."
                                                                    />
                                                                </div>
                                                            </div>

                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                    {gradingSheet.length === 0 && (
                                        <div className="text-center py-40 bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
                                            <div className="text-slate-200 text-9xl mb-8 opacity-20">📭</div>
                                            <h3 className="text-slate-400 font-black uppercase tracking-[0.4em] text-sm">No active students found</h3>
                                            <p className="text-slate-300 text-xs font-bold mt-4 uppercase tracking-widest">Please check class assignments</p>
                                        </div>
                                    )}
                                        </div>
                                    </div>
                                </div>

                            {/* Modal Footer - Compact */}
                            <div className="p-4 sm:p-6 border-t border-slate-100 bg-white flex justify-between items-center">
                                <div className="flex-1"></div>
                                <div className="flex gap-3 w-full sm:w-auto">
                                    <button 
                                        onClick={() => setShowGradingModal(false)} 
                                        className="flex-1 sm:flex-none px-8 py-4 rounded-xl border-2 border-slate-100 font-black text-slate-400 hover:bg-slate-50 transition-all uppercase text-[10px] tracking-widest"
                                    >
                                        Ka noqo
                                    </button>
                                    {(userRole === 'admin' || userRole === 'owner' || userRole === 'teacher') && currentExam.status !== 'locked' && (
                                        <button
                                            onClick={submitGrades}
                                            disabled={saving}
                                            className={`flex-1 sm:flex-none px-12 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all duration-500 flex items-center justify-center gap-3 ${saving ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                        >
                                            {saving ? '...' : 'KAYDI'}
                                        </button>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                )
            }

            {
                showModal && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-500 max-h-[90vh] flex flex-col">
                            <div className="bg-slate-900 p-6 text-white flex justify-between shrink-0">
                                <h3 className="text-xl font-bold">Abuur Imtixaan</h3>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-8 space-y-4 overflow-y-auto flex-1">
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Magaca Imtixaanka</label><input required className="w-full p-3 rounded-xl border font-bold" placeholder="e.g. Bile 1" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                                <div className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-4 py-3 rounded-xl uppercase tracking-widest leading-relaxed">
                                    ℹ️ Fasal kasta oo aad doorato, dhammaan maaddooyinka uu dhigto ayaa imtixaan loo wada abuuri doonaa hal mar.
                                </div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Fasalka (Class)</label><select required className="w-full p-3 rounded-xl border appearance-none bg-white font-bold text-indigo-600 outline-none" value={formData.classId} onChange={e => setFormData({ ...formData, classId: e.target.value, sectionId: '' })}><option value="">Select Class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}</select></div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Xilliga (Term/Year)</label>
                                    <select required className="w-full p-3 rounded-xl border appearance-none bg-white font-bold text-slate-700 outline-none" value={formData.termId} onChange={e => setFormData({ ...formData, termId: e.target.value })}>
                                        <option value="">Select Term</option>
                                        {academicYears.filter(year => year.isCurrent).flatMap(year => (year.Terms || []).map(term => (
                                            <option key={term.id} value={term.id}>{year.name} - {term.name}</option>
                                        )))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Category</label>
                                    <select required className="w-full p-3 rounded-xl border appearance-none bg-white font-bold text-slate-700 outline-none" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                        <option value="">-- Dooro Nooca (Select Category) --</option>
                                        <option value="monthly_1">Bile 1</option>
                                        <option value="midterm">Nus-sannad</option>
                                        <option value="monthly_2">Bile 2</option>
                                        <option value="final">Final Exam</option>
                                    </select>
                                </div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Taariikhda (Date)</label><input type="date" required className="w-full p-3 rounded-xl border font-bold text-slate-700" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></div>
                                
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Habka Dhibcaha (Marks Mode)</label>
                                    <select className="w-full p-3 rounded-xl border appearance-none bg-white font-bold text-slate-700 outline-none" value={marksMode} onChange={e => setMarksMode(e.target.value)}>
                                        <option value="single">Hal Mar Wadar Ah (Single Total)</option>
                                        <option value="per_subject">Maado Kasta Goonideeda (Per Subject)</option>
                                    </select>
                                </div>
                                
                                {marksMode === 'single' ? (
                                    <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Total Marks</label><input type="number" className="w-full p-3 rounded-xl border font-bold text-slate-700" value={formData.totalMarks} onChange={e => setFormData({ ...formData, totalMarks: e.target.value })} /></div>
                                ) : (
                                    <div className="space-y-2 border p-4 rounded-xl bg-slate-50 max-h-60 overflow-y-auto">
                                        <label className="text-xs font-bold text-indigo-600 uppercase mb-2 block">Dhibcaha Maadooyinka</label>
                                        {classSubjects.length === 0 ? (
                                            <p className="text-xs text-slate-400 font-bold">Fadlan dooro fasal leh maadooyin.</p>
                                        ) : (
                                            classSubjects.map(sub => (
                                                <div key={sub.id} className="flex justify-between items-center gap-4">
                                                    <span className="text-sm font-bold text-slate-700">{sub.name}</span>
                                                    <input 
                                                        type="number" 
                                                        className="w-24 p-2 rounded-lg border font-bold text-slate-700 text-center" 
                                                        placeholder="100"
                                                        value={subjectMarks[sub.id] || ''} 
                                                        onChange={e => setSubjectMarks({ ...subjectMarks, [sub.id]: e.target.value })} 
                                                        required
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                                
                                <div className="pt-4 flex gap-3">
                                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-100 text-slate-500 font-bold py-3 rounded-xl transition-all">Cancel</button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50"
                                    >
                                        {submitting ? 'Creating...' : 'ABUUR (Bulk Create)'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Schedule Management Modal */}
            {showScheduleModal && schedulingExam && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl flex items-center justify-center p-4 z-[120]">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/20 animate-in zoom-in duration-300">
                        <div className="bg-slate-900 p-8 text-white">
                            <h3 className="text-2xl font-black">Xogta Imtixaanka</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{schedulingExam.subject?.name} - {schedulingExam.class?.class_name}</p>
                        </div>
                        <form onSubmit={handleUpdateSchedule} className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Maalinta (Date)</label>
                                <input 
                                    type="date"
                                    value={scheduleData.date}
                                    onChange={e => setScheduleData({...scheduleData, date: e.target.value})}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Saacadda (Time)</label>
                                <input 
                                    type="time"
                                    value={scheduleData.time}
                                    onChange={e => setScheduleData({...scheduleData, time: e.target.value})}
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Fasalka/Room & Notes</label>
                                <textarea 
                                    value={scheduleData.description}
                                    onChange={e => setScheduleData({...scheduleData, description: e.target.value})}
                                    placeholder="Tusaale: Room 4, Keen qalin buluug ah..."
                                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:border-indigo-500 outline-none transition-all h-32"
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setShowScheduleModal(false)} className="flex-1 bg-slate-100 text-slate-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                                <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
                                    {submitting ? 'Kaydinaya...' : 'Kaydi Jadwalka'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout >
    )
}

