import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import API_URL from '../config';
import { useData } from '../context/DataContext';
import StudentRow from './students/StudentRow';
import StudentForm from './students/StudentForm';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import CategoryDropdown from './ui/CategoryDropdown';
import Button from './ui/Button';
import SkeletonRow from './ui/SkeletonRow';
import Pagination from './Pagination';
import PaymentHistoryModal from './payments/PaymentHistoryModal';
import './List.css';

const StudentList = () => {
  const { students, payments, stats: dashboardStats, loading, refreshData, fetchStudents, toggleStudentStatus } = useData();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Regular Class');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeSchedule, setActiveSchedule] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, studentId: null });
  const [historyStudent, setHistoryStudent] = useState(null);

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

  const metrics = useMemo(() => {
    if (!dashboardStats || !dashboardStats.metrics) return { regular: 0, summer: 0, fitness: 0, online: 0 };
    return dashboardStats.metrics.classTypes;
  }, [dashboardStats]);

  // Accept payload directly from StudentForm to avoid async setState race condition
  const handleSubmit = async (e, payload) => {
    e.preventDefault();
    const wasEditing = editingStudent;
    const data = payload || formData;
    
    try {
      if (wasEditing) {
        await axios.put(`${API_URL}/students/${wasEditing._id}`, data);
      } else {
        await axios.post(`${API_URL}/students`, data);
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
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to save to database. Please check console and try again.';
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
              className={`tab-btn ${activeTab === 'Regular Class' ? 'active' : ''}`}
              onClick={() => setActiveTab('Regular Class')}
            >
              Regular ({metrics.regular || 0})
            </button>
            <button
              className={`tab-btn ${activeTab === 'Fitness Class' ? 'active' : ''}`}
              onClick={() => setActiveTab('Fitness Class')}
            >
              Fitness ({metrics.fitness || 0})
            </button>
            <button
              className={`tab-btn ${activeTab === 'Online Class' ? 'active' : ''}`}
              onClick={() => setActiveTab('Online Class')}
            >
              Online ({metrics.online || 0})
            </button>
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
            parentName: '', classType: activeTab,
            classSchedule: activeSchedule || 'NA',
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
              <th>{activeTab === 'Regular Class' ? 'Join Date' : 'Batch Info'}</th>
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
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  onToggleStatus={toggleStudentStatus}
                  onViewHistory={(s) => setHistoryStudent(s)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={activeTab === 'Fitness Class' ? 5 : 4} className="text-center">
                  {loading ? 'Refreshing...' : `No students found in ${activeTab}`}
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
