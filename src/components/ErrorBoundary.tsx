import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi gangguan tak terduga pada aplikasi.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  private formatReadableMessage(raw: string): string {
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed && typeof parsed === 'object' && parsed.error) {
        if (parsed.error.toLowerCase().includes('permission')) {
          return `Akses database ditolak (${parsed.operationType || 'read'} pada ${
            parsed.path || 'cloud'
          }). Pastikan Anda masuk dengan akun Google yang sesuai.`;
        }
        return parsed.error;
      }
    } catch {
      // Plain error message
    }
    return raw;
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-rose-500/40 p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-rose-400 shrink-0" />
            <div>
              <h1 className="font-display text-xl font-bold text-white">
                Terjadi Gangguan Sinkronisasi
              </h1>
              <p className="text-xs text-slate-400">
                Aplikasi tetap aman dan data lokal Anda tidak hilang.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-rose-200 break-words">
            {this.formatReadableMessage(this.state.message)}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Coba Lanjutkan
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Muat Ulang Halaman</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
