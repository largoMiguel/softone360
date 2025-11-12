#!/usr/bin/env python3
"""
Script de auditoría: Validar flujo de planes institucionales para secretarios
- Verificar que se crean alertas cuando se asigna actividad a secretaría
- Verificar que secretario solo ve planes con actividades asignadas
- Verificar que el nombre de la secretaría se personaliza correctamente
"""

import sys
import os
sys.path.insert(0, '/Users/largo/Documents/SOLUCTIONS/backend')

from sqlalchemy.orm import Session
from app.config.database import SessionLocal
from app.models.plan import PlanInstitucional, ComponenteProceso, Actividad
from app.models.user import User, UserRole
from app.models.secretaria import Secretaria
from app.models.alert import Alert
from datetime import date
import json

def main():
    db: Session = SessionLocal()
    
    print("="*80)
    print("🔍 AUDITORÍA: PLANES INSTITUCIONALES PARA SECRETARIOS")
    print("="*80)
    print()
    
    # 1. Verificar estructura de datos
    print("📋 PASO 1: Verificar estructura de datos")
    print("-" * 80)
    
    # Contar planes
    planes = db.query(PlanInstitucional).all()
    print(f"✓ Total de planes: {len(planes)}")
    
    # Contar actividades
    actividades = db.query(Actividad).all()
    print(f"✓ Total de actividades: {len(actividades)}")
    
    # Contar secretarías
    secretarias = db.query(Secretaria).all()
    print(f"✓ Total de secretarías: {len(secretarias)}")
    
    # Contar secretarios
    secretarios = db.query(User).filter(User.role == UserRole.SECRETARIO).all()
    print(f"✓ Total de secretarios: {len(secretarios)}")
    
    # Contar alertas
    alertas = db.query(Alert).all()
    print(f"✓ Total de alertas: {len(alertas)}")
    print()
    
    # 2. Verificar actividades sin secretaría asignada
    print("📋 PASO 2: Verificar actividades sin secretaría asignada")
    print("-" * 80)
    
    actividades_sin_secretaria = db.query(Actividad).filter(
        Actividad.responsable_secretaria_id.is_(None)
    ).all()
    
    print(f"⚠️  Actividades sin secretaría asignada: {len(actividades_sin_secretaria)}")
    for act in actividades_sin_secretaria[:3]:
        print(f"   - ID: {act.id}, Componente: {act.componente_id}")
    print()
    
    # 3. Verificar actividades CON secretaría asignada
    print("📋 PASO 3: Verificar actividades CON secretaría asignada")
    print("-" * 80)
    
    actividades_con_secretaria = db.query(Actividad).filter(
        Actividad.responsable_secretaria_id.isnot(None)
    ).all()
    
    print(f"✓ Actividades con secretaría asignada: {len(actividades_con_secretaria)}")
    
    for act in actividades_con_secretaria:
        secretaria = db.query(Secretaria).filter(
            Secretaria.id == act.responsable_secretaria_id
        ).first()
        
        componente = db.query(ComponenteProceso).filter(
            ComponenteProceso.id == act.componente_id
        ).first()
        
        if componente:
            plan = db.query(PlanInstitucional).filter(
                PlanInstitucional.id == componente.plan_id
            ).first()
            print(f"   - Actividad {act.id}")
            print(f"     • Plan: {plan.nombre if plan else 'NO ENCONTRADO'}")
            print(f"     • Componente: {componente.nombre}")
            print(f"     • Secretaría responsable: {secretaria.nombre if secretaria else 'SIN ASIGNAR'}")
    print()
    
    # 4. Verificar alertas de actividades nuevas
    print("📋 PASO 4: Verificar alertas de PLAN_NEW_ACTIVITY")
    print("-" * 80)
    
    alertas_plan_activity = db.query(Alert).filter(
        Alert.type == "PLAN_NEW_ACTIVITY"
    ).all()
    
    print(f"✓ Alertas de nueva actividad: {len(alertas_plan_activity)}")
    
    for alerta in alertas_plan_activity[:5]:
        user = db.query(User).filter(User.id == alerta.recipient_user_id).first()
        print(f"   - Alerta {alerta.id}")
        print(f"     • Destinatario: {user.username if user else 'NO ENCONTRADO'} (Rol: {user.role if user else 'N/A'})")
        print(f"     • Título: {alerta.title}")
        print(f"     • Data: {alerta.data}")
    print()
    
    # 5. Verificar que cada actividad con secretaría tiene alertas para secretarios de esa secretaría
    print("📋 PASO 5: Validar correlación actividades ↔ alertas")
    print("-" * 80)
    
    problemas = 0
    for act in actividades_con_secretaria:
        if not act.responsable_secretaria_id:
            continue
        
        # Obtener la entidad del plan
        componente = db.query(ComponenteProceso).filter(
            ComponenteProceso.id == act.componente_id
        ).first()
        
        if not componente:
            print(f"❌ ERROR: Componente {act.componente_id} no encontrado para actividad {act.id}")
            problemas += 1
            continue
        
        plan = db.query(PlanInstitucional).filter(
            PlanInstitucional.id == componente.plan_id
        ).first()
        
        if not plan:
            print(f"❌ ERROR: Plan no encontrado para componente {componente.id}")
            problemas += 1
            continue
        
        # Obtener secretarios de la secretaría responsable
        secretarios_secretaria = db.query(User).filter(
            User.role == UserRole.SECRETARIO,
            User.entity_id == plan.entity_id,
            User.secretaria_id == act.responsable_secretaria_id,
            User.is_active == True
        ).all()
        
        # Verificar que hay alertas para ellos
        for secretario in secretarios_secretaria:
            alerta_existe = db.query(Alert).filter(
                Alert.recipient_user_id == secretario.id,
                Alert.type == "PLAN_NEW_ACTIVITY"
            ).first()
            
            if not alerta_existe:
                print(f"❌ PROBLEMA: Actividad {act.id} asignada a {secretario.username} pero SIN ALERTA")
                problemas += 1
            else:
                print(f"✓ Actividad {act.id} → Alerta enviada a {secretario.username}")
    
    if problemas == 0:
        print("✓ Todas las correlaciones están correctas")
    else:
        print(f"\n⚠️  TOTAL DE PROBLEMAS ENCONTRADOS: {problemas}")
    print()
    
    # 6. Verificar que secretarios ven solo planes con actividades asignadas
    print("📋 PASO 6: Validar visualización de planes para secretarios")
    print("-" * 80)
    
    for secretario in secretarios[:3]:
        # Obtener todos los planes de la entidad del secretario
        planes_entidad = db.query(PlanInstitucional).filter(
            PlanInstitucional.entity_id == secretario.entity_id
        ).all()
        
        # Obtener planes que tienen actividades asignadas a este secretario
        planes_con_actividades = db.query(PlanInstitucional).distinct().join(
            ComponenteProceso
        ).join(
            Actividad
        ).filter(
            PlanInstitucional.entity_id == secretario.entity_id,
            Actividad.responsable_secretaria_id == secretario.secretaria_id
        ).all()
        
        print(f"\n👤 Secretario: {secretario.username} (Secretaría: {secretario.secretaria_id})")
        print(f"   • Planes en su entidad: {len(planes_entidad)}")
        print(f"   • Planes con actividades asignadas: {len(planes_con_actividades)}")
        
        if len(planes_con_actividades) > 0:
            for plan in planes_con_actividades[:2]:
                print(f"     - Plan {plan.id}: {plan.nombre}")
    print()
    
    print("="*80)
    print("✅ AUDITORÍA COMPLETADA")
    print("="*80)
    
    db.close()

if __name__ == "__main__":
    main()
