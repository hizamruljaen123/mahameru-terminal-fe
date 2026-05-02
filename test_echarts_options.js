import * as echarts from 'echarts';

const options = {
    "title": {"text": "PTBA.JK", "left": "center", "textStyle": {"color": "#e0e0e0"}},
    "tooltip": {"trigger": "axis", "axisPointer": {"type": "cross"}},
    "xAxis": [
        {"type": "category", "data": ["2025-04-28", "2025-05-05"], "gridIndex": 0, "axisLabel": {"color": "#888"}},
        {"type": "category", "data": ["2025-04-28", "2025-05-05"], "gridIndex": 1, "axisLabel": {"show": false}}
    ],
    "yAxis": [
        {"type": "value", "scale": true, "gridIndex": 0, "axisLabel": {"color": "#888"}},
        {"type": "value", "scale": true, "gridIndex": 1, "axisLabel": {"show": false}, "splitLine": {"show": false}}
    ],
    "grid": [
        {"left": "8%", "right": "8%", "top": "12%", "height": "55%"},
        {"left": "8%", "right": "8%", "top": "75%", "height": "18%"}
    ],
    "series": [
        {
            "name": "OHLC", "type": "candlestick",
            "data": [[2395.735647382527, 2431.22802734375, 2342.4970774406934, 2440.1011223340556], [2395.735647382527, 2431.22802734375, 2342.4970774406934, 2440.1011223340556]],
            "itemStyle": {"color": "#26a69a", "color0": "#ef5350", "borderColor": "#26a69a", "borderColor0": "#ef5350"},
            "xAxisIndex": 0, "yAxisIndex": 0
        },
        {
            "name": "Volume", "type": "bar",
            "data": [21611100.0, 21611100.0],
            "itemStyle": {"color": "#666"},
            "xAxisIndex": 1, "yAxisIndex": 1
        }
    ],
    "darkMode": true,
    "backgroundColor": "transparent"
};

const dom = document.createElement('div');
dom.style.width = '400px';
dom.style.height = '400px';
const instance = echarts.init(dom, 'dark', { renderer: 'canvas' });

try {
    instance.setOption(options);
    console.log("Success! No errors.");
} catch(e) {
    console.error("Error setting options:", e);
}
