import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';

export default function AnimatedEdge({ id, sourceX, sourceY, targetX, targetY, label }) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: 'var(--journey-edge-default)', strokeWidth: 2 }} />
      <path d={path} fill="none" stroke="var(--journey-edge-active)" strokeWidth={2} strokeDasharray="8 8" className="journey-edge-flow" />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
              background: 'rgba(15,23,42,0.85)',
              color: 'var(--journey-node-text)',
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 11,
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
