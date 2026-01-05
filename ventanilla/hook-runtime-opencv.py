import sys
import os

# Runtime hook para asegurar que las DLLs de numpy se encuentren
# Este código se ejecuta ANTES de importar cualquier módulo

if hasattr(sys, '_MEIPASS'):
    # Estamos en un ejecutable de PyInstaller
    bundle_dir = sys._MEIPASS
    
    # Agregar rutas críticas al PATH para que las DLLs se encuentren
    os.environ['PATH'] = bundle_dir + os.pathsep + os.environ.get('PATH', '')
    
    # Agregar a sys.path para imports de Python
    if bundle_dir not in sys.path:
        sys.path.insert(0, bundle_dir)
    
    # Pre-cargar numpy antes de que cv2 lo intente
    try:
        import numpy.core._multiarray_umath
        import numpy.core._multiarray_tests
    except:
        pass
