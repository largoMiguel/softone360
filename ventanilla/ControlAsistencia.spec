# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from PyInstaller.utils.hooks import collect_all, collect_submodules, collect_data_files

# Recolectar todas las dependencias de OpenCV y numpy
datas_cv2 = []
binaries_cv2 = []
hiddenimports_cv2 = []
tmp_ret_cv2 = collect_all('cv2')
datas_cv2 += tmp_ret_cv2[0]
binaries_cv2 += tmp_ret_cv2[1]
hiddenimports_cv2 += tmp_ret_cv2[2]

datas_numpy = []
binaries_numpy = []
hiddenimports_numpy = []
tmp_ret_numpy = collect_all('numpy')
datas_numpy += tmp_ret_numpy[0]
binaries_numpy += tmp_ret_numpy[1]
hiddenimports_numpy += tmp_ret_numpy[2]

# Imports ocultos adicionales
hiddenimports = [
    'cv2',
    'numpy',
    'numpy.core',
    'numpy.core.multiarray',
    'numpy.core._multiarray_umath',
    'numpy.core._methods',
    'numpy.lib.format',
    'numpy.fft',
    'numpy.linalg',
    'numpy.random',
    'PyQt6',
    'PyQt6.QtCore',
    'PyQt6.QtGui',
    'PyQt6.QtWidgets',
    'requests',
    'uuid',
    'base64',
    'datetime',
]

a = Analysis(
    ['ventanilla_app.py'],
    pathex=[],
    binaries=binaries_cv2 + binaries_numpy,
    datas=datas_cv2 + datas_numpy,
    hiddenimports=hiddenimports + hiddenimports_cv2 + hiddenimports_numpy,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=None)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ControlAsistencia',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
