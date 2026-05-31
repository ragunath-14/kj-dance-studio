import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import './Pagination.css';

const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, pageSize }) => {
  if (!totalPages || totalPages <= 1) return null;

  // Smart windowing: show at most 5 page buttons centered on current page
  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const pages = getPageNumbers();

  const startItem = totalItems ? (currentPage - 1) * (pageSize || 50) + 1 : null;
  const endItem = totalItems ? Math.min(currentPage * (pageSize || 50), totalItems) : null;

  return (
    <div className="pagination-wrapper">
      {totalItems && (
        <span className="pagination-info">
          Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalItems}</strong>
        </span>
      )}
      <div className="pagination">
        {/* First page */}
        <button
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First page"
        >
          <ChevronsLeft size={16} />
        </button>

        {/* Prev */}
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page numbers with ellipsis */}
        <div className="page-numbers">
          {pages.map((page, idx) =>
            page === '...' ? (
              <span key={`dots-${idx}`} className="page-dots">…</span>
            ) : (
              <button
                key={page}
                className={`page-btn ${currentPage === page ? 'active' : ''}`}
                onClick={() => onPageChange(page)}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Next */}
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next page"
        >
          <ChevronRight size={16} />
        </button>

        {/* Last page */}
        <button
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Last page"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
