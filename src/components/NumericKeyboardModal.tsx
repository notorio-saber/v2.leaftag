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
      // Prevent multiple decimals, store internally as '.'
      if (!value.includes('.')) {
        onChange(value === '' ? '0.' : value + '.');
      }
    } else if (key === '⌫') {
      onChange(value.slice(0, -1));
    } else if (key === 'C') {
      onChange('');
    } else {
      // Prevent multiple leading zeroes
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
        handleKeyPress('⌫');
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
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translate(-50%, 0)',
      width: '100%',
      maxWidth: '480px',
      background: 'rgba(10, 13, 11, 0.96)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '2px solid var(--primary-color)',
      borderLeft: '1px solid var(--border-color)',
      borderRight: '1px solid var(--border-color)',
      borderRadius: '24px 24px 0 0',
      padding: '16px 16px max(12px, env(safe-area-inset-bottom)) 16px',
      boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxSizing: 'border-box',
      zIndex: 10000,
      animation: 'slideUpNum 0.3s cubic-bezier(0.16, 1, 0.3, 1) both'
    }}>
      <style>{`
        @keyframes slideUpNum {
          from { transform: translate(-50%, 100%); }
          to { transform: translate(-50%, 0); }
        }
      `}</style>

      {/* Grid Keypad */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '10px',
        width: '100%'
      }}>
        {/* Row 1 */}
        <button type="button" className="btn" style={keyStyle} onClick={() => handleKeyPress('1')}>1</button>
        <button type="button" className="btn" style={keyStyle} onClick={() => handleKeyPress('2')}>2</button>
        <button type="button" className="btn" style={keyStyle} onClick={() => handleKeyPress('3')}>3</button>

        {/* Row 2 */}
        <button type="button" className="btn" style={keyStyle} onClick={() => handleKeyPress('4')}>4</button>
        <button type="button" className="btn" style={keyStyle} onClick={() => handleKeyPress('5')}>5</button>
        <button type="button" className="btn" style={keyStyle} onClick={() => handleKeyPress('6')}>6</button>

        {/* Row 3 */}
        <button type="button" className="btn" style={keyStyle} onClick={() => handleKeyPress('7')}>7</button>
        <button type="button" className="btn" style={keyStyle} onClick={() => handleKeyPress('8')}>8</button>
        <button type="button" className="btn" style={keyStyle} onClick={() => handleKeyPress('9')}>9</button>

        {/* Row 4 */}
        <button type="button" className="btn" style={specialKeyStyle} onClick={() => handleKeyPress(',')}>,</button>
        <button type="button" className="btn" style={keyStyle} onClick={() => handleKeyPress('0')}>0</button>
        <button type="button" className="btn" style={specialKeyStyle} onClick={() => handleKeyPress('.')}>.</button>

        {/* Row 5 */}
        <button type="button" className="btn btn-danger" style={dangerKeyStyle} onClick={() => handleKeyPress('⌫')}>⌫</button>
        <button type="button" className="btn btn-secondary" style={clearKeyStyle} onClick={() => handleKeyPress('C')}>Limpar</button>
        <button type="button" className="btn btn-primary" style={confirmKeyStyle} onClick={onConfirm}>OK</button>
      </div>

      {/* Footer Cancel Action */}
      <button 
        type="button"
        className="btn btn-secondary" 
        onClick={onClose}
        style={{ 
          marginTop: '4px', 
          padding: '8px', 
          borderColor: 'transparent',
          color: 'var(--text-muted)',
          fontSize: '10px',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          cursor: 'pointer'
        }}
      >
        Fechar Teclado
      </button>
    </div>
  );
};

const keyStyle: React.CSSProperties = {
  height: '56px',
  fontSize: '22px',
  fontWeight: '600',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-color)',
  color: 'white',
  padding: 0,
  cursor: 'pointer'
};

const specialKeyStyle: React.CSSProperties = {
  ...keyStyle,
  background: 'rgba(255,255,255,0.01)',
  color: 'var(--text-muted)'
};

const dangerKeyStyle: React.CSSProperties = {
  height: '56px',
  fontSize: '18px',
  borderRadius: '10px',
  border: '1px solid rgba(239, 35, 60, 0.3)',
  color: '#ef233c',
  padding: 0,
  cursor: 'pointer'
};

const clearKeyStyle: React.CSSProperties = {
  height: '56px',
  fontSize: '12px',
  borderRadius: '10px',
  border: '1px solid var(--border-color)',
  color: 'var(--text-muted)',
  padding: 0,
  cursor: 'pointer'
};

const confirmKeyStyle: React.CSSProperties = {
  height: '56px',
  fontSize: '16px',
  fontWeight: 'bold',
  borderRadius: '10px',
  background: 'var(--primary-color)',
  color: 'white',
  border: '1px solid var(--primary-color)',
  padding: 0,
  cursor: 'pointer'
};
