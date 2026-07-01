import Layout from '../../components/Layout'
import Link from 'next/link'
import { useLanguage } from '../../context/LanguageContext'
import { useRouter } from 'next/router'

export default function StudentHub() {
    const { t } = useLanguage()
    const router = useRouter()

    const modules = [
        {
            title: 'Maamulka Ardayda',
            subtitle: 'Diiwaan-galinta iyo Maareynta',
            icon: '👨‍🎓',
            description: 'Halkaan ka maamul diiwaan-galinta ardayda cusub iyo kuwa hadda jira.',
            link: '/admin/students-manage',
            color: 'from-blue-500 to-indigo-600',
            shadow: 'shadow-blue-200'
        },
        {
            title: 'Xaadiriska Ardayda',
            subtitle: 'Maareynta Xaadiriska',
            icon: '📅',
            description: 'Halkaan kala soco xaadiriska maalinimada ah ee ardayda dugsiga.',
            link: '/admin/attendance',
            color: 'from-emerald-500 to-teal-600',
            shadow: 'shadow-emerald-200'
        },
        {
            title: 'Lacagaha Ardayda',
            subtitle: 'Finance & Payments',
            icon: '💰',
            description: 'Maaree bixinta lacagaha ardayda iyo warbixinada maaliyadda.',
            link: '/admin/fees',
            color: 'from-amber-500 to-orange-600',
            shadow: 'shadow-amber-200'
        }
    ]

    return (
        <Layout title="Xarunta Ardayda (Student Hub)">
            <div className="max-w-6xl mx-auto">
                <div className="mb-10">
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">
                        Xarunta Ardayda <span className="text-blue-600">Dugsi Pro System</span>
                    </h1>
                    <p className="text-slate-500 font-medium">Dooro qaybta aad rabto inaad ka shaqeyso si aad u bilowdo maamulka ardayda.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {modules.map((mod, i) => (
                        <Link key={i} href={mod.link}>
                            <div className={`group relative bg-white rounded-[2rem] p-8 transition-all duration-500 hover:-translate-y-2 border border-gray-100 shadow-xl ${mod.shadow} hover:shadow-2xl cursor-pointer overflow-hidden`}>
                                {/* Background Decorative Circle */}
                                <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${mod.color} opacity-5 rounded-full group-hover:scale-150 transition-transform duration-700`}></div>
                                
                                <div className={`w-16 h-16 bg-gradient-to-br ${mod.color} rounded-2xl flex items-center justify-center text-3xl shadow-lg mb-6 group-hover:scale-110 transition-transform duration-500`}>
                                    {mod.icon}
                                </div>

                                <div className="relative z-10">
                                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 bg-gradient-to-r ${mod.color} bg-clip-text text-transparent`}>
                                        {mod.subtitle}
                                    </p>
                                    <h3 className="text-xl font-black text-slate-800 mb-3 group-hover:text-blue-600 transition-colors">
                                        {mod.title}
                                    </h3>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-6">
                                        {mod.description}
                                    </p>
                                    
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400 group-hover:text-blue-600 transition-all">
                                        <span>Gudaha u gal</span>
                                        <svg className="w-5 h-5 translate-x-0 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Quick Info / Stats Section */}
                <div className="mt-16 bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-blue-600/20 to-transparent"></div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div>
                            <h2 className="text-2xl font-black mb-2">Ma u baahan tahay caawinaad?</h2>
                            <p className="text-slate-400 text-sm max-w-md">Xaruntan waxay kuu sahlaysaa inaad si degdeg ah ugu kala goshid qaybaha muhiimka ah ee nidaamka Dugsi Pro System.</p>
                        </div>
                        <button 
                            onClick={() => router.push('/admin/dashboard')}
                            className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm hover:bg-blue-50 transition-colors shadow-lg shadow-white/10"
                        >
                            Back to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    )
}
