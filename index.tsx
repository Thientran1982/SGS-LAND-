import './styles/globals.css';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; 
import { systemService } from './services/systemService';
import { copyToClipboard } from './utils/clipboard';
import { queueService } from './services/queueService';
import { aiService } from './services/aiService';
import { db } from './services/dbApi';

// Register Queue Handlers
queueService.registerHandler('SCORE_LEAD', async (payload: any) => {
    const { leadId, leadData, weights, lang } = payload;
    console.log(`[Queue Handler] Scoring lead ${leadId}...`);
    
    const aiScore = await aiService.scoreLead(leadData, undefined, weights, lang);
    
    // Update the lead in the mock database
    const lead = await db.getLeadById(leadId);
    if (lead) {
        lead.score = {
            score: aiScore.score,
            grade: aiScore.grade as any,
            reasoning: aiScore.reasoning
        };
        await db.updateLead(leadId, lead);
        console.log(`[Queue Handler] Lead ${leadId} scored successfully: ${aiScore.score}`);
    }
    
    return aiScore;
});

// Suppress specific Recharts warning about width/height 0
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('The width(0) and height(0) of chart should be greater than 0')) {
        return;
    }
    originalConsoleWarn(...args);
};

// -----------------------------------------------------------------------------
//  1. BOOTSTRAP LOCALIZATION (PRE-REACT)
//  Handles fatal errors before the full i18n provider loads.
// -----------------------------------------------------------------------------

const getSafeLang = () => {
    try {
        const saved = localStorage.getItem('sgs_lang');
        if (saved === 'en' || saved === 'vn') return saved;
        
        // System Language Check
        const sysLang = typeof navigator !== 'undefined' ? navigator.language : '';
        if (sysLang?.startsWith('en')) return 'en';
        
        return 'vn'; // Default to Vietnamese
    } catch { return 'vn'; }
};

const CRITICAL_MESSAGES = {
    vn: {
        FATAL_TITLE: "Lỗi Hệ Thống Nghiêm Trọng",
        FATAL_DESC: "Ứng dụng gặp sự cố không thể phục hồi trong quá trình khởi tạo.",
        CRASH_TITLE: "Ứng dụng đã dừng",
        CRASH_DESC: "Hệ thống phát hiện điều kiện bất thường và đã ngắt phiên làm việc để bảo vệ dữ liệu.",
        BTN_RELOAD: "Tải lại hệ thống",
        BTN_RESET: "Khôi phục cài đặt gốc",
        BTN_COPY: "Sao chép mã lỗi",
        BTN_COPIED: "Đã sao chép!",
        ERR_UNKNOWN: "Lỗi hệ thống không xác định",
        ERR_MISSING_ROOT: "Không tìm thấy phần tử gốc (Root Element)."
    },
    en: {
        FATAL_TITLE: "System Critical Failure",
        FATAL_DESC: "The application encountered an unrecoverable error during initialization.",
        CRASH_TITLE: "Application Halted",
        CRASH_DESC: "An unexpected condition has terminated the current session.",
        BTN_RELOAD: "Reload System",
        BTN_RESET: "Safe Factory Reset",
        BTN_COPY: "Copy Debug Info",
        BTN_COPIED: "Copied!",
        ERR_UNKNOWN: "Unknown System Error",
        ERR_MISSING_ROOT: "Root element missing."
    }
};

const lang = getSafeLang();
const TEXT = CRITICAL_MESSAGES[lang];

// -----------------------------------------------------------------------------
//  2. FATAL ERROR HANDLER (DOM API)
//  Uses direct DOM manipulation to render a "Glassmorphism" error screen
//  without relying on React context. Optimized for scrolling availability.
// -----------------------------------------------------------------------------

const renderFatalError = (message: string) => {
    const rootElement = document.getElementById('root');
    if (!rootElement) return;

    // Clear existing content safely
    while (rootElement.firstChild) {
        rootElement.removeChild(rootElement.firstChild);
    }

    // Container: Allow scrolling (overflow-y-auto) in case of small screens/long errors
    const container = document.createElement('div');
    container.className = "fixed inset-0 h-[100dvh] w-screen flex flex-col items-center justify-center bg-[var(--bg-app)] p-6 z-[9999] overflow-y-auto no-scrollbar";

    const card = document.createElement('div');
    card.className = "max-w-md w-full glass-card p-8 rounded-3xl border border-[var(--glass-border)] shadow-2xl text-center relative shrink-0 my-auto";

    // Alert Icon
    const iconWrapper = document.createElement('div');
    iconWrapper.className = "w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/20";
    iconWrapper.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;

    const title = document.createElement('h1');
    title.className = "text-xl font-bold text-[var(--text-primary)] mb-2";
    title.textContent = TEXT.FATAL_TITLE;

    const desc = document.createElement('p');
    desc.className = "text-xs text-[var(--text-secondary)] mb-6 leading-relaxed";
    desc.textContent = TEXT.FATAL_DESC;

    const codeBox = document.createElement('div');
    codeBox.className = "bg-black/5 dark:bg-black/30 p-4 rounded-xl text-left overflow-auto no-scrollbar max-h-48 mb-6 border border-black/5";
    
    const code = document.createElement('code');
    code.className = "text-[10px] font-mono text-rose-600 dark:text-rose-400 whitespace-pre-wrap break-words font-bold";
    code.textContent = message; // Safe text insertion

    const btn = document.createElement('button');
    btn.className = "px-6 py-3 bg-[var(--primary-600)] text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity w-full shadow-lg cursor-pointer";
    btn.textContent = TEXT.BTN_RELOAD;
    btn.onclick = () => window.location.reload();

    codeBox.appendChild(code);
    card.appendChild(iconWrapper);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(codeBox);
    card.appendChild(btn);
    container.appendChild(card);
    rootElement.appendChild(container);
};

// Global Error Listener for non-React errors (Script load errors, etc.)
window.addEventListener('error', (event) => {
    const root = document.getElementById('root');
    // Only hijack if the app hasn't mounted or is empty/loading
    if (!root || root.innerHTML.trim().length === 0 || root.querySelector('.initial-loader')) {
        renderFatalError(String(event.message));
    }
    console.error("[FATAL]", event.message, event.error);
});

// -----------------------------------------------------------------------------
//  3. REACT ERROR BOUNDARY (APPLICATION LAYER)
//  Catches rendering errors inside the React Tree.
// -----------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

// Fix: Use React.Component directly to resolve type inheritance issues
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    copied: false
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    try {
        // Safe logger call
        if (systemService && typeof systemService.log === 'function') {
            systemService.log('ERROR', 'CRASH_BOUNDARY_CATCH', { 
                name: error.name, 
                message: error.message, 
                stack: error.stack, 
                componentStack: errorInfo.componentStack
            }, undefined, 'SYSTEM');
        } else {
            console.error("SystemService unavailable during crash:", error);
        }
    } catch (e) {
        console.error("Logger failed during crash report", e);
    }
  }

  handleHardReset = () => {
      try {
          localStorage.clear();
          sessionStorage.clear();
          console.warn("Factory Reset Performed");
      } catch (e) { console.warn("Storage clear failed", e); }
      window.location.href = '/'; 
  }

  handleCopyError = async () => {
      if (this.state.error) {
          const debugInfo = `${this.state.error.toString()}\n\nSTACK:\n${this.state.error.stack}`;
          try {
              await copyToClipboard(debugInfo);
              this.setState({ copied: true });
              setTimeout(() => this.setState({ copied: false }), 2000);
          } catch (e) {
              console.error("Clipboard copy failed in ErrorBoundary", e);
          }
      }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--bg-app)] font-sans p-6 py-12 text-[var(--text-primary)] overflow-y-auto no-scrollbar">
          <div className="max-w-md w-full glass-card p-8 rounded-[32px] border border-[var(--glass-border)] shadow-2xl relative overflow-hidden animate-enter my-auto">
            
            {/* Visual Indicator */}
            <div className="flex flex-col items-center text-center mb-8 relative z-10">
                <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/20">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{TEXT.CRASH_TITLE}</h1>
                <p className="text-[var(--text-secondary)] text-xs mt-2 max-w-[250px] mx-auto leading-relaxed">{TEXT.CRASH_DESC}</p>
            </div>
            
            {/* Error Stack */}
            <div className="bg-slate-50 dark:bg-black/30 rounded-xl p-4 mb-8 relative group border border-slate-100 dark:border-white/5">
               <code className="text-[10px] font-mono text-rose-600 dark:text-rose-400 block whitespace-pre-wrap break-words max-h-48 overflow-y-auto no-scrollbar font-bold">
                   {this.state.error?.message || TEXT.ERR_UNKNOWN}
               </code>
               <button 
                   onClick={this.handleCopyError}
                   className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:text-indigo-500 transition-all opacity-0 group-hover:opacity-100 shadow-sm text-[10px] font-bold flex items-center gap-1"
                   aria-label="Copy Error"
                >
                   {this.state.copied ? (
                       <span className="text-emerald-500 font-bold">{TEXT.BTN_COPIED}</span>
                   ) : (
                       <span>{TEXT.BTN_COPY}</span>
                   )}
               </button>
            </div>
            
            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 relative z-10">
                <button 
                    onClick={() => window.location.reload()} 
                    className="flex justify-center items-center px-4 py-3 bg-[var(--text-primary)] text-[var(--bg-app)] rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg active:scale-95"
                >
                  {TEXT.BTN_RELOAD}
                </button>
                <button 
                    onClick={this.handleHardReset} 
                    className="flex-1 px-4 py-3 bg-transparent border border-[var(--glass-border)] text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-200 rounded-xl text-sm font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-95"
                    title="Clears local storage and reloads"
                >
                  {TEXT.BTN_RESET}
                </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// -----------------------------------------------------------------------------
//  4. ROOT MOUNTING
// -----------------------------------------------------------------------------

const mountApp = () => {
    const rootElement = document.getElementById('root');
    
    // 1. Check Root
    if (!rootElement) {
        const errDiv = document.createElement('div');
        errDiv.style.cssText = 'padding:20px;color:red;font-family:sans-serif;text-align:center';
        errDiv.textContent = TEXT.ERR_MISSING_ROOT;
        document.body.appendChild(errDiv);
        throw new Error(TEXT.ERR_MISSING_ROOT);
    }

    // 2. AI features are server-side only — no API key check needed on frontend

    try {
        if (!window.__sgsCrmRoot) {
            window.__sgsCrmRoot = ReactDOM.createRoot(rootElement);
        }
        window.__sgsCrmRoot.render(
          <React.StrictMode>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </React.StrictMode>
        );
    } catch (e) {
        console.error("Mounting failed", e);
        renderFatalError(String(e));
    }
};

// Extend window to hold the React root across HMR re-evaluations
declare global {
    interface Window { __sgsCrmRoot?: ReturnType<typeof ReactDOM.createRoot>; }
}

// Start
mountApp();