import { useState, useEffect } from 'react'
import axios from 'axios'
import Layout from '../../components/Layout'
import { useLanguage } from '../../context/LanguageContext'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

export default function SystemErrors() {
    const { t } = useLanguage()
    const [systemErrors, setSystemErrors] = useState([])
    const [errorsLoading, setErrorsLoading] = useState(false)
    const [clearingErrors, setClearingErrors] = useState(false)
    const [expandedError, setExpandedError] = useState(null)
    const [success, setSuccess] = useState('')
    const [error, setError] = useState('')

    const headers = () => {
        const token = localStorage.getItem('token')
        return { 'Authorization': `Bearer ${token}` }
    }

    useEffect(() => {
        fetchSystemErrors()
    }, [])

    const fetchSystemErrors = async () => {
        setErrorsLoading(true)
        try {
            const res = await axios.get(`${API}/api/owner/system-errors`, { headers: headers() })
            setSystemErrors(res.data)
        } catch (e) {
            console.error('Failed to fetch system errors', e)
            setError('Failed to fetch system errors')
        } finally {
            setErrorsLoading(false)
        }
    }

    const deleteOneError = async (id) => {
        try {
            await axios.delete(`${API}/api/owner/system-errors/${id}`, { headers: headers() })
            setSystemErrors(prev => prev.filter(e => e.id !== id))
        } catch (e) {
            alert('Failed to delete error log')
        }
    }

    const clearAllErrors = async () => {
        if (!confirm(t('confirm_delete_all_logs') || 'Dhammaan khalaadaadka ma nadiifisaa?')) return
        setClearingErrors(true)
        try {
            await axios.delete(`${API}/api/owner/system-errors`, { headers: headers() })
            setSystemErrors([])
            setSuccess('✅ Dhammaan khalaadaadka waa la nadiifiyay')
            setTimeout(() => setSuccess(''), 3000)
        } catch (e) {
            setError('Failed to clear error logs')
            setTimeout(() => setError(''), 3000)
        } finally {
            setClearingErrors(false)
        }
    }

    return (
        <Layout title={t('system_logs')}>
            <div className="max-w-6xl mx-auto py-8">
                {/* Header Stats */}
                <div className="bg-slate-900 rounded-[2.5rem] p-10 mb-8 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20">
                    <div className="absolute top-0 right-0 p-10 opacity-10 text-9xl">⚠️</div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                            <span className="bg-rose-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">Live Monitoring</span>
                        </div>
                        <h1 className="text-4xl font-black tracking-tight mb-2">{t('manage_system_errors')}</h1>
                        <p className="text-slate-400 font-bold max-w-xl leading-relaxed">
                            Capture and manage critical system failures, unhandled exceptions, and performance alerts in real-time.
                        </p>
                    </div>
                </div>

                {/* Alerts */}
                {success && <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-xs uppercase tracking-widest border border-emerald-100 animate-in fade-in slide-in-from-top-2">{success}</div>}
                {error && <div className="mb-6 p-4 bg-rose-50 text-rose-700 rounded-2xl font-black text-xs uppercase tracking-widest border border-rose-100 animate-in fade-in slide-in-from-top-2">{error}</div>}

                {/* Action Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4 text-slate-800">
                        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-xl shadow-sm">📑</div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('status_label')}</p>
                            <p className="font-black">
                                {systemErrors.length > 0 ? `${systemErrors.length} Logs Captured` : 'System Clean'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchSystemErrors}
                            disabled={errorsLoading}
                            className="px-6 py-4 bg-white border border-slate-200 hover:border-blue-400 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all flex items-center gap-2 hover:shadow-xl hover:shadow-blue-500/5"
                        >
                            {errorsLoading ? '⏳' : '🔄'} {t('retry') || 'Cusboonaysii'}
                        </button>
                        {systemErrors.length > 0 && (
                            <button
                                onClick={clearAllErrors}
                                disabled={clearingErrors}
                                className="px-6 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20"
                            >
                                {clearingErrors ? '⏳ Cleaning...' : '🗑️ Clear All Logs'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                {errorsLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 bg-white border border-slate-100 rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : systemErrors.length === 0 ? (
                    <div className="bg-white border border-slate-100 border-dashed rounded-[3rem] py-24 text-center">
                        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl animate-bounce duration-1000">🛡️</div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">No Errors Detected</h3>
                        <p className="text-slate-400 font-bold max-w-sm mx-auto">
                            The system is currently running smoothly. No critical failures have been logged in the current cycle.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {systemErrors.map((err) => (
                            <div key={err.id} className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 group">
                                <div className="flex items-start gap-6 p-8">
                                    {/* Source badge */}
                                    <div className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest mt-1 shadow-sm
                                        ${ err.source === 'uncaught_exception' ? 'bg-red-600 text-white'
                                         : err.source === 'unhandled_rejection' ? 'bg-orange-500 text-white'
                                         : err.source === 'memory_alert' ? 'bg-purple-600 text-white'
                                         : 'bg-slate-900 text-white'}`}
                                    >
                                        {err.source || 'api'}
                                    </div>

                                    {/* Main content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <p className="font-black text-slate-900 text-lg leading-snug break-words">{err.message}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 font-bold">
                                            {err.method && err.path && (
                                                <span className="bg-slate-50 text-slate-600 px-3 py-1 rounded-lg font-mono border border-slate-100">
                                                    <span className="text-blue-500 mr-2">{err.method}</span> {err.path}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1.5">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                {new Date(err.timestamp).toLocaleString('so-SO')}
                                            </span>
                                            <span className="text-slate-300">|</span>
                                            <span className="font-mono text-slate-300">ID: {err.id}</span>
                                        </div>
                                        
                                        {err.stack && (
                                            <div className="mt-4">
                                                <button
                                                    onClick={() => setExpandedError(expandedError === err.id ? null : err.id)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                                >
                                                    {expandedError === err.id ? (
                                                        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg> Hide Stack Trace</>
                                                    ) : (
                                                        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg> View Full Stack Trace</>
                                                    )}
                                                </button>
                                                
                                                {expandedError === err.id && (
                                                    <div className="mt-4 bg-slate-950 rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-top-4 duration-300">
                                                        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Stack Trace Output</span>
                                                            <div className="flex gap-1.5">
                                                                <div className="w-2 h-2 rounded-full bg-rose-500/50"></div>
                                                                <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
                                                                <div className="w-2 h-2 rounded-full bg-emerald-500/50"></div>
                                                            </div>
                                                        </div>
                                                        <pre className="p-6 text-emerald-400 text-[11px] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap break-all selection:bg-emerald-500/20">
                                                            {err.stack}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Delete button */}
                                    <button
                                        onClick={() => deleteOneError(err.id)}
                                        className="flex-shrink-0 w-12 h-12 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-400 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm"
                                        title="Delete Log Entry"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}</style>
        </Layout>
    )
}
