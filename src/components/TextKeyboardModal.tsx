import React, { useState, useEffect, useRef } from 'react';

const accentMap: Record<string, string[]> = {
  'a': ['á', 'à', 'ã', 'â'],
  'e': ['é', 'ê'],
  'i': ['í'],
  'o': ['ó', 'ô', 'õ'],
  'u': ['ú'],
  'c': ['ç'],
  'n': ['ñ']
};

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
  const [isSymbols, setIsSymbols] = useState(false);

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

  const row1 = isSymbols ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] : ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const row2 = isSymbols ? ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'] : ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
  const row3 = isSymbols ? ['.', ',', '?', '!', "'", '%', '=', '+', '*'] : ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

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
      boxSizing: 'border-box',
      userSelect: 'none',
      WebkitUserSelect: 'none'
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
            <LongPressButton 
              key={char} 
              char={char} 
              isUppercase={isUppercase && !isSymbols} 
              onPress={handleKeyPress} 
              variants={!isSymbols ? accentMap[char] : undefined} 
            />
          ))}
        </div>

        {/* Row 2 */}
        <div style={rowStyle}>
          <div style={{ width: '1.5%' }} />
          {row2.map(char => (
            <LongPressButton 
              key={char} 
              char={char} 
              isUppercase={isUppercase && !isSymbols} 
              onPress={handleKeyPress} 
              variants={!isSymbols ? accentMap[char] : undefined} 
            />
          ))}
          <div style={{ width: '1.5%' }} />
        </div>

        {/* Row 3 */}
        <div style={rowStyle}>
          <button type="button" className="keyboard-key" style={shiftKeyStyle(isUppercase)} onClick={() => {
            if (isSymbols) {
              setIsSymbols(false);
            } else {
              setIsUppercase(!isUppercase);
            }
          }}>
            {isSymbols ? 'ABC' : 'Caps'}
          </button>
          {row3.map(char => (
            <LongPressButton 
              key={char} 
              char={char} 
              isUppercase={isUppercase && !isSymbols} 
              onPress={handleKeyPress} 
              variants={!isSymbols ? accentMap[char] : undefined} 
            />
          ))}
          <button type="button" className="keyboard-key" style={actionKeyStyle()} onClick={handleBackspace}>
            Apagar
          </button>
        </div>

        {/* Row 4: Clean Bottom Navigation (Limpar, Espaço) */}
        <div style={rowStyle}>
          <button type="button" className="keyboard-key" style={clearStyle} onClick={() => setIsSymbols(!isSymbols)}>
            {isSymbols ? 'ABC' : '?123'}
          </button>
          <button type="button" className="keyboard-key" style={clearStyle} onClick={handleClear}>Limpar</button>
          <button type="button" className="keyboard-key" style={{ ...keyStyle, flex: 4, background: 'var(--border-color)' }} onClick={handleSpace}>Espaço</button>
        </div>
      </div>
    </div>
  );
};

const LongPressButton: React.FC<{
  char: string;
  isUppercase: boolean;
  onPress: (char: string) => void;
  variants?: string[];
}> = ({ char, isUppercase, onPress, variants }) => {
  const [showPopup, setShowPopup] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const startPress = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (variants && variants.length > 0) {
      pressTimer.current = setTimeout(() => {
        setShowPopup(true);
      }, 300); // Faster popup delay for fluidity
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (showPopup) {
      e.preventDefault(); // Prevent scrolling while sliding over variants
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (pressTimer.current) clearTimeout(pressTimer.current);

    if (showPopup) {
      const touch = e.changedTouches[0];
      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      if (elem && elem.hasAttribute('data-variant')) {
        const v = elem.getAttribute('data-variant')!;
        onPress(isUppercase ? v.toUpperCase() : v);
      }
      // Always close popup on release (forces slide UX instead of tap)
      setShowPopup(false);
    } else {
      onPress(isUppercase ? char.toUpperCase() : char);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (!showPopup) {
      onPress(isUppercase ? char.toUpperCase() : char);
    }
  };

  const handleVariantClick = (v: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onPress(isUppercase ? v.toUpperCase() : v);
    setShowPopup(false);
  };

  useEffect(() => {
    const handleClickOutside = () => setShowPopup(false);
    if (showPopup) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showPopup]);

  const displayChar = isUppercase ? char.toUpperCase() : char;

  let popupStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '120%',
    background: '#1a1a1a',
    border: '1px solid var(--primary-hover)',
    borderRadius: '8px',
    display: 'flex',
    gap: '6px',
    padding: '8px',
    zIndex: 99999,
    boxShadow: '0 8px 24px rgba(0,0,0,0.9)'
  };

  const c = char.toLowerCase();
  if (['a', 'q', 'z'].includes(c)) {
    popupStyle.left = '0';
    popupStyle.transform = 'none';
  } else if (['p', 'l', 'm'].includes(c)) {
    popupStyle.right = '0';
    popupStyle.transform = 'none';
  } else {
    popupStyle.left = '50%';
    popupStyle.transform = 'translateX(-50%)';
  }

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
      <button 
        type="button" 
        className="keyboard-key" 
        style={keyStyle} 
        onMouseDown={startPress}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
           if (pressTimer.current) clearTimeout(pressTimer.current);
        }}
        onTouchStart={startPress}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {displayChar}
      </button>

      {showPopup && variants && (
        <div style={popupStyle}>
          {variants.map(v => {
            const vDisplay = isUppercase ? v.toUpperCase() : v;
            return (
              <button 
                key={v}
                data-variant={v}
                onClick={(e) => handleVariantClick(v, e)}
                style={{
                  ...keyStyle,
                  flex: 'none',
                  width: '45px',
                  height: '45px',
                  fontSize: '20px'
                }}
              >
                {vDisplay}
              </button>
            );
          })}
        </div>
      )}
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
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  touchAction: 'none',
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
