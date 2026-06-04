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
        {/* Row 0: Scientific Suffixes / Shortcuts */}
        <div style={rowStyle}>
          <button type="button" className="keyboard-key" style={shortcutStyle} onClick={handleSpShort}>sp.</button>
          <button type="button" className="keyboard-key" style={shortcutStyle} onClick={handleCfShort}>cf.</button>
          <button type="button" className="keyboard-key" style={shortcutStyle} onClick={handleNiShort}>NI</button>
        </div>

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
          <button type="button" className="keyboard-key" style={actionKeyStyle()} onClick={handleBackspace}>
            Apagar
          </button>
        </div>

        {/* Row 4: Clean Bottom Navigation (Limpar, Espaço) */}
        <div style={rowStyle}>
          <button type="button" className="keyboard-key" style={clearStyle} onClick={handleClear}>Limpar</button>
          <button type="button" className="keyboard-key" style={{ ...keyStyle, flex: 4, background: 'var(--border-color)' }} onClick={handleSpace}>Espaço</button>
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
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-main)',
  padding: 0,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
  outline: 'none',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  transition: 'all 0.2s ease'
};

const shiftKeyStyle = (active: boolean): React.CSSProperties => ({
  ...keyStyle,
  background: active ? 'rgba(46, 125, 50, 0.25)' : 'var(--card-bg)',
  border: active ? '1px solid var(--primary-hover)' : '1px solid var(--border-color)',
  color: active ? 'var(--primary-hover)' : 'var(--text-main)',
  fontWeight: 'bold',
  fontSize: '12.5px',
  flex: '1.3'
});

const actionKeyStyle = (): React.CSSProperties => ({
  ...keyStyle,
  color: 'var(--danger-hover)',
  background: 'rgba(239, 35, 60, 0.12)',
  border: '1px solid rgba(239, 35, 60, 0.35)',
  fontSize: '12.5px',
  flex: '1.6'
});

const shortcutStyle: React.CSSProperties = {
  ...keyStyle,
  height: '42px', /* More compact for suffixes */
  background: 'rgba(46, 125, 50, 0.12)',
  border: '1px solid rgba(46, 125, 50, 0.35)',
  color: 'var(--primary-hover)',
  fontSize: '14.5px',
  fontWeight: 'bold'
};

const clearStyle: React.CSSProperties = {
  ...keyStyle,
  fontSize: '12px',
  background: 'var(--card-bg)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-muted)'
};
