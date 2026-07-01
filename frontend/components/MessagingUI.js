import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

export default function MessagingUI() {
    const [messages, setMessages] = useState([])
    const [users, setUsers] = useState([])
    const [selectedUser, setSelectedUser] = useState(null)
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const scrollRef = useRef()

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })
    const currentUserId = typeof window !== 'undefined' ? JSON.parse(atob(localStorage.getItem('token')?.split('.')[1] || 'e30='))?.id : null

    const fetchData = async () => {
        try {
            const [mRes, uRes] = await Promise.all([
                axios.get(`${apiUrl}/api/messages`, { headers: headers() }),
                axios.get(`${apiUrl}/api/users`, { headers: headers() })
            ])
            setMessages(mRes.data)
            setUsers(uRes.data.filter(u => u.id !== currentUserId))
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    useEffect(() => {
        fetchData()
        const interval = setInterval(fetchData, 60000) // Poll every 60s (reduced egress)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }, [messages, selectedUser])

    const sendMessage = async (e) => {
        e.preventDefault()
        if (!selectedUser || !content.trim()) return
        try {
            await axios.post(`${apiUrl}/api/messages`, { receiverId: selectedUser.id, content }, { headers: headers() })
            setContent('')
            fetchData()
        } catch (err) { alert('Error sending message') }
    }

    // Individual conversations
    const conversations = messages.reduce((acc, m) => {
        const otherUser = m.senderId === currentUserId ? m.receiver : m.sender
        if (!acc[otherUser.id]) acc[otherUser.id] = { user: otherUser, lastMessage: m }
        return acc
    }, {})

    const chatHistory = selectedUser
        ? messages.filter(m => (m.senderId === selectedUser.id && m.receiverId === currentUserId) || (m.senderId === currentUserId && m.receiverId === selectedUser.id))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        : []

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().startsWith(search.toLowerCase()) ||
        u.role.toLowerCase().startsWith(search.toLowerCase()) ||
        u.name.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
        const aStart = a.name.toLowerCase().startsWith(search.toLowerCase());
        const bStart = b.name.toLowerCase().startsWith(search.toLowerCase());
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;
        return a.name.localeCompare(b.name);
    });

    return (
        <div className="flex h-[calc(100vh-180px)] bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            {/* Sidebar: Conversations & Search */}
            <div className="w-80 border-r border-gray-50 flex flex-col bg-slate-50/30">
                <div className="p-6">
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full bg-white border-none rounded-2xl px-4 py-3 font-bold text-sm shadow-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
                    {search ? (
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-400 mb-3 ml-2 tracking-widest">Available Users</p>
                            {filteredUsers.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => { setSelectedUser(u); setSearch('') }}
                                    className="w-full text-left p-4 rounded-2xl hover:bg-white hover:shadow-md transition-all group flex items-center gap-3"
                                >
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-xs uppercase overflow-hidden">
                                        {u.name.substring(0, 2)}
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{u.name}</div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{u.role}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div>
                            <p className="text-[10px] font-black uppercase text-gray-400 mb-3 ml-2 tracking-widest">Recent Chats</p>
                            {Object.values(conversations).map(c => (
                                <button
                                    key={c.user.id}
                                    onClick={() => setSelectedUser(c.user)}
                                    className={`w-full text-left p-4 rounded-2xl transition-all flex items-center gap-3 ${selectedUser?.id === c.user.id ? 'bg-white shadow-lg border border-gray-100' : 'hover:bg-white hover:shadow-sm'}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-black text-xs uppercase overflow-hidden">
                                        {c.user.name.substring(0, 2)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-black text-slate-800 text-sm truncate">{c.user.name}</div>
                                        <div className="text-xs text-gray-400 truncate font-medium">{c.lastMessage.content}</div>
                                    </div>
                                    {c.lastMessage.receiverId === currentUserId && !c.lastMessage.isRead && (
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Main: Chat Area */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedUser ? (
                    <>
                        <div className="p-6 border-b border-gray-50 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-100 overflow-hidden">
                                {selectedUser.name.substring(0, 2)}
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{selectedUser.name}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{selectedUser.role}</span>
                                </div>
                            </div>
                        </div>

                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/20">
                            {chatHistory.map(m => (
                                <div key={m.id} className={`flex ${m.senderId === currentUserId ? 'justify-end' : 'justify-start'} gap-3 items-end`}>
                                    {m.senderId !== currentUserId && (
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-[10px] font-black overflow-hidden shadow-sm">
                                            {m.sender.name[0]}
                                        </div>
                                    )}
                                    <div className={`max-w-[70%] p-5 rounded-[2rem] shadow-sm text-sm font-bold tracking-tight ${m.senderId === currentUserId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none border border-gray-100'}`}>
                                        {m.content}
                                        <div className={`text-[9px] mt-2 font-black uppercase tracking-widest ${m.senderId === currentUserId ? 'text-blue-200' : 'text-gray-300'}`}>
                                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    {m.senderId === currentUserId && (
                                        <div className="w-8 h-8 rounded-full bg-blue-600 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-white overflow-hidden shadow-sm">
                                            {m.sender.name[0]}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <form onSubmit={sendMessage} className="p-6 border-t border-gray-50 flex gap-4 bg-white">
                            <input
                                className="flex-1 bg-gray-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                placeholder="Write your message here..."
                                value={content}
                                onChange={e => setContent(e.target.value)}
                            />
                            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-blue-100 transition-all transform hover:-translate-y-1">
                                SEND
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center text-gray-400">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">✉️</div>
                        <h3 className="text-xl font-black text-slate-300 uppercase tracking-[0.2em]">Select a contact</h3>
                        <p className="max-w-xs text-sm font-bold mt-2">Choose someone from the sidebar or search to start a new conversation.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
