import { GraphEngine } from '../utils/graph-engine';

const RelationshipLines = (props) => {
  const getBezierPath = (edge) => {
    const { x1, y1, x2, y2, pSide, cSide } = edge;
    
    // Offset lekukan yang lebih rapat agar tidak terlihat berantakan
    const offset = 40; 
    
    let cp1x = x1;
    let cp1y = y1;
    let cp2x = x2;
    let cp2y = y2;

    if (pSide === 'left') cp1x -= offset;
    else if (pSide === 'right') cp1x += offset;
    else if (pSide === 'top') cp1y -= offset;
    else if (pSide === 'bottom') cp1y += offset;

    if (cSide === 'left') cp2x -= offset;
    else if (cSide === 'right') cp2x += offset;
    else if (cSide === 'top') cp2y -= offset;
    else if (cSide === 'bottom') cp2y += offset;

    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  };

  return (
    <svg class="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
      <style>
        {`
          @keyframes dash-flow {
            to { stroke-dashoffset: -20; }
          }
          .intelligence-flow {
            animation: dash-flow 1.2s linear infinite;
          }
        `}
      </style>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
        </marker>
      </defs>
      
      {/* Render Explicit Links */}
      <For each={props.links()}>
        {(link) => {
          const source = () => props.nodes().find(n => n.id === link.source);
          const target = () => props.nodes().find(n => n.id === link.target);
          
          return (
            <Show when={source() && target()}>
              <path 
                d={getBezierPath(GraphEngine.calculateEdge(source(), target()))}
                fill="none"
                stroke="#10b981" 
                stroke-width="1.5" 
                stroke-dasharray="10,5"
                marker-end="url(#arrowhead)"
                class="intelligence-flow opacity-60 transition-all duration-300"
              />
            </Show>
          );
        }}
      </For>

      {/* Legacy Parent-Child Relations */}
      <For each={props.nodes()}>
        {(child) => (
          <Show when={child.parentId}>
            {(() => {
              const parent = props.nodes().find(p => p.id === child.parentId);
              if (!parent) return null;
              const edge = GraphEngine.calculateEdge(parent, child);
              return (
                <path 
                  d={getBezierPath(edge)}
                  fill="none"
                  stroke="#10b981" 
                  stroke-width="1.5" 
                  stroke-dasharray="10,5"
                  marker-end="url(#arrowhead)"
                  class="intelligence-flow opacity-60 transition-all duration-300"
                />
              );
            })()}
          </Show>
        )}
      </For>
    </svg>
  );
};

export default RelationshipLines;
