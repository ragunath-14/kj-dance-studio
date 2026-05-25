import React, { useState } from 'react';
import axios from 'axios';
import { Plus, Search, Check, Bell, History, Send } from 'lucide-react';
import API_URL from '../config';
import { useData } from '../context/DataContext';
import PaymentRow from './payments/PaymentRow';
import PaymentForm from './payments/PaymentForm';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import Button from './ui/Button';
import SkeletonRow from './ui/SkeletonRow';
import Pagination from './ui/Pagination';
import PaymentHistoryModal from './payments/PaymentHistoryModal';
import './List.css';

const PaymentList = () => {
  const {
    payments, unpaidStudents: serverUnpaid, allStudents, stats,
    loading, paymentsLoading, refreshData, fetchPayments, fetchUnpaidStudents
  } = useData();

  const [activeTab,             setActiveTab]             = useState('paid');
  const [showModal,             setShowModal]             = useState(false);
  const [searchTerm,            setSearchTerm]            = useState('');
  const [formData,              setFormData]              = useState({
    studentId: '', amount: '', method: 'Cash', purpose: 'Monthly Fee', date: '', remainingFees: 0
  });
  const [currentDebt,           setCurrentDebt]           = useState(0);
  const [isEditing,             setIsEditing]             = useState(false);
  const [editingId,             setEditingId]             = useState(null);
  const [editingOriginalAmount, setEditingOriginalAmount] = useState(0);
  const [alertState,            setAlertState]            = useState({ loading: false, message: '', type: '', results: [] });
  const [confirmDelete,         setConfirmDelete]         = useState({ open: false, paymentId: null });
  const [confirmAlerts,         setConfirmAlerts]         = useState(false);
  const [historyStudent,        setHistoryStudent]        = useState(null);
  const [limit,                 setLimit]                 = useState(50);
  // Per-student reminder state: { [studentId]: 'idle' | 'sending' | 'sent' | 'error' }
  const [reminderState,         setReminderState]         = useState({});

  // ── Pagination ─────────────────────────────────────────────────────────────
  const onPageChange = (page) => {
    if (activeTab === 'paid') fetchPayments(page, limit);
    else fetchUnpaidStudents(page, limit);
  };

  const onLimitChange = (newLimit) => {
    setLimit(newLimit);
    if (activeTab === 'paid') fetchPayments(1, newLimit);
    else fetchUnpaidStudents(1, newLimit);
  };

  const paginatedPayments = payments.data || [];
  const paginatedUnpaid   = serverUnpaid.data || [];

  const totalPages  = activeTab === 'paid' ? (payments.totalPages || 1) : (serverUnpaid.totalPages || 1);
  const currentPage = activeTab === 'paid' ? (payments.page || 1) : (serverUnpaid.page || 1);

  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onPageChange(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, activeTab]);

  React.useEffect(() => {
    setAlertState({ loading: false, message: '', type: '', results: [] });
  }, [activeTab]);

  // ── Bulk alert ─────────────────────────────────────────────────────────────
  const executeSendAlerts = async () => {
    setConfirmAlerts(false);
    setAlertState({ loading: true, message: '', type: '', results: [] });
    try {
      const res  = await axios.post(`${API_URL}/payments/send-pending-alerts`);
      const data = res.data;
      setAlertState({ loading: false, message: data.message, type: 'success', results: data.results || [] });
    } catch (err) {
      setAlertState({ loading: false, message: err.response?.data?.message || 'Failed to trigger alert job.', type: 'error', results: [] });
    }
  };

  // ── Per-student reminder ───────────────────────────────────────────────────
  const sendReminder = async (student) => {
    setReminderState(s => ({ ...s, [student._id]: 'sending' }));
    try {
      const res = await axios.post(`${API_URL}/payments/send-reminder/${student._id}`);
      setReminderState(s => ({ ...s, [student._id]: res.data.success ? 'sent' : 'error' }));
      setTimeout(() => setReminderState(s => ({ ...s, [student._id]: 'idle' })), 4000);
    } catch {
      setReminderState(s => ({ ...s, [student._id]: 'error' }));
      setTimeout(() => setReminderState(s => ({ ...s, [student._id]: 'idle' })), 4000);
    }
  };

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) await axios.put(`${API_URL}/payments/${editingId}`, formData);
      else           await axios.post(`${API_URL}/payments`, formData);
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
        amount:    student.totalDue || (student.classType === 'Fitness Class' ? 2500 : 3500),
        method: 'Cash', purpose: 'Monthly Fee', remainingFees: 0,
        date: new Date().toISOString()
      });
      await refreshData();
      setActiveTab('paid');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record quick payment.');
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

  const closeModals = () => {
    setShowModal(false);
    setIsEditing(false);
    setEditingId(null);
    setEditingOriginalAmount(0);
    setCurrentDebt(0);
    setFormData({ studentId: '', amount: '', method: 'Cash', purpose: 'Monthly Fee', date: '', remainingFees: 0 });
  };

  const isTableLoading = loading || paymentsLoading;

  return (
    <div className="payment-list animate-fade-in">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
            <button className={`tab-btn ${activeTab === 'paid' ? 'active' : ''}`} onClick={() => setActiveTab('paid')}>
              Paid ({stats?.metrics?.totalPayments || payments.total || 0})
            </button>
            <button className={`tab-btn ${activeTab === 'unpaid' ? 'active' : ''}`} onClick={() => setActiveTab('unpaid')}>
              Unpaid ({stats?.metrics?.overdue || serverUnpaid.total || 0})
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'unpaid' && paginatedUnpaid.length > 0 && (
            <Button
              id="send-pending-alerts-btn"
              variant="secondary"
              onClick={() => setConfirmAlerts(true)}
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

      {/* ── Alert feedback banner ───────────────────────────────────────────── */}
      {alertState.message && (
        <div className={`alert-banner alert-banner--${alertState.type}`}>
          {alertState.type === 'success' ? '✅' : '❌'} {alertState.message}
          {alertState.results.length > 0 && (
            <ul className="alert-result-list">
              {alertState.results.map(r => (
                <li key={r.studentId}>
                  <strong>{r.studentName}</strong> — ₹{r.totalDue.toLocaleString()} ({r.pendingMonths} month{r.pendingMonths > 1 ? 's' : ''})
                  &nbsp;{r.alertSent ? '✅ Sent' : `⚠️ Not sent${r.alertReason ? ` (${r.alertReason})` : ''}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Auto-schedule info note ─────────────────────────────────────────── */}
      {activeTab === 'unpaid' && (
        <div className="info-banner">
          <Bell size={14} />
          <span>
            <strong>Auto-alerts active.</strong> Reminders sent at 09:00 AM on each student's due date,
            and every 4 days for students overdue by more than 1 month. Use <em>Run Alerts Now</em> to trigger immediately.
          </span>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            {activeTab === 'paid' ? (
              <tr>
                <th>Date</th><th>Student</th><th>Amount</th>
                <th className="hide-mobile">Method</th><th className="hide-mobile">Purpose</th><th>Actions</th>
              </tr>
            ) : (
              <tr>
                <th>Student</th><th>Phone</th><th>Pending</th>
                <th>Total Due</th><th>Actions</th>
              </tr>
            )}
          </thead>
          <tbody>
            {isTableLoading && (payments.data?.length === 0 || allStudents.length === 0) ? (
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
                  const paymentStudentId = String(payment.studentId?._id || payment.studentId || '');
                      const s = allStudents.find(st => String(st._id) === paymentStudentId);
                      if (s) setHistoryStudent(s);
                    }}
                  />
                ))
              ) : (
                <tr><td colSpan="6" className="text-center">{isTableLoading ? 'Refreshing...' : 'No payment records found'}</td></tr>
              )
            ) : (
              paginatedUnpaid.length > 0 ? (
                paginatedUnpaid.map((student) => {
                  const rState = reminderState[student._id] || 'idle';
                  return (
                    <tr key={student._id}>
                      <td>
                        <button className="student-name-link" onClick={() => setHistoryStudent(student)}>
                          {student.studentName || student.name}
                        </button>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {student.classType}
                        </div>
                      </td>
                      <td>
                        <div>{student.phone}</div>
                        {student.whatsappNumber && student.whatsappNumber !== student.phone && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            WA: {student.whatsappNumber}
                          </div>
                        )}
                      </td>
                      <td><span className="pending-badge">{student.pendingMonths} month{student.pendingMonths > 1 ? 's' : ''}</span></td>
                      <td className="amount due">₹{student.totalDue.toLocaleString()}</td>
                      <td>
                        <div className="action-buttons">
                          {student.isActive === false ? (
                            <span className="inactive-label">Inactive</span>
                          ) : (
                            <>
                              <Button variant="primary" size="sm" onClick={() => handlePay(student)}>Pay</Button>
                              <Button variant="secondary" size="sm" onClick={() => handleQuickPay(student)} title="Clear Full Amount">
                                <Check size={14} /> Clear All
                              </Button>
                            </>
                          )}
                          {/* Per-student WhatsApp reminder button */}
                          <button
                            className={`reminder-btn-sm reminder-btn-sm--${rState}`}
                            onClick={() => sendReminder(student)}
                            disabled={rState === 'sending' || rState === 'sent'}
                            title="Send WhatsApp reminder"
                          >
                            {rState === 'sending' && <span className="btn-spinner-sm" />}
                            {rState === 'idle'    && <Send size={12} />}
                            {rState === 'sent'    && '✅'}
                            {rState === 'error'   && '❌'}
                          </button>
                          <Button variant="icon" size="sm" onClick={() => setHistoryStudent(student)} title="View History" icon={History} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan="5" className="text-center">{isTableLoading ? 'Refreshing...' : 'All students have paid! 🎉'}</td></tr>
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

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={closeModals} title={isEditing ? 'Edit Payment' : 'Record New Payment'}>
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
        message="Send WhatsApp pending-fee reminders to all overdue students now?"
        confirmText="Yes, Send Alerts"
        onConfirm={executeSendAlerts}
        onCancel={() => setConfirmAlerts(false)}
      />

      <PaymentHistoryModal
        student={historyStudent}
        onClose={() => setHistoryStudent(null)}
        onRecordPayment={handlePay}
      />
    </div>
  );
};

export default PaymentList;
