import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import * as XLSX from 'xlsx';

interface Propietario {
  nit: string;
  nombre: string;
  tipo: string;
  estado: string;
  departamento: string;
  municipio: string;
  direccion: string;
  telefono: string;
  correo: string;
}

interface Predio {
  numeroIdentificacion: string;
  propietarios: string[];
  datosCompletos: Propietario[];
}

@Component({
  selector: 'app-analisis-csv',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './analisis-csv.component.html',
  styleUrls: ['./analisis-csv.component.scss']
})
export class AnalisisCsvComponent implements OnInit {
  predios: Predio[] = [];
  propietariosData: Propietario[] = [];
  
  // Estadísticas generales
  totalPredios = 0;
  totalPropietarios = 0;
  propietariosConDatos = 0;
  propietariosSinDatos = 0;
  
  // Gráfico de estados
  estadosChartData: ChartData<'pie'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [
        '#4CAF50',
        '#FF9800',
        '#F44336',
        '#2196F3',
        '#9C27B0'
      ]
    }]
  };
  
  estadosChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { size: 12 }
        }
      },
      title: {
        display: true,
        text: 'Distribución por Estado de Registro',
        font: { size: 16, weight: 'bold' }
      }
    }
  };
  
  estadosChartType: ChartType = 'pie';
  
  // Gráfico de departamentos
  departamentosChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      label: 'Propietarios por Departamento',
      data: [],
      backgroundColor: '#2196F3',
      borderColor: '#1976D2',
      borderWidth: 1
    }]
  };
  
  departamentosChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      title: {
        display: true,
        text: 'Propietarios por Departamento',
        font: { size: 16, weight: 'bold' }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };
  
  departamentosChartType: ChartType = 'bar';
  
  // Gráfico de municipios top
  municipiosChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: '#FF9800',
      borderColor: '#F57C00',
      borderWidth: 1
    }]
  };
  
  municipiosChartOptions: ChartConfiguration['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top'
      },
      title: {
        display: true,
        text: 'Top 10 Municipios con Más Propietarios',
        font: { size: 16, weight: 'bold' }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };
  
  municipiosChartType: ChartType = 'bar';
  
  // Gráfico de tipo de persona
  tipoChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: [
        '#4CAF50',
        '#2196F3',
        '#FF9800'
      ]
    }]
  };
  
  tipoChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          font: { size: 12 }
        }
      },
      title: {
        display: true,
        text: 'Tipo de Propietario',
        font: { size: 16, weight: 'bold' }
      }
    }
  };
  
  tipoChartType: ChartType = 'doughnut';
  
  // Tabla de datos
  propietariosConDatosCompletos: Propietario[] = [];
  loading = false;
  error: string | null = null;

  ngOnInit() {
    // Los datos se cargarán cuando el usuario suba los archivos
  }

  onFileChange(event: any, tipo: 'principal' | 'rut') {
    const files = event.target.files;
    if (files.length === 0) return;

    this.loading = true;
    this.error = null;

    if (tipo === 'principal') {
      this.procesarArchivoPrincipal(files[0]);
    } else {
      this.procesarArchivosRut(files);
    }
  }

  procesarArchivoPrincipal(file: File) {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        this.predios = [];
        
        // Asumiendo que la primera fila son encabezados
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row && row.length > 0) {
            const numeroIdentificacion = row[0]?.toString() || '';
            // Los propietarios pueden estar en varias columnas o separados por algún delimitador
            const propietariosStr = row[1]?.toString() || '';
            const propietarios = propietariosStr.split(/[,;]/).map((p: string) => p.trim()).filter((p: string) => p);
            
            if (numeroIdentificacion && propietarios.length > 0) {
              this.predios.push({
                numeroIdentificacion,
                propietarios,
                datosCompletos: []
              });
            }
          }
        }
        
        this.totalPredios = this.predios.length;
        this.loading = false;
      } catch (error) {
        this.error = 'Error al procesar el archivo principal: ' + error;
        this.loading = false;
      }
    };
    reader.readAsBinaryString(file);
  }

  procesarArchivosRut(files: FileList) {
    const propietariosMap = new Map<string, Propietario>();
    let filesProcessed = 0;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

          // Procesar datos (asumiendo estructura del CSV adjunto)
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row.length > 0 && row[0]) {
              const nit = row[0]?.toString().trim();
              if (nit && nit !== '' && !nit.includes(';;;;;')) {
                const propietario: Propietario = {
                  nit,
                  nombre: row[1]?.toString() || '',
                  tipo: row[2]?.toString() || '',
                  estado: row[4]?.toString() || '',
                  departamento: row[6]?.toString() || '',
                  municipio: row[7]?.toString() || '',
                  direccion: row[8]?.toString() || '',
                  telefono: row[9]?.toString() || row[10]?.toString() || '',
                  correo: row[11]?.toString() || ''
                };
                
                if (propietario.nombre) {
                  propietariosMap.set(nit, propietario);
                }
              }
            }
          }

          filesProcessed++;
          if (filesProcessed === files.length) {
            this.finalizarProcesamiento(propietariosMap);
          }
        } catch (error) {
          console.error('Error procesando archivo RUT:', error);
          filesProcessed++;
          if (filesProcessed === files.length) {
            this.finalizarProcesamiento(propietariosMap);
          }
        }
      };
      reader.readAsBinaryString(file);
    });
  }

  finalizarProcesamiento(propietariosMap: Map<string, Propietario>) {
    this.propietariosData = Array.from(propietariosMap.values());
    
    // Relacionar propietarios con predios
    this.predios.forEach(predio => {
      predio.datosCompletos = predio.propietarios
        .map(nit => propietariosMap.get(nit.trim()))
        .filter(p => p !== undefined) as Propietario[];
    });

    // Calcular estadísticas
    this.calcularEstadisticas();
    this.generarGraficos();
    this.loading = false;
  }

  calcularEstadisticas() {
    const todosLosPropietarios = this.predios.flatMap(p => p.datosCompletos);
    this.totalPropietarios = new Set(this.predios.flatMap(p => p.propietarios)).size;
    this.propietariosConDatos = todosLosPropietarios.length;
    this.propietariosSinDatos = this.totalPropietarios - new Set(todosLosPropietarios.map(p => p.nit)).size;
    this.propietariosConDatosCompletos = todosLosPropietarios;
  }

  generarGraficos() {
    const propietarios = this.predios.flatMap(p => p.datosCompletos);
    
    // Gráfico de estados
    const estadosCount = new Map<string, number>();
    propietarios.forEach(p => {
      const estado = p.estado || 'Sin información';
      estadosCount.set(estado, (estadosCount.get(estado) || 0) + 1);
    });
    
    this.estadosChartData = {
      labels: Array.from(estadosCount.keys()),
      datasets: [{
        data: Array.from(estadosCount.values()),
        backgroundColor: [
          '#4CAF50',
          '#FF9800',
          '#F44336',
          '#2196F3',
          '#9C27B0',
          '#00BCD4',
          '#FFEB3B'
        ]
      }]
    };

    // Gráfico de departamentos
    const deptosCount = new Map<string, number>();
    propietarios.forEach(p => {
      const depto = p.departamento || 'Sin información';
      deptosCount.set(depto, (deptosCount.get(depto) || 0) + 1);
    });
    
    this.departamentosChartData = {
      labels: Array.from(deptosCount.keys()),
      datasets: [{
        label: 'Propietarios por Departamento',
        data: Array.from(deptosCount.values()),
        backgroundColor: '#2196F3',
        borderColor: '#1976D2',
        borderWidth: 1
      }]
    };

    // Gráfico de municipios (top 10)
    const municipiosCount = new Map<string, number>();
    propietarios.forEach(p => {
      const municipio = p.municipio || 'Sin información';
      municipiosCount.set(municipio, (municipiosCount.get(municipio) || 0) + 1);
    });
    
    const topMunicipios = Array.from(municipiosCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    this.municipiosChartData = {
      labels: topMunicipios.map(m => m[0]),
      datasets: [{
        data: topMunicipios.map(m => m[1]),
        backgroundColor: '#FF9800',
        borderColor: '#F57C00',
        borderWidth: 1
      }]
    };

    // Gráfico de tipos
    const tiposCount = new Map<string, number>();
    propietarios.forEach(p => {
      const tipo = p.tipo || 'Sin información';
      tiposCount.set(tipo, (tiposCount.get(tipo) || 0) + 1);
    });
    
    this.tipoChartData = {
      labels: Array.from(tiposCount.keys()),
      datasets: [{
        data: Array.from(tiposCount.values()),
        backgroundColor: [
          '#4CAF50',
          '#2196F3',
          '#FF9800',
          '#F44336'
        ]
      }]
    };
  }

  exportarExcel() {
    const ws = XLSX.utils.json_to_sheet(this.propietariosConDatosCompletos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análisis Propietarios');
    XLSX.writeFile(wb, 'analisis-propietarios.xlsx');
  }
}
