import React, { useState, useEffect } from 'react';

interface NumericKeyboardModalProps {
  title: string;
  initialValue: string;
  onConfirm: (val: string) => void;
  onClose: () => void;
}

export const NumericKeyboardModal: React.FC<NumericKeyboardModalProps> = ({
  title,
  initialValue,
  onConfirm,
  onClose
}) => {
  const [value, setValue] = useState('');

  // Synchronize initial clean value
  useEffect(() => {
    setValue(initialValue ? initialValue.toString() : '');
  }, [initialValue]);

  const handleKeyPress = (key: string) => {
    if (key === '.' || key === ',') {
      // Prevent multiple decimals, store internally as '.'
      if (!value.includes('.')) {
        setValue(prev => prev === '' ? '0.' : prev + '.');
      }
    } else if (key === '⌫') {
      setValue(prev => prev.slice(0, -1));
    } else if (key === 'C') {
      setValue('');
    } else {
      // Prevent multiple leading zeroes
      if (value === '0') {
        setValue(key);
      } else {
        setValue(prev => prev + key);
      }
    }
  };

  const handleConfirm = () => {
    onConfirm(value);
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
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value]);

  // Convert decimal point '.' to comma ',' for local representation
  const displayValue = value.replace('.', ',');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '0 0 max(0px, env(safe-area-inset-bottom)) 0',
    }}>
      {/* Modal click outside closer */}
      <div 
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1
        }}
      />

      {/* Keyboard Container */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        maxWidth: '480px',
        background: 'var(--card-bg)',
        borderTop: '2px solid var(--primary-color)',
        borderLeft: '1px solid var(--border-color)',
        borderRight: '1px solid var(--border-color)',
        borderRadius: '24px 24px 0 0',
        padding: '24px',
        boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) both'
      }}>
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>

        {/* Header: Title and value display */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <span style={{ 
            fontSize: '11px', 
            textTransform: 'uppercase', 
            letterSpacing: '2px', 
            color: 'var(--text-muted)',
            fontWeight: 'bold'
          }}>{title}</span>
          
          {/* Display box */}
          <div style={{
            width: '100%',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '16px',
            textAlign: 'center',
            minHeight: '72px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            <span style={{ 
              fontSize: '40px', 
              fontWeight: '800', 
              fontFamily: 'monospace',
              color: value ? 'var(--primary-hover)' : 'rgba(255,255,255,0.15)',
              letterSpacing: '1px'
            }}>
              {displayValue || '0,0'}
            </span>
            <span style={{
              width: '3px',
              height: '36px',
              background: 'var(--primary-color)',
              marginLeft: '4px',
              animation: 'blink 1s step-end infinite'
            }} />
            <style>{`
              @keyframes blink {
                from, to { background-color: transparent }
                50% { background-color: var(--primary-color) }
              }
            `}</style>
          </div>
        </div>

        {/* Grid Keypad */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '12px',
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
          <button type="button" className="btn btn-primary" style={confirmKeyStyle} onClick={handleConfirm}>OK</button>
        </div>

        {/* Footer Actions */}
        <button 
          type="button"
          className="btn btn-secondary" 
          onClick={onClose}
          style={{ 
            marginTop: '8px', 
            padding: '12px', 
            borderColor: 'transparent',
            color: 'var(--text-muted)',
            fontSize: '11px',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

const keyStyle: React.CSSProperties = {
  height: '64px',
  fontSize: '24px',
  fontWeight: '600',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-color)',
  color: 'white',
  padding: 0
};

const specialKeyStyle: React.CSSProperties = {
  ...keyStyle,
  background: 'rgba(255,255,255,0.01)',
  color: 'var(--text-muted)'
};

const dangerKeyStyle: React.CSSProperties = {
  height: '64px',
  fontSize: '20px',
  borderRadius: '12px',
  border: '1px solid rgba(239, 35, 60, 0.3)',
  color: '#ef233c',
  padding: 0
};

const clearKeyStyle: React.CSSProperties = {
  height: '64px',
  fontSize: '13px',
  borderRadius: '12px',
  border: '1px solid var(--border-color)',
  color: 'var(--text-muted)',
  padding: 0
};

const confirmKeyStyle: React.CSSProperties = {
  height: '64px',
  fontSize: '18px',
  fontWeight: 'bold',
  borderRadius: '12px',
  background: 'var(--primary-color)',
  color: 'white',
  border: '1px solid var(--primary-color)',
  padding: 0
};
