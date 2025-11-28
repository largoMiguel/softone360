from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from typing import List, Dict, Any
from app.models.user import User
from app.utils.auth import get_current_user
import csv
import io
from collections import defaultdict

router = APIRouter(prefix="/predios-analysis", tags=["Predios Analysis"])


@router.post("/procesar")
async def procesar_archivos_csv(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Procesa múltiples archivos CSV de propietarios y retorna análisis estadístico.
    Este endpoint es temporal y será eliminado posteriormente.
    """
    try:
        propietarios = []
        errores = []

        # Procesar cada archivo
        for file in files:
            if not file.filename.endswith('.csv'):
                errores.append(f"Archivo {file.filename} no es CSV")
                continue

            contenido = await file.read()
            contenido_texto = contenido.decode('utf-8')
            
            # Parsear CSV
            csv_reader = csv.DictReader(
                io.StringIO(contenido_texto),
                delimiter=';'
            )

            for row in csv_reader:
                try:
                    # Verificar que tenga datos válidos
                    if not row.get('Nit') or not row.get('Nombre/Razon Social'):
                        continue

                    propietario = {
                        'nit': row.get('Nit', '').strip(),
                        'nombre_razon_social': row.get('Nombre/Razon Social', '').strip(),
                        'tipo': row.get('Tipo', '').strip(),
                        'seccional': row.get('Seccional', '').strip(),
                        'estado': row.get('Estado', '').strip(),
                        'pais': row.get('Pais', '').strip(),
                        'departamento': row.get('Departamento', '').strip(),
                        'municipio': row.get('Municipio', '').strip(),
                        'direccion': row.get('Direccion', '').strip(),
                        'telefono1': row.get('Telefono', '').strip() if 'Telefono' in row else '',
                        'telefono2': '',
                        'correo': row.get('Correo', '').strip()
                    }
                    propietarios.append(propietario)
                except Exception as e:
                    errores.append(f"Error procesando fila en {file.filename}: {str(e)}")

        # Realizar análisis
        analisis = analizar_propietarios(propietarios)
        analisis['errores'] = errores

        return analisis

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error procesando archivos CSV: {str(e)}"
        )


def analizar_propietarios(propietarios: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analiza lista de propietarios y genera estadísticas
    """
    analisis = {
        'totalPropietarios': len(propietarios),
        'propietariosPorEstado': defaultdict(int),
        'propietariosPorDepartamento': defaultdict(int),
        'propietariosPorMunicipio': defaultdict(int),
        'propietariosPorTipo': defaultdict(int),
        'propietariosSinContacto': 0,
        'propietariosConCorreo': 0,
        'distribuciones': {
            'estadosActivos': 0,
            'estadosSuspendidos': 0,
            'estadosCancelados': 0,
            'personasNaturales': 0,
            'personasJuridicas': 0
        }
    }

    for prop in propietarios:
        # Estado
        estado = prop.get('estado', '')
        analisis['propietariosPorEstado'][estado] += 1

        if 'ACTIVO' in estado.upper():
            analisis['distribuciones']['estadosActivos'] += 1
        elif 'SUSPENSION' in estado.upper():
            analisis['distribuciones']['estadosSuspendidos'] += 1
        elif 'CANCELADO' in estado.upper():
            analisis['distribuciones']['estadosCancelados'] += 1

        # Departamento
        departamento = prop.get('departamento', '')
        if departamento:
            analisis['propietariosPorDepartamento'][departamento] += 1

        # Municipio
        municipio = prop.get('municipio', '')
        if municipio:
            analisis['propietariosPorMunicipio'][municipio] += 1

        # Tipo
        tipo = prop.get('tipo', '')
        analisis['propietariosPorTipo'][tipo] += 1

        if 'NATURAL' in tipo.upper():
            analisis['distribuciones']['personasNaturales'] += 1
        elif 'JURIDICA' in tipo.upper():
            analisis['distribuciones']['personasJuridicas'] += 1

        # Contacto
        if not prop.get('telefono1') and not prop.get('telefono2') and not prop.get('correo'):
            analisis['propietariosSinContacto'] += 1

        if prop.get('correo'):
            analisis['propietariosConCorreo'] += 1

    # Top 10 municipios
    analisis['topMunicipios'] = [
        {'municipio': k, 'cantidad': v}
        for k, v in sorted(
            analisis['propietariosPorMunicipio'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
    ]

    # Top 10 departamentos
    analisis['topDepartamentos'] = [
        {'departamento': k, 'cantidad': v}
        for k, v in sorted(
            analisis['propietariosPorDepartamento'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
    ]

    # Convertir defaultdict a dict normal para JSON
    analisis['propietariosPorEstado'] = dict(analisis['propietariosPorEstado'])
    analisis['propietariosPorDepartamento'] = dict(analisis['propietariosPorDepartamento'])
    analisis['propietariosPorMunicipio'] = dict(analisis['propietariosPorMunicipio'])
    analisis['propietariosPorTipo'] = dict(analisis['propietariosPorTipo'])

    return analisis
