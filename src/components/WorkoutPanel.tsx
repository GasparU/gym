import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { WorkoutModule } from './WorkoutModule';

// Envoltura para que un fallo del módulo de rutina se VEA en pantalla.
export const WorkoutPanel: React.FC = () => (
  <ErrorBoundary nombre="Rutina">
    <WorkoutModule />
  </ErrorBoundary>
);
