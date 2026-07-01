import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useLanguage } from '../../context/LanguageContext'

export default function Alumni() {
    const { t } = useLanguage()
    const [alumni, setAlumni] = useState([])
    const [filterOptions, setFilterOptions] = useState({ classes: [], years: [] })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedYear, setSelectedYear] = useState('')
    const [selectedClass, setSelectedClass] = useState('')
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'

    useEffect(() => {
        fetchAlumni()
    }, [search, selectedYear, selectedClass])

    const fetchAlumni = async () => {
        setLoading(true)
        try {
            const queryParams = new URLSearchParams()
            if (search) queryParams.append('search', search)
            if (selectedYear) queryParams.append('year', selectedYear)
            if (selectedClass) queryParams.append('className', selectedClass)

            const res = await axios.get(`${apiUrl}/api/students/alumni?${queryParams.toString()}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            })
            setAlumni(res.data.students || [])
            setFilterOptions(res.data.filterOptions || { classes: [], years: [] })
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    return (
        <Layout title="Graduated Students">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        🎓 Congratulations Graduates
                    </h2>
                    <p className="text-gray-400 font-medium tracking-tight mt-1">Celebrating our graduated students</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    {/* Class Filter */}
                    <div className="bg-white p-1 rounded-2xl shadow-sm border border-gray-100 flex items-center shrink-0">
                        <select
                            className="bg-transparent border-none px-4 py-2 outline-none text-sm font-semibold text-slate-700 w-full sm:w-auto cursor-pointer"
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                        >
                            <option value="">🏫 All Classes</option>
                            {filterOptions.classes.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year Filter */}
                    <div className="bg-white p-1 rounded-2xl shadow-sm border border-gray-100 flex items-center shrink-0">
                        <select
                            className="bg-transparent border-none px-4 py-2 outline-none text-sm font-semibold text-slate-700 w-full sm:w-auto cursor-pointer"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                        >
                            <option value="">📅 All Years</option>
                            {filterOptions.years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search Bar */}
                    <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center flex-1 lg:w-72">
                        <svg className="w-5 h-5 text-gray-400 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <input
                            type="text"
                            placeholder="Search graduates..."
                            className="w-full bg-transparent border-none px-3 py-1 outline-none text-sm font-semibold text-slate-700 placeholder-gray-400"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
                </div>
            ) : alumni.length === 0 ? (
                <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-gray-100">
                    <div className="text-6xl mb-4">📜</div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">No Graduates Found</h3>
                    <p className="text-slate-500 font-medium">There are currently no graduated students on record.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {alumni.map(student => (
                        <div key={student.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-100 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
                            <div className="absolute right-4 top-4 text-3xl">🎓</div>

                            <div className="flex items-center gap-4 mb-4 mt-2">
                                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-orange-400 to-yellow-400 flex items-center justify-center text-white font-black text-xl shadow-lg">
                                    {student.user?.name?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 leading-tight">{student.user?.name}</h3>
                                    <p className="text-xs font-bold text-gray-400 mt-1">{student.student_id}</p>
                                </div>
                            </div>

                                <div className="flex flex-col items-end gap-1">
                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                        Graduated
                                    </span>
                                    {student.graduationYear && (
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {student.graduationYear}
                                        </span>
                                    )}
                                </div>
                        </div>
                    ))}
                </div>
            )}
        </Layout>
    )
}
