# Alternativas para Compilar desde macOS

Ya que estás en macOS y necesitas generar un .exe para Windows, aquí están las mejores opciones:

## ✅ Opción 1: GitHub Actions (RECOMENDADA)

**Ventajas**: Gratis, automático, no necesitas Windows

1. Crea un repositorio en GitHub (privado si quieres)
2. Sube tu código a GitHub
3. Copia el archivo `.github/workflows/build-exe.yml` al repositorio
4. Haz push al repositorio:
   ```bash
   cd /Users/mlargo/Documents/softone360/ventanilla
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/ventanilla.git
   git push -u origin main
   ```
5. Ve a la pestaña "Actions" en GitHub
6. Ejecuta el workflow "Build Windows EXE"
7. Descarga el .exe generado desde "Artifacts"

**Resultado**: Tendrás `ControlAsistencia.exe` sin necesitar Windows

---

## ✅ Opción 2: Usar una Máquina Virtual Windows

**Herramientas**: VirtualBox (gratis) o Parallels Desktop (pago)

### Con VirtualBox (Gratis):

1. Descarga VirtualBox:
   ```bash
   brew install --cask virtualbox
   ```

2. Descarga una ISO de Windows 10/11:
   - Desde Microsoft: https://www.microsoft.com/software-download/windows10

3. Crea una VM con Windows

4. Dentro de Windows:
   - Instala Python 3.10
   - Copia los archivos de ventanilla
   - Ejecuta `build_exe.bat`

**Tiempo estimado**: 1-2 horas (primera vez)

---

## ✅ Opción 3: AWS EC2 con Windows (Temporal)

**Costo**: ~$0.50 por hora (puedes usar free tier)

1. Crear instancia EC2 con Windows Server:
   ```bash
   # Desde AWS Console
   # Elige: Windows Server 2022
   # Tipo: t2.micro (free tier) o t3.medium
   ```

2. Conectar via RDP desde Mac:
   - Usa "Microsoft Remote Desktop" (gratis en App Store)

3. Dentro del servidor:
   - Instala Python
   - Copia archivos via RDP
   - Ejecuta `build_exe.bat`
   - Descarga el .exe generado

4. Termina la instancia (para no pagar más)

**Ventaja**: Rápido, no ocupa espacio en tu Mac

---

## ❌ Opción 4: Wine (NO Recomendada)

**Problema**: PyInstaller con Wine no genera .exe funcionales para aplicaciones complejas con GUI

```bash
# NO HAGAS ESTO, no funcionará bien
brew install wine-stable
wine python installer.exe
```

**Resultado**: .exe probablemente defectuoso

---

## ✅ Opción 5: Pedir a Alguien con Windows

La más simple:

1. Copia todos los archivos de `ventanilla/` en un USB o envía por correo
2. La persona con Windows:
   - Instala Python 3.10+
   - Ejecuta `build_exe.bat`
   - Te devuelve el `ControlAsistencia.exe`

**Tiempo**: 15 minutos

---

## 🎯 Mi Recomendación

**Para uso inmediato**: Opción 5 (pedir a alguien con Windows)

**Para desarrollo continuo**: Opción 1 (GitHub Actions) - automatiza todo

**Si tienes presupuesto**: Opción 3 (AWS EC2) - rápido y profesional

**Para largo plazo**: Opción 2 (VM) - útil para testing también

---

## Script Rápido para Opción 1 (GitHub Actions)

```bash
cd /Users/mlargo/Documents/softone360

# Inicializar git si no existe
git init

# Crear .gitignore
cat > .gitignore << EOF
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
dist/
build/
*.spec
*.log
machine_uuid.txt
EOF

# Agregar archivos
git add .
git commit -m "Add ventanilla app with EXE build workflow"

# Crear repo en GitHub y pushear
# (necesitas crear el repo manualmente en github.com primero)
git remote add origin https://github.com/TU_USUARIO/softone360.git
git branch -M main
git push -u origin main
```

Después ve a GitHub → Actions → Run workflow → Descarga el .exe

---

## Contacto de Soporte

Si tienes problemas con cualquiera de estas opciones, déjame saber qué método prefieres usar y te ayudo paso a paso.
