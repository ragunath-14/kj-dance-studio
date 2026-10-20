import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CalendarDays, Check, X, ListChecks, Search } from 'lucide-react';
import API_URL from '../config';
import SkeletonRow from './ui/SkeletonRow';
import CategoryDropdown from './ui/CategoryDropdown';
import { ALL_CLASS_TYPES } from '../../classCatalog';
import './List.css';
import './AttendanceList.css';

const todayStr = () => new Date().toISOString().slice(0, 10);

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AttendanceList = () => {
  const [view, setView] = useState('mark'); // 'mark' | 'history'
  const [activeTab, setActiveTab] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [activeSchedule, setActiveSchedule] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [date, setDate] = useState(todayStr());
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(null); // studentId currently being saved

  const now = new Date();
  const [historyMonth, setHistoryMonth] = useState(now.getMonth());
  const [historyYear, setHistoryYear] = useState(now.getFullYear());
  const [register, setRegister] = useState({ daysInMonth: 31, data: [] });
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/attendance`, {
        params: { date, classType: activeTab, studentCategory: activeCategory, classSchedule: activeSchedule, search: searchTerm }
      });
      setRoster(res.data.data || []);
    } catch (err) {
      console.error('Attendance fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [date, activeTab, activeCategory, activeSchedule, searchTerm]);

  const fetchRegister = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_URL}/attendance/register`, {
        params: { month: historyMonth, year: historyYear, classType: activeTab, studentCategory: activeCategory, classSchedule: activeSchedule, search: searchTerm }
      });
      setRegister({ daysInMonth: res.data.daysInMonth || 31, data: res.data.data || [] });
    } catch (err) {
      console.error('Attendance register fetch failed:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyMonth, historyYear, activeTab, activeCategory, activeSchedule, searchTerm]);

  // Debounce only search input — tab/filter changes fetch instantly
  useEffect(() => {
    const timer = setTimeout(() => {
      if (view === 'mark') fetchRoster(); else fetchRegister();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === 'mark') fetchRoster();
  }, [view, date, activeTab, activeCategory, activeSchedule]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === 'history') fetchRegister();
  }, [view, historyMonth, historyYear, activeTab, activeCategory, activeSchedule]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMark = async (studentId, status) => {
    setMarking(studentId);
    // Optimistic update
    setRoster(prev => prev.map(s => s._id === studentId ? { ...s, status } : s));
    try {
      await axios.post(`${API_URL}/attendance/mark`, { studentId, date, status });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save attendance.');
      fetchRoster(); // revert to server state on failure
    } finally {
      setMarking(null);
    }
  };

  const presentCount = roster.filter(s => s.status === 'Present').length;
  const absentCount  = roster.filter(s => s.status === 'Absent').length;

  return (
    <div className="attendance-list animate-fade-in">
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
            <button className={`tab-btn ${view === 'mark' ? 'active' : ''}`} onClick={() => setView('mark')}>
              Mark Attendance
            </button>
            <button className={`tab-btn ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}>
              History
            </button>
          </div>
          <div className="tabs">
            {['', ...ALL_CLASS_TYPES].map(ct => (
              <button
                key={ct || 'all'}
                className={`tab-btn ${activeTab === ct ? 'active' : ''}`}
                onClick={() => setActiveTab(ct)}
              >
                {ct || 'All Classes'}
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

          {view === 'mark' ? (
            <div className="attendance-date-picker">
              <CalendarDays size={16} />
              <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
            </div>
          ) : (
            <div className="attendance-date-picker">
              <select value={historyMonth} onChange={(e) => setHistoryMonth(parseInt(e.target.value))}>
                {monthNames.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select value={historyYear} onChange={(e) => setHistoryYear(parseInt(e.target.value))}>
                {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>

        {view === 'mark' && (
          <div className="attendance-summary-pills">
            <span className="mini-badge paid"><Check size={12} /> {presentCount} Present</span>
            <span className="mini-badge unpaid"><X size={12} /> {absentCount} Absent</span>
            <span className="mini-badge inactive-badge"><ListChecks size={12} /> {roster.length - presentCount - absentCount} Unmarked</span>
          </div>
        )}
      </div>

      {view === 'mark' ? (
        <div className="table-container">
          <table className="data-table attendance-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Class</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && roster.length === 0 ? (
                <>
                  <SkeletonRow columns={4} />
                  <SkeletonRow columns={4} />
                  <SkeletonRow columns={4} />
                </>
              ) : roster.length > 0 ? (
                roster.map(student => (
                  <tr key={student._id}>
                    <td data-label="Name"><strong>{student.studentName}</strong></td>
                    <td data-label="Contact"><span className="phone">{student.phone}</span></td>
                    <td data-label="Class">{student.classType}</td>
                    <td data-label="Status">
                      <div className="attendance-actions">
                        <button
                          className={`attendance-btn present ${student.status === 'Present' ? 'active' : ''}`}
                          disabled={marking === student._id}
                          onClick={() => handleMark(student._id, 'Present')}
                        >
                          <Check size={14} /> Present
                        </button>
                        <button
                          className={`attendance-btn absent ${student.status === 'Absent' ? 'active' : ''}`}
                          disabled={marking === student._id}
                          onClick={() => handleMark(student._id, 'Absent')}
                        >
                          <X size={14} /> Absent
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center">
                    {loading ? 'Refreshing...' : 'No students found for this filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table attendance-table attendance-register">
            <thead>
              <tr>
                <th>Name</th>
                {Array.from({ length: register.daysInMonth }).map((_, i) => (
                  <th key={i + 1} className="day-col">{i + 1}</th>
                ))}
                <th>Present</th>
                <th>Absent</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading && register.data.length === 0 ? (
                <SkeletonRow columns={register.daysInMonth + 3} />
              ) : register.data.length > 0 ? (
                register.data.map(student => (
                  <tr key={student._id}>
                    <td data-label="Name"><strong>{student.studentName}</strong></td>
                    {Array.from({ length: register.daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const status = student.days[day];
                      const cls = status === 'Present' ? 'present' : status === 'Absent' ? 'absent' : 'unmarked';
                      return (
                        <td key={day} className={`day-col day-cell ${cls}`}>
                          {status === 'Present' ? 'P' : status === 'Absent' ? 'A' : '–'}
                        </td>
                      );
                    })}
                    <td data-label="Present"><span className="mini-badge paid">{student.present}</span></td>
                    <td data-label="Absent"><span className="mini-badge unpaid">{student.absent}</span></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={register.daysInMonth + 3} className="text-center">
                    {historyLoading ? 'Refreshing...' : 'No attendance records for this month.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AttendanceList;
