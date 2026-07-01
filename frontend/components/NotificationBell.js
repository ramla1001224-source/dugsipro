import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { useRouter } from 'next/router'
import { useLanguage } from '../context/LanguageContext'

export default function NotificationBell() {
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [activeToast, setActiveToast] = useState(null)
    const lastSeenIdRef = useRef(null)
    const dropdownRef = useRef(null)
    const router = useRouter()
    const { t } = useLanguage()
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001'
    const soundUrl = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' // Clean bell sound

    useEffect(() => {
        // Initial fetch
        fetchUnreadCount(true)
        
        // Refresh every 30 seconds for a more "live" feel
        const interval = setInterval(() => fetchUnreadCount(false), 300000) // Poll every 5 minutes (reduced egress)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const playSound = () => {
        try {
            const audio = new Audio(soundUrl)
            audio.play().catch(e => console.log('Audio play blocked by browser policy'))
        } catch (e) {
            console.error('Error playing sound:', e)
        }
    }

    const fetchUnreadCount = async (isInitial = false) => {
        try {
            const token = localStorage.getItem('token')
            if (!token) return
            
            const res = await axios.get(`${apiUrl}/api/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            const latestNotifications = res.data
            const currentCount = latestNotifications.filter(n => n.status !== 'read').length
            setUnreadCount(currentCount)

            if (latestNotifications.length > 0) {
                const latestId = latestNotifications[0].id
                
                // If it's not the initial load and the latest ID is different from what we last saw
                if (!isInitial && lastSeenIdRef.current && latestId !== lastSeenIdRef.current) {
                    const newNotify = latestNotifications[0]
                    if (newNotify.status !== 'read') {
                        showToast(newNotify)
                        playSound()
                    }
                }
                lastSeenIdRef.current = latestId
            }
        } catch (e) {
            console.error('Error fetching unread count:', e)
        }
    }

    const showToast = (notification) => {
        setActiveToast(notification)
        // Auto-hide after 5 seconds
        setTimeout(() => setActiveToast(null), 5000)
    }

    const fetchNotifications = async () => {
        setLoading(true)
        try {
            const token = localStorage.getItem('token')
            const res = await axios.get(`${apiUrl}/api/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setNotifications(res.data)
        } catch (e) {
            console.error('Error fetching notifications:', e)
        }
        setLoading(false)
    }

    const toggleDropdown = () => {
        if (!isOpen) {
            fetchNotifications()
        }
        setIsOpen(!isOpen)
    }

    const markAsRead = async (id) => {
        try {
            const token = localStorage.getItem('token')
            await axios.put(`${apiUrl}/api/notifications/${id}/read`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setNotifications(notifications.map(n => n.id === id ? { ...n, status: 'read' } : n))
            fetchUnreadCount(true)
        } catch (e) {
            console.error('Error marking as read:', e)
        }
    }

    const getIcon = (type) => {
        switch (type) {
            case 'ANNOUNCEMENT': return '📢'
            case 'ATTENDANCE': return '📅'
            case 'EXAM': return '📝'
            case 'FEE': return '💰'
            case 'PAYMENT': return '💰'
            default: return '🔔'
        }
    }

    return (
        <div className="relative flex items-center" ref={dropdownRef}>
            {/* Live Toast Notification */}
            {activeToast && (
                <div 
                    onClick={() => { setActiveToast(null); toggleDropdown(); }}
                    className="fixed top-4 right-4 md:right-8 w-72 md:w-80 bg-white shadow-[0_20px_50px_rgba(8,_112,_184,_0.2)] border border-blue-100 rounded-2xl p-4 z-[100] animate-bounce-in cursor-pointer hover:scale-[1.02] transition-transform"
                >
                    <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">
                            {getIcon(activeToast.type)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{activeToast.title}</p>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{activeToast.message}</p>
                        </div>
                    </div>
                    <div className="absolute top-2 right-2">
                        <button onClick={(e) => { e.stopPropagation(); setActiveToast(null); }} className="text-slate-300 hover:text-slate-500 p-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>
            )}

            <button 
                onClick={toggleDropdown}
                className="relative p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all group"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] font-bold text-white items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden transform origin-top-right transition-all animate-fade-in">
                    <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-black text-slate-800 text-sm tracking-tight">{t('notifications')}</h3>
                        {unreadCount > 0 && (
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                {unreadCount} New
                            </span>
                        )}
                    </div>
                    
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                            </div>
                        ) : notifications.length > 0 ? (
                            <div className="divide-y divide-gray-50">
                                {notifications.map((n) => (
                                    <div 
                                        key={n.id} 
                                        onClick={() => markAsRead(n.id)}
                                        className={`p-4 hover:bg-blue-50/30 transition-colors cursor-pointer relative ${n.status !== 'read' ? 'bg-blue-50/10' : ''}`}
                                    >
                                        <div className="flex gap-3">
                                            <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-lg flex-shrink-0 border border-gray-100">
                                                {getIcon(n.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-bold text-slate-800 truncate ${n.status !== 'read' ? 'pr-3' : ''}`}>
                                                    {n.title}
                                                </p>
                                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                                    {n.message}
                                                </p>
                                                <p className="text-[9px] text-gray-400 mt-2 font-medium uppercase tracking-wider">
                                                    {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            {n.status !== 'read' && (
                                                <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full"></div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <div className="text-3xl mb-2">🔔</div>
                                <p className="text-sm font-bold text-slate-400">No notifications yet</p>
                            </div>
                        )}
                    </div>

                    <div className="p-3 border-t border-gray-50 bg-gray-50/50 text-center">
                        <button 
                            onClick={() => {
                                setIsOpen(false)
                                const role = localStorage.getItem('role') || 'admin'
                                router.push(`/${role}/notifications`)
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            View All Notifications
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes bounce-in {
                    0% { transform: scale(0.3); opacity: 0; }
                    50% { transform: scale(1.05); opacity: 1; }
                    70% { transform: scale(0.9); }
                    100% { transform: scale(1); }
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-bounce-in {
                    animation: bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out;
                }
            `}</style>
        </div>
    )
}
