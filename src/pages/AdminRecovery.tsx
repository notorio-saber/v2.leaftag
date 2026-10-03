import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const AdminRecovery = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const { currentUser } = useAuth();

  const addLog = (msg: string) => setLogs(p => [...p, msg]);

  const handleDownload = async () => {
    if (!currentUser) return addLog("Usuário não logado.");
    
    addLog("Buscando pedaços (chunks) no Firestore...");
    try {
      const colRef = collection(db, `users/${currentUser.uid}/recovery_dumps`);
      const snapshot = await getDocs(colRef);
      addLog(`Encontrados ${snapshot.docs.length} documentos.`);

      const docs = snapshot.docs.map(d => d.data());
      
      // Filtra os que parecem ser chunks
      const chunks = docs.filter(d => typeof d.index === 'number' && typeof d.chunk === 'string');
      addLog(`Encontrados ${chunks.length} chunks de dados.`);

      if (chunks.length === 0) {
        addLog("Nenhum chunk encontrado.");
        return;
      }

      // Agrupa por rodada (assumindo que a rodada com 52 chunks é a que queremos)
      // Se houver mais de uma rodada, pegamos a mais recente baseada no timestamp
      chunks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Vamos tentar pegar a última rodada de envios
      const targetTotal = chunks[0].total;
      const latestChunks = chunks.filter(c => c.total === targetTotal);
      
      addLog(`Montando rodada de ${targetTotal} chunks...`);
      
      // Ordena por index
      latestChunks.sort((a, b) => a.index - b.index);
      
      let fullJson = '';
      for (const c of latestChunks) {
        fullJson += c.chunk;
      }

      addLog(`JSON montado! Tamanho: ${Math.round(fullJson.length / 1024 / 1024)} MB`);

      const blob = new Blob([fullJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recovery_dump_completo.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      addLog("Download iniciado com sucesso!");
    } catch (e: any) {
      addLog(`Erro: ${e.message}`);
    }
  };

  return (
    <div style={{ padding: '20px', color: '#fff' }}>
      <h2>Painel de Resgate (Desktop)</h2>
      <button onClick={handleDownload} style={{ padding: '10px 20px', fontSize: '16px' }}>
        BAIXAR DUMP DO FIREBASE
      </button>
      <div style={{ marginTop: '20px', fontFamily: 'monospace' }}>
        {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
};
