import React, { useState } from 'react';

export const Recovery = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
    console.log(msg);
  };

  const downloadObjectAsJson = (exportObj: any, exportName: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", exportName + ".json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const dumpStore = (db: IDBDatabase, storeName: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      try {
        if (!db.objectStoreNames.contains(storeName)) {
          resolve([]);
          return;
        }
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e);
      } catch (e) {
        reject(e);
      }
    });
  };

  const openDB = (dbName: string): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e);
    });
  };

  const handleRecover = async () => {
    setLoading(true);
    setLogs([]);
    addLog("Iniciando varredura do cache local do aparelho...");

    const dumpData: any = {};

    try {
      // 1. Tentar ler Firestore
      const firestoreDBName = 'firestore/[DEFAULT]/leaftag/main';
      addLog(`Procurando banco de dados do Firestore: ${firestoreDBName}`);
      
      try {
        const dbFirestore = await openDB(firestoreDBName);
        addLog("Banco do Firestore aberto com sucesso.");
        
        const stores = Array.from(dbFirestore.objectStoreNames);
        addLog(`Lojas encontradas: ${stores.join(', ')}`);
        
        dumpData.firestore = {};
        for (const storeName of stores) {
          addLog(`Lendo loja: ${storeName}...`);
          const data = await dumpStore(dbFirestore, storeName);
          dumpData.firestore[storeName] = data;
          addLog(`  -> ${data.length} registros encontrados.`);
        }
        dbFirestore.close();
      } catch (e: any) {
        addLog(`Falha ao ler Firestore: ${e.message}`);
      }

      // 2. Tentar ler Photos (LeafTagPhotosDB)
      const photosDBName = 'LeafTagPhotosDB';
      addLog(`Procurando banco de dados de fotos: ${photosDBName}`);
      try {
        const dbPhotos = await openDB(photosDBName);
        addLog("Banco de fotos aberto com sucesso.");
        
        dumpData.photos = {};
        if (dbPhotos.objectStoreNames.contains('photos')) {
           const data = await dumpStore(dbPhotos, 'photos');
           // Remove base64Data para não travar o JSON, mantém só metadados
           const metaData = data.map(p => ({ ...p, base64Data: p.base64Data ? 'EXISTS' : 'NONE' }));
           dumpData.photos['photos'] = metaData;
           addLog(`  -> ${data.length} fotos encontradas.`);
        }
        dbPhotos.close();
      } catch (e: any) {
        addLog(`Falha ao ler fotos: ${e.message}`);
      }

      // 3. Tentar ler LocalStorage e SessionStorage
      addLog("Coletando LocalStorage...");
      dumpData.localStorage = { ...localStorage };
      
      addLog("Gerando arquivo de backup...");
      downloadObjectAsJson(dumpData, `leaftag_recovery_${Date.now()}`);
      
      addLog("✅ Concluído! Arquivo gerado com sucesso.");
      addLog("Por favor, envie esse arquivo JSON para o desenvolvedor analisar.");

    } catch (e: any) {
      addLog(`❌ ERRO FATAL: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', color: '#fff' }}>
      <h2>🛠️ Modo de Recuperação de Emergência</h2>
      <p>Esta tela irá varrer as profundezas do armazenamento interno do seu celular em busca de qualquer rastro das árvores perdidas.</p>
      
      <button 
        onClick={handleRecover} 
        disabled={loading}
        style={{
          background: '#d32f2f',
          color: 'white',
          padding: '15px 20px',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          width: '100%',
          marginBottom: '20px'
        }}
      >
        {loading ? 'VARRENDO MEMÓRIA...' : 'CLIQUE AQUI PARA RESGATAR DADOS (BAIXAR JSON)'}
      </button>

      <div style={{ background: '#111', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '12px', minHeight: '200px' }}>
        {logs.map((log, i) => (
          <div key={i} style={{ marginBottom: '4px' }}>{log}</div>
        ))}
        {logs.length === 0 && <span style={{ color: '#666' }}>Aguardando comando...</span>}
      </div>
    </div>
  );
};
