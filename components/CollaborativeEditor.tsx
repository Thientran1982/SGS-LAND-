import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { useTranslation } from '../services/i18n';

interface CollaborativeEditorProps {
    roomName: string;
    initialContent?: string;
    onChange?: (content: string) => void;
}

export const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({ roomName, initialContent = '', onChange }) => {
    const { t } = useTranslation();
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const [status, setStatus] = useState<string>('connecting');
    const ydocRef = useRef<Y.Doc | null>(null);
    const providerRef = useRef<WebsocketProvider | null>(null);
    const ytextRef = useRef<Y.Text | null>(null);

    useEffect(() => {
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        const wsUrl = window.location.protocol === 'https:' 
            ? `wss://${window.location.host}/yjs` 
            : `ws://${window.location.host}/yjs`;

        const provider = new WebsocketProvider(wsUrl, roomName, ydoc);
        providerRef.current = provider;

        const ytext = ydoc.getText('content');
        ytextRef.current = ytext;

        provider.on('status', (event: { status: string }) => {
            setStatus(event.status);
        });

        provider.on('sync', (isSynced: boolean) => {
            if (isSynced && ytext.toString() === '' && initialContent) {
                ytext.insert(0, initialContent);
            }
            if (editorRef.current) {
                editorRef.current.value = ytext.toString();
            }
        });

        ytext.observe(() => {
            if (editorRef.current) {
                const currentCursor = editorRef.current.selectionStart;
                editorRef.current.value = ytext.toString();
                editorRef.current.setSelectionRange(currentCursor, currentCursor);
                if (onChange) {
                    onChange(ytext.toString());
                }
            }
        });

        return () => {
            provider.disconnect();
            ydoc.destroy();
        };
    }, [roomName]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const ytext = ytextRef.current;
        if (!ytext) return;

        const newValue = e.target.value;
        const oldValue = ytext.toString();

        // Simple diffing for text area (in a real app, use Quill or ProseMirror bindings)
        if (newValue !== oldValue) {
            ytext.delete(0, ytext.length);
            ytext.insert(0, newValue);
        }
    };

    return (
        <div className="flex flex-col w-full h-full border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase">{t('editor.title')}</span>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    </span>
                    <span className="text-xs text-slate-500">{status === 'connected' ? t('editor.status_connected') : t('editor.status_connecting')}</span>
                </div>
            </div>
            <textarea
                ref={editorRef}
                onChange={handleInput}
                className="flex-1 w-full p-4 resize-none outline-none text-sm text-slate-700"
                placeholder={t('editor.placeholder') || 'Bắt đầu nhập nội dung hợp đồng...'}
            />
        </div>
    );
};
