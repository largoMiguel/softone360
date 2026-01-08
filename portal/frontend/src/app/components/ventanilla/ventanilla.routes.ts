import { Routes } from '@angular/router';
import { VentanillaComponent } from './ventanilla.component';
import { DashboardAsistenciaComponent } from './dashboard-asistencia/dashboard-asistencia.component';
import { FuncionariosComponent } from './funcionarios/funcionarios.component';
import { RegistrosAsistenciaComponent } from './registros-asistencia/registros-asistencia.component';
import { EquiposRegistroComponent } from './equipos-registro/equipos-registro.component';
import { LoginAsistenciaComponent } from './login-asistencia/login-asistencia.component';

export const VENTANILLA_ROUTES: Routes = [
  {
    path: '',
    component: VentanillaComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardAsistenciaComponent },
      { path: 'funcionarios', component: FuncionariosComponent },
      { path: 'registros', component: RegistrosAsistenciaComponent },
      { path: 'equipos', component: EquiposRegistroComponent }
    ]
  }
];

// Ruta independiente para login de asistencia
export const LOGIN_ASISTENCIA_ROUTE: Routes = [
  { path: 'asistencia-login', component: LoginAsistenciaComponent }
];
