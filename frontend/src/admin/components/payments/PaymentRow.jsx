import { RotateCcw, Edit2, History } from 'lucide-react';
import Button from '../ui/Button';

const PaymentRow = ({ payment, onDelete, onEdit, onViewHistory }) => {
  const isGrouped = payment.isGrouped > 1;

  return (
    <tr>
      <td data-label="Date">{new Date(payment.date).toLocaleDateString('en-GB')}</td>
      <td data-label="Student">
        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          {payment.studentId?.studentName || payment.studentId?.name || 'Unknown'}
          {payment.studentId?.isActive === false && (
            <span style={{ fontSize: '9px', background: '#ffebee', color: '#d32f2f', padding: '1px 5px', borderRadius: '4px', fontWeight: 900, textTransform: 'uppercase' }}>
              Inactive
            </span>
          )}
        </div>
        {isGrouped && (
          <span style={{ fontSize: '10px', background: '#e0f2f1', color: '#00695c', padding: '2px 6px', borderRadius: '4px', fontWeight: 800, marginTop: '4px', display: 'inline-block' }}>
            {payment.isGrouped} Payments Combined
          </span>
        )}
      </td>
      <td data-label="Amount" className="amount">
        ₹{payment.amount.toLocaleString()}
        {payment.remainingFees > 0 && !isGrouped && (
          <div className="table-balance-hint">Due: ₹{payment.remainingFees}</div>
        )}
      </td>
      <td data-label="Method" className="method-col">
        <span className="method-badge">
          {isGrouped ? 'Mixed' : payment.method}
        </span>
      </td>
      <td data-label="Purpose" className="purpose-col">{isGrouped ? 'Multiple' : payment.purpose}</td>
      <td data-label="Actions">
        <div className="action-buttons">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => onViewHistory(payment.studentId?._id)}
            icon={History}
            title="View Payment History"
          >
            <span className="hide-mobile">History</span>
          </Button>

          {!isGrouped && (
            <div className="icon-actions-group">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => onEdit(payment)} 
                icon={Edit2} 
                title="Edit Payment"
              >
                <span className="hide-mobile">Edit</span>
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => onDelete(payment._id)} 
                icon={RotateCcw} 
                title="Mark as Unpaid"
              >
                <span className="hide-mobile">Revert</span>
              </Button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

export default PaymentRow;
