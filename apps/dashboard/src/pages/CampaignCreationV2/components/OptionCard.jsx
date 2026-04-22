import React from 'react';

const DIRECTION_LABELS = {
  'editorial': 'PREMIUM EDITORIAL',
  'data-grid': 'DATA-DRIVEN',
  'emotional': 'EMOTIONAL STORY',
};

export default function OptionCard({ option, letter, onClick }) {
  const direction = option.direction || 'editorial';
  return (
    <button className="cc2-option-card" onClick={onClick} type="button">
      <div className={`cc2-option-card__thumb dir-${direction}`}>
        <div className="cc2-option-card__letter">{letter}</div>
      </div>
      <div className="cc2-option-card__body">
        <div className="cc2-option-card__dir">
          {DIRECTION_LABELS[direction] || direction.toUpperCase()}
        </div>
        <div className="cc2-option-card__headline">{option.headline}</div>
        <div className="cc2-option-card__mood">{option.mood}</div>
      </div>
    </button>
  );
}
