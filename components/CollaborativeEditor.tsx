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
    const initializedRef = useRef(false);

    useEffect(() => {
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        const wsUrl = window.location.protocol === 'https:'
            ? `wss://${window.location.host}/yjs`
            : `ws://${window.location.host}/yjs`;

        const provider = new WebsocketProvider(wsUrl, roomName, ydoc, {
            connect: false,
        });
        providerRef.current = provider;

        const ytext = ydoc.getText('content');
        ytextRef.current = ytext;

        // Initialize content immediately without waiting for WS sync
        if (initialContent && !initializedRef.current) {
            initializedRef.current = true;
            ytext.insert(0, initialContent);
        }
        if (editorRef.current) {
            editorRef.current.value = ytext.toString();
        }

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

        provider.on('status', (event: { status: string }) => {
            setStatus(event.status);
        });

        // Try connecting after local init
        try {
            provider.connect();
        } catch {
            // WS not available — run in offline mode
        }

        provider.on('sync', (isSynced: boolean) => {
            if (isSynced) {
                if (editorRef.current) {
                    editorRef.current.value = ytext.toString();
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

        if (newValue !== oldValue) {
            ytext.delete(0, ytext.length);
            ytext.insert(0, newValue);
        }
    };

    return (
        <div className="flex flex-col w-full h-full border border-[var(--glass-border)] rounded-xl overflow-hidden bg-[var(--bg-surface)]">
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--glass-surface)] border-b border-[var(--glass-border)]">
                <span className="text-xs font-bold text-[var(--text-tertiary)] uppercase">{t('editor.title')}</span>
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    </span>
                    <span className="text-xs text-[var(--text-tertiary)]">{status === 'connected' ? t('editor.status_connected') : t('editor.status_connecting')}</span>
                </div>
            </div>
            <textarea
                ref={editorRef}
                onChange={handleInput}
                className="flex-1 w-full p-4 resize-none outline-none text-sm text-[var(--text-secondary)]"
                placeholder={t('editor.placeholder') || 'Bắt đầu nhập nội dung hợp đồng...'}
            />
        </div>
    );
};
