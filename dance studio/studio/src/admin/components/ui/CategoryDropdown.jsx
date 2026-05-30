import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './CategoryDropdown.css';

const OPTIONS = [
  { value: '',       label: 'All Categories', sub: '' },
  { value: 'Adults', label: 'Adults',         sub: '₹2000/month' },
  { value: 'Kids',   label: 'Kids',           sub: '₹1000/month' },
];

const CategoryDropdown = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = OPTIONS.find(o => o.value === value) || OPTIONS[0];

  return (
    <div className={`cat-drop ${open ? 'cat-drop--open' : ''}`} ref={ref}>
      <button
        type="button"
        className="cat-drop__trigger"
        onClick={() => setOpen(o => !o)}
      >
        <span className="cat-drop__label">{selected.label}</span>
        {selected.sub && <span className="cat-drop__sub">{selected.sub}</span>}
        <ChevronDown size={13} className="cat-drop__chevron" />
      </button>

      {open && (
        <ul className="cat-drop__menu">
          {OPTIONS.map(opt => (
            <li
              key={opt.value}
              className={`cat-drop__option ${opt.value === value ? 'cat-drop__option--active' : ''}`}
              onMouseDown={() => { onChange(opt.value); setOpen(false); }}
            >
              <span className="cat-drop__opt-text">
                <span>{opt.label}</span>
                {opt.sub && <span className="cat-drop__opt-sub">{opt.sub}</span>}
              </span>
              {opt.value === value && <Check size={13} className="cat-drop__tick" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CategoryDropdown;
