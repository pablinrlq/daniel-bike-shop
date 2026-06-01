import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  noIndex?: boolean;
}

const BASE_TITLE = "Daniel Bike Shop — Bicicletas, Peças e Acessórios";
const BASE_DESCRIPTION =
  "Loja especializada em bicicletas, peças e acessórios em Belo Horizonte.";

const setMeta = (name: string, content: string, attr: "name" | "property" = "name") => {
  if (typeof document === "undefined") return;
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
};

const setLink = (rel: string, href: string) => {
  if (typeof document === "undefined") return;
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
};

const SEO = ({ title, description, canonical, noIndex }: SEOProps) => {
  useEffect(() => {
    const finalTitle = title ? `${title} | Daniel Bike Shop` : BASE_TITLE;
    const finalDescription = description || BASE_DESCRIPTION;

    document.title = finalTitle;
    setMeta("description", finalDescription);
    setMeta("og:title", finalTitle, "property");
    setMeta("og:description", finalDescription, "property");
    setMeta("twitter:title", finalTitle);
    setMeta("twitter:description", finalDescription);

    if (canonical) setLink("canonical", canonical);

    setMeta(
      "robots",
      noIndex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    );
  }, [title, description, canonical, noIndex]);

  return null;
};

export default SEO;
