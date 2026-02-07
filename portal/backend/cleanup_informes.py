#!/usr/bin/env python3
"""
Script para limpiar informes de prueba de la base de datos
"""
import sys
import os

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config.database import SessionLocal
from app.models.informe import InformeEstado
from sqlalchemy import delete

def limpiar_informes():
    """Elimina todos los informes de la base de datos"""
    db = SessionLocal()
    try:
        # Obtener todos los informes antes de eliminar
        informes = db.query(InformeEstado).all()
        total = len(informes)
        
        print(f"\n📊 Informes encontrados: {total}")
        print("=" * 60)
        
        for inf in informes:
            print(f"  ID: {inf.id}, Estado: {inf.estado}, Año: {inf.anio}, Formato: {inf.formato}")
        
        if total == 0:
            print("\n✅ No hay informes para eliminar")
            return
        
        # Pedir confirmación
        confirmacion = input(f"\n⚠️  ¿Eliminar los {total} informes? (escriba 'SI' para confirmar): ")
        
        if confirmacion.strip().upper() != 'SI':
            print("\n❌ Operación cancelada")
            return
        
        # Eliminar todos los informes
        resultado = db.execute(delete(InformeEstado))
        db.commit()
        
        print(f"\n✅ Eliminados {resultado.rowcount} informes exitosamente")
        print("\n💡 Nota: Los archivos en S3 permanecen, si deseas eliminarlos también:")
        print("   aws s3 rm s3://softone-pdm-informes/informes/ --recursive")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    limpiar_informes()
