import React, { useState } from 'react';
import axios from 'axios';
import { Plus, Search, Check, Bell, History, X, CreditCard, Calendar, TrendingDown } from 'lucide-react';
import API_URL from '../config';
import { useData } from '../context/DataContext';
import PaymentRow from './payments/PaymentRow';
import PaymentForm from './payments/PaymentForm';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import Button from './ui/Button';
import SkeletonRow from './ui/SkeletonRow';
import Pagination from './ui/Pagination';
import './List.css';

import PaymentHistoryModal from './payments/PaymentHistoryModal';

const PaymentList = () => {
  const { payments, unpaidStudents: serverUnpaid, allStudents, stats, loading, refreshData, fetchPayments, fetchUnpaidStudents } = useData();
  const [activeTab, setActiveTab] = useState('paid');
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    studentId: '', amount: '', method: 'Cash', purpose: 'Monthly Fee', date: '', remainingFees: 0
  });
  const [currentDebt, setCurrentDebt] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingOriginalAmount, setEditingOriginalAmount] = useState(0);
  const [alertState, setAlertState] = useState({ loading: false, message: '', type: '', results: [] });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, paymentId: null });
  const [confirmAlerts, setConfirmAlerts] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [limit, setLimit] = useState(50);

  // Server-side fetching when page or tab changes
  const onPageChange = (page) => {
    if (activeTab === 'paid') {
      fetchPayments(page, limit);
    } else {
      fetchUnpaidStudents(page, limit);
    }
  };

  const onLimitChange = (newLimit) => {
    setLimit(newLimit);
    if (activeTab === 'paid') {
      fetchPayments(1, newLimit);
    } else {
      fetchUnpaidStudents(1, newLimit);
    }
  };

  const paginatedPayments = payments.data || [];
  const paginatedUnpaid = serverUnpaid.data || [];

  const totalPages = activeTab === 'paid' 
    ? (payments.totalPages || 1)
    : (serverUnpaid.totalPages || 1);
    
  const currentPage = activeTab === 'paid' ? (payments.page || 1) : (serverUnpaid.page || 1);

  React.useEffect(() => {
    onPageChange(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, activeTab]);

  // Clear alert banner when switching tabs
  React.useEffect(() => {
    setAlertState({ loading: false, message: '', type: '', results: [] });
  }, [activeTab]);

  const handleSendAlerts = () => setConfirmAlerts(true);

  const executeSendAlerts = async () => {
    setConfirmAlerts(false);
    setAlertState({ loading: true, message: '', type: '', results: [] });
    try {
      const res = await axios.post(`${API_URL}/payments/send-pending-alerts`);
      const data = res.data;
      setAlertState({ loading: false, message: data.message, type: 'success', results: data.results || [] });
    } catch (err) {
      setAlertState({ loading: false, message: err.response?.data?.message || 'Failed to trigger alert job.', type: 'error', results: [] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/payments/${editingId}`, formData);
      } else {
        await axios.post(`${API_URL}/payments`, formData);
      }
      await refreshData();
      setActiveTab('paid');
      closeModals();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save payment.');
    }
  };

  const handlePay = (student) => {
    setCurrentDebt(student.totalDue);
    setFormData({
      studentId: student._id, amount: student.totalDue, method: 'Cash', 
      purpose: 'Monthly Fee', date: new Date().toISOString().split('T')[0], remainingFees: 0
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const handleQuickPay = async (student) => {
    try {
      await axios.post(`${API_URL}/payments`, {
        studentId: student._id,
        amount: student.totalDue || (student.classType === 'Fitness Class' ? 2500 : 3500),
        method: 'Cash', purpose: 'Monthly Fee', remainingFees: 0, date: new Date().toISOString()
      });
      await refreshData();
      setActiveTab('paid');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record quick payment.');
    }
  };

  const handleDelete = (id) => setConfirmDelete({ open: true, paymentId: id });

  const executeDelete = async () => {
    const id = confirmDelete.paymentId;
    setConfirmDelete({ open: false, paymentId: null });
    try {
      await axios.delete(`${API_URL}/payments/${id}`);
      await refreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete payment.');
    }
  };

  const handleEdit = (payment) => {
    setFormData({
      studentId: payment.studentId?._id || payment.studentId, amount: payment.amount,
      method: payment.method || 'Cash', purpose: payment.purpose || 'Monthly Fee',
      date: payment.date ? payment.date.split('T')[0] : '', remainingFees: payment.remainingFees || 0
    });
    setEditingId(payment._id);
    setEditingOriginalAmount(payment.amount || 0);
    setIsEditing(true);
    setShowModal(true);
  };

  const closeModals = () => {
    setShowModal(false);
    setIsEditing(false);
    setEditingId(null);
    setEditingOriginalAmount(0);
    setCurrentDebt(0);
    setFormData({ studentId: '', amount: '', method: 'Cash', purpose: 'Monthly Fee', date: '', remainingFees: 0 });
  };

  return (
    <div className="payment-list animate-fade-in">
      <div className="list-header">
        <div className="header-left-group">
          <div className="search-box">
            <Search size={18} />
            <input 
              type="text" 
              placeholder={`Search ${activeTab}...`} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="tabs">
            <button 
              className={`tab-btn ${activeTab === 'paid' ? 'active' : ''}`}
              onClick={() => setActiveTab('paid')}
            >
              Paid ({stats?.metrics?.totalPayments || payments.total || 0})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'unpaid' ? 'active' : ''}`}
              onClick={() => setActiveTab('unpaid')}
            >
              Unpaid ({stats?.metrics?.overdue || 0})
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'unpaid' && paginatedUnpaid.length > 0 && (
            <Button
              id="send-pending-alerts-btn"
              variant="secondary"
              onClick={handleSendAlerts}
              disabled={alertState.loading}
              icon={alertState.loading ? null : Bell}
            >
              {alertState.loading ? 'Sending...' : '🔔 Run Alerts Now'}
            </Button>
          )}
          <Button onClick={() => setShowModal(true)} icon={Plus}>
            Record Payment
          </Button>
        </div>
      </div>

      {/* Alert feedback banner */}
      {alertState.message && (
        <div style={{
          margin: '0 0 12px 0',
          padding: '10px 16px',
          borderRadius: '8px',
          fontSize: '0.875rem',
          background: alertState.type === 'success' ? '#d1fae5' : '#fee2e2',
          color:      alertState.type === 'success' ? '#065f46'  : '#991b1b',
          border:     `1px solid ${alertState.type === 'success' ? '#6ee7b7' : '#fca5a5'}`
        }}>
          {alertState.type === 'success' ? '✅' : '❌'} {alertState.message}
          {alertState.results.length > 0 && (
            <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px' }}>
              {alertState.results.map(r => (
                <li key={r.studentId}>
                  <strong>{r.studentName}</strong> — ₹{r.totalDue} ({r.pendingMonths} month{r.pendingMonths > 1 ? 's' : ''})
                  &nbsp;{r.alertSent ? '✅ Sent' : `⚠️ Not sent${r.alertReason ? ` (${r.alertReason})` : ''}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Auto-schedule info note */}
      {activeTab === 'unpaid' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '7px 14px', borderRadius: '8px', marginBottom: '10px',
          background: '#eff6ff', border: '1px solid #bfdbfe',
          color: '#1d4ed8', fontSize: '0.8rem'
        }}>
          <Bell size={14} />
          <span>
            <strong>Auto-alerts are active.</strong> WhatsApp reminders are sent automatically at 06:00 AM on each student's monthly fee-due date.
            Use <em>Run Alerts Now</em> to trigger today's check immediately.
          </span>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            {activeTab === 'paid' ? (
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Purpose</th>
                <th>Actions</th>
              </tr>
            ) : (
              <tr>
                <th>Student Name</th>
                <th>Phone</th>
                <th>Pending</th>
                <th>Total Due</th>
                <th>Actions</th>
              </tr>
            )}
          </thead>
          <tbody>
            {loading && (payments.data?.length === 0 || allStudents.length === 0) ? (
              <>
                <SkeletonRow columns={activeTab === 'paid' ? 6 : 5} />
                <SkeletonRow columns={activeTab === 'paid' ? 6 : 5} />
                <SkeletonRow columns={activeTab === 'paid' ? 6 : 5} />
              </>
            ) : activeTab === 'paid' ? (
              paginatedPayments.length > 0 ? (
                paginatedPayments.map((payment) => (
                  <PaymentRow 
                    key={payment._id} 
                    payment={payment} 
                    onDelete={handleDelete} 
                    onEdit={handleEdit}
                    onViewHistory={() => {
                      const s = allStudents.find(st => st._id === (payment.studentId?._id || payment.studentId));
                      if (s) setHistoryStudent(s);
                    }}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="text-center">
                    {loading ? 'Refreshing...' : 'No payment records found'}
                  </td>
                </tr>
              )
            ) : (
              paginatedUnpaid.length > 0 ? (
                paginatedUnpaid.map((student) => (
                  <tr key={student._id}>
                    <td>
                      <button className="student-name-link" onClick={() => setHistoryStudent(student)}>
                        {student.studentName || student.name}
                      </button>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{student.classType}</div>
                    </td>
                    <td>{student.phone}</td>
                    <td><span className="pending-badge">{student.pendingMonths} month{student.pendingMonths > 1 ? 's' : ''}</span></td>
                    <td className="amount due">₹{student.totalDue}</td>
                    <td>
                      <div className="action-buttons">
                        {student.isActive === false ? (
                          <span style={{ color: '#d32f2f', background: '#ffebee', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, display: 'inline-block' }}>
                            Inactive - Can't Pay
                          </span>
                        ) : (
                          <>
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => handlePay(student)}
                            >
                              Pay
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => handleQuickPay(student)}
                              title="Clear Full Amount"
                            >
                              <Check size={14} /> Clear All
                            </Button>
                          </>
                        )}
                        <Button
                          variant="icon"
                          size="sm"
                          onClick={() => setHistoryStudent(student)}
                          title="View Payment History"
                          icon={History}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center">
                    {loading ? 'Refreshing...' : 'All students have paid!'}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <Pagination 
        currentPage={currentPage} 
        totalPages={totalPages} 
        onPageChange={onPageChange}
        limit={limit}
        onLimitChange={onLimitChange}
      />

      <Modal 
        isOpen={showModal} 
        onClose={closeModals} 
        title={isEditing ? "Edit Payment Detail" : "Record New Payment"}
      >
        <PaymentForm 
          formData={formData} 
          setFormData={setFormData} 
          students={allStudents} 
          payments={payments.data || []}
          currentDebt={currentDebt}
          isEditing={isEditing}
          editingPaymentAmount={editingOriginalAmount}
          onSubmit={handleSubmit} 
          onCancel={closeModals} 
        />
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete.open}
        title="Mark as Unpaid"
        message="This will delete the payment record. The student will appear in the Unpaid list again."
        confirmText="Yes, Mark Unpaid"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete({ open: false, paymentId: null })}
        danger={true}
      />

      <ConfirmDialog
        isOpen={confirmAlerts}
        title="Send Fee Alerts"
        message={`Send WhatsApp pending-fee reminders to students whose fee day is TODAY?`}
        confirmText="Yes, Send Alerts"
        onConfirm={executeSendAlerts}
        onCancel={() => setConfirmAlerts(false)}
      />

      <PaymentHistoryModal 
        student={historyStudent}
        payments={payments}
        onClose={() => setHistoryStudent(null)}
        onRecordPayment={handlePay}
      />
    </div>
  );
};


export default PaymentList;
