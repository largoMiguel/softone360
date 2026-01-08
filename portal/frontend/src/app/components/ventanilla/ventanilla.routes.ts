import { Routes } from '@angular/router';
import { TalentoHumanoLayoutComponent } from './talento-humano-layout/talento-humano-layout.component';
import { DashboardAsistenciaComponent } from './dashboard-asistencia/dashboard-asistencia.component';
import { FuncionariosComponent } from './funcionarios/funcionarios.component';
import { RegistrosAsistenciaComponent } from './registros-asistencia/registros-asistencia.component';
import { EquiposRegistroComponent } from './equipos-registro/equipos-registro.component';

export const VENTANILLA_ROUTES: Routes = [
  {
    path: '',
    component: TalentoHumanoLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardAsistenciaComponent },
      { path: 'funcionarios', component: FuncionariosComponent },
      { path: 'registros', component: RegistrosAsistenciaComponent },
      { path: 'equipos', component: EquiposRegistroComponent }
    ]
  }
];
