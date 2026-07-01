import Layout from '../../components/Layout'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { useRouter } from 'next/router'

export default function ExamHub() {
    const { t } = useLanguage()
    const router = useRouter()
    const [role, setRole] = useState('')

    useEffect(() => {
        setRole(localStorage.getItem('role') || '')
    }, [])

    const modules = [
        {
            title: 'Maamulka Imtixaanka',
            subtitle: 'Exams Management',
            icon: '📝',
            description: 'Diiwaan-geli imtixaanada cusub iyo kuwa hadda socda.',
            link: '/admin/exams-manage',
            color: 'from-purple-500 to-indigo-600',
            shadow: 'shadow-purple-200'
        },
        {
            title: 'Jadwalka Imtixaanka',
            subtitle: 'Exam Scheduling',
            icon: '🗓️',
            description: 'Habeey waqtiyada iyo goobaha ay imtixaanadu dhacayaan.',
            link: '/admin/exam-scheduling',
            color: 'from-fuchsia-500 to-purple-600',
            shadow: 'shadow-fuchsia-200'
        },
        {
            title: 'Natiijada & Marks',
            subtitle: 'Marks & Results',
            icon: '📊',
            description: 'Geli dhibcaha ardayda oo hubi natiijooyinka dhamaadka.',
            link: '/admin/marks',
            color: 'from-blue-500 to-cyan-600',
            shadow: 'shadow-blue-200'
        },
        {
            title: 'Mark Sheet',
            subtitle: 'Xaanshida Natiijada',
            icon: '📄',
            description: 'Daabac xaanshida natiijada iyo dhibcaha ee ardayda.',
            link: '/admin/mark-sheet',
            color: 'from-emerald-500 to-teal-600',
            shadow: 'shadow-emerald-200'
        },
        {
            title: 'Results SMS',
            subtitle: 'Natiijada via SMS',
            icon: '💬',
            description: 'U dir natiijada imtixaanka waalidiinta si toos ah oo SMS ah.',
            link: '/admin/results-sms',
            color: 'from-orange-500 to-red-600',
            shadow: 'shadow-orange-200'
        },
        {
            title: 'Top 10 Rankings',
            subtitle: 'Xiddigaha Dugsiga',
            icon: '🏆',
            description: 'Arag 10-ka arday ee fasal kasta ugu sareeya dhibco ahaan.',
            link: '/admin/exams-rankings',
            color: 'from-amber-400 to-orange-500',
            shadow: 'shadow-amber-100'
        }
    ]

    const filteredModules = modules

    return (
        <Layout title="Xarunta Imtixaanada (Exam Hub)">
            <div className="max-w-6xl mx-auto">
                <div className="mb-10 lg:flex lg:items-center lg:justify-between">
                    <div className="max-w-xl">
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">
                            Xarunta Maamulka <span className="text-purple-600 font-black">Imtixaanada</span>
                        </h1>
                        <p className="text-slate-500 font-medium">Hal meel ka maamul wax kasta oo khuseeya imtixaanada, natiijooyinka, iyo jadwalka dugsiga.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredModules.map((mod, i) => (
                        <Link key={i} href={mod.link}>
                            <div className={`group relative bg-white rounded-[2.5rem] p-8 transition-all duration-500 hover:-translate-y-2 border border-gray-100 shadow-xl ${mod.shadow} hover:shadow-2xl cursor-pointer overflow-hidden`}>
                                {/* Background Decorative Circle */}
                                <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${mod.color} opacity-5 rounded-full group-hover:scale-150 transition-transform duration-700`}></div>
                                
                                <div className={`w-16 h-16 bg-gradient-to-br ${mod.color} rounded-2xl flex items-center justify-center text-3xl shadow-lg mb-6 group-hover:scale-110 transition-transform duration-500`}>
                                    {mod.icon}
                                </div>

                                <div className="relative z-10">
                                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 bg-gradient-to-r ${mod.color} bg-clip-text text-transparent`}>
                                        {mod.subtitle}
                                    </p>
                                    <h3 className="text-xl font-black text-slate-800 mb-3 group-hover:text-purple-600 transition-colors">
                                        {mod.title}
                                    </h3>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-6 h-12">
                                        {mod.description}
                                    </p>
                                    
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400 group-hover:text-purple-600 transition-all">
                                        <span>Maarey Qaybtan</span>
                                        <svg className="w-5 h-5 translate-x-0 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Info Card */}
                <div className="mt-16 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl border border-white/5">
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-purple-600/20 to-transparent"></div>
                    <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div>
                            <span className="bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-purple-500/30 mb-4 inline-block">Enterprise Tools</span>
                            <h2 className="text-2xl font-black mb-2">Ma u baahan tahay inaad hubiso imtixaanadii hore?</h2>
                            <p className="text-slate-400 text-sm max-w-md">Waxaad ka heli kartaa dhammaan xogta imtixaanadii hore qaybta 'Marks' iyo 'Mark Sheet' si fudud.</p>
                        </div>
                        <button 
                            onClick={() => router.push('/admin/dashboard')}
                            className="bg-white text-slate-900 px-10 py-5 rounded-2xl font-black text-sm hover:bg-purple-50 transition-all shadow-xl shadow-white/5 active:scale-95"
                        >
                            ⏎ Dashboard-ka ku noqo
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
