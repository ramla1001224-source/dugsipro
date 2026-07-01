import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

export default function AiChatUI({ role, title, icon }) {
    const [messages, setMessages] = useState([])
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(false)
    const scrollRef = useRef()

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

    useEffect(() => {
        // Load history from localStorage on mount
        const savedMessages = localStorage.getItem(`ai_chat_history_${role}`)
        if (savedMessages) {
            try {
                setMessages(JSON.parse(savedMessages))
            } catch (e) {
                console.error("Failed to parse saved AI messages")
            }
        }
    }, [role])

    useEffect(() => {
        // Save history to localStorage whenever it changes
        if (messages.length > 0) {
            localStorage.setItem(`ai_chat_history_${role}`, JSON.stringify(messages))
        }
    }, [messages, role])

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages, loading])

    const sendMessage = async (e) => {
        e.preventDefault()
        if (!content.trim() || loading) return

        const userMessage = { role: 'user', content: content.trim(), created_at: new Date() }
        setMessages(prev => [...prev, userMessage])
        setContent('')
        setLoading(true)

        try {
            const res = await axios.post(`${apiUrl}/api/ai/chat`, {
                message: userMessage.content,
                history: messages.slice(-10) // Send last 10 messages for context
            }, { headers: headers() })

            const aiMessage = { role: 'model', content: res.data.text, created_at: new Date() }
            setMessages(prev => [...prev, aiMessage])
        } catch (err) {
            setMessages(prev => [...prev, { role: 'model', content: 'Waan ka xumahay, cilad ayaa dhacday. Fadlan isku day markale.', created_at: new Date(), isError: true }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden relative">
            {/* Header */}
            <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-900/20">
                        {icon || '🤖'}
                    </div>
                    <div>
                        <h3 className="font-black text-white text-lg uppercase tracking-tight">{title || 'AI Assistant'}</h3>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active & Ready</span>
                        </div>
                    </div>
                </div>
                <div className="hidden md:block bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Powered by Gemini AI</p>
                </div>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-slate-50/30">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-10">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-xl border border-gray-50">👋</div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Soo dhowow!</h3>
                        <p className="max-w-sm text-sm text-slate-500 font-bold leading-relaxed">
                            Waxaan ahay caawiyahaaga AI. Sideen maanta kuu caawin karaa?
                        </p>
                    </div>
                )}
                
                {messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                        <div className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-white'}`}>
                                {m.role === 'user' ? 'U' : 'AI'}
                            </div>
                            <div className={`p-5 rounded-[2rem] text-sm font-bold tracking-tight shadow-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-gray-100 rounded-tl-none'}`}>
                                {m.content}
                                <div className={`text-[9px] mt-3 font-black uppercase tracking-widest opacity-40`}>
                                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-gray-100 p-5 rounded-[2rem] rounded-tl-none flex items-center gap-2">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-75"></div>
                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce delay-150"></div>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">AI is thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-6 bg-white border-t border-gray-100">
                <div className="flex gap-4 items-center max-w-5xl mx-auto">
                    <input
                        className="flex-1 bg-slate-100 border-none rounded-2xl px-6 py-4 font-bold text-slate-700 focus:ring-2 focus:ring-blue-600 transition-all outline-none"
                        placeholder="Halkan ku qor waxaad rabto..."
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        disabled={loading}
                    />
                    <button 
                        type="submit" 
                        disabled={loading || !content.trim()}
                        className="bg-slate-900 hover:bg-black disabled:bg-slate-300 text-white px-8 py-4 rounded-2xl font-black shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0"
                    >
                        {loading ? '...' : 'SEND'}
                    </button>
                </div>
            </form>
        </div>
    )
}
