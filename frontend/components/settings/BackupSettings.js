import { useState } from 'react'
import axios from 'axios'

export default function BackupSettings() {
    const [downloading, setDownloading] = useState(false)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    const handleDownload = async () => {
        setDownloading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/backup/export`, {
                headers: headers(),
                responseType: 'blob'
            })

            // Create local URL and trigger download
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `SmartSchool_Backup_${new Date().toISOString().split('T')[0]}.json`)
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (e) {
            alert('Error generating backup. Make sure you have admin privileges.')
        } finally {
            setDownloading(false)
        }
    }

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <div className="mb-10 text-center md:text-left">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Database & Security</h2>
                <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">Manage school data persistence and recovery</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Export Card */}
                <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col items-center text-center group hover:shadow-xl transition-all">
                    <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-4xl mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                        📥
                    </div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Full JSON Export</h3>
                    <p className="text-xs text-gray-400 font-medium leading-relaxed mb-8 max-w-[240px]">
                        Download a complete copy of students, teachers, classes, and financial records in a structured JSON format.
                    </p>
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className={`w-full py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg ${downloading ? 'bg-gray-100 text-gray-400' : 'bg-slate-900 text-white hover:bg-black shadow-slate-100'}`}
                    >
                        {downloading ? 'Generating...' : 'Download Backup'}
                    </button>
                </div>

                {/* Info Card */}
                <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col justify-center relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <span className="text-9xl">🛡️</span>
                    </div>
                    <h3 className="text-xl font-black uppercase tracking-tight mb-4 relative z-10">Data Protection</h3>
                    <ul className="space-y-4 relative z-10">
                        <li className="flex items-start gap-3">
                            <span className="text-blue-400 text-lg">✓</span>
                            <p className="text-xs text-slate-300 font-bold uppercase tracking-wide">Encrypted transmission during export</p>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-blue-400 text-lg">✓</span>
                            <p className="text-xs text-slate-300 font-bold uppercase tracking-wide">Daily automated system snapshots</p>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-blue-400 text-lg">✓</span>
                            <p className="text-xs text-slate-300 font-bold uppercase tracking-wide">GDPR & Privacy compliant data handling</p>
                        </li>
                    </ul>
                    <div className="mt-10 p-4 rounded-2xl bg-white/5 border border-white/10 relative z-10">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">
                            Warning: A backup file contains sensitive school information. Store it in a secure, encrypted location.
                        </p>
                    </div>
                </div>
            </div>

            <div className="mt-12 p-8 rounded-[2.5rem] bg-gray-50 border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-xl">📜</div>
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Last System Snapshot</h4>
                        <p className="text-sm font-black text-slate-800">Today, at 03:00 AM (Automatic)</p>
                    </div>
                </div>
                <button className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 transition-colors">View Audit Logs →</button>
            </div>
        </div>
    )
}
