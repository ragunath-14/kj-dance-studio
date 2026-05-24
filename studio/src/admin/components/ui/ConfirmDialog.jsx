import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

/**
 * Premium Reusable Confirmation Dialog.
 * Beautifully styled to work with modern web interfaces, replacing window.confirm().
 */
const ConfirmDialog = ({
  isOpen,
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="confirm-overlay" id="confirm-dialog-overlay">
      <div className="confirm-card" id="confirm-dialog">
        <div className={`confirm-icon-glow-wrapper ${danger ? 'danger' : 'warning'}`}>
          <AlertTriangle size={32} className="confirm-alert-icon" />
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions-row">
          <button
            id="confirm-dialog-cancel"
            className="confirm-btn-secondary"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            id="confirm-dialog-confirm"
            className={`confirm-btn-primary ${danger ? 'danger' : 'warning'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.85); /* Slate-900 glass backdrop */
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          animation: confirmFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .confirm-card {
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.96) 0%, rgba(15, 23, 42, 0.99) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 0, 0, 0.2);
          border-radius: 24px;
          padding: 32px 28px;
          width: 100%;
          max-width: 400px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          position: relative;
          overflow: hidden;
          animation: confirmPopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        /* Red/Danger and Amber/Warning glow themes */
        .confirm-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
        }
        .confirm-card:has(.danger)::before {
          background: linear-gradient(90deg, #ef4444, #f87171);
        }
        .confirm-card:has(.warning)::before {
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
        }

        .confirm-icon-glow-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          margin-bottom: 4px;
          position: relative;
        }

        .confirm-icon-glow-wrapper.danger {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #f87171;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.1);
          animation: pulseDanger 2s infinite alternate;
        }

        .confirm-icon-glow-wrapper.warning {
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.2);
          color: #fbbf24;
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.1);
          animation: pulseWarning 2s infinite alternate;
        }

        .confirm-alert-icon {
          filter: drop-shadow(0 0 8px currentColor);
        }

        .confirm-title {
          color: #ffffff !important;
          font-size: 1.35rem !important;
          font-weight: 800 !important;
          margin: 0 !important;
          letter-spacing: -0.02em !important;
          font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
        }

        .confirm-message {
          color: #94a3b8 !important; /* slate-400 */
          font-size: 0.95rem !important;
          line-height: 1.5 !important;
          margin: 0 !important;
          padding: 0 6px !important;
          font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
        }

        .confirm-actions-row {
          display: flex;
          width: 100%;
          gap: 12px;
          margin-top: 8px;
        }

        .confirm-btn-secondary {
          flex: 1;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1; /* slate-300 */
          padding: 12px 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
        }

        .confirm-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          transform: translateY(-1px);
        }

        .confirm-btn-secondary:active {
          transform: translateY(0);
        }

        .confirm-btn-primary {
          flex: 1;
          border: none;
          color: #ffffff;
          padding: 12px 16px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
        }

        .confirm-btn-primary.danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
        }

        .confirm-btn-primary.danger:hover {
          background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.4);
          transform: translateY(-1.5px);
        }

        .confirm-btn-primary.warning {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
          color: black;
        }

        .confirm-btn-primary.warning:hover {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
          transform: translateY(-1.5px);
        }

        .confirm-btn-primary:active {
          transform: translateY(0);
        }

        @keyframes confirmFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes confirmPopIn {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(15px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes pulseDanger {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4), 0 0 20px rgba(239, 68, 68, 0.1);
          }
          100% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0), 0 0 20px rgba(239, 68, 68, 0.25);
          }
        }

        @keyframes pulseWarning {
          0% {
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4), 0 0 20px rgba(245, 158, 11, 0.1);
          }
          100% {
            box-shadow: 0 0 0 8px rgba(245, 158, 11, 0), 0 0 20px rgba(245, 158, 11, 0.25);
          }
        }

        @media (max-width: 480px) {
          .confirm-actions-row {
            flex-direction: column;
            gap: 10px;
          }
          .confirm-btn-secondary,
          .confirm-btn-primary {
            width: 100%;
            padding: 14px 16px;
          }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
