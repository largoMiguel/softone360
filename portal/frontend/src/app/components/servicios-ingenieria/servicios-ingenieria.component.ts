import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Servicio {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string;
  categoria: string;
}

interface Contacto {
  nombre: string;
  profesion: string;
  email: string;
  telefono: string;
  especialidad: string;
}

interface Categoria {
  nombre: string;
  descripcion: string;
  color: string;
}

interface Tecnologia {
  nombre: string;
  descripcion: string;
  icono: string;
}

interface ServiciosData {
  titulo: string;
  subtitulo: string;
  servicios: Servicio[];
  contacto: Contacto;
  categorias: Categoria[];
  ventajas: string[];
  tecnologias: Tecnologia[];
}

@Component({
  selector: 'app-servicios-ingenieria',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './servicios-ingenieria.component.html',
  styleUrls: ['./servicios-ingenieria.component.scss']
})
export class ServiciosIngenieriaComponent implements OnInit {
  data: ServiciosData | null = null;
  loading = true;
  error: string | null = null;
  categoriaSeleccionada: string = 'todos';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarServicios();
  }

  cargarServicios() {
    this.loading = true;
    this.http.get<ServiciosData>(`${environment.apiUrl}/servicios-ingenieria`)
      .subscribe({
        next: (data) => {
          this.data = data;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error al cargar servicios:', error);
          this.error = 'Error al cargar la información. Por favor, intente más tarde.';
          this.loading = false;
        }
      });
  }

  get serviciosFiltrados(): Servicio[] {
    if (!this.data || this.categoriaSeleccionada === 'todos') {
      return this.data?.servicios || [];
    }
    return this.data.servicios.filter(s => s.categoria === this.categoriaSeleccionada);
  }

  filtrarPorCategoria(categoria: string) {
    this.categoriaSeleccionada = categoria;
  }

  enviarWhatsApp() {
    if (this.data?.contacto) {
      const telefono = this.data.contacto.telefono.replace(/\s/g, '');
      const mensaje = encodeURIComponent('Hola, estoy interesado en sus servicios de ingeniería vial.');
      window.open(`https://wa.me/57${telefono}?text=${mensaje}`, '_blank');
    }
  }

  enviarEmail() {
    if (this.data?.contacto) {
      window.location.href = `mailto:${this.data.contacto.email}?subject=Consulta sobre servicios de ingeniería vial`;
    }
  }
}
