import Layout from '../../components/Layout'
import Link from 'next/link'

export default function AcademicDashboard() {
    const cards = [
        { label: 'Academic Years & Terms', href: '/admin/academic-years', icon: '📅', desc: 'Maamul sanadaha waxbarashada iyo terms-kooda' },
        { label: 'Classes', href: '/admin/classes', icon: '🏫', desc: 'Manage classes and sections' },
        { label: 'Subjects', href: '/admin/subjects', icon: '📚', desc: 'Manage curriculum subjects' },
        { label: 'Timetable', href: '/admin/timetable', icon: '🗓️', desc: 'Schedule classes and teachers' },
        { label: 'Exam Scheduling', href: '/admin/exam-scheduling', icon: '📅', desc: 'Set exam dates and times before exams start' },
        { label: 'Examinations', href: '/admin/exams', icon: '📝', desc: 'Manage exams and results' },
        { label: 'Graduates', href: '/admin/alumni', icon: '🎓', desc: 'Manage alumni and graduated students' },
        { label: 'Marks / Grades', href: '/admin/marks', icon: '📊', desc: 'Record and view student marks' },
    ]

    return (
        <Layout title="Academic Management">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cards.map((card, i) => (
                    <Link key={i} href={card.href} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                        <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{card.icon}</div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">{card.label}</h3>
                        <p className="text-gray-500 text-sm">{card.desc}</p>
                    </Link>
                ))}
            </div>
        </Layout>
    )
}
