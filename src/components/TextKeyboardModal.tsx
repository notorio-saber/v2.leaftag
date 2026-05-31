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
  const [isUppercase, setIsUppercase] = useState(value === '');

  // Automatically force uppercase when text is cleared or empty
  useEffect(() => {
    if (value === '') {
      setIsUppercase(true);
    }
  }, [value]);

  const handleKeyPress = (char: string) => {
    onChange(value + (isUppercase ? char.toUpperCase() : char.toLowerCase()));
    if (isUppercase) {
      setIsUppercase(false);
    }
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
      {/* Keyboard Keypad Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
        {/* Row 1 */}
        <div style={rowStyle}>
          {row1.map(char => (
            <button key={char} type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress(char)}>
              {isUppercase ? char.toUpperCase() : char.toLowerCase()}
            </button>
          ))}
        </div>

        {/* Row 2 */}
        <div style={rowStyle}>
          <div style={{ width: '1.5%' }} />
          {row2.map(char => (
            <button key={char} type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress(char)}>
              {isUppercase ? char.toUpperCase() : char.toLowerCase()}
            </button>
          ))}
          <div style={{ width: '1.5%' }} />
        </div>

        {/* Row 3 */}
        <div style={rowStyle}>
          <button type="button" className="keyboard-key" style={shiftKeyStyle(isUppercase)} onClick={() => setIsUppercase(!isUppercase)}>
            Caps
          </button>
          {row3.map(char => (
            <button key={char} type="button" className="keyboard-key" style={keyStyle} onClick={() => handleKeyPress(char)}>
              {isUppercase ? char.toUpperCase() : char.toLowerCase()}
            </button>
          ))}
          <button type="button" className="keyboard-key" style={actionKeyStyle('#ff4d6d', 'rgba(239, 35, 60, 0.1)', 'rgba(239, 35, 60, 0.35)')} onClick={handleBackspace}>
            Apagar
          </button>
        </div>

        {/* Row 4: Shortcuts and Space */}
        <div style={rowStyle}>
          <button type="button" className="keyboard-key" style={shortcutStyle} onClick={handleSpShort}>sp.</button>
          <button type="button" className="keyboard-key" style={shortcutStyle} onClick={handleCfShort}>cf.</button>
          <button type="button" className="keyboard-key" style={shortcutStyle} onClick={handleNiShort}>NI</button>
          <button type="button" className="keyboard-key" style={{ ...keyStyle, flex: 2, background: 'rgba(255, 255, 255, 0.08)' }} onClick={handleSpace}>Espaço</button>
          <button type="button" className="keyboard-key" style={clearStyle} onClick={handleClear}>Limpar</button>
          <button type="button" className="keyboard-key" style={confirmStyle} onClick={onConfirm}>Confirmar</button>
        </div>
      </div>
    </div>
  );
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '2px', /* Narrower gaps between letters to maximize size */
  width: '100%'
};

const keyStyle: React.CSSProperties = {
  flex: 1,
  height: '52px', /* Even taller keys */
  fontSize: '18px', /* Larger font */
  fontWeight: '700',
  borderRadius: '12px',
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: 'white',
  padding: 0,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  outline: 'none',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  transition: 'all 0.2s ease',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
};

const shiftKeyStyle = (active: boolean): React.CSSProperties => ({
  ...keyStyle,
  background: active ? 'rgba(46, 125, 50, 0.25)' : 'rgba(255, 255, 255, 0.06)',
  border: active ? '1px solid rgba(46, 125, 50, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
  color: active ? '#a5d6a7' : 'white',
  fontWeight: 'bold',
  fontSize: '12.5px',
  flex: '1.3'
});

const actionKeyStyle = (color: string, bg: string, border: string): React.CSSProperties => ({
  ...keyStyle,
  color,
  background: bg,
  border: `1px solid ${border}`,
  fontSize: '12.5px',
  flex: '1.6'
});

const shortcutStyle: React.CSSProperties = {
  ...keyStyle,
  background: 'rgba(46, 125, 50, 0.12)',
  border: '1px solid rgba(46, 125, 50, 0.35)',
  color: '#a5d6a7',
  fontSize: '13px',
  fontWeight: 'bold'
};

const clearStyle: React.CSSProperties = {
  ...keyStyle,
  fontSize: '12px',
  background: 'rgba(255, 255, 255, 0.01)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  color: 'var(--text-muted)'
};

const confirmStyle: React.CSSProperties = {
  ...keyStyle,
  background: 'rgba(46, 125, 50, 0.25)',
  border: '1px solid rgba(46, 125, 50, 0.45)',
  color: 'white',
  fontWeight: 'bold',
  fontSize: '12.5px',
  boxShadow: '0 4px 10px rgba(46, 125, 50, 0.15)'
};
