import React, { useState, useEffect } from 'react';

interface TextKeyboardModalProps {
  value: string;
  onChange: (val: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const TextKeyboardModal: React.FC<TextKeyboardModalProps> = ({
  value,
  onChange,
  onConfirm,
  onClose
}) => {
  const [isUppercase, setIsUppercase] = useState(true);

  const handleKeyPress = (char: string) => {
    onChange(value + (isUppercase ? char.toUpperCase() : char.toLowerCase()));
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const handleClear = () => {
    onChange('');
  };

  const handleSpace = () => {
    onChange(value + ' ');
  };

  const handleSpShort = () => {
    onChange(value + (value === '' ? 'sp.' : value.endsWith(' ') ? 'sp.' : ' sp.'));
  };

  const handleCfShort = () => {
    onChange(value + (value === '' ? 'cf.' : value.endsWith(' ') ? 'cf.' : ' cf.'));
  };

  const handleNiShort = () => {
    onChange('NI');
  };

  // Listen to physical keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.length === 1) {
        onChange(value + e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [value, onChange]);

  const row1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const row2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
  const row3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translate(-50%, 0)',
      width: '100%',
      maxWidth: '520px',
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
      gap: '10px',
      boxSizing: 'border-box',
      zIndex: 10000,
      animation: 'slideUpText 0.3s cubic-bezier(0.16, 1, 0.3, 1) both'
    }}>
      <style>{`
        @keyframes slideUpText {
          from { transform: translate(-50%, 100%); }
          to { transform: translate(-50%, 0); }
        }
      `}</style>

      {/* Keyboard Keypad Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {/* Row 1 */}
        <div style={rowStyle}>
          {row1.map(char => (
            <button key={char} type="button" style={keyStyle} onClick={() => handleKeyPress(char)}>
              {isUppercase ? char.toUpperCase() : char.toLowerCase()}
            </button>
          ))}
        </div>

        {/* Row 2 */}
        <div style={rowStyle}>
          <div style={{ width: '4%' }} />
          {row2.map(char => (
            <button key={char} type="button" style={keyStyle} onClick={() => handleKeyPress(char)}>
              {isUppercase ? char.toUpperCase() : char.toLowerCase()}
            </button>
          ))}
          <div style={{ width: '4%' }} />
        </div>

        {/* Row 3 */}
        <div style={rowStyle}>
          <button type="button" style={shiftKeyStyle(isUppercase)} onClick={() => setIsUppercase(!isUppercase)}>
            ⇧
          </button>
          {row3.map(char => (
            <button key={char} type="button" style={keyStyle} onClick={() => handleKeyPress(char)}>
              {isUppercase ? char.toUpperCase() : char.toLowerCase()}
            </button>
          ))}
          <button type="button" style={actionKeyStyle('#ef233c')} onClick={handleBackspace}>
            ⌫
          </button>
        </div>

        {/* Row 4: Shortcuts and Space */}
        <div style={rowStyle}>
          <button type="button" style={shortcutStyle} onClick={handleSpShort}>sp.</button>
          <button type="button" style={shortcutStyle} onClick={handleCfShort}>cf.</button>
          <button type="button" style={shortcutStyle} onClick={handleNiShort}>NI</button>
          <button type="button" style={{ ...keyStyle, flex: 2, background: 'rgba(255,255,255,0.06)' }} onClick={handleSpace}>Espaço</button>
          <button type="button" style={shortcutStyle} onClick={handleClear}>Limpar</button>
          <button type="button" style={confirmStyle} onClick={onConfirm}>OK</button>
        </div>
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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '4px',
  width: '100%'
};

const keyStyle: React.CSSProperties = {
  flex: 1,
  height: '42px',
  fontSize: '16px',
  fontWeight: '600',
  borderRadius: '8px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--border-color)',
  color: 'white',
  padding: 0,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none'
};

const shiftKeyStyle = (active: boolean): React.CSSProperties => ({
  ...keyStyle,
  background: active ? 'var(--primary-color)' : 'rgba(255,255,255,0.06)',
  color: 'white',
  fontWeight: 'bold',
  fontSize: '18px'
});

const actionKeyStyle = (color: string): React.CSSProperties => ({
  ...keyStyle,
  color,
  background: 'rgba(255,255,255,0.01)',
  fontSize: '16px'
});

const shortcutStyle: React.CSSProperties = {
  ...keyStyle,
  background: 'rgba(46, 125, 50, 0.1)',
  border: '1px solid rgba(46, 125, 50, 0.3)',
  color: 'var(--primary-hover)',
  fontSize: '13px',
  fontWeight: 'bold'
};

const confirmStyle: React.CSSProperties = {
  ...keyStyle,
  background: 'var(--primary-color)',
  border: '1px solid var(--primary-color)',
  color: 'white',
  fontWeight: 'bold',
  fontSize: '14px'
};
