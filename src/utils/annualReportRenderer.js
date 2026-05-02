/**
 * Universal Mining Report Renderer v2.0 (ES Module)
 * Memproses JSON laporan keuangan pertambangan dan menghasilkan HTML.
 * Support: narrative, table, graph (bar_chart, dual_axis_line_chart), mixed
 *
 * @param {Object} json - Data laporan sesuai struktur standar.
 * @param {HTMLElement} container - Elemen HTML target.
 */
export function renderMiningReport(json, container) {
    if (!container) {
        console.error('Container element not found.');
        return;
    }

    const root = document.createElement('div');
    root.className = 'report-container';

    // ---- Render Header ----
    if (json.report_metadata) {
        const meta = json.report_metadata;
        const header = document.createElement('header');
        header.className = 'report-header';
        const theme = meta.theme || {};
        const titleText = theme.title_eng
            ? `${meta.entity} — ${theme.title_eng}`
            : meta.entity;
        header.innerHTML = `
            <h1>${escHtml(titleText)}</h1>
            <div class="subtitle">${escHtml(theme.title || '')}</div>
            <div class="metadata">
                ${escHtml(meta.ticker || 'N/A')} 
                • Laporan Tahunan ${meta.fiscal_year || ''} 
                • ${escHtml(meta.currency || 'USD')}
                • Auditor: ${escHtml(meta.auditor || 'N/A')} 
                (${escHtml(meta.auditor_opinion || 'N/A')})
            </div>
            ${meta.report_date ? `<div class="report-date">Rilis: ${escHtml(meta.report_date)}</div>` : ''}
        `;
        root.appendChild(header);
    }

    // ---- Render Sections ----
    if (json.sections && Array.isArray(json.sections)) {
        json.sections.forEach(section => {
            const secDiv = document.createElement('section');
            secDiv.className = 'report-section';
            secDiv.id = 'section-' + (section.section_id || '');

            const title = document.createElement('h2');
            title.className = 'section-title';
            title.textContent = section.section_title || '';
            secDiv.appendChild(title);

            const displayType = section.display_type || 'narrative';

            if (displayType === 'narrative') {
                if (section.content) {
                    secDiv.appendChild(createNarrativeBlock(section.content));
                }
                if (section.subsections) {
                    section.subsections.forEach(sub => {
                        const subDiv = createSubsection(sub);
                        if (subDiv) secDiv.appendChild(subDiv);
                    });
                }
            } else if (displayType === 'table') {
                if (section.table) secDiv.appendChild(createTable(section.table));
                if (section.analysis) {
                    secDiv.appendChild(createNarrativeBlock(
                        typeof section.analysis === 'string'
                            ? { narrative: section.analysis }
                            : section.analysis
                    ));
                }
                if (section.subsections) {
                    section.subsections.forEach(sub => {
                        const subDiv = createSubsection(sub);
                        if (subDiv) secDiv.appendChild(subDiv);
                    });
                }
            } else if (displayType === 'graph') {
                secDiv.appendChild(createChartBlock(section));
            } else if (displayType === 'mixed') {
                if (section.content) {
                    secDiv.appendChild(createNarrativeBlock(section.content));
                }
                if (section.subsections) {
                    section.subsections.forEach(sub => {
                        const subDiv = createSubsection(sub);
                        if (subDiv) secDiv.appendChild(subDiv);
                    });
                }
            }

            root.appendChild(secDiv);
        });
    }

    // ---- Render Disclaimer ----
    if (json.disclaimer) {
        const disc = document.createElement('div');
        disc.className = 'disclaimer';
        disc.textContent = json.disclaimer;
        root.appendChild(disc);
    }

    container.innerHTML = '';
    container.appendChild(root);
}

// ===== Subsection Renderer =====
function createSubsection(sub) {
    if (!sub) return null;
    const subDiv = document.createElement('div');
    subDiv.className = 'subsection';

    if (sub.subsection_title) {
        const subTitle = document.createElement('h3');
        subTitle.className = 'subsection-title';
        subTitle.textContent = sub.subsection_title;
        subDiv.appendChild(subTitle);
    }

    const dtype = sub.display_type || 'narrative';

    if (dtype === 'narrative') {
        if (sub.content) subDiv.appendChild(createNarrativeBlock(sub.content));
    } else if (dtype === 'table') {
        if (sub.table) subDiv.appendChild(createTable(sub.table));
        if (sub.supporting_table) subDiv.appendChild(createTable(sub.supporting_table));
        if (sub.analysis) {
            subDiv.appendChild(createNarrativeBlock(
                typeof sub.analysis === 'string' ? { narrative: sub.analysis } : sub.analysis
            ));
        }
    } else if (dtype === 'graph') {
        subDiv.appendChild(createChartBlock(sub));
        if (sub.supporting_table) subDiv.appendChild(createTable(sub.supporting_table));
        if (sub.analysis) {
            subDiv.appendChild(createNarrativeBlock(
                typeof sub.analysis === 'string' ? { narrative: sub.analysis } : sub.analysis
            ));
        }
    } else if (dtype === 'mixed') {
        if (sub.content) subDiv.appendChild(createNarrativeBlock(sub.content));
        if (sub.table) subDiv.appendChild(createTable(sub.table));
        if (sub.data || sub.chart_data) subDiv.appendChild(createChartBlock(sub));
        if (sub.analysis) {
            subDiv.appendChild(createNarrativeBlock(
                typeof sub.analysis === 'string' ? { narrative: sub.analysis } : sub.analysis
            ));
        }
    }

    return subDiv;
}

// ===== Narrative Block =====
function createNarrativeBlock(content) {
    const wrapper = document.createElement('div');
    wrapper.className = 'narrative-block';

    if (!content) {
        wrapper.innerHTML = '<p></p>';
        return wrapper;
    }

    if (typeof content === 'string') {
        wrapper.innerHTML = `<p>${escHtml(content)}</p>`;
        return wrapper;
    }

    // Headline
    if (content.headline) {
        const p = document.createElement('p');
        p.className = 'headline';
        p.textContent = content.headline;
        wrapper.appendChild(p);
    }

    // Narrative paragraph
    if (content.narrative) {
        const p = document.createElement('p');
        p.textContent = content.narrative;
        wrapper.appendChild(p);
    }

    // Value creation drivers (list items)
    if (content.value_creation_drivers && Array.isArray(content.value_creation_drivers)) {
        const list = document.createElement('ul');
        list.className = 'value-drivers';
        content.value_creation_drivers.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
        });
        wrapper.appendChild(list);
    }

    // Key ratio analysis (Table)
    if (content.key_ratio_analysis) {
        const ratios = content.key_ratio_analysis;
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'mini-table-wrapper';
        
        const table = document.createElement('table');
        table.className = 'report-table mini-table';
        
        // Detect years from the first ratio object
        const firstKey = Object.keys(ratios)[0];
        const years = Object.keys(ratios[firstKey]).filter(k => k !== 'unit').sort().reverse();

        const thead = document.createElement('thead');
        let headerHtml = '<tr><th>Ratio</th>';
        years.forEach(y => headerHtml += `<th class="numeric">${y}</th>`);
        headerHtml += '<th>Unit</th></tr>';
        thead.innerHTML = headerHtml;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        Object.keys(ratios).forEach(key => {
            const r = ratios[key];
            const tr = document.createElement('tr');
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            
            let rowHtml = `<td>${label}</td>`;
            years.forEach(y => {
                rowHtml += `<td class="numeric">${formatNum(r[y])}</td>`;
            });
            rowHtml += `<td>${r.unit || ''}</td>`;
            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        wrapper.appendChild(tableWrapper);
    }

    return wrapper;
}

// ===== Table Renderer =====
function createTable(tableData) {
    if (!tableData) return document.createElement('div');

    const table = document.createElement('table');
    table.className = 'report-table';

    // Detect columns format: objects with key/label OR plain strings
    let columns = [];
    if (tableData.columns && Array.isArray(tableData.columns)) {
        if (tableData.columns.length > 0 && typeof tableData.columns[0] === 'object') {
            // Object format: { key: '...', label: '...' }
            columns = tableData.columns;
        } else {
            // String format: ['Metric', '2025', ...]
            // Use the original string as key because row data uses original column names
            columns = tableData.columns.map(c => ({
                key: c,
                label: c
            }));
        }
    }

    if (columns.length === 0) return table;

    // THEAD
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    columns.forEach((col, idx) => {
        const th = document.createElement('th');
        th.textContent = col.label || col;
        // Right align all headers except first
        if (idx > 0) th.style.textAlign = 'right';
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    // TBODY
    if (tableData.rows && Array.isArray(tableData.rows)) {
        const tbody = document.createElement('tbody');
        tableData.rows.forEach(row => {
            const tr = document.createElement('tr');
            columns.forEach((col, idx) => {
                const td = document.createElement('td');
                let val = row[col.key];

                if (val === undefined || val === null) {
                    val = '';
                    td.textContent = '-';
                    td.className = 'null-value';
                } else {
                    // Format numbers
                    const parsedVal = parseIndoNum(val);
                    if (typeof val === 'number') {
                        td.className = 'numeric';
                        td.textContent = formatNum(val);
                    } else if (!isNaN(parsedVal) && val.trim() !== '' && val !== '–') {
                        td.className = 'numeric';
                        td.textContent = val;
                    } else {
                        td.textContent = val;
                    }

                    // Color coding for change/trend columns
                    const keyLower = (col.key || col.label || '').toLowerCase();
                    if (keyLower.includes('change') || keyLower.includes('growth') || keyLower.includes('yoy') || keyLower.includes('perubahan')) {
                        const numVal = parseIndoNum(val);
                        if (!isNaN(numVal)) {
                            td.className = 'numeric';
                            if (numVal > 0) {
                                td.classList.add('positive');
                                if (!val.includes('+')) td.textContent = '+' + val;
                            } else if (numVal < 0) {
                                td.classList.add('negative');
                            }
                        }
                    }
                    if (keyLower.includes('trend')) {
                        const vStr = String(val).toLowerCase();
                        if (vStr.includes('↑') || vStr.includes('growth') || vStr.includes('strong') || vStr.includes('positive') || vStr.includes('kuat')) {
                            td.classList.add('positive');
                        } else if (vStr.includes('↓') || vStr.includes('decline') || vStr.includes('risk') || vStr.includes('lemah')) {
                            td.classList.add('negative');
                        }
                    }
                }
                
                // Right align all cells except first
                if (idx > 0) td.style.textAlign = 'right';

                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
    }

    return table;
}

// ===== Chart Renderer =====
function createChartBlock(section) {
    const chartDiv = document.createElement('div');
    chartDiv.className = 'chart-container';

    const title = document.createElement('div');
    title.className = 'chart-title';
    title.textContent = section.chart_title || section.subsection_title || 'Chart';
    chartDiv.appendChild(title);

    const data = section.data || (section.chart_data || null);
    if (!data || !data.series || !Array.isArray(data.series)) {
        chartDiv.innerHTML += '<p class="chart-empty">Data chart tidak tersedia.</p>';
        return chartDiv;
    }

    const chartType = section.chart_type || 'bar_chart';

    if (chartType === 'bar_chart') {
        const wrapper = document.createElement('div');
        wrapper.className = 'bar-chart-wrapper';

        const categories = data.categories || [];
        const series = data.series;

        // Find max value for scaling
        let maxVal = 0;
        series.forEach(s => {
            s.data.forEach(item => {
                let v = 0;
                if (typeof item === 'object' && item !== null) v = parseIndoNum(item.value) || 0;
                else v = parseIndoNum(item) || 0;
                if (v > maxVal) maxVal = v;
            });
        });
        // Round up maxVal for better grid lines
        const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal || 1)));
        maxVal = Math.ceil((maxVal || 1) / (magnitude / 2)) * (magnitude / 2);

        // Chart Layout with Grid
        const chartArea = document.createElement('div');
        chartArea.className = 'chart-area';

        // Grid lines & Y-Axis
        const yAxis = document.createElement('div');
        yAxis.className = 'y-axis-grid';
        for (let i = 0; i <= 4; i++) {
            const line = document.createElement('div');
            line.className = 'grid-line';
            const val = (maxVal * (i / 4));
            line.style.bottom = `${(i / 4) * 100}%`;
            line.innerHTML = `<span class="grid-label">${formatShortNum(val)}</span>`;
            yAxis.appendChild(line);
        }
        chartArea.appendChild(yAxis);

        // Bar groups
        const barsContainer = document.createElement('div');
        barsContainer.className = 'bars-container';

        categories.forEach((cat, catIdx) => {
            const group = document.createElement('div');
            group.className = 'bar-group';

            const barSetWrapper = document.createElement('div');
            barSetWrapper.className = 'bar-set-wrapper';

            series.forEach((s, sIdx) => {
                const item = s.data[catIdx];
                let val = 0;
                if (typeof item === 'object' && item !== null) val = parseIndoNum(item.value) || 0;
                else val = parseIndoNum(item) || 0;

                const barHeight = maxVal > 0 ? (val / maxVal) * 100 : 0;

                const bar = document.createElement('div');
                bar.className = 'bar';
                if (series.length === 1) bar.classList.add('bar-single');
                bar.style.height = `${barHeight}%`;
                bar.style.backgroundColor = getSeriesColor(sIdx);
                bar.style.setProperty('--bar-color', getSeriesColor(sIdx));
                bar.title = `${s.name} (${cat}): ${formatNum(val)}`;

                // Value label (only if enough height)
                if (barHeight > 10) {
                    const valLabel = document.createElement('span');
                    valLabel.className = 'bar-value-label';
                    valLabel.textContent = formatShortNum(val);
                    bar.appendChild(valLabel);
                }

                barSetWrapper.appendChild(bar);
            });

            group.appendChild(barSetWrapper);

            // Category label (Year)
            const catLabel = document.createElement('div');
            catLabel.className = 'bar-category-label';
            catLabel.textContent = cat;
            group.appendChild(catLabel);

            barsContainer.appendChild(group);
        });

        chartArea.appendChild(barsContainer);
        wrapper.appendChild(chartArea);

        // Legend
        const legend = document.createElement('div');
        legend.className = 'chart-legend';
        series.forEach((s, i) => {
            const item = document.createElement('span');
            item.className = 'legend-item';
            item.innerHTML = `<span class="legend-color" style="background:${getSeriesColor(i)}"></span> ${s.name}`;
            legend.appendChild(item);
        });
        wrapper.appendChild(legend);

        chartDiv.appendChild(wrapper);

    } else if (chartType === 'dual_axis_line_chart') {
        const wrapper = document.createElement('div');
        wrapper.className = 'dual-axis-wrapper';

        const categories = data.categories || [];
        const series = data.series;

        // Create canvas-based chart using inline SVG
        const svgWidth = Math.max(400, categories.length * 100);
        const svgHeight = 250;
        const padding = { top: 20, right: 80, bottom: 40, left: 70 };
        const plotWidth = svgWidth - padding.left - padding.right;
        const plotHeight = svgHeight - padding.top - padding.bottom;

        // Find max values for left and right axis
        let maxLeft = 0, maxRight = 0;
        series.forEach(s => {
            const vals = s.data.map(v => typeof v === 'number' ? v : 0);
            const maxV = Math.max(...vals, 1);
            if (s.axis === 'right') maxRight = Math.max(maxRight, maxV);
            else maxLeft = Math.max(maxLeft, maxV);
        });

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', svgWidth);
        svg.setAttribute('height', svgHeight);
        svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
        svg.style.maxWidth = '100%';

        // Y-axis grid lines (left)
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (plotHeight * (1 - i / 4));
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding.left);
            line.setAttribute('y1', y);
            line.setAttribute('x2', padding.left + plotWidth);
            line.setAttribute('y2', y);
            line.setAttribute('stroke', 'rgba(0, 0, 0, 0.05)');
            line.setAttribute('stroke-dasharray', '4,4');
            svg.appendChild(line);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', padding.left - 10);
            label.setAttribute('y', y + 4);
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('font-size', '10');
            label.setAttribute('fill', 'rgba(0, 0, 0, 0.4)');
            label.textContent = formatShortNum(maxLeft * (1 - i / 4));
            svg.appendChild(label);
        }

        // Y-axis grid lines (right)
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (plotHeight * (1 - i / 4));
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', padding.left + plotWidth + 10);
            label.setAttribute('y', y + 4);
            label.setAttribute('text-anchor', 'start');
            label.setAttribute('font-size', '10');
            label.setAttribute('fill', getSeriesColor(1));
            label.textContent = formatShortNum(maxRight * (1 - i / 4));
            svg.appendChild(label);
        }

        // Plot series
        const stepX = categories.length > 1 ? plotWidth / (categories.length - 1) : 0;

        // Sort series so bars are drawn first, then lines
        const barSeries = series.filter(s => s.type === 'bar');
        const lineSeries = series.filter(s => s.type !== 'bar');

        // Draw bars first (if any)
        barSeries.forEach((s, sIdx) => {
            const barWidth = Math.min(stepX * 0.5, 40);
            const rawMax = s.axis === 'right' ? maxRight : maxLeft;
            const maxVal = rawMax > 0 ? rawMax : 1;
            
            s.data.forEach((val, i) => {
                const v = typeof val === 'number' ? val : parseFloat(val);
                if (isNaN(v) || v === null || v === undefined) return;
                
                const x = padding.left + stepX * i - barWidth / 2;
                const h = (v / maxVal) * plotHeight;
                const y = padding.top + plotHeight - h;
                
                if (isNaN(x) || isNaN(y) || isNaN(h)) return;

                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rect.setAttribute('x', x);
                rect.setAttribute('y', y);
                rect.setAttribute('width', barWidth);
                rect.setAttribute('height', h);
                rect.setAttribute('rx', '2');
                rect.setAttribute('ry', '2');
                rect.setAttribute('fill', getSeriesColor(sIdx, 0.6));
                rect.setAttribute('opacity', '0.8');
                svg.appendChild(rect);
            });
        });

        // Draw lines
        lineSeries.forEach((s, sIdx) => {
            const rawMax = s.axis === 'right' ? maxRight : maxLeft;
            const maxVal = rawMax > 0 ? rawMax : 1;
            const points = [];
            const color = getSeriesColor(barSeries.length + sIdx);

            s.data.forEach((val, i) => {
                const v = typeof val === 'number' ? val : parseFloat(val);
                if (isNaN(v) || v === null || v === undefined) return;
                
                const x = padding.left + stepX * i;
                const y = padding.top + plotHeight - (v / maxVal) * plotHeight;
                
                if (isNaN(x) || isNaN(y)) return;
                points.push(`${x},${y}`);
            });

            if (points.length > 1) {
                const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                polyline.setAttribute('points', points.join(' '));
                polyline.setAttribute('fill', 'none');
                polyline.setAttribute('stroke', color);
                polyline.setAttribute('stroke-width', '2.5');
                polyline.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(polyline);

                // Data points
                s.data.forEach((val, i) => {
                    const v = typeof val === 'number' ? val : parseFloat(val);
                    if (isNaN(v) || v === null || v === undefined) return;
                    
                    const x = padding.left + stepX * i;
                    const y = padding.top + plotHeight - (v / maxVal) * plotHeight;

                    if (isNaN(x) || isNaN(y)) return;

                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', x);
                    circle.setAttribute('cy', y);
                    circle.setAttribute('r', '4');
                    circle.setAttribute('fill', color);
                    circle.setAttribute('stroke', '#fff');
                    circle.setAttribute('stroke-width', '1.5');
                    svg.appendChild(circle);
                });
            }
        });

        // X-axis labels
        categories.forEach((cat, i) => {
            const x = padding.left + stepX * i;
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', svgHeight - 5);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '11');
            label.setAttribute('font-weight', '700');
            label.setAttribute('fill', 'rgba(0, 0, 0, 0.6)');
            label.textContent = cat;
            svg.appendChild(label);
        });

        wrapper.appendChild(svg);

        // Legend
        const legend = document.createElement('div');
        legend.className = 'chart-legend';
        series.forEach((s, i) => {
            const item = document.createElement('span');
            item.className = 'legend-item';
            const color = getSeriesColor(s.type === 'bar' ? i : (barSeries.length + (i - barSeries.length)));
            item.innerHTML = `<span class="legend-color" style="background:${color}"></span> ${s.name}`;
            legend.appendChild(item);
        });
        wrapper.appendChild(legend);

        chartDiv.appendChild(wrapper);
    }

    return chartDiv;
}

// ===== Utility Functions =====

function parseIndoNum(val) {
    if (val === null || val === undefined || val === '' || val === '–') return NaN;
    if (typeof val === 'number') return val;
    let s = String(val).trim();
    // Remove thousand separators (dot) and replace decimal separator (comma) with dot
    s = s.replace(/\./g, '').replace(/,/g, '.');
    // Remove non-numeric characters except dot and minus
    s = s.replace(/[^0-9.-]/g, '');
    return parseFloat(s);
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatNum(n) {
    if (n === null || n === undefined || n === '') return '-';
    if (typeof n === 'string') {
        const parsed = parseIndoNum(n);
        if (isNaN(parsed)) return n;
        n = parsed;
    }
    if (Math.abs(n) >= 1_000_000_000) {
        return (n / 1_000_000_000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' B';
    } else if (Math.abs(n) >= 1_000_000) {
        return (n / 1_000_000).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' M';
    } else if (Math.abs(n) >= 1_000) {
        return (n / 1_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' K';
    } else if (Number.isInteger(n)) {
        return n.toLocaleString('id-ID');
    }
    return n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatShortNum(n) {
    if (n === null || n === undefined) return '';
    if (typeof n === 'string') {
        const parsed = parseFloat(n);
        if (isNaN(parsed)) return n;
        n = parsed;
    }
    const absN = Math.abs(n);
    if (absN >= 1_000_000_000) {
        return (n / 1_000_000_000).toFixed(1) + 'B';
    } else if (absN >= 1_000_000) {
        return (n / 1_000_000).toFixed(1) + 'M';
    } else if (absN >= 1_000) {
        return (n / 1_000).toFixed(1) + 'K';
    } else if (absN < 1 && absN > 0) {
        return n.toFixed(2);
    } else if (absN < 10 && absN > 0) {
        return n.toFixed(1);
    }
    return String(Math.round(n));
}

function getSeriesColor(index, opacity) {
    const colors = [
        '#005a9c', '#e67e22', '#27ae60', '#c0392b',
        '#8e44ad', '#16a085', '#d35400', '#2980b9',
        '#f1c40f', '#2c3e50', '#7f8c8d', '#e74c3c'
    ];
    const c = colors[index % colors.length];
    if (opacity !== undefined) {
        // Convert hex to rgba
        const r = parseInt(c.slice(1, 3), 16);
        const g = parseInt(c.slice(3, 5), 16);
        const b = parseInt(c.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${opacity})`;
    }
    return c;
}
