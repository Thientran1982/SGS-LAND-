import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../services/i18n';
import { useSocket } from '../services/websocket';
import { db } from '../services/dbApi';
import { Lead, Interaction, Channel, Direction } from '../types';
import { MessageBubble } from '../components/ChatUI';
import { motion } from 'motion/react';

export default function LiveChat() {
    const { t } = useTranslation();
    const { socket } = useSocket();
    const [lead, setLead] = useState<Lead | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [messages, setMessages] = useState<Interaction[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load lead from localStorage if exists
    useEffect(() => {
        const savedLeadId = localStorage.getItem('livechat_lead_id');
        if (savedLeadId) {
            db.getLeadById(savedLeadId).then(l => {
                if (l) {
                    setLead(l);
                    db.getInteractions(l.id).then(msgs => setMessages(msgs || []));
                } else {
                    localStorage.removeItem('livechat_lead_id');
                }
            }).catch(() => {
                localStorage.removeItem('livechat_lead_id');
            });
        }
    }, []);

    useEffect(() => {
        if (!lead) return;
        socket.emit("join_room", lead.id);

        const handleNewMessage = (data: any) => {
            const msg: Interaction = data?.message ?? data;
            if (!msg || msg.leadId !== lead.id) return;
            setMessages(prev => {
                if (prev.find(m => m.id === msg.id)) return prev;
                return [...prev, msg];
            });
            setIsThinking(false);
        };

        socket.on("receive_message", handleNewMessage);
        return () => {
            socket.off("receive_message", handleNewMessage);
            socket.emit("leave_room", lead.id);
        };
    }, [lead, socket]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    const handleStartChat = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) return;

        const newLead = await db.createLead({
            name,
            phone,
            source: 'WEB',
            tags: ['Live Chat']
        });
        setLead(newLead);
        localStorage.setItem('livechat_lead_id', newLead.id);
        socket.emit("lead_created", newLead);

        // Send welcome message from system
        const welcomeMsg = await db.sendInteraction(newLead.id, t('livechat.welcome_msg', { name }) || `Xin chào ${name}, cảm ơn bạn đã liên hệ. Chúng tôi có thể giúp gì cho bạn?`, Channel.WEB, { type: 'TEXT', metadata: { isAgent: true } });
        setMessages([welcomeMsg]);
        socket.emit("send_message", { room: newLead.id, message: welcomeMsg });
    };

    const autoReplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleSend = async () => {
        if (!input.trim() || !lead) return;

        const content = input.trim();
        setInput('');

        // 1. Save customer message
        const msg = await db.sendInteraction(lead.id, content, Channel.WEB, { type: 'TEXT' });
        msg.direction = Direction.INBOUND;
        setMessages(prev => [...prev, msg]);
        socket.emit("send_message", { room: lead.id, message: msg });

        // 2. Auto-reply with cleanup on unmount
        setIsThinking(true);
        if (autoReplyTimerRef.current) clearTimeout(autoReplyTimerRef.current);
        autoReplyTimerRef.current = setTimeout(async () => {
            try {
                const aiMsg = await db.sendInteraction(lead.id, t('livechat.auto_reply') || `Cảm ơn bạn đã nhắn tin. Chuyên viên của chúng tôi sẽ phản hồi bạn trong giây lát. (Tin nhắn tự động)`, Channel.WEB, { type: 'TEXT', metadata: { isAgent: true } });
                setMessages(prev => [...prev, aiMsg]);
                socket.emit("send_message", { room: lead.id, message: aiMsg });
            } catch (_) {}
            setIsThinking(false);
        }, 2000);
    };

    useEffect(() => {
        return () => {
            if (autoReplyTimerRef.current) clearTimeout(autoReplyTimerRef.current);
        };
    }, []);

    if (!lead) {
        return (
            <div className="min-h-full w-full bg-slate-50 flex flex-col p-4 md:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto no-scrollbar">
                <div className="flex-1 min-h-[2rem]"></div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 md:p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100 mx-auto shrink-0">
                    <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-200">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2 leading-tight py-1">{t('livechat.title') || "Chat với chúng tôi"}</h1>
                    <p className="text-slate-500 mb-6 text-sm">{t('livechat.subtitle') || "Vui lòng để lại thông tin để chúng tôi hỗ trợ bạn tốt nhất."}</p>
                    
                    <form onSubmit={handleStartChat} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">{t('livechat.name_label') || "Họ và tên"}</label>
                            <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder={t('livechat.name_placeholder') || "Nhập tên của bạn"} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">{t('livechat.phone_label') || "Số điện thoại"}</label>
                            <input type="tel" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" placeholder={t('livechat.phone_placeholder') || "Nhập số điện thoại"} />
                        </div>
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md shadow-indigo-200 mt-2">
                            {t('livechat.start_chat') || "Bắt đầu Chat"}
                        </button>
                    </form>
                </motion.div>
                <div className="flex-1 min-h-[2rem]"></div>
            </div>
        );
    }

    return (
        <div className="h-full w-full bg-slate-50 flex flex-col max-w-2xl mx-auto shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-indigo-600 text-white p-4 flex items-center justify-between shadow-md z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-bold text-lg leading-tight truncate py-0.5">{t('livechat.support_online') || "Hỗ trợ trực tuyến"}</h2>
                        <div className="flex items-center gap-1.5 text-indigo-100 text-xs">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shrink-0"></span>
                            <span className="truncate">{t('livechat.we_are_online') || "Chúng tôi đang online"}</span>
                        </div>
                    </div>
                </div>
                <button onClick={() => { localStorage.removeItem('livechat_lead_id'); setLead(null); }} className="text-indigo-200 hover:text-white transition-colors text-xs font-bold bg-indigo-700/50 px-3 py-1.5 rounded-lg shrink-0 ml-2">
                    {t('livechat.end_chat') || "Kết thúc"}
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 bg-slate-50/50">
                {messages.map((msg, idx) => (
                    <MessageBubble 
                        key={msg.id} 
                        msg={msg} 
                        t={t} 
                        formatTime={(iso: string) => new Date(iso).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                        formatDate={(iso: string) => new Date(iso).toLocaleDateString()}
                        formatCurrency={(v: number) => v.toLocaleString() + 'đ'}
                        formatDateTime={(iso: string) => new Date(iso).toLocaleString()}
                        showDate={idx === 0 || new Date(msg.timestamp).getDate() !== new Date(messages[idx-1].timestamp).getDate()}
                    />
                ))}
                {isThinking && (
                    <div className="flex justify-start animate-pulse">
                        <div className="bg-white border border-indigo-100 text-indigo-600 px-4 py-3 rounded-2xl rounded-tl-none text-xs font-bold flex items-center gap-2 shadow-sm">
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></span>
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></span>
                            </div>
                            {t('livechat.replying') || "Đang trả lời..."}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white border-t border-slate-100 shrink-0">
                <div className="flex items-end gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                    <textarea 
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        className="flex-1 bg-transparent border-none text-sm outline-none max-h-32 min-h-[40px] py-2 px-2 resize-none placeholder:text-slate-400 no-scrollbar"
                        placeholder={t('livechat.input_placeholder') || "Nhập tin nhắn..."}
                        rows={1}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50 disabled:bg-slate-300 transition-colors"
                    >
                        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </button>
                </div>
                <div className="text-center mt-3 text-[10px] text-slate-400 font-medium">
                    {t('livechat.powered_by') || "Powered by"} <span className="font-bold text-slate-500">SGS Land AI</span>
                </div>
            </div>
        </div>
    );
}
