import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { Plus, Search, Check, Bell, History, X, CreditCard, Calendar, TrendingDown } from 'lucide-react';
import API_URL from '../config';
import { useData } from '../context/DataContext';
import CategoryDropdown from './ui/CategoryDropdown';
import PaymentRow from './payments/PaymentRow';
import PaymentForm from './payments/PaymentForm';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import Button from './ui/Button';
import SkeletonRow from './ui/SkeletonRow';
import Pagination from './Pagination';
import './List.css';

import PaymentHistoryModal from './payments/PaymentHistoryModal';

const PaymentList = () => {
  const { payments, unpaidStudents: serverUnpaid, allStudents, stats, loading, refreshData, fetchPayments, fetchUnpaidStudents } = useData();
  const [activeTab, setActiveTab] = useState('unpaid');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    studentId: '', amount: '', method: 'Cash', purpose: 'Monthly Fee', date: '', remainingFees: 0
  });
  const [currentDebt, setCurrentDebt] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, paymentId: null });
  const [historyStudent, setHistoryStudent] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const getMonthlyFee = (student) => {
    if (student?.classType === 'Fitness Class') return 2000;
    return student?.studentCategory === 'Kids' ? 1000 : 1300;
  };

  const onPageChange = (page) => {
    if (activeTab === 'paid') fetchPayments(page, 50, searchTerm, categoryFilter);
    else fetchUnpaidStudents(page, 50, searchTerm, categoryFilter);
  };

  const paginatedPayments = payments.data || [];
  const paginatedUnpaid = serverUnpaid.data || [];

  const totalPages = activeTab === 'paid' 
    ? (payments.totalPages || 1)
    : (serverUnpaid.totalPages || 1);
    
  const currentPage = activeTab === 'paid' ? (payments.page || 1) : (serverUnpaid.page || 1);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'paid') fetchPayments(1, 50, searchTerm, categoryFilter);
      else fetchUnpaidStudents(1, 50, searchTerm, categoryFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeTab, categoryFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
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
    if (submitting) return;
    
    // Safety confirmation: show exactly which student is being paid
    const payAmount = student.totalDue || getMonthlyFee(student);
    const confirmed = window.confirm(
      `Confirm payment for:\n\nStudent: ${student.studentName}\nPhone: ${student.phone}\nAmount: ₹${payAmount}\n\nProceed?`
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/payments`, {
        studentId: student._id,
        amount: payAmount,
        method: 'Cash', purpose: 'Monthly Fee', remainingFees: 0, date: new Date().toISOString()
      });
      await refreshData();
      setActiveTab('paid');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record quick payment.');
    } finally {
      setSubmitting(false);
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
    setIsEditing(true);
    setShowModal(true);
  };

  const closeModals = () => {
    setShowModal(false);
    setIsEditing(false);
    setEditingId(null);
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
              className={`tab-btn ${activeTab === 'unpaid' ? 'active' : ''}`}
              onClick={() => setActiveTab('unpaid')}
            >
              Unpaid ({stats?.metrics?.overdue || 0})
            </button>
            <button
              className={`tab-btn ${activeTab === 'paid' ? 'active' : ''}`}
              onClick={() => setActiveTab('paid')}
            >
              Paid ({payments.total || 0})
            </button>
          </div>
          <CategoryDropdown
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={() => setShowModal(true)} icon={Plus}>
              Record Payment
            </Button>
          </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            {activeTab === 'unpaid' ? (
              <tr>
                <th>Student Name</th>
                <th>Phone</th>
                <th>Pending</th>
                <th>Total Due</th>
                <th>Actions</th>
              </tr>
            ) : (
              <tr>
                <th>Date</th>
                <th>Student</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Purpose</th>
                <th>Actions</th>
              </tr>
            )}
          </thead>
          <tbody>
            {loading && (payments.data.length === 0 || allStudents.length === 0) ? (
              <>
                <SkeletonRow columns={activeTab === 'paid' ? 6 : 5} />
                <SkeletonRow columns={activeTab === 'paid' ? 6 : 5} />
                <SkeletonRow columns={activeTab === 'paid' ? 6 : 5} />
              </>
            ) : activeTab === 'unpaid' ? (
              paginatedUnpaid.length > 0 ? (
                paginatedUnpaid.map((student) => (
                  <tr key={student._id}>
                    <td data-label="Student">
                      <div><strong>{student.studentName || student.name}</strong></div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {student.studentCategory && (
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                            borderRadius: '20px', textTransform: 'uppercase', letterSpacing: '0.5px',
                            background: student.studentCategory === 'Kids' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                            color:      student.studentCategory === 'Kids' ? '#60A5FA'               : '#FBBF24',
                          }}>{student.studentCategory}</span>
                        )}
                        {student.classType && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{student.classType}</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Phone">{student.phone}</td>
                    <td data-label="Pending"><span className="pending-badge">{student.pendingMonths} month{student.pendingMonths > 1 ? 's' : ''}</span></td>
                    <td data-label="Due" className="amount due">₹{student.totalDue}</td>
                    <td data-label="Actions">
                      <div className="action-buttons">
                        {student.isActive === false ? (
                          <span style={{ color: '#d32f2f', background: '#ffebee', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, display: 'inline-block' }}>
                            Inactive
                          </span>
                        ) : (
                          <>
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => handlePay(student)}
                              disabled={submitting}
                            >
                              Pay
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => handleQuickPay(student)}
                              title="Clear Full Amount"
                              disabled={submitting}
                            >
                              {submitting ? '...' : <><Check size={14} /> Clear All</>}
                            </Button>
                          </>
                        )}
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
            ) : (
              paginatedPayments.length > 0 ? (
                paginatedPayments.map((payment) => (
                  <PaymentRow 
                    key={payment._id} 
                    payment={payment} 
                    onDelete={handleDelete} 
                    onEdit={handleEdit}
                    onViewHistory={(studentId) => {
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
            )}
          </tbody>
        </table>
      </div>

      <Pagination 
        currentPage={currentPage} 
        totalItems={activeTab === 'paid' ? (payments.total || 0) : (serverUnpaid.total || 0)}
        itemsPerPage={activeTab === 'paid' ? (payments.limit || 50) : (serverUnpaid.limit || 50)}
        onPageChange={onPageChange} 
        onLimitChange={(limit) => {
          if (activeTab === 'paid') fetchPayments(1, limit, searchTerm, categoryFilter);
          else fetchUnpaidStudents(1, limit, searchTerm, categoryFilter);
        }}
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
          submitting={submitting}
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
