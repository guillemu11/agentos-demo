import { useEffect, useState, useMemo } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { dslToGraph } from './layout/autoLayout.js';
import EntryNode from './nodes/EntryNode.jsx';
import WaitDurationNode from './nodes/WaitDurationNode.jsx';
import DecisionSplitNode from './nodes/DecisionSplitNode.jsx';
import EmailSendNode from './nodes/EmailSendNode.jsx';
import WaitUntilEventNode from './nodes/WaitUntilEventNode.jsx';
import EngagementSplitNode from './nodes/EngagementSplitNode.jsx';
import AnimatedEdge from './edges/AnimatedEdge.jsx';

const nodeTypes = {
  entry: EntryNode,
  waitDuration: WaitDurationNode,
  decisionSplit: DecisionSplitNode,
  emailSend: EmailSendNode,
  waitUntilEvent: WaitUntilEventNode,
  engagementSplit: EngagementSplitNode,
};
const edgeTypes = { animated: AnimatedEdge };

export default function JourneyCanvas({ dsl, toolStatus, onNodeClick, highlightActivityId }) {
  const { nodes, edges } = useMemo(() => dslToGraph(dsl), [dsl]);
  const [lastAddedId, setLastAddedId] = useState(null);
  const [prevIds, setPrevIds] = useState(new Set());

  useEffect(() => {
    const currentIds = new Set(nodes.map((n) => n.id));
    const added = [...currentIds].find((id) => !prevIds.has(id));
    if (added) setLastAddedId(added);
    setPrevIds(currentIds);
    if (added) {
      const t = setTimeout(() => setLastAddedId(null), 900);
      return () => clearTimeout(t);
    }
  }, [nodes]);

  const decoratedNodes = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      isNewlyAdded: n.id === lastAddedId || n.id === highlightActivityId,
      toolRunning: toolStatus?.status === 'running',
    },
  }));

  return (
    <div className="journey-canvas">
      <ReactFlow
        nodes={decoratedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick ? (_, node) => onNodeClick(node) : undefined}
        fitView
        fitViewOptions={{ padding: 0.2, duration: 500 }}
        defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(255,255,255,0.04)" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
