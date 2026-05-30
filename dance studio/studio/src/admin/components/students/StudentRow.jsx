import React, { useMemo, useState } from 'react';
import { Edit2, Trash2, CheckCircle, AlertCircle, ToggleLeft, ToggleRight, MessageCircle, History } from 'lucide-react';
import Button from '../ui/Button';

const StudentRow = ({ student, payments, onEdit, onDelete, onToggleStatus, onViewHistory }) => {
  const [toggling, setToggling] = useState(false);
  const isActive = student.isActive !== false; // default true for existing students

  const isPaid = useMemo(() => {
    const today = new Date();
    const getMonthlyFee = (classType) => classType === 'Fitness Class' ? 2500 : 3500;
    
    const rawJoinDate = student.createdAt || student.joinDate || new Date().toISOString();
    const joinDate = new Date(rawJoinDate);
    
    // Total cycles expected since joining (consistent with PaymentList)
    let totalCycles = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth()) + 1;
    if (today.getDate() < joinDate.getDate()) {
      totalCycles--;
    }

    if (totalCycles <= 0) return true;

    const totalPaid = student.totalPaid || 0;
    const fee = getMonthlyFee(student.classType);
    const totalExpected = totalCycles * fee;
    
    return totalPaid >= totalExpected;
  }, [student]);

  const handleToggle = async () => {
    setToggling(true);
    await onToggleStatus(student._id);
    setToggling(false);
  };

  return (
    <tr className={!isActive ? 'inactive-row' : ''}>
      <td data-label="Student">
        <div className="student-name-cell">
          <strong>{student.studentName || student.name}</strong>
          <div className="badge-row">
            {isActive ? (
              isPaid ? (
                <span className="mini-badge paid"><CheckCircle size={12} /> Paid</span>
              ) : (
                <span className="mini-badge unpaid"><AlertCircle size={12} /> Unpaid</span>
              )
            ) : (
              <span className="mini-badge inactive-badge">Inactive</span>
            )}
          </div>
        </div>
      </td>
      <td data-label="Contact">
        <div className="contact-info">
          {student.email && <span className="email">{student.email}</span>}
          <span className="phone">P: {student.phone}</span>
          {student.whatsappNumber && student.whatsappNumber !== student.phone && (
            <span className="phone">W: {student.whatsappNumber}</span>
          )}
        </div>
      </td>
      {student.classType === 'Fitness Class' && (
        <td data-label="Details">
          <div className="dance-info">
            {student.danceForFitness && <span className="fitness-tag">{student.danceForFitness}</span>}
            {!student.danceForFitness && <span className="text-muted">None</span>}
          </div>
        </td>
      )}
      <td data-label="Joined">
        <span className="join-date">
          {new Date(student.createdAt || student.joinDate).toLocaleDateString('en-GB')}
        </span>
      </td>
      <td data-label="Actions">
        <div className="action-buttons">
          <button 
            className={`status-toggle-btn ${isActive ? 'active' : 'inactive'}`}
            onClick={handleToggle}
            disabled={toggling}
            title={isActive ? 'Mark Inactive' : 'Mark Active'}
          >
            {toggling ? (
              <span className="toggle-spinner"></span>
            ) : isActive ? (
              <><ToggleRight size={16} /> Active</>
            ) : (
              <><ToggleLeft size={16} /> Inactive</>
            )}
          </button>
          <div className="icon-actions-group">
            <Button 
              variant="icon" 
              onClick={() => onEdit(student)} 
              icon={Edit2} 
              title="Edit Student Info" 
            />
            <Button 
              variant="icon" 
              onClick={() => onViewHistory(student)} 
              icon={History} 
              title="View Payment History" 
            />
            <Button 
              variant="icon" 
              className="delete" 
              onClick={() => onDelete(student._id)} 
              icon={Trash2} 
              title="Delete Student" 
            />
          </div>
        </div>
      </td>
    </tr>
  );
};


export default StudentRow;
