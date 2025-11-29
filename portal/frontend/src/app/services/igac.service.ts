import { Injectable } from '@angular/core';
import { Predio, PredioRaw, Propietario } from '../models/igac.model';

@Injectable({
  providedIn: 'root'
})
export class IgacService {
  
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

    const headers = lines[0].split('\t').map(h => h.trim());
    console.log(`📋 Columnas encontradas (${headers.length}):`, headers);
    
    const prediosMap = new Map<string, Predio>();
    let lineasProcesadas = 0;
    let lineasIgnoradas = 0;
    let errores = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        lineasIgnoradas++;
        continue;
      }

      const values = line.split('\t');
      
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
        const key = rawPredio['Número Predial Nacion'];
        
        if (!key || key.trim() === '') {
          console.warn(`⚠️ Línea ${i}: Número Predial Nacion vacío`);
          lineasIgnoradas++;
          continue;
        }

        const propietario: Propietario = {
          nombre: rawPredio['Propietario'] || 'Sin nombre',
          numeroPropietario: parseInt(rawPredio['Número de Propietario']) || 0,
          totalPropietarios: parseInt(rawPredio['Total Propietarios']) || 0,
          tipoDocumento: rawPredio['Tipo de Documento'] || '',
          numeroDocumento: rawPredio['Número de Documento'] || '',
          direccion: rawPredio['Dirección'] || ''
        };

        if (!prediosMap.has(key)) {
          const predio: Predio = {
            numeroPredialNacion: rawPredio['Número Predial Nacion'],
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
