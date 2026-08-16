import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import axios from 'axios'

export default function SMSParents() {
    const { t } = useLanguage()
    const [classes, setClasses] = useState([])
    const [selectedClassId, setSelectedClassId] = useState('')
    const [selectedSectionId, setSelectedSectionId] = useState('all')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [sections, setSections] = useState([])
    const [bulkSendInfo, setBulkSendInfo] = useState({ count: 0, limit: 2, remaining: 2, isLimitReached: false })

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchClasses()
        fetchBulkSendInfo()
    }, [])

    const fetchBulkSendInfo = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/sms/bulk-send-count`, { headers: headers() })
            setBulkSendInfo(res.data)
        } catch (err) {
            console.error('Could not fetch bulk send count:', err)
        }
    }

    const fetchClasses = async () => {
        try {
            const res = await axios.get(`${apiUrl}/api/classes`, { headers: headers() })
            setClasses(res.data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (selectedClassId) {
            const cls = classes.find(c => c.id === selectedClassId)
            setSections(cls?.Sections || [])
            setSelectedSectionId('all')
        } else {
            setSections([])
            setSelectedSectionId('all')
        }
    }, [selectedClassId, classes])

    const handleSendSMS = async (e) => {
        e.preventDefault()
        if (!selectedClassId || !message) {
            alert('Fadlan buuxi meelaha banaan!')
            return
        }

        // Client-side limit check
        if (bulkSendInfo.isLimitReached) {
            alert(`Xaddidaadka bishii waa la gaadhy! Waxaad diri kartaa oo keliya ${bulkSendInfo.limit} fariin oo Bulk ah bil kasta. Bisha soo socota ayaad dib u diri kartaa.`)
            return
        }

        let confirmMsg = ""
        if (selectedClassId === 'all') {
            confirmMsg = "Ma hubtaa inaad rabto inaad fariintan u dirto dhammaan waalidiinta dugsiga (All Parents)?"
        } else {
            confirmMsg = `Ma hubtaa inaad rabto inaad fariintan u dirto waalidiinta ${
                selectedSectionId === 'all' 
                ? 'dhammaan fasalka' 
                : 'qaybta gaarka ah'
            }?`
        }

        if (!confirm(confirmMsg)) return

        setSending(true)
        try {
            const res = await axios.post(`${apiUrl}/api/sms/bulk-parents`, {
                classId: selectedClassId,
                sectionId: selectedSectionId,
                message: message
            }, { headers: headers() })
            
            alert(res.data.message || 'SMS-ka waa la diray oo safka (queue) ayaa lagu daray.')
            setMessage('')
            // Refresh the monthly counter after a successful send
            fetchBulkSendInfo()
        } catch (err) {
            alert(err.response?.data?.message || 'Cillad ayaa dhacday intii SMS-ka la dirayay.')
        } finally {
            setSending(false)
        }
    }

    return (
        <Layout title="U dir SMS Waalidiinta">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-10">
                    <button 
                        onClick={() => window.history.back()}
                        className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all border border-slate-100"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex-1">
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Fariimaha Waalidiinta (Bulk SMS)</h2>
                        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">U dir fariimo wadar ah waalidiinta adoo isticmaalaya Golis SMS</p>
                    </div>
                    {/* Monthly Limit Badge */}
                    {!bulkSendInfo.isCustomApi && (
                        <div className={`flex flex-col items-center px-5 py-3 rounded-2xl border-2 font-black text-sm ${
                            bulkSendInfo.isLimitReached
                                ? 'bg-red-50 border-red-200 text-red-600'
                                : bulkSendInfo.count >= 1
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                            <span className="text-[10px] uppercase tracking-widest font-black opacity-70">Fariimo Bishii</span>
                            <span className="text-2xl leading-tight">{bulkSendInfo.count} <span className="text-base opacity-50">/ {bulkSendInfo.limit}</span></span>
                            <span className="text-[10px] uppercase tracking-widest">
                                {bulkSendInfo.isLimitReached ? '🔒 Xad la gaadhy' : `${bulkSendInfo.remaining} baqi`}
                            </span>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-[3rem] shadow-xl shadow-slate-100 border border-slate-50 overflow-hidden">
                    <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-black mb-2 flex items-center gap-3">
                                <span className="bg-indigo-600 p-2 rounded-xl text-lg">📩</span>
                                Fariin Cusub
                            </h3>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Dooro fasalka iyo section-ka kadibna qor fariinta</p>
                        </div>
                    </div>

                    <form onSubmit={handleSendSMS} className="p-10 space-y-8">
                        {loading ? (
                            <div className="flex justify-center p-20">
                                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Fasalka (Class)</label>
                                        <select
                                            required
                                            className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 bg-slate-50"
                                            value={selectedClassId}
                                            onChange={e => setSelectedClassId(e.target.value)}
                                        >
                                            <option value="">Dooro Fasalka</option>
                                            <option value="all" className="text-indigo-600 font-black">Dhammaan Waalidiinta (All Parents)</option>
                                            {classes.map(cls => (
                                                <option key={cls.id} value={cls.id}>{cls.class_name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Qaybta (Section)</label>
                                        <select
                                            className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 bg-slate-50"
                                            value={selectedSectionId}
                                            onChange={e => setSelectedSectionId(e.target.value)}
                                            disabled={!selectedClassId || selectedClassId === 'all'}
                                        >
                                            <option value="all">Dhammaan Qaybaha (All Sections)</option>
                                            {sections.map(sec => (
                                                <option key={sec.id} value={sec.id}>{sec.name} ({sec.shift})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 block">Fariinta (Message)</label>
                                    <textarea
                                        required
                                        rows={6}
                                        className="w-full p-8 rounded-[2.5rem] border-2 border-slate-100 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700 bg-slate-50 resize-none"
                                        placeholder="Halkan ku qor fariinta aad rabto inaad u dirto waalidiinta..."
                                        value={message}
                                        onChange={e => {
                                            const text = e.target.value;
                                            const hasUnicode = /[^\x00-\x7F]/.test(text);
                                            const limit = hasUnicode ? 70 : 160;
                                            if (text.length <= limit) {
                                                setMessage(text);
                                            }
                                        }}
                                    ></textarea>
                                    <div className="flex justify-between mt-3 px-4">
                                        <p className={`text-[10px] font-bold uppercase tracking-widest ${/[^\x00-\x7F]/.test(message) ? 'text-orange-500' : 'text-slate-400'}`}>
                                            Staad: {message.length} / {/[^\x00-\x7F]/.test(message) ? 70 : 160} Characters {/[^\x00-\x7F]/.test(message) && '(Emoji/Unicode)'}
                                        </p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qaybaha SMS: 1 Credit</p>
                                    </div>
                                </div>

                                {/* Monthly Limit Warning Banner */}
                                {bulkSendInfo.isLimitReached && (
                                    <div className="flex items-start gap-4 bg-red-50 border-2 border-red-100 rounded-3xl p-6">
                                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                        </div>
                                        <div>
                                            <p className="font-black text-red-700 text-sm">Xaddidaadka Bishii Waa La Gaadhy</p>
                                            <p className="text-red-500 text-xs mt-1 font-semibold">Waxaad diri kartaa oo keliya <strong>{bulkSendInfo.limit}</strong> fariin oo Bulk ah bil kasta. Bisha soo socota ayaad dib u diri kartaa.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="pt-6">
                                    <button
                                        type="submit"
                                        disabled={sending || !selectedClassId || !message || bulkSendInfo.isLimitReached}
                                        className={`w-full py-6 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.25em] transition-all flex items-center justify-center gap-4 shadow-xl ${
                                            bulkSendInfo.isLimitReached
                                            ? 'bg-red-100 text-red-300 cursor-not-allowed shadow-none'
                                            : sending 
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                            : 'bg-indigo-600 text-white hover:bg-slate-900 shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-1'
                                        }`}
                                    >
                                        {bulkSendInfo.isLimitReached ? (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                                <span>Xaddidaadka Waa La Gaadhy — Bisha Soo Socota Dib U Dir</span>
                                            </>
                                        ) : sending ? (
                                            <>
                                                <div className="w-5 h-5 border-3 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                                <span>Dirista waa socotaa...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Diri Fariinta (Send SMS)</span>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                </svg>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </form>
                </div>
            </div>
        </Layout>
    )
}
