#!/usr/bin/env python3
"""
Ejecutor de migraciones PDM - Método simplificado
Ejecuta migraciones directamente contra RDS (requiere conectividad)
"""
import subprocess
import sys
import os

def ejecutar_migracion(script_path, nombre):
    """Ejecuta un script de migración"""
    print(f"\n{'='*70}")
    print(f"🚀 EJECUTANDO: {nombre}")
    print(f"{'='*70}\n")
    
    try:
        result = subprocess.run(
            [sys.executable, script_path],
            check=True,
            capture_output=True,
            text=True
        )
        
        print(result.stdout)
        
        if result.stderr:
            print("⚠️ Warnings/Info:")
            print(result.stderr)
        
        print(f"\n✅ {nombre} completada exitosamente\n")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"\n❌ ERROR en {nombre}")
        print(f"\nOutput:\n{e.stdout}")
        print(f"\nError:\n{e.stderr}")
        return False
    except Exception as e:
        print(f"\n❌ ERROR ejecutando {nombre}: {e}")
        return False


def main():
    print("\n" + "="*70)
    print("🔧 EJECUTOR DE MIGRACIONES PDM")
    print("="*70)
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Lista de migraciones en orden
    migraciones = [
        ("migration_add_producto_fk.py", "Agregar FK producto_id (Integridad referencial)"),
        ("migration_prepare_s3_images.py", "Preparar columnas para migración S3"),
    ]
    
    print("\n📋 Migraciones a ejecutar:")
    for i, (script, desc) in enumerate(migraciones, 1):
        print(f"   {i}. {desc}")
        print(f"      Archivo: {script}")
    
    print("\n⚠️  IMPORTANTE:")
    print("   - Estas migraciones modificarán la base de datos en producción")
    print("   - Se recomienda hacer backup antes de ejecutar")
    print("   - Las migraciones son idempotentes (se pueden ejecutar múltiples veces)")
    
    respuesta = input("\n¿Desea continuar? (y/N): ").lower()
    
    if respuesta != 'y':
        print("\n❌ Ejecución cancelada por el usuario")
        return 1
    
    # Verificar conectividad a RDS
    print("\n🔌 Verificando conectividad a RDS...")
    try:
        import psycopg2
        conn = psycopg2.connect(
            host='softone-db.ccvomgoayzyt.us-east-1.rds.amazonaws.com',
            port=5432,
            database='postgres',
            user='dbadmin',
            password='TuPassSeguro123!',
            connect_timeout=5
        )
        conn.close()
        print("✅ Conexión a RDS exitosa")
    except ImportError:
        print("\n❌ ERROR: psycopg2 no está instalado")
        print("   Instalar con: pip install psycopg2-binary")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: No se puede conectar a RDS: {e}")
        print("\n💡 Opciones:")
        print("   1. Si estás en local sin VPN: Usa el método SSH via EC2")
        print("   2. Si estás en EC2: Esta conexión debería funcionar")
        print("   3. Verifica security groups y networking")
        return 1
    
    # Ejecutar migraciones
    resultados = []
    for script, nombre in migraciones:
        script_path = os.path.join(base_dir, script)
        
        if not os.path.exists(script_path):
            print(f"\n❌ ERROR: Script no encontrado: {script_path}")
            resultados.append(False)
            continue
        
        exito = ejecutar_migracion(script_path, nombre)
        resultados.append(exito)
        
        if not exito:
            print(f"\n⚠️ Migración {nombre} falló. ¿Continuar con las siguientes? (y/N): ")
            if input().lower() != 'y':
                break
    
    # Resumen final
    print("\n" + "="*70)
    print("📊 RESUMEN DE EJECUCIÓN")
    print("="*70)
    
    for i, ((script, nombre), exito) in enumerate(zip(migraciones, resultados), 1):
        status = "✅ OK" if exito else "❌ FALLÓ"
        print(f"   {status} - {nombre}")
    
    exitosas = sum(resultados)
    total = len(resultados)
    
    if exitosas == total:
        print(f"\n🎉 ÉXITO: {exitosas}/{total} migraciones completadas")
        print("\n📝 Próximos pasos:")
        print("   1. Verificar cambios en la base de datos")
        print("   2. Probar endpoints PDM")
        print("   3. Ejecutar test_pdm_performance.py")
        return 0
    else:
        print(f"\n⚠️ PARCIAL: {exitosas}/{total} migraciones completadas")
        print("   Revisar logs de error arriba")
        return 1


if __name__ == "__main__":
    sys.exit(main())
