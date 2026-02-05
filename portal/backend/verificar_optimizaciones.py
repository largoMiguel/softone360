#!/usr/bin/env python3
"""
Script de verificación: Confirmar que todas las optimizaciones PDM están aplicadas
Revisa el código fuente para validar los cambios
"""
import os
import re

def verificar_archivo(ruta, checks):
    """Verifica que un archivo contenga los cambios esperados"""
    print(f"\n📄 Verificando: {os.path.basename(ruta)}")
    
    if not os.path.exists(ruta):
        print(f"   ❌ Archivo no encontrado")
        return False
    
    with open(ruta, 'r', encoding='utf-8') as f:
        contenido = f.read()
    
    resultados = []
    for nombre_check, patron, debe_existir in checks:
        encontrado = re.search(patron, contenido, re.MULTILINE | re.DOTALL)
        
        if debe_existir and encontrado:
            print(f"   ✅ {nombre_check}")
            resultados.append(True)
        elif not debe_existir and not encontrado:
            print(f"   ✅ {nombre_check}")
            resultados.append(True)
        else:
            print(f"   ❌ {nombre_check}")
            resultados.append(False)
    
    return all(resultados)


def main():
    print("\n" + "=" * 70)
    print("🔍 VERIFICACIÓN DE OPTIMIZACIONES PDM")
    print("=" * 70)
    
    base_path = "/Users/mlargo/Documents/softone360/portal/backend"
    
    # ==========================================
    # 1. Verificar pdm.py (modelos)
    # ==========================================
    pdm_model_checks = [
        ("Lazy loading con selectinload", r'lazy\s*=\s*["\']selectinload["\']', True),
        ("Sin lazy='select' en actividades", r'lazy\s*=\s*["\']select["\'].*actividades', False),
    ]
    
    ok_model = verificar_archivo(
        f"{base_path}/app/models/pdm.py",
        pdm_model_checks
    )
    
    # ==========================================
    # 2. Verificar pdm_v2.py (rutas)
    # ==========================================
    pdm_v2_checks = [
        ("Import de selectinload", r'from sqlalchemy\.orm import.*selectinload', True),
        ("Import de re (regex)", r'^import re', True),
        ("Selectinload en query de productos", r'selectinload\(PdmProducto\.responsable_secretaria\)', True),
        ("Selectinload en actividades", r'selectinload\(PdmActividad\.responsable_secretaria\)', True),
        ("Validación con regex", r're\.match.*imagen_data', True),
        ("Sin base64.b64decode en validación", r'base64\.b64decode\(imagen_b64.*validate=True\)', False),
    ]
    
    ok_v2 = verificar_archivo(
        f"{base_path}/app/routes/pdm_v2.py",
        pdm_v2_checks
    )
    
    # ==========================================
    # 3. Verificar pdm_informes.py
    # ==========================================
    pdm_informes_checks = [
        ("Import de selectinload", r'from sqlalchemy\.orm import.*selectinload', True),
        ("Import de noload", r'from sqlalchemy\.orm import.*noload', True),
        ("Selectinload en productos", r'selectinload\(PdmProducto\.responsable_secretaria\)', True),
        ("Selectinload en actividades", r'selectinload\(PdmActividad\.responsable_secretaria\)', True),
        ("Noload de evidencias", r'noload\(PdmActividad\.evidencia\)', True),
    ]
    
    ok_informes = verificar_archivo(
        f"{base_path}/app/routes/pdm_informes.py",
        pdm_informes_checks
    )
    
    # ==========================================
    # 4. Verificar scripts de migración existen
    # ==========================================
    print(f"\n📄 Verificando scripts de migración")
    
    scripts_migracion = [
        "migration_add_pdm_indexes.py",
        "migration_add_producto_fk.py",
        "migration_prepare_s3_images.py",
        "test_pdm_performance.py",
        "PDM_OPTIMIZACIONES_APLICADAS.py"
    ]
    
    ok_scripts = True
    for script in scripts_migracion:
        ruta = f"{base_path}/{script}"
        if os.path.exists(ruta):
            # Verificar que sea ejecutable
            if os.access(ruta, os.X_OK):
                print(f"   ✅ {script} (ejecutable)")
            else:
                print(f"   ⚠️  {script} (existe pero no ejecutable)")
        else:
            print(f"   ❌ {script} (no encontrado)")
            ok_scripts = False
    
    # ==========================================
    # RESUMEN FINAL
    # ==========================================
    print("\n" + "=" * 70)
    print("📊 RESUMEN DE VERIFICACIÓN")
    print("=" * 70)
    
    checks_totales = [
        ("Modelos (pdm.py)", ok_model),
        ("Rutas PDM v2 (pdm_v2.py)", ok_v2),
        ("Informes (pdm_informes.py)", ok_informes),
        ("Scripts de migración", ok_scripts)
    ]
    
    for nombre, ok in checks_totales:
        status = "✅ OK" if ok else "❌ FALLÓ"
        print(f"   {status} - {nombre}")
    
    todo_ok = all(ok for _, ok in checks_totales)
    
    if todo_ok:
        print("\n" + "=" * 70)
        print("🎉 TODAS LAS OPTIMIZACIONES ESTÁN CORRECTAMENTE APLICADAS")
        print("=" * 70)
        print("\n✅ Cambios en código: COMPLETADOS")
        print("⚠️  Migraciones DB: PENDIENTES de ejecutar en producción")
        print("\n📝 Próximos pasos:")
        print("   1. Hacer commit de los cambios")
        print("   2. Hacer push al repositorio")
        print("   3. Deploy a producción")
        print("   4. Ejecutar migration_add_producto_fk.py en prod")
        print("   5. Ejecutar test_pdm_performance.py para validar")
    else:
        print("\n" + "=" * 70)
        print("⚠️  ALGUNAS VERIFICACIONES FALLARON")
        print("=" * 70)
        print("\nRevisar los archivos marcados con ❌")
    
    return 0 if todo_ok else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
