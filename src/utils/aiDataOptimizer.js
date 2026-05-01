/**
 * AI Data Optimizer for Asetpedia Institutional Intelligence
 * Designed to minimize token usage without losing analytical depth.
 */

export function optimizeAIData(data) {
  if (!data || typeof data !== 'object') return data;

  const processNode = (node) => {
    if (Array.isArray(node)) {
      // Strategy: Compact Historical Data
      if (node.length > 0 && node[0] && typeof node[0] === 'object') {
         const first = node[0];
         const keys = Object.keys(first);
         if (keys.includes('date') || keys.includes('time')) {
             return compactHistory(node);
         }
      }
      return node.map(processNode).filter(val => val !== null && val !== undefined);
    }

    if (node && typeof node === 'object' && !(node instanceof Date)) {
      const result = {};
      let hasContent = false;
      
      for (const [key, value] of Object.entries(node)) {
        // Strategy: Remove null/empty values
        if (value === null || value === undefined || value === '') continue;

        const processed = processNode(value);
        if (processed !== null && processed !== undefined && processed !== '') {
           result[key] = processed;
           hasContent = true;
        }
      }
      return hasContent ? result : null;
    }

    return node;
  };

  return processNode(data);
}

function compactHistory(history) {
    if (!Array.isArray(history) || history.length === 0) return history;
    
    const first = history[0];
    const last = history[history.length - 1];
    const keys = Object.keys(first);
    const dateKey = keys.find(k => k === 'date' || k === 'time' || k === 'timestamp');
    
    if (!dateKey) return history;
    
    const startDate = first[dateKey];
    const endDate = last[dateKey];
    
    // Detect what values to extract (prioritize price/close)
    const values = history.map(h => {
        if (h.close !== undefined) return h.close;
        if (h.price !== undefined) return h.price;
        if (h.value !== undefined) return h.value;
        const valKey = keys.find(k => k !== dateKey && typeof h[k] === 'number');
        return valKey ? h[valKey] : h;
    });
    
    // Extremely compact format: [start..end, ...values]
    return {
        period: `${startDate} to ${endDate}`,
        data: values 
    };
}

/**
 * Cross-company normalization: if comparing multiple entities,
 * ensure keys are consistent and missing ones are marked with "-"
 * as per user request to save tokens while maintaining structure.
 */
export function normalizeComparativeData(symbols, slicedData) {
    if (!slicedData) return {};
    
    const allKeys = new Set();
    symbols.forEach(sym => {
        const symData = slicedData[sym] || {};
        Object.keys(symData).forEach(k => allKeys.add(k));
    });

    const normalized = {};
    symbols.forEach(sym => {
        const symData = slicedData[sym] || {};
        const result = {};
        
        allKeys.forEach(key => {
            const val = symData[key];
            // If the value is missing or was marked as [DATA UNAVAILABLE] by slicer
            if (val === undefined || val === null || val === '' || val === '[DATA UNAVAILABLE]') {
                result[key] = "-";
            } else {
                result[key] = optimizeAIData(val);
            }
        });
        normalized[sym] = result;
    });

    return normalized;
}
