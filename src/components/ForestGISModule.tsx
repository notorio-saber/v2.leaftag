import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, Polyline, GeoJSON, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import shp from 'shpjs';
import type { Inventory, Talhao } from '../types';
import { useInventory } from '../context/InventoryContext';

// ─── LAYER TYPES ──────────────────────────────────────────────────────────────
type LayerCategory = 'fazenda' | 'talhao' | 'estrada' | 'parcela' | 'arvore' | 'outro';
type MapBasemap = 'satellite' | 'street' | 'hybrid';
type DrawMode = 'idle' | 'drawing' | 'editing';
type ActiveTool = 'select' | 'point' | 'polyline' | 'polygon';

interface PendingShape {
  type: 'Point' | 'LineString' | 'Polygon';
  coords: [number, number][];
}

interface GISLayer {
  id: string;
  name: string;
  category: LayerCategory;
  color: string;
  opacity: number;
  visible: boolean;
  geojson: GeoJSON.FeatureCollection;
  featureCount: number;
  geometryType: string;
  source: 'upload' | 'inventory' | 'drawn';
}

interface ForestGISModuleProps {
  inventories: Inventory[];
  talhoes: Talhao[];
  fieldWorkId: string;
  onClose: () => void;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const CATEGORY_CONFIG: Record<LayerCategory, { label: string; emoji: string; defaultColor: string }> = {
  fazenda:  { label: 'Fazenda',  emoji: '🏡', defaultColor: '#ffab40' },
  talhao:   { label: 'Talhão',   emoji: '🌲', defaultColor: '#00e676' },
  estrada:  { label: 'Estrada',  emoji: '🛣️',  defaultColor: '#90caf9' },
  parcela:  { label: 'Parcela',  emoji: '📍', defaultColor: '#40c4ff' },
  arvore:   { label: 'Árvore',   emoji: '🌳', defaultColor: '#b2ff59' },
  outro:    { label: 'Outro',    emoji: '📁', defaultColor: '#ea80fc' },
};

const TILE_LAYERS: Record<MapBasemap, { url: string; attribution: string }> = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  hybrid: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
  },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcPolygonAreaHa(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let area = 0;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dLng = toRad(polygon[j][1] - polygon[i][1]);
    area += dLng * R * R * Math.sin((toRad(polygon[i][0]) + toRad(polygon[j][0])) / 2);
  }
  return Math.abs(area / 2) / 10000;
}

function geojsonBounds(fc: GeoJSON.FeatureCollection): L.LatLngBoundsExpression | null {
  const pts: [number, number][] = [];
  const collect = (coords: any) => {
    if (typeof coords[0] === 'number') {
      pts.push([coords[1] as number, coords[0] as number]);
    } else {
      coords.forEach(collect);
    }
  };
  fc.features.forEach(f => {
    if (f.geometry) collect((f.geometry as any).coordinates);
  });
  if (pts.length === 0) return null;
  return L.latLngBounds(pts);
}

function detectGeometryType(fc: GeoJSON.FeatureCollection): string {
  const types = new Set(fc.features.map(f => f.geometry?.type || 'Unknown'));
  return [...types].join(', ');
}

function downloadBlob(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now();
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const HybridLabels = ({ active }: { active: boolean }) => {
  const map = useMap();
  const ref = useRef<L.TileLayer | null>(null);
  useEffect(() => {
    if (active) {
      ref.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { opacity: 0.32 }).addTo(map);
    } else {
      if (ref.current) { map.removeLayer(ref.current); ref.current = null; }
    }
    return () => { if (ref.current) { map.removeLayer(ref.current); ref.current = null; } };
  }, [active, map]);
  return null;
};

const FitBoundsOnLoad = ({ layers, parcelas }: { layers: GISLayer[]; parcelas: [number, number][] }) => {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const pts: [number, number][] = [...parcelas];
    layers.forEach(l => {
      const b = geojsonBounds(l.geojson);
      if (b) {
        const bounds = b as L.LatLngBounds;
        pts.push([bounds.getSouth(), bounds.getWest()]);
        pts.push([bounds.getNorth(), bounds.getEast()]);
      }
    });
    if (pts.length > 0) {
      try { map.fitBounds(L.latLngBounds(pts), { padding: [48, 48] }); fitted.current = true; } catch {}
    }
  }, [layers, parcelas, map]);
  return null;
};

const FlyToLayer = ({ bounds }: { bounds: L.LatLngBoundsExpression | null }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      try { map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 }); } catch {}
    }
  }, [bounds, map]);
  return null;
};

const DrawHandler = ({
  drawMode, draftPoints, setDraftPoints, onFinish, onCancel,
}: {
  drawMode: DrawMode;
  draftPoints: [number, number][];
  setDraftPoints: React.Dispatch<React.SetStateAction<[number, number][]>>;
  onFinish: (pts: [number, number][]) => void;
  onCancel: () => void;
}) => {
  useMapEvents({
    click(e) {
      if (drawMode !== 'drawing') return;
      setDraftPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
    },
    dblclick(e) {
      if (drawMode !== 'drawing') return;
      e.originalEvent.preventDefault();
      const final: [number, number][] = [...draftPoints, [e.latlng.lat, e.latlng.lng]];
      if (final.length >= 3) onFinish(final); else onCancel();
    },
  });
  return null;
};

// ─── MANUAL DRAW HANDLER (general tools) ─────────────────────────────────────
const ManualDrawHandler = ({
  activeTool,
  coords,
  setCoords,
  mousePos,
  setMousePos,
  onPointPlaced,
  onShapeFinished,
}: {
  activeTool: ActiveTool;
  coords: [number, number][];
  setCoords: React.Dispatch<React.SetStateAction<[number, number][]>>;
  mousePos: [number, number] | null;
  setMousePos: React.Dispatch<React.SetStateAction<[number, number] | null>>;
  onPointPlaced: (pos: [number, number]) => void;
  onShapeFinished: (coords: [number, number][]) => void;
}) => {
  const map = useMap();

  useEffect(() => {
    if (activeTool === 'select') {
      map.getContainer().style.cursor = '';
    } else {
      map.getContainer().style.cursor = 'crosshair';
    }
    return () => { map.getContainer().style.cursor = ''; };
  }, [activeTool, map]);

  useMapEvents({
    mousemove(e) {
      if (activeTool === 'select') return;
      setMousePos([e.latlng.lat, e.latlng.lng]);
    },
    click(e) {
      if (activeTool === 'select') return;
      const pos: [number, number] = [e.latlng.lat, e.latlng.lng];
      if (activeTool === 'point') {
        onPointPlaced(pos);
        return;
      }
      setCoords(prev => [...prev, pos]);
    },
    dblclick(e) {
      if (activeTool === 'polyline' || activeTool === 'polygon') {
        e.originalEvent.preventDefault();
        const pos: [number, number] = [e.latlng.lat, e.latlng.lng];
        const final = [...coords, pos];
        const minPts = activeTool === 'polygon' ? 3 : 2;
        if (final.length >= minPts) onShapeFinished(final);
      }
    },
  });
  return null;
};

const EditVertex = ({ position, index, onDrag }: {
  position: [number, number]; index: number;
  onDrag: (i: number, p: [number, number]) => void;
}) => {
  const map = useMap();
  useEffect(() => {
    const m = L.circleMarker(position, { radius: 8, color: '#fff', weight: 2, fillColor: '#00e676', fillOpacity: 1 }).addTo(map);
    m.on('mousedown', () => {
      map.dragging.disable();
      const mv = (e: L.LeafletMouseEvent) => { m.setLatLng(e.latlng); onDrag(index, [e.latlng.lat, e.latlng.lng]); };
      const up = () => { map.dragging.enable(); map.off('mousemove', mv as any); map.off('mouseup', up as any); };
      map.on('mousemove', mv as any); map.on('mouseup', up as any);
    });
    return () => { map.removeLayer(m); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1], map, index]);
  return null;
};

// ─── UPLOAD ZONE ──────────────────────────────────────────────────────────────
const UploadZone = ({ onUpload, isProcessing }: {
  onUpload: (file: File) => void;
  isProcessing: boolean;
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };

  return (
    <div
      onClick={() => !isProcessing && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${isDragOver ? '#00e676' : 'rgba(0,230,118,0.3)'}`,
        borderRadius: '12px',
        padding: '20px 12px',
        textAlign: 'center',
        cursor: isProcessing ? 'wait' : 'pointer',
        background: isDragOver ? 'rgba(0,230,118,0.08)' : 'rgba(0,230,118,0.03)',
        transition: 'all 0.2s',
        marginBottom: '12px',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.geojson,.json,.kml"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
      />
      {isProcessing ? (
        <div style={{ color: '#00e676', fontSize: '12px' }}>
          <div style={{ fontSize: '20px', marginBottom: '6px' }}>⏳</div>
          Processando shapefile...
        </div>
      ) : (
        <>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📂</div>
          <div style={{ color: '#fff', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
            Arraste ou clique para importar
          </div>
          <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.5 }}>
            Shapefile (.zip com .shp+.dbf)<br />
            GeoJSON (.json / .geojson)<br />
            KML (.kml)
          </div>
        </>
      )}
    </div>
  );
};

// ─── COLOR PALETTE ────────────────────────────────────────────────────────────
const QUICK_COLORS = ['#00e676','#40c4ff','#ffab40','#ff5252','#ea80fc','#b2ff59','#ffd740','#18ffff','#ff6d00','#90caf9'];

// ─── MAP DRAW TOOLBAR (floating) ─────────────────────────────────────────────
const MapDrawToolbar = ({
  activeTool,
  setActiveTool,
  canUndo,
  canFinish,
  onUndo,
  onFinish,
  onCancel,
  coordCount,
}: {
  activeTool: ActiveTool;
  setActiveTool: (t: ActiveTool) => void;
  canUndo: boolean;
  canFinish: boolean;
  onUndo: () => void;
  onFinish: () => void;
  onCancel: () => void;
  coordCount: number;
}) => {
  const TOOLS: { id: ActiveTool; label: string; hint: string; icon: React.ReactNode }[] = [
    {
      id: 'select', label: 'Selecionar', hint: 'Modo navegação (pan/zoom)',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 0l16 12-7 2-4 8L4 0z"/>
        </svg>
      ),
    },
    {
      id: 'point', label: 'Ponto', hint: 'Adicionar marcador — clique para posicionar',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="10" r="4"/>
          <path d="M12 14v7"/>
          <path d="M8 21h8"/>
        </svg>
      ),
    },
    {
      id: 'polyline', label: 'Traçado', hint: 'Desenhar linha/caminho — duplo-clique para finalizar',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="3,20 8,8 15,15 21,4"/>
        </svg>
      ),
    },
    {
      id: 'polygon', label: 'Polígono', hint: 'Desenhar área — duplo-clique para fechar',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polygon points="12,2 21,8.5 18,19 6,19 3,8.5"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{
      position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
      zIndex: 900, display: 'flex', flexDirection: 'column', gap: '4px',
    }}>
      {/* Tool buttons */}
      <div style={{
        background: 'rgba(7,16,10,0.92)',
        border: '1px solid rgba(0,230,118,0.2)',
        borderRadius: '12px',
        padding: '6px',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', gap: '4px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
        {TOOLS.map(tool => {
          const isActive = activeTool === tool.id;
          return (
            <div key={tool.id} style={{ position: 'relative' }} className="gis-tool-wrapper">
              <button
                title={tool.hint}
                onClick={() => setActiveTool(tool.id)}
                style={{
                  width: '38px', height: '38px', borderRadius: '8px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? 'rgba(0,230,118,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  color: isActive ? '#00e676' : '#888',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; } }}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#888'; } }}
              >
                {tool.icon}
              </button>
            </div>
          );
        })}

        {/* Divider */}
        {activeTool !== 'select' && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '2px 0' }} />

            {/* Undo */}
            <button
              title="Desfazer último ponto"
              onClick={onUndo}
              disabled={!canUndo}
              style={{
                width: '38px', height: '38px', borderRadius: '8px', cursor: canUndo ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: canUndo ? '#ffab40' : '#444',
                transition: 'all 0.15s',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 14 4 9 9 4"/>
                <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
              </svg>
            </button>

            {/* Confirm */}
            {canFinish && (
              <button
                title="Confirmar forma"
                onClick={onFinish}
                style={{
                  width: '38px', height: '38px', borderRadius: '8px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,230,118,0.2)',
                  border: '1px solid rgba(0,230,118,0.5)',
                  color: '#00e676', transition: 'all 0.15s',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </button>
            )}

            {/* Cancel */}
            <button
              title="Cancelar desenho (ESC)"
              onClick={onCancel}
              style={{
                width: '38px', height: '38px', borderRadius: '8px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,82,82,0.1)',
                border: '1px solid rgba(255,82,82,0.3)',
                color: '#ff5252', transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Status badge */}
      {activeTool !== 'select' && (
        <div style={{
          background: 'rgba(7,16,10,0.92)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0,230,118,0.2)', borderRadius: '8px',
          padding: '5px 8px', fontSize: '10px', color: '#00e676', fontWeight: '700',
          textAlign: 'center', lineHeight: 1.4,
        }}>
          {activeTool === 'point' ? '📍 Clique' : activeTool === 'polyline' ? '〰️ Traçado' : '⬡ Polígono'}
          {coordCount > 0 && <><br /><span style={{ color: '#fff' }}>{coordCount} pt{coordCount !== 1 ? 's' : ''}</span></>}
        </div>
      )}
    </div>
  );
};

// ─── SAVE SHAPE DIALOG ────────────────────────────────────────────────────────
const SaveShapeDialog = ({
  shape,
  onSave,
  onCancel,
}: {
  shape: PendingShape;
  onSave: (name: string, category: LayerCategory, color: string) => void;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(
    shape.type === 'Point' ? 'Ponto' : shape.type === 'LineString' ? 'Traçado' : 'Polígono'
  );
  const [category, setCategory] = useState<LayerCategory>(
    shape.type === 'Point' ? 'outro' : shape.type === 'LineString' ? 'estrada' : 'talhao'
  );
  const [color, setColor] = useState(QUICK_COLORS[0]);

  const typeLabel = shape.type === 'Point' ? '📍 Ponto' : shape.type === 'LineString' ? '〰️ Traçado' : '⬡ Polígono';

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0c1910', border: '1px solid rgba(0,230,118,0.25)',
        borderRadius: '16px', padding: '24px', width: '340px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
          }}>
            {shape.type === 'Point' ? '📍' : shape.type === 'LineString' ? '〰️' : '⬡'}
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: '800', fontSize: '15px' }}>Salvar {typeLabel}</div>
            <div style={{ color: '#888', fontSize: '11px' }}>
              {shape.type === 'Point' ? '1 ponto' : `${shape.coords.length} vértices`}
            </div>
          </div>
        </div>

        {/* Name */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px' }}>Nome da Camada</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim(), category, color); }}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px' }}>Tipo</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
            {(Object.entries(CATEGORY_CONFIG) as [LayerCategory, typeof CATEGORY_CONFIG[LayerCategory]][]).map(([k, v]) => (
              <button key={k} onClick={() => { setCategory(k); setColor(v.defaultColor); }} style={{
                padding: '7px 4px', fontSize: '10px', fontWeight: '700',
                borderRadius: '7px', cursor: 'pointer', border: '1px solid',
                background: category === k ? `${v.defaultColor}22` : 'rgba(255,255,255,0.03)',
                borderColor: category === k ? v.defaultColor : 'rgba(255,255,255,0.08)',
                color: category === k ? v.defaultColor : '#777', textAlign: 'center',
                transition: 'all 0.15s',
              }}>
                {v.emoji}<br/>{v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px' }}>Cor</label>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {QUICK_COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{
                width: 24, height: 24, borderRadius: 6, background: c, cursor: 'pointer',
                border: color === c ? '2px solid white' : '2px solid transparent',
                transition: 'border 0.1s',
              }} />
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { if (name.trim()) onSave(name.trim(), category, color); }}
            disabled={!name.trim()}
            style={{
              flex: 1, padding: '10px', fontSize: '13px', fontWeight: '700',
              borderRadius: '9px', cursor: name.trim() ? 'pointer' : 'not-allowed',
              background: name.trim() ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${name.trim() ? 'rgba(0,230,118,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: name.trim() ? '#00e676' : '#555',
            }}
          >✓ Salvar Camada</button>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 16px', fontSize: '13px', fontWeight: '700', borderRadius: '9px', cursor: 'pointer',
              background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.25)', color: '#ff5252',
            }}
          >✕</button>
        </div>
      </div>
    </div>
  );
};

// ─── GEOJSON LAYER RENDERER ───────────────────────────────────────────────────
const GeoJSONLayer = ({ layer, onFeatureClick }: {
  layer: GISLayer;
  onFeatureClick?: (props: Record<string, unknown>) => void;
}) => {
  if (!layer.visible) return null;

  const style = (): L.PathOptions => ({
    color: layer.color,
    weight: 2,
    opacity: layer.opacity,
    fillColor: layer.color,
    fillOpacity: layer.opacity * 0.25,
  });

  const pointToLayer = (_: GeoJSON.Feature, latlng: L.LatLng) => {
    return L.circleMarker(latlng, {
      radius: 6,
      color: '#fff',
      weight: 1.5,
      fillColor: layer.color,
      fillOpacity: layer.opacity,
    });
  };

  const onEachFeature = (feature: GeoJSON.Feature, leafletLayer: L.Layer) => {
    if (!feature.properties) return;
    const props = feature.properties as Record<string, unknown>;
    const rows = Object.entries(props)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .slice(0, 8)
      .map(([k, v]) => `<tr><td style="color:#888;font-size:10px;padding:2px 6px 2px 0">${k}</td><td style="color:#fff;font-size:11px;font-weight:600">${v}</td></tr>`)
      .join('');

    leafletLayer.bindPopup(`
      <div style="background:#0f1a12;border-radius:8px;padding:10px;min-width:160px;max-width:240px">
        <div style="color:#00e676;font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:8px;letter-spacing:0.8px">
          ${CATEGORY_CONFIG[layer.category].emoji} ${layer.name}
        </div>
        <table style="width:100%">${rows}</table>
      </div>
    `, { className: 'leaftag-popup' });

    leafletLayer.on('click', () => onFeatureClick?.(props));
  };

  return (
    <GeoJSON
      key={`${layer.id}-${layer.color}-${layer.opacity}-${layer.visible}`}
      data={layer.geojson}
      style={style}
      pointToLayer={pointToLayer}
      onEachFeature={onEachFeature}
    />
  );
};

// ─── MAP SEARCH BOX ───────────────────────────────────────────────────────────
interface MapSearchBoxProps {
  talhaoStats: any[];
  parcelPoints: { pos: [number, number]; inv: Inventory }[];
  layers: GISLayer[];
  setSelectedLayerId: (id: string | null) => void;
  setFeatureInfo: (info: Record<string, unknown> | null) => void;
}

const MapSearchBox = ({
  talhaoStats,
  parcelPoints,
  layers,
  setSelectedLayerId,
  setFeatureInfo,
}: MapSearchBoxProps) => {
  const map = useMap();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const matchedTalhoes = talhaoStats
      .filter(ts => ts.talhao.nome.toLowerCase().includes(q))
      .map(ts => ({
        type: 'talhao' as const,
        id: `talhao-${ts.talhao.id}`,
        title: ts.talhao.nome,
        subtitle: `${ts.calcArea ? ts.calcArea.toFixed(2) : ts.talhao.area?.toFixed(1) || '—'} ha • ${ts.parcels} parcelas`,
        coords: ts.talhao.polygon,
        data: ts
      }));

    const matchedParcelas = parcelPoints
      .filter(p => p.inv.nome.toLowerCase().includes(q))
      .map(p => ({
        type: 'parcela' as const,
        id: `parcela-${p.inv.id}`,
        title: p.inv.nome,
        subtitle: `Talhão: ${talhaoStats.find(t => t.talhao.id === p.inv.talhaoId)?.talhao.nome || 'Sem Talhão'}`,
        coords: [p.pos] as [number, number][],
        data: p
      }));

    const matchedFeatures: any[] = [];
    layers.forEach(layer => {
      layer.geojson.features.forEach((f, idx) => {
        const props = f.properties || {};
        const nameVal = props.nome || props.name || props.id || props.Name || '';
        const nameStr = String(nameVal);

        let matches = nameStr.toLowerCase().includes(q);
        if (!matches) {
          matches = Object.values(props).some(v => typeof v === 'string' && v.toLowerCase().includes(q));
        }

        if (matches) {
          let coords: [number, number][] = [];
          if (f.geometry) {
            if (f.geometry.type === 'Point') {
              const [lng, lat] = f.geometry.coordinates;
              coords = [[lat, lng]];
            } else if (f.geometry.type === 'Polygon') {
              coords = f.geometry.coordinates[0].map(([lng, lat]: any) => [lat, lng]);
            } else if (f.geometry.type === 'LineString') {
              coords = f.geometry.coordinates.map(([lng, lat]: any) => [lat, lng]);
            } else if (f.geometry.type === 'MultiPolygon') {
              coords = f.geometry.coordinates[0][0].map(([lng, lat]: any) => [lat, lng]);
            }
          }

          matchedFeatures.push({
            type: 'feature' as const,
            id: `feature-${layer.id}-${idx}`,
            title: nameStr || `Elemento ${idx + 1}`,
            subtitle: `Camada: ${layer.name}`,
            coords,
            properties: props,
            layerId: layer.id,
            data: f
          });
        }
      });
    });

    const coordRegex = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;
    const match = query.match(coordRegex);
    const matchedCoords: any[] = [];
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[3]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        matchedCoords.push({
          type: 'coordinate' as const,
          id: `coord-${lat}-${lng}`,
          title: `Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          subtitle: 'Clique para voar para esta posição',
          coords: [[lat, lng]] as [number, number][],
          data: { lat, lng }
        });
      }
    }

    const localResults = [...matchedTalhoes, ...matchedParcelas, ...matchedFeatures, ...matchedCoords].slice(0, 30);

    if (query.trim().length > 2) {
      localResults.push({
        type: 'geocoding' as const,
        id: `geocoding-${query}`,
        title: `Buscar "${query}" no OpenStreetMap`,
        subtitle: 'Pesquisa geográfica externa (requer internet)',
        coords: [],
        data: query
      });
    }

    return localResults;
  }, [query, talhaoStats, parcelPoints, layers]);

  const handleItemClick = (item: any) => {
    setQuery('');
    setIsOpen(false);

    if (item.type === 'talhao') {
      setSelectedLayerId(item.id);
      if (item.coords && item.coords.length >= 3) {
        const bounds = L.latLngBounds(item.coords);
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
      } else {
        const pts = parcelPoints.filter(p => p.inv.talhaoId === item.data.talhao.id).map(p => p.pos);
        if (pts.length > 0) {
          const bounds = L.latLngBounds(pts);
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
        }
      }
    } else if (item.type === 'parcela') {
      const pos = item.data.pos;
      map.flyTo(pos, 17, { duration: 1.5 });
      setSelectedLayerId(`talhao-${item.data.inv.talhaoId}`);
    } else if (item.type === 'feature') {
      setSelectedLayerId(item.layerId);
      setFeatureInfo(item.properties);
      if (item.coords && item.coords.length > 0) {
        if (item.coords.length === 1) {
          map.flyTo(item.coords[0], 17, { duration: 1.5 });
        } else {
          const bounds = L.latLngBounds(item.coords);
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
        }
      }
    } else if (item.type === 'coordinate') {
      const { lat, lng } = item.data;
      map.flyTo([lat, lng], 17, { duration: 1.5 });
    } else if (item.type === 'geocoding') {
      const q = item.data;
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            const loc = data[0];
            const lat = parseFloat(loc.lat);
            const lng = parseFloat(loc.lon);
            if (!isNaN(lat) && !isNaN(lng)) {
              if (loc.boundingbox) {
                const [s, n, w, e] = loc.boundingbox.map(Number);
                map.fitBounds(L.latLngBounds([s, w], [n, e]), { padding: [48, 48] });
              } else {
                map.flyTo([lat, lng], 15, { duration: 1.5 });
              }
            }
          } else {
            alert(`Nenhum local encontrado para "${q}"`);
          }
        })
        .catch(err => {
          console.error(err);
          alert('Erro ao buscar localização. Verifique sua conexão.');
        });
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: '12px',
        left: '12px',
        zIndex: 900,
        width: '320px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(7, 16, 10, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0, 230, 118, 0.25)',
          borderRadius: '12px',
          padding: '0 12px',
          height: '42px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          transition: 'all 0.2s ease-in-out',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#00e676"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: '10px', flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar talhão, parcela, elemento..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '13px',
            fontWeight: '500',
            padding: 0,
            width: '100%',
          }}
        />

        {query && (
          <button
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
          >
            ✕
          </button>
        )}
      </div>

      {isOpen && query.trim() && (
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: 0,
            width: '100%',
            maxHeight: '320px',
            overflowY: 'auto',
            background: 'rgba(7, 16, 10, 0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(0, 230, 118, 0.25)',
            borderRadius: '12px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
            zIndex: 901,
            padding: '6px 0',
          }}
          className="gis-search-results"
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: '16px',
                color: '#666',
                fontSize: '12px',
                textAlign: 'center',
              }}
            >
              Nenhum resultado encontrado.
              <div style={{ fontSize: '10px', color: '#444', marginTop: '4px' }}>
                Digite coordenadas como "-15.79, -47.88" para ir direto
              </div>
            </div>
          ) : (
            results.map((item) => {
              let emoji = '🔍';
              let badgeColor = '#666';
              let badgeText = '';

              if (item.type === 'talhao') {
                emoji = '🌲';
                badgeColor = '#00e676';
                badgeText = 'Talhão';
              } else if (item.type === 'parcela') {
                emoji = '📍';
                badgeColor = '#40c4ff';
                badgeText = 'Parcela';
              } else if (item.type === 'feature') {
                emoji = '📂';
                badgeColor = '#ea80fc';
                badgeText = 'Gis';
              } else if (item.type === 'coordinate') {
                emoji = '🌍';
                badgeColor = '#ffab40';
                badgeText = 'Coordenadas';
              }

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 230, 118, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '16px', marginRight: '10px', flexShrink: 0 }}>
                    {emoji}
                  </span>

                  <div style={{ flex: 1, minWidth: 0, marginRight: '8px' }}>
                    <div
                      style={{
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '700',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        color: '#888',
                        fontSize: '10px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: '1px',
                      }}
                    >
                      {item.subtitle}
                    </div>
                  </div>

                  {badgeText && (
                    <span
                      style={{
                        fontSize: '8px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        color: badgeColor,
                        background: `${badgeColor}15`,
                        border: `1px solid ${badgeColor}35`,
                        flexShrink: 0,
                      }}
                    >
                      {badgeText}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export const ForestGISModule: React.FC<ForestGISModuleProps> = ({
  inventories, talhoes, fieldWorkId, onClose,
}) => {
  const { createTalhao } = useInventory();

  // ── State ──────────────────────────────────────────────────────────────────
  const [basemap, setBasemap] = useState<MapBasemap>('satellite');
  const [layers, setLayers] = useState<GISLayer[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);

  // Pending layer (after parsing, before category assignment)
  const [pendingLayer, setPendingLayer] = useState<Omit<GISLayer, 'category'> | null>(null);
  const [pendingCategory, setPendingCategory] = useState<LayerCategory>('talhao');

  // UI state
  const [sidebarTab, setSidebarTab] = useState<'layers' | 'talhoes'>('layers');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [flyToBounds, setFlyToBounds] = useState<L.LatLngBoundsExpression | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Talhão polygons draw state
  const [drawMode, setDrawMode] = useState<DrawMode>('idle');
  const [drawingTalhaoId, setDrawingTalhaoId] = useState<string | null>(null);
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const [editingPolygon, setEditingPolygon] = useState<[number, number][] | null>(null);
  const [isSavingPolygon, setIsSavingPolygon] = useState(false);

  // Manual draw tool state
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [toolCoords, setToolCoords] = useState<[number, number][]>([]);
  const [mousePos, setMousePos] = useState<[number, number] | null>(null);
  const [pendingShape, setPendingShape] = useState<PendingShape | null>(null);

  // Parcel & tree visibility
  const [showParcelas, setShowParcelas] = useState(true);
  const [showArvores, setShowArvores] = useState(false);
  const [showTalhaoPolygons, setShowTalhaoPolygons] = useState(true);

  // Feature info panel
  const [featureInfo, setFeatureInfo] = useState<Record<string, unknown> | null>(null);

  // ESC key to cancel drawing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeTool !== 'select') { setActiveTool('select'); setToolCoords([]); setMousePos(null); }
        if (drawMode !== 'idle') cancelDraw();
        if (pendingShape) setPendingShape(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, drawMode, pendingShape]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const parcelPoints = useMemo(() => {
    return inventories
      .filter(inv => inv.coordenadas)
      .map(inv => {
        const parts = (inv.coordenadas || '').split(',');
        const lat = parseFloat(parts[0]?.trim()), lng = parseFloat(parts[1]?.trim());
        if (isNaN(lat) || isNaN(lng)) return null;
        return { pos: [lat, lng] as [number, number], inv };
      }).filter(Boolean) as { pos: [number, number]; inv: Inventory }[];
  }, [inventories]);

  const treePoints = useMemo(() => {
    if (!showArvores) return [];
    const pts: { pos: [number, number]; inv: Inventory; num: number }[] = [];
    inventories.forEach(inv => inv.dados.forEach(d => {
      if (d.coordenadas) {
        const parts = d.coordenadas.split(',');
        const lat = parseFloat(parts[0]?.trim()), lng = parseFloat(parts[1]?.trim());
        if (!isNaN(lat) && !isNaN(lng)) pts.push({ pos: [lat, lng], inv, num: d.numeroIndividuo });
      }
    }));
    return pts;
  }, [inventories, showArvores]);

  const talhaoStats = useMemo(() => talhoes.map((t, idx) => {
    const COLORS = ['#00e676','#40c4ff','#ea80fc','#ffab40','#ff5252','#18ffff','#b2ff59','#ffd740','#ff6d00','#d500f9','#00b0ff','#76ff03'];
    const parcels = inventories.filter(i => i.talhaoId === t.id);
    const trees = parcels.reduce((s, i) => s + (i.dados?.length || 0), 0);
    const processedParcels = parcels.filter(p => p.dados?.some(d => d.volumeCalculado !== undefined));
    const volHa = processedParcels.length > 0
      ? processedParcels.reduce((s, p) => {
          const vol = p.dados.reduce((a, d) => a + (d.volumeCalculado || 0), 0);
          const fe = p.areaParcela > 0 ? 10000 / p.areaParcela : 0;
          return s + vol * fe;
        }, 0) / processedParcels.length
      : null;
    return { talhao: t, color: COLORS[idx % COLORS.length], parcels: parcels.length, trees, volHa,
      calcArea: t.polygon ? calcPolygonAreaHa(t.polygon) : null };
  }), [talhoes, inventories]);

  // ── Shapefile Parsing ──────────────────────────────────────────────────────
  const handleFileUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    setProcessError(null);
    try {
      let geojson: GeoJSON.FeatureCollection | GeoJSON.FeatureCollection[];

      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'zip') {
        // Shapefile ZIP
        const buffer = await file.arrayBuffer();
        const result = await shp(buffer);
        geojson = result;
      } else if (ext === 'geojson' || ext === 'json') {
        // GeoJSON
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed.type === 'FeatureCollection') {
          geojson = parsed as GeoJSON.FeatureCollection;
        } else if (parsed.type === 'Feature') {
          geojson = { type: 'FeatureCollection', features: [parsed] };
        } else {
          throw new Error('Arquivo GeoJSON inválido.');
        }
      } else if (ext === 'kml') {
        // KML — basic parser
        const text = await file.text();
        geojson = parseKML(text);
      } else {
        throw new Error('Formato não suportado. Use .zip (Shapefile), .geojson ou .kml');
      }

      // Handle array of FeatureCollections (multi-layer shapefile zip)
      const collections: GeoJSON.FeatureCollection[] = Array.isArray(geojson) ? geojson : [geojson];

      for (const fc of collections) {
        if (!fc.features || fc.features.length === 0) continue;

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const geomType = detectGeometryType(fc);

        // Detect category from filename
        const lower = baseName.toLowerCase();
        let category: LayerCategory = 'outro';
        if (lower.includes('fazenda') || lower.includes('farm') || lower.includes('propriedade')) category = 'fazenda';
        else if (lower.includes('talhao') || lower.includes('talhão') || lower.includes('stand') || lower.includes('compartimento')) category = 'talhao';
        else if (lower.includes('estrada') || lower.includes('road') || lower.includes('acesso') || lower.includes('via')) category = 'estrada';
        else if (lower.includes('parcela') || lower.includes('plot') || lower.includes('amostra')) category = 'parcela';
        else if (lower.includes('arvore') || lower.includes('árvore') || lower.includes('tree') || lower.includes('planta')) category = 'arvore';

        const newLayer: Omit<GISLayer, 'category'> = {
          id: generateId(),
          name: collections.length > 1 ? `${baseName} (${geomType})` : baseName,
          color: CATEGORY_CONFIG[category].defaultColor,
          opacity: 0.85,
          visible: true,
          geojson: fc,
          featureCount: fc.features.length,
          geometryType: geomType,
        };

        setPendingLayer(newLayer);
        setPendingCategory(category);
      }
    } catch (err: any) {
      console.error('GIS parse error:', err);
      setProcessError(err.message || 'Erro ao processar o arquivo.');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const confirmAddLayer = () => {
    if (!pendingLayer) return;
    const layer: GISLayer = { ...pendingLayer, category: pendingCategory };
    setLayers(prev => [...prev, layer]);
    const bounds = geojsonBounds(layer.geojson);
    if (bounds) setFlyToBounds(bounds);
    setPendingLayer(null);
  };

  const removeLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const updateLayer = (id: string, patch: Partial<GISLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  // ── Tool drawing handlers ───────────────────────────────────────────────────
  const handleToolChange = (tool: ActiveTool) => {
    setActiveTool(tool);
    setToolCoords([]);
    setMousePos(null);
  };

  const handlePointPlaced = (pos: [number, number]) => {
    setPendingShape({ type: 'Point', coords: [pos] });
    setToolCoords([]);
  };

  const handleShapeFinished = (coords: [number, number][]) => {
    const type = activeTool === 'polyline' ? 'LineString' : 'Polygon';
    setPendingShape({ type, coords });
    setToolCoords([]);
    setMousePos(null);
  };

  const handleUndoVertex = () => {
    setToolCoords(prev => prev.slice(0, -1));
  };

  const handleConfirmTool = () => {
    const minPts = activeTool === 'polygon' ? 3 : 2;
    if (toolCoords.length >= minPts) handleShapeFinished(toolCoords);
  };

  const handleCancelTool = () => {
    setActiveTool('select');
    setToolCoords([]);
    setMousePos(null);
  };

  const handleSaveShape = (name: string, category: LayerCategory, color: string) => {
    if (!pendingShape) return;
    let geojsonGeometry: GeoJSON.Geometry;
    let geomLabel: string;

    if (pendingShape.type === 'Point') {
      const [lat, lng] = pendingShape.coords[0];
      geojsonGeometry = { type: 'Point', coordinates: [lng, lat] };
      geomLabel = 'Point';
    } else if (pendingShape.type === 'LineString') {
      geojsonGeometry = { type: 'LineString', coordinates: pendingShape.coords.map(([lat, lng]) => [lng, lat]) };
      geomLabel = 'LineString';
    } else {
      const ring = [...pendingShape.coords, pendingShape.coords[0]];
      geojsonGeometry = { type: 'Polygon', coordinates: [ring.map(([lat, lng]) => [lng, lat])] };
      geomLabel = 'Polygon';
    }

    const feature: GeoJSON.Feature = {
      type: 'Feature',
      properties: { nome: name, categoria: category, desenhado_em: new Date().toISOString() },
      geometry: geojsonGeometry,
    };

    const newLayer: GISLayer = {
      id: generateId(),
      name,
      category,
      color,
      opacity: 0.9,
      visible: true,
      geojson: { type: 'FeatureCollection', features: [feature] },
      featureCount: 1,
      geometryType: geomLabel,
      source: 'drawn',
    };

    setLayers(prev => [...prev, newLayer]);
    setPendingShape(null);
    setActiveTool('select');
  };
  const startDraw = (talhaoId: string) => {
    setDrawMode('drawing'); setDrawingTalhaoId(talhaoId); setDraftPoints([]); setEditingPolygon(null);
  };
  const startEdit = (talhaoId: string, poly: [number, number][]) => {
    setDrawMode('editing'); setDrawingTalhaoId(talhaoId); setEditingPolygon([...poly]); setDraftPoints([]);
  };
  const cancelDraw = () => { setDrawMode('idle'); setDrawingTalhaoId(null); setDraftPoints([]); setEditingPolygon(null); };

  const finishDraw = async (pts: [number, number][]) => {
    if (!drawingTalhaoId || pts.length < 3) return;
    const talhao = talhoes.find(t => t.id === drawingTalhaoId);
    if (!talhao) return;
    setIsSavingPolygon(true);
    try { await createTalhao({ ...talhao, polygon: pts, calculatedArea: calcPolygonAreaHa(pts) }); }
    catch (e) { console.error(e); }
    finally { setIsSavingPolygon(false); cancelDraw(); }
  };

  const saveEditedPolygon = async () => {
    if (!drawingTalhaoId || !editingPolygon || editingPolygon.length < 3) return;
    const talhao = talhoes.find(t => t.id === drawingTalhaoId);
    if (!talhao) return;
    setIsSavingPolygon(true);
    try { await createTalhao({ ...talhao, polygon: editingPolygon, calculatedArea: calcPolygonAreaHa(editingPolygon) }); }
    catch (e) { console.error(e); }
    finally { setIsSavingPolygon(false); cancelDraw(); }
  };

  const deletePolygon = async (talhaoId: string) => {
    const talhao = talhoes.find(t => t.id === talhaoId);
    if (!talhao || !confirm(`Apagar polígono do talhão "${talhao.nome}"?`)) return;
    const { polygon: _p, calculatedArea: _c, ...rest } = talhao as any;
    await createTalhao(rest);
  };

  // ── Export ──────────────────────────────────────────────────────────────────
  const exportAllKML = () => {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n`;
    layers.filter(l => l.visible).forEach(l => {
      kml += `  <Folder><name>${l.name}</name>\n`;
      l.geojson.features.forEach((f, i) => {
        const name = (f.properties as any)?.nome || (f.properties as any)?.name || `Feature ${i+1}`;
        kml += `  <Placemark><name>${name}</name>`;
        if (f.geometry.type === 'Point') {
          const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
          kml += `<Point><coordinates>${lng},${lat},0</coordinates></Point>`;
        } else if (f.geometry.type === 'Polygon') {
          const coords = (f.geometry as GeoJSON.Polygon).coordinates[0].map(c => `${c[0]},${c[1]},0`).join(' ');
          kml += `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
        }
        kml += `</Placemark>\n`;
      });
      kml += `  </Folder>\n`;
    });
    kml += `</Document>\n</kml>`;
    downloadBlob(kml, 'application/vnd.google-earth.kml+xml', `LeafTag_GIS_${fieldWorkId}.kml`);
  };

  const exportAllGeoJSON = () => {
    const features: GeoJSON.Feature[] = [];
    layers.filter(l => l.visible).forEach(l => {
      l.geojson.features.forEach(f => features.push({ ...f, properties: { ...f.properties, _layer: l.name, _category: l.category } }));
    });
    downloadBlob(JSON.stringify({ type: 'FeatureCollection', features }, null, 2), 'application/json', `LeafTag_GIS_${fieldWorkId}.geojson`);
  };

  const exportLayer = (layer: GISLayer) => {
    downloadBlob(JSON.stringify(layer.geojson, null, 2), 'application/json', `${layer.name}.geojson`);
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  const totalArea = talhaoStats.reduce((s, t) => s + (t.calcArea || 0), 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#07100a', zIndex: 9999,
      display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: '54px', flexShrink: 0,
        background: 'rgba(7,16,10,0.98)',
        borderBottom: '1px solid rgba(0,230,118,0.2)',
        backdropFilter: 'blur(16px)',
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px',
            background: 'linear-gradient(135deg,rgba(0,230,118,0.2),rgba(0,230,118,0.05))',
            border: '1px solid rgba(0,230,118,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#fff', fontWeight: '800', fontSize: '15px' }}>GIS Florestal</span>
              <span style={{
                fontSize: '9px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase',
                background: 'rgba(0,230,118,0.15)', border: '1px solid rgba(0,230,118,0.35)',
                color: '#00e676', borderRadius: '4px', padding: '2px 6px',
              }}>Enterprise</span>
            </div>
            <div style={{ color: '#666', fontSize: '11px', marginTop: '1px' }}>
              {layers.length} camada{layers.length !== 1 ? 's' : ''} • {parcelPoints.length} parcelas • {talhoes.length} talhões
            </div>
          </div>
        </div>

        {/* Center — draw hint */}
        {drawMode !== 'idle' && (
          <div style={{
            background: 'rgba(64,196,255,0.1)', border: '1px solid rgba(64,196,255,0.3)',
            borderRadius: '8px', padding: '7px 16px',
            color: '#40c4ff', fontSize: '12px', fontWeight: '600',
          }}>
            {drawMode === 'drawing'
              ? `✏️ ${draftPoints.length} vértice(s) — Duplo-clique para finalizar`
              : '✏️ Arraste os pontos brancos para editar o polígono'}
          </div>
        )}

        {/* Right */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {(['satellite', 'street', 'hybrid'] as MapBasemap[]).map(b => (
            <button key={b} onClick={() => setBasemap(b)} style={{
              padding: '5px 10px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer', border: '1px solid',
              background: basemap === b ? 'rgba(0,230,118,0.15)' : 'rgba(255,255,255,0.04)',
              borderColor: basemap === b ? 'rgba(0,230,118,0.5)' : 'rgba(255,255,255,0.08)',
              color: basemap === b ? '#00e676' : '#888', transition: 'all 0.15s',
            }}>
              {b === 'satellite' ? '🛰 Satélite' : b === 'street' ? '🗺 Ruas' : '🌐 Híbrido'}
            </button>
          ))}

          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

          {/* Export dropdown */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowExportMenu(p => !p)} style={{
              padding: '5px 11px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa',
            }}>📤 Exportar</button>
            {showExportMenu && (
              <div onClick={() => setShowExportMenu(false)} style={{
                position: 'absolute', top: 36, right: 0, zIndex: 200,
                background: '#101a12', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', overflow: 'hidden', minWidth: 180,
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              }}>
                {[
                  { label: '🌍 KML (Google Earth)', fn: exportAllKML },
                  { label: '📄 GeoJSON (todas)', fn: exportAllGeoJSON },
                ].map(item => (
                  <button key={item.label} onClick={item.fn} style={{
                    width: '100%', padding: '10px 14px', background: 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: '#ddd', fontSize: '12px', textAlign: 'left', cursor: 'pointer',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,230,118,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >{item.label}</button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setSidebarOpen(p => !p)} style={{
            padding: '5px 11px', fontSize: '11px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
            background: sidebarOpen ? 'rgba(0,230,118,0.12)' : 'rgba(255,255,255,0.04)',
            border: '1px solid', borderColor: sidebarOpen ? 'rgba(0,230,118,0.35)' : 'rgba(255,255,255,0.08)',
            color: sidebarOpen ? '#00e676' : '#888',
          }}>☰ Painel</button>

          <button onClick={onClose} style={{
            padding: '5px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '6px', cursor: 'pointer',
            background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', color: '#ff5252',
          }}>✕ Fechar</button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── SIDEBAR ── */}
        {sidebarOpen && (
          <div style={{
            width: '300px', flexShrink: 0,
            background: 'rgba(7,16,10,0.98)',
            borderRight: '1px solid rgba(0,230,118,0.12)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              {([
                { key: 'layers', label: '📂 Camadas Importadas' },
                { key: 'talhoes', label: '🌲 Talhões' },
              ] as { key: typeof sidebarTab; label: string }[]).map(({ key, label }) => (
                <button key={key} onClick={() => setSidebarTab(key)} style={{
                  flex: 1, padding: '10px 8px', fontSize: '11px', fontWeight: '700',
                  background: sidebarTab === key ? 'rgba(0,230,118,0.08)' : 'transparent',
                  border: 'none', borderBottom: sidebarTab === key ? '2px solid #00e676' : '2px solid transparent',
                  color: sidebarTab === key ? '#00e676' : '#666', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>{label}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>

              {/* ── CAMADAS TAB ── */}
              {sidebarTab === 'layers' && (
                <>
                  {/* Upload zone */}
                  <UploadZone onUpload={handleFileUpload} isProcessing={isProcessing} />

                  {/* Error */}
                  {processError && (
                    <div style={{
                      background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)',
                      borderRadius: '8px', padding: '10px 12px', marginBottom: '12px',
                      color: '#ff8a80', fontSize: '12px',
                    }}>
                      ⚠️ {processError}
                      <button onClick={() => setProcessError(null)} style={{ float: 'right', background: 'none', border: 'none', color: '#ff8a80', cursor: 'pointer' }}>✕</button>
                    </div>
                  )}

                  {/* ── PENDING LAYER DIALOG ── */}
                  {pendingLayer && (
                    <div style={{
                      background: 'rgba(0,230,118,0.06)', border: '1px solid rgba(0,230,118,0.25)',
                      borderRadius: '12px', padding: '14px', marginBottom: '14px',
                    }}>
                      <div style={{ color: '#00e676', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
                        ✅ Arquivo detectado — confirme o tipo
                      </div>
                      <div style={{ color: '#fff', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>{pendingLayer.name}</div>
                      <div style={{ color: '#888', fontSize: '11px', marginBottom: '12px' }}>
                        {pendingLayer.featureCount} feições • {pendingLayer.geometryType}
                      </div>

                      {/* Category select */}
                      <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px' }}>Tipo de Camada</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
                          {(Object.entries(CATEGORY_CONFIG) as [LayerCategory, typeof CATEGORY_CONFIG[LayerCategory]][]).map(([k, v]) => (
                            <button key={k} onClick={() => {
                              setPendingCategory(k);
                              setPendingLayer(prev => prev ? { ...prev, color: v.defaultColor } : prev);
                            }} style={{
                              padding: '7px 4px', fontSize: '10px', fontWeight: '700',
                              borderRadius: '7px', cursor: 'pointer', border: '1px solid',
                              background: pendingCategory === k ? `${v.defaultColor}20` : 'rgba(255,255,255,0.03)',
                              borderColor: pendingCategory === k ? v.defaultColor : 'rgba(255,255,255,0.08)',
                              color: pendingCategory === k ? v.defaultColor : '#888',
                              textAlign: 'center', transition: 'all 0.15s',
                            }}>
                              {v.emoji}<br />{v.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Color */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '6px' }}>Cor</label>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          {QUICK_COLORS.map(c => (
                            <div key={c} onClick={() => setPendingLayer(prev => prev ? { ...prev, color: c } : prev)}
                              style={{
                                width: 22, height: 22, borderRadius: 5, background: c, cursor: 'pointer',
                                border: pendingLayer.color === c ? '2px solid white' : '2px solid transparent',
                                transition: 'border 0.1s',
                              }} />
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={confirmAddLayer} style={{
                          flex: 1, padding: '9px', fontSize: '12px', fontWeight: '700',
                          borderRadius: '8px', cursor: 'pointer',
                          background: 'rgba(0,230,118,0.2)', border: '1px solid rgba(0,230,118,0.4)', color: '#00e676',
                        }}>✓ Adicionar Camada</button>
                        <button onClick={() => setPendingLayer(null)} style={{
                          padding: '9px 12px', fontSize: '12px', fontWeight: '700',
                          borderRadius: '8px', cursor: 'pointer',
                          background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.3)', color: '#ff5252',
                        }}>✕</button>
                      </div>
                    </div>
                  )}

                  {/* Layer list */}
                  {layers.length === 0 && !pendingLayer && (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#555' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>🗺️</div>
                      <div style={{ fontSize: '12px' }}>Nenhuma camada importada ainda.</div>
                      <div style={{ fontSize: '11px', marginTop: '4px', color: '#444' }}>
                        Faça upload de um shapefile .zip<br />para começar
                      </div>
                    </div>
                  )}

                  {layers.map(layer => {
                    const isSelected = selectedLayerId === layer.id;
                    const cfg = CATEGORY_CONFIG[layer.category];
                    return (
                      <div key={layer.id} style={{
                        borderRadius: '10px', marginBottom: '8px', overflow: 'hidden',
                        border: `1px solid ${isSelected ? layer.color : 'rgba(255,255,255,0.07)'}`,
                        background: isSelected ? `${layer.color}10` : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.2s',
                      }}>
                        {/* Layer header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', cursor: 'pointer' }}
                          onClick={() => { setSelectedLayerId(isSelected ? null : layer.id); const b = geojsonBounds(layer.geojson); if (b && !isSelected) setFlyToBounds(b); }}>
                          {/* Visibility */}
                          <div onClick={e => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }}
                            style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${layer.color}88`, background: layer.visible ? `${layer.color}30` : 'transparent', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {layer.visible && <div style={{ width: 6, height: 6, borderRadius: 2, background: layer.color }} />}
                          </div>
                          {/* Color dot */}
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: layer.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#fff', fontSize: '12px', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layer.name}</div>
                            <div style={{ color: '#777', fontSize: '10px' }}>{cfg.emoji} {cfg.label} • {layer.featureCount} feições</div>
                          </div>
                          <button onClick={e => { e.stopPropagation(); removeLayer(layer.id); }}
                            style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px', padding: '0 2px' }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ff5252'}
                            onMouseLeave={e => e.currentTarget.style.color = '#555'}>✕</button>
                        </div>

                        {/* Expanded controls */}
                        {isSelected && (
                          <div style={{ padding: '0 12px 12px' }}>
                            {/* Opacity */}
                            <div style={{ marginBottom: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Opacidade</span>
                                <span style={{ fontSize: '10px', color: '#ccc' }}>{Math.round(layer.opacity * 100)}%</span>
                              </div>
                              <input type="range" min="0.1" max="1" step="0.05" value={layer.opacity}
                                onChange={e => updateLayer(layer.id, { opacity: parseFloat(e.target.value) })}
                                style={{ width: '100%', accentColor: layer.color }} />
                            </div>
                            {/* Color */}
                            <div style={{ marginBottom: '10px' }}>
                              <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '5px' }}>Cor</span>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {QUICK_COLORS.map(c => (
                                  <div key={c} onClick={() => updateLayer(layer.id, { color: c })}
                                    style={{ width: 18, height: 18, borderRadius: 4, background: c, cursor: 'pointer', border: layer.color === c ? '2px solid white' : '2px solid transparent' }} />
                                ))}
                              </div>
                            </div>
                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => { const b = geojsonBounds(layer.geojson); if (b) setFlyToBounds(b); }}
                                style={miniBtn('#40c4ff')}>🎯 Centralizar</button>
                              <button onClick={() => exportLayer(layer)} style={miniBtn('#00e676')}>📥 GeoJSON</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Inventory layers section */}
                  {(parcelPoints.length > 0 || treePoints.length > 0 || talhoes.some(t => t.polygon)) && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                        Dados do Inventário
                      </div>
                      {[
                        { label: '🌲 Polígonos de Talhões', show: showTalhaoPolygons, toggle: () => setShowTalhaoPolygons(p => !p), count: talhoes.filter(t => t.polygon).length, color: '#00e676' },
                        { label: '📍 Parcelas Mapeadas', show: showParcelas, toggle: () => setShowParcelas(p => !p), count: parcelPoints.length, color: '#40c4ff' },
                        { label: '🌳 Árvores Individuais', show: showArvores, toggle: () => setShowArvores(p => !p), count: 'toggle', color: '#b2ff59' },
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }}
                          onClick={item.toggle}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${item.color}88`, background: item.show ? `${item.color}30` : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.show && <div style={{ width: 6, height: 6, borderRadius: 2, background: item.color }} />}
                          </div>
                          <span style={{ flex: 1, fontSize: '12px', color: '#ccc' }}>{item.label}</span>
                          {typeof item.count === 'number' && (
                            <span style={{ fontSize: '10px', color: '#666', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px' }}>{item.count}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── TALHÕES TAB ── */}
              {sidebarTab === 'talhoes' && (
                <>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: '#00e676', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                    {talhoes.length} Talhões cadastrados
                  </div>

                  {talhoes.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: '#555', fontSize: '12px' }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>🌲</div>
                      Nenhum talhão neste trabalho.
                    </div>
                  )}

                  {talhaoStats.map(({ talhao, color, parcels, trees, volHa, calcArea }) => {
                    const isSelected = selectedLayerId === `talhao-${talhao.id}`;
                    const isBeingDrawn = drawingTalhaoId === talhao.id;
                    const hasPoly = !!talhao.polygon && talhao.polygon.length >= 3;
                    return (
                      <div key={talhao.id} style={{
                        borderRadius: '10px', marginBottom: '8px', overflow: 'hidden',
                        border: `1px solid ${isSelected ? color : 'rgba(255,255,255,0.07)'}`,
                        background: isSelected ? `${color}10` : 'rgba(255,255,255,0.02)',
                        transition: 'all 0.2s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', cursor: 'pointer' }}
                          onClick={() => setSelectedLayerId(isSelected ? null : `talhao-${talhao.id}`)}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: '#fff', fontSize: '13px', fontWeight: '700' }}>{talhao.nome}</span>
                          {hasPoly && <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 5px', borderRadius: '4px', background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.3)', color: '#00e676' }}>GIS ✓</span>}
                        </div>
                        {isSelected && (
                          <div style={{ padding: '0 12px 12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                              {[
                                { label: 'Área Cadastrada', value: talhao.area ? `${talhao.area.toFixed(1)} ha` : '—' },
                                { label: 'Área GIS', value: calcArea ? `${calcArea.toFixed(2)} ha` : '—' },
                                { label: 'Parcelas', value: String(parcels) },
                                { label: 'Árvores', value: String(trees) },
                                { label: 'Vol/ha', value: volHa ? `${volHa.toFixed(1)} m³` : '—' },
                              ].map(item => (
                                <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px 8px' }}>
                                  <div style={{ fontSize: '9px', color: '#777', textTransform: 'uppercase', marginBottom: '2px' }}>{item.label}</div>
                                  <div style={{ fontSize: '13px', color: '#fff', fontWeight: '700' }}>{item.value}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              {isBeingDrawn ? (
                                <>
                                  {drawMode === 'editing' && (
                                    <button onClick={saveEditedPolygon} disabled={isSavingPolygon} style={miniBtn('#00e676')}>
                                      {isSavingPolygon ? '...' : '💾 Salvar'}
                                    </button>
                                  )}
                                  <button onClick={cancelDraw} style={miniBtn('#ff5252')}>✕ Cancelar</button>
                                </>
                              ) : hasPoly ? (
                                <>
                                  <button onClick={() => startEdit(talhao.id, talhao.polygon!)} disabled={drawMode !== 'idle'} style={miniBtn('#ffab40')}>✏️ Editar</button>
                                  <button onClick={() => deletePolygon(talhao.id)} disabled={drawMode !== 'idle'} style={miniBtn('#ff5252')}>🗑 Apagar</button>
                                </>
                              ) : (
                                <button onClick={() => startDraw(talhao.id)} disabled={drawMode !== 'idle'} style={miniBtn('#40c4ff')}>🖊 Desenhar</button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Summary */}
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {[
                        { label: 'Total de Talhões', value: String(talhoes.length) },
                        { label: 'Com Polígono GIS', value: String(talhoes.filter(t => t.polygon).length) },
                        { label: 'Área GIS Total', value: `${totalArea.toFixed(1)} ha` },
                        { label: 'Camadas Importadas', value: String(layers.length) },
                      ].map(item => (
                        <div key={item.label} style={{ background: 'rgba(0,230,118,0.04)', border: '1px solid rgba(0,230,118,0.1)', borderRadius: '8px', padding: '8px 10px' }}>
                          <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', marginBottom: '3px' }}>{item.label}</div>
                          <div style={{ fontSize: '15px', color: '#fff', fontWeight: '800' }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── MAP AREA ── */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Status bar */}
          <div style={{
            position: 'absolute', bottom: 12, right: 12, zIndex: 800,
            background: 'rgba(0,0,0,0.75)', borderRadius: '8px',
            padding: '5px 10px', color: '#666', fontSize: '10px',
            border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(4px)',
          }}>
            LeafTag GIS Enterprise • {layers.length} camada(s) • {parcelPoints.length} parcelas
          </div>

          {/* Feature info panel */}
          {featureInfo && (
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 800, width: 240,
              background: 'rgba(7,16,10,0.95)', border: '1px solid rgba(0,230,118,0.2)',
              borderRadius: '12px', padding: '12px', backdropFilter: 'blur(12px)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#00e676', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>Atributos</span>
                <button onClick={() => setFeatureInfo(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '14px' }}>✕</button>
              </div>
              {Object.entries(featureInfo).filter(([, v]) => v !== null && v !== '').slice(0, 10).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#888', fontSize: '10px' }}>{k}</span>
                  <span style={{ color: '#fff', fontSize: '11px', fontWeight: '600', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── DRAW TOOLBAR (floating left) ── */}
          <MapDrawToolbar
            activeTool={activeTool}
            setActiveTool={handleToolChange}
            canUndo={toolCoords.length > 0}
            canFinish={
              (activeTool === 'polygon' && toolCoords.length >= 3) ||
              (activeTool === 'polyline' && toolCoords.length >= 2)
            }
            onUndo={handleUndoVertex}
            onFinish={handleConfirmTool}
            onCancel={handleCancelTool}
            coordCount={toolCoords.length}
          />

          {/* ── SAVE SHAPE DIALOG ── */}
          {pendingShape && (
            <SaveShapeDialog
              shape={pendingShape}
              onSave={handleSaveShape}
              onCancel={() => { setPendingShape(null); setActiveTool('select'); }}
            />
          )}
          <MapContainer center={[-15.793889, -47.882778]} zoom={5} style={{ width: '100%', height: '100%', zIndex: 1 }} doubleClickZoom={drawMode !== 'drawing' && activeTool === 'select'} zoomControl={false}>
            <TileLayer key={basemap} url={TILE_LAYERS[basemap].url} attribution={TILE_LAYERS[basemap].attribution} />
            <ZoomControl position="bottomright" />
            <MapSearchBox
              talhaoStats={talhaoStats}
              parcelPoints={parcelPoints}
              layers={layers}
              setSelectedLayerId={setSelectedLayerId}
              setFeatureInfo={setFeatureInfo}
            />
            <HybridLabels active={basemap === 'hybrid'} />
            <FitBoundsOnLoad layers={layers} parcelas={parcelPoints.map(p => p.pos)} />
            {flyToBounds && <FlyToLayer bounds={flyToBounds} />}

            <DrawHandler
              drawMode={drawMode} draftPoints={draftPoints} setDraftPoints={setDraftPoints}
              onFinish={finishDraw} onCancel={cancelDraw}
            />

            {/* ── MANUAL TOOL DRAW HANDLER ── */}
            <ManualDrawHandler
              activeTool={activeTool}
              coords={toolCoords}
              setCoords={setToolCoords}
              mousePos={mousePos}
              setMousePos={setMousePos}
              onPointPlaced={handlePointPlaced}
              onShapeFinished={handleShapeFinished}
            />

            {/* ── LIVE DRAW PREVIEW: polyline trail ── */}
            {activeTool === 'polyline' && toolCoords.length >= 1 && (
              <Polyline
                positions={mousePos ? [...toolCoords, mousePos] : toolCoords}
                pathOptions={{ color: '#40c4ff', weight: 2.5, dashArray: '6,4', opacity: 0.9 }}
              />
            )}
            {activeTool === 'polyline' && toolCoords.map((pt, i) => (
              <CircleMarker key={`tlpt-${i}`} center={pt} radius={5}
                pathOptions={{ color: '#fff', weight: 1.5, fillColor: '#40c4ff', fillOpacity: 1 }} />
            ))}

            {/* ── LIVE DRAW PREVIEW: polygon rubber band ── */}
            {activeTool === 'polygon' && toolCoords.length >= 2 && (
              <Polygon
                positions={mousePos ? [...toolCoords, mousePos] : toolCoords}
                pathOptions={{ color: '#00e676', weight: 2.5, dashArray: '6,4', fillColor: '#00e676', fillOpacity: 0.08, opacity: 0.9 }}
              />
            )}
            {activeTool === 'polygon' && toolCoords.map((pt, i) => (
              <CircleMarker key={`tgpt-${i}`} center={pt} radius={5}
                pathOptions={{ color: '#fff', weight: 1.5, fillColor: '#00e676', fillOpacity: 1 }} />
            ))}

            {/* ── IMPORTED GEOJSON LAYERS ── */}
            {layers.map(layer => (
              <GeoJSONLayer key={layer.id} layer={layer} onFeatureClick={setFeatureInfo} />
            ))}

            {/* ── TALHÃO POLYGONS (from inventory system) ── */}
            {showTalhaoPolygons && talhaoStats.map(({ talhao, color }) => {
              if (!talhao.polygon || talhao.polygon.length < 3) return null;
              const isEditing = drawingTalhaoId === talhao.id && drawMode === 'editing';
              if (isEditing) return null;
              return (
                <Polygon key={`tpoly-${talhao.id}`}
                  positions={talhao.polygon}
                  pathOptions={{ color, weight: 2, opacity: 0.9, fillColor: color, fillOpacity: 0.15 }}
                  eventHandlers={{ click: () => setSelectedLayerId(`talhao-${talhao.id}`) }}>
                  <Popup>
                    <div style={{ background: '#0f1a12', borderRadius: 8, padding: 10, color: '#fff', minWidth: 140 }}>
                      <div style={{ color: '#00e676', fontWeight: 800, marginBottom: 4 }}>🌲 {talhao.nome}</div>
                      {talhao.calculatedArea && <div style={{ fontSize: 12 }}>Área GIS: {talhao.calculatedArea.toFixed(2)} ha</div>}
                      {talhao.area && <div style={{ fontSize: 12 }}>Área cadastrada: {talhao.area} ha</div>}
                    </div>
                  </Popup>
                </Polygon>
              );
            })}

            {/* ── EDITING POLYGON ── */}
            {drawMode === 'editing' && editingPolygon && editingPolygon.length >= 2 && (
              <>
                <Polygon positions={editingPolygon}
                  pathOptions={{ color: '#40c4ff', weight: 2, dashArray: '8,4', fillColor: '#40c4ff', fillOpacity: 0.1 }} />
                {editingPolygon.map((pos, idx) => (
                  <EditVertex key={`ev-${idx}`} position={pos} index={idx}
                    onDrag={(i, p) => setEditingPolygon(prev => { if (!prev) return prev; const c = [...prev]; c[i] = p; return c; })} />
                ))}
              </>
            )}

            {/* ── DRAFT POLYGON ── */}
            {drawMode === 'drawing' && draftPoints.length >= 2 && (
              <Polygon positions={draftPoints}
                pathOptions={{ color: '#40c4ff', weight: 2, dashArray: '6,4', fillColor: '#40c4ff', fillOpacity: 0.08 }} />
            )}
            {drawMode === 'drawing' && draftPoints.map((pt, idx) => (
              <CircleMarker key={`dp-${idx}`} center={pt} radius={5}
                pathOptions={{ color: '#fff', weight: 1.5, fillColor: '#40c4ff', fillOpacity: 1 }} />
            ))}

            {/* ── PARCEL MARKERS ── */}
            {showParcelas && parcelPoints.map(({ pos, inv }) => {
              const ts = talhaoStats.find(t => t.talhao.id === inv.talhaoId);
              const color = ts?.color || '#40c4ff';
              const vol = inv.dados?.reduce((s, d) => s + (d.volumeCalculado || 0), 0) || 0;
              const fe = inv.areaParcela > 0 ? 10000 / inv.areaParcela : 0;
              return (
                <CircleMarker key={`parc-${inv.id}`} center={pos} radius={7}
                  pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 }}>
                  <Popup>
                    <div style={{ background: '#0f1a12', borderRadius: 8, padding: 10, color: '#fff', minWidth: 150 }}>
                      <div style={{ color: color, fontWeight: 800, marginBottom: 4 }}>📍 {inv.nome}</div>
                      {ts && <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>Talhão: {ts.talhao.nome}</div>}
                      <div style={{ fontSize: 12 }}>Árvores: {inv.dados?.length || 0}</div>
                      {vol > 0 && <div style={{ fontSize: 12 }}>Vol./ha: {(vol * fe).toFixed(1)} m³/ha</div>}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* ── TREE MARKERS ── */}
            {showArvores && treePoints.map(({ pos, inv, num }, i) => (
              <CircleMarker key={`tree-${inv.id}-${num}-${i}`} center={pos} radius={3}
                pathOptions={{ color: 'rgba(255,255,255,0.4)', weight: 0.5, fillColor: '#b2ff59', fillOpacity: 0.85 }}>
                <Popup>
                  <div style={{ color: '#111', fontSize: 12 }}>🌳 Árvore #{num}<br />Parcela: {inv.nome}</div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};

// ─── STYLE HELPERS ────────────────────────────────────────────────────────────
function miniBtn(color: string): React.CSSProperties {
  return {
    padding: '5px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '6px',
    cursor: 'pointer', border: `1px solid ${color}55`,
    background: `${color}18`, color, transition: 'all 0.15s',
  };
}

// ─── BASIC KML PARSER ─────────────────────────────────────────────────────────
function parseKML(kmlText: string): GeoJSON.FeatureCollection {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, 'text/xml');
  const features: GeoJSON.Feature[] = [];

  const placemarks = doc.querySelectorAll('Placemark');
  placemarks.forEach(pm => {
    const name = pm.querySelector('name')?.textContent || '';
    const desc = pm.querySelector('description')?.textContent || '';

    // Point
    const point = pm.querySelector('Point coordinates');
    if (point) {
      const [lng, lat] = point.textContent!.trim().split(',').map(Number);
      features.push({ type: 'Feature', properties: { name, description: desc },
        geometry: { type: 'Point', coordinates: [lng, lat] } });
      return;
    }

    // Polygon
    const polyCoords = pm.querySelector('Polygon outerBoundaryIs LinearRing coordinates');
    if (polyCoords) {
      const coordinates = polyCoords.textContent!.trim().split(/\s+/).map(c => {
        const [lng, lat] = c.split(',').map(Number);
        return [lng, lat] as [number, number];
      });
      features.push({ type: 'Feature', properties: { name, description: desc },
        geometry: { type: 'Polygon', coordinates: [coordinates] } });
      return;
    }

    // LineString
    const lineCoords = pm.querySelector('LineString coordinates');
    if (lineCoords) {
      const coordinates = lineCoords.textContent!.trim().split(/\s+/).map(c => {
        const [lng, lat] = c.split(',').map(Number);
        return [lng, lat] as [number, number];
      });
      features.push({ type: 'Feature', properties: { name, description: desc },
        geometry: { type: 'LineString', coordinates } });
    }
  });

  return { type: 'FeatureCollection', features };
}
