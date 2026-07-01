import Link from 'next/link'

export default function AcademicSettings() {
    const cards = [
        { label: 'Classes', href: '/admin/classes', icon: '🏫', desc: 'Manage classes and sections' },
        { label: 'Subjects', href: '/admin/subjects', icon: '📚', desc: 'Manage curriculum subjects' },
        { label: 'Examinations', href: '/admin/exams', icon: '📝', desc: 'Manage exams and schedules' },
        { label: 'Marks / Grades', href: '/admin/marks', icon: '📊', desc: 'Record and view student marks' },
    ]

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-10 text-center">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Academic Configurations</h2>
                <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-2">Core educational settings and records</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, i) => (
                    <Link key={i} href={card.href} className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-2xl hover:shadow-blue-50 hover:border-blue-100 transition-all group flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-slate-50 text-4xl rounded-3xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 group-hover:scale-110 shadow-inner group-hover:shadow-xl group-hover:shadow-blue-200">
                            {card.icon}
                        </div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight mb-2 group-hover:text-blue-600 transition-colors">{card.label}</h3>
                        <p className="text-slate-500 font-medium text-xs leading-relaxed">{card.desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    )
}
