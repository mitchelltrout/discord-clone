'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import { useAuthStore } from '../../lib/stores/authStore';
import { useServerStore } from '../../lib/stores/serverStore';
import api from '../../lib/api';

// Logical canvas dimensions (16:9)
const CANVAS_W = 2000;
const CANVAS_H = 1125;
const BG_COLOR = '#2c2f33';
const MIN_DIST = 3;  // skip points closer than this (logical px)
const MAX_POINTS = 500; // must match server validation

function drawStroke(ctx, stroke) {
  const { points, color, width, tool } = stroke;
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
  }
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
  ctx.restore();
}

function getCanvasPoint(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  return [
    Math.round((e.clientX - rect.left) * (CANVAS_W / rect.width)),
    Math.round((e.clientY - rect.top) * (CANVAS_H / rect.height)),
  ];
}

export default function CanvasView({ channelId, channelName, serverId }) {
  // bgCanvasRef: committed strokes (bottom layer, always full)
  // canvasRef:   current pen stroke only (top layer, transparent bg)
  // Eraser draws live onto bgCanvas so the effect is immediately visible.
  const bgCanvasRef = useRef(null);
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const currentStrokeRef = useRef(null);
  const isDrawingRef = useRef(false);
  const rafRef = useRef(null);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#ffffff');
  const [brushWidth, setBrushWidth] = useState(4);
  const [loading, setLoading] = useState(true);

  const user = useAuthStore((s) => s.user);
  const serverMembers = useServerStore((s) => s.members[serverId] || []);
  const myRole = serverMembers.find((m) => m.id === user?.id)?.role;
  const canClear = myRole === 'owner' || myRole === 'admin';

  // Full repaint of the committed-strokes layer
  const redrawBg = useCallback(() => {
    const bg = bgCanvasRef.current;
    if (!bg) return;
    const ctx = bg.getContext('2d');
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const { stroke } of strokesRef.current) drawStroke(ctx, stroke);
  }, []);

  // Repaint only the in-progress pen stroke on the transparent top layer
  const redrawCurrent = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current);
  }, []);

  useEffect(() => {
    if (!channelId) return;
    strokesRef.current = [];
    setLoading(true);

    api.get(`/channels/${channelId}/strokes`)
      .then(({ data }) => { strokesRef.current = data; redrawBg(); })
      .catch(console.error)
      .finally(() => setLoading(false));

    const socket = getSocket();
    if (!socket) return;

    socket.emit('canvas:join', { channelId });

    function onStroke({ strokeId, userId, stroke }) {
      strokesRef.current.push({ strokeId, userId, stroke });
      // Paint incrementally onto bgCanvas — no full redraw needed
      const bg = bgCanvasRef.current;
      if (bg) drawStroke(bg.getContext('2d'), stroke);
    }
    function onCleared() {
      strokesRef.current = [];
      redrawBg();
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext('2d').clearRect(0, 0, CANVAS_W, CANVAS_H);
    }

    socket.on('canvas:stroke', onStroke);
    socket.on('canvas:cleared', onCleared);
    return () => {
      socket.off('canvas:stroke', onStroke);
      socket.off('canvas:cleared', onCleared);
    };
  }, [channelId, redrawBg]);

  useEffect(() => { redrawBg(); }, [redrawBg]);

  function onPointerDown(e) {
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    const pt = getCanvasPoint(canvas, e);
    currentStrokeRef.current = { points: [pt], color, width: brushWidth, tool };
    if (tool !== 'eraser') redrawCurrent();
  }

  function onPointerMove(e) {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    const pt = getCanvasPoint(canvas, e);
    const pts = currentStrokeRef.current.points;
    const last = pts[pts.length - 1];

    // Skip points that are too close together — reduces stroke data size
    if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < MIN_DIST) return;
    pts.push(pt);

    // Auto-finalize stroke when point cap is reached, then start a new one
    if (pts.length >= MAX_POINTS) {
      onPointerUp();
      onPointerDown(e);
      return;
    }

    if (tool === 'eraser') {
      // Apply eraser incrementally to bgCanvas so user sees the effect live
      const bg = bgCanvasRef.current;
      if (bg) {
        const n = pts.length;
        const ctx = bg.getContext('2d');
        ctx.save();
        ctx.lineWidth = brushWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.beginPath();
        ctx.moveTo(pts[n - 2][0], pts[n - 2][1]);
        ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
        ctx.stroke();
        ctx.restore();
      }
    } else {
      // Throttle pen preview redraws to one per animation frame
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          redrawCurrent();
          rafRef.current = null;
        });
      }
    }
  }

  function onPointerUp() {
    if (!isDrawingRef.current || !currentStrokeRef.current) return;
    isDrawingRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;

    // Clear the pen-preview layer
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (stroke.points.length < 2) return;

    strokesRef.current.push({ strokeId: null, userId: user?.id, stroke });

    if (stroke.tool !== 'eraser') {
      // Pen: commit to bgCanvas (eraser was already applied incrementally)
      const bg = bgCanvasRef.current;
      if (bg) drawStroke(bg.getContext('2d'), stroke);
    }

    const socket = getSocket();
    if (socket) socket.emit('canvas:stroke', { channelId, stroke });
  }

  function handleClear() {
    if (!canClear) return;
    if (!confirm('Clear the entire canvas? This cannot be undone.')) return;
    strokesRef.current = [];
    currentStrokeRef.current = null;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    redrawBg();
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, CANVAS_W, CANVAS_H);
    const socket = getSocket();
    if (socket) socket.emit('canvas:clear', { channelId });
  }

  const COLORS = ['#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#000000'];

  const sharedStyle = {
    display: 'block',
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 120px)',
    borderRadius: '4px',
    touchAction: 'none',
  };

  return (
    <div className="flex-1 flex flex-col bg-discord-bg min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-discord-sidebar border-b border-discord-darker/50 shrink-0 flex-wrap">
        <span className="text-white font-semibold text-sm truncate">#{channelName}</span>

        <div className="w-px h-5 bg-discord-darker/70" />

        {/* Tool selector */}
        <div className="flex gap-1">
          <button
            onClick={() => setTool('pen')}
            title="Pen"
            className={`p-1.5 rounded transition-colors ${tool === 'pen' ? 'bg-discord-blurple text-white' : 'text-discord-muted hover:text-white'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
          <button
            onClick={() => setTool('eraser')}
            title="Eraser"
            className={`p-1.5 rounded transition-colors ${tool === 'eraser' ? 'bg-discord-blurple text-white' : 'text-discord-muted hover:text-white'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73c-.78.77-.78 2.04 0 2.83L5.03 20H13l8-8.03-4.44-4.45-1.42 1.41 3.03 3.03L13.59 16H6.41l-2-2 10.17-10.17.97.97-1.42 1.41 1.41 1.41 2.05-2.04c.78-.78.78-2.05 0-2.83L16.56 3.6c-.4-.4-.9-.6-1.42-.6z"/>
            </svg>
          </button>
        </div>

        <div className="w-px h-5 bg-discord-darker/70" />

        {/* Color swatches */}
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setTool('pen'); }}
              title={c}
              style={{ backgroundColor: c }}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${color === c && tool === 'pen' ? 'border-white scale-110' : 'border-transparent'}`}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => { setColor(e.target.value); setTool('pen'); }}
            title="Custom color"
            className="w-5 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
          />
        </div>

        <div className="w-px h-5 bg-discord-darker/70" />

        {/* Brush size */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-discord-muted">Size</span>
          <input
            type="range"
            min={1}
            max={40}
            value={brushWidth}
            onChange={(e) => setBrushWidth(Number(e.target.value))}
            className="w-20 accent-discord-blurple"
          />
          <span className="text-xs text-discord-muted w-4 text-right">{brushWidth}</span>
        </div>

        {canClear && (
          <>
            <div className="w-px h-5 bg-discord-darker/70" />
            <button
              onClick={handleClear}
              className="text-xs text-discord-muted hover:text-discord-red transition-colors px-2 py-1 rounded hover:bg-discord-darker"
            >
              Clear Canvas
            </button>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0">
        {/* backgroundColor provides the bg color behind destination-out eraser holes */}
        <div className="relative" style={{ maxWidth: '100%', maxHeight: '100%', backgroundColor: BG_COLOR, borderRadius: '4px' }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 rounded">
              <span className="text-discord-muted text-sm">Loading canvas...</span>
            </div>
          )}
          {/* Bottom layer: committed strokes (no pointer events) */}
          <canvas
            ref={bgCanvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ ...sharedStyle, position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          />
          {/* Top layer: in-progress pen stroke + pointer event target */}
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ ...sharedStyle, position: 'relative', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </div>
      </div>
    </div>
  );
}
