import React, { useState, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Inventory, IndividualData } from '../types';

interface MapVisProps {
  inventories: Inventory[];
  onClose: () => void;
}

// Generate an array of distinct highlight colors
const MAP_COLORS = [
  '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', 
  '#ff8000', '#8000ff', '#ff0080', '#00ff80', '#80ff00', '#0080ff'
];

interface PointData {
  id: string;
  lat: number;
  lng: number;
  inventoryId: number;
  inventoryName: string;
  individualId: number;
  color: string;
}

// Helper to auto-fit bounds
const AutoFitBounds = ({ points }: { points: PointData[] }) => {
  const map = useMap();
  React.useEffect(() => {
    if (points.length > 0) {
      const g = points.map(p => [p.lat, p.lng] as [number, number]);
      const bounds = L.latLngBounds(g);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [points, map]);
  return null;
};

export const MapVisualization: React.FC<MapVisProps> = ({ inventories, onClose }) => {
  // Map of inventory ID to its display state
  const [visibleInventories, setVisibleInventories] = useState<Record<number, boolean>>(
    inventories.reduce((acc, inv) => ({ ...acc, [inv.id]: true }), {})
  );

  // Extract points
  const allPoints: PointData[] = useMemo(() => {
    const pts: PointData[] = [];
    inventories.forEach((inv, index) => {
      const color = MAP_COLORS[index % MAP_COLORS.length];
      inv.dados.forEach((ind: IndividualData) => {
        if (ind.coordenadas && typeof ind.coordenadas === 'string') {
          const parts = ind.coordenadas.split(',');
          if (parts.length === 2) {
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) {
              pts.push({
                id: ind.id,
                lat,
                lng,
                inventoryId: inv.id,
                inventoryName: inv.nome,
                individualId: ind.numeroIndividuo,
                color
              });
            }
          }
        }
      });
    });
    return pts;
  }, [inventories]);

  const visiblePoints = allPoints.filter(p => visibleInventories[p.inventoryId]);

  const exportCSV = () => {
    if (visiblePoints.length === 0) return alert("Nenhum ponto visível para extração.");
    let csv = 'Parcela,Individuo,Latitude,Longitude\n';
    visiblePoints.forEach(p => {
      csv += `"${p.inventoryName}",${p.individualId},${p.lat.toFixed(6)},${p.lng.toFixed(6)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mapa_Trabalho_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportKML = () => {
    if (visiblePoints.length === 0) return alert("Nenhum ponto visível para extração.");
    let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n`;
    
    // Group by inventory to make folders
    const grouped: Record<number, PointData[]> = {};
    visiblePoints.forEach(p => {
      if (!grouped[p.inventoryId]) grouped[p.inventoryId] = [];
      grouped[p.inventoryId].push(p);
    });

    Object.values(grouped).forEach(points => {
      const invName = points[0].inventoryName;
      kml += `  <Folder>\n    <name>${invName}</name>\n`;
      points.forEach(p => {
        kml += `    <Placemark>
      <name>Ind ${p.individualId}</name>
      <description>Parcela: ${p.inventoryName}</description>
      <Point>
        <coordinates>${p.lng},${p.lat},0</coordinates>
      </Point>
    </Placemark>\n`;
      });
      kml += `  </Folder>\n`;
    });
    
    kml += `</Document>\n</kml>`;
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Mapa_Trabalho_${Date.now()}.kml`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-color)', zIndex: 9999, display: 'flex', flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ padding: '16px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ color: 'var(--primary-color)' }}>🌍 Mapa GIS: Trabalhos de Campo</h2>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px' }} onClick={onClose}>✕ Fechar Mapa</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'row' }}>
        {/* Sidebar Legend and Filters */}
        <div style={{ width: '280px', background: '#161a18', borderRight: '1px solid var(--border-color)', padding: '16px', overflowY: 'auto' }}>
          <h3 style={{ marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Filtros de Parcela</h3>
          
          <button className="btn btn-secondary" style={{ padding: '8px', fontSize: '12px', marginBottom: '16px' }} onClick={() => {
             const anyFalse = Object.values(visibleInventories).some(v => !v);
             // If any is false, check all. Else uncheck all.
             const nextState = inventories.reduce((acc, inv) => ({ ...acc, [inv.id]: anyFalse }), {});
             setVisibleInventories(nextState);
          }}>Alternar Todos</button>

          {inventories.map((inv, idx) => {
            const hasPts = allPoints.some(p => p.inventoryId === inv.id);
            if (!hasPts) return null;
            
            const color = MAP_COLORS[idx % MAP_COLORS.length];
            return (
              <label key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={visibleInventories[inv.id] || false}
                  onChange={(e) => setVisibleInventories(prev => ({ ...prev, [inv.id]: e.target.checked }))}
                />
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color }}></div>
                <span style={{ fontSize: '14px', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{inv.nome}</span>
              </label>
            );
          })}

          <div style={{ marginTop: '32px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>📥 Extração GIS</h3>
            <button className="btn btn-primary" style={{ padding: '10px', fontSize: '12px', marginBottom: '12px' }} onClick={exportKML}>Google Earth (.KML)</button>
            <button className="btn btn-secondary" style={{ padding: '10px', fontSize: '12px' }} onClick={exportCSV}>Tabela SIG (.CSV)</button>
          </div>
        </div>

        {/* Map Container */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer 
            center={[-15.793889, -47.882778]} 
            zoom={4} 
            style={{ width: '100%', height: '100%', zIndex: 1 }}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
            />
            {allPoints.length > 0 && <AutoFitBounds points={visiblePoints} />}
            
            {visiblePoints.map(p => (
              <CircleMarker 
                key={`${p.inventoryId}-${p.id}`}
                center={[p.lat, p.lng]} 
                radius={6}
                pathOptions={{ color: 'white', weight: 1, fillColor: p.color, fillOpacity: 0.8 }}
              >
                <Popup>
                  <div style={{ color: 'black' }}>
                    <strong>{p.inventoryName}</strong><br/>
                    Indivíduo #{p.individualId}<br/>
                    Lat: {p.lat.toFixed(5)}<br/>
                    Lng: {p.lng.toFixed(5)}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};
