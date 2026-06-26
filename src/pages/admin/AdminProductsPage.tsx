import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Package,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProductImageUpload from '@/components/admin/ProductImageUpload';
import { fallbackImageFor } from '@/lib/productFallback';
import { overrideImageForSku } from '@/lib/productImageOverrides';

interface ProductImage {
  id?: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  brand: string | null;
  model: string | null;
  category_id: string | null;
  price: number;
  promotional_price: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  is_featured: boolean;
  aro: string | null;
  material_quadro: string | null;
  marchas: string | null;
  suspensao: string | null;
  tamanho_quadro: string | null;
  created_at: string;
  categories?: { name: string } | null;
  product_images?: { image_url: string; is_primary: boolean; display_order: number }[];
}

// Miniatura da lista: foto própria (principal) se houver; senão a foto/plaquinha
// da categoria (mesma do site). hasOwn diz se o produto já tem foto de verdade.
const resolveThumb = (p: Product): { src: string; hasOwn: boolean } => {
  const own =
    p.product_images?.find((i) => i.is_primary)?.image_url || p.product_images?.[0]?.image_url;
  return { src: own || overrideImageForSku(p.sku) || fallbackImageFor(p.name), hasOwn: !!own };
};

interface Category {
  id: string;
  name: string;
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const AdminProductsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    brand: '',
    model: '',
    category_id: '',
    price: '',
    promotional_price: '',
    stock_quantity: '',
    low_stock_threshold: '5',
    is_active: true,
    is_featured: false,
    aro: '',
    material_quadro: '',
    marchas: '',
    suspensao: '',
    tamanho_quadro: '',
  });
  const [productImages, setProductImages] = useState<ProductImage[]>([]);

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products', searchTerm, categoryFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, categories(name), product_images(image_url, is_primary, display_order)')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category_id', categoryFilter);
      }

      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['admin-categories-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string; images: ProductImage[] }) => {
      const slug = generateSlug(data.name);
      const productData = {
        name: data.name,
        slug,
        description: data.description || null,
        brand: data.brand || null,
        model: data.model || null,
        category_id: data.category_id || null,
        price: parseFloat(data.price) || 0,
        promotional_price: data.promotional_price ? parseFloat(data.promotional_price) : null,
        stock_quantity: parseInt(data.stock_quantity) || 0,
        low_stock_threshold: parseInt(data.low_stock_threshold) || 5,
        is_active: data.is_active,
        is_featured: data.is_featured,
        aro: data.aro || null,
        material_quadro: data.material_quadro || null,
        marchas: data.marchas || null,
        suspensao: data.suspensao || null,
        tamanho_quadro: data.tamanho_quadro || null,
      };

      let productId = data.id;

      if (data.id) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert(productData)
          .select('id')
          .single();
        if (error) throw error;
        productId = newProduct.id;
      }

      // Handle images
      if (productId && data.images.length > 0) {
        // Delete existing images if updating
        if (data.id) {
          await supabase.from('product_images').delete().eq('product_id', productId);
        }

        // Insert new images
        const imagesToInsert = data.images.map((img, index) => ({
          product_id: productId,
          image_url: img.image_url,
          is_primary: img.is_primary,
          display_order: index,
        }));

        const { error: imgError } = await supabase
          .from('product_images')
          .insert(imagesToInsert);
        
        if (imgError) throw imgError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products-count'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: 'Sucesso!',
        description: selectedProduct ? 'Produto atualizado.' : 'Produto criado.',
      });
    },
    onError: (error: { message?: string }) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar produto.',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products-count'] });
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      toast({
        title: 'Sucesso!',
        description: 'Produto excluído.',
      });
    },
    onError: (error: { message?: string }) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir produto.',
        variant: 'destructive',
      });
    },
  });

  // Toggle product active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      toast({
        title: variables.isActive ? 'Produto ativado!' : 'Produto desativado!',
        description: variables.isActive 
          ? 'O produto agora está visível para clientes.' 
          : 'O produto foi ocultado dos clientes.',
      });
    },
    onError: (error: { message?: string }) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao alterar status.',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      brand: '',
      model: '',
      category_id: '',
      price: '',
      promotional_price: '',
      stock_quantity: '',
      low_stock_threshold: '5',
      is_active: true,
      is_featured: false,
      aro: '',
      material_quadro: '',
      marchas: '',
      suspensao: '',
      tamanho_quadro: '',
    });
    setProductImages([]);
    setSelectedProduct(null);
  };

  const loadProductImages = async (productId: string) => {
    const { data } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .order('display_order');
    
    if (data) {
      setProductImages(data.map(img => ({
        id: img.id,
        image_url: img.image_url,
        is_primary: img.is_primary,
        display_order: img.display_order,
      })));
    }
  };

  const handleEdit = async (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      brand: product.brand || '',
      model: product.model || '',
      category_id: product.category_id || '',
      price: product.price.toString(),
      promotional_price: product.promotional_price?.toString() || '',
      stock_quantity: product.stock_quantity.toString(),
      low_stock_threshold: product.low_stock_threshold.toString(),
      is_active: product.is_active,
      is_featured: product.is_featured,
      aro: product.aro || '',
      material_quadro: product.material_quadro || '',
      marchas: product.marchas || '',
      suspensao: product.suspensao || '',
      tamanho_quadro: product.tamanho_quadro || '',
    });
    await loadProductImages(product.id);
    setIsDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      ...formData,
      id: selectedProduct?.id,
      images: productImages,
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">Gerencie os produtos da loja</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou marca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : products && products.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="hidden md:table-cell">Categoria</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead className="hidden sm:table-cell">Estoque</TableHead>
                    <TableHead className="hidden lg:table-cell">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const thumb = resolveThumb(product);
                    return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={thumb.src}
                            alt=""
                            loading="lazy"
                            className="h-12 w-12 rounded object-cover bg-white border border-border flex-shrink-0"
                          />
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {product.brand && (
                                <span className="text-sm text-muted-foreground">{product.brand}</span>
                              )}
                              {!thumb.hasOwn && (
                                <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                  sem foto própria
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {product.categories?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          {product.promotional_price ? (
                            <>
                              <span className="line-through text-muted-foreground text-sm">
                                {formatPrice(product.price)}
                              </span>
                              <br />
                              <span className="text-primary font-medium">
                                {formatPrice(product.promotional_price)}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium">{formatPrice(product.price)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className={cn(
                          'font-medium',
                          product.stock_quantity <= product.low_stock_threshold && 'text-destructive'
                        )}>
                          {product.stock_quantity}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap items-center gap-2">
                          <Switch
                            checked={product.is_active}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ id: product.id, isActive: checked })
                            }
                            disabled={toggleActiveMutation.isPending}
                          />
                          <span className={cn(
                            'text-xs',
                            product.is_active ? 'text-green-600' : 'text-muted-foreground'
                          )}>
                            {product.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                          {product.is_featured && (
                            <Badge variant="outline" className="text-xs">Destaque</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum produto encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do produto
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brand">Marca</Label>
                <Input
                  id="brand"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="border-t pt-4">
              <ProductImageUpload
                productId={selectedProduct?.id}
                images={productImages}
                onImagesChange={setProductImages}
                disabled={saveMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promotional_price">Preço Promocional (R$)</Label>
                <Input
                  id="promotional_price"
                  type="number"
                  step="0.01"
                  value={formData.promotional_price}
                  onChange={(e) => setFormData({ ...formData, promotional_price: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stock_quantity">Estoque *</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="low_stock_threshold">Alerta Estoque Baixo</Label>
                <Input
                  id="low_stock_threshold"
                  type="number"
                  value={formData.low_stock_threshold}
                  onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Especificações Técnicas</h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="aro">Aro</Label>
                  <Input
                    id="aro"
                    value={formData.aro}
                    onChange={(e) => setFormData({ ...formData, aro: e.target.value })}
                    placeholder="ex: 29"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="material_quadro">Material do Quadro</Label>
                  <Input
                    id="material_quadro"
                    value={formData.material_quadro}
                    onChange={(e) => setFormData({ ...formData, material_quadro: e.target.value })}
                    placeholder="ex: Alumínio"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="marchas">Marchas</Label>
                  <Input
                    id="marchas"
                    value={formData.marchas}
                    onChange={(e) => setFormData({ ...formData, marchas: e.target.value })}
                    placeholder="ex: 21"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suspensao">Suspensão</Label>
                  <Input
                    id="suspensao"
                    value={formData.suspensao}
                    onChange={(e) => setFormData({ ...formData, suspensao: e.target.value })}
                    placeholder="ex: Dianteira"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tamanho_quadro">Tamanho do Quadro</Label>
                  <Input
                    id="tamanho_quadro"
                    value={formData.tamanho_quadro}
                    onChange={(e) => setFormData({ ...formData, tamanho_quadro: e.target.value })}
                    placeholder="ex: M (17)"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Produto Ativo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_featured"
                  checked={formData.is_featured}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                />
                <Label htmlFor="is_featured">Em Destaque</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedProduct ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedProduct?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedProduct && deleteMutation.mutate(selectedProduct.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProductsPage;
