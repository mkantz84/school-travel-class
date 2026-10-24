import React from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Description,
} from '@headlessui/react';
import { X, AlertTriangle } from 'lucide-react';

export default function Modal({ open, onClose, title, children }) {
  return (
    <Dialog open={!!open} onClose={onClose} className="relative z-50" dir="rtl">
      <DialogBackdrop className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <DialogPanel className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-visible transition-all">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <DialogTitle className="text-lg font-bold text-slate-800">{title}</DialogTitle>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title = 'אישור מחיקה',
  message = 'האם אתם בטוחים שברצונכם למחוק פריט זה?',
  confirmLabel = 'כן, למחוק',
  loading = false,
}) {
  return (
    <Dialog open={!!open} onClose={onClose} className="relative z-[70]" dir="rtl">
      <DialogBackdrop className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" />

      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <DialogPanel className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-sm p-6 space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <DialogTitle className="text-lg font-extrabold text-slate-800">
              {title}
            </DialogTitle>
            <Description className="text-sm text-slate-500 leading-relaxed">
              {message}
            </Description>
          </div>

          <div className="flex items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              ביטול
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm shadow-red-600/20 transition disabled:opacity-50"
            >
              {loading ? 'מוחק...' : confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
