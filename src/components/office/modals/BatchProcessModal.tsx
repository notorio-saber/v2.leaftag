import React, { useState, useEffect } from 'react';
import { useInventory } from '../../../context/InventoryContext';
import { 
  getDapOfTreeOrStem, 
  cleanResult, 
  evaluateHeightModel, 
  evaluateVolumeModel 
} from '../../../utils/forestryCalculations';

interface BatchProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFwId: string;
}

export const BatchProcessModal: React.FC<BatchProcessModalProps> = ({
  isOpen,
  onClose,
  activeFwId,
}) => {
  const { 
    fieldWorks, 
    talhoes, 
    inventories, 
    heightModels, 
    volumeModels, 
    saveInventory 
  } = useInventory();

  // Find active fieldwork and related lists
  const activeFw = fieldWorks.find(f => f.id === activeFwId);
  const activeTalhoes = talhoes.filter(t => t.fieldWorkId === activeFwId);
  const activeParcels = inventories.filter(p => p.fieldWorkId === activeFwId);

  // Local modal states
  const [batchScope, setBatchScope] = useState<'total' | 'talhao' | 'parcela'>('total');
  const [batchTalhaoId, setBatchTalhaoId] = useState('');
  const [batchParcelId, setBatchParcelId] = useState<number | null>(null);

  const [selectedHeightModelId, setSelectedHeightModelId] = useState('none');
  const [selectedVolumeModelId, setSelectedVolumeModelId] = useState('legacy');
  const [processingFatorForma, setProcessingFatorForma] = useState('0.7');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Initialize selections from active fieldwork settings
  useEffect(() => {
    if (isOpen && activeFw) {
      setSelectedHeightModelId(activeFw.selectedHeightModelId || 'none');
      setSelectedVolumeModelId(activeFw.selectedVolumeModelId || 'legacy');
      setProcessingFatorForma(activeFw.defaultFatorForma?.toString() || '0.7');
      setBatchScope('total');
      setBatchTalhaoId('');
      setBatchParcelId(null);
    }
  }, [isOpen, activeFw]);

  if (!isOpen || !activeFw) return null;

  const handleBatchProcess = async () => {
    let parcelsToProcess = [...activeParcels];
    if (batchScope === 'talhao') {
      if (!batchTalhaoId) return alert('Por favor, selecione o talhão.');
      parcelsToProcess = activeParcels.filter(p => p.talhaoId === batchTalhaoId);
    } else if (batchScope === 'parcela') {
      if (!batchParcelId) return alert('Por favor, selecione a parcela.');
      parcelsToProcess = activeParcels.filter(p => p.id === batchParcelId);
    }

    if (parcelsToProcess.length === 0) {
      return alert('Nenhuma parcela encontrada para processar.');
    }

    const hm = selectedHeightModelId !== 'none' ? heightModels.find(m => m.id === selectedHeightModelId) : null;
    let vm: any = null;
    let isLegacyVolume = false;
    let legacyFf = 0.7;

    if (selectedVolumeModelId === 'legacy') {
      isLegacyVolume = true;
      legacyFf = parseFloat(processingFatorForma);
      if (isNaN(legacyFf) || legacyFf <= 0) {
        return alert('Fator de forma comercial inválido.');
      }
    } else {
      vm = volumeModels.find(m => m.id === selectedVolumeModelId);
      if (!vm) {
        return alert('Modelo volumétrico não encontrado.');
      }
    }

    setIsBatchProcessing(true);
    let successCount = 0;

    try {
      for (const targetParcel of parcelsToProcess) {
        const updatedDados = targetParcel.dados.map((ind: any) => {
          const tree = { ...ind };
          let isHeightMeasured = false;
          let usedHeight = 0;
          let calculatedVol = 0;

          if (tree.multipleStems && tree.stems && tree.stems.length > 0) {
            let sumVol = 0;
            let maxStemHt = 0;
            let hasAnyEstimate = false;

            const updatedStems = tree.stems.map((stem: any) => {
              const stemCopy = { ...stem };
              const stemDap = getDapOfTreeOrStem(stemCopy);
              let stemHt = parseFloat(stemCopy.altura || '0');
              let stemHtMedidaOuEstimada: 'medida' | 'estimada' = 'medida';

              if (isNaN(stemHt) || stemHt <= 0) {
                const globalHt = parseFloat(tree.ht || '0');
                if (!isNaN(globalHt) && globalHt > 0) {
                  stemHt = globalHt;
                }
              }

              if ((isNaN(stemHt) || stemHt <= 0) && hm) {
                stemHt = evaluateHeightModel(hm, stemDap);
                stemHt = cleanResult(stemHt);
                stemHtMedidaOuEstimada = 'estimada';
                hasAnyEstimate = true;
              } else if (isNaN(stemHt) || stemHt <= 0) {
                stemHt = 0;
              }

              stemCopy.alturaProcessada = Number(stemHt.toFixed(2));
              stemCopy.alturaMedidaOuEstimada = stemHtMedidaOuEstimada;

              if (stemHt > maxStemHt) {
                maxStemHt = stemHt;
              }

              let stemVol = 0;
              if (isLegacyVolume) {
                const g = (Math.PI * Math.pow(stemDap / 100, 2)) / 4;
                stemVol = g * stemHt * legacyFf;
              } else if (vm) {
                stemVol = evaluateVolumeModel(vm, stemDap, stemHt);
              }
              stemVol = cleanResult(stemVol);
              stemCopy.volumeProcessado = Number(stemVol.toFixed(4));
              sumVol += stemVol;

              return stemCopy;
            });

            usedHeight = maxStemHt;
            calculatedVol = sumVol;
            isHeightMeasured = !hasAnyEstimate && tree.stems.every((s: any) => parseFloat(s.altura) > 0);
            tree.stems = updatedStems;

          } else {
            const treeDap = getDapOfTreeOrStem(tree);
            let treeHt = parseFloat(tree.ht || '0');
            let htMedidaOuEstimada: 'medida' | 'estimada' = 'medida';

            if ((isNaN(treeHt) || treeHt <= 0) && hm) {
              treeHt = evaluateHeightModel(hm, treeDap);
              treeHt = cleanResult(treeHt);
              htMedidaOuEstimada = 'estimada';
            } else if (isNaN(treeHt) || treeHt <= 0) {
              treeHt = 0;
            } else {
              isHeightMeasured = true;
            }

            usedHeight = treeHt;

            if (isLegacyVolume) {
              const g = (Math.PI * Math.pow(treeDap / 100, 2)) / 4;
              calculatedVol = g * treeHt * legacyFf;
            } else if (vm) {
              calculatedVol = evaluateVolumeModel(vm, treeDap, treeHt);
            }
            calculatedVol = cleanResult(calculatedVol);
            isHeightMeasured = htMedidaOuEstimada === 'medida';
          }

          tree.alturaUtilizada = Number(usedHeight.toFixed(2));
          tree.alturaMedidaOuEstimada = isHeightMeasured ? 'medida' : 'estimada';
          tree.volumeCalculado = Number(calculatedVol.toFixed(4));

          const hmDesc = hm ? `Hipsometria: ${hm.nome} (${hm.tipoModelo})` : 'Hipsometria: Não utilizada';
          const vmDesc = isLegacyVolume ? `Volume: Fator de Forma (${legacyFf})` : `Volume: ${vm.nome} (${vm.tipoModelo})`;
          tree.modeloUtilizado = `${hmDesc} | ${vmDesc}`;

          return tree;
        });

        const updatedInventory = {
          ...targetParcel,
          dados: updatedDados
        };

        await saveInventory(updatedInventory);
        successCount++;
      }

      alert(`Processamento concluído com sucesso em ${successCount} parcela(s)!`);
      onClose();
    } catch (e) {
      console.error(e);
      alert('Erro ao executar o processamento em lote.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

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
          maxWidth: '500px', 
          margin: 0, 
          maxHeight: '95vh', 
          overflowY: 'auto', 
          padding: '24px',
          borderRadius: '8px', // Subtle, professional roundness
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(7, 16, 10, 0.95)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <h3 style={{ margin: 0, fontSize: '18px', color: '#00e676', fontWeight: '800' }}>Processamento em Lote</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '6px', marginBottom: '20px', lineHeight: '1.4' }}>
          Execute o processamento matemático em lote para estimar as alturas faltantes e os volumes de fustes em várias parcelas simultaneamente.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {/* Escopo de Processamento */}
          <div>
            <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>Escopo do Processamento</label>
            <select
              className="input-field"
              style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px', borderRadius: '4px' }}
              value={batchScope}
              onChange={e => {
                const val = e.target.value as 'total' | 'talhao' | 'parcela';
                setBatchScope(val);
                setBatchTalhaoId('');
                setBatchParcelId(null);
              }}
            >
              <option value="total">Trabalho Completo (Todas as Parcelas)</option>
              <option value="talhao">Por Talhão</option>
              <option value="parcela">Por Parcela</option>
            </select>
          </div>

          {/* Se o escopo for talhao, escolhe o talhao */}
          {batchScope === 'talhao' && (
            <div>
              <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>Selecionar Talhão</label>
              <select
                className="input-field"
                style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px', borderRadius: '4px' }}
                value={batchTalhaoId}
                onChange={e => setBatchTalhaoId(e.target.value)}
              >
                <option value="">Selecione um talhão...</option>
                {activeTalhoes.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Se o escopo for parcela, escolhe a parcela */}
          {batchScope === 'parcela' && (
            <div>
              <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>Selecionar Parcela</label>
              <select
                className="input-field"
                style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px', borderRadius: '4px' }}
                value={batchParcelId || ''}
                onChange={e => setBatchParcelId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Selecione uma parcela...</option>
                {activeParcels.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Modelo Hipsométrico */}
          <div>
            <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>ETAPA 1: Selecionar Modelo Hipsométrico (Altura)</label>
            <select
              className="input-field"
              style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px', borderRadius: '4px' }}
              value={selectedHeightModelId}
              onChange={e => setSelectedHeightModelId(e.target.value)}
            >
              <option value="none">Não utilizar modelo (ignorar estimativa)</option>
              {heightModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({m.especie} | {m.regiao})
                </option>
              ))}
            </select>
          </div>

          {/* Modelo Volumétrico */}
          <div>
            <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>ETAPA 2: Selecionar Modelo Volumétrico (Volume)</label>
            <select
              className="input-field"
              style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px', borderRadius: '4px' }}
              value={selectedVolumeModelId}
              onChange={e => setSelectedVolumeModelId(e.target.value)}
            >
              <option value="legacy">Fator de Forma Comercial (Legacy)</option>
              {volumeModels.map(m => (
                <option key={m.id} value={m.id}>
                  {m.nome} ({m.especie} | {m.regiao})
                </option>
              ))}
            </select>
          </div>

          {/* Fator de Forma (se selecionado legacy) */}
          {selectedVolumeModelId === 'legacy' && (
            <div>
              <label className="input-label" style={{ fontWeight: 'bold', fontSize: '11.5px', color: 'var(--text-muted)' }}>Fator de Forma Comercial (Legacy) *</label>
              <input
                type="number"
                step="0.01"
                className="input-field"
                style={{ marginBottom: 0, marginTop: '4px', fontSize: '13px', height: '38px', borderRadius: '4px' }}
                value={processingFatorForma}
                onChange={e => setProcessingFatorForma(e.target.value)}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-secondary" 
            style={{ width: 'auto', borderRadius: '4px' }}
            onClick={onClose}
            disabled={isBatchProcessing}
          >
            Cancelar
          </button>
          <button 
            className="btn btn-primary" 
            style={{ 
              width: 'auto',
              background: 'linear-gradient(135deg, #00e676 0%, #082815 100%)', 
              border: 'none',
              color: '#ffffff',
              fontWeight: '800',
              boxShadow: '0 4px 14px rgba(0, 230, 118, 0.25)',
              borderRadius: '4px'
            }}
            onClick={handleBatchProcess}
            disabled={isBatchProcessing}
          >
            {isBatchProcessing ? 'Processando...' : 'Executar Processamento'}
          </button>
        </div>
      </div>
    </div>
  );
};
