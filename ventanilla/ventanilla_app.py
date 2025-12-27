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
    QTextEdit, QGroupBox, QFrame, QStackedWidget
)
from PyQt6.QtCore import Qt, QTimer, QPropertyAnimation, QEasingCurve
from PyQt6.QtGui import QImage, QPixmap, QFont, QPalette, QColor, QIcon


class ModernVentanillaApp(QMainWindow):
    """
    Aplicación moderna de escritorio para registro de asistencia.
    Diseño intuitivo y profesional.
    """
    
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Control de Asistencia - Softone360")
        self.setGeometry(100, 100, 1400, 800)
        self.setMinimumSize(1200, 700)
        
        # Configuración
        self.API_URL = "https://api.softone360.com"
        self.equipo_uuid = self.get_machine_uuid()
        self.equipo_valido = False
        self.entity_name = None
        
        # Cámara
        self.camera = None
        self.current_frame = None
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_frame)
        self.camera_active = False
        
        # UI
        self.setup_styles()
        self.init_ui()
        
        # Validar equipo e iniciar cámara automáticamente
        self.validar_equipo()
    
    def get_machine_uuid(self):
        """Obtiene el UUID único de la máquina"""
        try:
            if sys.platform == "win32":
                import subprocess
                output = subprocess.check_output("wmic csproduct get uuid", shell=True)
                return output.decode().split('\n')[1].strip()
            else:
                return str(uuid.UUID(int=uuid.getnode()))
        except:
            config_file = "machine_uuid.txt"
            if os.path.exists(config_file):
                with open(config_file, 'r') as f:
                    return f.read().strip()
            else:
                new_uuid = str(uuid.uuid4())
                with open(config_file, 'w') as f:
                    f.write(new_uuid)
                return new_uuid
    
    def setup_styles(self):
        """Configuración de estilos globales"""
        self.setStyleSheet("""
            QMainWindow {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 #667eea, stop:1 #764ba2);
            }
            QLabel {
                color: #2c3e50;
            }
            QGroupBox {
                background: white;
                border-radius: 15px;
                padding: 20px;
                font-weight: bold;
                font-size: 14px;
            }
            QLineEdit {
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                background: white;
            }
            QLineEdit:focus {
                border: 2px solid #667eea;
            }
            QComboBox {
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 16px;
                background: white;
            }
            QPushButton {
                padding: 15px 30px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: bold;
                border: none;
            }
            QPushButton:disabled {
                background: #bdc3c7;
                color: #7f8c8d;
            }
        """)
    
    def init_ui(self):
        """Inicializa la interfaz moderna"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(30, 30, 30, 30)
        main_layout.setSpacing(20)
        
        # === HEADER MODERNO ===
        header_frame = QFrame()
        header_frame.setStyleSheet("""
            QFrame {
                background: white;
                border-radius: 15px;
                padding: 20px;
            }
        """)
        header_layout = QHBoxLayout(header_frame)
        
        # Logo y título
        title_layout = QVBoxLayout()
        title = QLabel("🏢 Control de Asistencia")
        title.setFont(QFont("Arial", 28, QFont.Weight.Bold))
        title.setStyleSheet("color: #667eea;")
        
        self.status_label = QLabel("⏳ Validando equipo...")
        self.status_label.setFont(QFont("Arial", 12))
        self.status_label.setStyleSheet("color: #7f8c8d;")
        
        title_layout.addWidget(title)
        title_layout.addWidget(self.status_label)
        header_layout.addLayout(title_layout)
        
        header_layout.addStretch()
        
        # Info del equipo
        info_layout = QVBoxLayout()
        self.entity_label = QLabel("🏛️ Entidad: Cargando...")
        self.entity_label.setFont(QFont("Arial", 11))
        self.entity_label.setStyleSheet("color: #34495e;")
        
        uuid_label = QLabel(f"🔑 UUID: {self.equipo_uuid[:20]}...")
        uuid_label.setFont(QFont("Arial", 9))
        uuid_label.setStyleSheet("color: #95a5a6;")
        
        info_layout.addWidget(self.entity_label)
        info_layout.addWidget(uuid_label)
        header_layout.addLayout(info_layout)
        
        main_layout.addWidget(header_frame)
        
        # === PANEL PRINCIPAL ===
        content_frame = QFrame()
        content_frame.setStyleSheet("""
            QFrame {
                background: white;
                border-radius: 15px;
            }
        """)
        content_layout = QHBoxLayout(content_frame)
        content_layout.setSpacing(20)
        content_layout.setContentsMargins(20, 20, 20, 20)
        
        # === IZQUIERDA: CÁMARA ===
        camera_container = QWidget()
        camera_layout = QVBoxLayout(camera_container)
        camera_layout.setSpacing(15)
        
        camera_title = QLabel("📷 Vista en Vivo")
        camera_title.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        camera_title.setStyleSheet("color: #667eea; margin-bottom: 10px;")
        camera_layout.addWidget(camera_title)
        
        self.camera_label = QLabel()
        self.camera_label.setMinimumSize(640, 480)
        self.camera_label.setMaximumSize(640, 480)
        self.camera_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.camera_label.setStyleSheet("""
            QLabel {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 #f5f7fa, stop:1 #c3cfe2);
                border: 3px solid #667eea;
                border-radius: 15px;
                color: #7f8c8d;
                font-size: 18px;
                font-weight: bold;
            }
        """)
        self.camera_label.setText("🎥\n\nCámara Iniciándose...")
        camera_layout.addWidget(self.camera_label)
        
        # Estado de la cámara
        self.camera_status = QLabel("⏸️ Detenida")
        self.camera_status.setFont(QFont("Arial", 12))
        self.camera_status.setStyleSheet("color: #e74c3c; font-weight: bold;")
        self.camera_status.setAlignment(Qt.AlignmentFlag.AlignCenter)
        camera_layout.addWidget(self.camera_status)
        
        content_layout.addWidget(camera_container, 55)
        
        # === DERECHA: FORMULARIO ===
        form_container = QWidget()
        form_layout = QVBoxLayout(form_container)
        form_layout.setSpacing(20)
        
        form_title = QLabel("✍️ Registrar Asistencia")
        form_title.setFont(QFont("Arial", 16, QFont.Weight.Bold))
        form_title.setStyleSheet("color: #667eea; margin-bottom: 10px;")
        form_layout.addWidget(form_title)
        
        # Cédula
        cedula_label = QLabel("Número de Cédula")
        cedula_label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        cedula_label.setStyleSheet("color: #34495e;")
        form_layout.addWidget(cedula_label)
        
        self.input_cedula = QLineEdit()
        self.input_cedula.setPlaceholderText("Ingrese el número de cédula")
        self.input_cedula.setMaxLength(15)
        self.input_cedula.returnPressed.connect(self.registrar_asistencia)
        form_layout.addWidget(self.input_cedula)
        
        # Tipo de registro
        tipo_label = QLabel("Tipo de Registro")
        tipo_label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        tipo_label.setStyleSheet("color: #34495e; margin-top: 15px;")
        form_layout.addWidget(tipo_label)
        
        tipos_layout = QHBoxLayout()
        self.combo_tipo = QComboBox()
        self.combo_tipo.addItems(["Entrada 📥", "Salida 📤"])
        self.combo_tipo.setFont(QFont("Arial", 14))
        tipos_layout.addWidget(self.combo_tipo)
        form_layout.addLayout(tipos_layout)
        
        # Botón de registro GRANDE
        form_layout.addSpacing(30)
        
        self.btn_registrar = QPushButton("🎯 REGISTRAR ASISTENCIA")
        self.btn_registrar.setMinimumHeight(80)
        self.btn_registrar.setFont(QFont("Arial", 18, QFont.Weight.Bold))
        self.btn_registrar.setStyleSheet("""
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #667eea, stop:1 #764ba2);
                color: white;
                border-radius: 15px;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 #5568d3, stop:1 #663a8b);
            }
            QPushButton:pressed {
                background: #764ba2;
            }
            QPushButton:disabled {
                background: #bdc3c7;
            }
        """)
        self.btn_registrar.clicked.connect(self.registrar_asistencia)
        self.btn_registrar.setEnabled(False)
        form_layout.addWidget(self.btn_registrar)
        
        # Log de actividades
        log_label = QLabel("📋 Registro de Actividad")
        log_label.setFont(QFont("Arial", 12, QFont.Weight.Bold))
        log_label.setStyleSheet("color: #34495e; margin-top: 20px;")
        form_layout.addWidget(log_label)
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setMaximumHeight(150)
        self.log_text.setStyleSheet("""
            QTextEdit {
                background: #f8f9fa;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                padding: 10px;
                font-family: 'Courier New';
                font-size: 11px;
            }
        """)
        form_layout.addWidget(self.log_text)
        
        form_layout.addStretch()
        content_layout.addWidget(form_container, 45)
        
        main_layout.addWidget(content_frame)
        
        # Iniciar cámara automáticamente
        QTimer.singleShot(1000, self.iniciar_camara_auto)
    
    def iniciar_camara_auto(self):
        """Inicia la cámara automáticamente"""
        if not self.camera_active:
            self.camera = cv2.VideoCapture(0)
            if self.camera.isOpened():
                self.timer.start(30)
                self.camera_active = True
                self.camera_status.setText("🎥 Activa")
                self.camera_status.setStyleSheet("color: #27ae60; font-weight: bold;")
                self.log("✅ Cámara iniciada automáticamente")
            else:
                self.camera_label.setText("❌\n\nError: No se puede acceder\na la cámara")
                self.log("❌ Error: No se pudo acceder a la cámara")
    
    def update_frame(self):
        """Actualiza el frame de la cámara"""
        if self.camera is not None:
            ret, frame = self.camera.read()
            if ret:
                self.current_frame = frame
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                h, w, ch = rgb_frame.shape
                bytes_per_line = ch * w
                qt_image = QImage(rgb_frame.data, w, h, bytes_per_line, QImage.Format.Format_RGB888)
                pixmap = QPixmap.fromImage(qt_image)
                scaled_pixmap = pixmap.scaled(
                    self.camera_label.size(),
                    Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation
                )
                self.camera_label.setPixmap(scaled_pixmap)
    
    def validar_equipo(self):
        """Valida si el equipo está autorizado"""
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
                    self.entity_name = data.get("mensaje", "Entidad")
                    self.status_label.setText(f"✅ Equipo Autorizado")
                    self.status_label.setStyleSheet("color: #27ae60; font-weight: bold;")
                    self.entity_label.setText(f"🏛️ {self.entity_name}")
                    self.btn_registrar.setEnabled(True)
                    self.log(f"✅ Equipo autorizado: {self.entity_name}")
                    self.input_cedula.setFocus()
                else:
                    self.mostrar_error_autorizacion(data["mensaje"])
            else:
                raise Exception(f"Error {response.status_code}")
        except Exception as e:
            self.mostrar_error_conexion(str(e))
    
    def mostrar_error_autorizacion(self, mensaje):
        """Muestra error de autorización"""
        self.status_label.setText(f"❌ No Autorizado")
        self.status_label.setStyleSheet("color: #e74c3c; font-weight: bold;")
        self.log(f"❌ {mensaje}")
        QMessageBox.critical(
            self,
            "Equipo No Autorizado",
            f"{mensaje}\n\nUUID: {self.equipo_uuid}\n\n"
            "Contacte al administrador del sistema."
        )
    
    def mostrar_error_conexion(self, error):
        """Muestra error de conexión"""
        self.status_label.setText("❌ Error de Conexión")
        self.status_label.setStyleSheet("color: #e74c3c; font-weight: bold;")
        self.log(f"❌ Error de conexión: {error}")
        QMessageBox.critical(
            self,
            "Error de Conexión",
            f"No se pudo conectar con el servidor.\n\n{error}\n\n"
            "Verifique su conexión a internet."
        )
    
    def registrar_asistencia(self):
        """Registra la asistencia del funcionario"""
        if not self.equipo_valido:
            QMessageBox.warning(self, "Error", "Equipo no autorizado")
            return
        
        cedula = self.input_cedula.text().strip()
        if not cedula:
            QMessageBox.warning(self, "Campo Requerido", "Por favor ingrese el número de cédula")
            self.input_cedula.setFocus()
            return
        
        # Detectar tipo basado en combo
        tipo_texto = self.combo_tipo.currentText()
        tipo_registro = "entrada" if "Entrada" in tipo_texto else "salida"
        
        # Convertir foto a base64
        foto_base64 = None
        if self.current_frame is not None:
            _, buffer = cv2.imencode('.jpg', self.current_frame)
            foto_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Enviar al servidor
        try:
            self.log(f"⏳ Registrando {tipo_registro} para cédula {cedula}...")
            
            payload = {
                "cedula": cedula,
                "equipo_uuid": self.equipo_uuid,
                "tipo_registro": tipo_registro,
                "foto_base64": foto_base64,
                "observaciones": None
            }
            
            response = requests.post(
                f"{self.API_URL}/api/asistencia/registros",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 201:
                data = response.json()
                nombre = f"{data.get('funcionario_nombres', '')} {data.get('funcionario_apellidos', '')}"
                hora = datetime.now().strftime('%I:%M:%S %p')
                
                self.log(f"✅ {tipo_registro.upper()}: {nombre} - {hora}")
                
                QMessageBox.information(
                    self,
                    "✅ Registro Exitoso",
                    f"Registro de {tipo_registro} completado\n\n"
                    f"👤 {nombre}\n"
                    f"🆔 {cedula}\n"
                    f"🕐 {hora}"
                )
                
                self.input_cedula.clear()
                self.input_cedula.setFocus()
            else:
                error_data = response.json()
                error_msg = error_data.get("detail", "Error desconocido")
                self.log(f"❌ Error: {error_msg}")
                QMessageBox.critical(self, "Error", f"Error al registrar:\n\n{error_msg}")
        
        except requests.exceptions.Timeout:
            self.log("❌ Error: Tiempo de espera agotado")
            QMessageBox.critical(self, "Error", "Tiempo de espera agotado. Intente nuevamente.")
        except Exception as e:
            self.log(f"❌ Error: {str(e)}")
            QMessageBox.critical(self, "Error", f"Error al registrar:\n\n{str(e)}")
    
    def log(self, message):
        """Agrega mensaje al log"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.append(f"[{timestamp}] {message}")
        scrollbar = self.log_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())
    
    def closeEvent(self, event):
        """Maneja el cierre de la aplicación"""
        if self.camera is not None:
            self.timer.stop()
            self.camera.release()
        event.accept()


def main():
    app = QApplication(sys.argv)
    app.setStyle('Fusion')  # Estilo moderno
    window = ModernVentanillaApp()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
