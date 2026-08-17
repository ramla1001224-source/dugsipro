import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import SearchingState from '../../components/SearchingState'

export default function AdminClasses() {
    const [classes, setClasses] = useState([])
    const [loading, setLoading] = useState(true)
    const [teachers, setTeachers] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState({
        class_name: '',
        sections: [{ name: 'A', teacherId: '', shifts: ['morning'] }]
    })
    const [submitting, setSubmitting] = useState(false)
    const [expandedClass, setExpandedClass] = useState(null)
    const [selectedShift, setSelectedShift] = useState('all')

    // Section edit state
    const [editingSection, setEditingSection] = useState(null)
    const [editSectionData, setEditSectionData] = useState({ name: '', teacherId: '', shifts: ['morning'] })
    const [editSubmitting, setEditSubmitting] = useState(false)

    // Multi-shift helpers
    const ALL_SHIFTS = [
        { value: 'morning',   label: 'Subax (Morning)',   emoji: '🌅', color: 'emerald' },
        { value: 'afternoon', label: 'Galab (Afternoon)', emoji: '🌇', color: 'orange'  },
        { value: 'night',     label: 'Habeen (Night)',    emoji: '🌙', color: 'indigo'  },
    ]

    // Parse a shift field (could be CSV string or array) into an array
    const parseShifts = (shift) => {
        if (!shift) return ['morning']
        if (Array.isArray(shift)) return shift
        return shift.split(',').map(s => s.trim()).filter(Boolean)
    }

    const shiftBadgeColor = (sh) => sh === 'afternoon' ? 'bg-orange-100 text-orange-600' : sh === 'night' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'

    const toggleShiftInArray = (arr, value) =>
        arr.includes(value) ? arr.filter(s => s !== value) : [...arr, value]

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getToken = () => localStorage.getItem('token')

    const fetchData = async () => {
        setLoading(true)
        try {
            const [clsRes, teaRes] = await Promise.all([
                axios.get(`${apiUrl}/api/classes`, { headers: { Authorization: `Bearer ${getToken()}` } }),
                axios.get(`${apiUrl}/api/teachers`, { headers: { Authorization: `Bearer ${getToken()}` } })
            ])
            setClasses(clsRes.data)
            setTeachers(teaRes.data)
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }

    useEffect(() => { fetchData() }, [])

    // Filter classes and their sections based on selected shift (supports CSV shifts)
    const filteredClasses = classes.map(cls => {
        const filteredSections = (cls.Sections || []).filter(sec => {
            if (selectedShift === 'all') return true
            const sectionShifts = parseShifts(sec.shift)
            return sectionShifts.includes(selectedShift)
        })
        return { ...cls, Sections: filteredSections }
    }).filter(cls => cls.Sections.length > 0 || selectedShift === 'all')

    // Add a section row to the create form
    const addSectionRow = () => {
        setFormData(prev => ({
            ...prev,
            sections: [...prev.sections, { name: '', teacherId: '', shifts: ['morning'] }]
        }))
    }

    const removeSectionRow = (idx) => {
        setFormData(prev => ({
            ...prev,
            sections: prev.sections.filter((_, i) => i !== idx)
        }))
    }

    const updateSection = (idx, field, value) => {
        setFormData(prev => {
            const sections = [...prev.sections]
            sections[idx] = { ...sections[idx], [field]: value }
            return { ...prev, sections }
        })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting) return
        setSubmitting(true)
        try {
            // Convert shifts array → CSV string before sending to backend
            const payload = {
                ...formData,
                sections: formData.sections.map(s => ({
                    ...s,
                    shift: (s.shifts || ['morning']).join(',')
                }))
            }
            await axios.post(`${apiUrl}/api/classes/create`, payload, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setShowModal(false)
            setFormData({ class_name: '', sections: [{ name: 'A', teacherId: '', shifts: ['morning'] }] })
            fetchData()
        } catch (e) { alert(e.response?.data?.message || 'Error creating class') }
        finally { setSubmitting(false) }
    }

    const deleteClass = async (id) => {
        if (!confirm('Delete this entire grade and ALL its sections? This cannot be undone.')) return
        try {
            await axios.delete(`${apiUrl}/api/classes/${id}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            fetchData()
        } catch (e) { alert(e.response?.data?.message || 'Error deleting class') }
    }

    const deleteSection = async (sectionId) => {
        if (!confirm('Delete this section? Students in it will be unassigned.')) return
        try {
            await axios.delete(`${apiUrl}/api/classes/section/${sectionId}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            fetchData()
        } catch (e) { alert(e.response?.data?.message || 'Error deleting section') }
    }

    const openEditSection = (section) => {
        setEditingSection(section)
        setEditSectionData({
            name: section.name || '',
            teacherId: section.teacherId || '',
            shifts: parseShifts(section.shift)
        })
    }

    const handleEditSection = async (e) => {
        e.preventDefault()
        if (editSubmitting) return
        setEditSubmitting(true)
        try {
            const payload = {
                ...editSectionData,
                shift: (editSectionData.shifts || ['morning']).join(',')
            }
            await axios.put(`${apiUrl}/api/classes/section/${editingSection.id}`, payload, {
                headers: { Authorization: `Bearer ${getToken()}` }
            })
            setEditingSection(null)
            fetchData()
        } catch (e) { alert(e.response?.data?.message || 'Error updating section') }
        finally { setEditSubmitting(false) }
    }

    const totalStudents = (cls) => cls.Sections?.reduce((sum, s) => sum + (s._count?.Students || 0), 0) || 0

    return (
        <Layout title="Class Management">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Academic Grades & Sections</h2>
                    <p className="text-gray-400 text-sm">Each grade can have multiple sections (A, B, C...)</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center">
                        {['all', 'morning', 'afternoon', 'night'].map(sh => (
                            <button
                                key={sh}
                                onClick={() => setSelectedShift(sh)}
                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${selectedShift === sh ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                {sh === 'morning' ? '🌅 Subax' : sh === 'afternoon' ? '🌇 Galab' : sh === 'night' ? '🌙 Habeen' : 'All'}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                    >
                        <span>+</span> New Grade
                    </button>
                </div>
            </div>

            {/* Grade Cards */}
            <div className="space-y-4">
                {loading ? (
                    <SearchingState />
                ) : (
                    <>
                        {filteredClasses.map(cls => (
                            <div key={cls.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                                {/* Grade Header */}
                                <div
                                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-indigo-600 text-white w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg">
                                            {cls.class_name?.[0] || 'G'}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800">{cls.class_name}</h3>
                                            <p className="text-xs text-gray-400 font-bold">
                                                {cls.Sections?.length || 0} Section{cls.Sections?.length !== 1 ? 's' : ''} · {totalStudents(cls)} Students
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteClass(cls.id) }}
                                            className="text-red-300 hover:text-red-600 transition-colors text-sm font-bold px-3 py-1 rounded-lg hover:bg-red-50"
                                        >
                                            Delete Grade
                                        </button>
                                        <span className="text-gray-300 text-xl">{expandedClass === cls.id ? '▲' : '▼'}</span>
                                    </div>
                                </div>

                                {expandedClass === cls.id && (
                                    <div className="border-t border-gray-50 p-5">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {(cls.Sections || []).map(sec => (
                                                <div key={sec.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="text-sm font-black text-slate-700">Section {sec.name || 'General'}</span>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {parseShifts(sec.shift).map(sh => (
                                                                    <span key={sh} className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${shiftBadgeColor(sh)}`}>
                                                                        {sh === 'morning' ? '🌅 Subax' : sh === 'afternoon' ? '🌇 Galab' : '🌙 Habeen'}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button onClick={() => openEditSection(sec)} className="text-indigo-400 hover:text-indigo-600 text-xs px-2 py-1 rounded-lg hover:bg-indigo-50">✎</button>
                                                            <button onClick={() => deleteSection(sec.id)} className="text-red-300 hover:text-red-600 text-xs px-2 py-1 rounded-lg hover:bg-red-50">✕</button>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-gray-400">
                                                        👤 {sec.teacher?.user?.name || 'No teacher assigned'}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        🎓 {sec._count?.Students || 0} students
                                                    </p>
                                                </div>
                                            ))}
                                            <button
                                                className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all font-bold text-sm"
                                                onClick={() => {
                                                    const name = prompt(`Enter section name for ${cls.class_name} (e.g. A, B, C):`)
                                                    if (!name) return
                                                    const teacherId = ''
                                                    axios.post(`${apiUrl}/api/classes/${cls.id}/sections`, { name, teacherId, shift: 'morning' }, {
                                                        headers: { Authorization: `Bearer ${getToken()}` }
                                                    }).then(() => fetchData()).catch(err => alert(err.response?.data?.message || 'Error'))
                                                }}
                                            >
                                                + Add Section
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {classes.length === 0 && (
                            <div className="text-center py-20 text-gray-300">
                                <div className="text-6xl mb-4">🏫</div>
                                <p className="font-bold text-lg">No grades yet</p>
                                <p className="text-sm">Create your first grade to get started</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Create Grade Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold">Create New Grade</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Grade Name</label>
                                <input
                                    required
                                    className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. Grade 10, Form 1, Year 3"
                                    value={formData.class_name}
                                    onChange={e => setFormData({ ...formData, class_name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Sections</label>
                                <div className="space-y-3">
                                    {formData.sections.map((sec, idx) => (
                                        <div key={idx} className="bg-slate-50 rounded-2xl p-3 space-y-2">
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    required
                                                    className="flex-1 p-2 rounded-lg border text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    placeholder="Section name (e.g. A)"
                                                    value={sec.name}
                                                    onChange={e => updateSection(idx, 'name', e.target.value)}
                                                />
                                                <div className="flex gap-2">
                                                    {ALL_SHIFTS.map(sh => (
                                                        <label key={sh.value} className={`flex items-center gap-1 px-2 py-1 rounded-lg border cursor-pointer text-xs font-bold transition-all ${
                                                            (sec.shifts || []).includes(sh.value)
                                                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                                                                : 'border-gray-200 text-gray-400 hover:border-indigo-200'
                                                        }`}>
                                                            <input
                                                                type="checkbox"
                                                                className="hidden"
                                                                checked={(sec.shifts || []).includes(sh.value)}
                                                                onChange={() => {
                                                                    const next = toggleShiftInArray(sec.shifts || [], sh.value)
                                                                    if (next.length > 0) updateSection(idx, 'shifts', next)
                                                                }}
                                                            />
                                                            {sh.emoji} {sh.value === 'morning' ? 'Subax' : sh.value === 'afternoon' ? 'Galab' : 'Habeen'}
                                                        </label>
                                                    ))}
                                                </div>
                                                {formData.sections.length > 1 && (
                                                    <button type="button" onClick={() => removeSectionRow(idx)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
                                                )}
                                            </div>
                                            <select
                                                className="w-full p-2 rounded-lg border text-sm bg-white outline-none"
                                                value={sec.teacherId}
                                                onChange={e => updateSection(idx, 'teacherId', e.target.value)}
                                            >
                                                <option value="">No teacher assigned</option>
                                                {teachers.map(t => <option key={t.id} value={t.id}>{t.user.name} ({t.subject || 'N/A'})</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={addSectionRow}
                                    className="mt-2 text-indigo-500 text-sm font-bold hover:text-indigo-700"
                                >
                                    + Add Another Section
                                </button>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={`flex-1 ${submitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold py-3 rounded-xl transition-all`}
                                >
                                    {submitting ? 'Creating...' : 'Create Grade & Sections'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl border-2 font-bold text-gray-400">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Section Modal */}
            {editingSection && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-indigo-900 p-6 text-white flex justify-between items-center">
                            <h3 className="text-xl font-bold">Edit Section</h3>
                            <button onClick={() => setEditingSection(null)} className="text-indigo-200 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleEditSection} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Section Name</label>
                                <input
                                    required
                                    className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={editSectionData.name}
                                    onChange={e => setEditSectionData({ ...editSectionData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Shifts (Dooro mid ama in kabadan)</label>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_SHIFTS.map(sh => {
                                        const active = (editSectionData.shifts || []).includes(sh.value)
                                        return (
                                            <label key={sh.value} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer font-bold text-sm transition-all select-none ${
                                                active ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-400 hover:border-indigo-200 hover:bg-indigo-50/30'
                                            }`}>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={active}
                                                    onChange={() => {
                                                        const next = toggleShiftInArray(editSectionData.shifts || [], sh.value)
                                                        if (next.length > 0) setEditSectionData({ ...editSectionData, shifts: next })
                                                    }}
                                                />
                                                <span className="text-base">{sh.emoji}</span>
                                                <span>{sh.label}</span>
                                                {active && <span className="text-indigo-500">✓</span>}
                                            </label>
                                        )
                                    })}
                                </div>
                                {(editSectionData.shifts || []).length === 0 && (
                                    <p className="text-xs text-red-400 mt-1">Dooro hal shift ugu yaraan</p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Teacher</label>
                                <select
                                    className="w-full p-3 rounded-xl border bg-white outline-none font-bold text-slate-700"
                                    value={editSectionData.teacherId}
                                    onChange={e => setEditSectionData({ ...editSectionData, teacherId: e.target.value })}
                                >
                                    <option value="">No teacher assigned</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{t.user.name} ({t.subject || 'N/A'})</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    disabled={editSubmitting}
                                    className={`flex-1 ${editSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-bold py-3 rounded-xl transition-all`}
                                >
                                    {editSubmitting ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button type="button" onClick={() => setEditingSection(null)} className="px-6 py-3 rounded-xl border-2 font-bold text-gray-400">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    )
}
