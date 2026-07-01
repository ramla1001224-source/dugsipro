import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell,
    AreaChart, Area
} from 'recharts'
import { useLanguage } from '../../context/LanguageContext'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

export default function Reports() {
    const { t } = useLanguage()
    const [data, setData] = useState({ incomeByClass: [], expenseByCategory: [], trends: [] })
    const [loading, setLoading] = useState(true)
    const [sessions, setSessions] = useState([])
    const [selectedSession, setSelectedSession] = useState('Current')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [activeFilter, setActiveFilter] = useState('custom')

    const formatDate = (date) => {
        const d = new Date(date)
        const month = '' + (d.getMonth() + 1)
        const day = '' + d.getDate()
        const year = d.getFullYear()
        return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-')
    }

    const handleFilterChange = (filter) => {
        setActiveFilter(filter)
        const today = new Date()
        let start = ''
        let end = ''

        if (filter === 'this_month') {
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
            const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
            start = formatDate(firstDay)
            end = formatDate(lastDay)
        } else if (filter === 'last_month') {
            const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
            const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
            start = formatDate(firstDay)
            end = formatDate(lastDay)
        } else if (filter === 'this_year') {
            const firstDay = new Date(today.getFullYear(), 0, 1)
            const lastDay = new Date(today.getFullYear(), 11, 31)
            start = formatDate(firstDay)
            end = formatDate(lastDay)
        } else if (filter === 'custom') {
            return
        }

        setFromDate(start)
        setToDate(end)
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        axios.get(`${apiUrl}/api/academic-years`, { headers: headers() })
            .then(res => setSessions(res.data))
            .catch(err => console.error(err))
    }, [])

    useEffect(() => {
        setLoading(true)
        const queryParams = []
        if (fromDate) queryParams.push(`fromDate=${fromDate}`)
        if (toDate) queryParams.push(`toDate=${toDate}`)
        if (selectedSession && selectedSession !== 'Current') queryParams.push(`session=${selectedSession}`)
        const queryString = queryParams.length ? `?${queryParams.join('&')}` : ''

        axios.get(`${apiUrl}/api/dashboard/charts${queryString}`, { headers: headers() })
            .then(res => {
                setData(res.data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setLoading(false)
            })
    }, [fromDate, toDate, selectedSession])

    if (loading) return <Layout title="Reports"><div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div></div></Layout>

    return (
        <Layout title="Financial Reports">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">Financial Analytics</h2>
                    <p className="text-gray-400 font-medium tracking-tight">Income vs Expense trends and breakdown</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200">
                    <div className="relative border-r border-gray-100 pr-2">
                        <select
                            value={selectedSession}
                            onChange={(e) => {
                                setSelectedSession(e.target.value)
                                // If switching session, reset custom dates to avoid confusion
                                setFromDate('')
                                setToDate('')
                                setActiveFilter('custom')
                            }}
                            className="appearance-none bg-transparent border-none text-blue-600 text-sm font-black pl-4 pr-10 py-2 outline-none cursor-pointer hover:bg-blue-50 rounded-lg transition-colors"
                        >
                            <option value="Current">Select Session...</option>
                            {sessions.map(s => <option key={s.id} value={s.name}>{s.name} {s.isCurrent ? '(Active)' : ''}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-blue-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    <div className="relative">
                        <select
                            value={activeFilter}
                            onChange={(e) => handleFilterChange(e.target.value)}
                            className="appearance-none bg-transparent border-none text-gray-700 text-sm font-semibold pl-4 pr-10 py-2 outline-none cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                            <option value="this_year">This Year</option>
                            <option value="custom">Custom Range...</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    {activeFilter === 'custom' && (
                        <div className="flex items-center gap-2 pr-2 animate-fadeIn">
                            <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-md px-2.5 py-1.5 outline-none focus:border-blue-500 transition-colors"
                            />
                            <span className="text-gray-400 text-sm">to</span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-md px-2.5 py-1.5 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Income by Class */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="text-base font-bold text-gray-800 mb-6">Income by Class</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.incomeByClass} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} tickFormatter={val => `$${val}`} />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Expense Breakdown */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                    <h3 className="text-base font-bold text-gray-800 mb-6">Expense Breakdown</h3>
                    <div className="h-80 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.expenseByCategory}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data.expenseByCategory.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Financial Trend */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h3 className="text-base font-bold text-gray-800 mb-6">6-Month Financial Trend</h3>
                <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 'bold' }} tickFormatter={val => `$${val}`} />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" name="Income" />
                            <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" name="Expense" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </Layout>
    )
}
