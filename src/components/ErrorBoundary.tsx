import React from 'react';

interface Props {
  nombre: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// Sin esto, un error de render en React 19 DESMONTA el panel entero y la
// pantalla queda en blanco sin decir nada. Con la frontera, el error se LEE.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.nombre}] error de render:`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-4 p-4 rounded-xl bg-rose-950/40 border border-rose-700 text-rose-200 space-y-2">
          <p className="font-bold text-sm">La sección «{this.props.nombre}» se rompió al dibujarse.</p>
          <p className="text-xs font-mono break-all">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
          >
            Recargar la página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
