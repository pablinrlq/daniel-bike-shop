import { useCallback, useRef, useState } from "react";
import { onlyDigits } from "@/lib/formatters";

export interface CepData {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export const useCepLookup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const lastQueriedRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lookup = useCallback(async (rawCep: string): Promise<CepData | null> => {
    const cep = onlyDigits(rawCep);
    if (cep.length !== 8) return null;
    if (lastQueriedRef.current === cep) return null;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastQueriedRef.current = cep;

    setIsLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as CepData;
      if (data.erro) return null;
      return data;
    } catch (err) {
      if ((err as Error).name === "AbortError") return null;
      console.warn("CEP lookup falhou:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { lookup, isLoading };
};
