import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import API_URL from '../config';
import { useData } from '../context/DataContext';
import StudentRow from './students/StudentRow';
import StudentForm from './students/StudentForm';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import Button from './ui/Button';
import SkeletonRow from './ui/SkeletonRow';
import Pagination from './Pagination';
import PaymentHistoryModal from './payments/PaymentHistoryModal';
import './List.css';

const StudentList = () => {
  const { students, payments, stats: dashboardStats, loading, refreshData, fetchStudents, toggleStudentStatus } = useData();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Regular Class');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmState, setConfirmState] = useState({ open: false, studentId: null });
  const [historyStudent, setHistoryStudent] = useState(null);

  // Server-side fetching when page, tab, or search changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(1, 50, searchTerm, activeTab);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeTab]);

  const onPageChange = (page) => {
    fetchStudents(page, 50, searchTerm, activeTab);
  };

  const [formData, setFormData] = useState({
    studentName: '', phone: '', whatsappNumber: '', 
    danceForFitness: '', studentAge: '', 
    gender: '', studentCategory: '', parentName: '',
    classType: 'Regular Class',
    createdAt: new Date().toISOString()
  });

  const processedStudents = students.data || [];

  const totalPages = students.totalPages || 1;
  const currentPage = students.page || 1;

  const metrics = useMemo(() => {
    if (!dashboardStats || !dashboardStats.metrics) return { regular: 0, summer: 0, fitness: 0 };
    return dashboardStats.metrics.classTypes;
  }, [dashboardStats]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const wasEditing = editingStudent;
    
    try {
      if (wasEditing) {
        await axios.put(`${API_URL}/students/${wasEditing._id}`, formData);
      } else {
        await axios.post(`${API_URL}/students`, formData);
      }
      
      await refreshData();
      setShowModal(false);
      setEditingStudent(null);
      setFormData({ 
        studentName: '', phone: '', whatsappNumber: '', 
        danceForFitness: '', 
        studentAge: '', gender: '', studentCategory: '', 
        parentName: '', classType: 'Regular Class',
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
              placeholder={`Search ${activeTab.split(' ')[0]} students...`} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="tabs">
            <button 
              className={`tab-btn ${activeTab === 'Regular Class' ? 'active' : ''}`}
              onClick={() => setActiveTab('Regular Class')}
            >
              Regular ({metrics.regular})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'Fitness Class' ? 'active' : ''}`}
              onClick={() => setActiveTab('Fitness Class')}
            >
              Fitness ({metrics.fitness})
            </button>
          </div>
        </div>
        <Button onClick={() => { 
          setFormData({ 
            studentName: '', phone: '', whatsappNumber: '', 
            danceForFitness: '', 
            studentAge: '', gender: '', studentCategory: '', 
            parentName: '', classType: activeTab,
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
            {loading && students.data.length === 0 ? (
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
        onLimitChange={(limit) => fetchStudents(1, limit, searchTerm, activeTab)}
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
