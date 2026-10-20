import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import API_URL from '../config';
import { useData } from '../context/DataContext';
import StudentRow from './students/StudentRow';
import StudentForm from './students/StudentForm';
import OfferModal from './students/OfferModal';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import CategoryDropdown from './ui/CategoryDropdown';
import Button from './ui/Button';
import SkeletonRow from './ui/SkeletonRow';
import Pagination from './Pagination';
import PaymentHistoryModal from './payments/PaymentHistoryModal';
import { SPECIAL_CLASSES, fixedBatchTiming } from '../../classCatalog';
import './List.css';

const StudentList = () => {
  const { students, payments, stats: dashboardStats, loading, refreshData, fetchStudents, toggleStudentStatus } = useData();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(''); // '' = All students
  const [activeCategory, setActiveCategory] = useState('');
  const [activeSchedule, setActiveSchedule] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, studentId: null });
  const [historyStudent, setHistoryStudent] = useState(null);
  const [offerStudent, setOfferStudent] = useState(null);
  const [notice, setNotice] = useState(null); // { type: 'success' | 'warn', text }

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // Debounce only search input — tab/filter changes should be instant
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(1, 50, searchTerm, activeTab, activeCategory, activeSchedule);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Immediate fetch on tab or filter change (no debounce needed)
  useEffect(() => {
    fetchStudents(1, 50, searchTerm, activeTab, activeCategory, activeSchedule);
  }, [activeTab, activeCategory, activeSchedule]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPageChange = (page) => {
    fetchStudents(page, 50, searchTerm, activeTab, activeCategory, activeSchedule);
  };

  const [formData, setFormData] = useState({
    studentName: '', phone: '', whatsappNumber: '', 
    danceForFitness: '', studentAge: '', 
    gender: '', studentCategory: '', parentName: '',
    classType: 'Regular Class',
    classSchedule: 'NA',
    createdAt: new Date().toISOString()
  });

  const processedStudents = students.data || [];

  const totalPages = students.totalPages || 1;
  const currentPage = students.page || 1;

  // Tab button numbers: the same filters as the list (search, Kids/Adults, Weekday/Weekend),
  // counted on the server for every tab at once, so each button always matches what its tab shows.
  const [tabCounts, setTabCounts] = useState({});
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      axios.get(`${API_URL}/students/counts`, { params: { search: searchTerm, studentCategory: activeCategory, classSchedule: activeSchedule } })
        .then(res => { if (!cancelled) setTabCounts(res.data); })
        .catch(() => { /* keep the previous numbers */ });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchTerm, activeCategory, activeSchedule, students]); // `students` changes whenever data is refreshed (add / delete / import)
  const countOf = (key) => (tabCounts[key] === undefined ? '…' : tabCounts[key]);

  // Accept payload directly from StudentForm to avoid async setState race condition
  const handleSubmit = async (e, payload) => {
    e.preventDefault();
    const wasEditing = editingStudent;
    const data = payload || formData;
    
    try {
      let referralNote = '';
      if (wasEditing) {
        await axios.put(`${API_URL}/students/${wasEditing._id}`, data);
      } else {
        const res = await axios.post(`${API_URL}/students`, data);
        referralNote = res.data?.referralOutcome?.note || '';
        if (referralNote) setNotice({ type: res.data.referralOutcome.result === 'rewarded' ? 'success' : 'warn', text: `Student added. Referral: ${referralNote}` });
      }
      
      await refreshData();
      setShowModal(false);
      setEditingStudent(null);
      setFormData({ 
        studentName: '', phone: '', whatsappNumber: '', 
        danceForFitness: '', 
        studentAge: '', gender: '', studentCategory: '', 
        parentName: '', classType: 'Regular Class',
        classSchedule: 'NA',
        discountPercent: '', discountAmount: '', referralCode: '',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      const d = err.response?.data;
      // a referral-code problem comes with a title and steps; show them so the reason is clear
      const errorMsg = d?.title
        ? [d.title, d.message, ...(d.steps || []).map((x, i) => `${i + 1}. ${x}`)].join(String.fromCharCode(10, 10))
        : (d?.message || 'Failed to save to database. Please check console and try again.');
      alert(errorMsg);
    }
  };

  const handleDelete = (id) => {
    setConfirmState({ open: true, studentId: id });
  };

  const confirmDelete = async () => {
    const id = confirmState.studentId;
    setConfirmState({ open: false, studentId: null });
    try {
      await axios.delete(`${API_URL}/students/${id}`);
      await refreshData();
    } catch (err) {
      alert('Failed to delete student. Check server connection.');
    }
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setFormData({
      studentName: student.studentName || student.name || '',
      phone: student.phone || '',
      whatsappNumber: student.whatsappNumber || '',
      danceForFitness: student.danceForFitness || '',
      studentAge: student.studentAge || '',
      gender: student.gender || '',
      studentCategory: student.studentCategory || '',
      parentName: student.parentName || '',
      classType: student.classType || 'Regular Class',
      classSchedule: student.classSchedule || 'NA',
      batchTiming: student.batchTiming || '',
      feePlan: student.feePlan || '',
      extraClasses: (student.extraClasses || []).map(e => ({ classType: e.classType, feePlan: e.feePlan || '', batchTiming: e.batchTiming || '' })),
      createdAt: student.createdAt || new Date().toISOString()
    });
    setShowModal(true);
  };

  const closeModals = () => {
    setShowModal(false);
    setEditingStudent(null);
  };

  return (
    <div className="student-list animate-fade-in">
      {notice && (
        <div style={{
          margin: '0 0 12px', padding: '10px 16px', borderRadius: '10px', fontWeight: 700, fontSize: '0.9rem',
          background: notice.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
          color: notice.type === 'success' ? 'var(--success)' : 'var(--warning)',
          border: `1px solid ${notice.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(245,158,11,0.4)'}`
        }}>
          {notice.type === 'success' ? '✅' : '⚠️'} {notice.text}
        </div>
      )}

      <div className="list-header">
        <div className="header-left-group">
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === '' ? 'active' : ''}`}
              onClick={() => setActiveTab('')}
            >
              All ({countOf('all')})
            </button>
            <button
              className={`tab-btn ${activeTab === 'Regular Class' ? 'active' : ''}`}
              onClick={() => setActiveTab('Regular Class')}
            >
              Regular ({countOf('Regular Class')})
            </button>
            <button
              className={`tab-btn ${activeTab === 'Fitness Class' ? 'active' : ''}`}
              onClick={() => setActiveTab('Fitness Class')}
            >
              Fitness ({countOf('Fitness Class')})
            </button>
            <button
              className={`tab-btn ${activeTab === 'Online Class' ? 'active' : ''}`}
              onClick={() => setActiveTab('Online Class')}
            >
              Online ({countOf('Online Class')})
            </button>
            {Object.keys(SPECIAL_CLASSES).map(type => (
              <button
                key={type}
                className={`tab-btn ${activeTab === type ? 'active' : ''}`}
                onClick={() => setActiveTab(type)}
              >
                {SPECIAL_CLASSES[type].short} ({countOf(type)})
              </button>
            ))}
          </div>
          <CategoryDropdown
            value={activeCategory}
            onChange={setActiveCategory}
          />
          <div className="schedule-filter-tabs">
            {['', 'Weekday', 'Weekend'].map(s => (
              <button
                key={s || 'all'}
                className={`schedule-filter-btn ${activeSchedule === s ? 'active' : ''}`}
                onClick={() => setActiveSchedule(s)}
              >
                {s || 'All Schedule'}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={() => { 
          setFormData({ 
            studentName: '', phone: '', whatsappNumber: '', 
            danceForFitness: '', 
            studentAge: '', gender: '', studentCategory: '', 
            parentName: '', classType: activeTab || 'Regular Class',
            classSchedule: SPECIAL_CLASSES[activeTab] ? 'NA' : (activeSchedule || 'NA'),
            batchTiming: fixedBatchTiming(activeTab || 'Regular Class'), feePlan: '', extraClasses: [],
            discountPercent: '', discountAmount: '', referralCode: '',
            createdAt: new Date().toISOString()
          });
          setShowModal(true); 
          setEditingStudent(null); 
        }} icon={Plus}>
          Add Student
        </Button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact Details</th>
              {activeTab === 'Fitness Class' && <th>Fitness Option</th>}
              <th>{activeTab === 'Regular Class' || activeTab === '' ? 'Join Date' : 'Batch Info'}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (students.data || []).length === 0 ? (
              <>
                <SkeletonRow columns={activeTab === 'Fitness Class' ? 5 : 4} />
                <SkeletonRow columns={activeTab === 'Fitness Class' ? 5 : 4} />
                <SkeletonRow columns={activeTab === 'Fitness Class' ? 5 : 4} />
              </>
            ) : processedStudents.length > 0 ? (
              processedStudents.map((student) => (
                <StudentRow
                  key={student._id}
                  student={student}
                  payments={payments.data || []}
                  showFitnessCol={activeTab === 'Fitness Class'}
                  showClass={activeTab === ''}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  onToggleStatus={toggleStudentStatus}
                  onViewHistory={(s) => setHistoryStudent(s)}
                  onOffer={(s) => setOfferStudent(s)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={activeTab === 'Fitness Class' ? 5 : 4} className="text-center">
                  {loading ? 'Refreshing...' : (activeTab ? `No students found in ${activeTab}` : 'No students found')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination 
        currentPage={currentPage} 
        totalItems={students.total || 0}
        itemsPerPage={students.limit || 50}
        onPageChange={onPageChange} 
        onLimitChange={(limit) => fetchStudents(1, limit, searchTerm, activeTab, activeCategory, activeSchedule)}
      />

      <Modal 
        isOpen={showModal} 
        onClose={closeModals} 
        title={editingStudent ? 'Edit Student' : 'Add New Student'}
        width="600px"
      >
        <StudentForm 
          formData={formData} 
          setFormData={setFormData} 
          onSubmit={handleSubmit} 
          onCancel={closeModals}
          isEditing={!!editingStudent}
        />
      </Modal>

      <ConfirmDialog
        isOpen={confirmState.open}
        title="Delete Student"
        message="Are you sure you want to permanently delete this student? This cannot be undone."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        danger={true}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState({ open: false, studentId: null })}
      />

      {offerStudent && (
        <OfferModal
          student={offerStudent}
          onClose={() => setOfferStudent(null)}
          onSaved={refreshData}
        />
      )}

      <PaymentHistoryModal 
        student={historyStudent}
        onClose={() => setHistoryStudent(null)}
        onRecordPayment={() => {
          setHistoryStudent(null);
          navigate('/admin/payments');
        }}
      />
    </div>
  );
};

export default StudentList;
