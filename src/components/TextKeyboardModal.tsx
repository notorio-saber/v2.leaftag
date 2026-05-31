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
      width: '100%',
      maxWidth: '520px',
      margin: '0 auto',
      background: 'rgba(20, 25, 22, 0.65)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '12px',
      boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      boxSizing: 'border-box'
    }}>
      {/* Keyboard Keypad Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
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
            Caps
          </button>
          {row3.map(char => (
            <button key={char} type="button" style={keyStyle} onClick={() => handleKeyPress(char)}>
              {isUppercase ? char.toUpperCase() : char.toLowerCase()}
            </button>
          ))}
          <button type="button" style={actionKeyStyle('#ef233c')} onClick={handleBackspace}>
            Apagar
          </button>
        </div>

        {/* Row 4: Shortcuts and Space */}
        <div style={rowStyle}>
          <button type="button" style={shortcutStyle} onClick={handleSpShort}>sp.</button>
          <button type="button" style={shortcutStyle} onClick={handleCfShort}>cf.</button>
          <button type="button" style={shortcutStyle} onClick={handleNiShort}>NI</button>
          <button type="button" style={{ ...keyStyle, flex: 2, background: 'rgba(255,255,255,0.06)' }} onClick={handleSpace}>Espaco</button>
          <button type="button" style={clearStyle} onClick={handleClear}>Limpar</button>
          <button type="button" style={confirmStyle} onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
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
  height: '38px',
  fontSize: '15px',
  fontWeight: '600',
  borderRadius: '0px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: 'white',
  padding: 0,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  outline: 'none',
  transition: 'background 0.2s ease'
};

const shiftKeyStyle = (active: boolean): React.CSSProperties => ({
  ...keyStyle,
  background: active ? 'var(--primary-color)' : 'rgba(255,255,255,0.06)',
  color: 'white',
  fontWeight: 'bold',
  fontSize: '12px',
  flex: '1.2'
});

const actionKeyStyle = (color: string): React.CSSProperties => ({
  ...keyStyle,
  color,
  background: 'rgba(255,255,255,0.01)',
  fontSize: '12px',
  flex: '1.5'
});

const shortcutStyle: React.CSSProperties = {
  ...keyStyle,
  background: 'rgba(46, 125, 50, 0.1)',
  border: '1px solid rgba(46, 125, 50, 0.3)',
  color: 'var(--primary-hover)',
  fontSize: '13px',
  fontWeight: 'bold'
};

const clearStyle: React.CSSProperties = {
  ...keyStyle,
  fontSize: '12px',
  color: 'var(--text-muted)'
};

const confirmStyle: React.CSSProperties = {
  ...keyStyle,
  background: 'var(--primary-color)',
  border: '1px solid var(--primary-color)',
  color: 'white',
  fontWeight: 'bold',
  fontSize: '12px'
};
