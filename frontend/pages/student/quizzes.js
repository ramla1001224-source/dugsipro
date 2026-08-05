import Layout from '../../components/Layout'
import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'

export default function StudentQuizzes() {
    const [quizzes, setQuizzes] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeQuiz, setActiveQuiz] = useState(null)
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [answers, setAnswers] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState('active')
    const [result, setResult] = useState(null)
    const [timeLeft, setTimeLeft] = useState(0)
    const [subjectFilter, setSubjectFilter] = useState('all')

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}` }

    useEffect(() => { fetchAvailableQuizzes() }, [])

    const fetchAvailableQuizzes = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/elearning/quizzes`, { headers })
            setQuizzes(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const startQuiz = async (quiz) => {
        try {
            const res = await axios.get(`${apiUrl}/api/elearning/quizzes/${quiz.id}/take`, { headers })
            if (!res.data.questions || res.data.questions.length === 0) {
                alert('This quiz is empty. Please ask your teacher to add questions to it.')
                return
            }
            setActiveQuiz(res.data)
            setCurrentQuestion(0)
            setAnswers({})
            setResult(null)
            setTimeLeft(res.data.duration * 60)
        } catch (e) {
            if (e.response?.status === 403) alert('You have already completed this quiz.')
            else alert('Error loading quiz')
        }
    }

    useEffect(() => {
        if (activeQuiz && timeLeft > 0 && !result) {
            const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000)
            return () => clearTimeout(timer)
        } else if (activeQuiz && timeLeft === 0 && !result) {
            submitQuiz()
        }
    }, [activeQuiz, timeLeft, result])

    // Anti-cheat system: Auto submit if user leaves the tab
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && activeQuiz && !result && !submitting) {
                alert('Fadlan ha ka bixin bogga imtixaanka! Imtixaankii si toos ah ayaa loo gudbiyay (Auto-Submitted).')
                submitQuiz()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    }, [activeQuiz, result, submitting, answers])

    const submitQuiz = async () => {
        setSubmitting(true)
        try {
            const mappedAnswers = {}
            for (const [qId, idx] of Object.entries(answers)) {
                const qObj = activeQuiz.questions.find(q => q.id === qId)
                if (qObj) {
                    const parsedOptions = typeof qObj.options === 'string' ? JSON.parse(qObj.options) : qObj.options
                    mappedAnswers[qId] = parsedOptions[idx]
                }
            }
            const res = await axios.post(`${apiUrl}/api/elearning/quizzes/${activeQuiz.id}/submit`, { answers: mappedAnswers }, { headers })
            setResult(res.data)
        } catch (e) { alert('Error submitting quiz') }
        setSubmitting(false)
    }

    const handleReturnToDashboard = () => {
        setActiveQuiz(null)
        setResult(null)
        setSubjectFilter('all')
        fetchAvailableQuizzes()
    }

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s < 10 ? '0' : ''}${s}`
    }

    // ── Tab split ──
    const activeQuizzes = quizzes.filter(q => !q.results || q.results.length === 0)
    const historyQuizzes = quizzes.filter(q => q.results && q.results.length > 0)
    const tabQuizzes = activeTab === 'active' ? activeQuizzes : historyQuizzes

    // ── Unique subjects ──
    const subjects = useMemo(() => {
        const seen = new Set()
        return tabQuizzes.map(q => q.subject).filter(s => s && !seen.has(s.id) && seen.add(s.id))
    }, [tabQuizzes])

    // ── Filtered quizzes ──
    const displayQuizzes = useMemo(() => {
        if (subjectFilter === 'all') return tabQuizzes
        return tabQuizzes.filter(q => q.subject?.id === subjectFilter)
    }, [tabQuizzes, subjectFilter])

    const handleTabChange = (tab) => { setActiveTab(tab); setSubjectFilter('all') }

    const subjectColors = ['blue', 'violet', 'emerald', 'rose', 'amber', 'cyan', 'fuchsia', 'orange']
    const colorMap = {
        blue:    { active: 'bg-blue-600 text-white border-blue-600 shadow-blue-200',    idle: 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' },
        violet:  { active: 'bg-violet-600 text-white border-violet-600 shadow-violet-200', idle: 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100' },
        emerald: { active: 'bg-emerald-600 text-white border-emerald-600 shadow-emerald-200', idle: 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' },
        rose:    { active: 'bg-rose-600 text-white border-rose-600 shadow-rose-200',    idle: 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100' },
        amber:   { active: 'bg-amber-500 text-white border-amber-500 shadow-amber-200', idle: 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' },
        cyan:    { active: 'bg-cyan-600 text-white border-cyan-600 shadow-cyan-200',    idle: 'bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100' },
        fuchsia: { active: 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-fuchsia-200', idle: 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200 hover:bg-fuchsia-100' },
        orange:  { active: 'bg-orange-500 text-white border-orange-500 shadow-orange-200', idle: 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' },
    }

    // ══════════════════════════════════════
    // QUIZ TAKING SCREEN
    // ══════════════════════════════════════
    if (activeQuiz && !result) {
        const q = activeQuiz.questions[currentQuestion]
        return (
            <Layout title={`Taking Quiz: ${activeQuiz.title}`}>
                <div className="max-w-3xl mx-auto">
                    <div className="flex justify-between items-center mb-10 sticky top-20 bg-gray-50 py-4 z-10 border-b border-gray-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center font-black text-xl shadow-lg">
                                {currentQuestion + 1}
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 uppercase tracking-tight">{activeQuiz.title}</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Question {currentQuestion + 1} of {activeQuiz.questions.length}</p>
                            </div>
                        </div>
                        <div className={`px-6 py-3 rounded-2xl font-black text-xl shadow-xl transition-all ${timeLeft < 60 ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-slate-800 border-2 border-slate-100'}`}>
                            {formatTime(timeLeft)}
                        </div>
                    </div>

                    <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-2xl shadow-slate-100 mb-8">
                        <h4 className="text-2xl font-black text-slate-800 leading-tight mb-10">{q.question}</h4>
                        <div className="space-y-4">
                            {(typeof q.options === 'string' ? JSON.parse(q.options) : q.options || []).map((opt, idx) => (
                                <button key={idx} onClick={() => setAnswers({ ...answers, [q.id]: idx })}
                                    className={`w-full text-left p-6 rounded-3xl border-2 transition-all flex items-center gap-4 font-bold text-lg ${answers[q.id] === idx ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg shadow-blue-100 scale-[1.01]' : 'border-slate-50 hover:border-slate-200 text-slate-600 bg-slate-50/20'}`}>
                                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all ${answers[q.id] === idx ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                        {String.fromCharCode(65 + idx)}
                                    </span>
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between items-center gap-4">
                        <button disabled={currentQuestion === 0} onClick={() => setCurrentQuestion(currentQuestion - 1)}
                            className="flex-1 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-3xl font-black uppercase text-xs tracking-widest disabled:opacity-30 hover:bg-slate-50 transition-all">
                            ← Back
                        </button>
                        {currentQuestion < activeQuiz.questions.length - 1 ? (
                            <button onClick={() => setCurrentQuestion(currentQuestion + 1)}
                                className="flex-[2] py-5 bg-slate-800 text-white rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-black shadow-xl shadow-slate-200 transition-all">
                                Next Question →
                            </button>
                        ) : (
                            <button onClick={submitQuiz} disabled={submitting}
                                className="flex-[2] py-5 bg-green-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-green-700 shadow-xl shadow-green-200 transition-all animate-bounce">
                                {submitting ? 'Submitting...' : 'Finish & Submit Exam'}
                            </button>
                        )}
                    </div>
                </div>
            </Layout>
        )
    }

    // ══════════════════════════════════════
    // RESULT SCREEN
    // ══════════════════════════════════════
    if (result) {
        const percentage = (result.score / result.totalQuestions) * 100
        return (
            <Layout title="Exam Result">
                <div className="max-w-2xl mx-auto text-center py-12">
                    <div className="bg-white p-12 rounded-[4rem] border border-gray-100 shadow-2xl">
                        <div className={`w-32 h-32 rounded-full mx-auto flex items-center justify-center text-5xl mb-8 shadow-inner ${percentage >= 50 ? 'bg-green-100' : 'bg-red-100'}`}>
                            {percentage >= 50 ? '🎊' : '📉'}
                        </div>
                        <h2 className="text-3xl font-black text-slate-800 mb-2">Quiz Completed!</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-10">System Final Result</p>

                        <div className="grid grid-cols-2 gap-8 mb-12">
                            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                                <div className="text-3xl font-black text-slate-800 mb-1">{result.score} / {result.totalQuestions}</div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Points Earned</div>
                            </div>
                            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100">
                                <div className={`text-3xl font-black mb-1 ${percentage >= 50 ? 'text-green-600' : 'text-red-500'}`}>{percentage.toFixed(0)}%</div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Percentage</div>
                            </div>
                        </div>

                        <div className="p-6 rounded-3xl bg-blue-50 border border-blue-100 mb-10 text-left">
                            <h5 className="font-black text-blue-900 text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><span>🛡️</span> Teacher's Note</h5>
                            <p className="text-sm text-blue-700/70 font-medium leading-relaxed">System-kan wuxuu si otomaatig ah u calaamadeeyay dhibcahaaga. Macalinku wuu arki doonaa natiijadaada si uu u geliyo "Continuous Assessment (CA)".</p>
                        </div>

                        {result.grades && (
                            <div className="text-left mb-10 space-y-4">
                                <h4 className="font-black text-slate-800 text-lg mb-4">Detailed Breakdown</h4>
                                {result.grades.map((g, i) => (
                                    <div key={i} className={`p-6 rounded-2xl border-2 ${g.isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-bold text-slate-800">{i + 1}. {g.question}</div>
                                            <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${g.isCorrect ? 'bg-green-200/50 text-green-700' : 'bg-red-200/50 text-red-700'}`}>{g.isCorrect ? g.points : '0'} / {g.points} Pts</div>
                                        </div>
                                        <div className="text-sm font-medium text-slate-600 mb-1"><span className="font-black text-slate-800">Your Answer:</span> {g.studentAnswer} {g.isCorrect ? '✅' : '❌'}</div>
                                        {!g.isCorrect && <div className="text-sm font-medium text-green-600"><span className="font-black">Correct Answer:</span> {g.answer}</div>}
                                    </div>
                                ))}
                            </div>
                        )}

                        <button onClick={handleReturnToDashboard}
                            className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black shadow-2xl transition-all">
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </Layout>
        )
    }

    // ══════════════════════════════════════
    // QUIZ LIST SCREEN (with subject filter)
    // ══════════════════════════════════════
    return (
        <Layout title="E-Learning Quizzes">
            <div className="mb-8">
                <h2 className="text-2xl font-black text-slate-800">🎓 Online Assessments</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Take your scheduled quizzes and exams</p>
            </div>

            {/* ── Active / History tabs ── */}
            <div className="flex gap-4 mb-6">
                <button onClick={() => handleTabChange('active')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                    Active Quizzes ({activeQuizzes.length})
                </button>
                <button onClick={() => handleTabChange('history')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-slate-800 text-white shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                    Quiz History ({historyQuizzes.length})
                </button>
            </div>

            {/* ── Subject Filter ── */}
            {subjects.length > 0 && (
                <div className="mb-8 p-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">🎯 Shaandhayn Maadada</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setSubjectFilter('all')}
                            className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${subjectFilter === 'all'
                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                        >
                            🗂️ Dhammaan ({tabQuizzes.length})
                        </button>
                        {subjects.map((s, idx) => {
                            const col = subjectColors[idx % subjectColors.length]
                            const count = tabQuizzes.filter(q => q.subject?.id === s.id).length
                            const isActive = subjectFilter === s.id
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setSubjectFilter(isActive ? 'all' : s.id)}
                                    className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${isActive ? `${colorMap[col].active} shadow-lg` : colorMap[col].idle}`}
                                >
                                    {s.name} ({count})
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [1,2,3].map(i => <div key={i} className="bg-slate-50 rounded-[2rem] h-64 animate-pulse" />)
                ) : displayQuizzes.length === 0 ? (
                    <div className="col-span-full bg-white p-20 rounded-[2rem] border border-dashed border-slate-200 text-center">
                        <div className="text-5xl mb-6">{subjectFilter !== 'all' ? '🔍' : activeTab === 'active' ? '🎉' : '📚'}</div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">
                            {subjectFilter !== 'all'
                                ? `Ma jiro quiz ${subjects.find(s=>s.id===subjectFilter)?.name || ''} ah`
                                : activeTab === 'active' ? 'No Active Quizzes' : 'No Quiz History'}
                        </h3>
                        <p className="text-slate-400 font-bold text-sm mb-6">
                            {subjectFilter !== 'all' ? 'Dooro maado kale ama dhammaantood' : activeTab === 'active' ? "You're all caught up!" : "You haven't completed any quizzes yet."}
                        </p>
                        {subjectFilter !== 'all' && (
                            <button onClick={() => setSubjectFilter('all')} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 transition-all">
                                Dhammaantood Arag
                            </button>
                        )}
                    </div>
                ) : displayQuizzes.map(q => {
                    const hasTaken = q.results && q.results.length > 0
                    return (
                        <div key={q.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-slate-100 hover:scale-[1.02] transition-all group flex flex-col">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl text-xl">📝</div>
                                {hasTaken ? (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-600">Score: {q.results[0].score}/{q.results[0].totalQuestions}</span>
                                ) : (
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${q.isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{q.isActive ? 'Active' : 'Ended'}</span>
                                )}
                            </div>
                            <h3 className="font-black text-slate-800 text-lg mb-2 group-hover:text-blue-600 transition-colors uppercase truncate">{q.title}</h3>
                            <div className="space-y-2 mb-6 flex-1">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>📚</span> {q.subject?.name || 'All Subjects'}</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest line-clamp-1"><span>👨‍🏫</span> {q.teacher?.user?.name || 'Admin'}</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>⏱️</span> {q.duration} Minutes</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>❓</span> {q._count?.questions || q._count?.Questions || 0} Questions</div>
                            </div>
                            {activeTab === 'active' ? (
                                <button onClick={() => startQuiz(q)} className="w-full py-4 bg-blue-50 text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all mt-auto">
                                    Start Assessment Now
                                </button>
                            ) : (
                                <button disabled className="w-full py-4 bg-slate-50 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-not-allowed mt-auto">
                                    Assessment Closed
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </Layout>
    )
}
