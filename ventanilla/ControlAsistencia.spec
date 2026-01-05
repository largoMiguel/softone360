# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from PyInstaller.utils.hooks import collect_all, collect_submodules, collect_data_files, collect_dynamic_libs

# Recolectar todas las dependencias de OpenCV y numpy de manera más completa
datas = []
binaries = []
hiddenimports = []

# OpenCV - recolectar todo
for package in ['cv2', 'numpy']:
    tmp = collect_all(package)
    datas += tmp[0]
    binaries += tmp[1]
    hiddenimports += tmp[2]

# Agregar DLLs de numpy explícitamente
binaries += collect_dynamic_libs('numpy')

# Agregar más imports críticos
hiddenimports += [
    'cv2',
    'numpy',
    'numpy.core',
    'numpy.core.multiarray',
    'numpy.core._multiarray_umath',
    'numpy.core._multiarray_tests',
    'numpy.core._methods',
    'numpy.lib.format',
    'numpy.fft',
    'numpy.linalg',
    'numpy.random',
    'numpy.core._dtype',
    'numpy.core._dtype_ctypes',
    'numpy._distributor_init',
    'PyQt6',
    'PyQt6.QtCore',
    'PyQt6.QtGui',
    'PyQt6.QtWidgets',
    'PyQt6.sip',
    'requests',
    'urllib3',
    'charset_normalizer',
    'idna',
    'certifi',
    'uuid',
    'base64',
    'datetime',
]

a = Analysis(
    ['ventanilla_app.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=['hook-runtime-opencv.py'],
    excludes=['matplotlib', 'tkinter', 'PIL', 'scipy'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ControlAsistencia',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='ControlAsistencia',
)
