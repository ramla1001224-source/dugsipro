import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function AdminSettings() {
    const [settings, setSettings] = useState({})
    const [gradingScale, setGradingScale] = useState([])
    const [gatewaySettings, setGatewaySettings] = useState({ provider: 'SAHAL', merchantUid: '', apiUserId: '', apiKey: '', isActive: false })
    const [smsSettings, setSmsSettings] = useState({ provider: 'generic', apiUrl: '', apiKey: '', senderId: 'DugsiPro', isActive: false })
    const [saving, setSaving] = useState(false)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        Promise.all([
            axios.get(`${apiUrl}/api/settings`, { headers: headers() }).catch(() => ({ data: {} })),
            axios.get(`${apiUrl}/api/settings/grading`, { headers: headers() }).catch(() => ({ data: [] })),
            axios.get(`${apiUrl}/api/payment-gateways`, { headers: headers() }).catch(() => ({ data: { provider: 'SAHAL', merchantUid: '', apiUserId: '', apiKey: '', isActive: false } })),
            axios.get(`${apiUrl}/api/sms/settings`, { headers: headers() }).catch(() => ({ data: { provider: 'generic', apiUrl: '', apiKey: '', senderId: 'DugsiPro', isActive: false } }))
        ]).then(([s, g, p, sms]) => {
            setSettings(s.data)
            setGradingScale(g.data.length ? g.data : [
                { grade: 'A', minScore: 90, maxScore: 100, gpa: 4.0 },
                { grade: 'B+', minScore: 80, maxScore: 89, gpa: 3.5 },
                { grade: 'B', minScore: 70, maxScore: 79, gpa: 3.0 },
                { grade: 'C+', minScore: 60, maxScore: 69, gpa: 2.5 },
                { grade: 'C', minScore: 50, maxScore: 59, gpa: 2.0 },
                { grade: 'D', minScore: 40, maxScore: 49, gpa: 1.0 },
                { grade: 'F', minScore: 0, maxScore: 39, gpa: 0 }
            ])
            if (p.data && p.data.provider) setGatewaySettings(p.data)
            if (sms.data) setSmsSettings(sms.data)
        })
    }, [])

    const saveSettings = async () => {
        setSaving(true)
        try {
            await axios.put(`${apiUrl}/api/settings`, settings, { headers: headers() })
            await axios.post(`${apiUrl}/api/settings/grading`, { scales: gradingScale }, { headers: headers() })
            await axios.post(`${apiUrl}/api/payment-gateways`, gatewaySettings, { headers: headers() })
            await axios.post(`${apiUrl}/api/sms/settings`, smsSettings, { headers: headers() })
            alert('Settings saved successfully!')
        } catch (e) { alert('Error saving settings') }
        setSaving(false)
    }

    const handleCleanup = async (type) => {
        const confirmMsg = type === 'zoom' 
            ? 'Ma hubtaa inaad tirtirto dhammaan taariikhda Zoom-ka? Arrintan dib looma soo celin karo.' 
            : 'Ma hubtaa inaad tirtirto dhammaan Homework-yada iyo faylasha ku xiran? Arrintan dib looma soo celin karo.';
        
        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await axios.delete(`${apiUrl}/api/settings/cleanup/${type}`, { headers: headers() });
            alert(res.data.message || 'Xogta si guul leh ayaa loo tirtiray.');
        } catch (err) {
            alert(err.response?.data?.message || 'Qalad ayaa dhacay xiligii tirtirista.');
        }
    }

    const settingFields = [
        { key: 'school_name', label: 'School Name', placeholder: 'Dugsi Pro Academy' },
        { key: 'school_motto', label: 'Motto', placeholder: 'Excellence in Education' },
        { key: 'tuition_fee', label: 'Tuition Fee ($)', placeholder: '50' },
        { key: 'school_address', label: 'Address', placeholder: '123 Education Street' },
        { key: 'school_phone', label: 'Phone', placeholder: '+1 234 567 8900' },
        { key: 'school_email', label: 'Email', placeholder: 'info@school.edu' },
        { key: 'principal_name', label: "Principal's Name", placeholder: 'Dr. John Smith' }
    ]

    return (
        <Layout title="Settings">
            <div className="flex justify-between items-center mb-8">
                <div><h2 className="text-2xl font-black text-slate-800">System Settings</h2><p className="text-gray-400 text-sm">Configure school profile and preferences</p></div>
                <button onClick={saveSettings} disabled={saving} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50">{saving ? 'Saving...' : 'Save All Settings'}</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">School Profile</h3>
                    <div className="space-y-4">
                        {settingFields.map(f => (
                            <div key={f.key}>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">{f.label}</label>
                                <input className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-slate-500 outline-none" placeholder={f.placeholder} value={settings[f.key] || ''} onChange={e => setSettings({ ...settings, [f.key]: e.target.value })} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><svg className="w-16 h-16 text-teal-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" /></svg></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Timetable Configuration</h3>
                    <div className="space-y-6">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Working Days</label>
                            <div className="flex flex-wrap gap-2">
                                {['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => {
                                    const workingDays = settings.timetable_days ? JSON.parse(settings.timetable_days) : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                    const isActive = workingDays.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            onClick={() => {
                                                const newDays = isActive ? workingDays.filter(d => d !== day) : [...workingDays, day];
                                                setSettings({ ...settings, timetable_days: JSON.stringify(newDays) });
                                            }}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${isActive ? 'bg-teal-50 border-teal-200 text-teal-600 shadow-sm' : 'bg-gray-50 border-transparent text-gray-400 hover:border-gray-200'}`}
                                        >
                                            {day.slice(0, 3)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Start Time</label>
                                <input type="time" className="w-full p-3 rounded-xl border" value={settings.timetable_start || '08:00'} onChange={e => setSettings({ ...settings, timetable_start: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Period Duration (min)</label>
                                <input type="number" className="w-full p-3 rounded-xl border" value={settings.timetable_duration || '45'} onChange={e => setSettings({ ...settings, timetable_duration: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Break After Period</label>
                                <input type="number" className="w-full p-3 rounded-xl border" value={settings.timetable_break_after || '3'} onChange={e => setSettings({ ...settings, timetable_break_after: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Break Duration (min)</label>
                                <input type="number" className="w-full p-3 rounded-xl border" value={settings.timetable_break_duration || '30'} onChange={e => setSettings({ ...settings, timetable_break_duration: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-6">Grading Scale</h3>
                    <div className="space-y-3">
                        <div className="grid grid-cols-4 gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">
                            <span>Grade</span><span>Min %</span><span>Max %</span><span>GPA</span>
                        </div>
                        {gradingScale.map((g, i) => (
                            <div key={i} className="grid grid-cols-5 gap-3 items-center">
                                <input className="p-2 rounded-lg border text-center font-bold" value={g.grade} onChange={e => { const n = [...gradingScale]; n[i].grade = e.target.value; setGradingScale(n) }} />
                                <input type="number" className="p-2 rounded-lg border text-center" value={g.minScore} onChange={e => { const n = [...gradingScale]; n[i].minScore = e.target.value; setGradingScale(n) }} />
                                <input type="number" className="p-2 rounded-lg border text-center" value={g.maxScore} onChange={e => { const n = [...gradingScale]; n[i].maxScore = e.target.value; setGradingScale(n) }} />
                                <input type="number" step="0.1" className="p-2 rounded-lg border text-center" value={g.gpa} onChange={e => { const n = [...gradingScale]; n[i].gpa = e.target.value; setGradingScale(n) }} />
                                <button onClick={() => setGradingScale(gradingScale.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600">✕</button>
                            </div>
                        ))}
                        <button 
                            onClick={() => setGradingScale([...gradingScale, { grade: '', minScore: 0, maxScore: 0, gpa: 0 }])}
                            className="w-full py-2 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 font-bold text-xs uppercase hover:bg-slate-50 transition-all"
                        >
                            + Add New Grade Row
                        </button>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-50 p-2 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Mobile Money API</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${gatewaySettings.isActive ? 'text-green-500' : 'text-gray-400'}`}>
                                {gatewaySettings.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <button
                                onClick={() => setGatewaySettings({ ...gatewaySettings, isActive: !gatewaySettings.isActive })}
                                className={`w-12 h-6 rounded-full transition-all relative ${gatewaySettings.isActive ? 'bg-green-500' : 'bg-gray-200'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${gatewaySettings.isActive ? 'right-1' : 'left-1'}`}></div>
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-6 uppercase font-black tracking-widest">Configure your payment gateway credentials</p>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Payment Provider</label>
                            <select 
                                className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700 appearance-none bg-slate-50 border-none"
                                value={gatewaySettings.provider || 'SAHAL'}
                                onChange={e => setGatewaySettings({ ...gatewaySettings, provider: e.target.value })}
                            >
                                <option value="SAHAL">Sahal (Golis)</option>
                                <option value="ZAAD">Zaad (Telesom)</option>
                                <option value="EDAHAB">E-Dahab (Dahabshiil)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Merchant UID</label>
                            <input className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" placeholder="M-12345" value={gatewaySettings.merchantUid || ''} onChange={e => setGatewaySettings({ ...gatewaySettings, merchantUid: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">API User ID</label>
                            <input className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" placeholder="USER-789" value={gatewaySettings.apiUserId || ''} onChange={e => setGatewaySettings({ ...gatewaySettings, apiUserId: e.target.value })} />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">API Secret Key</label>
                            <input type="password" title={gatewaySettings.apiKey} className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" placeholder="••••••••••••••••" value={gatewaySettings.apiKey || ''} onChange={e => setGatewaySettings({ ...gatewaySettings, apiKey: e.target.value })} />
                        </div>
                    </div>
                    <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 italic text-[10px] text-blue-600">
                        INFO: Macluumaadkan waxaa loo isticmaali doonaa in loogu diro waalidiinta fariinta USSD-ka ah marka ay lacagta bixinaying.
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-50 p-2 rounded-lg">
                                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">SMS Notification Service</h3>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${smsSettings?.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {smsSettings?.isActive ? '● Service Authorized' : '○ Service Restricted'}
                        </div>
                    </div>
                    
                    <p className="text-xs text-slate-400 mb-8 font-medium leading-relaxed">
                        {smsSettings?.isActive 
                            ? 'Your institutional node is authorized to dispatch automated notifications for attendance and exam results via the central ecosystem API.' 
                            : 'SMS services are currently restricted. Please contact the platform administrators to authorize notification provisioning for your school.'}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Messages Sent (Current Month)</p>
                            <p className="text-3xl font-black text-slate-800">{smsSettings?.monthlyCount || 0}</p>
                        </div>
                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100/50">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Sender Identity</p>
                            <p className="text-lg font-bold text-indigo-900">{smsSettings?.senderId || 'DugsiPro'}</p>
                        </div>
                    </div>

                    <div className="mt-8 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-[10px] text-blue-600 font-bold leading-relaxed flex gap-3">
                        <span className="text-lg">ℹ️</span>
                        <span>Fariimaha waxaa si otomaatig ah loogu diraa waalidiinta marka ardayga la calaamadiyo maqnaansho (Absent) ama marka natiijada imtixaanka la daabaco.</span>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-2xl border border-red-100 shadow-sm lg:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="bg-red-50 p-2 rounded-lg"><svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></div>
                        <h3 className="text-lg font-bold text-red-800">Data Maintenance (Nadiifinta Xogta)</h3>
                    </div>
                    <p className="text-sm text-gray-500 mb-8 font-medium">Ka saar xogta aan loo baahnayn si aad u badbaadiso bixitaanka iyo booska database-ka.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 rounded-2xl border border-gray-100 bg-slate-50/50">
                            <h4 className="font-bold text-slate-800 mb-2">Zoom Class History</h4>
                            <p className="text-xs text-gray-400 mb-6">Waxaad tirtiraysaa dhammaan taariikhda casharadii Zoom-ka ee hore. Tani database-ka ayay fududaynaysaa.</p>
                            <button 
                                onClick={() => handleCleanup('zoom')}
                                className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:border-red-200 hover:text-red-500 transition-all hover:bg-red-50"
                            >
                                Clear Zoom History
                            </button>
                        </div>
                        
                        <div className="p-6 rounded-2xl border border-gray-100 bg-slate-50/50">
                            <h4 className="font-bold text-slate-800 mb-2">Homework & Submissions</h4>
                            <p className="text-xs text-gray-400 mb-6">Waxaad tirtiraysaa dhammaan Homework-yada iyo faylasha ardaydu soo direen. Tani waxay badbaadinaysaa boos badan (Storage).</p>
                            <button 
                                onClick={() => handleCleanup('homework')}
                                className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:border-red-200 hover:text-red-500 transition-all hover:bg-red-50"
                            >
                                Clear Homework History
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
