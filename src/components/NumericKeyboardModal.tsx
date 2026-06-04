import React, { useEffect } from 'react';

interface NumericKeyboardModalProps {
  value: string;
  onChange: (val: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const NumericKeyboardModal: React.FC<NumericKeyboardModalProps> = ({
  value,
  onChange,
  onConfirm,
  onClose
}) => {
  const handleKeyPress = (key: string) => {
    if (key === '.' || key === ',') {
      if (!value.includes('.')) {
        onChange(value === '' ? '0.' : value + '.');
      }
    } else if (key === '⌫' || key === 'Apagar') {
      onChange(value.slice(0, -1));
    } else if (key === 'C') {
      onChange('');
    } else {
      if (value === '0') {
        onChange(key);
      } else {
        onChange(value + key);
      }
    }
  };

  // Listen to physical keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === '.' || e.key === ',') {
        handleKeyPress('.');
      } else if (e.key === 'Backspace') {
        handleKeyPress('Apagar');
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, onChange]);

  return (
    <div style={{
      width: '100%',
      maxWidth: 'none',
      margin: '0',
      background: 'transparent',
      border: 'none',
      borderRadius: '0px',
      padding: '4px 0px',
      boxShadow: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      boxSizing: 'border-box'
    }}>
      {/* Grid Keypad */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '4px',
        width: '100%'
      }}>
        {/* Row 1 */}
        <button type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress('1')}>1</button>
        <button type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress('2')}>2</button>
        <button type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress('3')}>3</button>

        {/* Row 2 */}
        <button type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress('4')}>4</button>
        <button type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress('5')}>5</button>
        <button type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress('6')}>6</button>

        {/* Row 3 */}
        <button type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress('7')}>7</button>
        <button type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress('8')}>8</button>
        <button type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress('9')}>9</button>

        {/* Row 4 */}
        <button type="button" className="keyboard-key" style={specialKeyStyle} onClick={() => handleKeyPress(',')}>,</button>
        <button type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress('0')}>0</button>
        <button type="button" className="keyboard-key" style={specialKeyStyle} onClick={() => handleKeyPress('.')}>.</button>

        {/* Row 5: Clean bottom actions (Apagar, Limpar) */}
        <button type="button" className="keyboard-key" style={{ ...dangerKeyStyle, gridColumn: 'span 2' }} onClick={() => handleKeyPress('Apagar')}>Apagar</button>
        <button type="button" className="keyboard-key" style={{ ...clearKeyStyle, gridColumn: 'span 1' }} onClick={() => handleKeyPress('C')}>Limpar</button>
      </div>
    </div>
  );
};

const keyStyle: React.CSSProperties = {
  height: '62px', /* Taller keys */
  fontSize: '22px', /* Larger font */
  fontWeight: '700',
  borderRadius: '12px',
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-main)',
  padding: 0,
  cursor: 'pointer',
  outline: 'none',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  transition: 'all 0.2s ease'
};

const specialKeyStyle: React.CSSProperties = {
  ...keyStyle,
  background: 'var(--border-color)',
  color: 'var(--text-main)'
};

const dangerKeyStyle: React.CSSProperties = {
  ...keyStyle,
  fontSize: '14.5px',
  background: 'rgba(239, 35, 60, 0.12)',
  border: '1px solid rgba(239, 35, 60, 0.35)',
  color: 'var(--danger-hover)'
};

const clearKeyStyle: React.CSSProperties = {
  ...keyStyle,
  fontSize: '14.5px',
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-muted)'
};
