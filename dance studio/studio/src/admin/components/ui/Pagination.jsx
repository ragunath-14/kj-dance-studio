import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

const LIMIT_OPTIONS = [10, 25, 50, 100];

const Pagination = ({ currentPage: cp, totalPages: tp, onPageChange, limit, onLimitChange }) => {
  const currentPage = Number(cp) || 1;
  const totalPages = Number(tp) || 1;

  if (totalPages <= 1 && !onLimitChange) return null;

  // Smart page range: show max 5 page buttons around current
  const getPageRange = () => {
    const range = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  };

  const pages = getPageRange();

  return (
    <div className="pagination">
      {onLimitChange && (
        <div className="pagination-limit">
          <label>Show</label>
          <select
            value={limit || 50}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="limit-select"
          >
            {LIMIT_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <span>per page</span>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination-controls">
          <button 
            className="pagination-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="page-numbers">
            {pages[0] > 1 && (
              <>
                <button className="page-btn" onClick={() => onPageChange(1)}>1</button>
                {pages[0] > 2 && <span className="page-ellipsis">…</span>}
              </>
            )}
            {pages.map(page => (
              <button
                key={page}
                className={`page-btn ${currentPage === page ? 'active' : ''}`}
                onClick={() => onPageChange(page)}
              >
                {page}
              </button>
            ))}
            {pages[pages.length - 1] < totalPages && (
              <>
                {pages[pages.length - 1] < totalPages - 1 && <span className="page-ellipsis">…</span>}
                <button className="page-btn" onClick={() => onPageChange(totalPages)}>{totalPages}</button>
              </>
            )}
          </div>

          <button 
            className="pagination-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
