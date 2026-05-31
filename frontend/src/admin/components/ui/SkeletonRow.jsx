import React from 'react';

const SkeletonRow = ({ columns }) => {
  return (
    <tr className="skeleton-row">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i}>
          <div className="skeleton-pulse"></div>
        </td>
      ))}
    </tr>
  );
};

export default SkeletonRow;
