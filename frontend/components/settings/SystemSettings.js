import { useEffect, useState } from 'react'
import axios from 'axios'
import { useLanguage } from '../../context/LanguageContext'

export default function SystemSettings() {
    const { t } = useLanguage()
    const [settings, setSettings] = useState({})
    const [gradingScale, setGradingScale] = useState([])
    const [saving, setSaving] = useState(false)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        Promise.all([
            axios.get(`${apiUrl}/api/settings`, { headers: headers() }).catch(() => ({ data: {} })),
            axios.get(`${apiUrl}/api/settings/grading`, { headers: headers() }).catch(() => ({ data: [] }))
        ]).then(([s, g]) => {
            setSettings(s.data)
            setGradingScale(g.data.length ? g.data : [
                { grade: 'A', minScore: 90, maxScore: 100, gpa: 4.0 },
                { grade: 'B+', minScore: 85, maxScore: 89, gpa: 3.5 },
                { grade: 'B', minScore: 80, maxScore: 84, gpa: 3.0 },
                { grade: 'C+', minScore: 75, maxScore: 79, gpa: 2.5 },
                { grade: 'C', minScore: 70, maxScore: 74, gpa: 2.0 },
                { grade: 'D', minScore: 60, maxScore: 69, gpa: 1.0 },
                { grade: 'F', minScore: 0, maxScore: 59, gpa: 0 }
            ])
        })
    }, [])

    const saveSettings = async () => {
        setSaving(true)
        try {
            await axios.put(`${apiUrl}/api/settings`, settings, { headers: headers() })
            await axios.post(`${apiUrl}/api/settings/grading`, { scales: gradingScale }, { headers: headers() })
            alert(t('settings_saved_success'))
        } catch (e) { alert(t('error_saving_settings')) }
        setSaving(false)
    }

    const settingFields = [
        { key: 'school_name', label: t('school_name'), placeholder: 'Dugsi Pro Academy' },
        { key: 'school_motto', label: t('motto'), placeholder: 'Excellence in Education' },
        { key: 'tuition_fee', label: t('tuition_fee'), placeholder: '50' },
        { key: 'school_address', label: t('address'), placeholder: '123 Education Street' },
        { key: 'school_phone', label: t('phone'), placeholder: '+1 234 567 8900' },
        { key: 'school_email', label: t('email'), placeholder: 'info@school.edu' },
        { key: 'principal_name', label: t('principal_name'), placeholder: 'Dr. John Smith' }
    ]

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">{t('system_configuration')}</h2>
                    <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">{t('configure_school_profile')}</p>
                </div>
                <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg transition-all disabled:opacity-50"
                >
                    {saving ? t('saving') : t('save_configuration')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* School Profile */}
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">{t('school_profile')}</h3>
                    <div className="space-y-4">
                        {settingFields.map(f => (
                            <div key={f.key}>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest ml-1">{f.label}</label>
                                <input
                                    className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-slate-500 transition-all font-bold text-slate-700"
                                    placeholder={f.placeholder}
                                    value={settings[f.key] || ''}
                                    onChange={e => setSettings({ ...settings, [f.key]: e.target.value })}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    {/* Timetable config moved here temporarily or kept depending on constraints. You said to exclude Timetable layout, but maybe keep config */}
                    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <svg className="w-24 h-24 text-teal-600 outline-none" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" /></svg>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 relative z-10">{t('timetable_defaults')}</h3>
                        <div className="space-y-6 relative z-10">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest ml-1">{t('working_days')}</label>
                                <div className="flex flex-wrap gap-2">
                                    {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                                        const workingDays = settings.timetable_days ? JSON.parse(settings.timetable_days) : ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
                                        const isActive = workingDays.includes(day);
                                        return (
                                            <button
                                                key={day}
                                                onClick={() => {
                                                    const newDays = isActive ? workingDays.filter(d => d !== day) : [...workingDays, day];
                                                    setSettings({ ...settings, timetable_days: JSON.stringify(newDays) });
                                                }}
                                                className={`px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest font-black transition-all border-2 ${isActive ? 'bg-teal-50 border-teal-200 text-teal-600 shadow-sm' : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'}`}
                                            >
                                                {day.slice(0, 3)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest ml-1">{t('start_time')}</label>
                                    <input type="time" className="w-full p-4 bg-slate-50 font-bold text-slate-700 rounded-2xl border-none outline-none focus:ring-2 focus:ring-teal-500" value={settings.timetable_start || '08:00'} onChange={e => setSettings({ ...settings, timetable_start: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest ml-1">Period (min)</label>
                                    <input type="number" className="w-full p-4 bg-slate-50 font-bold text-slate-700 rounded-2xl border-none outline-none focus:ring-2 focus:ring-teal-500" value={settings.timetable_duration || '45'} onChange={e => setSettings({ ...settings, timetable_duration: e.target.value })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest ml-1">Break After</label>
                                    <input type="number" className="w-full p-4 bg-slate-50 font-bold text-slate-700 rounded-2xl border-none outline-none focus:ring-2 focus:ring-teal-500" value={settings.timetable_break_after || '3'} onChange={e => setSettings({ ...settings, timetable_break_after: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-1.5 block tracking-widest ml-1">Break (min)</label>
                                    <input type="number" className="w-full p-4 bg-slate-50 font-bold text-slate-700 rounded-2xl border-none outline-none focus:ring-2 focus:ring-teal-500" value={settings.timetable_break_duration || '30'} onChange={e => setSettings({ ...settings, timetable_break_duration: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Grading Scale */}
                    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm relative">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t('grading_scale')}</h3>
                            <button
                                onClick={async () => {
                                    setSaving(true)
                                    try {
                                        await axios.post(`${apiUrl}/api/settings/grading`, { scales: gradingScale }, { headers: headers() })
                                        alert('Grading Scale saved successfully!')
                                    } catch (e) { alert('Error saving grading scale') }
                                    setSaving(false)
                                }}
                                disabled={saving}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition-all disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save Grading Scale'}
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-5 gap-3 text-[9px] font-black text-gray-400 uppercase tracking-widest px-2 pl-4">
                                <span>Grade</span><span>Min %</span><span>Max %</span><span>GPA</span><span></span>
                            </div>
                            {gradingScale.map((g, i) => (
                                <div key={i} className="grid grid-cols-5 gap-3 items-center">
                                    <input className="p-3 bg-slate-50 rounded-xl border-none outline-none text-center font-black text-slate-700 focus:ring-2 focus:ring-slate-400" placeholder="Grade" value={g.grade} onChange={e => { const n = [...gradingScale]; n[i].grade = e.target.value; setGradingScale(n) }} />
                                    <input type="number" className="p-3 bg-slate-50 rounded-xl border-none outline-none text-center font-bold text-slate-600 focus:ring-2 focus:ring-slate-400" placeholder="Min" value={g.minScore} onChange={e => { const n = [...gradingScale]; n[i].minScore = parseInt(e.target.value) || 0; setGradingScale(n) }} />
                                    <input type="number" className="p-3 bg-slate-50 rounded-xl border-none outline-none text-center font-bold text-slate-600 focus:ring-2 focus:ring-slate-400" placeholder="Max" value={g.maxScore} onChange={e => { const n = [...gradingScale]; n[i].maxScore = parseInt(e.target.value) || 0; setGradingScale(n) }} />
                                    <input type="number" step="0.1" className="p-3 bg-slate-50 rounded-xl border-none outline-none text-center font-bold text-slate-600 focus:ring-2 focus:ring-slate-400" placeholder="GPA" value={g.gpa} onChange={e => { const n = [...gradingScale]; n[i].gpa = parseFloat(e.target.value) || 0; setGradingScale(n) }} />
                                    <button 
                                        onClick={() => setGradingScale(gradingScale.filter((_, idx) => idx !== i))}
                                        className="text-red-400 hover:text-red-600 transition-colors p-2"
                                        title="Remove Row"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                            
                            <button 
                                onClick={() => setGradingScale([...gradingScale, { grade: '', minScore: 0, maxScore: 0, gpa: 0 }])}
                                className="w-full py-3 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 hover:border-slate-200 transition-all mt-4"
                            >
                                + {t('add_new_grade')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
