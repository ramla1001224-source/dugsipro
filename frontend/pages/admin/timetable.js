import Layout from '../../components/Layout'
import { useEffect, useState, useRef } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'

const DEFAULT_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']

// ─── helpers ──────────────────────────────────────────────────────────────────
function parseTimeCell(val) {
    if (!val) return ''
    const s = String(val).trim()
    // Excel serial time (fraction of a day)
    if (!isNaN(Number(s)) && Number(s) < 1 && Number(s) > 0) {
        const totalMins = Math.round(Number(s) * 24 * 60)
        const h = Math.floor(totalMins / 60)
        const m = totalMins % 60
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
    // HH:MM or H:MM
    const match = s.match(/^(\d{1,2}):(\d{2})/)
    if (match) return `${String(Number(match[1])).padStart(2, '0')}:${match[2]}`
    return s
}

function parseSheetRows(ws, sheetDay) {
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    let headerIdx = -1
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i].map(c => String(c).trim().toLowerCase())
        if (r.includes('subject') && (r.includes('start') || r.includes('time'))) {
            headerIdx = i; break
        }
    }
    if (headerIdx === -1) return []

    const hdrs = rows[headerIdx].map(c => String(c).trim().toLowerCase())
    const idx = {
        subject: hdrs.findIndex(h => h === 'subject'),
        teacher: hdrs.findIndex(h => h === 'teacher'),
        room: hdrs.findIndex(h => h.includes('room')),
        start: hdrs.findIndex(h => h === 'start' || h === 'start time'),
        end: hdrs.findIndex(h => h === 'end' || h === 'end time'),
        day: hdrs.findIndex(h => h === 'day'),
        time: hdrs.findIndex(h => h === 'time'),
    }

    const parsed = []
    for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i]
        const subject = idx.subject >= 0 ? String(row[idx.subject] || '').trim() : ''
        if (!subject || subject === '—' || subject.toLowerCase().includes('no class') || subject.toLowerCase().includes('fasallo')) continue

        let startTime = '', endTime = ''
        if (idx.time >= 0 && row[idx.time]) {
            const parts = String(row[idx.time]).split('-').map(s => s.trim())
            startTime = parseTimeCell(parts[0])
            endTime = parseTimeCell(parts[1])
        } else {
            startTime = idx.start >= 0 ? parseTimeCell(row[idx.start]) : ''
            endTime = idx.end >= 0 ? parseTimeCell(row[idx.end]) : ''
        }
        if (!startTime || !endTime) continue

        let day = idx.day >= 0 ? String(row[idx.day] || '').trim() : (sheetDay || '')
        if (!day) continue
        const validDay = DEFAULT_DAYS.find(d => d.toLowerCase() === day.toLowerCase()) || day

        const teacher = idx.teacher >= 0 ? String(row[idx.teacher] || '').trim() : ''
        const room = idx.room >= 0 ? String(row[idx.room] || '').trim() : ''
        parsed.push({ day: validDay, subject, teacher, room: room === 'No room' ? '' : room, startTime, endTime })
    }
    return parsed
}

// ─── parse sheet name → { className, sectionName } ───────────────────────────
// Sheet names we generate: "Kowaad-A-Subax" or "Kowaad - A (Morning)" or just "Saturday" etc.
function parseSheetMeta(sheetName) {
    // If it matches a day name, it's a per-day sheet — skip
    if (DEFAULT_DAYS.some(d => sheetName.toLowerCase().startsWith(d.toLowerCase()))) return null
    if (sheetName.toLowerCase() === 'summary' || sheetName.toLowerCase() === 'template') return null

    // Try "ClassName-SectionName-Shift" or "ClassName - SectionName"
    const parts = sheetName.split(/[-–—]/).map(p => p.trim()).filter(Boolean)
    if (parts.length >= 2) {
        return { className: parts[0], sectionName: parts[1] }
    }
    return { className: sheetName, sectionName: '' }
}

export default function AdminTimetable() {
    const [entries, setEntries] = useState([])
    const [classes, setClasses] = useState([])
    const [subjects, setSubjects] = useState([])
    const [teachers, setTeachers] = useState([])
    const [settings, setSettings] = useState({})
    const [selectedClass, setSelectedClass] = useState('')
    const [sections, setSections] = useState([])
    const [selectedSectionId, setSelectedSectionId] = useState('')
    const [activeSectionId, setActiveSectionId] = useState('')
    const [shift, setShift] = useState('morning')
    const [showModal, setShowModal] = useState(false)
    const [showDownloadPanel, setShowDownloadPanel] = useState(false)
    const [showImportPanel, setShowImportPanel] = useState(false)
    const [selectedDays, setSelectedDays] = useState([...DEFAULT_DAYS])
    const [formData, setFormData] = useState({ sectionId: '', subjectId: '', teacherId: '', day: '', startTime: '', endTime: '', room: '', shift: 'morning' })

    // ── Import state ──
    const [importMode, setImportMode] = useState('single')   // 'single' | 'multi'
    const [importClass, setImportClass] = useState('')
    const [importSection, setImportSection] = useState('')
    const [importSections, setImportSections] = useState([])
    const [importShift, setImportShift] = useState('morning')
    const [importRows, setImportRows] = useState([])           // single-mode rows
    const [importMulti, setImportMulti] = useState([])         // multi-mode: [{ className, sectionName, matchedSectionId, shift, rows, resolved }]
    const [importFileName, setImportFileName] = useState('')
    const [importStep, setImportStep] = useState(1)            // 1=pick mode/class, 2=upload, 3=preview
    const [importLoading, setImportLoading] = useState(false)
    const [importError, setImportError] = useState('')
    const [clearFirst, setClearFirst] = useState(false)
    const fileInputRef = useRef(null)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })
    const getSchoolId = () => { try { return JSON.parse(localStorage.getItem('schoolInfo') || '{}').id || '' } catch { return '' } }

    const DAYS = settings.timetable_days ? JSON.parse(settings.timetable_days) : DEFAULT_DAYS

    // ── Load initial data ──────────────────────────────────────────────────────
    useEffect(() => {
        const schoolId = getSchoolId()
        const qs = schoolId ? `?schoolId=${schoolId}` : ''
        Promise.all([
            axios.get(`${apiUrl}/api/classes${qs}`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/subjects${qs}`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/teachers${qs}`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/settings`, { headers: headers() }).catch(() => ({ data: {} }))
        ]).then(([c, s, t, set]) => {
            const sorted = (c.data || []).sort((a, b) => {
                const numA = parseInt(a.class_name?.replace(/\D/g, '')) || 0
                const numB = parseInt(b.class_name?.replace(/\D/g, '')) || 0
                return numA - numB
            })
            setClasses(sorted)
            setSubjects(s.data)
            setTeachers(t.data)
            setSettings(set.data)
            if (sorted.length > 0) {
                const firstClass = sorted[0]
                setSelectedClass(firstClass.id)
                if (firstClass.Sections?.length > 0) {
                    setSections(firstClass.Sections)
                    setSelectedSectionId(firstClass.Sections[0].id)
                    setActiveSectionId(firstClass.Sections[0].id)
                    setShift(firstClass.Sections[0].shift || 'morning')
                }
            }
        })
    }, [])

    useEffect(() => {
        const days = settings.timetable_days ? JSON.parse(settings.timetable_days) : DEFAULT_DAYS
        setSelectedDays([...days])
    }, [settings.timetable_days])

    useEffect(() => {
        const cls = classes.find(c => c.id === selectedClass)
        if (cls) {
            setSections(cls.Sections || [])
            if (cls.Sections?.length > 0) setSelectedSectionId(cls.Sections[0].id)
            else setSelectedSectionId('')
        }
    }, [selectedClass])

    useEffect(() => {
        if (!activeSectionId) return
        const schoolId = getSchoolId()
        const schoolParam = schoolId ? `&schoolId=${schoolId}` : ''
        axios.get(`${apiUrl}/api/timetable?sectionId=${activeSectionId}&shift=${shift}${schoolParam}`, { headers: headers() })
            .then(r => setEntries(r.data)).catch(console.error)
    }, [activeSectionId, shift])

    useEffect(() => {
        const cls = classes.find(c => c.id === importClass)
        if (cls) {
            setImportSections(cls.Sections || [])
            setImportSection(cls.Sections?.[0]?.id || '')
        } else {
            setImportSections([])
            setImportSection('')
        }
    }, [importClass])

    // ── Add Period ─────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await axios.post(`${apiUrl}/api/timetable`, { ...formData, sectionId: activeSectionId || formData.sectionId, shift: shift || formData.shift }, { headers: headers() })
            setShowModal(false)
            if (activeSectionId) axios.get(`${apiUrl}/api/timetable?sectionId=${activeSectionId}&shift=${shift}`, { headers: headers() }).then(r => setEntries(r.data))
        } catch (e) { alert(e.response?.data?.message || 'Error') }
    }

    const openModal = () => {
        const workingDays = settings.timetable_days ? JSON.parse(settings.timetable_days) : DEFAULT_DAYS
        const defaultDay = workingDays[0] || 'Monday'
        const dayEntries = entries.filter(e => e.day === defaultDay).sort((a, b) => a.startTime.localeCompare(b.startTime))
        let suggestStart = settings.timetable_start || '08:00'
        if (dayEntries.length > 0) {
            suggestStart = dayEntries[dayEntries.length - 1].endTime
            if (dayEntries.length === parseInt(settings.timetable_break_after || '3')) {
                const [h, m] = suggestStart.split(':').map(Number)
                const d = new Date(); d.setHours(h, m + parseInt(settings.timetable_break_duration || '30'))
                suggestStart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            }
        }
        const [h, m] = suggestStart.split(':').map(Number)
        const ed = new Date(); ed.setHours(h, m + parseInt(settings.timetable_duration || '45'))
        const suggestEnd = `${String(ed.getHours()).padStart(2, '0')}:${String(ed.getMinutes()).padStart(2, '0')}`
        setFormData({ sectionId: activeSectionId || selectedSectionId, subjectId: '', teacherId: '', day: defaultDay, startTime: suggestStart, endTime: suggestEnd, room: '', shift: shift || 'morning' })
        setShowModal(true)
    }

    const grouped = DAYS.reduce((acc, day) => { acc[day] = entries.filter(e => e.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)); return acc }, {})
    const activeSection = sections.find(s => s.id === activeSectionId) || (classes.find(c => c.id === selectedClass)?.Sections?.find(s => s.id === activeSectionId))
    const classInfo = classes.find(c => c.id === selectedClass)

    const getFilteredSubjects = () => {
        if (!formData.teacherId) return subjects
        const teacher = teachers.find(t => t.id === formData.teacherId)
        if (!teacher || !teacher.SubjectAssignments || teacher.SubjectAssignments.length === 0) return subjects
        const sectionAssignments = teacher.SubjectAssignments.filter(a => a.sectionId === activeSectionId)
        if (sectionAssignments.length === 0) return []
        const assignedSubjectIds = sectionAssignments.map(a => a.subjectId)
        return subjects.filter(s => assignedSubjectIds.includes(s.id))
    }
    const displaySubjects = getFilteredSubjects()

    const handleTeacherChange = (teacherId) => {
        const teacher = teachers.find(t => t.id === teacherId)
        let nextSubjectId = formData.subjectId
        if (teacher && teacher.SubjectAssignments) {
            const sectionAssignments = teacher.SubjectAssignments.filter(a => a.sectionId === activeSectionId)
            if (sectionAssignments.length === 1) nextSubjectId = sectionAssignments[0].subjectId
            else if (sectionAssignments.length > 1 && !sectionAssignments.some(a => a.subjectId === formData.subjectId)) nextSubjectId = ''
        }
        setFormData({ ...formData, teacherId, subjectId: nextSubjectId })
    }

    // ── Day Selection ──────────────────────────────────────────────────────────
    const toggleDay = (day) => setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
    const selectAllDays = () => setSelectedDays([...DAYS])
    const clearAllDays = () => setSelectedDays([])

    // ── Excel Download ─────────────────────────────────────────────────────────
    const downloadExcel = () => {
        if (selectedDays.length === 0) { alert('Fadlan dooro ugu yaraan maalin hal ah!'); return }
        const shiftLabel = shift === 'morning' ? 'Subax (Morning)' : shift === 'afternoon' ? 'Galab (Afternoon)' : 'Habeen (Night)'
        const className = classInfo?.class_name || 'Class'
        const sectionName = activeSection?.name || 'Section'
        const orderedSelected = DAYS.filter(d => selectedDays.includes(d))
        const today = new Date().toLocaleDateString('en-GB')
        const wb = XLSX.utils.book_new()

        // Sheet 1: Summary
        const wsData = []
        wsData.push([`WEEKLY TIMETABLE`])
        wsData.push([`Class: ${className}   |   Section: ${sectionName}   |   Shift: ${shiftLabel}`])
        wsData.push([`Date: ${today}   |   Days: ${orderedSelected.join(', ')}`])
        wsData.push([])
        wsData.push(['#', 'Day', 'Time', 'Subject', 'Teacher', 'Room'])
        let rowNum = 1
        orderedSelected.forEach(day => {
            const dayEntries = grouped[day] || []
            if (dayEntries.length === 0) {
                wsData.push([rowNum++, day, '—', 'No classes scheduled', '—', '—'])
            } else {
                dayEntries.forEach((e, idx) => {
                    wsData.push([rowNum++, idx === 0 ? day : '', `${e.startTime} - ${e.endTime}`, e.subject?.name || '—', e.teacher?.user?.name || '—', e.room || 'No room'])
                })
            }
            wsData.push([])
        })
        const ws = XLSX.utils.aoa_to_sheet(wsData)
        ws['!cols'] = [{ wch: 4 }, { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 14 }]
        ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }]
        XLSX.utils.book_append_sheet(wb, ws, 'Summary')

        // Per-day sheets
        orderedSelected.forEach(day => {
            const dayEntries = grouped[day] || []
            const dayData = []
            dayData.push([`${day.toUpperCase()} — ${className} ${sectionName} (${shiftLabel})`])
            dayData.push([])
            dayData.push(['#', 'Start', 'End', 'Duration', 'Subject', 'Teacher', 'Room'])
            dayEntries.forEach((e, i) => {
                const [sh, sm] = e.startTime.split(':').map(Number)
                const [eh, em] = e.endTime.split(':').map(Number)
                const dur = (eh * 60 + em) - (sh * 60 + sm)
                dayData.push([i + 1, e.startTime, e.endTime, `${dur} daqiiqo`, e.subject?.name || '—', e.teacher?.user?.name || '—', e.room || 'No room'])
            })
            if (dayEntries.length === 0) dayData.push(['', '', '', '', 'Fasallo ma jiraan', '', ''])
            const dayWs = XLSX.utils.aoa_to_sheet(dayData)
            dayWs['!cols'] = [{ wch: 4 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 24 }, { wch: 22 }, { wch: 14 }]
            dayWs['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]
            XLSX.utils.book_append_sheet(wb, dayWs, day.substring(0, 31))
        })

        const fileName = `Jadwalka_${className}_${sectionName}_${shiftLabel.split(' ')[0]}_${new Date().toISOString().slice(0, 10)}.xlsx`
        XLSX.writeFile(wb, fileName)
        setShowDownloadPanel(false)
    }

    // ── Download Multi-Class Template ──────────────────────────────────────────
    const downloadTemplate = (mode) => {
        const wb = XLSX.utils.book_new()
        if (mode === 'multi') {
            // One sheet per class-section
            const allSections = []
            classes.forEach(cls => {
                (cls.Sections || []).forEach(sec => {
                    allSections.push({ className: cls.class_name, sectionName: sec.name || 'General', sectionId: sec.id })
                })
            })
            if (allSections.length === 0) {
                allSections.push({ className: 'Kowaad', sectionName: 'A', sectionId: '' })
            }
            allSections.forEach(({ className, sectionName }) => {
                const sheetData = [
                    [`JADWALKA — ${className} ${sectionName}`],
                    [],
                    ['Day', 'Start', 'End', 'Subject', 'Teacher', 'Room'],
                    ['Saturday', '07:30', '08:10', 'Mathematics', 'Axmed Cali', 'Room 1'],
                    ['Saturday', '08:10', '08:50', 'English', 'Faadumo Hassan', 'Room 1'],
                    ['Sunday', '07:30', '08:10', 'Arabic', 'Maxamed Nuur', 'Room 2'],
                    ['Sunday', '08:10', '08:50', 'Somali', 'Caasha Diiriye', 'Room 2'],
                ]
                const ws = XLSX.utils.aoa_to_sheet(sheetData)
                ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 12 }]
                ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]
                const sheetName = `${className}-${sectionName}`.substring(0, 31)
                XLSX.utils.book_append_sheet(wb, ws, sheetName)
            })
            XLSX.writeFile(wb, 'Timetable_Multi_Class_Template.xlsx')
        } else {
            const templateData = [
                ['TIMETABLE TEMPLATE — Buuxi sadar kasta oo ku dar fasallada'],
                [],
                ['Day', 'Start', 'End', 'Subject', 'Teacher', 'Room'],
                ['Saturday', '07:30', '08:10', 'Mathematics', 'Axmed Cali', 'Room 1'],
                ['Saturday', '08:10', '08:50', 'English', 'Faadumo Hassan', 'Room 1'],
                ['Saturday', '08:50', '09:30', 'Science', 'Cabdi Warsame', 'Room 1'],
                ['Sunday', '07:30', '08:10', 'Arabic', 'Maxamed Nuur', 'Room 2'],
                ['Sunday', '08:10', '08:50', 'Somali', 'Caasha Diiriye', 'Room 2'],
            ]
            const ws = XLSX.utils.aoa_to_sheet(templateData)
            ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 12 }]
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]
            XLSX.utils.book_append_sheet(wb, ws, 'Template')
            XLSX.writeFile(wb, 'Timetable_Template.xlsx')
        }
    }

    // ── Open Import Panel ──────────────────────────────────────────────────────
    const openImport = () => {
        setImportMode('single')
        setImportClass(classes[0]?.id || '')
        setImportShift('morning')
        setImportRows([])
        setImportMulti([])
        setImportFileName('')
        setImportStep(1)
        setImportError('')
        setClearFirst(false)
        setShowImportPanel(true)
    }

    // ── Handle File Upload ─────────────────────────────────────────────────────
    const handleImportFile = (e) => {
        const file = e.target.files[0]
        if (!file) return
        setImportFileName(file.name)
        setImportError('')

        const reader = new FileReader()
        reader.onload = (evt) => {
            try {
                const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: false })

                if (importMode === 'single') {
                    // ── SINGLE MODE: read all sheets, combine rows ────────────
                    const parsed = []
                    wb.SheetNames.forEach(sheetName => {
                        const sheetDay = DEFAULT_DAYS.find(d => sheetName.toLowerCase().startsWith(d.toLowerCase()))
                        // Skip Summary sheet
                        if (sheetName.toLowerCase() === 'summary') return
                        const ws = wb.Sheets[sheetName]
                        const rows = parseSheetRows(ws, sheetDay || '')
                        parsed.push(...rows)
                    })
                    if (parsed.length === 0) {
                        setImportError('Ma helin xog ku filan faylka. Hubso tiirarka: Day, Start, End, Subject.')
                    } else {
                        setImportRows(parsed)
                        setImportStep(3)
                    }

                } else {
                    // ── MULTI MODE: each sheet = one class-section ────────────
                    const multiData = []
                    wb.SheetNames.forEach(sheetName => {
                        const meta = parseSheetMeta(sheetName)
                        if (!meta) return  // skip day sheets, Summary, Template

                        const ws = wb.Sheets[sheetName]
                        const rows = parseSheetRows(ws, '')
                        if (rows.length === 0) return

                        // Try to auto-match class & section
                        const matchedClass = classes.find(c =>
                            c.class_name?.toLowerCase().trim() === meta.className?.toLowerCase().trim()
                        )
                        const matchedSection = matchedClass?.Sections?.find(s =>
                            (s.name || 'General')?.toLowerCase().trim() === meta.sectionName?.toLowerCase().trim()
                        )

                        multiData.push({
                            sheetName,
                            className: meta.className,
                            sectionName: meta.sectionName,
                            matchedClassId: matchedClass?.id || '',
                            matchedSectionId: matchedSection?.id || '',
                            shift: importShift,
                            rows,
                            resolved: !!matchedSection
                        })
                    })

                    if (multiData.length === 0) {
                        setImportError('Ma helin sheets fasalka u taagan. Hubi in magacyada sheets-ku ay la mid yihiin qaabka: "Kowaad-A" ama "Grade1-B".')
                    } else {
                        setImportMulti(multiData)
                        setImportStep(3)
                    }
                }
            } catch (err) {
                setImportError('Khalad faylka akhriiska: ' + err.message)
            }
        }
        reader.readAsArrayBuffer(file)
    }

    // ── Update multi entry (section/shift override) ────────────────────────────
    const updateMultiEntry = (idx, field, value) => {
        setImportMulti(prev => {
            const next = [...prev]
            next[idx] = { ...next[idx], [field]: value }
            if (field === 'matchedClassId') {
                const cls = classes.find(c => c.id === value)
                next[idx].matchedSectionId = cls?.Sections?.[0]?.id || ''
                next[idx].resolved = !!next[idx].matchedSectionId
            }
            if (field === 'matchedSectionId') {
                next[idx].resolved = !!value
            }
            return next
        })
    }

    // ── Save Single Import ─────────────────────────────────────────────────────
    const handleImportSave = async () => {
        if (!importSection) { setImportError('Fadlan dooro qaybta (section)!'); return }
        if (importRows.length === 0) { setImportError('Ma jiraan xogta la keeni karo!'); return }

        setImportLoading(true)
        setImportError('')

        const entries = []
        const skipErrors = []

        for (const row of importRows) {
            const subjectMatch = subjects.find(s => s.name?.toLowerCase().trim() === row.subject?.toLowerCase().trim())
            const teacherMatch = teachers.find(t => t.user?.name?.toLowerCase().trim() === row.teacher?.toLowerCase().trim())
            if (!subjectMatch) { skipErrors.push(`Subject "${row.subject}" lama helin`); continue }
            entries.push({
                sectionId: importSection,
                subjectId: subjectMatch.id,
                teacherId: teacherMatch?.id || null,
                day: row.day,
                startTime: row.startTime,
                endTime: row.endTime,
                room: row.room || '',
                shift: importShift
            })
        }

        try {
            const res = await axios.post(`${apiUrl}/api/timetable/bulk`, { entries, clearFirst }, { headers: headers() })
            const { inserted, skipped, errors } = res.data
            setImportLoading(false)
            if (inserted > 0) {
                if (importSection === activeSectionId && importShift === shift) {
                    const schoolId = getSchoolId()
                    axios.get(`${apiUrl}/api/timetable?sectionId=${activeSectionId}&shift=${shift}${schoolId ? `&schoolId=${schoolId}` : ''}`, { headers: headers() })
                        .then(r => setEntries(r.data))
                }
                const allErrors = [...skipErrors, ...errors]
                alert(`✅ ${inserted} fasallo si guul ah ayaa loo keenay!${skipped > 0 ? `\n⚠️ ${skipped} ayaa fashilmay:\n${allErrors.slice(0, 5).join('\n')}` : ''}`)
                setShowImportPanel(false)
            } else {
                setImportError(`Dhammaan ${skipped} safaf ayaa fashilmay:\n${[...skipErrors, ...errors].slice(0, 5).join('\n')}`)
            }
        } catch (err) {
            setImportLoading(false)
            setImportError(err.response?.data?.message || 'Server khalad')
        }
    }

    // ── Save Multi Import ──────────────────────────────────────────────────────
    const handleMultiImportSave = async () => {
        const toProcess = importMulti.filter(m => m.matchedSectionId && m.rows.length > 0)
        if (toProcess.length === 0) { setImportError('Fasal xidid lama dooranin!'); return }

        setImportLoading(true)
        setImportError('')

        const allEntries = []
        for (const m of toProcess) {
            for (const row of m.rows) {
                const subjectMatch = subjects.find(s => s.name?.toLowerCase().trim() === row.subject?.toLowerCase().trim())
                const teacherMatch = teachers.find(t => t.user?.name?.toLowerCase().trim() === row.teacher?.toLowerCase().trim())
                if (!subjectMatch) continue
                allEntries.push({
                    sectionId: m.matchedSectionId,
                    subjectId: subjectMatch.id,
                    teacherId: teacherMatch?.id || null,
                    day: row.day,
                    startTime: row.startTime,
                    endTime: row.endTime,
                    room: row.room || '',
                    shift: m.shift || importShift
                })
            }
        }

        try {
            const res = await axios.post(`${apiUrl}/api/timetable/bulk`, { entries: allEntries, clearFirst }, { headers: headers() })
            const { inserted, skipped, errors } = res.data
            setImportLoading(false)

            // Refresh view if we touched active section
            const touchedActive = toProcess.some(m => m.matchedSectionId === activeSectionId && m.shift === shift)
            if (touchedActive) {
                const schoolId = getSchoolId()
                axios.get(`${apiUrl}/api/timetable?sectionId=${activeSectionId}&shift=${shift}${schoolId ? `&schoolId=${schoolId}` : ''}`, { headers: headers() })
                    .then(r => setEntries(r.data))
            }

            const totalRows = toProcess.reduce((a, m) => a + m.rows.length, 0)
            alert(`✅ ${inserted} fasallo si guul ah ayaa loo keenay!\n📚 ${toProcess.length} fasal ayaa la warceliyey\n⚠️ ${skipped} ayaa fashilmay${errors.length > 0 ? ':\n' + errors.slice(0, 3).join('\n') : ''}`)
            setShowImportPanel(false)
        } catch (err) {
            setImportLoading(false)
            setImportError(err.response?.data?.message || 'Server khalad')
        }
    }

    // ── Computed stats for preview ─────────────────────────────────────────────
    const shiftLabel = shift === 'morning' ? '🌅 Subax' : shift === 'afternoon' ? '🌇 Galab' : '🌙 Habeen'
    const validSingleRows = importRows.filter(r => subjects.some(s => s.name?.toLowerCase().trim() === r.subject?.toLowerCase().trim()))
    const multiTotal = importMulti.reduce((a, m) => a + m.rows.length, 0)
    const multiValid = importMulti.filter(m => m.matchedSectionId)

    return (
        <Layout title="Timetable">
            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">
                        Weekly Timetable: {classInfo?.class_name} {activeSection?.name && `- ${activeSection?.name}`}
                        <span className="ml-2 text-teal-600">({shiftLabel})</span>
                    </h2>
                    <p className="text-gray-400 text-sm">Manage class schedules for each section and shift</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="flex bg-white rounded-xl border-2 border-gray-100 overflow-hidden shadow-sm">
                        <select className="p-3 font-bold appearance-none bg-transparent text-slate-700 outline-none pr-8 border-r" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                            <option value="">Grade</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                        </select>
                        <select className="p-3 font-bold appearance-none bg-transparent text-slate-700 outline-none pr-8" value={selectedSectionId} onChange={e => setSelectedSectionId(e.target.value)}>
                            <option value="">Section</option>
                            {sections.map(s => <option key={s.id} value={s.id}>{s.name || 'General'}</option>)}
                        </select>
                        <button onClick={() => setActiveSectionId(selectedSectionId)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-3 transition-colors">Search</button>
                    </div>

                    {/* Import Excel */}
                    <button onClick={openImport} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-blue-100 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="17 14 12 9 7 14"/><line x1="12" y1="9" x2="12" y2="21"/>
                            <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
                        </svg>
                        Soo Geli Excel
                    </button>

                    {/* Export Excel */}
                    <button onClick={() => setShowDownloadPanel(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-emerald-100 transition-all">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Daji Excel
                    </button>

                    <button onClick={openModal} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-teal-100 transition-all">+ Add Period</button>
                </div>
            </div>

            {/* ── Shift Tabs ── */}
            <div className="flex gap-2 mb-6 p-1 bg-gray-100/50 rounded-2xl self-start w-fit">
                <button onClick={() => setShift('morning')} className={`px-8 py-3 rounded-xl font-bold transition-all ${shift === 'morning' ? 'bg-white text-teal-600 shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}>🌅 Subax (Morning)</button>
                <button onClick={() => setShift('afternoon')} className={`px-8 py-3 rounded-xl font-bold transition-all ${shift === 'afternoon' ? 'bg-white text-teal-600 shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}>🌇 Galab (Afternoon)</button>
                <button onClick={() => setShift('night')} className={`px-8 py-3 rounded-xl font-bold transition-all ${shift === 'night' ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-gray-400 hover:text-gray-600'}`}>🌙 Habeen (Night)</button>
            </div>

            {/* ── Timetable List ── */}
            <div className="space-y-4">
                {DAYS.map(day => (
                    <div key={day} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-3 text-sm font-black text-slate-600 uppercase tracking-widest">{day}</div>
                        {grouped[day]?.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {grouped[day].map(e => (
                                    <div key={e.id} className="px-6 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-teal-50 text-teal-600 font-mono text-sm font-bold px-3 py-2 rounded-lg">{e.startTime} - {e.endTime}</div>
                                            <div>
                                                <p className="font-bold text-slate-800">{e.subject?.name}</p>
                                                <p className="text-xs text-gray-400"><span className="text-teal-600 font-bold uppercase">{e.section?.class?.class_name} - {e.section?.name}</span> · {e.teacher?.user?.name || '—'} · {e.room || 'No room'}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => axios.delete(`${apiUrl}/api/timetable/${e.id}`, { headers: headers() }).then(() => setEntries(entries.filter(x => x.id !== e.id)))} className="text-red-300 hover:text-red-600">✕</button>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="px-6 py-4 text-gray-300 text-sm italic">No classes scheduled</p>}
                    </div>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════
                IMPORT EXCEL MODAL
            ══════════════════════════════════════════════════════ */}
            {showImportPanel && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">

                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-start flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-black flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><polyline points="17 14 12 9 7 14"/><line x1="12" y1="9" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
                                    Soo Geli Jadwalka (Excel Import)
                                </h3>
                                {/* Step indicators */}
                                <div className="flex gap-4 mt-3">
                                    {[
                                        { n: 1, label: 'Qaabka & Fasalka' },
                                        { n: 2, label: 'Soo Geli Faylka' },
                                        { n: 3, label: 'Dib u Eeg & Kaydi' }
                                    ].map(({ n, label }) => (
                                        <div key={n} className={`flex items-center gap-1.5 text-sm ${importStep >= n ? 'text-white font-bold' : 'text-blue-300'}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black transition-all ${importStep > n ? 'bg-emerald-400 text-white' : importStep === n ? 'bg-white text-blue-600' : 'bg-blue-500 text-blue-200'}`}>
                                                {importStep > n ? '✓' : n}
                                            </div>
                                            <span className="hidden sm:inline">{label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button onClick={() => setShowImportPanel(false)} className="text-blue-200 hover:text-white text-2xl font-bold leading-none mt-1">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-5">

                            {/* ══════ STEP 1: Mode + Class / Shift ══════ */}
                            {importStep === 1 && (
                                <div className="space-y-5">

                                    {/* Mode Selector */}
                                    <div>
                                        <p className="text-xs font-black text-gray-400 uppercase mb-3">Nooca Import-ka</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => setImportMode('single')}
                                                className={`p-4 rounded-2xl border-2 text-left transition-all ${importMode === 'single' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-300'}`}
                                            >
                                                <div className="text-2xl mb-2">📄</div>
                                                <p className={`font-black text-sm ${importMode === 'single' ? 'text-blue-700' : 'text-slate-700'}`}>Fasal Keliya</p>
                                                <p className="text-xs text-gray-400 mt-1">Hal fasal ah soo geli. Fayl kasta oo Excel ah oo ay ku jiraan sadar badan.</p>
                                            </button>
                                            <button
                                                onClick={() => setImportMode('multi')}
                                                className={`p-4 rounded-2xl border-2 text-left transition-all ${importMode === 'multi' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-gray-300'}`}
                                            >
                                                <div className="text-2xl mb-2">📚</div>
                                                <p className={`font-black text-sm ${importMode === 'multi' ? 'text-indigo-700' : 'text-slate-700'}`}>Fasalal Badan (Multi-Class)</p>
                                                <p className="text-xs text-gray-400 mt-1">Sheet kasta = fasal gooniya. Import dhammaan fasallada hal mar.</p>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Single Mode: Pick class/section/shift */}
                                    {importMode === 'single' && (
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Fasalka (Grade)</label>
                                                <select className="w-full p-3 rounded-xl border-2 border-gray-100 font-bold text-slate-700 bg-white appearance-none" value={importClass} onChange={e => setImportClass(e.target.value)}>
                                                    <option value="">Dooro...</option>
                                                    {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Qaybta (Section)</label>
                                                <select className="w-full p-3 rounded-xl border-2 border-gray-100 font-bold text-slate-700 bg-white appearance-none" value={importSection} onChange={e => setImportSection(e.target.value)}>
                                                    <option value="">Dooro...</option>
                                                    {importSections.map(s => <option key={s.id} value={s.id}>{s.name || 'General'}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Waqtiga (Shift)</label>
                                                <select className="w-full p-3 rounded-xl border-2 border-gray-100 font-bold text-slate-700 bg-white appearance-none" value={importShift} onChange={e => setImportShift(e.target.value)}>
                                                    <option value="morning">🌅 Subax (Morning)</option>
                                                    <option value="afternoon">🌇 Galab (Afternoon)</option>
                                                    <option value="night">🌙 Habeen (Night)</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Multi Mode: just shift (sections matched from sheet names) */}
                                    {importMode === 'multi' && (
                                        <div>
                                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4">
                                                <p className="text-sm font-black text-indigo-800 mb-1">📋 Qaabka Sheet-yada</p>
                                                <p className="text-xs text-indigo-600">Magaca sheet-ka waa inuu ahaadaa: <code className="bg-indigo-100 px-1 rounded font-mono">FasalMagac-SectionMagac</code></p>
                                                <p className="text-xs text-indigo-500 mt-1">Tusaale: <code className="bg-indigo-100 px-1 rounded font-mono">Kowaad-A</code> · <code className="bg-indigo-100 px-1 rounded font-mono">Labaad-B</code> · <code className="bg-indigo-100 px-1 rounded font-mono">Grade1-A</code></p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Default Shift</label>
                                                    <select className="w-full p-3 rounded-xl border-2 border-gray-100 font-bold text-slate-700 bg-white appearance-none" value={importShift} onChange={e => setImportShift(e.target.value)}>
                                                        <option value="morning">🌅 Subax (Morning)</option>
                                                        <option value="afternoon">🌇 Galab (Afternoon)</option>
                                                        <option value="night">🌙 Habeen (Night)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Clear first option */}
                                    <label className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl cursor-pointer hover:bg-amber-100 transition-all">
                                        <input type="checkbox" checked={clearFirst} onChange={e => setClearFirst(e.target.checked)} className="w-5 h-5 accent-amber-500 rounded" />
                                        <div>
                                            <p className="font-black text-amber-800 text-sm">Tirtir Jadwalka Hore Ka Hor Import-ka</p>
                                            <p className="text-xs text-amber-600">Haddaad doorato, jadwalka jira ee fasalkaas wuu tirtiri doonaa ka hor saday cusub la geliyaa.</p>
                                        </div>
                                    </label>

                                    {/* Template download */}
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">📋 Haddaadan haysanin template, soo daji:</p>
                                            <p className="text-xs text-slate-400 mt-0.5">Buuxi oo ku celi si loo keeno jadwalka</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => downloadTemplate('single')} className="text-sm font-black text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-400 px-3 py-2 rounded-xl transition-all">⬇ Fasal Keliya</button>
                                            <button onClick={() => downloadTemplate('multi')} className="text-sm font-black text-indigo-600 hover:text-indigo-900 border border-indigo-200 hover:border-indigo-400 px-3 py-2 rounded-xl transition-all">⬇ Multi-Class</button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            if (importMode === 'single' && (!importClass || !importSection)) {
                                                setImportError('Fadlan dooro fasalka iyo qaybta!'); return
                                            }
                                            setImportError('')
                                            setImportStep(2)
                                        }}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all"
                                    >
                                        Xiga →
                                    </button>
                                    {importError && <p className="text-red-500 text-sm font-bold text-center">{importError}</p>}
                                </div>
                            )}

                            {/* ══════ STEP 2: Upload File ══════ */}
                            {importStep === 2 && (
                                <div className="space-y-5">
                                    <div className="text-center">
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-4 border-dashed border-blue-200 bg-blue-50 rounded-3xl p-12 cursor-pointer hover:bg-blue-100 hover:border-blue-400 transition-all group"
                                        >
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 bg-blue-100 group-hover:bg-blue-200 rounded-2xl flex items-center justify-center transition-all">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className="font-black text-blue-700 text-lg">Riix si aad u doorato faylka</p>
                                                    <p className="text-blue-400 text-sm">Excel files: .xlsx, .xls</p>
                                                    {importMode === 'multi' && (
                                                        <p className="text-indigo-500 text-xs mt-1 font-bold">🗂 Sheets badan: sheet kasta = fasal gooniya</p>
                                                    )}
                                                </div>
                                                {importFileName && (
                                                    <div className="bg-white border border-blue-200 rounded-xl px-4 py-2 flex items-center gap-2">
                                                        <span className="text-2xl">📊</span>
                                                        <span className="font-bold text-slate-700 text-sm">{importFileName}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
                                    </div>

                                    <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-600 space-y-2">
                                        <p className="font-black text-slate-700">📌 Tiirarka la rabo:</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['Day', 'Start', 'End', 'Subject', 'Teacher', 'Room'].map(col => (
                                                <span key={col} className="bg-white border border-slate-200 rounded-lg px-3 py-1 font-mono text-xs font-bold text-slate-500">{col}</span>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-400">Faylka la soo dajiyo (exported) si toos ah ayuu u shaqeynayaa.</p>
                                    </div>

                                    {importError && (
                                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 text-sm font-bold whitespace-pre-line">{importError}</div>
                                    )}

                                    <div className="flex gap-3">
                                        <button onClick={() => { setImportStep(1); setImportRows([]); setImportMulti([]); setImportFileName('') }} className="flex-1 py-3 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50 transition-all">← Dib</button>
                                    </div>
                                </div>
                            )}

                            {/* ══════ STEP 3A: Preview — Single Mode ══════ */}
                            {importStep === 3 && importMode === 'single' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div>
                                            <p className="font-black text-slate-800 text-lg">Dib u Eeg Xogta</p>
                                            <p className="text-sm text-gray-400">
                                                {importRows.length} safaf · <span className="font-bold text-emerald-600">{validSingleRows.length} diyaar</span>
                                                {importRows.length - validSingleRows.length > 0 && <span className="text-red-400 font-bold"> · {importRows.length - validSingleRows.length} khalad</span>}
                                                &nbsp;· Fasalka: <span className="font-bold text-blue-600">{classes.find(c => c.id === importClass)?.class_name} — {importSections.find(s => s.id === importSection)?.name || 'General'}</span>
                                            </p>
                                        </div>
                                        <button onClick={() => { setImportStep(2); setImportRows([]); setImportFileName('') }} className="text-xs text-blue-600 font-bold hover:underline">Bedel Faylka</button>
                                    </div>

                                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    <th className="px-3 py-3 text-left font-black text-gray-500 text-xs uppercase">Maalinta</th>
                                                    <th className="px-3 py-3 text-left font-black text-gray-500 text-xs uppercase">Waqtiga</th>
                                                    <th className="px-3 py-3 text-left font-black text-gray-500 text-xs uppercase">Maadada</th>
                                                    <th className="px-3 py-3 text-left font-black text-gray-500 text-xs uppercase">Macallinka</th>
                                                    <th className="px-3 py-3 text-left font-black text-gray-500 text-xs uppercase">Qolka</th>
                                                    <th className="px-3 py-3 text-left font-black text-gray-500 text-xs uppercase">Xaaladda</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {importRows.slice(0, 25).map((row, i) => {
                                                    const subjectOk = subjects.some(s => s.name?.toLowerCase().trim() === row.subject?.toLowerCase().trim())
                                                    const teacherOk = !row.teacher || teachers.some(t => t.user?.name?.toLowerCase().trim() === row.teacher?.toLowerCase().trim())
                                                    return (
                                                        <tr key={i} className={!subjectOk ? 'bg-red-50' : 'hover:bg-gray-50'}>
                                                            <td className="px-3 py-2 font-bold text-slate-700 text-xs">{row.day}</td>
                                                            <td className="px-3 py-2 font-mono text-teal-600 text-xs">{row.startTime} - {row.endTime}</td>
                                                            <td className="px-3 py-2"><span className={`font-bold text-sm ${subjectOk ? 'text-slate-800' : 'text-red-600'}`}>{row.subject}</span></td>
                                                            <td className="px-3 py-2 text-gray-500 text-xs"><span className={!teacherOk ? 'text-amber-500' : ''}>{row.teacher || '—'}</span></td>
                                                            <td className="px-3 py-2 text-gray-400 text-xs">{row.room || '—'}</td>
                                                            <td className="px-3 py-2">
                                                                {subjectOk
                                                                    ? <span className="text-emerald-500 font-bold text-xs">✓ Diyaar</span>
                                                                    : <span className="text-red-500 font-bold text-xs">✕ Lama helin</span>
                                                                }
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                        {importRows.length > 25 && (
                                            <p className="px-4 py-3 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">... iyo {importRows.length - 25} safaf oo kale</p>
                                        )}
                                    </div>

                                    <div className="flex gap-4 text-xs flex-wrap">
                                        <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span>Maadada la heli karaa</span>
                                        <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 bg-red-400 rounded-full"></span>Maadada lama helin (ha la keenin)</span>
                                        <span className="flex items-center gap-1 text-amber-500"><span className="w-2 h-2 bg-amber-400 rounded-full"></span>Macallinku wuu jiraa laakiin cidna lama xidhin</span>
                                    </div>

                                    {importError && (
                                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 text-sm font-bold whitespace-pre-line">{importError}</div>
                                    )}

                                    <div className="flex gap-3">
                                        <button onClick={() => { setImportStep(2); setImportRows([]); setImportFileName('') }} className="flex-1 py-3 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50">← Dib</button>
                                        <button
                                            onClick={handleImportSave}
                                            disabled={importLoading || validSingleRows.length === 0}
                                            className={`flex-2 min-w-[200px] py-3 rounded-2xl font-black text-white transition-all ${importLoading || validSingleRows.length === 0 ? 'bg-blue-300 cursor-wait' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-100'}`}
                                        >
                                            {importLoading ? '⏳ Waa la kaydiyaa...' : `✅ Kaydi ${validSingleRows.length} Fasallo`}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ══════ STEP 3B: Preview — Multi-Class Mode ══════ */}
                            {importStep === 3 && importMode === 'multi' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div>
                                            <p className="font-black text-slate-800 text-lg">Dib u Eeg — Fasalal Badan</p>
                                            <p className="text-sm text-gray-400">
                                                {importMulti.length} sheets · <span className="font-bold text-emerald-600">{multiValid.length} la xidhi karaa</span>
                                                {importMulti.length - multiValid.length > 0 && <span className="text-amber-500 font-bold"> · {importMulti.length - multiValid.length} aan la garanayn</span>}
                                                &nbsp;· Wadarta: <span className="font-bold text-blue-600">{multiTotal} safaf</span>
                                            </p>
                                        </div>
                                        <button onClick={() => { setImportStep(2); setImportMulti([]); setImportFileName('') }} className="text-xs text-blue-600 font-bold hover:underline">Bedel Faylka</button>
                                    </div>

                                    {/* Per-sheet mapping table */}
                                    <div className="space-y-3">
                                        {importMulti.map((m, idx) => {
                                            const cls = classes.find(c => c.id === m.matchedClassId)
                                            const sec = cls?.Sections?.find(s => s.id === m.matchedSectionId)
                                            const validRows = m.rows.filter(r => subjects.some(s => s.name?.toLowerCase().trim() === r.subject?.toLowerCase().trim()))
                                            return (
                                                <div key={idx} className={`border-2 rounded-2xl p-4 transition-all ${m.matchedSectionId ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                                                    <div className="flex items-start justify-between gap-4 flex-wrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 ${m.matchedSectionId ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                                {m.matchedSectionId ? '✓' : '?'}
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-800 text-sm">Sheet: <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{m.sheetName}</span></p>
                                                                <p className="text-xs text-gray-400 mt-0.5">{m.rows.length} safaf · <span className="text-emerald-600">{validRows.length} maado la helay</span></p>
                                                            </div>
                                                        </div>

                                                        {/* Section/Shift assignment */}
                                                        <div className="flex gap-2 items-center flex-wrap">
                                                            <select
                                                                value={m.matchedClassId}
                                                                onChange={e => updateMultiEntry(idx, 'matchedClassId', e.target.value)}
                                                                className="text-sm p-2 rounded-xl border-2 border-gray-200 font-bold text-slate-700 bg-white appearance-none"
                                                            >
                                                                <option value="">— Fasal —</option>
                                                                {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                                                            </select>
                                                            <select
                                                                value={m.matchedSectionId}
                                                                onChange={e => updateMultiEntry(idx, 'matchedSectionId', e.target.value)}
                                                                className="text-sm p-2 rounded-xl border-2 border-gray-200 font-bold text-slate-700 bg-white appearance-none"
                                                            >
                                                                <option value="">— Section —</option>
                                                                {(classes.find(c => c.id === m.matchedClassId)?.Sections || []).map(s => (
                                                                    <option key={s.id} value={s.id}>{s.name || 'General'}</option>
                                                                ))}
                                                            </select>
                                                            <select
                                                                value={m.shift}
                                                                onChange={e => updateMultiEntry(idx, 'shift', e.target.value)}
                                                                className="text-sm p-2 rounded-xl border-2 border-gray-200 font-bold text-slate-700 bg-white appearance-none"
                                                            >
                                                                <option value="morning">🌅 Subax</option>
                                                                <option value="afternoon">🌇 Galab</option>
                                                                <option value="night">🌙 Habeen</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Mini preview of rows */}
                                                    {m.rows.length > 0 && (
                                                        <div className="mt-3 flex flex-wrap gap-1">
                                                            {m.rows.slice(0, 8).map((r, ri) => {
                                                                const ok = subjects.some(s => s.name?.toLowerCase().trim() === r.subject?.toLowerCase().trim())
                                                                return (
                                                                    <span key={ri} className={`text-xs px-2 py-1 rounded-lg font-bold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                                        {r.day?.substring(0, 3)} · {r.subject}
                                                                    </span>
                                                                )
                                                            })}
                                                            {m.rows.length > 8 && <span className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-400">+{m.rows.length - 8} oo kale</span>}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {importError && (
                                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 text-sm font-bold whitespace-pre-line">{importError}</div>
                                    )}

                                    <div className="flex gap-3">
                                        <button onClick={() => { setImportStep(2); setImportMulti([]); setImportFileName('') }} className="flex-1 py-3 border-2 border-gray-200 text-gray-500 font-bold rounded-2xl hover:bg-gray-50">← Dib</button>
                                        <button
                                            onClick={handleMultiImportSave}
                                            disabled={importLoading || multiValid.length === 0}
                                            className={`flex-2 min-w-[220px] py-3 rounded-2xl font-black text-white transition-all ${importLoading || multiValid.length === 0 ? 'bg-indigo-300 cursor-wait' : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-indigo-100'}`}
                                        >
                                            {importLoading ? '⏳ Waa la kaydiyaa...' : `✅ Kaydi ${multiValid.length} Fasal (${multiTotal} safaf)`}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
                DOWNLOAD EXCEL MODAL
            ══════════════════════════════════════════════════════ */}
            {showDownloadPanel && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-black flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                    Daji Jadwalka (Excel)
                                </h3>
                                <p className="text-emerald-100 text-sm mt-1">{classInfo?.class_name} — {activeSection?.name || '—'} · {shiftLabel}</p>
                            </div>
                            <button onClick={() => setShowDownloadPanel(false)} className="text-emerald-200 hover:text-white text-2xl font-bold leading-none">✕</button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="flex gap-2 items-center">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex-1">Dooro Maalmaha</span>
                                <button onClick={selectAllDays} className="text-xs font-bold text-teal-600 hover:text-teal-700 px-3 py-1.5 rounded-lg border border-teal-200 hover:bg-teal-50 transition-all">✔ Dhami</button>
                                <button onClick={clearAllDays} className="text-xs font-bold text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">✕ Naadi</button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {DAYS.map(day => {
                                    const count = grouped[day]?.length || 0
                                    const checked = selectedDays.includes(day)
                                    return (
                                        <button key={day} onClick={() => toggleDay(day)} className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${checked ? 'border-emerald-400 bg-emerald-50' : 'border-gray-100 bg-gray-50 hover:border-gray-300'}`}>
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'}`}>
                                                {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                                            </div>
                                            <div>
                                                <p className={`font-bold text-sm ${checked ? 'text-emerald-800' : 'text-gray-500'}`}>{day}</p>
                                                <p className={`text-xs ${checked ? 'text-emerald-500' : 'text-gray-300'}`}>{count} fasallo</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            <p className="text-center text-sm text-gray-400">
                                <span className="font-black text-slate-700">{selectedDays.length}</span> maalin · <span className="font-bold text-slate-600">{1 + selectedDays.length}</span> sheets
                            </p>

                            <button onClick={downloadExcel} disabled={selectedDays.length === 0} className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-base transition-all ${selectedDays.length > 0 ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-100' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                Daji Excel (.xlsx)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Period Modal ── */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between"><h3 className="text-xl font-bold">Add Period</h3><button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button></div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Teacher</label>
                                <select required className="w-full p-3 rounded-xl border appearance-none bg-white font-bold" value={formData.teacherId} onChange={e => handleTeacherChange(e.target.value)}>
                                    <option value="">Select teacher</option>
                                    {teachers.filter(t => t.SubjectAssignments?.some(a => a.sectionId === activeSectionId)).map(t => <option key={t.id} value={t.id}>{t.user.name}</option>)}
                                </select>
                                {teachers.filter(t => t.SubjectAssignments?.some(a => a.sectionId === activeSectionId)).length === 0 && activeSectionId && (
                                    <p className="text-[10px] text-red-500 mt-1 font-bold">No teachers assigned to this section yet.</p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Subject</label>
                                <select required className="w-full p-3 rounded-xl border appearance-none bg-white" value={formData.subjectId} onChange={e => setFormData({ ...formData, subjectId: e.target.value })}>
                                    <option value="">Select</option>
                                    {displaySubjects.map(s => <option key={s.id} value={s.id}>{s.name} {formData.teacherId && ' (Assigned)'}</option>)}
                                </select>
                                {formData.teacherId && displaySubjects.length !== subjects.length && <p className="text-[10px] text-teal-600 mt-1">Showing subjects assigned to this teacher</p>}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Day</label><select className="w-full p-3 rounded-xl border appearance-none bg-white" value={formData.day} onChange={e => setFormData({ ...formData, day: e.target.value })}>{DAYS.map(d => <option key={d}>{d}</option>)}</select></div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Start</label><input type="time" className="w-full p-3 rounded-xl border" value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })} /></div>
                                <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">End</label><input type="time" className="w-full p-3 rounded-xl border" value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })} /></div>
                            </div>
                            <div><label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Room</label><input className="w-full p-3 rounded-xl border" placeholder="e.g. Room 101" value={formData.room} onChange={e => setFormData({ ...formData, room: e.target.value })} /></div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Shift</label>
                                <select className="w-full p-3 rounded-xl border appearance-none bg-white font-bold text-slate-700" value={formData.shift} onChange={e => setFormData({ ...formData, shift: e.target.value })}>
                                    <option value="morning">Morning (Subax)</option>
                                    <option value="afternoon">Afternoon (Galab)</option>
                                    <option value="night">Night (Habeen) 🌙</option>
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-teal-700 transition-all">Add to Schedule</button>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
