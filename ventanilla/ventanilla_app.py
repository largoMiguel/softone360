import sys
import os
import uuid
import base64
import requests
import cv2
from datetime import datetime
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QMessageBox, QComboBox,
    QTextEdit, QGroupBox, QSplitter
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QImage, QPixmap, QFont


class VentanillaApp(QMainWindow):
    """
    Aplicación de escritorio para registro de asistencia de funcionarios.
    """
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Sistema de Control de Asistencia")
        self.setGeometry(100, 100, 1200, 700)
        
        # Configuración
        self.API_URL = "https://api.softone360.com"  # Cambiar por la URL de producción
        # self.API_URL = "http://localhost:8000"  # Para desarrollo local
        
        self.equipo_uuid = self.get_machine_uuid()
        self.equipo_valido = False
        self.entity_id = None
        self.entity_name = None
        
        # Cámara
        self.camera = None
        self.current_frame = None
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_frame)
        
        # UI
        self.init_ui()
        
        # Validar equipo al iniciar
        self.validar_equipo()
    
    def get_machine_uuid(self):
        """
        Obtiene el UUID único de la máquina.
        """
        try:
            # Windows: usa wmic para obtener UUID
            if sys.platform == "win32":
                import subprocess
                output = subprocess.check_output("wmic csproduct get uuid", shell=True)
                uuid_str = output.decode().split('\n')[1].strip()
                return uuid_str
            else:
                # macOS/Linux: genera UUID basado en características de hardware
                return str(uuid.UUID(int=uuid.getnode()))
        except:
            # Fallback: genera UUID aleatorio y lo guarda
            config_file = "machine_uuid.txt"
            if os.path.exists(config_file):
                with open(config_file, 'r') as f:
                    return f.read().strip()
            else:
                new_uuid = str(uuid.uuid4())
                with open(config_file, 'w') as f:
                    f.write(new_uuid)
                return new_uuid
    
    def init_ui(self):
        """
        Inicializa la interfaz de usuario.
        """
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setSpacing(20)
        
        # Header
        header = QLabel("Sistema de Control de Asistencia")
        header.setFont(QFont("Arial", 24, QFont.Weight.Bold))
        header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header.setStyleSheet("color: #2c3e50; padding: 20px;")
        main_layout.addWidget(header)
        
        # Info del equipo
        self.info_equipo_label = QLabel(f"UUID del equipo: {self.equipo_uuid}")
        self.info_equipo_label.setStyleSheet("color: #7f8c8d; padding: 5px;")
        main_layout.addWidget(self.info_equipo_label)
        
        self.status_label = QLabel("Validando equipo...")
        self.status_label.setStyleSheet("color: #e74c3c; font-weight: bold; padding: 5px;")
        main_layout.addWidget(self.status_label)
        
        # Splitter para dividir cámara y formulario
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # === Panel de cámara ===
        camera_group = QGroupBox("Cámara")
        camera_layout = QVBoxLayout()
        
        self.camera_label = QLabel("Cámara no iniciada")
        self.camera_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.camera_label.setMinimumSize(640, 480)
        self.camera_label.setStyleSheet("background-color: #ecf0f1; border: 2px solid #bdc3c7;")
        camera_layout.addWidget(self.camera_label)
        
        camera_buttons = QHBoxLayout()
        self.btn_iniciar_camara = QPushButton("Iniciar Cámara")
        self.btn_iniciar_camara.clicked.connect(self.iniciar_camara)
        self.btn_iniciar_camara.setStyleSheet(self.get_button_style("#3498db"))
        
        self.btn_capturar = QPushButton("Capturar Foto")
        self.btn_capturar.clicked.connect(self.capturar_foto)
        self.btn_capturar.setEnabled(False)
        self.btn_capturar.setStyleSheet(self.get_button_style("#27ae60"))
        
        camera_buttons.addWidget(self.btn_iniciar_camara)
        camera_buttons.addWidget(self.btn_capturar)
        camera_layout.addLayout(camera_buttons)
        
        camera_group.setLayout(camera_layout)
        splitter.addWidget(camera_group)
        
        # === Panel de formulario ===
        form_group = QGroupBox("Registro de Asistencia")
        form_layout = QVBoxLayout()
        
        # Cédula
        cedula_layout = QHBoxLayout()
        cedula_layout.addWidget(QLabel("Cédula:"))
        self.input_cedula = QLineEdit()
        self.input_cedula.setPlaceholderText("Ingrese número de cédula")
        self.input_cedula.setFont(QFont("Arial", 14))
        self.input_cedula.returnPressed.connect(self.registrar_asistencia)
        cedula_layout.addWidget(self.input_cedula)
        form_layout.addLayout(cedula_layout)
        
        # Tipo de registro
        tipo_layout = QHBoxLayout()
        tipo_layout.addWidget(QLabel("Tipo:"))
        self.combo_tipo = QComboBox()
        self.combo_tipo.addItems(["entrada", "salida"])
        self.combo_tipo.setFont(QFont("Arial", 14))
        tipo_layout.addWidget(self.combo_tipo)
        form_layout.addLayout(tipo_layout)
        
        # Observaciones
        form_layout.addWidget(QLabel("Observaciones (opcional):"))
        self.input_observaciones = QTextEdit()
        self.input_observaciones.setMaximumHeight(100)
        self.input_observaciones.setPlaceholderText("Ingrese observaciones si es necesario")
        form_layout.addWidget(self.input_observaciones)
        
        # Botón de registro
        self.btn_registrar = QPushButton("Registrar Asistencia")
        self.btn_registrar.clicked.connect(self.registrar_asistencia)
        self.btn_registrar.setEnabled(False)
        self.btn_registrar.setStyleSheet(self.get_button_style("#e67e22"))
        self.btn_registrar.setMinimumHeight(50)
        self.btn_registrar.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        form_layout.addWidget(self.btn_registrar)
        
        # Log de actividades
        form_layout.addWidget(QLabel("Registro de actividad:"))
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(200)
        form_layout.addWidget(self.log_text)
        
        form_group.setLayout(form_layout)
        splitter.addWidget(form_group)
        
        splitter.setSizes([600, 600])
        main_layout.addWidget(splitter)
    
    def get_button_style(self, color):
        """
        Retorna el estilo CSS para botones.
        """
        return f"""
            QPushButton {{
                background-color: {color};
                color: white;
                border: none;
                padding: 10px;
                font-size: 14px;
                font-weight: bold;
                border-radius: 5px;
            }}
            QPushButton:hover {{
                background-color: {self.darken_color(color)};
            }}
            QPushButton:disabled {{
                background-color: #95a5a6;
            }}
        """
    
    def darken_color(self, hex_color):
        """
        Oscurece un color hexadecimal.
        """
        hex_color = hex_color.lstrip('#')
        r, g, b = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        r = max(0, r - 30)
        g = max(0, g - 30)
        b = max(0, b - 30)
        return f"#{r:02x}{g:02x}{b:02x}"
    
    def validar_equipo(self):
        """
        Valida si el equipo está autorizado para registrar asistencia.
        """
        try:
            response = requests.post(
                f"{self.API_URL}/api/asistencia/equipos/validar",
                json={"uuid": self.equipo_uuid},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data["valido"]:
                    self.equipo_valido = True
                    self.entity_id = data["entity_id"]
                    self.status_label.setText(f"✓ Equipo autorizado: {data['mensaje']}")
                    self.status_label.setStyleSheet("color: #27ae60; font-weight: bold; padding: 5px;")
                    self.btn_registrar.setEnabled(True)
                    self.log(f"Equipo autorizado: {data['mensaje']}")
                else:
                    self.equipo_valido = False
                    self.status_label.setText(f"✗ {data['mensaje']}")
                    self.status_label.setStyleSheet("color: #e74c3c; font-weight: bold; padding: 5px;")
                    QMessageBox.critical(
                        self,
                        "Equipo no autorizado",
                        f"Este equipo no está autorizado para registrar asistencia.\n\n"
                        f"UUID: {self.equipo_uuid}\n\n"
                        f"Por favor, contacte al administrador del sistema."
                    )
            else:
                raise Exception(f"Error {response.status_code}")
        
        except Exception as e:
            self.equipo_valido = False
            self.status_label.setText(f"✗ Error de conexión: {str(e)}")
            self.status_label.setStyleSheet("color: #e74c3c; font-weight: bold; padding: 5px;")
            QMessageBox.critical(
                self,
                "Error de conexión",
                f"No se pudo conectar con el servidor.\n\n{str(e)}\n\n"
                f"Verifique su conexión a internet."
            )
    
    def iniciar_camara(self):
        """
        Inicia la cámara para captura de fotos.
        """
        if self.camera is None:
            self.camera = cv2.VideoCapture(0)
            if not self.camera.isOpened():
                QMessageBox.critical(self, "Error", "No se pudo acceder a la cámara")
                self.camera = None
                return
            
            self.timer.start(30)  # Actualizar cada 30ms
            self.btn_iniciar_camara.setText("Detener Cámara")
            self.btn_capturar.setEnabled(True)
            self.log("Cámara iniciada")
        else:
            self.detener_camara()
    
    def detener_camara(self):
        """
        Detiene la cámara.
        """
        if self.camera is not None:
            self.timer.stop()
            self.camera.release()
            self.camera = None
            self.camera_label.setText("Cámara detenida")
            self.btn_iniciar_camara.setText("Iniciar Cámara")
            self.btn_capturar.setEnabled(False)
            self.log("Cámara detenida")
    
    def update_frame(self):
        """
        Actualiza el frame de la cámara.
        """
        if self.camera is not None:
            ret, frame = self.camera.read()
            if ret:
                self.current_frame = frame
                # Convertir BGR a RGB
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                h, w, ch = rgb_frame.shape
                bytes_per_line = ch * w
                qt_image = QImage(rgb_frame.data, w, h, bytes_per_line, QImage.Format.Format_RGB888)
                pixmap = QPixmap.fromImage(qt_image)
                
                # Escalar para ajustar al label
                scaled_pixmap = pixmap.scaled(
                    self.camera_label.width(),
                    self.camera_label.height(),
                    Qt.AspectRatioMode.KeepAspectRatio
                )
                self.camera_label.setPixmap(scaled_pixmap)
    
    def capturar_foto(self):
        """
        Captura la foto actual de la cámara.
        """
        if self.current_frame is not None:
            self.log("Foto capturada")
            QMessageBox.information(self, "Foto capturada", "La foto se enviará con el registro")
    
    def registrar_asistencia(self):
        """
        Registra la asistencia del funcionario.
        """
        if not self.equipo_valido:
            QMessageBox.warning(self, "Error", "Equipo no autorizado")
            return
        
        cedula = self.input_cedula.text().strip()
        if not cedula:
            QMessageBox.warning(self, "Error", "Ingrese el número de cédula")
            self.input_cedula.setFocus()
            return
        
        tipo_registro = self.combo_tipo.currentText()
        observaciones = self.input_observaciones.toPlainText().strip()
        
        # Convertir foto a base64 si está disponible
        foto_base64 = None
        if self.current_frame is not None:
            _, buffer = cv2.imencode('.jpg', self.current_frame)
            foto_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Enviar al servidor
        try:
            self.log(f"Registrando {tipo_registro} para cédula {cedula}...")
            
            payload = {
                "cedula": cedula,
                "equipo_uuid": self.equipo_uuid,
                "tipo_registro": tipo_registro,
                "foto_base64": foto_base64,
                "observaciones": observaciones if observaciones else None
            }
            
            response = requests.post(
                f"{self.API_URL}/api/asistencia/registros",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 201:
                data = response.json()
                nombre_completo = f"{data.get('funcionario_nombres', '')} {data.get('funcionario_apellidos', '')}"
                
                self.log(f"✓ Registro exitoso: {nombre_completo} - {tipo_registro}")
                QMessageBox.information(
                    self,
                    "Registro exitoso",
                    f"Registro de {tipo_registro} exitoso\n\n"
                    f"Funcionario: {nombre_completo}\n"
                    f"Cédula: {cedula}\n"
                    f"Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                )
                
                # Limpiar formulario
                self.input_cedula.clear()
                self.input_observaciones.clear()
                self.input_cedula.setFocus()
                
            else:
                error_data = response.json()
                error_msg = error_data.get("detail", "Error desconocido")
                self.log(f"✗ Error: {error_msg}")
                QMessageBox.critical(self, "Error", f"Error al registrar:\n\n{error_msg}")
        
        except requests.exceptions.Timeout:
            self.log("✗ Error: Timeout de conexión")
            QMessageBox.critical(self, "Error", "Tiempo de espera agotado. Intente nuevamente.")
        
        except Exception as e:
            self.log(f"✗ Error: {str(e)}")
            QMessageBox.critical(self, "Error", f"Error al registrar:\n\n{str(e)}")
    
    def log(self, message):
        """
        Agrega un mensaje al log de actividades.
        """
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.append(f"[{timestamp}] {message}")
    
    def closeEvent(self, event):
        """
        Maneja el cierre de la aplicación.
        """
        self.detener_camara()
        event.accept()


def main():
    app = QApplication(sys.argv)
    window = VentanillaApp()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
