"""
Servicio de generación asíncrona de informes PDM.
Maneja generación en background, almacenamiento en S3 y notificaciones.
"""
import threading
import traceback
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import boto3
from botocore.exceptions import ClientError
from sqlalchemy.orm import Session
from app.config.database import SessionLocal, get_db
from app.models.informe import InformeEstado
from app.models.alert import Alert
from app.services.pdm_report_generator import PDMReportGenerator
import os
import tempfile
import sys


class InformeGeneratorService:
    """
    Servicio para generar informes PDM de forma asíncrona.
    
    Flujo:
    1. Usuario solicita informe → Se crea registro en DB (estado=pending)
    2. Background thread inicia generación → estado=processing
    3. Genera PDF/DOCX/Excel con lógica existente
    4. Sube archivo a S3
    5. Actualiza estado=completed y crea notificación
    6. Usuario recibe notificación y descarga desde S3
    """
    
    def __init__(self):
        # Configurar S3 client
        self.s3_client = boto3.client(
            's3',
            region_name='us-east-1',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        self.bucket_name = 'softone-pdm-informes'
        self.bucket_region = 'us-east-1'
    
    def iniciar_generacion(
        self,
        db: Session,
        entity_id: int,
        user_id: int,
        slug: str,
        anio: int,
        formato: str = 'pdf',
        filtros: Optional[Dict[str, Any]] = None
    ) -> InformeEstado:
        """
        Inicia la generación asíncrona de un informe.
        Retorna el objeto InformeEstado inmediatamente.
        """
        # Crear registro en DB
        informe = InformeEstado(
            entity_id=entity_id,
            user_id=user_id,
            anio=anio,
            formato=formato,
            filtros=filtros,
            estado='pending',
            progreso=0
        )
        db.add(informe)
        db.commit()
        db.refresh(informe)
        
        print(f"🚀 Iniciando generación async del informe {informe.id}...", flush=True)
        
        # Iniciar generación en background (NO daemon para debugging)
        thread = threading.Thread(
            target=self._generar_informe_background,
            args=(informe.id, slug),
            daemon=False,  # Cambiar a False temporalmente para debug
            name=f"informe-{informe.id}"
        )
        thread.start()
        
        print(f"✅ Thread '{thread.name}' lanzado para informe {informe.id}, is_alive={thread.is_alive()}", flush=True)
        
        return informe
    
    def _generar_informe_background(self, informe_id: int, slug: str):
        """
        Función que se ejecuta en background thread para generar el informe.
        """
        try:
            print(f"🔵 Thread iniciado para informe {informe_id}", flush=True)
            print(f"🔍 Intentando crear SessionLocal()...", flush=True)
            
            db = SessionLocal()
            
            print(f"✅ SessionLocal() creado exitosamente", flush=True)
            print(f"🔍 Buscando informe {informe_id} en DB...", flush=True)
            
        except Exception as e:
            print(f"❌ ERROR FATAL al inicio del thread para informe {informe_id}: {type(e).__name__}: {e}", flush=True)
            print(f"❌ Traceback completo:", flush=True)
            traceback.print_exc(file=sys.stdout)
            sys.stdout.flush()
            return
        
        try:
            # Obtener informe
            informe = db.query(InformeEstado).filter(InformeEstado.id == informe_id).first()
            if not informe:
                print(f"❌ Informe {informe_id} no encontrado", flush=True)
                return
            
            print(f"✅ Informe {informe_id} encontrado, actualizando a 'processing'...", flush=True)
            # Actualizar estado a processing
            informe.estado = 'processing'
            informe.started_at = datetime.utcnow()
            informe.progreso = 10
            db.commit()
            
            print(f"📊 Generando informe {informe_id} para año {informe.anio}, formato {informe.formato}", flush=True)
            
            # Generar informe usando lógica existente
            try:
                # Importar modelos necesarios
                from app.models.entity import Entity
                from app.models.pdm import PdmProducto, PdmActividad, PdmActividadEvidencia
                from app.models.secretaria import Secretaria
                from sqlalchemy import or_
                from sqlalchemy.orm import defer, selectinload, noload
                
                # Obtener entidad
                entity = db.query(Entity).filter(Entity.slug == slug).first()
                if not entity:
                    raise Exception(f"Entidad '{slug}' no encontrada")
                
                # Procesar filtros
                secretaria_ids = informe.filtros.get('secretaria_ids') if informe.filtros else None
                fecha_inicio = informe.filtros.get('fecha_inicio') if informe.filtros else None
                fecha_fin = informe.filtros.get('fecha_fin') if informe.filtros else None
                estados = informe.filtros.get('estados') if informe.filtros else None  
                usar_ia = informe.filtros.get('usar_ia', False) if informe.filtros else False
                
                # Obtener productos con filtros
                productos_query = db.query(PdmProducto).options(
                    defer(PdmProducto.presupuesto_2024),
                    defer(PdmProducto.presupuesto_2025),
                    defer(PdmProducto.presupuesto_2026),
                    defer(PdmProducto.presupuesto_2027),
                    selectinload(PdmProducto.responsable_secretaria)
                ).filter(
                    PdmProducto.entity_id == entity.id
                )
                
                # Filtrar por secretarías
                if secretaria_ids:
                    productos_query = productos_query.filter(
                        PdmProducto.responsable_secretaria_id.in_(secretaria_ids)
                    )
                
                # Filtrar por año
                if informe.anio > 0:
                    campo_meta = f"programacion_{informe.anio}"
                    productos_query = productos_query.filter(
                        getattr(PdmProducto, campo_meta, 0) > 0
                    )
                else:
                    productos_query = productos_query.filter(
                        or_(
                            PdmProducto.programacion_2024 > 0,
                            PdmProducto.programacion_2025 > 0,
                            PdmProducto.programacion_2026 > 0,
                            PdmProducto.programacion_2027 > 0  
                        )
                    )
                
                productos = productos_query.all()
                
                if not productos:
                    raise Exception(f"No hay productos para los filtros especificados")
                
                print(f"   Productos encontrados: {len(productos)}")
                
                # Obtener actividades con filtros
                actividades_query = db.query(PdmActividad).options(
                    selectinload(PdmActividad.responsable_secretaria),
                    noload(PdmActividad.evidencia)
                ).filter(
                    PdmActividad.entity_id == entity.id
                )
                
                # Filtrar por año
                if informe.anio > 0:
                    actividades_query = actividades_query.filter(PdmActividad.anio == informe.anio)
                
                # Filtrar por secretarías
                if secretaria_ids:
                    actividades_query = actividades_query.filter(
                        PdmActividad.responsable_secretaria_id.in_(secretaria_ids)
                    )
                
                # Filtrar por fechas
                if fecha_inicio:
                    try:
                        from datetime import datetime
                        fecha_inicio_dt = datetime.strptime(fecha_inicio, "%Y-%m-%d")
                        actividades_query = actividades_query.filter(
                            PdmActividad.fecha_inicio >= fecha_inicio_dt
                        )
                    except ValueError:
                        pass
                
                if fecha_fin:
                    try:
                        fecha_fin_dt = datetime.strptime(fecha_fin, "%Y-%m-%d")
                        actividades_query = actividades_query.filter(
                            PdmActividad.fecha_fin <= fecha_fin_dt
                        )
                    except ValueError:
                        pass
                
                # Filtrar por estados
                if estados:
                    actividades_query = actividades_query.filter(
                        PdmActividad.estado.in_(estados)
                    )
                
                actividades = actividades_query.all()
                print(f"   Actividades encontradas: {len(actividades)}")
                
                # Marcar actividades con evidencia
                actividades_ids = [act.id for act in actividades]
                evidencias_existentes = db.query(PdmActividadEvidencia.actividad_id).filter(
                    PdmActividadEvidencia.actividad_id.in_(actividades_ids)
                ).all()
                evidencias_ids_set = {ev[0] for ev in evidencias_existentes}
                
                for act in actividades:
                    act.tiene_evidencia = act.id in evidencias_ids_set
                
                # Obtener nombres de secretarías
                secretarias_nombres = []
                if secretaria_ids:
                    secretarias = db.query(Secretaria).filter(
                        Secretaria.id.in_(secretaria_ids)
                    ).all()
                    secretarias_nombres = [s.nombre for s in secretarias]
                
                # Generar informe
                generator = PDMReportGenerator(
                    entity=entity,
                    productos=productos,
                    actividades=actividades,
                    anio=informe.anio,
                    db=db,
                    filtros={
                        'secretarias': secretarias_nombres,
                        'fecha_inicio': fecha_inicio,
                        'fecha_fin': fecha_fin,
                        'estados': estados
                    },
                    usar_ia=usar_ia
                )
                
                # Generar según formato
                if informe.formato == "pdf":
                    file_content = generator.generate()
                elif informe.formato == "docx":
                    file_content = generator.generate_docx()
                elif informe.formato in ["excel", "xlsx"]:
                    file_content = generator.generate_excel()
                else:
                    raise Exception(f"Formato '{informe.formato}' no soportado")
                
                informe.progreso = 70
                db.commit()
                
            except Exception as e:
                print(f"❌ Error generando informe: {e}")
                traceback.print_exc()
                informe.estado = 'failed'
                informe.error_message = str(e)
                informe.completed_at = datetime.utcnow()
                db.commit()
                
                # Crear notificación de error
                self._crear_notificacion_error(db, informe)
                return
            
            # Subir a S3
            try:
                extension = self._get_extension(informe.formato)
                filename = f"informe-pdm-{slug}-{informe.anio}-{datetime.now().strftime('%Y%m%d-%H%M%S')}.{extension}"
                s3_key = f"informes/{slug}/{filename}"
                
                content_type = self._get_content_type(informe.formato)
                
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=s3_key,
                    Body=file_content,
                    ContentType=content_type,
                    ContentDisposition=f'attachment; filename="{filename}"'
                )
                
                # Generar URL pública (bucket debe tener public read)
                s3_url = f"https://{self.bucket_name}.s3.{self.bucket_region}.amazonaws.com/{s3_key}"
                
                informe.s3_url = s3_url
                informe.s3_key = s3_key
                informe.filename = filename
                informe.file_size = len(file_content)
                informe.progreso = 100
                informe.estado = 'completed'
                informe.completed_at = datetime.utcnow()
                informe.expires_at = datetime.utcnow() + timedelta(days=7)  # Expira en 7 días
                
                db.commit()
                
                print(f"✅ Informe {informe_id} generado y subido a S3: {s3_url}")
                
            except Exception as e:
                print(f"❌ Error subiendo a S3: {e}")
                traceback.print_exc()
                informe.estado = 'failed'
                informe.error_message = f"Error subiendo a S3: {str(e)}"
                informe.completed_at = datetime.utcnow()
                db.commit()
                
                # Crear notificación de error
                self._crear_notificacion_error(db, informe)
                return
            
            # Crear notificación de éxito
            self._crear_notificacion_exito(db, informe)
            
        except Exception as e:
            print(f"❌ Error inesperado generando informe {informe_id}: {type(e).__name__}: {e}", flush=True)
            print(f"❌ Traceback completo:", flush=True)
            traceback.print_exc(file=sys.stdout)
            sys.stdout.flush()
            
            try:
                informe.estado = 'failed'
                informe.error_message = str(e)[:500]  # Truncar mensaje si es muy largo
                informe.completed_at = datetime.utcnow()
                db.commit()
                print(f"✅ Estado actualizado a 'failed' para informe {informe_id}", flush=True)
            except Exception as e2:
                print(f"❌ Error al actualizar estado a failed: {e2}", flush=True)
                pass
        
        finally:
            try:
                db.close()
                print(f"✅ Sesión DB cerrada para informe {informe_id}", flush=True)
            except Exception as e:
                print(f"❌ Error cerrando sesión: {e}", flush=True)
    
    def _crear_notificacion_exito(self, db: Session, informe: InformeEstado):
        """Crea notificación cuando el informe está listo."""
        formato_nombre = informe.formato.upper()
        
        alert = Alert(
            entity_id=informe.entity_id,
            recipient_user_id=informe.user_id,
            type='INFORME_PDM_READY',
            title=f'Informe PDM {formato_nombre} listo',
            message=f'Tu informe del año {informe.anio} en formato {formato_nombre} está listo para descargar.',
            data=f'{{"informe_id": {informe.id}, "filename": "{informe.filename}", "formato": "{informe.formato}"}}'
        )
        db.add(alert)
        db.commit()
        
        print(f"✅ Notificación creada para usuario {informe.user_id}")
    
    def _crear_notificacion_error(self, db: Session, informe: InformeEstado):
        """Crea notificación cuando falla la generación."""
        alert = Alert(
            entity_id=informe.entity_id,
            recipient_user_id=informe.user_id,
            type='INFORME_PDM_ERROR',
            title='Error generando informe PDM',
            message=f'Hubo un error al generar tu informe del año {informe.anio}. Por favor intenta nuevamente.',
            data=f'{{"informe_id": {informe.id}, "error": "{informe.error_message}"}}'
        )
        db.add(alert)
        db.commit()
    
    def _get_extension(self, formato: str) -> str:
        """Retorna la extensión del archivo según el formato."""
        extensions = {
            'pdf': 'pdf',
            'docx': 'docx',
            'xlsx': 'xlsx',
            'excel': 'xlsx'
        }
        return extensions.get(formato, 'pdf')
    
    def _get_content_type(self, formato: str) -> str:
        """Retorna el Content-Type según el formato."""
        content_types = {
            'pdf': 'application/pdf',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        return content_types.get(formato, 'application/pdf')
    
    def obtener_estado(self, db: Session, informe_id: int) -> Optional[InformeEstado]:
        """Obtiene el estado actual de un informe."""
        return db.query(InformeEstado).filter(InformeEstado.id == informe_id).first()
    
    def marcar_descargado(self, db: Session, informe_id: int):
        """Marca un informe como descargado."""
        informe = db.query(InformeEstado).filter(InformeEstado.id == informe_id).first()
        if informe:
            informe.downloaded = True
            informe.downloaded_at = datetime.utcnow()
            db.commit()
    
    def limpiar_informes_expirados(self, db: Session):
        """
        Elimina informes expirados de S3 y DB.
        Debe ejecutarse periódicamente (cronjob o scheduler).
        """
        now = datetime.utcnow()
        informes_expirados = db.query(InformeEstado).filter(
            InformeEstado.expires_at < now,
            InformeEstado.estado == 'completed'
        ).all()
        
        for informe in informes_expirados:
            try:
                # Eliminar de S3
                if informe.s3_key:
                    self.s3_client.delete_object(
                        Bucket=self.bucket_name,
                        Key=informe.s3_key
                    )
                
                # Eliminar de DB
                db.delete(informe)
                print(f"🗑️  Informe expirado eliminado: {informe.id}")
            except Exception as e:
                print(f"⚠️  Error eliminando informe {informe.id}: {e}")
        
        db.commit()


# Singleton instance
informe_service = InformeGeneratorService()
