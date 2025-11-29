import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IgacService } from '../../services/igac.service';
import { Predio } from '../../models/igac.model';

@Component({
  selector: 'app-igac-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './igac-viewer.component.html',
  styleUrl: './igac-viewer.component.scss'
})
export class IgacViewerComponent {
  predios = signal<Predio[]>([]);
  filteredPredios = signal<Predio[]>([]);
  searchTerm = signal<string>('');
  selectedPredio = signal<Predio | null>(null);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');
  expandedPredios = new Set<string>();

  constructor(private igacService: IgacService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.isLoading.set(true);
    this.errorMessage.set('');

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string;
        const parsedPredios = this.igacService.parseCsvToJson(csvContent);
        
        this.predios.set(parsedPredios);
        this.filteredPredios.set(parsedPredios);
        this.isLoading.set(false);
        
        console.log(`Se cargaron ${parsedPredios.length} predios`);
      } catch (error) {
        this.errorMessage.set('Error al procesar el archivo CSV');
        this.isLoading.set(false);
        console.error('Error:', error);
      }
    };

    reader.onerror = () => {
      this.errorMessage.set('Error al leer el archivo');
      this.isLoading.set(false);
    };

    reader.readAsText(file, 'UTF-8');
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    const filtered = this.igacService.filterPredios(this.predios(), term);
    this.filteredPredios.set(filtered);
  }

  togglePredio(predioId: string): void {
    if (this.expandedPredios.has(predioId)) {
      this.expandedPredios.delete(predioId);
    } else {
      this.expandedPredios.add(predioId);
    }
  }

  isPredioExpanded(predioId: string): boolean {
    return this.expandedPredios.has(predioId);
  }

  selectPredio(predio: Predio): void {
    this.selectedPredio.set(predio);
  }

  closeModal(): void {
    this.selectedPredio.set(null);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-CO').format(value);
  }

  clearData(): void {
    this.predios.set([]);
    this.filteredPredios.set([]);
    this.searchTerm.set('');
    this.selectedPredio.set(null);
    this.expandedPredios.clear();
  }

  exportToJson(): void {
    const dataStr = JSON.stringify(this.predios(), null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'predios-igac.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  getTotalPropietarios(): number {
    return this.filteredPredios().reduce((sum, p) => sum + p.propietarios.length, 0);
  }

  getTotalAvaluo(): number {
    return this.filteredPredios().reduce((sum, p) => sum + p.avaluo, 0);
  }
}
