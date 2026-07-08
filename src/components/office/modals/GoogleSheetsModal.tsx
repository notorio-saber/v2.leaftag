import React, { useState, useEffect } from 'react';
import { useInventory } from '../../../context/InventoryContext';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFw: any;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  activeFw,
}) => {
  const { createFieldWork } = useInventory();
  const [googleSheetsUrlInput, setGoogleSheetsUrlInput] = useState('');

  useEffect(() => {
    if (isOpen && activeFw) {
      setGoogleSheetsUrlInput(activeFw.googleSheetsUrl || '');
    }
  }, [isOpen, activeFw]);

  if (!isOpen || !activeFw) return null;

  const handleSave = async () => {
    if (googleSheetsUrlInput.trim() && !googleSheetsUrlInput.startsWith('https://script.google.com')) {
      return alert('Por favor, insira uma URL válida do Google Apps Script.');
    }
    
    // Save to Firebase
    try {
      await createFieldWork({
        ...activeFw,
        googleSheetsUrl: googleSheetsUrlInput.trim() || undefined
      });
      alert('Configurações de sincronização salvas com sucesso!');
      onClose();
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar as configurações.');
    }
  };

  const scriptCode = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    sheet.clear();
    
    if (data.headers && data.headers.length > 0) {
      sheet.appendRow(data.headers);
    }
    
    if (data.rows && data.rows.length > 0) {
      var range = sheet.getRange(2, 1, data.rows.length, data.headers.length);
      var values = data.rows.map(function(row) {
        return data.headers.map(function(header) {
          return row[header] !== undefined ? row[header] : "";
        });
      });
      range.setValues(values);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Dados sincronizados com sucesso! Total: " + (data.rows ? data.rows.length : 0) + " linhas." }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.85)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 100000, 
      padding: '20px', 
      backdropFilter: 'blur(8px)', 
      WebkitBackdropFilter: 'blur(8px)' 
    }}>
      <div 
        className="glass-card" 
        style={{ 
          width: '100%', 
          maxWidth: '550px', 
          margin: 0, 
          maxHeight: '90vh', 
          overflowY: 'auto', 
          padding: '24px',
          borderRadius: '8px', // Subtle rounding
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(7, 16, 10, 0.95)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--primary-hover)', fontWeight: '800' }}>Vincular Google Planilhas</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '6px', marginBottom: '16px', lineHeight: '1.4' }}>
          Vincule este Trabalho de Campo a uma planilha do Google Sheets para enviar seus dados estruturados com um clique.
        </p>
        
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '12.5px', color: '#e0e0e0', marginBottom: '16px' }}>
          <strong style={{ color: '#fff', display: 'block', marginBottom: '8px' }}>Instruções de Configuração:</strong>
          <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>Crie uma nova planilha vazia no Google Planilhas (<a href="https://sheets.new" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-hover)', textDecoration: 'underline' }}>sheets.new</a>).</li>
            <li>No menu superior, acesse <strong>Extensões</strong> &gt; <strong>Apps Script</strong>.</li>
            <li>Apague todo o código existente na janela e cole o script abaixo.</li>
            <li>Clique no ícone de salvar (disquete) e depois clique em <strong>Implantar</strong> &gt; <strong>Nova implantação</strong>.</li>
            <li>Clique na engrenagem de "Tipo", escolha <strong>App da Web</strong>. Em "Quem pode acessar", mude para <strong>Qualquer pessoa</strong>.</li>
            <li>Clique em Implantar, conceda as permissões se solicitado, copie a <strong>URL do App da Web</strong> gerada e cole no campo de texto abaixo.</li>
          </ol>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Código do Google Apps Script:</label>
          <textarea 
            readOnly 
            className="input-field" 
            style={{ height: '140px', fontFamily: 'monospace', fontSize: '11px', background: 'rgba(0,0,0,0.5)', color: '#81c784', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'text' }} 
            value={scriptCode}
          />
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ width: 'auto', padding: '6px 12px', fontSize: '11px', alignSelf: 'flex-start', borderRadius: '4px' }}
            onClick={() => {
              navigator.clipboard.writeText(scriptCode);
              alert("Código copiado para a área de transferência!");
            }}
          >
            Copiar Script
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>URL do App da Web:</label>
          <input 
            type="url" 
            className="input-field" 
            placeholder="https://script.google.com/macros/s/.../exec" 
            value={googleSheetsUrlInput} 
            onChange={e => setGoogleSheetsUrlInput(e.target.value)} 
            style={{ marginBottom: 0, borderRadius: '4px', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-secondary" 
            style={{ width: 'auto', borderRadius: '4px' }}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button 
            className="btn btn-primary" 
            style={{ width: 'auto', borderRadius: '4px' }}
            onClick={handleSave}
          >
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
};
