import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType } from 'chart.js';
import { PredioAnalysisService } from '../../services/predio-analysis.service';
import { AuthService } from '../../services/auth.service';
import { PropietarioRUT, AnalisisPredios, PredioIGAC } from '../../models/predio-analysis.model';

@Component({
    selector: 'app-predio-analysis',
    standalone: true,
    imports: [CommonModule, FormsModule, BaseChartDirective],
    templateUrl: './predio-analysis.html',
    styleUrls: ['./predio-analysis.scss']
})
export class PredioAnalysisComponent implements OnInit, OnDestroy {
    @ViewChild('fileInput') fileInput!: ElementRef;

    // Estados
    cargando = false;
    analizando = false;
    analisisCompletado = false;
    error: string | null = null;

    // Datos
    archivosSeleccionados: File[] = [];
    archivoIGAC: File | null = null;
    archivosRUT: File[] = [];
    propietariosCargados: PropietarioRUT[] = [];
    prediosCargados: PredioIGAC[] = [];
    analisis: AnalisisPredios | null = null;

    // Gráficos - Estados
    chartEstadosData: ChartConfiguration['data'] = {
        labels: [],
        datasets: [{
            data: [],
            backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d'],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };
    chartEstadosOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { font: { size: 12 } } },
            title: { display: true, text: 'Distribución por Estado', font: { size: 16, weight: 'bold' } }
        }
    };
    chartEstadosType: ChartType = 'doughnut';

    // Gráficos - Departamentos
    chartDepartamentosData: ChartConfiguration['data'] = {
        labels: [],
        datasets: [{
            label: 'Cantidad de Propietarios',
            data: [],
            backgroundColor: '#007bff',
            borderColor: '#0056b3',
            borderWidth: 1
        }]
    };
    chartDepartamentosOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: true, text: 'Top 10 Departamentos', font: { size: 16, weight: 'bold' } }
        },
        scales: {
            y: { beginAtZero: true, ticks: { font: { size: 11 } } },
            x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } }
        }
    };
    chartDepartamentosType: ChartType = 'bar';

    // Gráficos - Municipios
    chartMunicipiosData: ChartConfiguration['data'] = {
        labels: [],
        datasets: [{
            label: 'Cantidad de Propietarios',
            data: [],
            backgroundColor: '#17a2b8',
            borderColor: '#117a8b',
            borderWidth: 1
        }]
    };
    chartMunicipiosOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: true, text: 'Top 10 Municipios', font: { size: 16, weight: 'bold' } }
        },
        scales: {
            y: { beginAtZero: true, ticks: { font: { size: 11 } } },
            x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 } }
        }
    };
    chartMunicipiosType: ChartType = 'bar';

    // Gráficos - Tipos
    chartTiposData: ChartConfiguration['data'] = {
        labels: [],
        datasets: [{
            data: [],
            backgroundColor: ['#fd7e14', '#20c997'],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };
    chartTiposOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { font: { size: 12 } } },
            title: { display: true, text: 'Personas Naturales vs Jurídicas', font: { size: 16, weight: 'bold' } }
        }
    };
    chartTiposType: ChartType = 'pie';

    // Gráficos - Contactabilidad
    chartContactoData: ChartConfiguration['data'] = {
        labels: ['Con Correo', 'Sin Correo'],
        datasets: [{
            data: [0, 0],
            backgroundColor: ['#28a745', '#dc3545'],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };
    chartContactoOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { font: { size: 12 } } },
            title: { display: true, text: 'Contactabilidad por Email', font: { size: 16, weight: 'bold' } }
        }
    };
    chartContactoType: ChartType = 'doughnut';

    // Propietarios paginados
    propietariosFiltrados: PropietarioRUT[] = [];
    propietariosPaginados: PropietarioRUT[] = [];
    paginaActual = 1;
    itemsPorPagina = 20;
    totalPaginas = 0;

    // Filtros
    filtroEstado = '';
    filtroDepartamento = '';
    filtroMunicipio = '';
    filtroTexto = '';

    // Exponer Math para el template
    Math = Math;

    constructor(
        private predioService: PredioAnalysisService,
        private authService: AuthService,
        private router: Router
    ) { }

    ngOnInit(): void {
        // Verificar autenticación
        if (!this.authService.isAuthenticated()) {
            this.router.navigate(['/login']);
        }
    }

    ngOnDestroy(): void {
        // Limpiar recursos
    }

    /**
     * Maneja selección de archivos
     */
    onFilesSelected(event: any): void {
        const files: FileList = event.target.files;
        this.archivosSeleccionados = Array.from(files);
        this.error = null;

        // Separar archivo IGAC de archivos RUT
        this.archivoIGAC = null;
        this.archivosRUT = [];

        this.archivosSeleccionados.forEach(file => {
            const nombreLower = file.name.toLowerCase();
            if (nombreLower.includes('igac') || nombreLower.includes('lgac')) {
                this.archivoIGAC = file;
                console.log(`📋 Archivo IGAC detectado: ${file.name}`);
            } else {
                this.archivosRUT.push(file);
                console.log(`📄 Archivo RUT: ${file.name}`);
            }
        });

        if (this.archivosSeleccionados.length > 0) {
            console.log(`📁 Total: ${this.archivosSeleccionados.length} archivo(s)`);
            console.log(`   - IGAC: ${this.archivoIGAC ? 1 : 0}`);
            console.log(`   - RUT: ${this.archivosRUT.length}`);
            
            // Auto-procesar si hay archivo IGAC
            if (this.archivoIGAC) {
                setTimeout(() => this.procesarArchivos(), 500);
            }
        }
    }

    /**
     * Procesa los archivos CSV seleccionados
     */
    async procesarArchivos(): Promise<void> {
        if (this.archivosSeleccionados.length === 0) {
            this.error = 'Por favor seleccione al menos un archivo CSV';
            return;
        }

        if (!this.archivoIGAC) {
            this.error = 'Debe incluir el archivo IGAC principal (debe contener "IGAC" o "LGAC" en el nombre)';
            return;
        }

        this.cargando = true;
        this.analizando = true;
        this.error = null;
        this.propietariosCargados = [];
        this.prediosCargados = [];

        try {
            // 1. Procesar archivo IGAC (predios con propietarios)
            console.log('📋 Paso 1: Procesando archivo IGAC principal...');
            const contenidoIGAC = await this.predioService.readFileAsText(this.archivoIGAC);
            const resultadoIGAC = this.predioService.parseIGAC(contenidoIGAC);

            if (resultadoIGAC.errores.length > 0) {
                console.warn('⚠️ Errores en archivo IGAC:', resultadoIGAC.errores);
            }

            this.prediosCargados = resultadoIGAC.predios;
            console.log(`✅ ${this.prediosCargados.length} predios cargados`);

            // 2. Procesar archivos RUT (información detallada de propietarios)
            console.log('📄 Paso 2: Procesando archivos RUT complementarios...');
            for (const file of this.archivosRUT) {
                console.log(`   - Procesando: ${file.name}`);
                const contenido = await this.predioService.readFileAsText(file);
                const resultado = this.predioService.parseCSV(contenido);

                if (resultado.errores.length > 0) {
                    console.warn(`   ⚠️ Errores en ${file.name}:`, resultado.errores.slice(0, 5));
                }

                this.propietariosCargados.push(...resultado.propietarios);
            }

            console.log(`✅ ${this.propietariosCargados.length} registros RUT cargados`);

            // 3. Complementar información de predios con datos RUT
            console.log('🔗 Paso 3: Complementando información de propietarios...');
            this.prediosCargados = this.predioService.complementarPrediosConRUT(
                this.prediosCargados,
                this.propietariosCargados
            );

            // 4. Analizar datos
            console.log('📊 Paso 4: Generando análisis...');
            this.analisis = this.predioService.analizarPredios(this.prediosCargados);

            // Preparar propietarios para tabla (todos los propietarios únicos)
            const propietariosMap = new Map<string, PropietarioRUT>();
            this.prediosCargados.forEach(predio => {
                predio.propietariosDetallados?.forEach(prop => {
                    if (!propietariosMap.has(prop.nit)) {
                        propietariosMap.set(prop.nit, prop);
                    }
                });
            });
            this.propietariosFiltrados = Array.from(propietariosMap.values());
            
            // Generar gráficos
            this.generarGraficos();
            
            // Paginar
            this.aplicarPaginacion();

            this.analisisCompletado = true;
            console.log('✅ Análisis completado exitosamente');

        } catch (err: any) {
            console.error('❌ Error procesando archivos:', err);
            this.error = `Error al procesar archivos: ${err.message}`;
        } finally {
            this.cargando = false;
            this.analizando = false;
        }
    }

    /**
     * Genera todos los gráficos
     */
    private generarGraficos(): void {
        if (!this.analisis) return;

        // Gráfico de estados
        const estadosLabels: string[] = [];
        const estadosData: number[] = [];
        Object.entries(this.analisis.propietariosPorEstado).forEach(([estado, cantidad]) => {
            if (cantidad > 0) {
                estadosLabels.push(estado);
                estadosData.push(cantidad);
            }
        });
        this.chartEstadosData = {
            labels: estadosLabels,
            datasets: [{
                data: estadosData,
                backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#6c757d'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };

        // Gráfico de departamentos
        this.chartDepartamentosData = {
            labels: this.analisis.topDepartamentos.map(d => d.departamento),
            datasets: [{
                label: 'Propietarios',
                data: this.analisis.topDepartamentos.map(d => d.cantidad),
                backgroundColor: '#007bff',
                borderColor: '#0056b3',
                borderWidth: 1
            }]
        };

        // Gráfico de municipios
        this.chartMunicipiosData = {
            labels: this.analisis.topMunicipios.map(m => m.municipio),
            datasets: [{
                label: 'Propietarios',
                data: this.analisis.topMunicipios.map(m => m.cantidad),
                backgroundColor: '#17a2b8',
                borderColor: '#117a8b',
                borderWidth: 1
            }]
        };

        // Gráfico de tipos
        this.chartTiposData = {
            labels: ['Personas Naturales', 'Personas Jurídicas'],
            datasets: [{
                data: [
                    this.analisis.distribuciones.personasNaturales,
                    this.analisis.distribuciones.personasJuridicas
                ],
                backgroundColor: ['#fd7e14', '#20c997'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };

        // Gráfico de contacto
        this.chartContactoData = {
            labels: ['Con Correo', 'Sin Correo'],
            datasets: [{
                data: [
                    this.analisis.propietariosConCorreo,
                    this.analisis.totalPropietarios - this.analisis.propietariosConCorreo
                ],
                backgroundColor: ['#28a745', '#dc3545'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
    }

    /**
     * Aplica filtros a la lista de propietarios
     */
    aplicarFiltros(): void {
        this.propietariosFiltrados = this.propietariosCargados.filter(prop => {
            let cumple = true;

            if (this.filtroEstado && prop.estado !== this.filtroEstado) {
                cumple = false;
            }

            if (this.filtroDepartamento && prop.departamento !== this.filtroDepartamento) {
                cumple = false;
            }

            if (this.filtroMunicipio && prop.municipio !== this.filtroMunicipio) {
                cumple = false;
            }

            if (this.filtroTexto) {
                const texto = this.filtroTexto.toLowerCase();
                cumple = cumple && (
                    prop.nit.toLowerCase().includes(texto) ||
                    prop.nombre_razon_social.toLowerCase().includes(texto) ||
                    prop.correo.toLowerCase().includes(texto)
                );
            }

            return cumple;
        });

        this.paginaActual = 1;
        this.aplicarPaginacion();
    }

    /**
     * Limpia todos los filtros
     */
    limpiarFiltros(): void {
        this.filtroEstado = '';
        this.filtroDepartamento = '';
        this.filtroMunicipio = '';
        this.filtroTexto = '';
        this.aplicarFiltros();
    }

    /**
     * Aplica paginación
     */
    private aplicarPaginacion(): void {
        this.totalPaginas = Math.ceil(this.propietariosFiltrados.length / this.itemsPorPagina);
        const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
        const fin = inicio + this.itemsPorPagina;
        this.propietariosPaginados = this.propietariosFiltrados.slice(inicio, fin);
    }

    /**
     * Cambia de página
     */
    cambiarPagina(pagina: number): void {
        if (pagina >= 1 && pagina <= this.totalPaginas) {
            this.paginaActual = pagina;
            this.aplicarPaginacion();
        }
    }

    /**
     * Exporta análisis a CSV
     */
    exportarCSV(): void {
        if (!this.analisis) return;

        const headers = ['NIT', 'Nombre/Razón Social', 'Tipo', 'Estado', 'Departamento', 'Municipio', 'Dirección', 'Teléfono 1', 'Teléfono 2', 'Correo'];
        const rows = this.propietariosFiltrados.map(p => [
            p.nit,
            p.nombre_razon_social,
            p.tipo,
            p.estado,
            p.departamento,
            p.municipio,
            p.direccion,
            p.telefono1,
            p.telefono2,
            p.correo
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analisis_propietarios_${new Date().getTime()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Reinicia el análisis
     */
    reiniciar(): void {
        this.archivosSeleccionados = [];
        this.archivoIGAC = null;
        this.archivosRUT = [];
        this.propietariosCargados = [];
        this.prediosCargados = [];
        this.analisis = null;
        this.analisisCompletado = false;
        this.error = null;
        this.limpiarFiltros();
        if (this.fileInput) {
            this.fileInput.nativeElement.value = '';
        }
    }

    /**
     * Obtiene estados únicos
     */
    get estadosUnicos(): string[] {
        if (!this.analisis) return [];
        return Object.keys(this.analisis.propietariosPorEstado).sort();
    }

    /**
     * Obtiene departamentos únicos
     */
    get departamentosUnicos(): string[] {
        if (!this.analisis) return [];
        return Object.keys(this.analisis.propietariosPorDepartamento).sort();
    }

    /**
     * Obtiene municipios únicos
     */
    get municipiosUnicos(): string[] {
        if (!this.analisis) return [];
        return Object.keys(this.analisis.propietariosPorMunicipio).sort();
    }

    /**
     * Navegación
     */
    logout(): void {
        this.authService.logout();
        this.router.navigate(['/login']);
    }

    get entity() {
        const user = this.authService.getCurrentUserValue();
        return user?.entity || null;
    }

    isAdmin(): boolean {
        return this.authService.isAdmin();
    }
}
