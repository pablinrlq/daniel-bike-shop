import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: rota não encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
          Erro 404
        </p>
        <h1 className="mb-4 text-5xl md:text-6xl font-bold">Página não encontrada</h1>
        <p className="mb-8 text-muted-foreground">
          A página que você procura saiu para pedalar. Vamos te levar de volta para casa.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              Voltar para o início
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/produtos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Ver produtos
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
