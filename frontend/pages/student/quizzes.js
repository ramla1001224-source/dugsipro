import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function StudentQuizzes() {
    const [quizzes, setQuizzes] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeQuiz, setActiveQuiz] = useState(null)
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [answers, setAnswers] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState('active') // active, history
    const [result, setResult] = useState(null)
    const [timeLeft, setTimeLeft] = useState(0)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}` }

    useEffect(() => {
        fetchAvailableQuizzes()
    }, [])

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
                alert('This quiz is empty. Please ask your teacher to add questions to it.');
                return;
            }
            setActiveQuiz(res.data)
            setCurrentQuestion(0)
            setAnswers({})
            setResult(null)
            setTimeLeft(res.data.duration * 60)
        } catch (e) {
            if (e.response?.status === 403) {
                alert('You have already completed this quiz.');
            } else {
                alert('Error loading quiz');
            }
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

    const submitQuiz = async () => {
        setSubmitting(true)
        try {
            const mappedAnswers = {};
            for (const [qId, idx] of Object.entries(answers)) {
                const qObj = activeQuiz.questions.find(q => q.id === qId);
                if (qObj) {
                    const parsedOptions = typeof qObj.options === 'string' ? JSON.parse(qObj.options) : qObj.options;
                    mappedAnswers[qId] = parsedOptions[idx];
                }
            }

            const res = await axios.post(`${apiUrl}/api/elearning/quizzes/${activeQuiz.id}/submit`, {
                answers: mappedAnswers
            }, { headers })
            setResult(res.data)
        } catch (e) { alert('Error submitting quiz') }
        setSubmitting(false)
    }

    const handleReturnToDashboard = () => {
        setActiveQuiz(null)
        setResult(null)
        fetchAvailableQuizzes()
    }

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s < 10 ? '0' : ''}${s}`
    }

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

                    <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-2xl shadow-slate-100 mb-8 animate-in fade-in zoom-in-95 duration-300">
                        <h4 className="text-2xl font-black text-slate-800 leading-tight mb-10">{q.question}</h4>
                        
                        <div className="space-y-4">
                            {(typeof q.options === 'string' ? JSON.parse(q.options) : q.options || []).map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setAnswers({ ...answers, [q.id]: idx })}
                                    className={`w-full text-left p-6 rounded-3xl border-2 transition-all flex items-center gap-4 font-bold text-lg ${answers[q.id] === idx ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-lg shadow-blue-100 scale-[1.01]' : 'border-slate-50 hover:border-slate-200 text-slate-600 bg-slate-50/20'}`}
                                >
                                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all ${answers[q.id] === idx ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                        {String.fromCharCode(65 + idx)}
                                    </span>
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-between items-center gap-4">
                        <button 
                            disabled={currentQuestion === 0} 
                            onClick={() => setCurrentQuestion(currentQuestion - 1)}
                            className="flex-1 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-3xl font-black uppercase text-xs tracking-widest disabled:opacity-30 hover:bg-slate-50 transition-all"
                        >
                            ← Back
                        </button>
                        
                        {currentQuestion < activeQuiz.questions.length - 1 ? (
                            <button 
                                onClick={() => setCurrentQuestion(currentQuestion + 1)}
                                className="flex-[2] py-5 bg-slate-800 text-white rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-black shadow-xl shadow-slate-200 transition-all"
                            >
                                Next Question →
                            </button>
                        ) : (
                            <button 
                                onClick={submitQuiz}
                                disabled={submitting}
                                className="flex-[2] py-5 bg-green-600 text-white rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-green-700 shadow-xl shadow-green-200 transition-all animate-bounce"
                            >
                                {submitting ? 'Submitting...' : 'Finish & Submit Exam'}
                            </button>
                        )}
                    </div>
                </div>
            </Layout>
        )
    }

    if (!activeQuiz && !result) {
        const activeQuizzes = quizzes.filter(q => !q.results || q.results.length === 0);
        const historyQuizzes = quizzes.filter(q => q.results && q.results.length > 0);
        
        const displayQuizzes = activeTab === 'active' ? activeQuizzes : historyQuizzes;

        return (
            <Layout title="E-Learning Quizzes">
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-800">Online Assessments</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Take your scheduled quizzes and exams</p>
                </div>

                <div className="flex gap-4 mb-8">
                    <button onClick={() => setActiveTab('active')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Active Quizzes ({activeQuizzes.length})</button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-slate-800 text-white shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Quiz History ({historyQuizzes.length})</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Loading Assessments...</div>
                    ) : displayQuizzes.length === 0 ? (
                        <div className="col-span-full bg-white p-20 rounded-[2rem] border border-dashed border-slate-200 text-center">
                            <div className="text-5xl mb-6">{activeTab === 'active' ? '🎉' : '📚'}</div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">{activeTab === 'active' ? 'No Active Quizzes' : 'No Quiz History'}</h3>
                            <p className="text-slate-400 font-bold text-sm">
                                {activeTab === 'active' ? "You're all caught up! There are no pending assessments right now." : "You haven't completed any quizzes yet."}
                            </p>
                        </div>
                    ) : displayQuizzes.map(q => (
                        <div key={q.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-slate-100 hover:scale-[1.02] transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl text-xl">📝</div>
                                {q.results && q.results.length > 0 ? (
                                    <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-600">Score: {q.results[0].score}/{q.results[0].totalQuestions}</span>
                                ) : (
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${q.isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{q.isActive ? 'Active' : 'Ended'}</span>
                                )}
                            </div>
                            <h3 className="font-black text-slate-800 text-lg mb-2 group-hover:text-blue-600 transition-colors uppercase truncate">{q.title}</h3>
                            <div className="space-y-2 mb-8">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>📚</span> {q.subject?.name || 'All Subjects'}</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest line-clamp-1"><span>👨‍🏫</span> {q.teacher?.user?.name || 'Admin'}</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>⏱️</span> {q.duration} Minutes</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>❓</span> {q._count?.questions || q._count?.Questions || 0} Questions</div>
                            </div>
                            
                            {activeTab === 'active' ? (
                                <button onClick={() => startQuiz(q)} className="w-full py-4 bg-blue-50 text-blue-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Start Assessment Now</button>
                            ) : (
                                <button disabled className="w-full py-4 bg-slate-50 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest cursor-not-allowed">Assessment Closed</button>
                            )}
                        </div>
                    ))}
                </div>
            </Layout>
        )
    }

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
                                        {!g.isCorrect && (
                                            <div className="text-sm font-medium text-green-600"><span className="font-black">Correct Answer:</span> {g.answer}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <button 
                            onClick={handleReturnToDashboard} 
                            className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black shadow-2xl transition-all"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </Layout>
        )
    }

    return (
        <Layout title="My E-Learning Quizzes">
            <div className="mb-10">
                <h2 className="text-2xl font-black text-slate-800">Available Assessments</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Test your knowledge and track your progress</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {loading ? (
                    <div className="col-span-full text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Loading exam list...</div>
                ) : quizzes.length === 0 ? (
                    <div className="col-span-full bg-white p-20 rounded-[3rem] border border-dashed border-slate-200 text-center">
                        <div className="text-6xl mb-6">🏝️</div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">No Active Quizzes</h3>
                        <p className="text-slate-400 font-bold text-sm">Relax! There are no exams assigned to you at this moment.</p>
                    </div>
                ) : quizzes.map(q => {
                    const hasTaken = q.Results && q.Results.length > 0
                    return (
                        <div key={q.id} className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-xl shadow-slate-100 flex flex-col justify-between group h-full">
                            <div>
                                <div className="flex justify-between items-start mb-8">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-all duration-300">📝</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full bg-blue-50 text-blue-600">{q.subject?.name || 'All Subjects'}</div>
                                </div>
                                <h3 className="font-black text-slate-800 text-xl mb-4 leading-tight group-hover:text-blue-600 transition-all">{q.title}</h3>
                                
                                <div className="space-y-4 mb-10">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <span>👨‍🏫 Teacher</span>
                                        <span className="text-slate-800">{q.teacher?.user?.name || 'Admin'}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <span>⏱️ Duration</span>
                                        <span className="text-slate-800">{q.duration} Mins</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        <span>❓ Questions</span>
                                        <span className="text-slate-800">{q._count?.questions || q._count?.Questions || 0} Items</span>
                                    </div>
                                    {hasTaken && (
                                        <div className="flex items-center justify-between text-xs font-bold text-green-600 uppercase tracking-widest">
                                            <span>📉 Your Score</span>
                                            <span className="font-black text-base">{((q.Results[0].score / (q._count?.questions || q._count?.Questions || 1)) * 100).toFixed(0)}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {hasTaken ? (
                                <button className="w-full py-4 bg-slate-50 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest cursor-default">Exam Completed ✅</button>
                            ) : (
                                <button 
                                    onClick={() => startQuiz(q)}
                                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black shadow-xl shadow-blue-100 transition-all active:scale-95"
                                >
                                    Start Assessment Now
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>
        </Layout>
    )
}
