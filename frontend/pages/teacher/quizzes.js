import Layout from '../../components/Layout'
import { useEffect, useState } from 'react'
import axios from 'axios'

export default function TeacherQuizzes() {
    const [quizzes, setQuizzes] = useState([])
    const [classes, setClasses] = useState([])
    const [sections, setSections] = useState([])
    const [subjects, setSubjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editingQuizId, setEditingQuizId] = useState(null)
    const [viewingResultQuiz, setViewingResultQuiz] = useState(null)
    
    // Quiz Form
    const [formData, setFormData] = useState({
        title: '',
        classId: '',
        sectionId: '',
        subjectId: '',
        duration: 30,
        questions: [{ question: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 }]
    })

    const [activeTab, setActiveTab] = useState('active') // active, history
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const getHeaders = () => ({ Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}` })

    useEffect(() => {
        fetchQuizzes()
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const [clsRes, subRes] = await Promise.all([
                axios.get(`${apiUrl}/api/classes`, { headers: getHeaders() }),
                axios.get(`${apiUrl}/api/subjects`, { headers: getHeaders() })
            ])
            
            // Flatten hierarchical classes for the teacher form
            const flattenedClasses = [];
            clsRes.data.forEach(c => {
                c.Sections.forEach(s => {
                    flattenedClasses.push({
                        classId: c.id,
                        class_name: c.class_name,
                        sectionId: s.id,
                        section: s.name,
                        shift: s.shift
                    });
                });
            });
            
            setClasses(flattenedClasses)
            setSubjects(subRes.data)
        } catch (e) { console.error(e) }
    }

    const fetchQuizzes = async () => {
        setLoading(true)
        try {
            const res = await axios.get(`${apiUrl}/api/elearning/quizzes`, { headers: getHeaders() })
            setQuizzes(res.data)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const handleEditQuiz = async (quiz) => {
        setLoading(true);
        try {
            const res = await axios.get(`${apiUrl}/api/elearning/quizzes/${quiz.id}`, { headers: getHeaders() });
            const data = res.data;
            const mappedQuestions = data.questions.map(q => {
                const opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
                return {
                    question: q.question,
                    options: opts,
                    correctAnswer: opts.indexOf(q.answer) !== -1 ? opts.indexOf(q.answer) : 0,
                    points: q.points || 1
                }
            });

            setFormData({
                title: data.title,
                classId: data.classId || '',
                sectionId: data.sectionId || '',
                subjectId: data.subjectId || '',
                duration: data.duration || 30,
                questions: mappedQuestions.length > 0 ? mappedQuestions : [{ question: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 }]
            });
            setEditingQuizId(quiz.id);
            setShowCreate(true);
        } catch (e) {
            alert('Error fetching quiz details');
        }
        setLoading(false);
    }

    const toggleQuizStatus = async (id, currentStatus) => {
        if (!confirm(`Are you sure you want to mark this quiz as ${currentStatus ? 'Ended' : 'Active'}?`)) return
        try {
            await axios.put(`${apiUrl}/api/elearning/quizzes/${id}/toggle-active`, { isActive: !currentStatus }, { headers: getHeaders() })
            fetchQuizzes()
        } catch (e) { alert('Failed to change quiz status') }
    }

    const deleteQuiz = async (id) => {
        if (!confirm('Ma hubtaa inaad tirtirto imtixaankan? Tani waxay tirtiri doontaa dhammaan xogta ardayda ee la xidhiidha!')) return
        try {
            await axios.delete(`${apiUrl}/api/elearning/quizzes/${id}`, { headers: getHeaders() })
            fetchQuizzes()
        } catch (e) { alert('Error deleting quiz') }
    }

    const handleViewResults = async (quiz) => {
        setLoading(true);
        try {
            const res = await axios.get(`${apiUrl}/api/elearning/quizzes/${quiz.id}`, { headers: getHeaders() });
            setViewingResultQuiz(res.data);
        } catch (e) {
            alert('Error fetching quiz results');
        }
        setLoading(false);
    }

    const handleAddQuestion = () => {
        setFormData({ ...formData, questions: [...formData.questions, { question: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 }] })
    }

    const handleQuestionChange = (index, field, value) => {
        const newQs = [...formData.questions]
        newQs[index][field] = value
        setFormData({ ...formData, questions: newQs })
    }

    const handleOptionChange = (qIndex, oIndex, value) => {
        const newQs = [...formData.questions]
        newQs[qIndex].options[oIndex] = value
        setFormData({ ...formData, questions: newQs })
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const submitData = { ...formData }
            if (submitData.sectionId === 'all') submitData.sectionId = '' // Backend handles empty string as null

            if (editingQuizId) {
                await axios.put(`${apiUrl}/api/elearning/quizzes/${editingQuizId}`, submitData, { headers: getHeaders() })
                alert('Quiz updated successfully!')
            } else {
                await axios.post(`${apiUrl}/api/elearning/quizzes`, submitData, { headers: getHeaders() })
                alert('Quiz created successfully!')
            }
            setShowCreate(false)
            setEditingQuizId(null)
            setFormData({ title: '', classId: '', sectionId: '', subjectId: '', duration: 30, questions: [{ question: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 }] })
            fetchQuizzes()
        } catch (e) { alert('Error saving quiz') }
        setSaving(false)
    }

    return (
        <Layout title="E-Learning Quizzes">
            {viewingResultQuiz && (
                <div className="absolute inset-0 bg-white z-50 p-8 min-h-screen animate-in fade-in slide-in-from-bottom-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">Results: {viewingResultQuiz.title}</h2>
                                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{viewingResultQuiz.results?.length} Submissions</p>
                            </div>
                            <button onClick={() => setViewingResultQuiz(null)} className="bg-slate-50 hover:bg-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">← Back to Quizzes</button>
                        </div>
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
                            {viewingResultQuiz.results?.length === 0 ? (
                                <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">No submissions yet</div>
                            ) : (
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">Student</th>
                                            <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">Score</th>
                                            <th className="p-6 text-xs font-black text-slate-400 uppercase tracking-widest">Percentage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewingResultQuiz.results.map((res, i) => {
                                            const percentage = (res.score / res.totalQuestions) * 100;
                                            return (
                                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-all">
                                                    <td className="p-6 font-bold text-slate-800">{res.student?.user?.name || 'Unknown Student'}</td>
                                                    <td className="p-6 font-bold text-slate-600">{res.score} / {res.totalQuestions}</td>
                                                    <td className="p-6">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${percentage >= 50 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                            {percentage.toFixed(0)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            <div className={`transition-all ${viewingResultQuiz ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Quiz Management</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Create and manage online assessments</p>
                </div>
                {!showCreate && (
                    <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-black text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 transition-all">+ New Quiz</button>
                )}
            </div>

            {showCreate ? (
                <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl mb-12 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-xl font-black text-slate-800">{editingQuizId ? 'Edit Assessment' : 'Create New Assessment'}</h3>
                        <button onClick={() => { setShowCreate(false); setEditingQuizId(null); setFormData({ title: '', classId: '', sectionId: '', subjectId: '', duration: 30, questions: [{ question: '', options: ['', '', '', ''], correctAnswer: 0, points: 1 }] }) }} className="bg-slate-50 p-3 px-6 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all font-bold text-slate-500">Cancel</button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Quiz Title (Ex: Mid-Term Exam)</label>
                                <input className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Class</label>
                                <select className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30" required value={formData.classId} onChange={e => {
                                    setFormData({ ...formData, classId: e.target.value, sectionId: '' })
                                }}>
                                    <option value="">Select Class</option>
                                    {Array.from(new Map(classes.map(c => [c.classId, c.class_name])).entries()).map(([id, name]) => (
                                        <option key={id} value={id}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Section</label>
                                <select className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30" required value={formData.sectionId} onChange={e => setFormData({ ...formData, sectionId: e.target.value })} disabled={!formData.classId}>
                                    <option value="">Select Section</option>
                                    {formData.classId && <option value="all" className="text-blue-600 font-black">All Sections (Dhammaan Qaybaha)</option>}
                                    {classes.filter(c => c.classId === formData.classId).map(c => (
                                        <option key={c.sectionId} value={c.sectionId}>{c.section} - {c.shift}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Subject</label>
                                <select className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30" required value={formData.subjectId} onChange={e => setFormData({ ...formData, subjectId: e.target.value })}>
                                    <option value="">Select Subject</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Duration (Minutes)</label>
                                <input type="number" className="w-full p-4 rounded-xl border-2 border-slate-50 focus:border-blue-500 outline-none font-bold text-slate-700 bg-slate-50/30" required value={formData.duration} onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        <div className="pt-8 border-t border-slate-100">
                            <h4 className="font-black text-slate-800 mb-6 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-sm">?</span>
                                Questions ({formData.questions.length})
                            </h4>

                            <div className="space-y-12">
                                {formData.questions.map((q, qIdx) => (
                                    <div key={qIdx} className="p-6 rounded-3xl border-2 border-slate-50 bg-slate-50/20">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Question {qIdx + 1}</span>
                                                <div className="flex items-center bg-blue-50/50 border border-blue-100 rounded-xl px-3 py-2 shadow-inner">
                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mr-2">Points:</span>
                                                    <input type="number" min="1" max="100" className="w-12 bg-transparent outline-none font-black text-slate-800 text-sm text-center" value={q.points || 1} onChange={e => handleQuestionChange(qIdx, 'points', parseInt(e.target.value) || 1)} />
                                                </div>
                                            </div>
                                            {formData.questions.length > 1 && (
                                                <button type="button" onClick={() => {
                                                    const newQs = formData.questions.filter((_, i) => i !== qIdx)
                                                    setFormData({ ...formData, questions: newQs })
                                                }} className="text-red-400 hover:text-red-600 px-3 py-2 rounded-lg hover:bg-red-50 text-[10px] font-black uppercase transition-all">Remove</button>
                                            )}
                                        </div>
                                        <input className="w-full p-4 rounded-xl border-2 border-white focus:border-orange-400 outline-none font-bold text-slate-700 bg-white mb-6 shadow-sm" placeholder="Enter question text..." required value={q.question} onChange={e => handleQuestionChange(qIdx, 'question', e.target.value)} />
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {q.options.map((opt, oIdx) => (
                                                <div key={oIdx} className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${q.correctAnswer === oIdx ? 'border-green-400 bg-green-50 shadow-md shadow-green-100' : 'border-slate-100 bg-slate-50'}`}>
                                                    <button type="button" onClick={() => handleQuestionChange(qIdx, 'correctAnswer', oIdx)}
                                                            className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-black transition-all ${q.correctAnswer === oIdx ? 'bg-green-500 text-white shadow-lg shadow-green-200 scale-105' : 'bg-white text-slate-400 border-2 border-slate-200 hover:border-slate-300'}`}>
                                                        {q.correctAnswer === oIdx ? '✓' : String.fromCharCode(65 + oIdx)}
                                                    </button>
                                                    <input className="flex-1 bg-transparent outline-none font-bold text-slate-700 text-sm" placeholder={`Option ${String.fromCharCode(65 + oIdx)}`} required value={opt} onChange={e => handleOptionChange(qIdx, oIdx, e.target.value)} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button type="button" onClick={handleAddQuestion} className="w-full mt-8 py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black uppercase text-[10px] tracking-widest hover:border-blue-400 hover:text-blue-500 transition-all">+ Add Another Question</button>
                        </div>

                        <button type="submit" disabled={saving} className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black shadow-2xl transition-all disabled:opacity-50">
                            {saving ? 'Saving System Quiz...' : (editingQuizId ? 'Update & Save Quiz' : 'Finalize & Publish Quiz')}
                        </button>
                    </form>
                </div>
            ) : (
                <>
                <div className="flex gap-4 mb-8">
                    <button onClick={() => setActiveTab('active')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Active Assessments ({quizzes.filter(q => q.isActive !== false).length})</button>
                    <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-slate-800 text-white shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>Assessment History ({quizzes.filter(q => q.isActive === false).length})</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        <div className="col-span-full text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Loading Assessments...</div>
                    ) : (activeTab === 'active' ? quizzes.filter(q => q.isActive !== false) : quizzes.filter(q => q.isActive === false)).length === 0 ? (
                        <div className="col-span-full bg-white p-20 rounded-[2rem] border border-dashed border-slate-200 text-center">
                            <div className="text-5xl mb-6">{activeTab === 'active' ? '📝' : '📚'}</div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">{activeTab === 'active' ? 'No Active Quizzes' : 'No Quiz History'}</h3>
                            <p className="text-slate-400 font-bold text-sm mb-8">{activeTab === 'active' ? 'Start by creating your first online assessment for your students.' : 'You have no ended or expired assessments.'}</p>
                            {activeTab === 'active' && <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all">+ Create First Quiz</button>}
                        </div>
                    ) : (activeTab === 'active' ? quizzes.filter(q => q.isActive !== false) : quizzes.filter(q => q.isActive === false)).map(q => (
                        <div key={q.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl shadow-slate-100 hover:scale-[1.02] transition-all group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="p-3 bg-slate-50 rounded-2xl text-xl">📝</div>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${q.isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{q.isActive ? 'Active' : 'Ended'}</span>
                            </div>
                            <h3 className="font-black text-slate-800 text-lg mb-2 group-hover:text-blue-600 transition-colors uppercase truncate">{q.title}</h3>
                            <div className="space-y-2 mb-8">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>📚</span> {q.subject?.name || 'All Subjects'}</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>👥</span> {q.clss?.class_name || q.section?.class?.class_name} ({q.section?.name || 'Dhammaan Qaybaha'})</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>⏱️</span> {q.duration} Minutes</div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest"><span>❓</span> {q._count?.questions} Questions</div>
                            </div>
                            
                            <div className="flex gap-2 mb-2">
                                <button onClick={() => handleViewResults(q)} className="flex-1 py-3 bg-slate-50 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Results</button>
                                <button onClick={() => handleEditQuiz(q)} className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all">Edit</button>
                                <button onClick={() => deleteQuiz(q.id)} className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-all">🗑️</button>
                            </div>
                            <button onClick={() => toggleQuizStatus(q.id, q.isActive !== false)} className={`w-full py-3 rounded-xl font-black text-[10px] text-center uppercase tracking-widest transition-all ${q.isActive !== false ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                                {q.isActive !== false ? 'Mark as Ended' : 'Mark as Active'}
                            </button>
                        </div>
                    ))}
                </div>
                </>
            )}
            </div>
        </Layout>
    )
}
