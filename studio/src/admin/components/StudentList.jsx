import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { Plus, Search } from 'lucide-react';
import API_URL from '../config';
import { useData } from '../context/DataContext';
import StudentRow from './students/StudentRow';
import StudentForm from './students/StudentForm';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import Button from './ui/Button';
import SkeletonRow from './ui/SkeletonRow';
import Pagination from './ui/Pagination';
import './List.css';

const StudentList = () => {
  const { students, stats: dashboardStats, loading, refreshData, fetchStudents, toggleStudentStatus } = useData();
  const [activeTab, setActiveTab] = useState('Dance Class');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(50);
  const [confirmState, setConfirmState] = useState({ open: false, studentId: null });

  // Server-side fetching when page, tab, or search changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents(1, limit, searchTerm, activeTab);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, activeTab, limit]);

  const onPageChange = (page) => {
    fetchStudents(page, limit, searchTerm, activeTab);
  };

  const onLimitChange = (newLimit) => {
    setLimit(newLimit);
    fetchStudents(1, newLimit, searchTerm, activeTab);
  };

  const [formData, setFormData] = useState({
    danceStyle: '', danceForFitness: '', studentAge: '', 
    parentName: '', location: '', batchTiming: '', notes: '', classType: 'Dance Class', 
    createdAt: new Date().toISOString().split('T')[0]
  });

  const processedStudents = students.data || [];

  const totalPages = students.totalPages || 1;
  const currentPage = students.page || 1;

  const metrics = useMemo(() => {
    if (!dashboardStats || !dashboardStats.metrics) return { dance: 0, regular: 0, fitness: 0 };
    return dashboardStats.metrics.classTypes || { dance: 0, regular: 0, fitness: 0 };
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
        studentName: '', email: '', phone: '', whatsappNumber: '', 
        danceStyle: '', danceForFitness: '', 
        studentAge: '', gender: '', bloodGroup: '', parentName: '', 
        emergencyContactName: '', emergencyContactPhone: '', 
        location: '', address: '', batchTiming: '', notes: '',
        classType: 'Dance Class', 
        createdAt: new Date().toISOString().split('T')[0] 
      });
    } catch (err) {
      console.error(err);
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
      console.error(err);
      alert('Failed to delete student. Check server connection.');
    }
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setFormData({
      studentName: student.studentName || student.name || '',
      email: student.email || '',
      phone: student.phone || '',
      whatsappNumber: student.whatsappNumber || '',
      danceStyle: student.danceStyle || '',
      danceForFitness: student.danceForFitness || '',
      studentAge: student.studentAge || '',
      gender: student.gender || '',
      bloodGroup: student.bloodGroup || '',
      parentName: student.parentName || '',
      emergencyContactName: student.emergencyContactName || '',
      emergencyContactPhone: student.emergencyContactPhone || '',
      location: student.location || '',
      address: student.address || '',
      batchTiming: student.batchTiming || '',
      notes: student.notes || '',
      classType: student.classType || 'Dance Class',
      createdAt: student.createdAt || student.joinDate || new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  const closeModals = () => {
    setShowModal(false);
    setEditingStudent(null);
    setFormData({ 
      studentName: '', email: '', phone: '', whatsappNumber: '', 
      danceStyle: '', danceForFitness: '', 
      studentAge: '', gender: '', bloodGroup: '', parentName: '', 
      emergencyContactName: '', emergencyContactPhone: '', 
      location: '', address: '', batchTiming: '', notes: '',
      classType: 'Dance Class', 
      createdAt: new Date().toISOString().split('T')[0] 
    });
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
              className={`tab-btn ${activeTab === 'Dance Class' ? 'active' : ''}`}
              onClick={() => setActiveTab('Dance Class')}
            >
              Dance ({metrics.dance || 0})
            </button>
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
          </div>
        </div>
        <Button onClick={() => { 
          setFormData(prev => ({ ...prev, classType: activeTab }));
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
              <th>Dance Style</th>
              <th>{activeTab === 'Regular Class' ? 'Join Date' : 'Batch Info'}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && students.data.length === 0 ? (
              <>
                <SkeletonRow columns={5} />
                <SkeletonRow columns={5} />
                <SkeletonRow columns={5} />
              </>
            ) : processedStudents.length > 0 ? (
              processedStudents.map((student) => (
                <StudentRow 
                  key={student._id} 
                  student={student} 
                  onEdit={openEditModal} 
                  onDelete={handleDelete} 
                  onToggleStatus={toggleStudentStatus}
                />
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center">
                  {loading ? 'Refreshing...' : `No students found in ${activeTab}`}
                </td>
              </tr>
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
        title={editingStudent ? 'Edit Student' : 'Add New Student'}
      >
        <StudentForm 
          key={editingStudent?._id || 'new'}
          formData={formData} 
          setFormData={setFormData} 
          onCancel={closeModals}
          isEditing={!!editingStudent}
          editingStudentId={editingStudent?._id}
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
    </div>
  );
};


export default StudentList;
