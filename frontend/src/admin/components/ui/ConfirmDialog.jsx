import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import './Modal.css';

/**
 * Reusable in-app confirmation dialog.
 * Replaces window.confirm() so it works in all environments (incl. automation).
 *
 * Props:
 *   isOpen      {bool}   - Whether the dialog is visible
 *   title       {string} - Bold heading text
 *   message     {string} - Description / body text
 *   confirmText {string} - Label for the confirm button (default: "Confirm")
 *   cancelText  {string} - Label for the cancel button  (default: "Cancel")
 *   onConfirm   {fn}     - Called when user clicks Confirm
 *   onCancel    {fn}     - Called when user clicks Cancel or X
 *   danger      {bool}   - If true, confirm button is styled as destructive red
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
    <div className="modal-overlay" id="confirm-dialog-overlay">
      <div className="modal" style={{ maxWidth: '420px' }} id="confirm-dialog">
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={20} style={{ color: danger ? '#ef4444' : '#f59e0b' }} />
            {title}
          </h2>
        </div>
        <div className="modal-content">
          <p style={{ margin: '0 0 20px 0', color: '#6b7280', lineHeight: '1.5' }}>{message}</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button
              id="confirm-dialog-cancel"
              variant="secondary"
              onClick={onCancel}
            >
              {cancelText}
            </Button>
            <Button
              id="confirm-dialog-confirm"
              variant="primary"
              onClick={onConfirm}
              style={danger ? { background: '#ef4444' } : {}}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
