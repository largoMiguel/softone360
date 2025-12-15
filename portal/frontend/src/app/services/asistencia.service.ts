import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Funcionario,
  FuncionarioCreate,
  EquipoRegistro,
  EquipoRegistroCreate,
  RegistroAsistencia,
  EstadisticasAsistencia
} from '../models/asistencia.model';

@Injectable({
  providedIn: 'root'
})
export class AsistenciaService {
  private apiUrl = `${environment.apiUrl}/asistencia`;

  constructor(private http: HttpClient) {}

  // ===== FUNCIONARIOS =====

  getFuncionarios(entityId?: number, isActive?: boolean, search?: string): Observable<Funcionario[]> {
    let params = new HttpParams();
    if (entityId) params = params.set('entity_id', entityId.toString());
    if (isActive !== undefined) params = params.set('is_active', isActive.toString());
    if (search) params = params.set('search', search);

    return this.http.get<Funcionario[]>(`${this.apiUrl}/funcionarios`, { params });
  }

  getFuncionario(id: number): Observable<Funcionario> {
    return this.http.get<Funcionario>(`${this.apiUrl}/funcionarios/${id}`);
  }

  createFuncionario(funcionario: FuncionarioCreate): Observable<Funcionario> {
    return this.http.post<Funcionario>(`${this.apiUrl}/funcionarios`, funcionario);
  }

  updateFuncionario(id: number, funcionario: Partial<Funcionario>): Observable<Funcionario> {
    return this.http.put<Funcionario>(`${this.apiUrl}/funcionarios/${id}`, funcionario);
  }

  // ===== EQUIPOS =====

  getEquipos(entityId?: number, isActive?: boolean): Observable<EquipoRegistro[]> {
    let params = new HttpParams();
    if (entityId) params = params.set('entity_id', entityId.toString());
    if (isActive !== undefined) params = params.set('is_active', isActive.toString());

    return this.http.get<EquipoRegistro[]>(`${this.apiUrl}/equipos`, { params });
  }

  createEquipo(equipo: EquipoRegistroCreate): Observable<EquipoRegistro> {
    return this.http.post<EquipoRegistro>(`${this.apiUrl}/equipos`, equipo);
  }

  // ===== REGISTROS =====

  getRegistros(
    entityId?: number,
    funcionarioId?: number,
    fechaDesde?: string,
    fechaHasta?: string,
    tipoRegistro?: string,
    limit: number = 100,
    offset: number = 0
  ): Observable<RegistroAsistencia[]> {
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    if (entityId) params = params.set('entity_id', entityId.toString());
    if (funcionarioId) params = params.set('funcionario_id', funcionarioId.toString());
    if (fechaDesde) params = params.set('fecha_desde', fechaDesde);
    if (fechaHasta) params = params.set('fecha_hasta', fechaHasta);
    if (tipoRegistro) params = params.set('tipo_registro', tipoRegistro);

    return this.http.get<RegistroAsistencia[]>(`${this.apiUrl}/registros`, { params });
  }

  // ===== ESTADÍSTICAS =====

  getEstadisticas(entityId?: number): Observable<EstadisticasAsistencia> {
    let params = new HttpParams();
    if (entityId) params = params.set('entity_id', entityId.toString());

    return this.http.get<EstadisticasAsistencia>(`${this.apiUrl}/estadisticas`, { params });
  }
}
