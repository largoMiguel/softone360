import { Component, OnInit, OnDestroy, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

interface ViaViaje {
  id: number;
  conductor_nombre: string;
  placa_vehiculo: string;
  tipo_material: string | null;
  observacion: string | null;
  latitud: number;
  longitud: number;
  timestamp_registro: string;
  created_at: string;
}

interface ViaTramo {
  id: number;
  operador_nombre: string;
  nombre_maquina: string;
  tipo_trabajo: string | null;
  observacion: string | null;
  lat_inicio: number;
  lng_inicio: number;
  lat_fin: number;
  lng_fin: number;
  timestamp_inicio: string;
  timestamp_fin: string;
  created_at: string;
}

interface ViaMapaResponse {
  viajes: ViaViaje[];
  tramos: ViaTramo[];
}

@Component({
  selector: 'app-vias-mapa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vias-mapa.component.html',
  styleUrl: './vias-mapa.component.scss',
})
export class ViasMapaComponent implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  // Estado
  cargando = signal(false);
  error = signal('');
  viajes = signal<ViaViaje[]>([]);
  tramos = signal<ViaTramo[]>([]);

  // Filtros
  fechaInicio = '';
  fechaFin = '';
  entitySlug = '';

  // Mapa
  private map: L.Map | null = null;
  private capaPuntos: L.LayerGroup | null = null;
  private capaLineas: L.LayerGroup | null = null;

  // Contadores
  get totalViajes() { return this.viajes().length; }
  get totalTramos() { return this.tramos().length; }

  ngOnInit() {
    // Leer el slug desde el router (/:slug/seguimiento-vias)
    // Primero en params propios, luego en el padre (ruta hija hereda slug del parent)
    const params = this.route.snapshot.params;
    const parentParams = this.route.snapshot.parent?.params;
    this.entitySlug = params['slug'] || parentParams?.['slug'] || '';

    // Fechas por defecto: último mes
    const hoy = new Date();
    const hace30 = new Date(hoy);
    hace30.setDate(hace30.getDate() - 30);
    this.fechaFin = hoy.toISOString().split('T')[0];
    this.fechaInicio = hace30.toISOString().split('T')[0];
  }

  ngAfterViewInit() {
    // Pequeño delay para que el contenedor tenga dimensiones reales en el DOM
    setTimeout(() => {
      this.initMapa();
      if (this.entitySlug) this.cargarDatos();
    }, 150);
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); this.map = null; }
  }

  private initMapa() {
    const contenedor = document.getElementById('mapa-vias');
    if (!contenedor) return;
    if (this.map) { this.map.remove(); this.map = null; }

    // Fix para los iconos por defecto de Leaflet con webpack/Angular
    const iconDefault = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });
    L.Marker.prototype.options.icon = iconDefault;

    this.map = L.map('mapa-vias', { zoomControl: true }).setView([5.5, -73.5], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(this.map);

    this.capaPuntos = L.layerGroup().addTo(this.map);
    this.capaLineas = L.layerGroup().addTo(this.map);
  }

  buscar() {
    if (!this.entitySlug) { this.error.set('No se pudo determinar la entidad'); return; }
    this.cargarDatos();
  }

  private cargarDatos() {
    this.cargando.set(true);
    this.error.set('');

    const token = sessionStorage.getItem('token') || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    let url = `${environment.apiUrl}/vias/mapa?entity_slug=${this.entitySlug}`;
    if (this.fechaInicio) url += `&fecha_inicio=${this.fechaInicio}`;
    if (this.fechaFin)    url += `&fecha_fin=${this.fechaFin}T23:59:59`;

    this.http.get<ViaMapaResponse>(url, { headers }).subscribe({
      next: (data) => {
        this.viajes.set(data.viajes);
        this.tramos.set(data.tramos);
        this.cargando.set(false);
        this.pintarMapa();
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'Error al cargar los datos');
        this.cargando.set(false);
      },
    });
  }

  private pintarMapa() {
    if (!this.map || !this.capaPuntos || !this.capaLineas) return;
    this.capaPuntos.clearLayers();
    this.capaLineas.clearLayers();

    const bounds: any[] = [];

    // ── Puntos de descarga (volqueta) ──────────────────────────────
    for (const v of this.viajes()) {
      const lat = Number(v.latitud);
      const lng = Number(v.longitud);
      const fecha = new Date(v.timestamp_registro).toLocaleString('es-CO');

      const marker = L.circleMarker([lat, lng], {
        radius: 9,
        fillColor: '#e65100',
        color: '#bf360c',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      });

      marker.bindPopup(`
        <div style="min-width:180px;font-family:sans-serif">
          <b style="color:#e65100">🚛 Descarga de volqueta</b><br>
          <hr style="margin:6px 0">
          <b>Conductor:</b> ${v.conductor_nombre}<br>
          <b>Placa:</b> ${v.placa_vehiculo}<br>
          ${v.tipo_material ? `<b>Material:</b> ${v.tipo_material}<br>` : ''}
          ${v.observacion ? `<b>Observación:</b> ${v.observacion}<br>` : ''}
          <hr style="margin:6px 0">
          <small style="color:#999">${fecha}</small>
        </div>
      `);

      this.capaPuntos.addLayer(marker);
      bounds.push([lat, lng]);
    }

    // ── Tramos de maquinaria (líneas) ──────────────────────────────
    for (const t of this.tramos()) {
      const inicio: [number, number] = [Number(t.lat_inicio), Number(t.lng_inicio)];
      const fin: [number, number]    = [Number(t.lat_fin), Number(t.lng_fin)];
      const fechaInicio = new Date(t.timestamp_inicio).toLocaleString('es-CO');
      const fechaFin    = new Date(t.timestamp_fin).toLocaleString('es-CO');
      const durMin = Math.round(
        (new Date(t.timestamp_fin).getTime() - new Date(t.timestamp_inicio).getTime()) / 60000
      );

      const linea = L.polyline([inicio, fin], {
        color: '#2e7d32',
        weight: 6,
        opacity: 0.85,
        lineJoin: 'round',
      });

      linea.bindPopup(`
        <div style="min-width:200px;font-family:sans-serif">
          <b style="color:#2e7d32">🚜 Tramo intervenido</b><br>
          <hr style="margin:6px 0">
          <b>Operador:</b> ${t.operador_nombre}<br>
          <b>Máquina:</b> ${t.nombre_maquina}<br>
          ${t.tipo_trabajo ? `<b>Trabajo:</b> ${t.tipo_trabajo}<br>` : ''}
          ${t.observacion ? `<b>Observación:</b> ${t.observacion}<br>` : ''}
          <b>Duración:</b> ${durMin} min<br>
          <hr style="margin:6px 0">
          <small style="color:#999">Inicio: ${fechaInicio}<br>Fin: ${fechaFin}</small>
        </div>
      `);

      // Marcador de inicio (I) y fin (F)
      const iconoInicio = L.divIcon({
        html: '<div style="background:#2e7d32;color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white">I</div>',
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const iconoFin = L.divIcon({
        html: '<div style="background:#c62828;color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid white">F</div>',
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      this.capaLineas.addLayer(linea);
      this.capaLineas.addLayer(L.marker(inicio, { icon: iconoInicio }).bindPopup(`Inicio tramo — ${t.operador_nombre}`));
      this.capaLineas.addLayer(L.marker(fin, { icon: iconoFin }).bindPopup(`Fin tramo — ${t.operador_nombre}`));

      bounds.push(inicio, fin);
    }

    // Ajustar zoom para mostrar todos los puntos
    if (bounds.length > 0) {
      this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
    // Forzar re-renderizado por si el contenedor cambió de tamaño
    setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 200);
  }

  formatFecha(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  get urlVolqueta(): string {
    return `${window.location.origin}/volqueta.html?entity=${this.entitySlug}`;
  }

  get urlMaquinaria(): string {
    return `${window.location.origin}/maquinaria.html?entity=${this.entitySlug}`;
  }

  copiarUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => alert('URL copiada al portapapeles'));
  }
}
