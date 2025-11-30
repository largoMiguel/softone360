import { Injectable } from '@angular/core';
import { Predio, PredioRaw, Propietario, ReporteRut } from '../models/igac.model';

@Injectable({
  providedIn: 'root'
})
export class IgacService {
  
  // Mapa para almacenar datos del RUT por NIT
  private rutDataMap = new Map<string, ReporteRut>();

  parseReporteRut(csvContent: string): void {
    console.log('🔍 Parseando Reporte RUT...');
    
    const normalizedContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');
    
    if (lines.length < 2) {
      console.warn('⚠️ Archivo RUT vacío');
      return;
    }

    // Detectar delimitador
    const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map(h => h.trim());
    
    console.log(`📋 Columnas RUT (${headers.length}):`, headers);

    let registrosRut = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(delimiter);
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });

      const nit = row['Nit'] || row['NIT'] || '';
      if (!nit) continue;

      const rutData: ReporteRut = {
        nit: nit,
        razonSocial: row['Nombre/Razon Social'] || row['Razon Social'] || '',
        tipo: row['Tipo'] || '',
        seccional: row['Seccional'] || '',
        estado: row['Estado'] || '',
        pais: row['Pais'] || row['País'] || '',
        departamento: row['Departamento'] || '',
        municipio: row['Municipio'] || '',
        direccion: row['Direccion'] || row['Dirección'] || '',
        telefono1: row['Telefono'] || row['Teléfono'] || '',
        telefono2: values[headers.indexOf('Telefono') + 1] || '', // Segunda columna Telefono
        correo: row['Correo'] || row['Email'] || ''
      };

      this.rutDataMap.set(nit, rutData);
      registrosRut++;
    }

    console.log(`✅ Registros RUT cargados: ${registrosRut}`);
  }

  clearRutData(): void {
    this.rutDataMap.clear();
  }

  getTotalRutRecords(): number {
    return this.rutDataMap.size;
  }
  
  parseCsvToJson(csvContent: string): Predio[] {
    console.log('🔍 Iniciando parseo CSV...');
    
    // Normalizar saltos de línea
    const normalizedContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');
    
    console.log(`📊 Total líneas en archivo: ${lines.length}`);
    
    if (lines.length < 2) {
      console.warn('⚠️ Archivo vacío o sin datos');
      return [];
    }

    // Buscar la línea de headers (la que contiene "Número Predial Nacion")
    let headerLineIndex = -1;
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      if (lines[i].includes('Número Predial Nacion') || lines[i].includes('Numero Predial')) {
        headerLineIndex = i;
        console.log(`📍 Headers encontrados en línea ${i + 1}`);
        break;
      }
    }

    if (headerLineIndex === -1) {
      console.error('❌ No se encontró la línea de headers con "Número Predial Nacion"');
      console.log('🔍 Primeras 5 líneas del archivo:');
      lines.slice(0, 5).forEach((line, idx) => {
        console.log(`  Línea ${idx + 1}: ${line.substring(0, 100)}`);
      });
      return [];
    }

    // Debug: mostrar primera línea completa
    console.log('🔍 LÍNEA DE HEADERS:', lines[headerLineIndex]);
    console.log('🔍 PRIMERA LÍNEA DE DATOS:', lines[headerLineIndex + 1]?.substring(0, 200) + '...');

    // Detectar delimitador (punto y coma o tab)
    const delimiter = lines[headerLineIndex].includes(';') ? ';' : '\t';
    console.log(`🔍 Delimitador detectado: "${delimiter === ';' ? 'punto y coma (;)' : 'tab (\\t)'}"`);

    const headers = lines[headerLineIndex].split(delimiter).map(h => h.trim());
    console.log(`📋 Columnas encontradas (${headers.length}):`, headers);
    
    // Debug: mostrar primer dato parseado
    if (lines[headerLineIndex + 1]) {
      const firstValues = lines[headerLineIndex + 1].split(delimiter);
      console.log(`🔍 Primera fila parseada (${firstValues.length} valores):`, firstValues.slice(0, 5));
    }
    
    const prediosMap = new Map<string, Predio>();
    let lineasProcesadas = 0;
    let lineasIgnoradas = 0;
    let errores = 0;

    // Empezar desde la línea después de los headers
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        lineasIgnoradas++;
        continue;
      }

      const values = line.split(delimiter);
      
      // Permitir variación en número de columnas
      if (values.length < headers.length - 2) {
        console.warn(`⚠️ Línea ${i} tiene ${values.length} columnas, esperadas ${headers.length}`);
        lineasIgnoradas++;
        continue;
      }

      try {
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || '';
        });

        const rawPredio = row as PredioRaw;
        let key = rawPredio['Número Predial Nacion'];
        
        // Si el campo está vacío, usar el Numero Predal o generar uno temporal
        if (!key || key.trim() === '') {
          key = rawPredio['Numero Predal'] || `TEMP_${i}`;
          console.warn(`⚠️ Línea ${i}: Número Predial Nacion vacío, usando: ${key}`);
        }

        const propietario: Propietario = {
          nombre: rawPredio['Propietario'] || 'Sin nombre',
          numeroPropietario: parseInt(rawPredio['Número de Propietario']) || 0,
          totalPropietarios: parseInt(rawPredio['Total Propietarios']) || 0,
          tipoDocumento: rawPredio['Tipo de Documento'] || '',
          numeroDocumento: rawPredio['Número de Documento'] || '',
          direccion: rawPredio['Dirección'] || ''
        };

        // Enriquecer con datos del RUT si existen
        const rutData = this.rutDataMap.get(propietario.numeroDocumento);
        if (rutData) {
          propietario.razonSocial = rutData.razonSocial;
          propietario.tipo = rutData.tipo;
          propietario.seccional = rutData.seccional;
          propietario.estado = rutData.estado;
          propietario.pais = rutData.pais;
          propietario.departamento = rutData.departamento;
          propietario.municipio = rutData.municipio;
          propietario.direccionRut = rutData.direccion;
          propietario.telefono1 = rutData.telefono1;
          propietario.telefono2 = rutData.telefono2;
          propietario.correo = rutData.correo;
        }

        if (!prediosMap.has(key)) {
          const predio: Predio = {
            numeroPredialNacion: key, // Usar la key (puede ser temporal)
            numeroPredial: rawPredio['Numero Predal'] || '',
            codigoPredialAnterior: rawPredio['Código Predial Anterior'] || '',
            clasePredio: rawPredio['Clase Predio'] || '',
            vereda: rawPredio['Vereda'] || '',
            predio: rawPredio['Predio'] || '',
            mejora: rawPredio['Mejora'] || '',
            destinacionEconomica: rawPredio['Destinación Económica'] || '',
            areaHectareas: parseFloat(rawPredio['Área en Hectareas']) || 0,
            areaMetros: parseFloat(rawPredio['Área en Metros']) || 0,
            areaConstruida: parseFloat(rawPredio['Área Construida']) || 0,
            vigencia: parseFloat(rawPredio['Vigencia']) || 0,
            avaluo: this.parseAvaluo(rawPredio['Avaluo']),
            propietarios: []
          };
          prediosMap.set(key, predio);
        }

        prediosMap.get(key)!.propietarios.push(propietario);
        lineasProcesadas++;
        
      } catch (error) {
        console.error(`❌ Error en línea ${i}:`, error);
        errores++;
      }
    }

    const prediosArray = Array.from(prediosMap.values());
    
    console.log(`✅ Parseo completado:`);
    console.log(`  • Predios únicos: ${prediosArray.length}`);
    console.log(`  • Líneas procesadas: ${lineasProcesadas}`);
    console.log(`  • Líneas ignoradas: ${lineasIgnoradas}`);
    console.log(`  • Errores: ${errores}`);
    
    // Mostrar ejemplo del primer predio
    if (prediosArray.length > 0) {
      console.log(`📌 Primer predio:`, {
        numero: prediosArray[0].numeroPredialNacion,
        propietarios: prediosArray[0].propietarios.length
      });
    }

    return prediosArray;
  }

  private parseAvaluo(avaluoStr: string): number {
    if (!avaluoStr) return 0;
    // Remover puntos de miles y reemplazar coma por punto decimal
    const cleaned = avaluoStr.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  filterPredios(predios: Predio[], searchTerm: string): Predio[] {
    if (!searchTerm || searchTerm.trim() === '') {
      return predios;
    }

    const term = searchTerm.toLowerCase().trim();

    return predios.filter(predio => {
      // Buscar en campos del predio
      const predioMatch = 
        predio.numeroPredialNacion.toLowerCase().includes(term) ||
        predio.numeroPredial.toLowerCase().includes(term) ||
        predio.codigoPredialAnterior.toLowerCase().includes(term) ||
        predio.clasePredio.toLowerCase().includes(term) ||
        predio.vereda.toLowerCase().includes(term) ||
        predio.predio.toLowerCase().includes(term) ||
        predio.destinacionEconomica.toLowerCase().includes(term) ||
        predio.vigencia.toString().includes(term) ||
        predio.avaluo.toString().includes(term);

      // Buscar en propietarios
      const propietarioMatch = predio.propietarios.some(prop =>
        prop.nombre.toLowerCase().includes(term) ||
        prop.tipoDocumento.toLowerCase().includes(term) ||
        prop.numeroDocumento.toLowerCase().includes(term) ||
        prop.direccion.toLowerCase().includes(term)
      );

      return predioMatch || propietarioMatch;
    });
  }
}
