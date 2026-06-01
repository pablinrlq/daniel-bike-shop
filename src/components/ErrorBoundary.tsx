import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("App error caught by boundary:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-destructive">
              Algo deu errado
            </p>
            <h1 className="mb-4 text-3xl md:text-4xl font-bold">
              Ops, encontramos um problema
            </h1>
            <p className="mb-8 text-muted-foreground">
              Nossa equipe foi notificada. Tente recarregar a página.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
