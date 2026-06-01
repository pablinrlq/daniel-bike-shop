export interface Product {
  id: string;
  slug?: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: 'bicicletas' | 'pecas' | 'acessorios' | string;
  image: string;
  stock: number;
  featured?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}
