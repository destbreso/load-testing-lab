#!/usr/bin/env python3
"""
Script para agregar paneles de percentiles a los dashboards de Grafana
sin eliminar los paneles existentes.
"""

import json
import sys
from pathlib import Path

def create_percentile_timeseries_panel(y_position):
    """Crea un panel de time series con p50, p75, p90, p95, p99"""
    return {
        "datasource": {
            "type": "influxdb",
            "uid": "influxdb"
        },
        "fieldConfig": {
            "defaults": {
                "color": {
                    "mode": "palette-classic"
                },
                "custom": {
                    "axisCenteredZero": False,
                    "axisColorMode": "text",
                    "axisLabel": "Duration (ms)",
                    "axisPlacement": "auto",
                    "barAlignment": 0,
                    "drawStyle": "line",
                    "fillOpacity": 10,
                    "gradientMode": "none",
                    "hideFrom": {
                        "tooltip": False,
                        "viz": False,
                        "legend": False
                    },
                    "lineInterpolation": "smooth",
                    "lineWidth": 2,
                    "pointSize": 5,
                    "scaleDistribution": {
                        "type": "linear"
                    },
                    "showPoints": "never",
                    "spanNulls": False,
                    "stacking": {
                        "group": "A",
                        "mode": "none"
                    },
                    "thresholdsStyle": {
                        "mode": "off"
                    }
                },
                "mappings": [],
                "thresholds": {
                    "mode": "absolute",
                    "steps": [
                        {
                            "color": "green",
                            "value": None
                        },
                        {
                            "color": "yellow",
                            "value": 1000
                        },
                        {
                            "color": "red",
                            "value": 2000
                        }
                    ]
                },
                "unit": "ms"
            },
            "overrides": [
                {
                    "matcher": {"id": "byName", "options": "p50"},
                    "properties": [
                        {"id": "color", "value": {"fixedColor": "green", "mode": "fixed"}},
                        {"id": "custom.lineWidth", "value": 2}
                    ]
                },
                {
                    "matcher": {"id": "byName", "options": "p75"},
                    "properties": [
                        {"id": "color", "value": {"fixedColor": "blue", "mode": "fixed"}},
                        {"id": "custom.lineWidth", "value": 2}
                    ]
                },
                {
                    "matcher": {"id": "byName", "options": "p90"},
                    "properties": [
                        {"id": "color", "value": {"fixedColor": "yellow", "mode": "fixed"}},
                        {"id": "custom.lineWidth", "value": 2}
                    ]
                },
                {
                    "matcher": {"id": "byName", "options": "p95"},
                    "properties": [
                        {"id": "color", "value": {"fixedColor": "orange", "mode": "fixed"}},
                        {"id": "custom.lineWidth", "value": 3}
                    ]
                },
                {
                    "matcher": {"id": "byName", "options": "p99"},
                    "properties": [
                        {"id": "color", "value": {"fixedColor": "red", "mode": "fixed"}},
                        {"id": "custom.lineWidth", "value": 3}
                    ]
                }
            ]
        },
        "gridPos": {
            "h": 8,
            "w": 24,
            "x": 0,
            "y": y_position
        },
        "id": 100,  # ID único
        "options": {
            "legend": {
                "calcs": ["mean", "max", "last"],
                "displayMode": "table",
                "placement": "bottom",
                "showLegend": True
            },
            "tooltip": {
                "mode": "multi",
                "sort": "desc"
            }
        },
        "targets": [
            {
                "datasource": {
                    "type": "influxdb",
                    "uid": "influxdb"
                },
                "query": """from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: (tables=<-, column) => 
      tables 
        |> quantile(q: 0.50, column: column, method: "exact_mean"), 
      createEmpty: false)
  |> set(key: "_field", value: "p50")""",
                "refId": "A"
            },
            {
                "datasource": {
                    "type": "influxdb",
                    "uid": "influxdb"
                },
                "query": """from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: (tables=<-, column) => 
      tables 
        |> quantile(q: 0.75, column: column, method: "exact_mean"), 
      createEmpty: false)
  |> set(key: "_field", value: "p75")""",
                "refId": "B"
            },
            {
                "datasource": {
                    "type": "influxdb",
                    "uid": "influxdb"
                },
                "query": """from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: (tables=<-, column) => 
      tables 
        |> quantile(q: 0.90, column: column, method: "exact_mean"), 
      createEmpty: false)
  |> set(key: "_field", value: "p90")""",
                "refId": "C"
            },
            {
                "datasource": {
                    "type": "influxdb",
                    "uid": "influxdb"
                },
                "query": """from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: (tables=<-, column) => 
      tables 
        |> quantile(q: 0.95, column: column, method: "exact_mean"), 
      createEmpty: false)
  |> set(key: "_field", value: "p95")""",
                "refId": "D"
            },
            {
                "datasource": {
                    "type": "influxdb",
                    "uid": "influxdb"
                },
                "query": """from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> aggregateWindow(every: v.windowPeriod, fn: (tables=<-, column) => 
      tables 
        |> quantile(q: 0.99, column: column, method: "exact_mean"), 
      createEmpty: false)
  |> set(key: "_field", value: "p99")""",
                "refId": "E"
            }
        ],
        "title": "📊 Response Time Percentiles (p50, p75, p90, p95, p99)",
        "type": "timeseries"
    }

def create_percentile_stat_panels(y_position):
    """Crea 5 stat panels pequeños con los valores actuales de cada percentil"""
    panels = []
    percentiles = [
        ("p50", "Median", "green", 0),
        ("p75", "75th", "blue", 5),
        ("p90", "90th", "yellow", 10),
        ("p95", "95th", "orange", 15),
        ("p99", "99th", "red", 19)
    ]
    
    for i, (pname, display_name, color, x_offset) in enumerate(percentiles):
        percentile_value = float(pname[1:]) / 100.0
        panel = {
            "datasource": {
                "type": "influxdb",
                "uid": "influxdb"
            },
            "fieldConfig": {
                "defaults": {
                    "color": {
                        "fixedColor": color,
                        "mode": "fixed"
                    },
                    "mappings": [],
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {
                                "color": "green",
                                "value": None
                            },
                            {
                                "color": "yellow",
                                "value": 1000
                            },
                            {
                                "color": "red",
                                "value": 2000
                            }
                        ]
                    },
                    "unit": "ms"
                },
                "overrides": []
            },
            "gridPos": {
                "h": 4,
                "w": 5 if i < 4 else 4,  # Último panel más pequeño para que quepa
                "x": x_offset,
                "y": y_position
            },
            "id": 101 + i,
            "options": {
                "colorMode": "value",
                "graphMode": "area",
                "justifyMode": "center",
                "orientation": "auto",
                "reduceOptions": {
                    "calcs": ["lastNotNull"],
                    "fields": "",
                    "values": False
                },
                "textMode": "value_and_name"
            },
            "pluginVersion": "10.1.0",
            "targets": [
                {
                    "datasource": {
                        "type": "influxdb",
                        "uid": "influxdb"
                    },
                    "query": f"""from(bucket: "loadtests")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r["_measurement"] == "http_req_duration")
  |> filter(fn: (r) => r["_field"] == "value")
  |> quantile(q: {percentile_value}, method: "exact_mean")""",
                    "refId": "A"
                }
            ],
            "title": f"{display_name} Percentile ({pname})",
            "type": "stat"
        }
        panels.append(panel)
    
    return panels

def adjust_panel_positions(panels, offset_y):
    """Ajusta las posiciones Y de todos los paneles existentes"""
    for panel in panels:
        if 'gridPos' in panel:
            panel['gridPos']['y'] += offset_y
    return panels

def add_percentile_panels(dashboard_path):
    """Agrega paneles de percentiles a un dashboard existente"""
    print(f"📊 Procesando: {dashboard_path.name}")
    
    with open(dashboard_path, 'r') as f:
        dashboard = json.load(f)
    
    # Encontrar el max ID actual
    max_id = max([panel.get('id', 0) for panel in dashboard['panels']])
    print(f"   Max ID actual: {max_id}")
    
    # Encontrar la máxima posición Y
    max_y = max([panel['gridPos']['y'] + panel['gridPos']['h'] for panel in dashboard['panels']])
    print(f"   Max Y actual: {max_y}")
    
    # Crear nuevos paneles
    percentile_chart = create_percentile_timeseries_panel(max_y)
    percentile_chart['id'] = max_id + 1
    
    stat_panels = create_percentile_stat_panels(max_y + 8)
    for i, panel in enumerate(stat_panels):
        panel['id'] = max_id + 2 + i
    
    # Agregar los nuevos paneles
    dashboard['panels'].append(percentile_chart)
    dashboard['panels'].extend(stat_panels)
    
    print(f"   ✅ Agregados {1 + len(stat_panels)} paneles nuevos")
    print(f"   📊 Panel de percentiles: ID {percentile_chart['id']} en Y={max_y}")
    print(f"   📈 Stat panels: IDs {max_id + 2} a {max_id + 1 + len(stat_panels)} en Y={max_y + 8}")
    
    # Guardar
    with open(dashboard_path, 'w') as f:
        json.dump(dashboard, f, indent=2)
    
    print(f"   💾 Guardado exitosamente\n")

def main():
    grafana_dir = Path(__file__).parent.parent / "grafana" / "dashboards"
    
    k6_dashboards = [
        "k6-dashboard.json",
        "k6-dashboard-elite.json",
        "k6-dashboard-pro.json"
    ]
    
    print("\n🚀 Agregando paneles de percentiles a dashboards de k6\n")
    print("=" * 60)
    
    for dashboard_name in k6_dashboards:
        dashboard_path = grafana_dir / dashboard_name
        if dashboard_path.exists():
            add_percentile_panels(dashboard_path)
        else:
            print(f"⚠️  No encontrado: {dashboard_name}")
    
    print("=" * 60)
    print("\n✅ Proceso completado!")
    print("\n💡 Cambios realizados:")
    print("   • Agregado panel 'Response Time Percentiles' con p50, p75, p90, p95, p99")
    print("   • Agregados 5 stat panels individuales para cada percentil")
    print("   • Los paneles existentes NO fueron modificados")
    print("   • Reinicia Grafana para ver los cambios: ltlab restart -s grafana\n")

if __name__ == "__main__":
    main()
