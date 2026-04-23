export const GraphEngine = {
  // Fungsi penyeimbang dimensi agar 100% akurat dengan EntityNode.jsx
  getDimensions: (node) => {
    switch (node.type) {
      case 'NEWS_RESULT':
        const newsCount = (node.news || []).length;
        const calculatedHeight = Math.min(Math.max(newsCount * 85 + 60, 160), 400);
        return { w: 320, h: calculatedHeight };
      case 'MANAGEMENT_NODE':
      case 'USER':
        return { w: 220, h: 100 };
      case 'CHART_NODE':
        return { w: 350, h: 250 };
      case 'LOCATION':
        return { w: 220, h: 110 };
      case 'AIRPORT':
      case 'PORT':
      case 'POWER_PLANT':
      case 'INDUSTRIAL_ZONE':
        return { w: 260, h: 220 };
      case 'COMPANY':
        return { w: 200, h: 80 };
      default:
        return { w: 180, h: 80 };
    }
  },

  getAnchorPoints: (node) => {
    const dim = GraphEngine.getDimensions(node);
    const w = dim.w;
    const h = dim.h;

    return {
      top:    { id: 'top',    x: node.x + (w / 2), y: node.y },
      bottom: { id: 'bottom', x: node.x + (w / 2), y: node.y + h },
      left:   { id: 'left',   x: node.x,           y: node.y + (h / 2) },
      right:  { id: 'right',  x: node.x + w,       y: node.y + (h / 2) }
    };
  },

  calculateEdge: (parent, child) => {
    const pPoints = GraphEngine.getAnchorPoints(parent);
    const cPoints = GraphEngine.getAnchorPoints(child);

    const pSideOverride = child.parentSide; 
    const cSideOverride = child.childSide;

    let bestP = pPoints[pSideOverride] || null;
    let bestC = cPoints[cSideOverride] || null;

    if (!bestP || !bestC) {
      let minDistance = Infinity;
      const pArray = Object.values(pPoints);
      const cArray = Object.values(cPoints);

      for (let p of pArray) {
        for (let c of cArray) {
          const dx = p.x - c.x;
          const dy = p.y - c.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < minDistance) {
            minDistance = dist;
            if (!pSideOverride) bestP = p;
            if (!cSideOverride) bestC = c;
          }
        }
      }
    }

    if (!bestP) bestP = pPoints.right;
    if (!bestC) bestC = cPoints.left;

    return {
      x1: bestP.x, y1: bestP.y,
      x2: bestC.x, y2: bestC.y,
      pSide: bestP.id,
      cSide: bestC.id
    };
  }
};
