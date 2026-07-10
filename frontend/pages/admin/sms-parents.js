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

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        fetchClasses()
    }, [])

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
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Fariimaha Waalidiinta (Bulk SMS)</h2>
                        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">U dir fariimo wadar ah waalidiinta adoo isticmaalaya Golis SMS</p>
                    </div>
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

                                <div className="pt-6">
                                    <button
                                        type="submit"
                                        disabled={sending || !selectedClassId || !message}
                                        className={`w-full py-6 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.25em] transition-all flex items-center justify-center gap-4 shadow-xl ${
                                            sending 
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                            : 'bg-indigo-600 text-white hover:bg-slate-900 shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-1'
                                        }`}
                                    >
                                        {sending ? (
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
