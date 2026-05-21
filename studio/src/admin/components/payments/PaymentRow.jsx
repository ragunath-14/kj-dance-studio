import { RotateCcw, Edit2 } from 'lucide-react';
import Button from '../ui/Button';

const PaymentRow = ({ payment, onDelete, onEdit }) => {
  return (
    <tr>
      <td>{new Date(payment.date).toLocaleDateString('en-GB')}</td>
      <td>{payment.studentId?.studentName || payment.studentId?.name || 'Unknown'}</td>
      <td className="amount">
        ₹{payment.amount}
        {payment.remainingFees > 0 && (
          <div className="table-balance-hint">Due: ₹{payment.remainingFees}</div>
        )}
      </td>
      <td className="hide-mobile">
        <span className="method-badge">
          {payment.method}
        </span>
      </td>
      <td className="hide-mobile">{payment.purpose}</td>
      <td>
        <div className="action-buttons">
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
            <span className="hide-mobile">Mark as Unpaid</span>
          </Button>
        </div>
      </td>
    </tr>
  );
};

export default PaymentRow;
