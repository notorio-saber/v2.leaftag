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
      maxWidth: '480px',
      margin: '0 auto',
      background: 'rgba(5, 10, 7, 0.7)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '20px',
      padding: '12px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      boxSizing: 'border-box'
    }}>
      {/* Grid Keypad */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '8px',
        width: '100%'
      }}>
        {/* Row 1 */}
        <button type="button" style={keyStyle} onClick={() => handleKeyPress('1')}>1</button>
        <button type="button" style={keyStyle} onClick={() => handleKeyPress('2')}>2</button>
        <button type="button" style={keyStyle} onClick={() => handleKeyPress('3')}>3</button>

        {/* Row 2 */}
        <button type="button" style={keyStyle} onClick={() => handleKeyPress('4')}>4</button>
        <button type="button" style={keyStyle} onClick={() => handleKeyPress('5')}>5</button>
        <button type="button" style={keyStyle} onClick={() => handleKeyPress('6')}>6</button>

        {/* Row 3 */}
        <button type="button" style={keyStyle} onClick={() => handleKeyPress('7')}>7</button>
        <button type="button" style={keyStyle} onClick={() => handleKeyPress('8')}>8</button>
        <button type="button" style={keyStyle} onClick={() => handleKeyPress('9')}>9</button>

        {/* Row 4 */}
        <button type="button" style={specialKeyStyle} onClick={() => handleKeyPress(',')}>,</button>
        <button type="button" style={keyStyle} onClick={() => handleKeyPress('0')}>0</button>
        <button type="button" style={specialKeyStyle} onClick={() => handleKeyPress('.')}>.</button>

        {/* Row 5 */}
        <button type="button" style={dangerKeyStyle} onClick={() => handleKeyPress('Apagar')}>Apagar</button>
        <button type="button" style={clearKeyStyle} onClick={() => handleKeyPress('C')}>Limpar</button>
        <button type="button" style={confirmKeyStyle} onClick={onConfirm}>Confirmar</button>
      </div>
    </div>
  );
};

const keyStyle: React.CSSProperties = {
  height: '46px',
  fontSize: '18px',
  fontWeight: '700',
  borderRadius: '12px', /* Arredondado 12px */
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: 'white',
  padding: 0,
  cursor: 'pointer',
  outline: 'none',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  transition: 'all 0.2s ease',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
};

const specialKeyStyle: React.CSSProperties = {
  ...keyStyle,
  background: 'rgba(255, 255, 255, 0.02)',
  color: 'var(--text-muted)'
};

const dangerKeyStyle: React.CSSProperties = {
  ...keyStyle,
  fontSize: '13px',
  background: 'rgba(239, 35, 60, 0.1)',
  border: '1px solid rgba(239, 35, 60, 0.3)',
  color: '#ff4d6d'
};

const clearKeyStyle: React.CSSProperties = {
  ...keyStyle,
  fontSize: '13px',
  background: 'rgba(255, 255, 255, 0.01)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  color: 'var(--text-muted)'
};

const confirmKeyStyle: React.CSSProperties = {
  ...keyStyle,
  fontSize: '13px',
  fontWeight: 'bold',
  background: 'rgba(46, 125, 50, 0.25)',
  color: '#ffffff',
  border: '1px solid rgba(46, 125, 50, 0.45)',
  boxShadow: '0 4px 10px rgba(46, 125, 50, 0.15)'
};
