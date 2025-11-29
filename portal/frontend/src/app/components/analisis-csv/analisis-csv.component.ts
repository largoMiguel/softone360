import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartConfiguration, ChartData, ChartType, registerables } from 'chart.js';
import * as XLSX from 'xlsx';

// Registrar todos los componentes de Chart.js
Chart.register(...registerables);

interface Propietario {
  // Datos del archivo principal
  numeroPredio?: string;
  codigoPredio?: string;
  clasePredioVereda?: string;
  predioNombre?: string;
  propietarioNombre: string;
  numeroDocumento: string;
  tipoDocumento?: string;
  direccionPredio?: string;
  areaHectareas?: string;
  avaluo?: string;
  
  // Datos de RUT (enriquecidos)
  nombreCompleto?: string;
  tipoPersona?: string;
  estado?: string;
  departamento?: string;
  municipio?: string;
  direccionRUT?: string;
  telefono?: string;
  correo?: string;
}

interface Predio {
  numeroIdentificacion: string;
  propietarios: Propietario[];
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
        // Forzar lectura de números como texto
        const workbook = XLSX.read(data, { 
          type: 'binary',
          raw: false,
          cellText: false,
          cellDates: false
        });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Convertir manteniendo formato original
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
          header: 1,
          raw: false,
          defval: ''
        }) as any[][];

        console.log('📄 Archivo principal cargado, filas:', jsonData.length);
        console.log('📋 Primeras 5 filas:', jsonData.slice(0, 5));

        // Detectar fila de encabezados
        let headerRow = 0;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const firstCell = jsonData[i][0]?.toString().toLowerCase() || '';
          if (firstCell.includes('predio') || firstCell.includes('n°')) {
            headerRow = i;
            console.log('📋 Encabezados encontrados en fila:', i);
            console.log('📋 Encabezados:', jsonData[i]);
            break;
          }
        }

        const headers = jsonData[headerRow];
        console.log('📋 Headers detectados:', headers);

        // Crear mapa de índices de columnas basado en los nombres
        const getColIndex = (possibleNames: string[]): number => {
          for (let i = 0; i < headers.length; i++) {
            const header = headers[i]?.toString().toLowerCase().trim() || '';
            for (const name of possibleNames) {
              if (header.includes(name.toLowerCase())) {
                return i;
              }
            }
          }
          return -1;
        };

        const colIndexes = {
          numeroPredio: getColIndex(['n° predio', 'nº predio', 'numero predio']),
          codigo: getColIndex(['código', 'codigo']),
          vereda: getColIndex(['vereda', 'clase']),
          nombrePredio: getColIndex(['nombre predio']),
          propietario: getColIndex(['propietario', 'nombre']),
          numeroDocumento: getColIndex(['n° documento', 'nº documento', 'documento']),
          tipoDoc: getColIndex(['tipo doc', 'tipo documento']),
          direccion: getColIndex(['dirección', 'direccion']),
          area: getColIndex(['área', 'area', 'hectárea', 'hectarea']),
          avaluo: getColIndex(['avalúo', 'avaluo', 'valor'])
        };

        console.log('📊 Índices de columnas:', colIndexes);

        // Agrupar por predio
        const prediosMap = new Map<string, Propietario[]>();
        
        for (let i = headerRow + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          
          // Validar que tenga datos
          const hayDatos = row.some((cell: any) => cell !== undefined && cell !== null && cell.toString().trim() !== '');
          if (!hayDatos) continue;
          
          let numeroPredio = colIndexes.numeroPredio >= 0 ? row[colIndexes.numeroPredio]?.toString().trim() || '' : '';
          let numeroDocumento = colIndexes.numeroDocumento >= 0 ? row[colIndexes.numeroDocumento]?.toString().trim() || '' : '';
          
          // Convertir notación científica si existe
          if (numeroPredio && (numeroPredio.includes('e+') || numeroPredio.includes('E+'))) {
            numeroPredio = Math.round(parseFloat(numeroPredio)).toString();
          }
          if (numeroDocumento && (numeroDocumento.includes('e+') || numeroDocumento.includes('E+'))) {
            numeroDocumento = Math.round(parseFloat(numeroDocumento)).toString();
          }
          
          if (!numeroPredio) continue;
          
          const propietario: Propietario = {
            numeroPredio,
            codigoPredio: colIndexes.codigo >= 0 ? row[colIndexes.codigo]?.toString().trim() || '' : '',
            clasePredioVereda: colIndexes.vereda >= 0 ? row[colIndexes.vereda]?.toString().trim() || '' : '',
            predioNombre: colIndexes.nombrePredio >= 0 ? row[colIndexes.nombrePredio]?.toString().trim() || '' : '',
            propietarioNombre: colIndexes.propietario >= 0 ? row[colIndexes.propietario]?.toString().trim() || '' : '',
            numeroDocumento,
            tipoDocumento: colIndexes.tipoDoc >= 0 ? row[colIndexes.tipoDoc]?.toString().trim() || '' : '',
            direccionPredio: colIndexes.direccion >= 0 ? row[colIndexes.direccion]?.toString().trim() || '' : '',
            areaHectareas: colIndexes.area >= 0 ? row[colIndexes.area]?.toString().trim() || '' : '',
            avaluo: colIndexes.avaluo >= 0 ? row[colIndexes.avaluo]?.toString().trim() || '' : ''
          };
          
          // Agrupar por número de predio
          if (!prediosMap.has(numeroPredio)) {
            prediosMap.set(numeroPredio, []);
          }
          prediosMap.get(numeroPredio)!.push(propietario);
        }
        
        // Convertir a array de predios
        this.predios = Array.from(prediosMap.entries()).map(([numero, propietarios]) => ({
          numeroIdentificacion: numero,
          propietarios
        }));
        
        console.log('✅ Predios procesados:', this.predios.length);
        console.log('📊 Total propietarios:', prediosMap.size);
        console.log('🔍 Ejemplo predio:', this.predios[0]);
        
        this.totalPredios = this.predios.length;
        this.totalPropietarios = Array.from(prediosMap.values()).reduce((sum, props) => sum + props.length, 0);
        
        // Si solo cargamos el archivo principal, ya podemos mostrar datos
        this.propietariosConDatosCompletos = Array.from(prediosMap.values()).flat();
        this.calcularEstadisticas();
        this.generarGraficos();
        
        this.loading = false;
      } catch (error) {
        console.error('❌ Error procesando archivo principal:', error);
        this.error = 'Error al procesar el archivo principal: ' + error;
        this.loading = false;
      }
    };
    reader.readAsBinaryString(file);
  }

  procesarArchivosRut(files: FileList) {
    // Crear mapa de datos RUT por número de documento
    const rutMap = new Map<string, any>();
    let filesProcessed = 0;
    console.log('📁 Procesando', files.length, 'archivos RUT para enriquecer datos...');

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { 
            type: 'binary',
            raw: false,
            cellText: false,
            cellDates: false
          });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
            header: 1,
            raw: false,
            defval: ''
          }) as any[][];

          console.log(`📄 Archivo RUT ${index + 1}/${files.length}: ${file.name}`);
          console.log('  Filas totales:', jsonData.length);

          let rutEncontrados = 0;
          // Estructura RUT: Nit;Nombre;Tipo;Seccional;Estado;Pais;Departamento;Municipio;Direccion;Telefono;Telefono;Correo
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            if (!row || row.length === 0) continue;
            const hayDatos = row.some((cell: any) => cell !== undefined && cell !== null && cell.toString().trim() !== '');
            if (!hayDatos) continue;
            
            let nit = row[0]?.toString().trim();
            const nombre = row[1]?.toString().trim();
            
            // Convertir notación científica
            if (nit && (nit.includes('e+') || nit.includes('E+'))) {
              nit = Math.round(parseFloat(nit)).toString();
            }
            
            if (nit && nombre && nit !== '' && nombre !== '') {
              rutMap.set(nit, {
                nombreCompleto: nombre,
                tipoPersona: row[2]?.toString().trim() || '',
                estado: row[4]?.toString().trim() || '',
                departamento: row[6]?.toString().trim() || '',
                municipio: row[7]?.toString().trim() || '',
                direccionRUT: row[8]?.toString().trim() || '',
                telefono: row[9]?.toString().trim() || row[10]?.toString().trim() || '',
                correo: row[11]?.toString().trim() || ''
              });
              rutEncontrados++;
            }
          }

          console.log(`  ✅ Registros RUT encontrados: ${rutEncontrados}`);

          filesProcessed++;
          if (filesProcessed === files.length) {
            console.log('🎯 Total de registros RUT únicos:', rutMap.size);
            this.enriquecerConDatosRUT(rutMap);
          }
        } catch (error) {
          console.error(`❌ Error procesando archivo ${file.name}:`, error);
          filesProcessed++;
          if (filesProcessed === files.length) {
            this.enriquecerConDatosRUT(rutMap);
          }
        }
      };
      reader.readAsBinaryString(file);
    });
  }

  enriquecerConDatosRUT(rutMap: Map<string, any>) {
    console.log('🔄 Enriqueciendo propietarios con datos RUT...');
    
    let enriquecidos = 0;
    let noEncontrados = 0;
    
    // Enriquecer cada propietario con datos del RUT
    this.predios.forEach(predio => {
      predio.propietarios.forEach(propietario => {
        const datosRUT = rutMap.get(propietario.numeroDocumento);
        if (datosRUT) {
          // Agregar datos del RUT
          propietario.nombreCompleto = datosRUT.nombreCompleto;
          propietario.tipoPersona = datosRUT.tipoPersona;
          propietario.estado = datosRUT.estado;
          propietario.departamento = datosRUT.departamento;
          propietario.municipio = datosRUT.municipio;
          propietario.direccionRUT = datosRUT.direccionRUT;
          propietario.telefono = datosRUT.telefono;
          propietario.correo = datosRUT.correo;
          enriquecidos++;
        } else {
          noEncontrados++;
          console.log('⚠️ No se encontró RUT para documento:', propietario.numeroDocumento);
        }
      });
    });
    
    console.log('✅ Propietarios enriquecidos con RUT:', enriquecidos);
    console.log('⚠️ Propietarios sin datos RUT:', noEncontrados);
    
    // Actualizar lista plana para la tabla
    this.propietariosConDatosCompletos = this.predios.flatMap(p => p.propietarios);
    
    // Recalcular estadísticas y gráficos
    this.calcularEstadisticas();
    this.generarGraficos();
    this.loading = false;
    
    console.log('🎉 Enriquecimiento completado!');
  }



  calcularEstadisticas() {
    const todosPropietarios = this.predios.flatMap(p => p.propietarios);
    this.totalPropietarios = todosPropietarios.length;
    this.propietariosConDatos = todosPropietarios.filter(p => p.nombreCompleto || p.estado).length;
    this.propietariosSinDatos = this.totalPropietarios - this.propietariosConDatos;
  }

  generarGraficos() {
    const propietarios = this.predios.flatMap(p => p.propietarios);
    
    // Gráfico de estados (solo si hay datos RUT)
    const estadosCount = new Map<string, number>();
    propietarios.forEach(p => {
      if (p.estado) {
        const estado = p.estado || 'Sin información';
        estadosCount.set(estado, (estadosCount.get(estado) || 0) + 1);
      }
    });
    
    if (estadosCount.size > 0) {
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
    }

    // Gráfico de departamentos (datos del archivo principal o RUT)
    const deptosCount = new Map<string, number>();
    propietarios.forEach(p => {
      const depto = p.departamento || 'Sin información';
      if (p.departamento) {
        deptosCount.set(depto, (deptosCount.get(depto) || 0) + 1);
      }
    });
    
    if (deptosCount.size > 0) {
      this.departamentosChartData = {
        labels: Array.from(deptosCount.keys()),
        datasets: [{
          data: Array.from(deptosCount.values()),
          backgroundColor: '#2196F3',
          borderColor: '#1976D2',
          borderWidth: 1
        }]
      };
    }

    // Gráfico de municipios (top 10)
    const municipiosCount = new Map<string, number>();
    propietarios.forEach(p => {
      if (p.municipio) {
        const municipio = p.municipio || 'Sin información';
        municipiosCount.set(municipio, (municipiosCount.get(municipio) || 0) + 1);
      }
    });
    
    const topMunicipios = Array.from(municipiosCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    if (topMunicipios.length > 0) {
      this.municipiosChartData = {
        labels: topMunicipios.map(m => m[0]),
        datasets: [{
          data: topMunicipios.map(m => m[1]),
          backgroundColor: '#FF9800',
          borderColor: '#F57C00',
          borderWidth: 1
        }]
      };
    }

    // Gráfico de tipos (si hay datos RUT)
    const tiposCount = new Map<string, number>();
    propietarios.forEach(p => {
      if (p.tipoPersona || p.tipoDocumento) {
        const tipo = p.tipoPersona || p.tipoDocumento || 'Sin información';
        tiposCount.set(tipo, (tiposCount.get(tipo) || 0) + 1);
      }
    });
    
    if (tiposCount.size > 0) {
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
  }

  exportarExcel() {
    const ws = XLSX.utils.json_to_sheet(this.propietariosConDatosCompletos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análisis Propietarios');
    XLSX.writeFile(wb, 'analisis-propietarios.xlsx');
  }
}
